import pb from '@/lib/pocketbase/client'
import {
  AditivoModel,
  CobrancaModel,
  ContratoModel,
  DocumentoModel,
  HistoricoAlteracaoModel,
  ImovelModel,
  ReajusteModel,
  PendenciaModel,
  RenovacaoModel,
} from '@/types/database'
import { formatDateBR as formatDateBRSvc, formatBRL } from '@/services/imobiliario'

/* Operações do ciclo de vida do contrato, integradas às coleções existentes:
 * aditivos, reajustes, renovacoes, documentos, pendencias e historico_alteracoes.
 * REGRA DO BRIEFING: nada é apagado — toda alteração fica registrada no histórico
 * cronológico e auditável (coleção historico_alteracoes + valores *_anterior). */

async function registrarHistorico(params: {
  entidade: string
  registroId: string
  acao: HistoricoAlteracaoModel['acao']
  detalhes: string
  dadosAnteriores?: Record<string, unknown>
  dadosNovos?: Record<string, unknown>
}) {
  await pb.collection('historico_alteracoes').create({
    entidade: params.entidade,
    registro_id: params.registroId,
    acao: params.acao,
    usuario_nome: pb.authStore.record?.name || 'Administrador',
    detalhes: params.detalhes,
    ...(params.dadosAnteriores
      ? { dados_anteriores_json: JSON.stringify(params.dadosAnteriores) }
      : {}),
    ...(params.dadosNovos ? { dados_novos_json: JSON.stringify(params.dadosNovos) } : {}),
  })
}

/** Próximo número sequencial do aditivo deste contrato. */
async function proximoSequencialAditivo(contratoId: string): Promise<number> {
  const lista = await pb.collection('aditivos').getList(1, 1, {
    filter: `contrato = '${contratoId}'`,
    sort: '-numero_sequencial',
  })
  return (lista.items[0]?.numero_sequencial || 0) + 1
}

export interface ParamsAditivo {
  contratoId: string
  dataAditivo: string
  tipoAlteracao: AditivoModel['tipo_alteracao']
  descricao: string
  valorNovo?: number
  dataFimNova?: string
  statusAditivo?: AditivoModel['status']
  documento?: File
}

/**
 * Registra um aditivo e aplica a alteração no contrato, preservando os valores
 * anteriores no próprio aditivo (valor_anterior / data_fim_anterior) e no histórico.
 */
export async function registrarAditivo(params: ParamsAditivo): Promise<AditivoModel> {
  const contrato = await pb.collection('contratos').getOne<ContratoModel>(params.contratoId)
  const sequencial = await proximoSequencialAditivo(params.contratoId)
  const hoje = new Date().toISOString().split('T')[0]

  const corpo: Record<string, unknown> = {
    contrato: params.contratoId,
    numero_sequencial: sequencial,
    data_aditivo: params.dataAditivo,
    tipo_alteracao: params.tipoAlteracao,
    descricao: params.descricao,
    valor_anterior: contrato.valor_atual,
    data_fim_anterior: contrato.data_fim,
    status: params.statusAditivo || 'assinado',
  }
  if (params.valorNovo !== undefined && params.valorNovo !== null)
    corpo.valor_novo = params.valorNovo
  if (params.dataFimNova) corpo.data_fim_nova = params.dataFimNova

  let formData: FormData | null = null
  if (params.documento) {
    formData = new FormData()
    for (const [k, v] of Object.entries(corpo)) formData!.append(k, String(v))
    formData!.append('documento', params.documento)
  }

  const aditivo = formData
    ? await pb.collection('aditivos').create<AditivoModel>(formData)
    : await pb.collection('aditivos').create<AditivoModel>(corpo)

  // Aplica no contrato apenas o que o aditivo altera — nada é apagado,
  // os valores anteriores ficam no aditivo e no histórico.
  const alteracoes: Record<string, unknown> = {}
  if (params.tipoAlteracao === 'valor' && params.valorNovo !== undefined) {
    alteracoes.valor_atual = params.valorNovo
  }
  if (params.tipoAlteracao === 'prazo' && params.dataFimNova) {
    alteracoes.data_fim = params.dataFimNova
  }
  if (Object.keys(alteracoes).length > 0) {
    await pb.collection('contratos').update(params.contratoId, alteracoes)
  }

  await registrarHistorico({
    entidade: 'contrato',
    registroId: params.contratoId,
    acao: 'aditivo',
    detalhes: `Aditivo nº ${sequencial} (${params.tipoAlteracao}): ${params.descricao}`,
    dadosAnteriores: {
      valor_atual: contrato.valor_atual,
      data_fim: contrato.data_fim,
    },
    dadosNovos: alteracoes,
  })

  return aditivo
}

