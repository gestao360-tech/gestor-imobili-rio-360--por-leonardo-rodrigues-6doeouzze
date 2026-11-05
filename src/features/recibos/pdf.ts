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

// Paleta oficial do Gestor Imobiliário 360º (RGB normalizado 0..1):
// - Azul-marinho profundo: #06182B => [0.024, 0.094, 0.169]
// - Azul-marinho secundário: #102B46 => [0.063, 0.169, 0.275]
// - Dourado escuro / bronze (texto com alto contraste): #86521D => [0.525, 0.322, 0.114]
// - Dourado metálico (para bordas/fundos): #D4A347 => [0.831, 0.639, 0.278]
// - Laranja institucional: #F15A24 => [0.945, 0.353, 0.141]
// - Verde aprovação: #0D7A3E => [0.051, 0.478, 0.243]
// - Cinza escuro texto: #1E293B => [0.118, 0.161, 0.231]
// - Cinza médio / legenda: #475569 => [0.278, 0.333, 0.412]
// - Fundo decorativo sutil: [0.98, 0.985, 0.99]
const PALETA = {
  navy: {
    primaria: [0.024, 0.094, 0.169] as [number, number, number], // #06182B
    secundaria: [0.063, 0.169, 0.275] as [number, number, number], // #102B46
    textoTitulo: [0.024, 0.094, 0.169] as [number, number, number],
    bordaFundo: [0.94, 0.96, 0.98] as [number, number, number],
  },
  gold: {
    primaria: [0.831, 0.639, 0.278] as [number, number, number], // #D4A347
    secundaria: [0.525, 0.322, 0.114] as [number, number, number], // #86521D (contraste seguro)
    textoTitulo: [0.525, 0.322, 0.114] as [number, number, number],
    bordaFundo: [0.99, 0.97, 0.92] as [number, number, number],
  },
  orange: {
    primaria: [0.945, 0.353, 0.141] as [number, number, number], // #F15A24
    secundaria: [0.72, 0.22, 0.05] as [number, number, number], // Laranja escuro / queimado
    textoTitulo: [0.72, 0.22, 0.05] as [number, number, number],
    bordaFundo: [0.99, 0.95, 0.93] as [number, number, number],
  },
}

const COR_VERDE: [number, number, number] = [0.051, 0.478, 0.243]
const COR_AMBAR: [number, number, number] = [0.65, 0.38, 0.05]
const COR_TEXTO_PADRAO: [number, number, number] = [0.12, 0.16, 0.22]
const COR_CINZA_MUTED: [number, number, number] = [0.38, 0.44, 0.52]

/** Gera o texto de quitação substituindo variáveis dinâmicas ou usando texto padrão. */
function formatarTextoQuitacao(template: string | undefined, dados: ReciboAluguelDados): string {
  const c = dados.cobranca
  const inquilinoDoc = dados.inquilino.cpf_cnpj
    ? ' (CPF/CNPJ ' + dados.inquilino.cpf_cnpj + ')'
    : ''
  const imovelRotulo = dados.imovel.rotulo || dados.imovel.endereco || '—'
  const valorPagoExtenso = valorPorExtenso(c.valor_pago)
  const valorPagoFormatado = brl(c.valor_pago)

  if (template && template.trim()) {
    return template
      .replace(/\{inquilino_nome\}/gi, dados.inquilino.nome || '—')
      .replace(/\{inquilino_documento\}/gi, inquilinoDoc)
      .replace(/\{valor_pago\}/gi, valorPagoFormatado)
      .replace(/\{valor_pago_extenso\}/gi, valorPagoExtenso)
      .replace(/\{competencia\}/gi, c.competencia || '—')
      .replace(/\{imovel_rotulo\}/gi, imovelRotulo)
      .replace(/\{locador_nome\}/gi, dados.locador.nome || '—')
      .replace(/\{numero_recibo\}/gi, dados.numero || '—')
  }

  return (
    'Recebemos de ' +
    (dados.inquilino.nome || '—') +
    inquilinoDoc +
    ', a importância de ' +
    valorPagoFormatado +
    ' (' +
    valorPagoExtenso +
    '), referente ao aluguel e encargos da competência ' +
    (c.competencia || '—') +
    ' do imóvel ' +
    imovelRotulo +
    '. Damos plena, rasa e geral quitação da quantia discriminada neste documento.'
  )
}

