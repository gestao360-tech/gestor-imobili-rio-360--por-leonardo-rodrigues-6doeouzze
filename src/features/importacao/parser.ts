// Leitura de planilhas (.xlsx/.xls/.csv) no cliente com SheetJS.
// A planilha pode conter várias abas e, dentro de uma aba, várias tabelas
// lado a lado — cada "região" (linha de cabeçalho + faixa de colunas) é
// tratada como uma tabela independente para mapeamento e importação.
// Nenhum dado de planilha vive aqui — só a mecânica de leitura.
import * as XLSX from 'xlsx'
import type {
  AbaPlanilha,
  BlocoSugerido,
  ColunaExtraida,
  LinhaExtraida,
  MapeamentoColunas,
  PlanilhaCarregada,
  RegiaoTabela,
  TabelaExtraida,
  ValorCelula,
} from './types'

/** Lê o arquivo e devolve todas as abas com suas matrizes de células. */
export async function carregarPlanilha(arquivo: File): Promise<PlanilhaCarregada> {
  const buffer = await arquivo.arrayBuffer()
  const wb = XLSX.read(buffer, { cellDates: true })
  const abas: AbaPlanilha[] = wb.SheetNames.map((nome) => {
    const ws = wb.Sheets[nome]
    const matriz = XLSX.utils.sheet_to_json<ValorCelula[]>(ws, {
      header: 1,
      raw: true,
      defval: null,
      blankrows: true,
    })
    return { nome, matriz }
  })
  return { nomeArquivo: arquivo.name, abas }
}

/** Letra da coluna a partir do índice 0-based (0 → A). */
export function letraColuna(idx0: number): string {
  let n = idx0
  let s = ''
  do {
    s = String.fromCharCode(65 + (n % 26)) + s
    n = Math.floor(n / 26) - 1
  } while (n >= 0)
  return s
}

const SIGLAS = ['JAN', 'FEV', 'MAR', 'ABR', 'MAI', 'JUN', 'JUL', 'AGO', 'SET', 'OUT', 'NOV', 'DEZ']

function textoCabecalho(v: unknown): string {
  if (v instanceof Date) return ''
  if (typeof v === 'number') return String(v)
  return String(v ?? '')
    .replace(/\s+/g, ' ')
    .trim()
}

/**
 * Detecta linhas de cabeçalho (com siglas de mês ou muitos textos) e devolve
 * blocos contíguos de colunas — permite escolher a tabela dentro da aba.
 */
export function sugerirBlocos(aba: AbaPlanilha): BlocoSugerido[] {
  const matriz = aba.matriz
  if (!matriz.length) return []
  const largura = matriz.reduce((m, l) => Math.max(m, l.length), 0)
  const textoNaLinha: number[] = []
  for (let r = 0; r < Math.min(matriz.length, 20); r++) {
    let textos = 0
    for (let c = 0; c < largura; c++) {
      const t = textoCabecalho(matriz[r]?.[c])
      if (t && !/^\d+(\.\d+)?$/.test(t)) textos++
    }
    textoNaLinha.push(textos)
  }
  const temSigla = (r: number) => {
    let n = 0
    for (let c = 0; c < largura; c++) {
      const t = textoCabecalho(matriz[r]?.[c]).toUpperCase()
      if (SIGLAS.includes(t)) n++
    }
    return n >= 5
  }
  const candidatos: number[] = []
  for (let r = 0; r < textoNaLinha.length; r++) {
    if (textoNaLinha[r] >= 3 || temSigla(r)) candidatos.push(r)
  }
  if (!candidatos.length)
    return [{ linhaCabecalho: 1, colInicio: 1, colFim: largura, rotulo: 'Tabela inteira' }]
  const blocos: BlocoSugerido[] = []
  for (const r of candidatos.slice(0, 6)) {
    let inicio = -1
    for (let c = 0; c <= largura; c++) {
      const tem = c < largura && textoCabecalho(matriz[r]?.[c]) !== ''
      if (tem && inicio < 0) inicio = c
      if (!tem && inicio >= 0) {
        blocos.push({
          linhaCabecalho: r + 1,
          colInicio: inicio + 1,
          colFim: c,
          rotulo: `Linha ${r + 1}, colunas ${letraColuna(inicio)}–${letraColuna(c - 1)}`,
        })
        inicio = -1
      }
    }
  }
  const vistos = new Set<string>()
  const unicos: BlocoSugerido[] = []
  for (const b of blocos) {
    const chave = `${b.colInicio}-${b.colFim}`
    if (vistos.has(chave)) continue
    vistos.add(chave)
    unicos.push(b)
  }
  return unicos.length
    ? unicos
    : [
        {
          linhaCabecalho: candidatos[0] + 1,
          colInicio: 1,
          colFim: largura,
          rotulo: 'Tabela inteira',
        },
      ]
}

