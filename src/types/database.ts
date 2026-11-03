export type UserRole = 'admin' | 'gestor' | 'financeiro' | 'juridico' | 'proprietario' | 'inquilino'

export interface UserModel {
  id: string
  email: string
  name?: string
  role?: UserRole
  phone?: string
  avatar?: string
  created: string
  updated: string
}

export interface ProprietarioModel {
  id: string
  tipo_pessoa: 'PF' | 'PJ'
  nome: string
  cpf_cnpj: string
  rg_ie?: string
  email?: string
  telefone?: string
  whatsapp?: string
  endereco?: string
  banco_nome?: string
  banco_agencia?: string
  banco_conta?: string
  banco_pix?: string
  observacoes?: string
  is_demo?: boolean
  created: string
  updated: string
}

export interface CoproprietarioItem {
  proprietario_id: string
  nome: string
  percentual: number
}

export interface ImovelModel {
  id: string
  codigo: string
  nome: string
  tipo: 'residencial' | 'comercial' | 'sala' | 'loja' | 'galpao' | 'lote' | 'outros'
  situacao: 'alugado' | 'disponivel' | 'reservado' | 'em_reforma' | 'inativo'
  endereco: string
  numero?: string
  complemento?: string
  bairro: string
  cidade: string
  estado: string
  cep?: string
  matricula?: string
  inscricao_municipal?: string
  area_total?: number
  area_construida?: number
  valor_estimado?: number
  valor_aquisicao?: number
  data_aquisicao?: string
  valor_iptu_mensal?: number
  valor_condominio_mensal?: number
  valor_seguro_mensal?: number
  proprietarios_json?: string | CoproprietarioItem[]
  fotos?: string[]
  observacoes?: string
  is_demo?: boolean
  created: string
  updated: string
}

export interface InquilinoModel {
  id: string
  tipo_pessoa: 'PF' | 'PJ'
  nome: string
  cpf_cnpj: string
  rg_ie?: string
  data_nasc_const?: string
  email?: string
  telefone?: string
  whatsapp?: string
  endereco?: string
  representante_legal?: string
  contato_financeiro?: string
  observacoes?: string
  is_demo?: boolean
  created: string
  updated: string
}

export interface ContratoModel {
  id: string
  numero: string
  imovel: string
  inquilino: string
  locador_nome?: string
  data_assinatura?: string
  data_inicio: string
  data_fim: string
  prazo_meses?: number
  valor_inicial: number
  valor_atual: number
  dia_vencimento: number
  periodicidade_reajuste: 'anual' | 'semestral' | 'bienal'
  indice_reajuste: 'IPCA' | 'IGP-M' | 'INPC' | 'outro'
  data_base_reajuste: string
  garantia_tipo: 'caucao' | 'fiador' | 'seguro_fianca' | 'titulo_capitalizacao' | 'sem_garantia'
  garantia_detalhes?: string
  garantia_valor?: number
  multa_rescisoria_pct?: number
  multa_atraso_pct?: number
  juros_mora_mensal_pct?: number
  desconto_pontualidade?: number
  carencia_meses?: number
  responsavel_iptu?: 'inquilino' | 'proprietario' | 'isento'
  responsavel_condominio?: 'inquilino' | 'proprietario' | 'isento'
  responsavel_seguro?: 'inquilino' | 'proprietario' | 'isento'
  clausulas_especiais?: string
  observacoes_juridicas?: string
  arquivo_contrato?: string[]
  matricula_copasa?: string
  instalacao_cemig?: string
  status:
    | 'ativo'
    | 'vencendo'
    | 'prorrogado_legal'
    | 'renovado'
    | 'em_negociacao'
    | 'encerrado'
    | 'distratado'
  is_demo?: boolean
  created: string
  updated: string
  // expanded relations
  expand?: {
    imovel?: ImovelModel
    inquilino?: InquilinoModel
  }
}

export interface AditivoModel {
  id: string
  contrato: string
  numero_sequencial: number
  data_aditivo: string
  tipo_alteracao: 'valor' | 'prazo' | 'garantia' | 'clausula' | 'outros'
  descricao: string
  valor_anterior?: number
  valor_novo?: number
  data_fim_anterior?: string
  data_fim_nova?: string
  documento?: string[]
  status: 'pendente_assinatura' | 'assinado' | 'cancelado'
  is_demo?: boolean
  created: string
  updated: string
  expand?: {
    contrato?: ContratoModel
  }
}

