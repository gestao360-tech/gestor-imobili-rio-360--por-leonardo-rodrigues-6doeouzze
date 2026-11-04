/** Tipos do recibo de aluguel padrão (espelham pocketbase/hooks/recibos_aluguel.js). */
export interface ReciboAluguelDados {
  ok: boolean
  numero: string
  numero_definido: boolean
  url: string
  status: string
  saldo: number
  data_pagamento_br: string
  cobranca: {
    id: string
    competencia: string
    vencimento: string
    valor_aluguel: number
    valor_desconto: number
    valor_acrescimo: number
    valor_multa: number
    valor_juros: number
    valor_iptu: number
    valor_condominio: number
    outras_cobrancas: number
    valor_total: number
    valor_pago: number
    data_pagamento: string
    forma_pagamento: string
    conta_bancaria: string
  }
  inquilino: { id: string; nome: string; cpf_cnpj: string }
  locador: { nome: string; cpf_cnpj: string }
  imovel: { id: string; rotulo: string; endereco: string }
  contrato: { id: string; numero: string }
}
