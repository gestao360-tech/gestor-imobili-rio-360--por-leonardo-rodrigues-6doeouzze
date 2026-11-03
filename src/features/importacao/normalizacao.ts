// Normalização e utilidades de dados da importação: texto, endereços, CPF/CNPJ,
// valores, dias de vencimento, datas (inclusive as "malucas" do dia 30/02) e
// nomes de inquilinos. Nenhum dado de planilha vive aqui — só regras genéricas.
import type { ValorCelula } from './types'

export function normalizarTexto(v: unknown): string {
  return String(v ?? '')
    .normalize('NFC')
    .replace(/\s+/g, ' ')
    .trim()
}

export function soDigitos(v: unknown): string {
  return String(v ?? '').replace(/\D/g, '')
}

export function ehNumero(v: ValorCelula): v is number {
  return typeof v === 'number' && !Number.isNaN(v)
}

export function valorNumerico(v: ValorCelula): number | null {
  if (v === null || v === undefined) return null
  if (ehNumero(v)) return v
  const t = String(v).trim()
  if (!t) return null
  const semR = t.replace(/R\$/gi, '').trim()
  const br = semR.replace(/\./g, '').replace(',', '.')
  const n = Number(br)
  if (Number.isNaN(n)) {
    const n2 = Number(semR.replace(',', '.'))
    return Number.isNaN(n2) ? null : n2
  }
  return n
}

/** Número "genérico" (aceita "1.200", "572,95", "R$ 500", "#"). */
export function parseNumeroBR(v: ValorCelula): number | null {
  return valorNumerico(v)
}

export function parseDia(v: ValorCelula): number | null {
  if (v === null || v === undefined) return null
  if (ehNumero(v)) {
    const n = Math.round(v)
    return n >= 1 && n <= 31 ? n : null
  }
  const t = normalizarTexto(v)
  if (!t || t === '#') return null
  const m = t.match(/^(\d{1,2})/)
  if (!m) return null
  const n = Number(m[1])
  return n >= 1 && n <= 31 ? n : null
}

export function textoDe(v: ValorCelula): string {
  if (v === null || v === undefined) return ''
  if (v instanceof Date) return isoDeDataUTC(v)
  if (ehNumero(v)) return String(v)
  return normalizarTexto(v)
}

/** Endereço normalizado usado como chave de casamento de imóveis. */
export function normalizarEndereco(v: unknown): string {
  return String(v ?? '')
    .normalize('NFD')
    .replace(/[\u0300-\u036f]/g, '')
    .toUpperCase()
    .replace(/\s+/g, ' ')
    .replace(/\s+,/g, ',')
    .replace(/,/g, ', ')
    .replace(/\s*-\s*/g, ' - ')
    .replace(/\./g, '')
    .replace(/[^0-9A-Z, \-/]/g, '')
    .replace(/\s+/g, ' ')
    .trim()
}

export function resumirEndereco(endereco: string): string {
  const t = normalizarTexto(endereco)
  const primeira = t.split(',')[0] || t
  return primeira.length > 60 ? `${primeira.slice(0, 57)}…` : primeira
}

export function extrairBairro(endereco: string): string {
  const t = normalizarTexto(endereco)
  const partes = t.split(/[–\-—]/).map((p) => p.trim())
  return partes.length > 1 ? partes[partes.length - 1] : ''
}

export function inferirTipo(descricao: string, endereco: string): string {
  const t = `${descricao} ${endereco}`
    .normalize('NFD')
    .replace(/[\u0300-\u036f]/g, '')
    .toUpperCase()
  if (/\bBOX|GARAGEM/.test(t)) return 'box_garagem'
  if (/LOJA|SALA|COMERCIAL|PONTO|SALAO/.test(t)) return 'comercial'
  if (/KITNET/.test(t)) return 'apartamento'
  if (/CASA/.test(t)) return 'casa'
  if (/APART|\bAP\b/.test(t)) return 'apartamento'
  if (/LOTE|TERRENO/.test(t)) return 'terreno'
  return 'comercial'
}

export function hashCurto(texto: string): string {
  let h = 5381
  for (let i = 0; i < texto.length; i++) {
    h = (h * 33) ^ texto.charCodeAt(i)
  }
  return (h >>> 0).toString(36).toUpperCase().slice(0, 6)
}

export function classificarDoc(texto: string): { valido: boolean; tipo: 'CPF' | 'CNPJ' | null } {
  const d = soDigitos(texto)
  if (d.length === 11) return { valido: cpfValido(d), tipo: 'CPF' }
  if (d.length === 14) return { valido: cnpjValido(d), tipo: 'CNPJ' }
  return { valido: false, tipo: null }
}

function cpfValido(d: string): boolean {
  if (/^(\d)\1{10}$/.test(d)) return false
  let s = 0
  for (let i = 0; i < 9; i++) s += Number(d[i]) * (10 - i)
  let r = (s * 10) % 11
  if (r === 10) r = 0
  if (r !== Number(d[9])) return false
  s = 0
  for (let i = 0; i < 10; i++) s += Number(d[i]) * (11 - i)
  r = (s * 10) % 11
  if (r === 10) r = 0
  return r === Number(d[10])
}

