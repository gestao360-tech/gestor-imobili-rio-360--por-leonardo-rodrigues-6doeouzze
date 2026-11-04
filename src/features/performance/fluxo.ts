import { ImovelModel, CobrancaModel, DespesaModel, PagamentoModel } from '@/types/database'
import {
  FiltroPerformance,
  OpcoesFiltradas,
  competenciasDaJanela,
  resolverJanela,
} from './calculos'

/* ============================================================
 * Motor de cálculo da ANÁLISE DE FLUXO DE CAIXA.
 * Regra de ouro: fluxo de caixa usa SOMENTE valores efetivamente
 * movimentados — entradas vêm da coleção real `pagamentos`
 * (data_pagamento), saídas das despesas com status 'pago'
 * (data_pagamento). Nada de faturado/projetado.
 * ============================================================ */

export interface LinhaFluxoMensal {
  competencia: string // "YYYY-MM"
  rotulo: string // "Mmm/AAAA"
  entradas: number
  saidas: number
  saldo: number
  acumulado: number
  qtdPagamentos: number
}

export interface ItemComposicao {
  chave: string
  rotulo: string
  valor: number
  qtd: number
  pct: number
}

export interface DadosFluxoCaixa {
  janela: { inicio: string; fim: string; rotulo: string }
  resumo: {
    entradas: number
    saidas: number
    saldo: number
    acumulado: number
    qtdPagamentos: number
    qtdDespesasPagas: number
    ticketMedioEntrada: number
    mesesPositivos: number
    mesesNegativos: number
    maiorEntradaMensal: number
    maiorSaidaMensal: number
  }
  serie: LinhaFluxoMensal[]
  saidasPorCategoria: ItemComposicao[]
  entradasPorImovel: ItemComposicao[]
}

const ROTULOS_CATEGORIA: Record<string, string> = {
  manutencao: 'Manutenção',
  iptu: 'IPTU',
  condominio: 'Condomínio',
  seguro: 'Seguro',
  taxa_administracao: 'Taxa de administração',
  juridico: 'Jurídico',
  reforma: 'Reforma',
  outras: 'Outras',
}

const PALETA_CATEGORIA = [
  '#F15A24', // Laranja institucional
  '#D4A347', // Dourado metálico
  '#102B46', // Azul-marinho secundário
  '#FFD477', // Dourado luminoso
  '#10b981', // Esmeralda
  '#f59e0b', // Âmbar
  '#f43f5e', // Rose
  '#98601F', // Dourado escuro
]

export function corCategoria(i: number): string {
  return PALETA_CATEGORIA[i % PALETA_CATEGORIA.length]
}

function somar(list: number[]): number {
  return list.reduce((a, b) => a + b, 0)
}

/** Somatório dos pagamentos reais por competência de RECEBIMENTO (YYYY-MM). */
function entradasPorCompetencia(pagamentos: PagamentoModel[]): Map<string, number> {
  const m = new Map<string, number>()
  for (const p of pagamentos) {
    if (p.is_demo) continue
    const comp = p.data_pagamento.slice(0, 7)
    m.set(comp, (m.get(comp) || 0) + (p.valor_pago || 0))
  }
  return m
}

/** Mapa cobranca → imóvel, para atribuir cada pagamento real ao imóvel recebedor. */
function mapaCobrancaImovel(cobrancas: CobrancaModel[]): Map<string, string> {
  return new Map(cobrancas.map((c) => [c.id, c.imovel]))
}

