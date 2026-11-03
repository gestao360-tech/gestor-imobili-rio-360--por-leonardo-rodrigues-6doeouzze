/**
 * Fila de WhatsApp — cobranças e alertas de inadimplência (Gestor Imobiliário 360).
 *
 * Rotas do backend (hook pocketbase/hooks/fila_whatsapp.js, proxy do PocketBase):
 *  GET  /backend/v1/whatsapp/config  — lê configuração (categorias + dias antes).
 *  POST /backend/v1/whatsapp/config  — salva categorias e dias.
 *  POST /backend/v1/whatsapp/varrer  — roda a geração da fila na hora (mesma lógica do cron).
 *  POST /backend/v1/whatsapp/enviar  — envia itens APROVADOS via conector WhatsApp (owner).
 *  POST /backend/v1/whatsapp/teste   — envio de teste para um número informado.
 *
 * Nada sai sem aprovação na fila: o envio exige status "aprovado" (ou reenvio de
 * "falhado"), e itens sem um número válido entram como "precisa de atenção"
 * (telefone_ok = false) e nunca são enviados.
 */
import pb from '@/lib/pocketbase/client'
import type { FilaWhatsappModel } from '@/types/database'

export interface ConfigWhatsapp {
  ok: boolean
  categorias: { cobranca_antecipada: boolean; alerta_inadimplencia: boolean }
  dias_antes_vencimento: number
}

export interface ResultadoVarreduraWhatsApp {
  ok: boolean
  novos_itens: number
  ja_existentes: number
  dias_antes_vencimento: number
}

export interface ResultadoEnvio {
  ok: boolean
  enviados: number
  falhas: number
  detalhes: { id: string; ok: boolean; erro?: string }[]
}

export interface ResultadoTeste {
  ok: boolean
  numero_normalizado?: string
  resultado?: string
  erro?: string
}

export interface ResultadoLote {
  ok: boolean
  afetados: number
  aprovados: number
  erros: string[]
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
  if (!resposta.ok) throw new Error(`Falha na chamada (${resposta.status})`)
  return (await resposta.json()) as Record<string, unknown>
}

export async function getConfigWhatsapp(): Promise<ConfigWhatsapp> {
  return (await get('/backend/v1/whatsapp/config')) as unknown as ConfigWhatsapp
}

export async function salvarConfigWhatsapp(dados: {
  categorias?: { cobranca_antecipada: boolean; alerta_inadimplencia: boolean }
  dias_antes_vencimento?: number
}): Promise<{ ok: boolean }> {
  return (await post('/backend/v1/whatsapp/config', dados)) as unknown as { ok: boolean }
}

export async function dispararVarreduraWhatsApp(): Promise<ResultadoVarreduraWhatsApp> {
  return (await post('/backend/v1/whatsapp/varrer', {})) as unknown as ResultadoVarreduraWhatsApp
}

/** Varredura imediata — alias usado pela tela da fila ("Gerar fila agora"). */
export async function varrerFilaWhatsapp(): Promise<ResultadoVarreduraWhatsApp> {
  return dispararVarreduraWhatsApp()
}

export async function enviarItensWhatsapp(ids: string[]): Promise<ResultadoEnvio> {
  return (await post('/backend/v1/whatsapp/enviar', { ids })) as unknown as ResultadoEnvio
}

/** Envia itens aprovados da fila (a tela chama enviarItensFila). */
export async function enviarItensFila(ids: string[]): Promise<ResultadoEnvio> {
  return enviarItensWhatsapp(ids)
}

export async function enviarTesteWhatsapp(numero: string): Promise<ResultadoTeste> {
  return (await post('/backend/v1/whatsapp/teste', { numero })) as unknown as ResultadoTeste
}

// ----------------- FILA (coleção `fila_whatsapp`) -----------------

export type FiltroFilaWhatsapp = 'pendentes' | 'todos' | 'enviados'

/** Pendentes = pendente + aprovado + falhado — tudo que ainda pede ação do usuário. */
function filtroDe(filtro: FiltroFilaWhatsapp): string {
  if (filtro === 'enviados') return "status = 'enviado'"
  if (filtro === 'todos') return "status != 'descartado'"
  return "status != 'descartado' && status != 'enviado'"
}

export async function getFilaWhatsapp(
  filtro: FiltroFilaWhatsapp = 'pendentes',
): Promise<FilaWhatsappModel[]> {
  return pb.collection('fila_whatsapp').getFullList<FilaWhatsappModel>({
    sort: '-created',
    filter: filtroDe(filtro),
    expand: 'imovel,inquilino,contrato',
    $autoCancel: false,
  })
}

/** Aprova itens pendentes — só depois disso eles podem ser enviados. */
export async function aprovarItensFila(ids: string[]): Promise<ResultadoLote> {
  const erros: string[] = []
  let aprovados = 0
  for (const id of ids) {
    try {
      const item = await pb.collection('fila_whatsapp').getOne<FilaWhatsappModel>(id)
      if (item !== null && item.status !== 'pendente') {
        erros.push(`Item ${id} não está mais pendente (status: ${item.status}).`)
        continue
      }
      await pb.collection('fila_whatsapp').update(id, { status: 'aprovado' })
      aprovados++
    } catch (e) {
      erros.push(e instanceof Error ? e.message : `Falha ao aprovar o item ${id}.`)
    }
  }
  return { ok: erros.length === 0, afetados: aprovados, aprovados, erros }
}

/** Edita a mensagem de um item da fila (antes do envio). */
export async function editarMensagemFila(id: string, mensagem: string): Promise<{ ok: boolean }> {
  await pb.collection('fila_whatsapp').update(id, { mensagem })
  return { ok: true }
}

/**
 * Edita o destinatário de um item da fila. O número é gravado exatamente como
 * digitado; a normalização (DDI/DDD) é feita no hook, no momento do envio.
 */
export async function editarDestinatarioFila(
  id: string,
  destinatario: string,
): Promise<{ ok: boolean }> {
  await pb.collection('fila_whatsapp').update(id, { destinatario })
  return { ok: true }
}

/** Volta a usar o telefone do cadastro do inquilino como destinatário do item. */
export async function usarTelefoneCadastro(id: string): Promise<{ ok: boolean }> {
  const item = await pb.collection('fila_whatsapp').getOne<FilaWhatsappModel>(id)
  const doCadastro = item.destinatario_cadastro || ''
  if (!doCadastro) {
    throw new Error('O inquilino não tem telefone cadastrado.')
  }
  await pb.collection('fila_whatsapp').update(id, { destinatario: doCadastro })
  return { ok: true }
}

/** Descarta itens da fila — eles saem de todas as listas e nunca mais são enviados. */
export async function descartarItensFila(ids: string[]): Promise<ResultadoLote> {
  const erros: string[] = []
  let aprovados = 0
  for (const id of ids) {
    try {
      await pb.collection('fila_whatsapp').update(id, { status: 'descartado' })
      aprovados++
    } catch (e) {
      erros.push(e instanceof Error ? e.message : `Falha ao descartar o item ${id}.`)
    }
  }
  return { ok: erros.length === 0, afetados: aprovados, aprovados, erros }
}
