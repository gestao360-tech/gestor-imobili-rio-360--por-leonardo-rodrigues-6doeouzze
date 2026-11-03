import type {
  ContratoModel,
  CobrancaModel,
  ImovelModel,
  InquilinoModel,
  PagamentoModel,
} from '@/types/database'

// Tipos da importação de planilha (Configurações > Importar planilha).
// Nenhum dado de planilha vive aqui — apenas estrutura/mapeamento.

export type ValorCelula = string | number | Date | null

export interface AbaPlanilha {
  nome: string
  matriz: ValorCelula[][]
}

export interface PlanilhaCarregada {
  nomeArquivo: string
  abas: AbaPlanilha[]
}

export interface RegiaoTabela {
  aba: string
  /** 1-based; 0 = a aba não tem linha de cabeçalho */
  linhaCabecalho: number
  colInicio: number
  colFim: number
}

export interface BlocoSugerido {
  linhaCabecalho: number
  colInicio: number
  colFim: number
  rotulo: string
}

export interface ColunaExtraida {
  indice: number
  letra: string
  cabecalho: string
}

export interface LinhaExtraida {
  numero: number
  celulas: Record<number, ValorCelula>
}

export interface TabelaExtraida {
  regiao: RegiaoTabela
  colunas: ColunaExtraida[]
  linhas: LinhaExtraida[]
}

export type MesChave =
  | 'jan'
  | 'fev'
  | 'mar'
  | 'abr'
  | 'mai'
  | 'jun'
  | 'jul'
  | 'ago'
  | 'set'
  | 'out'
  | 'nov'
  | 'dez'

export interface MapeamentoColunas {
  endereco: number | null
  descricao: number | null
  inquilinoNome: number | null
  cpfCnpj: number | null
  telefone: number | null
  valorAluguel: number | null
  diaVencimento: number | null
  dataInicio: number | null
  matriculaCopasa: number | null
  instalacaoCemig: number | null
  meses: Partial<Record<MesChave, number | null>>
}

export type CampoMapeavelChave = Exclude<keyof MapeamentoColunas, 'meses'>

export type AcaoGravacao = 'criar' | 'atualizar' | 'nada'

export interface ProblemaImportacao {
  linha: number
  mensagem: string
  severidade: 'erro' | 'aviso'
}

export type ValorData =
  | { tipo: 'vazio' }
  | { tipo: 'data'; data: string }
  | { tipo: 'texto'; bruto: string }
  | { tipo: 'invalido'; bruto: string }

export interface PlanoImovel {
  chave: string
  acao: AcaoGravacao
  id: string | null
  endereco: string
  desocupado: boolean
  dados: Record<string, unknown>
}

export interface PlanoInquilino {
  chave: string
  acao: AcaoGravacao
  id: string | null
  nome: string
  dados: Record<string, unknown>
}

export interface PlanoCobranca {
  mes: number
  competencia: string
  acao: AcaoGravacao
  id: string | null
  vencimento: string
  status: 'pago' | 'a_vencer' | 'vencido'
  dataPagamento: string | null
  valorPago: number
  valorTotal: number
  observacoes: string
  registrarPagamento: boolean
}

export interface PlanoContrato {
  chave: string
  acao: AcaoGravacao
  id: string | null
  imovelRef: PlanoImovel
  inquilinoRef: PlanoInquilino
  dados: Record<string, unknown>
  cobrancas: PlanoCobranca[]
  mesesTratados: Set<number>
}

export interface LinhaPlano {
  numero: number
  desocupado: boolean
  imovel: PlanoImovel | null
  inquilino: PlanoInquilino | null
  contrato: PlanoContrato | null
}

export interface ResumoImportacao {
  imoveisCriar: number
  imoveisAtualizar: number
  inquilinosCriar: number
  inquilinosAtualizar: number
  contratosCriar: number
  contratosAtualizar: number
  cobrancasCriar: number
  cobrancasAtualizar: number
  cobrancasIgnoradas: number
  pagamentosCriar: number
  linhasIgnoradas: number
}

export function resumoZerado(): ResumoImportacao {
  return {
    imoveisCriar: 0,
    imoveisAtualizar: 0,
    inquilinosCriar: 0,
    inquilinosAtualizar: 0,
    contratosCriar: 0,
    contratosAtualizar: 0,
    cobrancasCriar: 0,
    cobrancasAtualizar: 0,
    cobrancasIgnoradas: 0,
    pagamentosCriar: 0,
    linhasIgnoradas: 0,
  }
}

export interface PlanoImportacao {
  resumo: ResumoImportacao
  linhas: LinhaPlano[]
  imoveis: PlanoImovel[]
  inquilinos: PlanoInquilino[]
  contratos: PlanoContrato[]
  problemas: ProblemaImportacao[]
}

export interface RelatorioImportacao {
  resumo: ResumoImportacao
  itensRevisao: ProblemaImportacao[]
  erros: string[]
}

export interface DadosExistentes {
  imoveis: ImovelModel[]
  inquilinos: InquilinoModel[]
  contratos: ContratoModel[]
  cobrancas: CobrancaModel[]
  pagamentos: PagamentoModel[]
}
