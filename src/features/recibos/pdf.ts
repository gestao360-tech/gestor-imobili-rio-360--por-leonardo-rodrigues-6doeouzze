// 🧾 Gerador do PDF do recibo de aluguel padrão — sem dependências novas.
//
// Escreve um PDF 1.4 à mão (Helvetica + Helvetica-Bold, WinAnsiEncoding,
// medição real de largura de glifo para centralizar/alinhar à direita) porque
// o projeto não tem lib de PDF e o package.json é bloqueado para edição.
//
// Layout padrão de recibo de aluguel:
//  - título RECIBO + número sequencial;
//  - valor por extenso e numérico;
//  - recebido de (inquilino, CPF/CNPJ);
//  - referente a (aluguel + encargos da competência);
//  - imóvel (endereço), locador/proprietário, data do pagamento,
//    forma de pagamento e linha de assinatura.
//
// Dados vêm do backend (GET /backend/v1/recibos/dados) — cobrança, contrato,
// imóvel e inquilino reais. Nunca emite "pago" para cobrança em aberto: quem
// garante isso é o backend, que recusa a rota de dados para cobrança sem
// baixa com a mensagem "o recibo de quitação exige baixa".
import type { ReciboAluguelDados } from './tipos'

const FORMA_LABEL: Record<string, string> = {
  pix: 'PIX',
  boleto: 'Boleto',
  ted_doc: 'TED/DOC',
  dinheiro: 'Dinheiro',
  cartao: 'Cartão',
  outra: 'Outra',
}

const UNIDADES_SING = [
  'zero',
  'um',
  'dois',
  'três',
  'quatro',
  'cinco',
  'seis',
  'sete',
  'oito',
  'nove',
]
const DEZ_A_DEZENOVE = [
  'dez',
  'onze',
  'doze',
  'treze',
  'quatorze',
  'quinze',
  'dezesseis',
  'dezessete',
  'dezoito',
  'dezenove',
]
const DEZENAS = [
  '',
  '',
  'vinte',
  'trinta',
  'quarenta',
  'cinquenta',
  'sessenta',
  'setenta',
  'oitenta',
  'noventa',
]
const CENTENAS = [
  'cento',
  'duzentos',
  'trezentos',
  'quatrocentos',
  'quinhentos',
  'seiscentos',
  'setecentos',
  'oitocentos',
  'novecentos',
]

function duasOrdens(n: number): string {
  if (n < 10) return UNIDADES_SING[n]
  if (n < 20) return DEZ_A_DEZENOVE[n - 10]
  const d = Math.floor(n / 10)
  const u = n % 10
  return u === 0 ? DEZENAS[d] : DEZENAS[d] + ' e ' + UNIDADES_SING[u]
}

function tresOrdens(n: number): string {
  if (n === 100) return 'cem'
  const c = Math.floor(n / 100)
  const resto = n % 100
  if (c === 0) return duasOrdens(resto)
  const txtC = CENTENAS[c - 1]
  return resto === 0 ? txtC : txtC + ' e ' + duasOrdens(resto)
}

/** Valor por extenso em reais (padrão de recibo). */
export function valorPorExtenso(valor: number): string {
  const total = Math.floor(Math.abs(valor))
  const centavos = Math.round((Math.abs(valor) - total) * 100)
  if (total === 0 && centavos === 0) return 'zero real'
  const partes: string[] = []
  const milhoes = Math.floor(total / 1_000_000)
  const milhares = Math.floor((total % 1_000_000) / 1_000)
  const unidades = total % 1_000
  if (milhoes) partes.push(milhoes === 1 ? 'um milhão' : tresOrdens(milhoes) + ' milhões')
  if (milhares) partes.push(milhares === 1 ? 'mil' : tresOrdens(milhares) + ' mil')
  if (unidades) partes.push(tresOrdens(unidades))
  let texto = partes.join(' e ') || 'zero'
  texto += total === 1 ? ' real' : ' reais'
  if (centavos) {
    texto += ' e ' + (centavos === 1 ? 'um centavo' : duasOrdens(centavos) + ' centavos')
  }
  return texto
}

function brl(v: number): string {
  return v.toLocaleString('pt-BR', { style: 'currency', currency: 'BRL' })
}

// ---------- mini-gerador de PDF ----------