/** Recorta a região escolhida pelo usuário em colunas/linhas para mapeamento. */
export function extrairTabela(aba: AbaPlanilha, regiao: RegiaoTabela): TabelaExtraida {
  const colunas: ColunaExtraida[] = []
  const linhas: LinhaExtraida[] = []
  const linhaCab = regiao.linhaCabecalho - 1
  const abaMatriz = aba.matriz
  for (let c = regiao.colInicio - 1; c < regiao.colFim; c++) {
    const bruto = abaMatriz[linhaCab]?.[c]
    const cabecalho = textoCabecalho(bruto) || letraColuna(c)
    colunas.push({ indice: c, letra: letraColuna(c), cabecalho })
  }
  for (let r = regiao.linhaCabecalho; r < abaMatriz.length; r++) {
    const bruta = abaMatriz[r]
    if (!bruta) continue
    let temConteudo = false
    const celulas: Record<number, ValorCelula> = {}
    for (let c = regiao.colInicio - 1; c < regiao.colFim; c++) {
      const v = bruta[c] ?? null
      if (v !== null && v !== undefined && String(v).trim() !== '') {
        celulas[c] = v
        temConteudo = true
      }
    }
    if (!temConteudo) continue
    linhas.push({ numero: r + 1, celulas })
  }
  return { regiao, colunas, linhas }
}

export type MapeamentoSugerido = MapeamentoColunas

function criarMapeamentoVazio(): MapeamentoColunas {
  return {
    endereco: null,
    descricao: null,
    inquilinoNome: null,
    cpfCnpj: null,
    telefone: null,
    valorAluguel: null,
    diaVencimento: null,
    dataInicio: null,
    matriculaCopasa: null,
    instalacaoCemig: null,
    meses: {},
  }
}

/** Pré-preenche o mapeamento reconhecendo os cabeçalhos padrão da planilha. */
export function mapeamentoSugerido(colunas: ColunaExtraida[]): MapeamentoColunas {
  const achado = criarMapeamentoVazio()
  const norm = (s: string) =>
    s
      .normalize('NFD')
      .replace(/[\u0300-\u036f]/g, '')
      .toUpperCase()
      .replace(/\s+/g, ' ')
      .trim()
  for (const col of colunas) {
    const t = norm(col.cabecalho)
    if (!t) continue
    if (t === 'ENDEREÇO' || t === 'ENDERECO') {
      achado.endereco ??= col.indice
      continue
    }
    if (t === 'NOME' || t === 'INQUILINO' || t === 'LOCATÁRIO') {
      achado.inquilinoNome ??= col.indice
      continue
    }
    if (t.startsWith('CPF')) {
      achado.cpfCnpj ??= col.indice
      continue
    }
    if (t.startsWith('TELEFONE') || t.startsWith('CELULAR')) {
      achado.telefone ??= col.indice
      continue
    }
    if (t.startsWith('VALOR') && !t.includes('PAGAMENTO')) {
      achado.valorAluguel ??= col.indice
      continue
    }
    if (t.startsWith('DATA PAGAMENTO') || t.startsWith('VENCIMENTO')) {
      achado.diaVencimento ??= col.indice
      continue
    }
    if (t.startsWith('INICIO CONTRATO') || t.startsWith('INÍCIO')) {
      achado.dataInicio ??= col.indice
      continue
    }
    if (t.includes('COPASA')) {
      achado.matriculaCopasa ??= col.indice
      continue
    }
    if (t.includes('CEMIG')) {
      achado.instalacaoCemig ??= col.indice
      continue
    }
    if (t.startsWith('DESCRI')) {
      achado.descricao ??= col.indice
      continue
    }
    const sigla = SIGLAS.indexOf(t)
    if (sigla >= 0) achado.meses[siglaMesDeSigla(SIGLAS[sigla])] ??= col.indice
  }
  return achado
}

const MES_SIGLA_PARA_CHAVE: Record<string, MesChave> = {
  JAN: 'jan',
  FEV: 'fev',
  MAR: 'mar',
  ABR: 'abr',
  MAI: 'mai',
  JUN: 'jun',
  JUL: 'jul',
  AGO: 'ago',
  SET: 'set',
  OUT: 'out',
  NOV: 'nov',
  DEZ: 'dez',
}

function siglaMesDeSigla(sigla: string): MesChave {
  return MES_SIGLA_PARA_CHAVE[sigla] ?? 'jan'
}