export interface ReajusteModel {
  id: string
  contrato: string
  data_base: string
  periodo_apuracao?: string
  indice: string
  percentual_aplicavel: number
  tipo_indice: 'estimado' | 'definitivo'
  aluguel_anterior: number
  aluguel_novo_projetado: number
  aluguel_novo_aprovado?: number
  diferenca_mensal?: number
  diferenca_anual?: number
  data_aplicacao: string
  status: 'aguardando_aprovacao' | 'aprovado' | 'em_negociacao' | 'nao_aplicado' | 'rejeitado'
  observacao_negociacao?: string
  aprovado_por?: string
  data_aprovacao?: string
  is_demo?: boolean
  created: string
  updated: string
  expand?: {
    contrato?: ContratoModel
  }
}

export interface RenovacaoModel {
  id: string
  contrato: string
  dias_restantes?: number
  alerta_faixa?: '120_dias' | '90_dias' | '60_dias' | '30_dias' | '15_dias' | '7_dias' | 'vencido'
  status:
    | 'pendente'
    | 'em_negociacao'
    | 'renovado'
    | 'prorrogado_legal'
    | 'distratado'
    | 'resolvido'
  proposta_novo_valor?: number
  proposta_novo_prazo_meses?: number
  historico_negociacao?: string
  data_resolucao?: string
  is_demo?: boolean
  created: string
  updated: string
  expand?: {
    contrato?: ContratoModel
  }
}

export interface CobrancaModel {
  id: string
  contrato: string
  imovel: string
  inquilino: string
  competencia: string // "YYYY-MM"
  vencimento: string // "YYYY-MM-DD"
  valor_aluguel: number
  valor_desconto?: number
  valor_acrescimo?: number
  valor_multa?: number
  valor_juros?: number
  valor_iptu?: number
  valor_condominio?: number
  outras_cobrancas?: number
  valor_total: number
  valor_pago?: number
  data_pagamento?: string
  forma_pagamento?: 'pix' | 'boleto' | 'ted_doc' | 'dinheiro' | 'cartao' | 'outra'
  conta_bancaria?: string
  status:
    | 'a_vencer'
    | 'pago'
    | 'pago_parcialmente'
    | 'vencido'
    | 'em_negociacao'
    | 'renegociado'
    | 'cancelado'
  observacoes?: string
  recibo_gerado?: string
  is_demo?: boolean
  created: string
  updated: string
  expand?: {
    contrato?: ContratoModel
    imovel?: ImovelModel
    inquilino?: InquilinoModel
  }
}

export interface PagamentoModel {
  id: string
  cobranca: string
  data_pagamento: string
  valor_pago: number
  forma_pagamento: 'pix' | 'boleto' | 'ted_doc' | 'dinheiro' | 'cartao' | 'outra'
  conta_bancaria?: string
  comprovante?: string[]
  observacoes?: string
  registrado_por?: string
  is_demo?: boolean
  created: string
  updated: string
  expand?: {
    cobranca?: CobrancaModel
  }
}

export interface DespesaModel {
  id: string
  imovel: string
  categoria:
    | 'manutencao'
    | 'iptu'
    | 'condominio'
    | 'seguro'
    | 'taxa_administracao'
    | 'juridico'
    | 'reforma'
    | 'outras'
  descricao: string
  valor: number
  data_vencimento: string
  data_pagamento?: string
  status: 'pendente' | 'pago' | 'cancelado'
  recorrente?: boolean
  comprovante?: string[]
  observacoes?: string
  is_demo?: boolean
  created: string
  updated: string
  expand?: {
    imovel?: ImovelModel
  }
}

export interface CaucaoGarantiaModel {
  id: string
  contrato: string
  tipo:
    | 'caucao_dinheiro'
    | 'caucao_imovel'
    | 'fiador'
    | 'seguro_fianca'
    | 'titulo_capitalizacao'
    | 'outra'
  valor: number
  data_deposito_emissao?: string
  data_validade?: string
  instituicao_seguradora?: string
  apolice_numero?: string
  conta_rendimento?: string
  status: 'ativa' | 'devolvida' | 'executada' | 'vencida' | 'pendente_comprovante'
  documento?: string[]
  observacoes?: string
  is_demo?: boolean
  created: string
  updated: string
  expand?: {
    contrato?: ContratoModel
  }
}