// Larguras de glifo (por 1000 unidades) — Helvetica e Helvetica-Bold, ASCII 32..126.
const W_REG = [
  278, 278, 355, 556, 556, 889, 667, 191, 333, 333, 389, 584, 278, 333, 278, 278, 556, 556, 556,
  556, 556, 556, 556, 556, 556, 556, 278, 278, 584, 584, 584, 556, 1015, 667, 667, 722, 722, 667,
  611, 778, 722, 278, 500, 667, 556, 833, 722, 778, 667, 778, 722, 667, 611, 722, 667, 944, 667,
  667, 611, 278, 278, 278, 469, 556, 333, 556, 556, 500, 556, 556, 278, 556, 556, 222, 222, 500,
  222, 833, 556, 556, 556, 556, 333, 500, 278, 556, 500, 722, 500, 500, 500, 334, 260, 334, 584,
]
const W_BOLD = [
  278, 333, 474, 556, 556, 889, 722, 238, 333, 333, 389, 584, 278, 333, 278, 278, 556, 556, 556,
  556, 556, 556, 556, 556, 556, 556, 333, 333, 584, 584, 584, 611, 975, 722, 722, 722, 722, 667,
  611, 778, 722, 278, 556, 722, 611, 833, 722, 778, 667, 778, 722, 667, 611, 722, 667, 944, 667,
  667, 611, 333, 278, 333, 584, 556, 333, 556, 611, 556, 611, 556, 333, 611, 611, 278, 278, 556,
  278, 889, 611, 611, 611, 611, 389, 556, 333, 611, 556, 778, 556, 556, 500, 389, 280, 389, 584,
]

function larguraTexto(texto: string, size: number, bold: boolean): number {
  const tabela = bold ? W_BOLD : W_REG
  let unidades = 0
  for (const ch of texto) {
    const code = ch.charCodeAt(0)
    unidades += code >= 32 && code <= 126 ? tabela[code - 32] : 556
  }
  return (unidades / 1000) * size
}

function escaparPdf(texto: string): string {
  let fora = ''
  for (const ch of texto) {
    const code = ch.charCodeAt(0)
    if (code > 255) {
      fora += '?'
      continue
    }
    if (ch === '\\' || ch === '(' || ch === ')') fora += '\\'
    fora += ch
  }
  return fora
}

interface Op {
  texto?: {
    x: number
    y: number
    size: number
    bold?: boolean
    centro?: boolean
    direita?: boolean
    cor?: [number, number, number]
    conteudo: string
  }
  linha?: {
    x1: number
    y1: number
    x2: number
    y2: number
    w: number
    cor?: [number, number, number]
  }
  retangulo?: { x: number; y: number; w: number; h: number; cor: [number, number, number] }
}

const A4_W = 595.28
const A4_H = 841.89

function montarPdf(ops: Op[]): Blob {
  const partes: string[] = []
  for (const op of ops) {
    if (op.retangulo) {
      const [r, g, b] = op.retangulo.cor
      const y = A4_H - op.retangulo.y - op.retangulo.h
      partes.push(
        `${r} ${g} ${b} rg ${op.retangulo.x} ${y} ${op.retangulo.w} ${op.retangulo.h} re f`,
      )
    }
    if (op.linha) {
      const [r, g, b] = op.linha.cor || [0.3, 0.35, 0.42]
      partes.push(
        `${r} ${g} ${b} RG ${op.linha.w} w ${op.linha.x1} ${A4_H - op.linha.y1} m ${op.linha.x2} ${A4_H - op.linha.y2} l S`,
      )
    }
    if (op.texto) {
      const t = op.texto
      const larg = larguraTexto(t.conteudo, t.size, !!t.bold)
      let x = t.x
      if (t.centro) x = t.x - larg / 2
      if (t.direita) x = t.x - larg
      const [r, g, b] = t.cor || [0.24, 0.28, 0.35]
      const fonte = t.bold ? '/F2' : '/F1'
      partes.push(
        `BT ${r} ${g} ${b} rg ${fonte} ${t.size} Tf ${x} ${A4_H - t.y} Td (${escaparPdf(t.conteudo)}) Tj ET`,
      )
    }
  }
  const stream = partes.join('\n')

  const objetos = [
    '<< /Type /Catalog /Pages 2 0 R >>',
    '<< /Type /Pages /Kids [3 0 R] /Count 1 >>',
    '<< /Type /Page /Parent 2 0 R /MediaBox [0 0 595.28 841.89] /Resources << /Font << /F1 4 0 R /F2 5 0 R >> >> /Contents 6 0 R >>',
    '<< /Type /Font /Subtype /Type1 /BaseFont /Helvetica /Encoding /WinAnsiEncoding >>',
    '<< /Type /Font /Subtype /Type1 /BaseFont /Helvetica-Bold /Encoding /WinAnsiEncoding >>',
    `<< /Length ${stream.length} >>\nstream\n${stream}\nendstream`,
  ]

  let pdf = '%PDF-1.4\n'
  const offsets: number[] = []
  objetos.forEach((corpo, i) => {
    offsets.push(pdf.length)
    pdf += `${i + 1} 0 obj\n${corpo}\nendobj\n`
  })
  const xrefIni = pdf.length
  pdf += `xref\n0 ${objetos.length + 1}\n0000000000 65535 f \n`
  for (const off of offsets) pdf += String(off).padStart(10, '0') + ' 00000 n \n'
  pdf += `trailer\n<< /Size ${objetos.length + 1} /Root 1 0 R >>\nstartxref\n${xrefIni}\n%%EOF`

  const bytes = new Uint8Array(pdf.length)
  for (let i = 0; i < pdf.length; i++) bytes[i] = pdf.charCodeAt(i) & 0xff
  return new Blob([bytes], { type: 'application/pdf' })
}