export function calcularFluxoCaixa(
  fontes: {
    cobrancas: CobrancaModel[]
    despesas: DespesaModel[]
    pagamentos: PagamentoModel[]
    imoveis: ImovelModel[]
  },
  filtro: FiltroPerformance,
  opcoes: OpcoesFiltradas = {},
): DadosFluxoCaixa {
  const janela = resolverJanela(filtro)
  const comps = competenciasDaJanela(janela.inicio, janela.fim)
  if (comps.length === 0) comps.push(janela.inicio.slice(0, 7))
  const compInicio = comps[0]
  const compFim = comps[comps.length - 1]

  const imovelFiltro = opcoes.imovel && opcoes.imovel !== 'todos' ? opcoes.imovel : ''
  const inquilinoFiltro = opcoes.inquilino && opcoes.inquilino !== 'todos' ? opcoes.inquilino : ''

  const mapImovel = new Map(fontes.imoveis.map((i) => [i.id, i]))

  // Cobranças no escopo dos filtros (imóvel/inquilino) — exclui canceladas.
  const cobrancasEscopo = fontes.cobrancas.filter(
    (c) =>
      c.status !== 'cancelado' &&
      (!imovelFiltro || c.imovel === imovelFiltro) &&
      (!inquilinoFiltro || c.inquilino === inquilinoFiltro),
  )
  const idsEscopo = new Set(cobrancasEscopo.map((c) => c.id))

  // ---------- ENTRADAS: pagamentos reais, no escopo, agrupados por competência ----------
  const entradasComp = entradasPorCompetencia(
    fontes.pagamentos.filter((p) => !p.is_demo && idsEscopo.has(p.cobranca)),
  )
  const cobrancaImovel = mapaCobrancaImovel(fontes.cobrancas)

  // ---------- SAÍDAS: despesas PAGAS, por competência de pagamento ----------
  const despesasEscopo = fontes.despesas.filter(
    (d) =>
      d.status === 'pago' &&
      !d.is_demo &&
      (!imovelFiltro || d.imovel === imovelFiltro) &&
      // despesa não é atribuída a inquilino: com filtro de inquilino as saídas ficam zeradas
      !inquilinoFiltro,
  )
  const saidasComp = new Map<string, { total: number; qtd: number }>()
  const saidasPorCategoriaAcc = new Map<string, { valor: number; qtd: number }>()
  for (const d of despesasEscopo) {
    const comp = (d.data_pagamento || d.data_vencimento).slice(0, 7)
    if (comp < compInicio || comp > compFim) continue
    const atual = saidasComp.get(comp) || { total: 0, qtd: 0 }
    saidasComp.set(comp, { total: atual.total + (d.valor || 0), qtd: atual.qtd + 1 })
    const cat = saidasPorCategoriaAcc.get(d.categoria) || { valor: 0, qtd: 0 }
    saidasPorCategoriaAcc.set(d.categoria, {
      valor: cat.valor + (d.valor || 0),
      qtd: cat.qtd + 1,
    })
  }

  // ---------- Série mensal com saldo e ACUMULADO ----------
  let acumuladoAnterior = 0
  const serie: LinhaFluxoMensal[] = comps.map((comp) => {
    const entradas = entradasComp.get(comp) || 0
    const saidasInfo = saidasComp.get(comp)
    const saidas = saidasInfo?.total ?? 0
    const saldo = entradas - saidas
    const acumulado = acumuladoAnterior + saldo
    acumuladoAnterior = acumulado
    return {
      competencia: comp,
      rotulo: rotuloCurto(comp),
      entradas,
      saidas,
      saldo,
      acumulado,
      qtdPagamentos: 0,
    }
  })

  // Quantidade de pagamentos reais por competência (para detalhe na tabela)
  const qtdPagPorComp = new Map<string, number>()
  for (const p of fontes.pagamentos) {
    if (p.is_demo || !idsEscopo.has(p.cobranca)) continue
    const comp = p.data_pagamento.slice(0, 7)
    qtdPagPorComp.set(comp, (qtdPagPorComp.get(comp) || 0) + 1)
  }
  for (const l of serie) l.qtdPagamentos = qtdPagPorComp.get(l.competencia) || 0

  // ---------- Composição das SAÍDAS por categoria ----------
  const totalSaidas = somar([...saidasPorCategoriaAcc.values()].map((v) => v.valor))
  const saidasPorCategoria: ItemComposicao[] = [...saidasPorCategoriaAcc.entries()]
    .map(([chave, v]) => ({
      chave,
      rotulo: ROTULOS_CATEGORIA[chave] ?? chave,
      valor: v.valor,
      qtd: v.qtd,
      pct: totalSaidas > 0 ? (v.valor / totalSaidas) * 100 : 0,
    }))
    .sort((a, b) => b.valor - a.valor)

  // ---------- Composição das ENTRADAS por imóvel (top recebedores) ----------
  const entradasPorImovelAcc = new Map<string, { valor: number; qtd: number }>()
  for (const p of fontes.pagamentos) {
    if (p.is_demo || !idsEscopo.has(p.cobranca)) continue
    const comp = p.data_pagamento.slice(0, 7)
    if (comp < compInicio || comp > compFim) continue
    const imovelId = cobrancaImovel.get(p.cobranca) || ''
    if (!entradasPorImovelAcc.has(imovelId))
      entradasPorImovelAcc.set(imovelId, { valor: 0, qtd: 0 })
    const acc = entradasPorImovelAcc.get(imovelId)!
    acc.valor += p.valor_pago || 0
    acc.qtd += 1
  }
  const totalEntradas = somar([...entradasPorImovelAcc.values()].map((v) => v.valor))
  const entradasPorImovel: ItemComposicao[] = []
  entradasPorImovelAcc.forEach((v, imovelId) => {
    const im = mapImovel.get(imovelId)
    entradasPorImovel.push({
      chave: imovelId,
      rotulo: im ? im.nome || im.endereco || im.codigo || 'Imóvel' : 'Imóvel removido',
      valor: v.valor,
      qtd: v.qtd,
      pct: totalEntradas > 0 ? (v.valor / totalEntradas) * 100 : 0,
    })
  })
  entradasPorImovel.sort((a, b) => b.valor - a.valor)

  // ---------- Resumo do período ----------
  const totalEntradasJanela = somar(serie.map((l) => l.entradas))
  const totalSaidasJanela = somar(serie.map((l) => l.saidas))
  const resumo = {
    entradas: totalEntradasJanela,
    saidas: totalSaidasJanela,
    saldo: totalEntradasJanela - totalSaidasJanela,
    acumulado: serie.length > 0 ? serie[serie.length - 1].acumulado : 0,
    qtdPagamentos: somar(serie.map((l) => l.qtdPagamentos)),
    qtdDespesasPagas: somar([...saidasComp.values()].map((v) => v.qtd)),
    ticketMedioEntrada:
      somar(serie.map((l) => l.qtdPagamentos)) > 0
        ? totalEntradasJanela / somar(serie.map((l) => l.qtdPagamentos))
        : 0,
    mesesPositivos: serie.filter((l) => l.saldo > 0).length,
    mesesNegativos: serie.filter((l) => l.saldo < 0).length,
    maiorEntradaMensal: serie.length ? Math.max(...serie.map((l) => l.entradas)) : 0,
    maiorSaidaMensal: serie.length ? Math.max(...serie.map((l) => l.saidas)) : 0,
  }

  return { janela, resumo, serie, saidasPorCategoria, entradasPorImovel }
}

/** "Mmm/AAAA" para competência "YYYY-MM" (mesma convenção da Performance). */
function rotuloCurto(comp: string): string {
  const ROTULOS = [
    'Jan',
    'Fev',
    'Mar',
    'Abr',
    'Mai',
    'Jun',
    'Jul',
    'Ago',
    'Set',
    'Out',
    'Nov',
    'Dez',
  ]
  const [ano, mes] = comp.split('-')
  return `${ROTULOS[Number(mes) - 1] ?? mes}/${ano}`
}