export interface DocumentoModel {
  id: string
  titulo: string
  tipo:
    | 'contrato'
    | 'aditivo'
    | 'distrato'
    | 'recibo'
    | 'matricula'
    | 'escritura'
    | 'documento_pessoal'
    | 'comprovante_pagamento'
    | 'laudo_vistoria'
    | 'fotografia'
    | 'apolice'
    | 'notificacao'
    | 'outros'
  imovel?: string
  inquilino?: string
  contrato?: string
  arquivo: string
  data_documento?: string
  observacoes?: string
  is_demo?: boolean
  created: string
  updated: string
  expand?: {
    imovel?: ImovelModel
    inquilino?: InquilinoModel
    contrato?: ContratoModel
  }
}

export interface PendenciaModel {
  id: string
  titulo: string
  categoria: 'contratual' | 'financeira' | 'documental' | 'operacional'
  prioridade: 'urgente' | 'alta' | 'media' | 'baixa'
  status: 'pendente' | 'em_andamento' | 'resolvida' | 'cancelada'
  prazo: string
  responsavel: string
  imovel?: string
  inquilino?: string
  contrato?: string
  descricao: string
  solucao_registro?: string
  data_resolucao?: string
  anexos?: string[]
  is_demo?: boolean
  created: string
  updated: string
  expand?: {
    imovel?: ImovelModel
    inquilino?: InquilinoModel
    contrato?: ContratoModel
  }
}

export interface NotificacaoModel {
  id: string
  titulo: string
  mensagem: string
  tipo:
    | 'aluguel_vencido'
    | 'contrato_vencendo'
    | 'reajuste_previsto'
    | 'pendencia_documental'
    | 'recebimento_confirmado'
    | 'aviso_geral'
  severidade: 'urgente' | 'alerta' | 'info' | 'sucesso'
  link_destino?: string
  lida: boolean
  is_demo?: boolean
  created: string
  updated: string
}

export interface HistoricoAlteracaoModel {
  id: string
  entidade: string
  registro_id: string
  acao: 'criacao' | 'edicao' | 'exclusao' | 'baixa_pagamento' | 'reajuste' | 'renovacao' | 'aditivo'
  usuario_nome?: string
  detalhes: string
  dados_anteriores_json?: unknown
  dados_novos_json?: unknown
  is_demo?: boolean
  created: string
  updated: string
}

export interface ConfiguracaoModel {
  id: string
  chave: string
  valor_json: Record<string, unknown> | string
  descricao?: string
  created: string
  updated: string
}

export interface FilaWhatsappModel {
  id: string
  chave: string
  tipo: 'cobranca_antecipada' | 'alerta_inadimplencia'
  status: 'pendente' | 'aprovado' | 'enviado' | 'falhado' | 'descartado'
  cobranca?: string
  contrato?: string
  imovel?: string
  inquilino?: string
  competencia?: string
  vencimento?: string
  valor_devido?: number
  dias_atraso?: number
  dias_antes_vencimento?: number
  destinatario?: string
  destinatario_cadastro?: string
  telefone_ok?: boolean
  mensagem: string
  estagio?: string
  enviado_em?: string
  resultado_envio?: string
  enviado_via?: string
  is_demo?: boolean
  created: string
  updated: string
  expand?: {
    imovel?: ImovelModel
    inquilino?: InquilinoModel
    contrato?: ContratoModel
  }
}

export interface DashboardMetrics {
  totalImoveis: number
  imoveisAlugados: number
  imoveisDisponiveis: number
  contratosAtivos: number
  contratosProximosVencimento: number
  receitaMensalContratada: number
  receitaRecebidaMes: number
  valoresPendentes: number
  valoresVencidosInadimplentes: number
  receitaAnualAcumulada: number
  previsaoReceita12Meses: number
  reajustesPrevistos: number
  renovacoesPendentes: number
  taxaOcupacao: number
  percentualInadimplencia: number
  totalGarantiasCaucoes: number
  pendenciasAdministrativas: number
}