function cnpjValido(d: string): boolean {
  if (/^(\d)\1{13}$/.test(d)) return false
  let pesos = 5
  let s = 0
  for (let i = 2; i < 12; i++) {
    s += Number(d[i - 2]) * pesos
    pesos = pesos === 2 ? 9 : pesos - 1
  }
  let r = s % 11
  const d1 = r < 2 ? 0 : 11 - r
  if (d1 !== Number(d[12])) return false
  pesos = 6
  s = 0
  for (let i = 2; i < 13; i++) {
    s += Number(d[i - 2]) * pesos
    pesos = pesos === 2 ? 9 : pesos - 1
  }
  r = s % 11
  const d2 = r < 2 ? 0 : 11 - r
  return d2 === Number(d[13])
}

/** Nome normalizado usado como chave de casamento de inquilinos. */
export function normalizarNome(v: unknown): string {
  return String(v ?? '')
    .normalize('NFD')
    .replace(/[\u0300-\u036f]/g, '')
    .toUpperCase()
    .replace(/\s+/g, ' ')
    .replace(/[^A-Z0-9 ()\-/]/g, '')
    .trim()
}

export function pareceVago(nome: unknown): boolean {
  const t = normalizarNome(nome)
  return t === 'DESOCUPADO' || t === 'DESCOUPADO' || t === 'VAGO' || t === ''
}

/** 2026-02-05 (sem fuso) a partir de um Date de meia-noite UTC. */
export function isoDeDataUTC(d: Date): string {
  return `${d.getUTCFullYear()}-${String(d.getUTCMonth() + 1).padStart(2, '0')}-${String(
    d.getUTCDate(),
  ).padStart(2, '0')}`
}

/** '2026-02-05' → Date de meia-noite UTC. */
export function dataDeISO(iso: string): Date {
  const [y, m, d] = iso.split('-').map(Number)
  return new Date(Date.UTC(y, (m || 1) - 1, d || 1))
}

function ehBissexto(ano: number): boolean {
  return (ano % 4 === 0 && ano % 100 !== 0) || ano % 400 === 0
}

export interface DataNaPlanilha {
  iso: string | null
  tipo: 'data' | 'texto' | 'invalida' | 'vazia'
  texto: string
}

/**
 * Interpreta qualquer célula de data: Date (serial do Excel), serial numérico,
 * "dd/mm/aaaa" (inclusive dias inexistentes como 30/02, que viram o último dia
 * real do mês), texto livre (ex.: "PERMUTA") → tipo 'texto', ou vazio.
 */
export function valorData(v: ValorCelula): DataNaPlanilha {
  if (v === null || v === undefined || String(v).trim() === '') {
    return { iso: null, tipo: 'vazia', texto: '' }
  }
  if (v instanceof Date && !Number.isNaN(v.getTime())) {
    return { iso: isoDeDataUTC(v), tipo: 'data', texto: '' }
  }
  if (ehNumero(v)) {
    const dias = Math.floor(v)
    const d = new Date(Date.UTC(1899, 11, 30) + dias * 86400000)
    if (d.getUTCFullYear() > 1900 && d.getUTCFullYear() < 2200) {
      return { iso: isoDeDataUTC(d), tipo: 'data', texto: '' }
    }
    return { iso: null, tipo: 'invalida', texto: String(v) }
  }
  const t = normalizarTexto(v)
  const m = t.match(/^(\d{1,2})[/\-.](\d{1,2})[/\-.](\d{2,4})$/)
  if (m) {
    const dia = Number(m[1])
    const mes = Number(m[2])
    let ano = Number(m[3])
    if (ano < 100) ano += 2000
    if (mes < 1 || mes > 12) {
      return { iso: null, tipo: 'invalida', texto: t }
    }
    const limite = new Date(Date.UTC(ano, mes, 0)).getUTCDate()
    const ajustado = dia > limite
    const diaSeguro = mes === 2 ? Math.min(dia, ehBissexto(ano) ? 29 : 28) : Math.min(dia, limite)
    const iso = `${ano}-${String(mes).padStart(2, '0')}-${String(diaSeguro).padStart(2, '0')}`
    return { iso, tipo: ajustado ? 'invalida' : 'data', texto: ajustado ? t : '' }
  }
  return { iso: null, tipo: 'texto', texto: t }
}

/** Data de vencimento da cobrança de uma competência (AAAA-MM-DD). */
export function dataVencimento(ano: number, mes: number, dia: number): string {
  const ultimoDia = new Date(Date.UTC(ano, mes, 0)).getUTCDate()
  const d = Math.min(Math.max(1, dia), ultimoDia)
  return `${ano}-${String(mes).padStart(2, '0')}-${String(d).padStart(2, '0')}`
}

export function hojeISO(): string {
  const n = new Date()
  return isoDeDataUTC(new Date(Date.UTC(n.getUTCFullYear(), n.getUTCMonth(), n.getUTCDate())))
}

export function somarMesesISO(iso: string, meses: number): string {
  const [y, m, d] = iso.split('-').map(Number)
  const dt = new Date(Date.UTC(y, m - 1 + meses, 1))
  const ultimo = new Date(Date.UTC(dt.getUTCFullYear(), dt.getUTCMonth() + 1, 0)).getUTCDate()
  return `${dt.getUTCFullYear()}-${String(dt.getUTCMonth() + 1).padStart(2, '0')}-${String(
    Math.min(d, ultimo),
  ).padStart(2, '0')}`
}

export function ehTextoNaoData(v: ValorCelula): string | null {
  if (v === null || v === undefined) return null
  if (ehNumero(v) || v instanceof Date) return null
  const t = normalizarTexto(v)
  if (!t) return null
  if (/^\d{1,2}[/\-.]\d{1,2}[/\-.]\d{2,4}$/.test(t)) return null
  return t
}
