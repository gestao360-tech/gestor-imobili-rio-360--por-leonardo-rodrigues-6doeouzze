/** Tipos do recibo de aluguel padrão (espelham pocketbase/hooks/recibos_aluguel.js). */
export type CorDestaqueRecibo = 'navy' | 'gold' | 'orange'

export interface ReciboPersonalizacao {
  // Emitente
  emitente_nome?: string
  emitente_cpf_cnpj?: string
  emitente_contato?: string
  emitente_endereco?: string
  logo_url?: string

  // Textos
  titulo_documento?: string // Padrão "RECIBO DE ALUGUEL"
  texto_quitacao?: string // Padrão com variáveis ou texto base
  observacoes?: string // Observações / notas adicionais padrão
  rodape?: string // Mensagem no rodapé / dados bancários

  // Visual
  cor_destaque?: CorDestaqueRecibo // 'navy' | 'gold' | 'orange'
}

/** Configuração completa persistida em `configuracoes` com chave `recibo_config`. */
export interface ReciboConfig extends ReciboPersonalizacao {
  logo_documento_id?: string
}

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
  personalizacao?: ReciboPersonalizacao
}
