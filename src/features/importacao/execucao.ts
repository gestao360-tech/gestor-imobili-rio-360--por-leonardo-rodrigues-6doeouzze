// Execução do plano de importação: grava imóveis, inquilinos, contratos,
// cobranças e pagamentos nas coleções do PocketBase, na ordem de dependência.
// Idempotente: tudo que o plano marca como 'nada' não é tocado.
import pb from '@/lib/pocketbase/client'
import type { PlanoImportacao, RelatorioImportacao } from './types'

export type FaseExecucao = (fase: string, atual: number, total: number) => void

export async function executarPlano(
  plano: PlanoImportacao,
  onFase?: FaseExecucao,
): Promise<RelatorioImportacao> {
  const resumo = { ...plano.resumo }
  const erros: string[] = []

  // 1) imóveis
  const imoveis = plano.imoveis.filter((i) => i.acao !== 'nada')
  imoveis.forEach((_, i) => onFase?.('Imóveis', i, imoveis.length))
  for (const im of imoveis) {
    try {
      if (im.acao === 'criar') {
        const rec = await pb.collection('imoveis').create(im.dados)
        im.id = rec.id
      } else if (im.acao === 'atualizar' && im.id && Object.keys(im.dados).length > 0) {
        await pb.collection('imoveis').update(im.id, im.dados)
      }
    } catch (e) {
      erros.push(`Imóvel "${im.endereco.slice(0, 60)}": ${mensagem(e)}`)
    }
  }

  // 2) inquilinos
  const inquilinos = plano.inquilinos.filter((i) => i.acao !== 'nada')
  inquilinos.forEach((_, i) => onFase?.('Inquilinos', i, inquilinos.length))
  for (const iq of inquilinos) {
    try {
      if (iq.acao === 'criar') {
        const rec = await pb.collection('inquilinos').create(iq.dados)
        iq.id = rec.id
      } else if (iq.acao === 'atualizar' && iq.id && Object.keys(iq.dados).length > 0) {
        await pb.collection('inquilinos').update(iq.id, iq.dados)
      }
    } catch (e) {
      erros.push(`Inquilino "${iq.nome.slice(0, 60)}": ${mensagem(e)}`)
    }
  }

  // 3) contratos — usa os ids dos imóveis/inquilinos criados acima
  const contratos = plano.contratos.filter((c) => c.acao !== 'nada')
  contratos.forEach((_, i) => onFase?.('Contratos', i, contratos.length))
  for (const c of contratos) {
    try {
      if (c.acao === 'criar') {
        if (!c.imovelRef.id || !c.inquilinoRef.id) {
          erros.push(
            `Contrato (imóvel "${c.imovelRef.endereco.slice(0, 40)}"): imóvel/inquilino não pôde ser gravado.`,
          )
          continue
        }
        const dados = { ...c.dados, imovel: c.imovelRef.id, inquilino: c.inquilinoRef.id }
        const rec = await pb.collection('contratos').create(dados)
        c.id = rec.id
      } else if (c.acao === 'atualizar' && c.id && Object.keys(c.dados).length > 0) {
        await pb.collection('contratos').update(c.id, c.dados)
      }
    } catch (e) {
      erros.push(`Contrato (imóvel "${c.imovelRef.endereco.slice(0, 40)}"): ${mensagem(e)}`)
    }
  }

  // 4) cobranças e pagamentos — só para contratos com id conhecido
  const pagamentosExistentes = new Set<string>()
  try {
    const lista = await pb.collection('pagamentos').getFullList({
      fields: 'id,cobranca,data_pagamento',
    })
    for (const p of lista) pagamentosExistentes.add(`${p.cobranca}|${p.data_pagamento}`)
  } catch {
    // sem permissão ou coleção vazia — segue sem dedupe de pagamentos
  }
  const todasCobrancas = contratos.flatMap((c) => c.cobrancas.map((cb) => ({ cb, contrato: c })))
  todasCobrancas.forEach((_, i) => onFase?.('Cobranças', i, todasCobrancas.length))
  for (const { cb, contrato } of todasCobrancas) {
    if (cb.acao === 'nada') continue
    try {
      let cobrancaId = cb.id
      if (cb.acao === 'criar') {
        if (!contrato.id) continue
        const rec = await pb.collection('cobrancas').create({
          contrato: contrato.id,
          imovel: contrato.imovelRef.id,
          inquilino: contrato.inquilinoRef.id,
          competencia: cb.competencia,
          vencimento: cb.vencimento,
          valor_aluguel: cb.valorTotal,
          valor_total: cb.valorTotal,
          valor_pago: cb.valorPago,
          data_pagamento: cb.dataPagamento ?? '',
          status: cb.status,
          observacoes: cb.observacoes,
          is_demo: false,
        })
        cobrancaId = rec.id
        cb.acao = 'nada'
      } else if (cb.acao === 'atualizar' && cb.id) {
        const patch: Record<string, unknown> = {
          status: cb.status,
          valor_pago: cb.valorPago,
          data_pagamento: cb.dataPagamento ?? '',
          forma_pagamento: 'outra',
        }
        if (cb.observacoes) patch.observacoes = cb.observacoes
        await pb.collection('cobrancas').update(cb.id, patch)
        cb.acao = 'nada'
      }
      if (cb.registrarPagamento && cobrancaId && cb.dataPagamento) {
        const chave = `${cobrancaId}|${cb.dataPagamento}`
        if (!pagamentosExistentes.has(chave)) {
          await pb.collection('pagamentos').create({
            cobranca: cobrancaId,
            data_pagamento: cb.dataPagamento,
            valor_pago: cb.valorPago,
            forma_pagamento: 'outra',
            observacoes: 'Importado da planilha de controle mensal.',
            registrado_por: 'Importação',
          })
          pagamentosExistentes.add(chave)
        }
        cb.registrarPagamento = false
      }
    } catch (e) {
      erros.push(
        `Cobrança ${cb.competencia} (imóvel "${contrato.imovelRef.endereco.slice(0, 40)}"): ${mensagem(e)}`,
      )
    }
  }

  return { resumo, erros, itensRevisao: [...plano.problemas] }
}

function mensagem(e: unknown): string {
  const qualquer = e as { response?: { message?: string; data?: Record<string, string> } }
  const resp = qualquer?.response
  if (resp?.message) return resp.message
  if (resp?.data) {
    const primeiro = Object.entries(resp.data)[0]
    if (primeiro) return `${primeiro[0]}: ${primeiro[1]}`
  }
  return e instanceof Error ? e.message : String(e)
}
