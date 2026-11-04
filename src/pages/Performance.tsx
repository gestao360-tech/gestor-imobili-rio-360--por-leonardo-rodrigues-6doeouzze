import { useCallback, useEffect, useMemo, useState } from 'react'
import {
  Wallet,
  FileText,
  AlertCircle,
  Percent,
  Receipt,
  PiggyBank,
  CalendarRange,
  RefreshCw,
} from 'lucide-react'
import { Card, CardContent, CardHeader, CardTitle, CardDescription } from '@/components/ui/card'
import { Button } from '@/components/ui/button'
import { Input } from '@/components/ui/input'
import { Badge } from '@/components/ui/badge'
import { Skeleton } from '@/components/ui/skeleton'
import {
  Select,
  SelectContent,
  SelectItem,
  SelectTrigger,
  SelectValue,
} from '@/components/ui/select'
import CartaoKpi from '@/components/dashboard/CartaoKpi'
import { ImovelModel, InquilinoModel } from '@/types/database'
import { formatBRL } from '@/services/imobiliario'
import {
  DadosPerformance,
  FiltroPerformance,
  calcularPerformance,
  resolverJanela,
} from '@/features/performance/calculos'
import {
  obterPerformance,
  carregarFontesPerformance as obterFontesParaFiltros,
} from '@/features/performance/dados'
import {
  GraficoEvolucaoMensal,
  GraficoProjecao,
  GraficoFaturadoRecebido,
  GraficoRentabilidade,
} from '@/features/performance/Graficos'
import {
  TabelaRentabilidade,
  TabelaInadimplencia,
  BlocoOcupacao,
} from '@/features/performance/Tabelas'

const MODOS: { valor: FiltroPerformance['modo']; rotulo: string }[] = [
  { valor: 'mes', rotulo: 'Mês atual' },
  { valor: '12m', rotulo: 'Últimos 12 meses' },
  { valor: 'custom', rotulo: 'Personalizado' },
]