// ---------- layout do recibo ----------

function quebrar(texto: string, max: number): string[] {
  const linhas: string[] = []
  for (const bruto of String(texto || '').split('\n')) {
    let linha = ''
    for (const palavra of bruto.split(/\s+/).filter(Boolean)) {
      if ((linha + ' ' + palavra).trim().length > max) {
        if (linha) linhas.push(linha)
        linha = palavra
      } else {
        linha = (linha ? linha + ' ' : '') + palavra
      }
    }
    if (linha) linhas.push(linha)
  }
  return linhas
}

const COR_TEXTO: [number, number, number] = [0.24, 0.28, 0.35]
const COR_VERDE: [number, number, number] = [0.08, 0.55, 0.25]
const COR_AMBAR: [number, number, number] = [0.72, 0.45, 0.05]
const COR_VIOLETA: [number, number, number] = [0.44, 0.25, 0.96]
const COR_VIOLETA_ESC: [number, number, number] = [0.3, 0.11, 0.58]
const COR_CINZA: [number, number, number] = [0.42, 0.45, 0.5]

/** Gera o PDF do recibo e devolve o Blob + nome de arquivo. */
export async function gerarPdfRecibo(
  dados: ReciboAluguelDados,
): Promise<{ blob: Blob; nomeArquivo: string }> {
  const M = 56.7 // 2 cm
  const cx = A4_W / 2
  const W = A4_W - 2 * M
  const c = dados.cobranca
  const ops: Op[] = []

  // Moldura dupla + faixa violeta (identidade do app)
  ops.push({ retangulo: { x: 28, y: 28, w: A4_W - 56, h: A4_H - 56, cor: [0.95, 0.92, 1] } })
  ops.push({ retangulo: { x: 28, y: 28, w: A4_W - 56, h: 9, cor: COR_VIOLETA } })
  ops.push({ linha: { x1: 34, y1: 34, x2: A4_W - 34, y2: A4_H - 34, w: 1.6, cor: COR_VIOLETA } })
  ops.push({ linha: { x1: 40, y1: 40, x2: A4_W - 40, y2: A4_H - 40, w: 0.6, cor: COR_VIOLETA } })

  let y = 92
  ops.push({
    texto: {
      x: cx,
      y,
      size: 26,
      bold: true,
      centro: true,
      cor: COR_VIOLETA_ESC,
      conteudo: 'RECIBO',
    },
  })
  y += 24
  ops.push({
    texto: {
      x: cx,
      y,
      size: 11,
      centro: true,
      cor: COR_CINZA,
      conteudo: 'Nº ' + (dados.numero || '—'),
    },
  })

  y += 30
  const intro =
    'Recebemos de ' +
    (dados.inquilino.nome || '—') +
    (dados.inquilino.cpf_cnpj ? ' (CPF/CNPJ ' + dados.inquilino.cpf_cnpj + ')' : '') +
    ', a importância de ' +
    brl(c.valor_pago) +
    ' (' +
    valorPorExtenso(c.valor_pago) +
    '), referente ao aluguel e encargos da competência ' +
    (c.competencia || '—') +
    ' do imóvel ' +
    (dados.imovel.rotulo || dados.imovel.endereco || '—') +
    '.'
  for (const linha of quebrar(intro, 88)) {
    ops.push({ texto: { x: cx, y, size: 10.5, centro: true, conteudo: linha } })
    y += 16
  }

  y += 10
  ops.push({ linha: { x1: M, y1: y, x2: M + W, y2: y, w: 0.6 } })
  y += 24

  // Composição da cobrança
  ops.push({
    texto: {
      x: M,
      y,
      size: 9,
      bold: true,
      cor: COR_VIOLETA_ESC,
      conteudo: 'COMPOSIÇÃO DA COBRANÇA — COMPETÊNCIA ' + (c.competencia || '—'),
    },
  })
  y += 17
  const itens: [string, number][] = [
    ['Aluguel', c.valor_aluguel],
    ['IPTU', c.valor_iptu],
    ['Condomínio', c.valor_condominio],
    ['Outras cobranças', c.outras_cobrancas],
    ['Descontos', -c.valor_desconto],
    ['Acréscimos', c.valor_acrescimo],
    ['Multa', c.valor_multa],
    ['Juros', c.valor_juros],
  ]
  for (const [rotulo, valor] of itens) {
    if (!valor) continue
    ops.push({ texto: { x: M + 6, y, size: 10, conteudo: rotulo } })
    ops.push({ texto: { x: M + W - 6, y, size: 10, direita: true, conteudo: brl(valor) } })
    y += 14
  }
  ops.push({ texto: { x: M + 6, y, size: 10, bold: true, conteudo: 'Valor total da cobrança' } })
  ops.push({
    texto: { x: M + W - 6, y, size: 10, bold: true, direita: true, conteudo: brl(c.valor_total) },
  })
  y += 17
  ops.push({
    texto: {
      x: M + 6,
      y,
      size: 11,
      bold: true,
      cor: COR_VERDE,
      conteudo: 'Valor recebido (quitação)',
    },
  })
  ops.push({
    texto: {
      x: M + W - 6,
      y,
      size: 11,
      bold: true,
      direita: true,
      cor: COR_VERDE,
      conteudo: brl(c.valor_pago),
    },
  })
  if (dados.saldo > 0.005) {
    y += 14
    ops.push({
      texto: {
        x: M + 6,
        y,
        size: 9.5,
        cor: COR_AMBAR,
        conteudo: 'Saldo remanescente: ' + brl(dados.saldo),
      },
    })
  }

  y += 28
  const info =
    'Data do pagamento: ' +
    (dados.data_pagamento_br || '—') +
    '   ·   Forma de pagamento: ' +
    (FORMA_LABEL[c.forma_pagamento] || c.forma_pagamento || '—') +
    (c.conta_bancaria ? '   ·   Recebido em: ' + c.conta_bancaria : '')
  for (const linha of quebrar(info, 88)) {
    ops.push({ texto: { x: cx, y, size: 10.5, centro: true, conteudo: linha } })
    y += 16
  }
  y += 8
  const locadorTxt =
    'Locador(a): ' +
    (dados.locador.nome || '—') +
    (dados.locador.cpf_cnpj ? ' (CPF/CNPJ ' + dados.locador.cpf_cnpj + ')' : '') +
    (dados.contrato.numero ? '   ·   Contrato ' + dados.contrato.numero : '')
  for (const linha of quebrar(locadorTxt, 88)) {
    ops.push({ texto: { x: cx, y, size: 10.5, centro: true, conteudo: linha } })
    y += 16
  }

  y += 8
  ops.push({ linha: { x1: M, y1: y, x2: M + W, y2: y, w: 0.6 } })

  // Assinatura
  const yAss = A4_H - 190
  ops.push({ linha: { x1: 170, y1: yAss, x2: A4_W - 170, y2: yAss, w: 1, cor: COR_VIOLETA_ESC } })
  ops.push({
    texto: {
      x: cx,
      y: yAss + 16,
      size: 9.5,
      centro: true,
      conteudo: dados.locador.nome || 'Locador(a) / Administradora',
    },
  })
  ops.push({
    texto: {
      x: cx,
      y: yAss + 30,
      size: 8,
      centro: true,
      cor: COR_CINZA,
      conteudo: 'Assinatura do locador(a) / responsável',
    },
  })
  ops.push({
    texto: {
      x: cx,
      y: A4_H - 52,
      size: 7.5,
      centro: true,
      cor: COR_CINZA,
      conteudo: 'Emitido pelo Gestor Imobiliário 360 em ' + new Date().toLocaleDateString('pt-BR'),
    },
  })

  const blob = montarPdf(ops)
  const nomeArquivo = 'recibo-' + (dados.numero || c.id) + '.pdf'
  return { blob, nomeArquivo }
}
