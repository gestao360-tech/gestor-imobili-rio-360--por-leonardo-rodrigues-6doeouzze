/**
 * Recibo de aluguel padrão — cliente do backend (pocketbase/hooks/recibos_aluguel.js).
 *
 * Fluxo (regra de ouro: nada dispara sozinho):
 *  1. buscarRecibo   — dados do recibo; ERRO para cobrança em aberto
 *     ("o recibo de quitação exige baixa" — sem sucesso falso).
 *  2. gerarPdfRecibo — PDF gerado no cliente (src/features/recibos/pdf.ts)
 *     e subido como arquivo da coleção `documentos` (tipo 'recibo').
 *  3. registrarRecibo — grava número + URL na cobrança (idempotente).
 *  4. criarItemFilaRecibo — item pendente na fila de WhatsApp com link do PDF;
 *     dedupe por chave 'recibo:<cobranca_id>' (a mesma cobrança não gera dois
 *     itens pendentes idênticos); inquilino sem WhatsApp válido devolve aviso
 *     "precisa de atenção" em vez de criar item inválido.
 */
import pb from '@/lib/pocketbase/client'
import type { ReciboAluguelDados } from '@/features/recibos/tipos'
import { gerarPdfRecibo } from '@/features/recibos/pdf'

export type { ReciboAluguelDados } from '@/features/recibos/tipos'

export interface ResultadoItemFilaRecibo {
  ok: boolean
  item_id?: string
  dedupe?: boolean
  aviso?: string
  numero?: string
  erro?: string
}

async function post(path: string, body?: unknown): Promise<Record<string, unknown>> {
  const resposta = await fetch(pb.buildURL(path), {
    method: 'POST',
    headers: { 'Content-Type': 'application/json' },
    body: body ? JSON.stringify(body) : undefined,
  })
  const dados = (await resposta.json().catch(() => ({}))) as Record<string, unknown>
  if (!resposta.ok) {
    throw new Error(String(dados.erro || `Falha na chamada (${resposta.status})`))
  }
  return dados
}

async function get(path: string): Promise<Record<string, unknown>> {
  const resposta = await fetch(pb.buildURL(path))
  if (!resposta.ok) {
    const dados = (await resposta.json().catch(() => ({}))) as Record<string, unknown>
    throw new Error(String(dados.erro || `Falha na chamada (${resposta.status})`))
  }
  return (await resposta.json()) as Record<string, unknown>
}

/** Dados do recibo (cobrança + contrato + imóvel + inquilino + locador). */
export async function buscarRecibo(cobrancaId: string): Promise<ReciboAluguelDados> {
  const r = await get('/backend/v1/recibos/dados?cobranca_id=' + encodeURIComponent(cobrancaId))
  return r as unknown as ReciboAluguelDados
}

/** Grava número + URL do PDF na cobrança (idempotente). */
export async function registrarRecibo(
  cobrancaId: string,
  url: string,
  documentoId?: string,
): Promise<{ ok: boolean; numero: string; url: string }> {
  const r = await post('/backend/v1/recibos/registrar', {
    cobranca_id: cobrancaId,
    url,
    documento_id: documentoId || '',
  })
  return r as unknown as { ok: boolean; numero: string; url: string }
}

/**
 * Cria o item na fila de WhatsApp com a mensagem do recibo + link do PDF.
 * Dedupe no backend; aviso "precisa de atenção" quando o WhatsApp do
 * inquilino não está válido.
 */
export async function criarItemFilaRecibo(
  cobrancaId: string,
  url: string,
): Promise<ResultadoItemFilaRecibo> {
  return (await post('/backend/v1/recibos/fila', {
    cobranca_id: cobrancaId,
    url,
  })) as unknown as ResultadoItemFilaRecibo
}

/**
 * Fluxo completo a partir da UI: gera o PDF no cliente, sobe em `documentos`,
 * registra na cobrança e devolve a URL pública para baixa/envio.
 */
export async function emitirReciboAluguel(cobrancaId: string): Promise<ReciboAluguelDados> {
  const dados = await buscarRecibo(cobrancaId)
  const { blob, nomeArquivo } = await gerarPdfRecibo(dados)
  const form = new FormData()
  form.append('tipo', 'recibo')
  form.append('cobranca', cobrancaId)
  form.append('titulo', 'Recibo ' + dados.numero + ' — competência ' + dados.cobranca.competencia)
  form.append('observacoes', 'Recibo de aluguel ' + dados.numero)
  form.append('arquivo', new File([blob], nomeArquivo, { type: 'application/pdf' }))
  const doc = await pb.collection('documentos').create(form)
  const url = pb.files.getURL(doc, doc.arquivo as unknown as string)
  await registrarRecibo(cobrancaId, url, doc.id)
  return { ...dados, url }
}

/**
 * Recibo + envio ao WhatsApp: cria o item na fila (pendente, revisão e
 * confirmação do usuário em 📱 WhatsApp antes de disparar).
 */
export async function emitirReciboEEnviar(
  cobrancaId: string,
  url: string,
): Promise<ResultadoItemFilaRecibo> {
  return criarItemFilaRecibo(cobrancaId, url)
}