export interface ParamsRenovacao {
  contratoId: string
  novoFim: string
  novoValor?: number
  novoPrazoMeses?: number
  observacoes?: string
}

/** Renova o contrato: novo término (e opcionalmente novo valor), preservando o anterior. */
export async function renovarContrato(params: ParamsRenovacao): Promise<ContratoModel> {
  const contrato = await pb.collection('contratos').getOne<ContratoModel>(params.contratoId)
  const hoje = new Date().toISOString().split('T')[0]

  const alteracoes: Partial<ContratoModel> = {
    data_fim: params.novoFim,
    status: 'renovado',
  }
  if (params.novoValor !== undefined && params.novoValor !== null) {
    alteracoes.valor_atual = params.novoValor
  }
  if (params.novoPrazoMeses) alteracoes.prazo_meses = params.novoPrazoMeses

  const atualizado = await pb
    .collection('contratos')
    .update<ContratoModel>(params.contratoId, alteracoes)

  // Nada é apagado: o término e o valor anteriores ficam preservados em um
  // aditivo de prazo/valor + no histórico cronológico e auditável.
  const sequencial = await proximoSequencialAditivo(params.contratoId)
  await pb.collection('aditivos').create<AditivoModel>({
    contrato: params.contratoId,
    numero_sequencial: sequencial,
    data_aditivo: hoje,
    tipo_alteracao: 'prazo',
    descricao:
      `Renovação: término ${formatDateBR(contrato.data_fim)} → ${formatDateBR(params.novoFim)}` +
      (params.novoValor
        ? ` · aluguel ${formatBRL(contrato.valor_atual)} → ${formatBRL(params.novoValor)}`
        : '') +
      (params.observacoes ? ` · ${params.observacoes}` : ''),
    valor_anterior: contrato.valor_atual,
    valor_novo: params.novoValor ?? contrato.valor_atual,
    data_fim_anterior: contrato.data_fim,
    data_fim_nova: params.novoFim,
    status: 'assinado',
  })

  // Mantém a aba Renovações consistente: resolve a negociação existente (se houver)
  // ou registra a renovação concluída.
  try {
    const abertas = await pb.collection('renovacoes').getList(1, 1, {
      filter: `contrato = '${params.contratoId}' && (status = 'pendente' || status = 'em_negociacao')`,
    })
    if (abertas.items.length > 0) {
      for (const r of abertas.items) {
        await pb.collection('renovacoes').update(r.id, {
          status: 'renovado',
          proposta_novo_valor: params.novoValor ?? r.proposta_novo_valor,
          proposta_novo_prazo_meses: params.novoPrazoMeses ?? r.proposta_novo_prazo_meses,
          historico_negociacao: params.observacoes || r.historico_negociacao,
          data_resolucao: hoje,
        })
      }
    } else {
      await pb.collection('renovacoes').create({
        contrato: params.contratoId,
        status: 'renovado',
        proposta_novo_valor: params.novoValor,
        proposta_novo_prazo_meses: params.novoPrazoMeses,
        historico_negociacao: params.observacoes,
        data_resolucao: hoje,
      })
    }
  } catch {
    /* integração best-effort com a central de renovações */
  }

  await registrarHistorico({
    entidade: 'contrato',
    registroId: params.contratoId,
    acao: 'renovacao',
    detalhes:
      `Renovação: término de ${formatDateBR(contrato.data_fim)} para ${formatDateBR(params.novoFim)}` +
      (params.novoValor
        ? ` · aluguel de ${formatBRL(contrato.valor_atual)} para ${formatBRL(params.novoValor)}`
        : ''),
    dadosAnteriores: { data_fim: contrato.data_fim, valor_atual: contrato.valor_atual },
    dadosNovos: { data_fim: params.novoFim, valor_atual: params.novoValor ?? contrato.valor_atual },
  })

  return atualizado
}

