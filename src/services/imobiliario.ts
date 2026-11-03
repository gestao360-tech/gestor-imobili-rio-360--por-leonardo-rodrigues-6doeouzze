import pb from '@/lib/pocketbase/client'
import {
  ImovelModel,
  InquilinoModel,
  ProprietarioModel,
  ContratoModel,
  CobrancaModel,
  ReajusteModel,
  RenovacaoModel,
  PendenciaModel,
  DespesaModel,
  CaucaoGarantiaModel,
  DocumentoModel,
  NotificacaoModel,
  HistoricoAlteracaoModel,
  ConfiguracaoModel,
  DashboardMetrics,
  UserModel,
} from '@/types/database'

export async function getCurrentUser(): Promise<UserModel | null> {
  if (!pb.authStore.isValid || !pb.authStore.record) return null
  return pb.authStore.record as unknown as UserModel
}

export function formatBRL(val?: number): string {
  if (val === undefined || val === null || isNaN(val)) return 'R$ 0,00'
  return new Intl.NumberFormat('pt-BR', { style: 'currency', currency: 'BRL' }).format(val)
}

export function formatDateBR(dateStr?: string): string {
  if (!dateStr) return '-'
  try {
    const parts = dateStr.split('T')[0].split('-')
    if (parts.length === 3) {
      return `${parts[2]}/${parts[1]}/${parts[0]}`
    }
    return new Date(dateStr).toLocaleDateString('pt-BR')
  } catch (_) {
    return dateStr
  }
}

// ----------------- PROPRIETÁRIOS -----------------
export async function getProprietarios(): Promise<ProprietarioModel[]> {
  return await pb.collection('proprietarios').getFullList<ProprietarioModel>({ sort: 'nome' })
}

export async function createProprietario(
  data: Partial<ProprietarioModel>,
): Promise<ProprietarioModel> {
  return await pb.collection('proprietarios').create<ProprietarioModel>(data)
}

export async function updateProprietario(
  id: string,
  data: Partial<ProprietarioModel>,
): Promise<ProprietarioModel> {
  return await pb.collection('proprietarios').update<ProprietarioModel>(id, data)
}

export async function deleteProprietario(id: string): Promise<boolean> {
  return await pb.collection('proprietarios').delete(id)
}

// ----------------- INQUILINOS -----------------
export async function getInquilinos(): Promise<InquilinoModel[]> {
  return await pb.collection('inquilinos').getFullList<InquilinoModel>({ sort: 'nome' })
}

export async function createInquilino(data: Partial<InquilinoModel>): Promise<InquilinoModel> {
  return await pb.collection('inquilinos').create<InquilinoModel>(data)
}

export async function updateInquilino(
  id: string,
  data: Partial<InquilinoModel>,
): Promise<InquilinoModel> {
  return await pb.collection('inquilinos').update<InquilinoModel>(id, data)
}

export async function deleteInquilino(id: string): Promise<boolean> {
  return await pb.collection('inquilinos').delete(id)
}

// ----------------- IMÓVEIS -----------------
export async function getImoveis(): Promise<ImovelModel[]> {
  return await pb.collection('imoveis').getFullList<ImovelModel>({ sort: 'codigo' })
}

export async function getImovelById(id: string): Promise<ImovelModel> {
  return await pb.collection('imoveis').getOne<ImovelModel>(id)
}

export async function createImovel(data: Partial<ImovelModel>): Promise<ImovelModel> {
  return await pb.collection('imoveis').create<ImovelModel>(data)
}

export async function updateImovel(id: string, data: Partial<ImovelModel>): Promise<ImovelModel> {
  return await pb.collection('imoveis').update<ImovelModel>(id, data)
}

export async function deleteImovel(id: string): Promise<boolean> {
  return await pb.collection('imoveis').delete(id)
}

// ----------------- CONTRATOS -----------------
export async function getContratos(): Promise<ContratoModel[]> {
  return await pb.collection('contratos').getFullList<ContratoModel>({
    sort: '-created',
    expand: 'imovel,inquilino',
  })
}

export async function getContratoById(id: string): Promise<ContratoModel> {
  return await pb.collection('contratos').getOne<ContratoModel>(id, {
    expand: 'imovel,inquilino',
  })
}

export async function createContrato(data: Partial<ContratoModel>): Promise<ContratoModel> {
  const created = await pb.collection('contratos').create<ContratoModel>(data)
  // Automatically generate next monthly cobrancas for this active contract
  await generateCobrancasForContrato(created)
  return created
}