/** Gera o PDF do recibo e devolve o Blob + nome de arquivo. */
export async function gerarPdfRecibo(
  dados: ReciboAluguelDados,
): Promise<{ blob: Blob; nomeArquivo: string }> {
  const M = 48
  const cx = A4_W / 2
  const W = A4_W - 2 * M
  const c = dados.cobranca
  const p = dados.personalizacao || {}

  const tema = PALETA[p.cor_destaque || 'navy'] || PALETA.navy
  const ops: Op[] = []

  // Moldura institucional elegante
  ops.push({
    retangulo: { x: 24, y: 24, w: A4_W - 48, h: A4_H - 48, cor: tema.bordaFundo },
  })
  ops.push({
    retangulo: { x: 26, y: 26, w: A4_W - 52, h: A4_H - 52, cor: [1, 1, 1] },
  })
  // Faixa superior com a cor primária de destaque escolhida
  ops.push({ retangulo: { x: 26, y: 26, w: A4_W - 52, h: 8, cor: tema.primaria } })
  // Linha dourada metálica sutil logo abaixo da faixa
  ops.push({
    linha: {
      x1: 26,
      y1: 35,
      x2: A4_W - 26,
      y2: 35,
      w: 1,
      cor: [0.831, 0.639, 0.278],
    },
  })

  let y = 54

  // CABEÇALHO DO EMITENTE (configurado ou padrão da administradora)
  const emitenteNome = p.emitente_nome?.trim() || dados.locador.nome || 'GESTOR IMOBILIÁRIO 360'
  const emitenteDoc =
    p.emitente_cpf_cnpj?.trim() ||
    (dados.locador.cpf_cnpj ? 'CPF/CNPJ: ' + dados.locador.cpf_cnpj : '')
  const emitenteContato = p.emitente_contato?.trim() || ''
  const emitenteEndereco = p.emitente_endereco?.trim() || ''

  ops.push({
    texto: {
      x: M,
      y,
      size: 13,
      bold: true,
      cor: tema.textoTitulo,
      conteudo: emitenteNome,
    },
  })
  y += 13

  if (emitenteDoc) {
    ops.push({
      texto: {
        x: M,
        y,
        size: 8.5,
        cor: COR_CINZA_MUTED,
        conteudo: emitenteDoc,
      },
    })
    y += 11
  }

  if (emitenteContato) {
    ops.push({
      texto: {
        x: M,
        y,
        size: 8,
        cor: COR_CINZA_MUTED,
        conteudo: emitenteContato,
      },
    })
    y += 11
  }

  if (emitenteEndereco) {
    ops.push({
      texto: {
        x: M,
        y,
        size: 8,
        cor: COR_CINZA_MUTED,
        conteudo: emitenteEndereco,
      },
    })
    y += 11
  }

  // Divisor do cabeçalho
  y += 4
  ops.push({
    linha: {
      x1: M,
      y1: y,
      x2: M + W,
      y2: y,
      w: 0.8,
      cor: [0.83, 0.86, 0.9],
    },
  })
  y += 18

  // TÍTULO DO DOCUMENTO (configurável, ex: "RECIBO DE ALUGUEL")
  const tituloDoc = p.titulo_documento?.trim() || 'RECIBO DE ALUGUEL'
  ops.push({
    texto: {
      x: cx,
      y,
      size: 20,
      bold: true,
      centro: true,
      cor: tema.textoTitulo,
      conteudo: tituloDoc.toUpperCase(),
    },
  })
  y += 18

  // Número sequencial em destaque
  ops.push({
    texto: {
      x: cx,
      y,
      size: 11,
      bold: true,
      centro: true,
      cor: COR_CINZA_MUTED,
      conteudo: 'Nº ' + (dados.numero || '—') + '  ·  COMPETÊNCIA ' + (c.competencia || '—'),
    },
  })
  y += 24

  // TEXTO DE QUITAÇÃO (personalizável com variáveis)
  const textoQuitacao = formatarTextoQuitacao(p.texto_quitacao, dados)
  for (const linha of quebrar(textoQuitacao, 84)) {
    ops.push({
      texto: {
        x: cx,
        y,
        size: 10,
        centro: true,
        cor: COR_TEXTO_PADRAO,
        conteudo: linha,
      },
    })
    y += 14.5
  }

  y += 10
  ops.push({
    linha: {
      x1: M,
      y1: y,
      x2: M + W,
      y2: y,
      w: 0.6,
      cor: [0.85, 0.88, 0.92],
    },
  })
  y += 18

  // COMPOSIÇÃO DETALHADA DA COBRANÇA
  ops.push({
    texto: {
      x: M,
      y,
      size: 9,
      bold: true,
      cor: tema.textoTitulo,
      conteudo: 'DEMONSTRATIVO DE VALORES DA COBRANÇA',
    },
  })
  y += 15

  const itens: [string, number][] = [
    ['Aluguel', c.valor_aluguel],
    ['IPTU', c.valor_iptu],
    ['Condomínio', c.valor_condominio],
    ['Outras cobranças / Taxas', c.outras_cobrancas],
    ['Descontos / Bonificações', -c.valor_desconto],
    ['Acréscimos / Reembolsos', c.valor_acrescimo],
    ['Multa moratória', c.valor_multa],
    ['Juros de mora', c.valor_juros],
  ]

  for (const [rotulo, valor] of itens) {
    if (!valor) continue
    ops.push({
      texto: { x: M + 6, y, size: 9.5, cor: COR_TEXTO_PADRAO, conteudo: rotulo },
    })
    ops.push({
      texto: {
        x: M + W - 6,
        y,
        size: 9.5,
        direita: true,
        cor: COR_TEXTO_PADRAO,
        conteudo: brl(valor),
      },
    })
    y += 13.5
  }

  // Linha separadora de totais
  y += 3
  ops.push({
    linha: {
      x1: M + 6,
      y1: y,
      x2: M + W - 6,
      y2: y,
      w: 0.5,
      cor: [0.85, 0.88, 0.92],
    },
  })
  y += 12

  ops.push({
    texto: {
      x: M + 6,
      y,
      size: 9.5,
      bold: true,
      cor: COR_TEXTO_PADRAO,
      conteudo: 'Total da cobrança',
    },
  })
  ops.push({
    texto: {
      x: M + W - 6,
      y,
      size: 9.5,
      bold: true,
      direita: true,
      cor: COR_TEXTO_PADRAO,
      conteudo: brl(c.valor_total),
    },
  })
  y += 16

  // Box de valor quitado
  ops.push({
    retangulo: {
      x: M + 4,
      y: y - 10,
      w: W - 8,
      h: 22,
      cor: [0.93, 0.98, 0.94],
    },
  })
  ops.push({
    linha: {
      x1: M + 4,
      y1: y - 10,
      x2: M + W - 4,
      y2: y - 10,
      w: 0.5,
      cor: [0.65, 0.85, 0.7],
    },
  })
  ops.push({
    linha: {
      x1: M + 4,
      y1: y + 12,
      x2: M + W - 4,
      y2: y + 12,
      w: 0.5,
      cor: [0.65, 0.85, 0.7],
    },
  })

  ops.push({
    texto: {
      x: M + 8,
      y,
      size: 10.5,
      bold: true,
      cor: COR_VERDE,
      conteudo: 'Total recebido (quitação)',
    },
  })
  ops.push({
    texto: {
      x: M + W - 8,
      y,
      size: 10.5,
      bold: true,
      direita: true,
      cor: COR_VERDE,
      conteudo: brl(c.valor_pago),
    },
  })
  y += 18

  if (dados.saldo > 0.005) {
    ops.push({
      texto: {
        x: M + 6,
        y,
        size: 9,
        bold: true,
        cor: COR_AMBAR,
        conteudo: 'Saldo remanescente em aberto: ' + brl(dados.saldo),
      },
    })
    y += 14
  }

  y += 12
  // DADOS ADICIONAIS DO PAGAMENTO E IMÓVEL
  const dadosPagto =
    'Data da liquidação: ' +
    (dados.data_pagamento_br || '—') +
    '   ·   Forma: ' +
    (FORMA_LABEL[c.forma_pagamento] || c.forma_pagamento || '—') +
    (c.conta_bancaria ? '   ·   Destino: ' + c.conta_bancaria : '')

  for (const linha of quebrar(dadosPagto, 86)) {
    ops.push({
      texto: { x: cx, y, size: 9.5, centro: true, cor: COR_TEXTO_PADRAO, conteudo: linha },
    })
    y += 14
  }

  const dadosLocador =
    'Locador: ' +
    (dados.locador.nome || emitenteNome) +
    (dados.locador.cpf_cnpj ? ' (' + dados.locador.cpf_cnpj + ')' : '') +
    (dados.contrato.numero ? '   ·   Contrato: ' + dados.contrato.numero : '')

  for (const linha of quebrar(dadosLocador, 86)) {
    ops.push({
      texto: { x: cx, y, size: 9, centro: true, cor: COR_CINZA_MUTED, conteudo: linha },
    })
    y += 13
  }

  // OBSERVAÇÕES ESPECÍFICAS / PADRÃO
  if (p.observacoes?.trim()) {
    y += 6
    ops.push({
      texto: {
        x: M,
        y,
        size: 8.5,
        bold: true,
        cor: tema.textoTitulo,
        conteudo: 'OBSERVAÇÕES:',
      },
    })
    y += 12
    for (const linha of quebrar(p.observacoes.trim(), 88)) {
      ops.push({
        texto: { x: M, y, size: 8.5, cor: COR_TEXTO_PADRAO, conteudo: linha },
      })
      y += 12
    }
  }

  // CAMPO DE ASSINATURA (apenas Locador/Emitente centralizado + data de emissão)
  const exibirAssinaturas = p.exibir_assinaturas !== false
  if (exibirAssinaturas) {
    const yAss = Math.max(y + 28, A4_H - 145)
    const larguraLinha = 220
    const corLinhaAssinatura: [number, number, number] = [0.4, 0.46, 0.54] // tom neutro/escuro legível

    // Linha de assinatura centralizada do Locador / Emitente
    ops.push({
      linha: {
        x1: cx - larguraLinha / 2,
        y1: yAss,
        x2: cx + larguraLinha / 2,
        y2: yAss,
        w: 0.8,
        cor: corLinhaAssinatura,
      },
    })
    ops.push({
      texto: {
        x: cx,
        y: yAss + 13,
        size: 9.5,
        bold: true,
        centro: true,
        cor: COR_TEXTO_PADRAO,
        conteudo: emitenteNome || dados.locador.nome || 'Locador / Emitente',
      },
    })
    const rotuloEmitente = p.rotulo_assinatura_emitente?.trim() || 'Locador / Emitente'
    ops.push({
      texto: {
        x: cx,
        y: yAss + 24,
        size: 8,
        centro: true,
        cor: COR_CINZA_MUTED,
        conteudo: rotuloEmitente,
      },
    })
    if (emitenteDoc) {
      ops.push({
        texto: {
          x: cx,
          y: yAss + 34,
          size: 7.5,
          centro: true,
          cor: COR_CINZA_MUTED,
          conteudo: emitenteDoc,
        },
      })
    }

    // Data de emissão centralizada sob a linha de assinatura
    const dataEmissaoTexto =
      'Emitido em ' + (dados.data_pagamento_br || new Date().toLocaleDateString('pt-BR'))
    ops.push({
      texto: {
        x: cx,
        y: yAss + (emitenteDoc ? 48 : 44),
        size: 8,
        centro: true,
        cor: COR_CINZA_MUTED,
        conteudo: dataEmissaoTexto,
      },
    })
  }

  // RODAPÉ CONFIGURÁVEL
  const textoRodape =
    p.rodape?.trim() ||
    'Emitido pelo Gestor Imobiliário 360 em ' + new Date().toLocaleDateString('pt-BR')
  ops.push({
    texto: {
      x: cx,
      y: A4_H - 42,
      size: 7.5,
      centro: true,
      cor: COR_CINZA_MUTED,
      conteudo: textoRodape,
    },
  })

  const blob = montarPdf(ops)
  const nomeArquivo = 'recibo-' + (dados.numero || c.id) + '.pdf'
  return { blob, nomeArquivo }
}
