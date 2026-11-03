// Construção do plano de importação (prévia antes de gravar).
// Casamento: imóvel por endereço normalizado; inquilino por CPF/CNPJ com
// fallback para nome normalizado; contrato por imóvel+inquilino.
// Nada é gravado aqui — só é decidido o que criar/atualizar/ignorar.
import pb from '@/lib/pocketbase/client'
import type { ContratoModel, CobrancaModel, ImovelModel, InquilinoModel } from '@/types/database'
import type {
  DadosExistentes,
  MapeamentoColunas,
  MesChave,
  PlanoCobranca,
  PlanoContrato,
  PlanoImovel,
  PlanoInquilino,
  PlanoImportacao,
  ProblemaImportacao,
  TabelaExtraida,
} from './types'
import { resumoZerado } from './types'
import {
  classificarDoc,
  dataVencimento,
  extrairBairro,
  hashCurto,
  inferirTipo,
  normalizarEndereco,
  normalizarNome,
  parseDia,
  parseNumeroBR,
  pareceVago,
  resumirEndereco,
  soDigitos,
  somarMesesISO,
  textoDe,
  valorData,
  hojeISO,
} from './normalizacao'

const MES_NUMERO: Record<MesChave, number> = {
  jan: 1,
  fev: 2,
  mar: 3,
  abr: 4,
  mai: 5,
  jun: 6,
  jul: 7,
  ago: 8,
  set: 9,
  out: 10,
  nov: 11,
  dez: 12,
}