export async function updateContrato(
  id: string,
  data: Partial<ContratoModel>,
): Promise<ContratoModel> {
  return await pb.collection('contratos').update<ContratoModel>(id, data)
}

export async function deleteContrato(id: string): Promise<boolean> {
  return await pb.collection('contratos').delete(id)
}

// ----------------- COBRANÇAS & PAGAMENTOS -----------------
export async function getCobrancas(): Promise<CobrancaModel[]> {
  return await pb.collection('cobrancas').getFullList<CobrancaModel>({
    sort: '-vencimento',
    expand: 'contrato,imovel,inquilino',
  })
}

export async function createCobranca(data: Partial<CobrancaModel>): Promise<CobrancaModel> {
  return await pb.collection('cobrancas').create<CobrancaModel>(data)
}

export async function updateCobranca(
  id: string,
  data: Partial<CobrancaModel>,
): Promise<CobrancaModel> {
  return await pb.collection('cobrancas').update<CobrancaModel>(id, data)
}

export async function registrarBaixaPagamento(params: {
  cobrancaId: string
  valorPago: number
  dataPagamento: string
  formaPagamento: 'pix' | 'boleto' | 'ted_doc' | 'dinheiro' | 'cartao' | 'outra'
  contaBancaria?: string
  observacoes?: string
}): Promise<CobrancaModel> {
  const cobranca = await pb.collection('cobrancas').getOne<CobrancaModel>(params.cobrancaId)
  const novoTotalPago = (cobranca.valor_pago || 0) + params.valorPago
  const isTotal = novoTotalPago >= cobranca.valor_total

  // 1. Registra o pagamento na coleção pagamentos
  await pb.collection('pagamentos').create({
    cobranca: params.cobrancaId,
    data_pagamento: params.dataPagamento,
    valor_pago: params.valorPago,
    forma_pagamento: params.formaPagamento,
    conta_bancaria: params.contaBancaria || '',
    observacoes: params.observacoes || '',
    registrado_por: pb.authStore.record?.name || 'Administrador',
  })

  // 2. Atualiza status da cobrança
  const updated = await pb.collection('cobrancas').update<CobrancaModel>(params.cobrancaId, {
    valor_pago: novoTotalPago,
    data_pagamento: params.dataPagamento,
    forma_pagamento: params.formaPagamento,
    conta_bancaria: params.contaBancaria || cobranca.conta_bancaria,
    status: isTotal ? 'pago' : 'pago_parcialmente',
    recibo_gerado: `REC-${Date.now().toString().slice(-6)}`,
  })

  // 3. Registra no histórico de auditoria
  await pb.collection('historico_alteracoes').create({
    entidade: 'cobranca',
    registro_id: params.cobrancaId,
    acao: 'baixa_pagamento',
    usuario_nome: pb.authStore.record?.name || 'Administrador',
    detalhes: `Baixa de ${formatBRL(params.valorPago)} registrada (${isTotal ? 'Total' : 'Parcial'}). Status: ${updated.status}`,
  })

  return updated
}

// ----------------- REAJUSTES -----------------
export async function getReajustes(): Promise<ReajusteModel[]> {
  return await pb.collection('reajustes').getFullList<ReajusteModel>({
    sort: '-data_base',
    expand: 'contrato',
  })
}

export async function createReajuste(data: Partial<ReajusteModel>): Promise<ReajusteModel> {
  return await pb.collection('reajustes').create<ReajusteModel>(data)
}

export async function aprovarReajuste(
  id: string,
  novoValorDefinido?: number,
  observacoes?: string,
): Promise<ReajusteModel> {
  const reaj = await pb.collection('reajustes').getOne<ReajusteModel>(id, { expand: 'contrato' })
  const valorFinal = novoValorDefinido || reaj.aluguel_novo_projetado
  const hoje = new Date().toISOString().split('T')[0]

  const updatedReaj = await pb.collection('reajustes').update<ReajusteModel>(id, {
    status: 'aprovado',
    aluguel_novo_aprovado: valorFinal,
    aprovado_por: pb.authStore.record?.name || 'Administrador',
    data_aprovacao: hoje,
    observacao_negociacao: observacoes || reaj.observacao_negociacao,
  })

  // Atualiza o valor_atual do contrato vinculado
  if (reaj.contrato) {
    await pb.collection('contratos').update(reaj.contrato, {
      valor_atual: valorFinal,
    })

    // Registra aditivo / auditoria
    await pb.collection('historico_alteracoes').create({
      entidade: 'contrato',
      registro_id: reaj.contrato,
      acao: 'reajuste',
      usuario_nome: pb.authStore.record?.name || 'Administrador',
      detalhes: `Reajuste de aluguel aprovado: de ${formatBRL(reaj.aluguel_anterior)} para ${formatBRL(valorFinal)} (${reaj.indice} ${reaj.percentual_aplicavel}%)`,
    })
  }

  return updatedReaj
}