/** Prorroga o prazo do contrato mantendo o valor (alteração de data de término). */
export async function prorrogarPrazo(
  contratoId: string,
  novaDataFim: string,
): Promise<ContratoModel> {
  return registrarAditivo({
    contratoId,
    dataAditivo: new Date().toISOString().split('T')[0],
    tipoAlteracao: 'prazo',
    descricao: `Prorrogação do prazo: término até ${formatDateBR(novaDataFim)} (mantidos demais termos).`,
    dataFimNova: novaDataFim,
    statusAditivo: 'assinado',
  }).then(() => pb.collection('contratos').getOne<ContratoModel>(contratoId))
}

export interface ParamsDistrato {
  contratoId: string
  dataDistrato: string
  motivo: string
  entregaChaves?: string
}

/**
 * Encerra o contrato por distrato: registra data/motivo/entrega de chaves,
 * marca o contrato como distratado e devolve o imóvel para "disponível".
 */
export async function encerrarPorDistrato(params: ParamsDistrato): Promise<ContratoModel> {
  const contrato = await pb.collection('contratos').getOne<ContratoModel>(params.contratoId)

  const atualizado = await pb.collection('contratos').update<ContratoModel>(params.contratoId, {
    status: 'distratado',
    data_distrato: params.dataDistrato,
    motivo_distrato: params.motivo,
    ...(params.entregaChaves ? { entrega_chaves_data: params.entregaChaves } : {}),
  })

  // Devolve o imóvel à situação anterior (disponível para nova locação)
  try {
    const imovel = await pb.collection('imoveis').getOne<ImovelModel>(contrato.imovel)
    if (imovel.situacao === 'alugado') {
      await pb.collection('imoveis').update(contrato.imovel, { situacao: 'disponivel' })
    }
  } catch {
    /* imóvel já pode ter sido removido — best-effort */
  }

  await registrarHistorico({
    entidade: 'contrato',
    registroId: params.contratoId,
    acao: 'edicao',
    detalhes:
      `Distrato em ${formatDateBR(params.dataDistrato)} · motivo: ${params.motivo}` +
      (params.entregaChaves ? ` · chaves entregues em ${formatDateBR(params.entregaChaves)}` : ''),
    dadosAnteriores: { status: contrato.status, data_fim: contrato.data_fim },
    dadosNovos: { status: 'distratado', data_distrato: params.dataDistrato },
  })

  return atualizado
}

/** Atualiza valores/garantia/desconto por aditivo (alteração de garantia, desconto temporário etc.). */
export async function alterarGarantia(
  contratoId: string,
  novaGarantia: Pick<ContratoModel, 'garantia_tipo' | 'garantia_detalhes' | 'garantia_valor'>,
  descricao: string,
): Promise<ContratoModel> {
  const contrato = await pb.collection('contratos').getOne<ContratoModel>(contratoId)
  const hoje = new Date().toISOString().split('T')[0]
  const sequencial = await proximoSequencialAditivo(contratoId)

  await pb.collection('aditivos').create<AditivoModel>({
    contrato: contratoId,
    numero_sequencial: sequencial,
    data_aditivo: hoje,
    tipo_alteracao: 'garantia',
    descricao,
    valor_anterior: contrato.garantia_valor,
    valor_novo: novaGarantia.garantia_valor,
    status: 'assinado',
  })

  const atualizado = await pb
    .collection('contratos')
    .update<ContratoModel>(contratoId, novaGarantia)

  await registrarHistorico({
    entidade: 'contrato',
    registroId: contratoId,
    acao: 'aditivo',
    detalhes: `Alteração de garantia: ${descricao}`,
    dadosAnteriores: {
      garantia_tipo: contrato.garantia_tipo,
      garantia_valor: contrato.garantia_valor,
    },
    dadosNovos: novaGarantia as unknown as Record<string, unknown>,
  })

  return atualizado
}