export default function PerformancePage() {
  const [filtro, setFiltro] = useState<FiltroPerformance>({ modo: '12m' })
  const [imovelFiltro, setImovelFiltro] = useState('todos')
  const [inquilinoFiltro, setInquilinoFiltro] = useState('todos')
  const [dados, setDados] = useState<DadosPerformance | null>(null)
  const [imoveis, setImoveis] = useState<ImovelModel[]>([])
  const [inquilinos, setInquilinos] = useState<InquilinoModel[]>([])
  const [carregando, setCarregando] = useState(true)
  const [erro, setErro] = useState<string | null>(null)

  const carregar = useCallback(async () => {
    setCarregando(true)
    setErro(null)
    try {
      const resultado = await obterPerformance(filtro, {
        imovel: imovelFiltro,
        inquilino: inquilinoFiltro,
      })
      setDados(resultado)
    } catch (e) {
      console.error('Erro ao calcular performance:', e)
      setErro('Não foi possível carregar os indicadores de performance.')
    } finally {
      setCarregando(false)
    }
  }, [filtro, imovelFiltro, inquilinoFiltro])

  useEffect(() => {
    carregar()
  }, [carregar])

  // Listas de referência para os filtros (imóveis e inquilinos do banco real)
  useEffect(() => {
    let ativo = true
    ;(async () => {
      try {
        const fontes = await obterFontesParaFiltros()
        if (!ativo) return
        setImoveis(fontes.imoveis)
        setInquilinos(fontes.inquilinos)
      } catch {
        /* filtros ficam vazios em caso de falha */
      }
    })()
    return () => {
      ativo = false
    }
  }, [])

  const rotuloJanela = dados?.janela.rotulo ?? resolverJanela(filtro).rotulo

  const semDados =
    !carregando &&
    !erro &&
    dados &&
    dados.serie.every((l) => l.faturado === 0 && l.recebido === 0 && l.despesas === 0)

  return (
    <div className="space-y-5 animate-fade-in-up max-w-[1400px] mx-auto">
      {/* Cabeçalho */}
      <div className="flex flex-col lg:flex-row lg:items-end lg:justify-between gap-3">
        <div>
          <div className="flex items-center gap-2">
            <h1 className="text-2xl font-extrabold tracking-tight text-foreground">
              Performance <span className="text-gradient-brand">Analítica</span>
            </h1>
            <Badge className="bg-gradient-brand text-white border-transparent text-[10px] shadow-glow-brand/40">
              Dados reais
            </Badge>
          </div>
          <p className="text-xs text-muted-foreground mt-1">
            Rentabilidade, inadimplência, ocupação e projeção calculados sobre o banco — janela:{' '}
            <span className="font-semibold text-foreground">{rotuloJanela}</span>
          </p>
        </div>
        <Button
          variant="outline"
          size="sm"
          onClick={carregar}
          className="h-9 rounded-full text-xs gap-1.5"
        >
          <RefreshCw className={`w-3.5 h-3.5 ${carregando ? 'animate-spin' : ''}`} />
          Atualizar
        </Button>
      </div>

      {/* Barra de filtros */}
      <Card className="border-border/70 shadow-soft">
        <CardContent className="p-3.5 flex flex-col md:flex-row md:items-end gap-3">
          <div className="flex items-center gap-1.5 flex-wrap">
            <span className="text-[10px] font-extrabold uppercase tracking-wider text-muted-foreground mr-1 flex items-center gap-1">
              <CalendarRange className="w-3.5 h-3.5" /> Período
            </span>
            {MODOS.map((m) => (
              <button
                key={m.valor}
                onClick={() => setFiltro((f) => ({ modo: m.valor, inicio: f.inicio, fim: f.fim }))}
                className={`px-3 py-1.5 rounded-full text-[11px] font-bold transition-all ${
                  filtro.modo === m.valor
                    ? 'bg-gradient-brand text-white shadow-glow-brand/50'
                    : 'bg-muted text-muted-foreground hover:text-foreground hover:bg-accent'
                }`}
              >
                {m.rotulo}
              </button>
            ))}
          </div>

          {filtro.modo === 'custom' && (
            <div className="flex items-center gap-2">
              <Input
                type="date"
                value={filtro.inicio ?? ''}
                onChange={(e) => setFiltro((f) => ({ ...f, inicio: e.target.value }))}
                className="h-8 text-xs w-36 bg-muted/60"
              />
              <span className="text-xs text-muted-foreground">até</span>
              <Input
                type="date"
                value={filtro.fim ?? ''}
                onChange={(e) => setFiltro((f) => ({ ...f, fim: e.target.value }))}
                className="h-8 text-xs w-36 bg-muted/60"
              />
            </div>
          )}

          <div className="md:ml-auto flex items-center gap-2">
            <Select value={imovelFiltro} onValueChange={setImovelFiltro}>
              <SelectTrigger className="h-8 text-xs w-[170px] rounded-full bg-muted/60">
                <SelectValue placeholder="Imóvel" />
              </SelectTrigger>
              <SelectContent>
                <SelectItem value="todos">Todos os imóveis</SelectItem>
                {imoveis.map((i) => (
                  <SelectItem key={i.id} value={i.id}>
                    {i.codigo} · {i.nome}
                  </SelectItem>
                ))}
              </SelectContent>
            </Select>
            <Select value={inquilinoFiltro} onValueChange={setInquilinoFiltro}>
              <SelectTrigger className="h-8 text-xs w-[170px] rounded-full bg-muted/60">
                <SelectValue placeholder="Inquilino" />
              </SelectTrigger>
              <SelectContent>
                <SelectItem value="todos">Todos os inquilinos</SelectItem>
                {inquilinos.map((i) => (
                  <SelectItem key={i.id} value={i.id}>
                    {i.nome}
                  </SelectItem>
                ))}
              </SelectContent>
            </Select>
          </div>
        </CardContent>
      </Card>

      {erro && (
        <Card className="border-rose-300/60 bg-gradient-rose-soft">
          <CardContent className="p-4 text-sm text-rose-700 dark:text-rose-300 font-medium">
            {erro} Verifique a conexão e tente novamente.
          </CardContent>
        </Card>
      )}

      {/* Corpo */}
      {carregando ? (
        <div className="space-y-5">
          <div className="grid grid-cols-2 md:grid-cols-3 xl:grid-cols-6 gap-3">
            {Array.from({ length: 6 }).map((_, i) => (
              <Skeleton key={i} className="h-[92px] rounded-2xl" />
            ))}
          </div>
          <div className="grid xl:grid-cols-3 gap-4">
            <Skeleton className="h-[380px] rounded-2xl xl:col-span-2" />
            <Skeleton className="h-[380px] rounded-2xl" />
            <Skeleton className="h-[300px] rounded-2xl xl:col-span-2" />
            <Skeleton className="h-[300px] rounded-2xl" />
          </div>
        </div>
      ) : semDados || !dados ? (
        <Card className="border-dashed">
          <CardContent className="py-14 text-center">
            <div className="w-14 h-14 mx-auto rounded-2xl bg-gradient-brand-soft flex items-center justify-center mb-4">
              <FileText className="w-6 h-6 text-primary" />
            </div>
            <div className="text-base font-extrabold text-foreground">
              Sem movimentação financeira neste escopo
            </div>
            <p className="text-xs text-muted-foreground mt-1.5 max-w-md mx-auto">
              Não há cobranças, recebimentos ou despesas registrados para o período e filtros
              selecionados. Ajuste o período (por exemplo, "Últimos 12 meses") ou registre cobranças
              na aba Financeiro.
            </p>
          </CardContent>
        </Card>
      ) : (
        <div className="space-y-5">
          {/* KPIs */}
          <div className="grid grid-cols-2 md:grid-cols-3 xl:grid-cols-6 gap-3">
            <CartaoKpi
              acento="emerald"
              icone={<Wallet className="w-4 h-4" />}
              rotulo="Recebido"
              valor={formatBRL(dados.resumo.recebido)}
              detalhe={`${dados.resumo.eficiencia.toFixed(1)}% do faturado`}
            />
            <CartaoKpi
              acento="brand"
              icone={<FileText className="w-4 h-4" />}
              rotulo="Faturado"
              valor={formatBRL(dados.resumo.faturado)}
              detalhe={`${dados.contratosAtivos} contratos ativos`}
            />
            <CartaoKpi
              acento="sky"
              icone={<Receipt className="w-4 h-4" />}
              rotulo="Em aberto"
              valor={formatBRL(dados.resumo.emAberto)}
              detalhe="Faturado ainda não recebido"
            />
            <CartaoKpi
              acento="rose"
              icone={<AlertCircle className="w-4 h-4" />}
              rotulo="Inadimplência"
              valor={formatBRL(dados.resumo.inadimplencia)}
              detalhe={`${dados.resumo.pctInadimplencia.toFixed(1)}% do faturado`}
            />
            <CartaoKpi
              acento="amber"
              icone={<Percent className="w-4 h-4" />}
              rotulo="Despesas"
              valor={formatBRL(dados.resumo.despesas)}
              detalhe={`Pagas: ${formatBRL(dados.resumo.despesasPagas)}`}
            />
            <CartaoKpi
              acento="gold"
              icone={<PiggyBank className="w-4 h-4" />}
              rotulo="Resultado"
              valor={formatBRL(dados.resumo.resultado)}
              detalhe={`Margem: ${dados.resumo.margem.toFixed(1)}%`}
            />
          </div>

          {/* Evolução mensal + Ocupação */}
          <div className="grid xl:grid-cols-3 gap-4">
            <Card className="xl:col-span-2 border-border/70 shadow-soft card-lift">
              <CardHeader className="pb-1">
                <CardTitle className="text-sm font-extrabold">Evolução mensal</CardTitle>
                <CardDescription className="text-[11px]">
                  Recebimentos, faturamento, despesas e inadimplência mês a mês
                </CardDescription>
              </CardHeader>
              <CardContent>
                <GraficoEvolucaoMensal dados={dados.serie} />
              </CardContent>
            </Card>
            <Card className="border-border/70 shadow-soft card-lift">
              <CardHeader className="pb-1">
                <CardTitle className="text-sm font-extrabold">Ocupação e carteira</CardTitle>
                <CardDescription className="text-[11px]">
                  Distribuição por situação e por tipo de imóvel
                </CardDescription>
              </CardHeader>
              <CardContent>
                <BlocoOcupacao
                  taxaOcupacao={dados.resumo.taxaOcupacao}
                  alugados={dados.resumo.alugados}
                  total={dados.resumo.totalImoveis}
                  porSituacao={dados.ocupacaoPorSituacao}
                  porTipo={dados.ocupacaoPorTipo}
                />
              </CardContent>
            </Card>
          </div>

          {/* Rentabilidade + Inadimplência por inquilino */}
          <div className="grid xl:grid-cols-3 gap-4">
            <Card className="xl:col-span-2 border-border/70 shadow-soft card-lift">
              <CardHeader className="pb-1">
                <CardTitle className="text-sm font-extrabold">Rentabilidade por imóvel</CardTitle>
                <CardDescription className="text-[11px]">
                  Ranking interativo — clique nos títulos para ordenar
                </CardDescription>
              </CardHeader>
              <CardContent className="space-y-4">
                <TabelaRentabilidade dados={dados.ranking} />
                <div>
                  <div className="text-[10px] font-extrabold uppercase tracking-wider text-muted-foreground mb-1.5">
                    Resultado líquido por imóvel
                  </div>
                  <GraficoRentabilidade dados={dados.ranking} />
                </div>
              </CardContent>
            </Card>
            <Card className="border-border/70 shadow-soft card-lift">
              <CardHeader className="pb-1">
                <CardTitle className="text-sm font-extrabold">
                  Inadimplência por inquilino
                </CardTitle>
                <CardDescription className="text-[11px]">
                  Valores vencidos em aberto, dias de atraso e competências
                </CardDescription>
              </CardHeader>
              <CardContent>
                <TabelaInadimplencia dados={dados.inadimplencia} />
              </CardContent>
            </Card>
          </div>

          {/* Comparativo + Projeção */}
          <div className="grid xl:grid-cols-3 gap-4">
            <Card className="border-border/70 shadow-soft card-lift">
              <CardHeader className="pb-1">
                <CardTitle className="text-sm font-extrabold">Faturado × Recebido</CardTitle>
                <CardDescription className="text-[11px]">
                  O que foi cobrado versus o que entrou no caixa
                </CardDescription>
              </CardHeader>
              <CardContent>
                <GraficoFaturadoRecebido dados={dados.serie} />
              </CardContent>
            </Card>
            <Card className="xl:col-span-2 border-border/70 shadow-soft card-lift">
              <CardHeader className="pb-1">
                <div className="flex items-center justify-between gap-2">
                  <div>
                    <CardTitle className="text-sm font-extrabold">
                      Projeção · próximos 12 meses
                    </CardTitle>
                    <CardDescription className="text-[11px]">
                      Receita contratada dos contratos ativos, com reajustes aprovados aplicados
                    </CardDescription>
                  </div>
                  <Badge
                    variant="outline"
                    className="text-[10px] border-primary/40 text-primary dark:text-orange-300 bg-primary/5"
                  >
                    Projeção
                  </Badge>
                </div>
              </CardHeader>
              <CardContent>
                <GraficoProjecao dados={dados.projecao} />
              </CardContent>
            </Card>
          </div>
        </div>
      )}
    </div>
  )
}