// ----------------- RENOVAÇÕES -----------------
export async function getRenovacoes(): Promise<RenovacaoModel[]> {
  return await pb.collection('renovacoes').getFullList<RenovacaoModel>({
    sort: 'dias_restantes',
    expand: 'contrato',
  })
}

export async function resolverRenovacao(
  id: string,
  status: 'renovado' | 'prorrogado_legal' | 'distratado' | 'resolvido',
  observacoes?: string,
): Promise<RenovacaoModel> {
  const hoje = new Date().toISOString().split('T')[0]
  return await pb.collection('renovacoes').update<RenovacaoModel>(id, {
    status,
    historico_negociacao: observacoes,
    data_resolucao: hoje,
  })
}

// ----------------- PENDÊNCIAS (Central de Providências) -----------------
export async function getPendencias(): Promise<PendenciaModel[]> {
  return await pb.collection('pendencias').getFullList<PendenciaModel>({
    sort: 'prazo',
    expand: 'imovel,inquilino,contrato',
  })
}

export async function createPendencia(data: Partial<PendenciaModel>): Promise<PendenciaModel> {
  return await pb.collection('pendencias').create<PendenciaModel>(data)
}

export async function updatePendencia(
  id: string,
  data: Partial<PendenciaModel>,
): Promise<PendenciaModel> {
  return await pb.collection('pendencias').update<PendenciaModel>(id, data)
}

export async function resolverPendencia(id: string, solucao: string): Promise<PendenciaModel> {
  const hoje = new Date().toISOString().split('T')[0]
  return await pb.collection('pendencias').update<PendenciaModel>(id, {
    status: 'resolvida',
    solucao_registro: solucao,
    data_resolucao: hoje,
  })
}

// ----------------- DESPESAS -----------------
export async function getDespesas(): Promise<DespesaModel[]> {
  return await pb.collection('despesas').getFullList<DespesaModel>({
    sort: '-data_vencimento',
    expand: 'imovel',
  })
}

export async function createDespesa(data: Partial<DespesaModel>): Promise<DespesaModel> {
  return await pb.collection('despesas').create<DespesaModel>(data)
}

export async function updateDespesa(
  id: string,
  data: Partial<DespesaModel>,
): Promise<DespesaModel> {
  return await pb.collection('despesas').update<DespesaModel>(id, data)
}

// ----------------- CAUÇÕES E GARANTIAS -----------------
export async function getCaucoesGarantias(): Promise<CaucaoGarantiaModel[]> {
  return await pb.collection('caucoes_garantias').getFullList<CaucaoGarantiaModel>({
    sort: '-created',
    expand: 'contrato',
  })
}

export async function createCaucao(
  data: Partial<CaucaoGarantiaModel>,
): Promise<CaucaoGarantiaModel> {
  return await pb.collection('caucoes_garantias').create<CaucaoGarantiaModel>(data)
}

// ----------------- DOCUMENTOS -----------------
export async function getDocumentos(): Promise<DocumentoModel[]> {
  return await pb.collection('documentos').getFullList<DocumentoModel>({
    sort: '-created',
    expand: 'imovel,inquilino,contrato',
  })
}

export async function uploadDocumento(formData: FormData): Promise<DocumentoModel> {
  return await pb.collection('documentos').create<DocumentoModel>(formData)
}

// ----------------- NOTIFICAÇÕES -----------------
export async function getNotificacoes(): Promise<NotificacaoModel[]> {
  return await pb.collection('notificacoes').getFullList<NotificacaoModel>({
    sort: '-created',
  })
}

export async function marcarNotificacaoLida(id: string): Promise<NotificacaoModel> {
  return await pb.collection('notificacoes').update<NotificacaoModel>(id, { lida: true })
}