/** Anexa um PDF/documento ao contrato (coleção documentos, vinculada ao contrato). */
export async function anexarDocumentoContrato(params: {
  contratoId: string
  imovelId?: string
  inquilinoId?: string
  arquivo: File
  titulo: string
  tipo: DocumentoModel['tipo']
  dataDocumento?: string
  observacoes?: string
}): Promise<DocumentoModel> {
  const fd = new FormData()
  fd.append('titulo', params.titulo)
  fd.append('tipo', params.tipo)
  if (params.imovelId) fd.append('imovel', params.imovelId)
  if (params.inquilinoId) fd.append('inquilino', params.inquilinoId)
  fd.append('contrato', params.contratoId)
  fd.append('arquivo', params.arquivo)
  if (params.dataDocumento) fd.append('data_documento', params.dataDocumento)
  if (params.observacoes) fd.append('observacoes', params.observacoes)

  const doc = await pb.collection('documentos').create<DocumentoModel>(fd)

  await registrarHistorico({
    entidade: 'contrato',
    registroId: params.contratoId,
    acao: 'edicao',
    detalhes: `Documento anexado: ${params.titulo} (${params.tipo})`,
  })

  return doc
}

export function arquivoUrl(doc: DocumentoModel): string {
  return pb.files.getURL(doc, doc.arquivo)
}

/** URL do arquivo anexado ao aditivo. */
export function aditivoDocumentoUrl(aditivo: AditivoModel): string {
  return pb.files.getURL(aditivo, aditivo.documento?.[0] || '')
}

// ----------------- CONSULTAS PARA A FICHA DO CONTRATO -----------------

export async function getAditivosContrato(contratoId: string): Promise<AditivoModel[]> {
  return await pb.collection('aditivos').getFullList<AditivoModel>({
    filter: `contrato = '${contratoId}'`,
    sort: '-data_aditivo,-created',
  })
}

export async function getReajustesContrato(contratoId: string): Promise<ReajusteModel[]> {
  return await pb.collection('reajustes').getFullList<ReajusteModel>({
    filter: `contrato = '${contratoId}'`,
    sort: '-data_base',
  })
}

export async function getRenovacoesContrato(contratoId: string): Promise<RenovacaoModel[]> {
  return await pb.collection('renovacoes').getFullList<RenovacaoModel>({
    filter: `contrato = '${contratoId}'`,
    sort: '-created',
  })
}

export async function getDocumentosContrato(contratoId: string): Promise<DocumentoModel[]> {
  return await pb.collection('documentos').getFullList<DocumentoModel>({
    filter: `contrato = '${contratoId}'`,
    sort: '-created',
  })
}

export async function getCobrancasContrato(contratoId: string): Promise<CobrancaModel[]> {
  return await pb.collection('cobrancas').getFullList<CobrancaModel>({
    filter: `contrato = '${contratoId}'`,
    sort: '-vencimento',
  })
}

export async function getPendenciasContrato(contratoId: string): Promise<PendenciaModel[]> {
  return await pb.collection('pendencias').getFullList<PendenciaModel>({
    filter: `contrato = '${contratoId}'`,
    sort: '-created',
    expand: 'contrato',
  })
}

export interface ItemHistorico {
  id: string
  data: string
  acao: string
  titulo: string
  detalhes: string
  origem: 'historico' | 'aditivo' | 'reajuste' | 'renovacao'
}

