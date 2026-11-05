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
import type {
  ReciboAluguelDados,
  ReciboConfig,
  ReciboPersonalizacao,
} from '@/features/recibos/tipos'
import { gerarPdfRecibo } from '@/features/recibos/pdf'

export type {
  ReciboAluguelDados,
  ReciboConfig,
  ReciboPersonalizacao,
  CorDestaqueRecibo,
} from '@/features/recibos/tipos'

export const CONFIG_CHAVE_RECIBO = 'recibo_config'

export const CONFIG_RECIBO_PADRAO: ReciboConfig = {
  titulo_documento: 'RECIBO DE ALUGUEL',
  cor_destaque: 'navy',
  texto_quitacao:
    'Recebemos de {inquilino_nome}{inquilino_documento}, a importância de {valor_pago} ({valor_pago_extenso}), referente ao pagamento do aluguel e encargos da competência {competencia} do imóvel {imovel_rotulo}. Damos plena, rasa e geral quitação da referida quantia.',
  observacoes: '',
  rodape: 'Emitido pelo Gestor Imobiliário 360 · Sistema de Gestão Patrimonial',
}

/** Carrega a configuração do recibo salva no banco; fallback para padrão da empresa ou padrão do sistema. */
export async function getReciboConfig(): Promise<ReciboConfig> {
  try {
    const rec = await pb
      .collection('configuracoes')
      .getFirstListItem(`chave = '${CONFIG_CHAVE_RECIBO}'`)
    if (rec && rec.valor_json) {
      const parsed =
        typeof rec.valor_json === 'string' ? JSON.parse(rec.valor_json) : rec.valor_json
      return { ...CONFIG_RECIBO_PADRAO, ...parsed }
    }
  } catch (_) {
    // registro ainda não existe — segue
  }

  // Fallback opcional: dados da empresa cadastrados em empresa_dados
  try {
    const emp = await pb.collection('configuracoes').getFirstListItem("chave = 'empresa_dados'")
    if (emp && emp.valor_json) {
      const parsedEmp =
        typeof emp.valor_json === 'string' ? JSON.parse(emp.valor_json) : emp.valor_json
      return {
        ...CONFIG_RECIBO_PADRAO,
        emitente_nome: parsedEmp.razao_social || parsedEmp.nome_fantasia || '',
        emitente_cpf_cnpj: parsedEmp.cnpj || '',
        emitente_contato: [parsedEmp.telefone, parsedEmp.email].filter(Boolean).join(' · '),
        emitente_endereco: parsedEmp.endereco || '',
      }
    }
  } catch (_) {
    /* dados da empresa indisponíveis */
  }

  return { ...CONFIG_RECIBO_PADRAO }
}

/** Salva a configuração personalizada do recibo em `configuracoes`. */
export async function salvarReciboConfig(config: ReciboConfig): Promise<ReciboConfig> {
  const payload = {
    chave: CONFIG_CHAVE_RECIBO,
    valor_json: JSON.stringify(config),
    descricao: 'Configuração visual e cadastral do recibo de aluguel personalizado',
  }

  try {
    const existente = await pb
      .collection('configuracoes')
      .getFirstListItem(`chave = '${CONFIG_CHAVE_RECIBO}'`)
    await pb.collection('configuracoes').update(existente.id, payload)
  } catch (_) {
    await pb.collection('configuracoes').create(payload)
  }
  return config
}

/** Upload de arquivo de logotipo para a coleção `documentos` (tipo 'outros' ou 'recibo') retornando URL pública. */
export async function uploadLogoRecibo(
  arquivo: File,
): Promise<{ url: string; documentoId: string }> {
  const form = new FormData()
  form.append('tipo', 'outros')
  form.append('titulo', 'Logotipo do Recibo de Aluguel')
  form.append('observacoes', 'logo_recibo_personalizado')
  form.append('arquivo', arquivo)
  const doc = await pb.collection('documentos').create(form)
  const url = pb.files.getURL(doc, doc.arquivo as unknown as string)
  return { url, documentoId: doc.id }
}

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
export async function emitirReciboAluguel(
  cobrancaId: string,
  personalizacao?: ReciboPersonalizacao,
): Promise<ReciboAluguelDados> {
  const dados = await buscarRecibo(cobrancaId)
  let configAtiva = personalizacao
  if (!configAtiva) {
    try {
      configAtiva = await getReciboConfig()
    } catch (_) {
      configAtiva = CONFIG_RECIBO_PADRAO
    }
  }

  const dadosComConfig: ReciboAluguelDados = {
    ...dados,
    personalizacao: configAtiva,
  }

  const { blob, nomeArquivo } = await gerarPdfRecibo(dadosComConfig)
  const form = new FormData()
  form.append('tipo', 'recibo')
  form.append('cobranca', cobrancaId)
  form.append('titulo', 'Recibo ' + dados.numero + ' — competência ' + dados.cobranca.competencia)
  form.append('observacoes', 'Recibo de aluguel ' + dados.numero)
  form.append('arquivo', new File([blob], nomeArquivo, { type: 'application/pdf' }))
  const doc = await pb.collection('documentos').create(form)
  const url = pb.files.getURL(doc, doc.arquivo as unknown as string)
  await registrarRecibo(cobrancaId, url, doc.id)
  return { ...dadosComConfig, url }
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