// ----------------- HISTÓRICO DE AUDITORIA -----------------
export async function getHistorico(): Promise<HistoricoAlteracaoModel[]> {
  return await pb.collection('historico_alteracoes').getFullList<HistoricoAlteracaoModel>({
    sort: '-created',
  })
}

// ----------------- CONFIGURAÇÕES -----------------
export async function getConfiguracoes(): Promise<ConfiguracaoModel[]> {
  return await pb.collection('configuracoes').getFullList<ConfiguracaoModel>()
}

// ----------------- REMOVER DADOS DE DEMONSTRAÇÃO -----------------
export async function purgeDemoData(): Promise<void> {
  const collections = [
    'pendencias',
    'notificacoes',
    'despesas',
    'caucoes_garantias',
    'cobrancas',
    'pagamentos',
    'reajustes',
    'renovacoes',
    'aditivos',
    'contratos',
    'imoveis',
    'inquilinos',
    'proprietarios',
  ]

  for (const colName of collections) {
    try {
      const records = await pb.collection(colName).getFullList({ filter: 'is_demo = true' })
      for (const r of records) {
        await pb.collection(colName).delete(r.id)
      }
    } catch {
      /* intentionally ignored */
    }
  }
}

// ----------------- CÁLCULO DOS 17 INDICADORES REAIS -----------------
export async function fetchDashboardMetrics(): Promise<DashboardMetrics> {
  const [imoveis, contratos, cobrancas, reajustes, renovacoes, caucoes, pendencias] =
    await Promise.all([
      pb.collection('imoveis').getFullList<ImovelModel>(),
      pb.collection('contratos').getFullList<ContratoModel>(),
      pb.collection('cobrancas').getFullList<CobrancaModel>(),
      pb.collection('reajustes').getFullList<ReajusteModel>(),
      pb.collection('renovacoes').getFullList<RenovacaoModel>(),
      pb.collection('caucoes_garantias').getFullList<CaucaoGarantiaModel>(),
      pb.collection('pendencias').getFullList<PendenciaModel>(),
    ])

  const totalImoveis = imoveis.length
  const imoveisAlugados = imoveis.filter((i) => i.situacao === 'alugado').length
  const imoveisDisponiveis = imoveis.filter((i) => i.situacao === 'disponivel').length

  const contratosAtivosList = contratos.filter(
    (c) => c.status === 'ativo' || c.status === 'prorrogado_legal' || c.status === 'renovado',
  )
  const contratosAtivos = contratosAtivosList.length

  // Contratos próximos do vencimento (<= 90 dias)
  const agora = new Date()
  const contratosProximosVencimento = contratos.filter((c) => {
    if (c.status !== 'ativo') return false
    const fim = new Date(c.data_fim)
    const diffDias = Math.ceil((fim.getTime() - agora.getTime()) / (1000 * 60 * 60 * 24))
    return diffDias > 0 && diffDias <= 90
  }).length

  // Receita mensal contratada: soma do valor_atual de todos os contratos ativos
  const receitaMensalContratada = contratosAtivosList.reduce(
    (acc, c) => acc + (c.valor_atual || 0),
    0,
  )

  // Competência atual (YYYY-MM)
  const mesAtualStr = `${agora.getFullYear()}-${String(agora.getMonth() + 1).padStart(2, '0')}`

  // Cobranças do mês atual
  const cobrancasMes = cobrancas.filter(
    (c) => c.competencia === mesAtualStr || c.vencimento.startsWith(mesAtualStr),
  )

  // Receita recebida no mês: soma de valor_pago
  const receitaRecebidaMes = cobrancasMes.reduce((acc, c) => acc + (c.valor_pago || 0), 0)

  // Valores pendentes (a vencer ou pago parcialmente ainda em aberto)
  const valoresPendentes = cobrancasMes
    .filter((c) => c.status === 'a_vencer' || c.status === 'pago_parcialmente')
    .reduce((acc, c) => acc + Math.max(0, (c.valor_total || 0) - (c.valor_pago || 0)), 0)

  // Valores vencidos e inadimplentes
  const valoresVencidosInadimplentes = cobrancas
    .filter((c) => c.status === 'vencido')
    .reduce((acc, c) => acc + Math.max(0, (c.valor_total || 0) - (c.valor_pago || 0)), 0)

  // Receita anual acumulada (ano corrente)
  const anoAtualStr = String(agora.getFullYear())
  const receitaAnualAcumulada = cobrancas
    .filter(
      (c) =>
        c.vencimento.startsWith(anoAtualStr) &&
        (c.status === 'pago' || c.status === 'pago_parcialmente'),
    )
    .reduce((acc, c) => acc + (c.valor_pago || 0), 0)

  // Previsão 12 meses: receita mensal contratada * 12
  const previsaoReceita12Meses = receitaMensalContratada * 12

  // Reajustes previstos aguardando aprovação ou em negociação
  const reajustesPrevistos = reajustes.filter(
    (r) => r.status === 'aguardando_aprovacao' || r.status === 'em_negociacao',
  ).length

  // Renovações pendentes
  const renovacoesPendentes = renovacoes.filter(
    (r) => r.status === 'pendente' || r.status === 'em_negociacao',
  ).length

  // Taxa de ocupação
  const taxaOcupacao = totalImoveis > 0 ? (imoveisAlugados / totalImoveis) * 100 : 0

  // % Inadimplência: valor vencido / (valor total faturado no mês ou na carteira)
  const totalFaturadoMes = cobrancasMes.reduce((acc, c) => acc + (c.valor_total || 0), 0)
  const percentualInadimplencia =
    totalFaturadoMes > 0 ? (valoresVencidosInadimplentes / totalFaturadoMes) * 100 : 0

  // Total de garantias / cauções ativas
  const totalGarantiasCaucoes = caucoes
    .filter((cg) => cg.status === 'ativa' || cg.status === 'pendente_comprovante')
    .reduce((acc, cg) => acc + (cg.valor || 0), 0)

  // Pendências administrativas
  const pendenciasAdministrativas = pendencias.filter(
    (p) => p.status === 'pendente' || p.status === 'em_andamento',
  ).length

  return {
    totalImoveis,
    imoveisAlugados,
    imoveisDisponiveis,
    contratosAtivos,
    contratosProximosVencimento,
    receitaMensalContratada,
    receitaRecebidaMes,
    valoresPendentes,
    valoresVencidosInadimplentes,
    receitaAnualAcumulada,
    previsaoReceita12Meses,
    reajustesPrevistos,
    renovacoesPendentes,
    taxaOcupacao: Math.round(taxaOcupacao * 10) / 10,
    percentualInadimplencia: Math.round(percentualInadimplencia * 10) / 10,
    totalGarantiasCaucoes,
    pendenciasAdministrativas,
  }
}