/** Histórico cronológico e auditável do contrato: auditoria + aditivos + reajustes + renovações. */
export async function getHistoricoCronologico(contratoId: string): Promise<ItemHistorico[]> {
  const [audit, aditivos, reajustes, renovacoes] = await Promise.all([
    pb.collection('historico_alteracoes').getFullList<HistoricoAlteracaoModel>({
      filter: `registro_id = '${contratoId}'`,
      sort: '-created',
    }),
    getAditivosContrato(contratoId),
    getReajustesContrato(contratoId),
    getRenovacoesContrato(contratoId),
  ])

  const itens: ItemHistorico[] = []

  for (const h of audit) {
    itens.push({
      id: `h-${h.id}`,
      data: h.created,
      acao: h.acao,
      titulo: rotuloAcao(h.acao),
      detalhes: h.detalhes,
      origem: 'historico',
    })
  }
  for (const a of aditivos) {
    itens.push({
      id: `a-${a.id}`,
      data: a.created,
      acao: 'aditivo',
      titulo: `Aditivo nº ${a.numero_sequencial} · ${rotuloTipoAditivo(a.tipo_alteracao)}`,
      detalhes:
        a.descricao +
        (a.valor_anterior != null && a.valor_novo != null
          ? ` (${formatBRL(a.valor_anterior)} → ${formatBRL(a.valor_novo)})`
          : a.data_fim_anterior && a.data_fim_nova
            ? ` (término ${formatDateBR(a.data_fim_anterior)} → ${formatDateBR(a.data_fim_nova)})`
            : '') +
        ` · status ${rotuloStatusAditivo(a.status)}`,
      origem: 'aditivo',
    })
  }
  for (const r of reajustes) {
    itens.push({
      id: `r-${r.id}`,
      data: r.created,
      acao: 'reajuste',
      titulo: `Reajuste ${r.indice} (${r.tipo_indice}) · ${formatDateBR(r.data_base)}`,
      detalhes: `Aluguel ${formatBRL(r.aluguel_anterior)} → ${formatBRL(
        r.aluguel_novo_aprovado || r.aluguel_novo_projetado,
      )} · status ${rotuloStatusReajuste(r.status)}`,
      origem: 'reajuste',
    })
  }
  for (const rv of renovacoes) {
    itens.push({
      id: `rv-${rv.id}`,
      data: rv.created,
      acao: 'renovacao',
      titulo: `Renovação · ${rotuloStatusRenovacao(rv.status)}`,
      detalhes:
        (rv.proposta_novo_valor ? `Valor proposto: ${formatBRL(rv.proposta_novo_valor)}. ` : '') +
        (rv.proposta_novo_prazo_meses
          ? `Prazo proposto: ${rv.proposta_novo_prazo_meses} meses. `
          : '') +
        (rv.historico_negociacao || ''),
      origem: 'renovacao',
    })
  }

  return itens.sort((a, b) => (a.data < b.data ? 1 : -1))
}

export function formatDateBR(iso?: string): string {
  return formatDateBRSvc(iso)
}

export function rotuloAcao(acao: string): string {
  const mapa: Record<string, string> = {
    criacao: 'Criação',
    edicao: 'Edição',
    exclusao: 'Exclusão',
    baixa_pagamento: 'Baixa de pagamento',
    reajuste: 'Reajuste',
    renovacao: 'Renovação',
    aditivo: 'Aditivo',
  }
  return mapa[acao] || acao
}

export function rotuloTipoAditivo(tipo: string): string {
  const mapa: Record<string, string> = {
    valor: 'Valor',
    prazo: 'Prazo',
    garantia: 'Garantia',
    clausula: 'Cláusula',
    outros: 'Outros',
  }
  return mapa[tipo] || tipo
}

export function rotuloStatusAditivo(status: string): string {
  const mapa: Record<string, string> = {
    pendente_assinatura: 'Pendente de assinatura',
    assinado: 'Assinado',
    cancelado: 'Cancelado',
  }
  return mapa[status] || status
}

export function rotuloStatusReajuste(status: string): string {
  const mapa: Record<string, string> = {
    aguardando_aprovacao: 'Aguardando aprovação',
    aprovado: 'Aprovado',
    em_negociacao: 'Em negociação',
    nao_aplicado: 'Não aplicado',
    rejeitado: 'Rejeitado',
  }
  return mapa[status] || status
}

export function rotuloStatusRenovacao(status: string): string {
  const mapa: Record<string, string> = {
    pendente: 'Pendente',
    em_negociacao: 'Em negociação',
    renovado: 'Renovado',
    prorrogado_legal: 'Prorrogado legal',
    distratado: 'Distratado',
    resolvido: 'Resolvido',
  }
  return mapa[status] || status
}
