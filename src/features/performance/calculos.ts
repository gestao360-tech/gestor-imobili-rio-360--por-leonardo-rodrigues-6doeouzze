import {
  ImovelModel,
  ContratoModel,
  CobrancaModel,
  DespesaModel,
  ReajusteModel,
  InquilinoModel,
} from '@/types/database'

/* ============================================================
 * Serviço de dados e cálculos analíticos da página Performance.
 * Tudo parte de registros REAIS das coleções do PocketBase
 * (cobrancas, despesas, contratos, imoveis, inquilinos, reajustes).
 * Nenhum número é fixado em código.
 * ============================================================ */

export interface FiltroPerformance {
  /** 'mes' = mês/ano atual; '12m' = últimos 12 meses; 'custom' = intervalo explícito */
  modo: 'mes' | '12m' | 'custom'
  /** Início (YYYY-MM-DD), obrigatório quando modo = 'custom' */
  inicio?: string
  /** Fim (YYYY-MM-DD), obrigatório quando modo = 'custom' */
  fim?: string
}

export interface LinhaMensal {
  competencia: string // "YYYY-MM"
  rotulo: string // "Mmm/AAAA"
  faturado: number
  recebido: number
  inadimplencia: number
  pctInadimplencia: number
  despesas: number
  resultado: number
}

export interface RankingImovel {
  imovelId: string
  codigo: string
  nome: string
  tipo: string
  situacao: string
  faturado: number
  recebido: number
  despesas: number
  resultado: number
  margem: number
}

export interface InadimplenciaInquilino {
  inquilinoId: string
  nome: string
  qtdAtivos: number
  totalAtraso: number
  diasAtrasoMedio: number
  maiorAtraso: number
  competencias: string[]
}

export interface ProjecaoMensal {
  competencia: string
  rotulo: string
  contratado: number
  reajustado: number
}

export interface DadosPerformance {
  janela: { inicio: string; fim: string; rotulo: string }
  resumo: {
    faturado: number
    recebido: number
    emAberto: number
    inadimplencia: number
    pctInadimplencia: number
    eficiencia: number
    despesas: number
    despesasPagas: number
    resultado: number
    margem: number
    taxaOcupacao: number
    alugados: number
    totalImoveis: number
    vacanciaDias: number
  }
  serie: LinhaMensal[]
  ranking: RankingImovel[]
  inadimplencia: InadimplenciaInquilino[]
  ocupacaoPorSituacao: { chave: string; rotulo: string; qtd: number }[]
  ocupacaoPorTipo: { chave: string; rotulo: string; qtd: number }[]
  projecao: ProjecaoMensal[]
  contratosAtivos: number
}

