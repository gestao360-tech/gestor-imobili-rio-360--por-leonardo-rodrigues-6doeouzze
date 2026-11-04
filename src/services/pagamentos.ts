/**
 * Integração de pagamentos (Stripe via conector owner).
 *
 * Rotas do backend (hook pocketbase/hooks/pagamentos_stripe.js):
 *  POST /backend/v1/pagamentos/link    — cria (ou REUSA) o Payment Link do
 *    Stripe para uma cobrança em aberto, com o valor exato, e grava a URL em
 *    cobrancas.link_pagamento. Nunca gera link sem ação explícita do usuário
 *    (Financeiro) nem para cobrança que já tem link.
 *  POST /backend/v1/pagamentos/webhook — confirmação do pagamento: marca a
 *    cobrança como paga/parcialmente paga e grava registro real em `pagamentos`
 *    (alimenta o Fluxo de Caixa). Idempotente pelo id do evento.
 */
import pb from '@/lib/pocketbase/client'

export interface ResultadoLinkPagamento {
  ok: boolean
  url?: string
  criado?: boolean
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

/**
 * Gera o link de pagamento de uma cobrança em aberto. Se a cobrança já tem
 * link, o backend reusa (criado = false) — nada é duplicado no Stripe.
 */
export async function gerarLinkPagamento(cobrancaId: string): Promise<ResultadoLinkPagamento> {
  return (await post('/backend/v1/pagamentos/link', {
    cobranca_id: cobrancaId,
  })) as unknown as ResultadoLinkPagamento
}