export async function montarPlano(
  tabela: TabelaExtraida,
  mapeamento: MapeamentoColunas,
  anoReferencia: number,
): Promise<{ plano: PlanoImportacao; existentes: DadosExistentes }> {
  const problemas: ProblemaImportacao[] = []
  const [imoveis, inquilinos, contratos, cobrancas] = await Promise.all([
    pb.collection('imoveis').getFullList<ImovelModel>(),
    pb.collection('inquilinos').getFullList<InquilinoModel>(),
    pb.collection('contratos').getFullList<ContratoModel>(),
    pb.collection('cobrancas').getFullList<CobrancaModel>(),
  ])

  const imoveisPorEndereco = new Map<string, ImovelModel>()
  for (const im of imoveis) imoveisPorEndereco.set(normalizarEndereco(im.endereco), im)

  const inqPorDoc = new Map<string, InquilinoModel>()
  const inqPorNome = new Map<string, InquilinoModel>()
  for (const iq of inquilinos) {
    const dig = soDigitos(iq.cpf_cnpj || '')
    if (dig.length >= 11) inqPorDoc.set(dig, iq)
    inqPorNome.set(normalizarNome(iq.nome), iq)
  }

  const contratosPorPar = new Map<string, ContratoModel>()
  const contratosAtivosPorImovel = new Map<string, ContratoModel>()
  for (const c of contratos) {
    if (['encerrado', 'distratado'].includes(c.status)) continue
    contratosPorPar.set(`${c.imovel}|${c.inquilino}`, c)
    if (!contratosAtivosPorImovel.has(c.imovel)) contratosAtivosPorImovel.set(c.imovel, c)
  }

  const cobrancaPorChave = new Map<string, CobrancaModel>()
  for (const cb of cobrancas) cobrancaPorChave.set(`${cb.contrato}|${cb.competencia}`, cb)

  const mapaImoveis = new Map<string, PlanoImovel>()
  const mapaInquilinos = new Map<string, PlanoInquilino>()
  const mapaContratos = new Map<string, PlanoContrato>()
  const resumo = resumoZerado()
  const hoje = hojeISO()

  for (const linha of tabela.linhas) {
    const ler = (idx: number | null | undefined) =>
      idx == null ? null : (linha.celulas[idx] ?? null)

    const enderecoBruto = textoDe(ler(mapeamento.endereco))
    if (!enderecoBruto) {
      problemas.push({
        linha: linha.numero,
        mensagem: 'Linha sem endereço de imóvel — ignorada.',
        severidade: 'erro',
      })
      resumo.linhasIgnoradas++
      continue
    }
    const nomeBruto = textoDe(ler(mapeamento.inquilinoNome))
    const desocupado = !nomeBruto || pareceVago(nomeBruto)
    const enderecoNorm = normalizarEndereco(enderecoBruto)
    const descricaoBruta = textoDe(ler(mapeamento.descricao))

    // ---------- IMÓVEL ----------
    const identificador = descricaoBruta || resumirEndereco(enderecoBruto)
    let imovelPlan = mapaImoveis.get(enderecoNorm)
    if (!imovelPlan) {
      const existente = imoveisPorEndereco.get(enderecoNorm) ?? null
      const dados: Record<string, unknown> = existente
        ? {}
        : {
            codigo: `IMO-${hashCurto(enderecoNorm)}`,
            nome: identificador,
            tipo: inferirTipo(descricaoBruta, enderecoBruto),
            situacao: desocupado ? 'disponivel' : 'alugado',
            endereco: enderecoBruto,
            numero: '',
            complemento: '',
            bairro: extrairBairro(enderecoBruto) || 'Não informado',
            cidade: 'Belo Horizonte',
            estado: 'MG',
            area_total: 0,
            area_construida: 0,
            valor_estimado: 0,
            valor_aquisicao: 0,
            data_aquisicao: hoje,
            valor_iptu_mensal: 0,
            valor_condominio_mensal: 0,
            valor_seguro_mensal: 0,
            proprietarios_json: '[]',
            observacoes: '',
            is_demo: false,
          }
      if (existente) {
        if (desocupado && existente.situacao === 'alugado') dados.situacao = 'disponivel'
        if (!desocupado && existente.situacao !== 'alugado') dados.situacao = 'alugado'
      }
      imovelPlan = {
        chave: enderecoNorm,
        acao: existente ? 'atualizar' : 'criar',
        id: existente?.id ?? null,
        endereco: enderecoBruto,
        desocupado,
        dados,
      }
      mapaImoveis.set(enderecoNorm, imovelPlan)
      if (existente) resumo.imoveisAtualizar++
      else resumo.imoveisCriar++
    } else if (desocupado) {
      imovelPlan.desocupado = true
      if (imovelPlan.acao === 'criar') imovelPlan.dados.situacao = 'disponivel'
    }

    // ---------- INQUILINO ----------
    let inquilinoPlan: PlanoInquilino | null = null
    if (!desocupado) {
      const docBruto = textoDe(ler(mapeamento.cpfCnpj))
      const dig = soDigitos(docBruto)
      const docInfo = docBruto && docBruto !== '#' ? classificarDoc(docBruto) : null
      if (docBruto && docInfo && !docInfo.valido) {
        problemas.push({
          linha: linha.numero,
          mensagem: `CPF/CNPJ "${docBruto}" não passou na validação — vínculo será feito pelo nome.`,
          severidade: 'aviso',
        })
      }
      const nomeNorm = normalizarNome(nomeBruto)
      const existente =
        (dig.length >= 11 ? inqPorDoc.get(dig) : undefined) ?? inqPorNome.get(nomeNorm) ?? null
      const dados: Record<string, unknown> = {}
      if (!existente) {
        dados.tipo_pessoa = dig.length === 14 ? 'PJ' : 'PF'
        dados.nome = nomeBruto
        // cpf_cnpj é obrigatório no banco: sem documento, usa um marcador
        // estável derivado do nome (o casamento continua sendo pelo nome).
        dados.cpf_cnpj = docInfo?.valido ? dig : docBruto || `N/D-${hashCurto(nomeNorm)}`
        dados.rg_ie = ''
        dados.data_nasc_const = ''
        dados.email = ''
        dados.endereco = ''
        dados.representante_legal = ''
        dados.contato_financeiro = ''
        dados.observacoes = ''
        dados.is_demo = false
      } else if (docInfo?.valido && !soDigitos(existente.cpf_cnpj || '')) {
        dados.cpf_cnpj = dig
      }
      const telefoneBruto = textoDe(ler(mapeamento.telefone))
      if (telefoneBruto && telefoneBruto !== '#') dados.telefone = telefoneBruto
      if (!existente || Object.keys(dados).length > 0) {
        inquilinoPlan = {
          chave: nomeNorm,
          acao: existente ? 'atualizar' : 'criar',
          id: existente?.id ?? null,
          nome: existente?.nome ?? nomeBruto,
          dados,
        }
      } else {
        inquilinoPlan = {
          chave: nomeNorm,
          acao: 'nada',
          id: existente.id,
          nome: existente.nome,
          dados: {},
        }
      }
      const anterior = mapaInquilinos.get(nomeNorm)
      if (!anterior) {
        mapaInquilinos.set(nomeNorm, inquilinoPlan)
        if (inquilinoPlan.acao === 'criar') resumo.inquilinosCriar++
        else if (inquilinoPlan.acao === 'atualizar') resumo.inquilinosAtualizar++
      } else {
        inquilinoPlan = anterior
      }
    }

    // ---------- CONTRATO ----------
    let contratoPlan: PlanoContrato | null = null
    if (!desocupado && inquilinoPlan) {
      const valorBruto = parseNumeroBR(ler(mapeamento.valorAluguel))
      const diaBruto = parseDia(ler(mapeamento.diaVencimento))
      const inicioVD = valorData(ler(mapeamento.dataInicio))
      const copasa = textoDe(ler(mapeamento.matriculaCopasa))
      const cemig = textoDe(ler(mapeamento.instalacaoCemig))

      if (valorBruto == null) {
        problemas.push({
          linha: linha.numero,
          mensagem: `Valor do aluguel ausente para "${nomeBruto}" — contrato não será criado nesta linha.`,
          severidade: 'erro',
        })
      } else {
        const existente =
          (imovelPlan.id && inquilinoPlan.id
            ? contratosPorPar.get(`${imovelPlan.id}|${inquilinoPlan.id}`)
            : undefined) ?? null
        const contratoImovel = imovelPlan.id
          ? contratosAtivosPorImovel.get(imovelPlan.id)
          : undefined
        if (existente) {
          const dados: Record<string, unknown> = {}
          if (Math.abs((existente.valor_atual || 0) - valorBruto) > 0.009) {
            dados.valor_atual = valorBruto
          }
          if (diaBruto != null && (existente.dia_vencimento || 0) !== diaBruto) {
            dados.dia_vencimento = diaBruto
          }
          if (inicioVD.tipo === 'data' && inicioVD.iso !== existente.data_inicio) {
            dados.data_inicio = inicioVD.iso
          }
          if (copasa && copasa !== '#' && (existente.matricula_copasa || '') !== copasa) {
            dados.matricula_copasa = copasa
          }
          if (cemig && cemig !== '#' && (existente.instalacao_cemig || '') !== cemig) {
            dados.instalacao_cemig = cemig
          }
          // (copasa/cemig vindos da planilha; campos adicionados pela migração 0008)
          contratoPlan = {
            chave: `${imovelPlan.chave}|${inquilinoPlan.chave}`,
            acao: Object.keys(dados).length ? 'atualizar' : 'nada',
            id: existente.id,
            imovelRef: imovelPlan,
            inquilinoRef: inquilinoPlan,
            dados,
            cobrancas: [],
            mesesTratados: new Set<number>(),
          }
          if (contratoPlan.acao === 'atualizar') resumo.contratosAtualizar++
        } else if (
          contratoImovel &&
          inquilinoPlan.id &&
          contratoImovel.inquilino !== inquilinoPlan.id
        ) {
          problemas.push({
            linha: linha.numero,
            mensagem:
              'Imóvel já possui contrato ativo com outro inquilino — linha não gera contrato.',
            severidade: 'aviso',
          })
        } else {
          const inicioFinal =
            inicioVD.tipo === 'data' && inicioVD.iso ? inicioVD.iso : `${anoReferencia}-01-01`
          const diaVenc = diaBruto ?? 10
          contratoPlan = {
            chave: `${imovelPlan.chave}|${inquilinoPlan.chave}`,
            acao: 'criar',
            id: null,
            imovelRef: imovelPlan,
            inquilinoRef: inquilinoPlan,
            dados: {
              numero: `CTR-${hashCurto(`${imovelPlan.chave}|${inquilinoPlan.chave}`)}`,
              imovel: imovelPlan.id,
              inquilino: inquilinoPlan.id,
              data_inicio: inicioFinal,
              data_fim: somarMesesISO(inicioFinal, 30),
              prazo_meses: 30,
              valor_inicial: valorBruto,
              valor_atual: valorBruto,
              dia_vencimento: diaVenc,
              periodicidade_reajuste: 'anual',
              indice_reajuste: 'IPCA',
              data_base_reajuste: inicioFinal,
              garantia_tipo: 'sem_garantia',
              garantia_detalhes: '',
              garantia_valor: 0,
              multa_rescisoria_pct: 0,
              multa_atraso_pct: 2,
              juros_mora_mensal_pct: 1,
              desconto_pontualidade: 0,
              carencia_meses: 0,
              responsavel_iptu: 'proprietario',
              responsavel_condominio: 'proprietario',
              responsavel_seguro: 'proprietario',
              clausulas_especiais: '',
              observacoes_juridicas: '',
              status: 'ativo',
              is_demo: false,
              ...(copasa && copasa !== '#' ? { matricula_copasa: copasa } : {}),
              ...(cemig && cemig !== '#' ? { instalacao_cemig: cemig } : {}),
            },
            cobrancas: [],
            mesesTratados: new Set<number>(),
          }
          resumo.contratosCriar++
        }
      }
    }

    // ---------- COBRANÇAS (competências do ano) ----------
    const planoContrato = contratoPlan
    if (planoContrato) {
      for (const [chaveMes, idx] of Object.entries(mapeamento.meses)) {
        if (idx == null) continue
        const mes = MES_NUMERO[chaveMes as MesChave]
        if (!mes) continue
        // Célula vazia = competência em aberto: entra como a vencer/vencida
        // (conforme o vencimento) para o Financeiro mostrar o mês pendente.
        const vd = valorData(ler(idx as number))
        const competencia = `${anoReferencia}-${String(mes).padStart(2, '0')}`
        const diaVenc = Number(planoContrato.dados.dia_vencimento ?? 10)
        const vencimento = dataVencimento(anoReferencia, mes, diaVenc)
        const valorTotal = Number(planoContrato.dados.valor_atual ?? 0)
        let status: 'pago' | 'a_vencer' | 'vencido' = vencimento < hoje ? 'vencido' : 'a_vencer'
        let dataPagamento: string | null = null
        let observacoes = ''
        let registrarPagamento = false
        if (vd.tipo === 'data' && vd.iso) {
          status = 'pago'
          dataPagamento = vd.iso
          registrarPagamento = true
        } else if (vd.tipo === 'texto') {
          status = 'pago'
          observacoes = `Registro da planilha: ${vd.texto}`
        } else if (vd.tipo === 'invalida') {
          problemas.push({
            linha: linha.numero,
            mensagem: `Data ilegível "${vd.texto}" na competência ${competencia} — cobrança ficará ${status === 'vencido' ? 'vencida' : 'a vencer'}.`,
            severidade: 'aviso',
          })
        }
        const existente = planoContrato.id
          ? (cobrancaPorChave.get(`${planoContrato.id}|${competencia}`) ?? null)
          : null
        if (existente) {
          if (status === 'pago' && existente.status !== 'pago') {
            planoContrato.cobrancas.push({
              mes,
              competencia,
              acao: 'atualizar',
              id: existente.id,
              vencimento,
              status,
              dataPagamento,
              valorPago: valorTotal,
              valorTotal: existente.valor_total ?? valorTotal,
              observacoes,
              registrarPagamento,
            })
            resumo.cobrancasAtualizar++
            if (registrarPagamento) resumo.pagamentosCriar++
          } else {
            resumo.cobrancasIgnoradas++
          }
        } else {
          planoContrato.cobrancas.push({
            mes,
            competencia,
            acao: 'criar',
            id: null,
            vencimento,
            status,
            dataPagamento,
            valorPago: status === 'pago' ? valorTotal : 0,
            valorTotal,
            observacoes,
            registrarPagamento: registrarPagamento && status === 'pago',
          })
          resumo.cobrancasCriar++
          if (registrarPagamento && status === 'pago') resumo.pagamentosCriar++
        }
        planoContrato.mesesTratados.add(mes)
      }
      mapaContratos.set(planoContrato.chave, planoContrato)
    }
  }

  return {
    plano: {
      resumo,
      linhas: [],
      imoveis: [...mapaImoveis.values()],
      inquilinos: [...mapaInquilinos.values()],
      contratos: [...mapaContratos.values()],
      problemas,
    },
    existentes: { imoveis, inquilinos, contratos, cobrancas, pagamentos: [] },
  }
}
