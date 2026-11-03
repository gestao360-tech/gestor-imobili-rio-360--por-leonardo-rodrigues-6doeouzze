/**
 * Notificações por e-mail — Central de Alertas (Gestor Imobiliário 360).
 *
 * Rotas do backend (proxy do PocketBase):
 *  GET  /backend/v1/alertas-email/config      — lê configuração + último teste.
 *  POST /backend/v1/alertas-email/config      — salva destinatários e categorias.
 *  POST /backend/v1/alertas-email/teste       — dispara um envio de e-mail de teste REAL.
 *  POST /backend/v1/alertas-email/verificar   — roda a varredura de alertas (mesma lógica do cron diário).
 *  POST /backend/v1/alertas-email/resumo      — dispara o resumo gerencial semanal na hora.
 *
 * Os crons `alertas_email_verificar` (diário 10h UTC) e `alertas_email_resumo`
 * (segunda-feira 10h UTC) rodam no servidor.
 */
import pb from '@/lib/pocketbase/client'

export interface AlertasEmailConfig {
  ok: boolean
  admin_email: string
  destinatarios: string[]
  categorias: Record<
    'inadimplencia' | 'contratos' | 'reajustes' | 'pendencias' | 'resumo_semanal',
    boolean
  >
  agendamento: { diaria_hora_utc: number; semanal_dow: number; semanal_hora_utc: number }
  ultimo_teste: { executado_em: string; resultado: string; sucesso: boolean }
}

export interface ResultadoVarredura {
  ok: boolean
  hoje: string
  candidatos: number
  novos_alertas: number
  alertas_em_aberto: number
  email_enviado: boolean
  destino: string
  erro?: string
}

export interface ResultadoResumo {
  ok: boolean
  resumo?: {
    total_recebido: number
    total_pendente: number
    cobrancas_vencidas: number
    contratos_proximos: number
    reajustes_futuros: number
    pendencias_urgentes: number
  }
  email: { ok: boolean; destino: string; erro?: string }
  erro?: string
}

async function post(path: string, body?: unknown): Promise<unknown> {
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

export async function getAlertasEmailConfig(): Promise<AlertasEmailConfig> {
  const resposta = await fetch(pb.buildURL('/backend/v1/alertas-email/config'))
  if (!resposta.ok) throw new Error(`Falha ao carregar a configuração (${resposta.status})`)
  return (await resposta.json()) as AlertasEmailConfig
}

export async function salvarAlertasEmailConfig(dados: {
  destinatarios?: string[]
  categorias?: Record<string, boolean>
}): Promise<{ ok: boolean }> {
  return (await post('/backend/v1/alertas-email/config', dados)) as { ok: boolean }
}

export async function enviarTesteEmail(): Promise<{ ok: boolean; destino: string }> {
  return (await post('/backend/v1/alertas-email/teste', {})) as { ok: boolean; destino: string }
}

export async function dispararVarredura(): Promise<ResultadoVarredura> {
  return (await post('/backend/v1/alertas-email/verificar', {})) as ResultadoVarredura
}

export async function dispararResumo(): Promise<ResultadoResumo> {
  return (await post('/backend/v1/alertas-email/resumo', {})) as ResultadoResumo
}

// ----------------- ALERTAS (coleção `alertas_email`) -----------------

export interface AlertaEmailModel {
  id: string
  chave: string
  evento: string
  categoria: string
  severidade: 'urgente' | 'alta' | 'media' | 'info'
  titulo: string
  mensagem: string
  ref_id: string
  ref_rotulo: string
  ref_valor: number
  ref_data: string
  ref_status: string
  acao: string
  email_enviado: boolean
  ativo: boolean
  is_demo?: boolean
  created: string
  updated: string
}

export async function getAlertas(ativoApenas = true): Promise<AlertaEmailModel[]> {
  const filtro = ativoApenas ? 'ativo = true' : ''
  return await pb.collection('alertas_email').getFullList<AlertaEmailModel>({
    filter: filtro || undefined,
    sort: '-created',
  })
}