// Auxiliar para gerar competência mensal do contrato
async function generateCobrancasForContrato(contrato: ContratoModel) {
  try {
    const imovel = await pb.collection('imoveis').getOne<ImovelModel>(contrato.imovel)
    const agora = new Date()
    const mesAtual = agora.getMonth() + 1
    const anoAtual = agora.getFullYear()
    const comp = `${anoAtual}-${String(mesAtual).padStart(2, '0')}`

    // Verifica se já existe
    const existing = await pb.collection('cobrancas').getList(1, 1, {
      filter: `contrato = '${contrato.id}' && competencia = '${comp}'`,
    })

    if (existing.items.length === 0) {
      const diaVenc = Math.min(contrato.dia_vencimento || 10, 28)
      const vencimento = `${anoAtual}-${String(mesAtual).padStart(2, '0')}-${String(diaVenc).padStart(2, '0')}`

      const iptu = contrato.responsavel_iptu === 'inquilino' ? imovel.valor_iptu_mensal || 0 : 0
      const cond =
        contrato.responsavel_condominio === 'inquilino' ? imovel.valor_condominio_mensal || 0 : 0
      const aluguel = contrato.valor_atual || 0
      const total = aluguel + iptu + cond

      await pb.collection('cobrancas').create({
        contrato: contrato.id,
        imovel: contrato.imovel,
        inquilino: contrato.inquilino,
        competencia: comp,
        vencimento: vencimento,
        valor_aluguel: aluguel,
        valor_desconto: contrato.desconto_pontualidade || 0,
        valor_acrescimo: 0,
        valor_multa: 0,
        valor_juros: 0,
        valor_iptu: iptu,
        valor_condominio: cond,
        outras_cobrancas: 0,
        valor_total: total,
        valor_pago: 0,
        status: 'a_vencer',
      })
    }
  } catch (err) {
    console.error('Erro ao gerar competências automáticas:', err)
  }
}
