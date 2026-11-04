import pb from '@/lib/pocketbase/client'
import { PagamentoModel } from '@/types/database'

/* Pagamentos reais do banco (coleção `pagamentos`) — fonte das ENTRADAS
 * do fluxo de caixa. Usado pelo motor (fluxo.ts) e pela página. */

/** Carrega todos os pagamentos reais do banco (não demonstrativos). */
export async function carregarPagamentos(): Promise<PagamentoModel[]> {
  const lista = await pb
    .collection('pagamentos')
    .getFullList<PagamentoModel>({ sort: '-data_pagamento' })
  return lista.filter((p) => !p.is_demo)
}

/** Filtra os pagamentos dentro de uma janela ISO de datas de pagamento. */
export function pagamentosDoPeriodo(
  pagamentos: PagamentoModel[],
  inicio: string,
  fim: string,
): PagamentoModel[] {
  return pagamentos.filter((p) => p.data_pagamento >= inicio && p.data_pagamento <= fim)
}