const ROTULOS_MESES = [
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

function pad(n: number): string {
  return String(n).padStart(2, '0')
}

function competenciaDe(d: Date): string {
  return `${d.getFullYear()}-${pad(d.getMonth() + 1)}`
}

function dataIsoDe(d: Date): string {
  return `${d.getFullYear()}-${pad(d.getMonth() + 1)}-${pad(d.getDate())}`
}

function rotuloDe(comp: string): string {
  const [ano, mes] = comp.split('-')
  const idx = Number(mes) - 1
  return `${ROTULOS_MESES[idx] ?? mes}/${ano}`
}

/** Janela efetiva (início/fim em ISO) a partir do filtro do usuário. */
export function resolverJanela(filtro: FiltroPerformance): {
  inicio: string
  fim: string
  rotulo: string
} {
  const hoje = new Date()
  if (filtro.modo === 'custom' && filtro.inicio && filtro.fim) {
    return {
      inicio: filtro.inicio,
      fim: filtro.fim,
      rotulo: `Personalizado · ${filtro.inicio.slice(8, 10)}/${filtro.inicio.slice(5, 7)}/${filtro.inicio.slice(0, 4)} – ${filtro.fim.slice(8, 10)}/${filtro.fim.slice(5, 7)}/${filtro.fim.slice(0, 4)}`,
    }
  }
  if (filtro.modo === '12m') {
    const ini = new Date(hoje.getFullYear(), hoje.getMonth() - 11, 1)
    return {
      inicio: dataIsoDe(ini),
      fim: dataIsoDe(new Date(hoje.getFullYear(), hoje.getMonth() + 1, 0)),
      rotulo: 'Últimos 12 meses',
    }
  }
  // padrão: mês/ano corrente
  const ini = new Date(hoje.getFullYear(), hoje.getMonth(), 1)
  const fim = new Date(hoje.getFullYear(), hoje.getMonth() + 1, 0)
  return {
    inicio: dataIsoDe(ini),
    fim: dataIsoDe(fim),
    rotulo: `${rotuloDe(competenciaDe(hoje)).toUpperCase()} · ${hoje.getFullYear()}`,
  }
}

/** Rótulo curto de competência "YYYY-MM" → "Mmm/AAAA" (reusado pelo fluxo de caixa). */
export function rotuloDeCompetencia(comp: string): string {
  return rotuloDe(comp)
}

/** Lista de competências "YYYY-MM" dentro da janela (1 por mês). */
export function competenciasDaJanela(inicio: string, fim: string): string[] {
  const [ai, mi] = inicio.split('-').map(Number)
  const [af, mf] = fim.split('-').map(Number)
  const lista: string[] = []
  let ano = ai
  let mes = mi
  while (ano < af || (ano === af && mes <= mf)) {
    lista.push(`${ano}-${pad(mes)}`)
    mes++
    if (mes > 12) {
      mes = 1
      ano++
    }
  }
  return lista
}

function somar(list: number[]): number {
  return list.reduce((a, b) => a + b, 0)
}

function diasEntre(isoA: string, isoB: string): number {
  return Math.floor(
    (new Date(isoB + 'T00:00:00').getTime() - new Date(isoA + 'T00:00:00').getTime()) / 86400000,
  )
}

export interface Fontes {
  imoveis: ImovelModel[]
  contratos: ContratoModel[]
  cobrancas: CobrancaModel[]
  despesas: DespesaModel[]
  reajustes: ReajusteModel[]
  inquilinos: InquilinoModel[]
}

export interface OpcoesFiltradas {
  imovel?: string
  inquilino?: string
}

export function calcularPerformance(
  fontes: Fontes,
  filtro: FiltroPerformance,
  opcoes: OpcoesFiltradas = {},
): DadosPerformance {
  const janela = resolverJanela(filtro)
  const inicio = janela.inicio
  const fim = janela.fim
  const { imoveis, contratos, cobrancas, despesas, reajustes, inquilinos } = fontes

  const imovelFiltro = opcoes.imovel && opcoes.imovel !== 'todos' ? opcoes.imovel : ''
  const inquilinoFiltro = opcoes.inquilino && opcoes.inquilino !== 'todos' ? opcoes.inquilino : ''

  const mapImovel = new Map(imoveis.map((i) => [i.id, i]))
  const mapInquilino = new Map(inquilinos.map((i) => [i.id, i]))

  const contratosAtivos = contratos.filter(
    (c) => c.status === 'ativo' || c.status === 'prorrogado_legal' || c.status === 'renovado',
  )
  const idsAtivos = new Set(contratosAtivos.map((c) => c.id))
  const contratosDoFiltro = contratos.filter(
    (c) =>
      (!imovelFiltro || c.imovel === imovelFiltro) &&
      (!inquilinoFiltro || c.inquilino === inquilinoFiltro),
  )

  // ---------- Série mensal (faturado x recebido x despesas) ----------
  const comps = competenciasDaJanela(inicio, fim)
  const serie: LinhaMensal[] = comps.map((comp) => ({
    competencia: comp,
    rotulo: rotuloDe(comp),
    faturado: 0,
    recebido: 0,
    inadimplencia: 0,
    pctInadimplencia: 0,
    despesas: 0,
    resultado: 0,
  }))
  const seriePorComp = new Map(serie.map((l) => [l.competencia, l]))

  const cobrancasEscopo = cobrancas.filter(
    (c) =>
      (!imovelFiltro || c.imovel === imovelFiltro) &&
      (!inquilinoFiltro || c.inquilino === inquilinoFiltro),
  )

  for (const cob of cobrancasEscopo) {
    const linha = seriePorComp.get(cob.competencia) || seriePorComp.get(cob.vencimento.slice(0, 7))
    if (!linha) continue
    if (cob.status === 'cancelado') continue
    linha.faturado += cob.valor_total || 0
    linha.recebido += cob.valor_pago || 0
    if (
      cob.status === 'vencido' ||
      (cob.status !== 'pago' && cob.vencimento < dataIsoDe(new Date()))
    ) {
      linha.inadimplencia += Math.max(0, (cob.valor_total || 0) - (cob.valor_pago || 0))
    }
  }

  for (const des of despesas) {
    if (imovelFiltro && des.imovel !== imovelFiltro) continue
    if (inquilinoFiltro) continue // despesa não é por inquilino
    const linha = seriePorComp.get(des.data_vencimento.slice(0, 7))
    if (!linha) continue
    if (des.status === 'cancelado') continue
    linha.despesas += des.valor || 0
  }

  for (const l of serie) {
    l.pctInadimplencia = l.faturado > 0 ? (l.inadimplencia / l.faturado) * 100 : 0
    l.resultado = l.recebido - l.despesas
  }

  // ---------- Totais da janela ----------
  const faturado = somar(serie.map((l) => l.faturado))
  const recebido = somar(serie.map((l) => l.recebido))
  const inadimplenciaTotal = somar(serie.map((l) => l.inadimplencia))
  const totalDespesas = somar(serie.map((l) => l.despesas))
  const emAberto = somar(
    cobrancasEscopo
      .filter((c) => c.competencia >= comps[0] && c.competencia <= comps[comps.length - 1])
      .filter((c) => c.status !== 'pago' && c.status !== 'cancelado')
      .map((c) => Math.max(0, (c.valor_total || 0) - (c.valor_pago || 0))),
  )
  const despesasPagas = somar(
    despesas
      .filter((d) => {
        if (imovelFiltro && d.imovel !== imovelFiltro) return false
        if (d.status !== 'pago') return false
        const comp = d.data_vencimento.slice(0, 7)
        return comp >= comps[0] && comp <= comps[comps.length - 1]
      })
      .map((d) => d.valor || 0),
  )

  const resumo = {
    faturado,
    recebido,
    emAberto,
    inadimplencia: inadimplenciaTotal,
    pctInadimplencia: faturado > 0 ? (inadimplenciaTotal / faturado) * 100 : 0,
    eficiencia: faturado > 0 ? Math.min(100, (recebido / faturado) * 100) : 0,
    despesas: totalDespesas,
    despesasPagas,
    resultado: recebido - totalDespesas,
    margem: recebido > 0 ? ((recebido - totalDespesas) / recebido) * 100 : 0,
    taxaOcupacao: 0,
    alugados: 0,
    totalImoveis: 0,
    vacanciaDias: 0,
  }

  // ---------- Ranking de rentabilidade por imóvel ----------
  const porImovel = new Map<string, { faturado: number; recebido: number; despesas: number }>()
  for (const cob of cobrancasEscopo) {
    if (cob.status === 'cancelado') continue
    if (!porImovel.has(cob.imovel))
      porImovel.set(cob.imovel, { faturado: 0, recebido: 0, despesas: 0 })
    const acc = porImovel.get(cob.imovel)!
    const comp = cob.competencia
    if (comp >= comps[0] && comp <= comps[comps.length - 1]) {
      acc.faturado += cob.valor_total || 0
      acc.recebido += cob.valor_pago || 0
    }
  }
  for (const des of despesas) {
    if (imovelFiltro && des.imovel !== imovelFiltro) continue
    if (inquilinoFiltro) continue
    const comp = des.data_vencimento.slice(0, 7)
    if (comp < comps[0] || comp > comps[comps.length - 1]) continue
    if (des.status === 'cancelado') continue
    if (!porImovel.has(des.imovel))
      porImovel.set(des.imovel, { faturado: 0, recebido: 0, despesas: 0 })
    porImovel.get(des.imovel)!.despesas += des.valor || 0
  }

  const ranking: RankingImovel[] = []
  porImovel.forEach((v, imovelId) => {
    const im = mapImovel.get(imovelId)
    if (!im) return
    const resultado = v.recebido - v.despesas
    ranking.push({
      imovelId,
      codigo: im.codigo || '',
      nome: im.nome || im.endereco || 'Imóvel',
      tipo: im.tipo,
      situacao: im.situacao,
      faturado: v.faturado,
      recebido: v.recebido,
      despesas: v.despesas,
      resultado,
      margem: v.recebido > 0 ? (resultado / v.recebido) * 100 : 0,
    })
  })
  ranking.sort((a, b) => b.resultado - a.resultado)

  // ---------- Inadimplência por inquilino ----------
  const hojeIso = dataIsoDe(new Date())
  const porInquilino = new Map<
    string,
    { total: number; dias: number[]; competencias: string[]; qtd: number }
  >()
  for (const cob of cobrancasEscopo) {
    const aberto = Math.max(0, (cob.valor_total || 0) - (cob.valor_pago || 0))
    const vencido = cob.status === 'vencido' || (cob.status !== 'pago' && cob.vencimento < hojeIso)
    if (aberto <= 0 || !vencido) continue
    if (cob.status === 'cancelado') continue
    if (!porInquilino.has(cob.inquilino))
      porInquilino.set(cob.inquilino, { total: 0, dias: [], competencias: [], qtd: 0 })
    const acc = porInquilino.get(cob.inquilino)!
    acc.total += aberto
    acc.dias.push(diasEntre(cob.vencimento, hojeIso))
    acc.competencias.push(cob.competencia)
    acc.qtd++
  }
  const inadimplencia: InadimplenciaInquilino[] = []
  porInquilino.forEach((v, inquilinoId) => {
    const inq = mapInquilino.get(inquilinoId)
    if (!inq) return
    inadimplencia.push({
      inquilinoId,
      nome: inq.nome,
      qtdAtivos: v.qtd,
      totalAtraso: v.total,
      diasAtrasoMedio: Math.round(somar(v.dias) / v.dias.length),
      maiorAtraso: Math.max(...v.dias),
      competencias: [...new Set(v.competencias)].sort(),
    })
  })
  inadimplencia.sort((a, b) => b.totalAtraso - a.totalAtraso)

  // ---------- Ocupação e carteira (respeita filtro de imóvel) ----------
  const escopoImoveis = imoveis.filter((i) => !imovelFiltro || i.id === imovelFiltro)
  const contagem = (campo: 'situacao' | 'tipo') => {
    const m = new Map<string, number>()
    for (const im of escopoImoveis) m.set(im[campo], (m.get(im[campo]) || 0) + 1)
    return m
  }
  const rotulosSituacao: Record<string, string> = {
    alugado: 'Alugado',
    disponivel: 'Disponível',
    reservado: 'Reservado',
    em_reforma: 'Em reforma',
    inativo: 'Inativo',
  }
  const rotulosTipo: Record<string, string> = {
    residencial: 'Residencial',
    comercial: 'Comercial',
    sala: 'Sala',
    loja: 'Loja',
    galpao: 'Galpão',
    lote: 'Lote',
    outros: 'Outros',
  }
  const ocupacaoPorSituacao = [...contagem('situacao').entries()].map(([chave, qtd]) => ({
    chave,
    rotulo: rotulosSituacao[chave] ?? chave,
    qtd,
  }))
  const ocupacaoPorTipo = [...contagem('tipo').entries()].map(([chave, qtd]) => ({
    chave,
    rotulo: rotulosTipo[chave] ?? chave,
    qtd,
  }))

  const alugados = escopoImoveis.filter((i) => i.situacao === 'alugado').length
  resumo.alugados = alugados
  resumo.totalImoveis = escopoImoveis.length
  resumo.taxaOcupacao = escopoImoveis.length > 0 ? (alugados / escopoImoveis.length) * 100 : 0
  resumo.vacanciaDias = contratosAtivos
    .filter((c) => !imovelFiltro || c.imovel === imovelFiltro)
    .reduce((acc, c) => acc + (c.carencia_meses || 0) * 30, 0)

  // ---------- Projeção 12 meses (contratos ativos + reajustes aprovados) ----------
  const hoje = new Date()
  const reajustesAprovados = reajustes.filter((r) => r.status === 'aprovado')
  const mapReajustePorContrato = new Map<string, ReajusteModel>()
  for (const r of reajustesAprovados) {
    const existente = mapReajustePorContrato.get(r.contrato)
    if (!existente || r.data_aplicacao > existente.data_aplicacao) {
      mapReajustePorContrato.set(r.contrato, r)
    }
  }

  const projecao: ProjecaoMensal[] = []
  for (let k = 0; k < 12; k++) {
    const d = new Date(hoje.getFullYear(), hoje.getMonth() + k, 1)
    const comp = competenciaDe(d)
    let contratado = 0
    let reajustado = 0
    for (const c of contratosDoFiltro) {
      if (!idsAtivos.has(c.id)) continue
      if (c.data_inicio.slice(0, 7) > comp) continue
      const reaj = mapReajustePorContrato.get(c.id)
      const aplicaReaj = reaj && comp >= reaj.data_aplicacao.slice(0, 7)
      contratado += c.valor_atual || 0
      reajustado += aplicaReaj ? reaj!.aluguel_novo_aprovado || c.valor_atual : c.valor_atual
    }
    projecao.push({ competencia: comp, rotulo: rotuloDe(comp), contratado, reajustado })
  }

  resumo.eficiencia = faturado > 0 ? Math.min(100, (recebido / faturado) * 100) : 0

  return {
    janela,
    resumo,
    serie,
    ranking,
    inadimplencia,
    ocupacaoPorSituacao,
    ocupacaoPorTipo,
    projecao,
    contratosAtivos: contratosDoFiltro.filter((c) => idsAtivos.has(c.id)).length,
  }
}
