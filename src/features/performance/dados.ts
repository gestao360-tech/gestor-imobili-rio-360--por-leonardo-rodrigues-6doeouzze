import pb from '@/lib/pocketbase/client'
import {
  ImovelModel,
  ContratoModel,
  CobrancaModel,
  DespesaModel,
  ReajusteModel,
  InquilinoModel,
} from '@/types/database'
import {
  DadosPerformance,
  FiltroPerformance,
  OpcoesFiltradas,
  calcularPerformance,
} from './calculos'

/** Busca tudo que a análise de performance precisa das coleções reais do banco. */
export async function carregarFontesPerformance(): Promise<{
  imoveis: ImovelModel[]
  contratos: ContratoModel[]
  cobrancas: CobrancaModel[]
  despesas: DespesaModel[]
  reajustes: ReajusteModel[]
  inquilinos: InquilinoModel[]
}> {
  const [imoveis, contratos, cobrancas, despesas, reajustes, inquilinos] = await Promise.all([
    pb.collection('imoveis').getFullList<ImovelModel>({ sort: 'codigo' }),
    pb.collection('contratos').getFullList<ContratoModel>({ sort: '-created' }),
    pb.collection('cobrancas').getFullList<CobrancaModel>({ sort: '-vencimento' }),
    pb.collection('despesas').getFullList<DespesaModel>({ sort: '-data_vencimento' }),
    pb.collection('reajustes').getFullList<ReajusteModel>({ sort: '-data_base' }),
    pb.collection('inquilinos').getFullList<InquilinoModel>({ sort: 'nome' }),
  ])
  return { imoveis, contratos, cobrancas, despesas, reajustes, inquilinos }
}

/** Carrega fontes + recalcula todos os indicadores com o filtro atual. */
export async function obterPerformance(
  filtro: FiltroPerformance,
  opcoes: OpcoesFiltradas = {},
): Promise<DadosPerformance> {
  const fontes = await carregarFontesPerformance()
  return calcularPerformance(fontes, filtro, opcoes)
}
