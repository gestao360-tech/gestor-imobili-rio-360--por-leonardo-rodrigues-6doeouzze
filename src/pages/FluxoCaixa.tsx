import { useCallback, useEffect, useState } from 'react'
import {
  ArrowDownCircle,
  ArrowUpCircle,
  Scale,
  Layers,
  CalendarRange,
  RefreshCw,
  Wallet,
  PiggyBank,
  TrendingUp,
  TrendingDown,
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
import { FiltroPerformance, resolverJanela } from '@/features/performance/calculos'
import { carregarFontesPerformance } from '@/features/performance/dados'
import { DadosFluxoCaixa, calcularFluxoCaixa, corCategoria } from '@/features/performance/fluxo'
import { carregarPagamentos } from '@/features/performance/fluxo-dados'
import { GraficoFluxoMensal, GraficoComposicaoFluxo } from '@/features/performance/GraficosFluxo'

const MODOS: { valor: FiltroPerformance['modo']; rotulo: string }[] = [
  { valor: 'mes', rotulo: 'Mês atual' },
  { valor: '12m', rotulo: 'Últimos 12 meses' },
  { valor: 'custom', rotulo: 'Personalizado' },
]

export default function FluxoCaixaPage() {
  const [filtro, setFiltro] = useState<FiltroPerformance>({ modo: '12m' })
  const [imovelFiltro, setImovelFiltro] = useState('todos')
  const [inquilinoFiltro, setInquilinoFiltro] = useState('todos')
  const [dados, setDados] = useState<DadosFluxoCaixa | null>(null)
  const [imoveis, setImoveis] = useState<ImovelModel[]>([])
  const [inquilinos, setInquilinos] = useState<InquilinoModel[]>([])
  const [carregando, setCarregando] = useState(true)
  const [erro, setErro] = useState<string | null>(null)

  const carregar = useCallback(async () => {
    setCarregando(true)
    setErro(null)
    try {
      const [fontes, pagamentos] = await Promise.all([
        carregarFontesPerformance(),
        carregarPagamentos(),
      ])
      setImoveis(fontes.imoveis)
      setInquilinos(fontes.inquilinos)
      setDados(
        calcularFluxoCaixa(
          {
            cobrancas: fontes.cobrancas,
            despesas: fontes.despesas,
            pagamentos,
            imoveis: fontes.imoveis,
          },
          filtro,
          { imovel: imovelFiltro, inquilino: inquilinoFiltro },
        ),
      )
    } catch (e) {
      console.error('Erro ao calcular fluxo de caixa:', e)
      setErro('Não foi possível carregar a análise de fluxo de caixa.')
    } finally {
      setCarregando(false)
    }
  }, [filtro, imovelFiltro, inquilinoFiltro])

  useEffect(() => {
    carregar()
  }, [carregar])

  const rotuloJanela = dados?.janela.rotulo ?? resolverJanela(filtro).rotulo

  const semDados =
    !carregando && !erro && dados && dados.resumo.entradas === 0 && dados.resumo.saidas === 0

  const saldoPositivo = (dados?.resumo.saldo ?? 0) >= 0

  return (
    <div className="space-y-5 animate-fade-in-up max-w-[1400px] mx-auto">
      {/* Cabeçalho */}
      <div className="flex flex-col lg:flex-row lg:items-end lg:justify-between gap-3">
        <div>
          <div className="flex items-center gap-2">
            <h1 className="text-2xl font-extrabold tracking-tight text-foreground">
              Fluxo de <span className="text-gradient-brand">Caixa</span>
            </h1>
            <Badge className="bg-gradient-brand text-white border-transparent text-[10px] shadow-glow-brand/40">
              Caixa real
            </Badge>
          </div>
          <p className="text-xs text-muted-foreground mt-1">
            Somente valores efetivamente recebidos e pagos (pagamentos e despesas quitadas) —
            janela: <span className="font-semibold text-foreground">{rotuloJanela}</span>
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

      {/* Barra de filtros — mesma convenção da Performance */}
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
          <div className="grid grid-cols-2 md:grid-cols-3 xl:grid-cols-5 gap-3">
            {Array.from({ length: 5 }).map((_, i) => (
              <Skeleton key={i} className="h-[92px] rounded-2xl" />
            ))}
          </div>
          <div className="grid xl:grid-cols-3 gap-4">
            <Skeleton className="h-[400px] rounded-2xl xl:col-span-2" />
            <Skeleton className="h-[400px] rounded-2xl" />
            <Skeleton className="h-[320px] rounded-2xl xl:col-span-2" />
            <Skeleton className="h-[320px] rounded-2xl" />
          </div>
        </div>
      ) : semDados || !dados ? (
        <Card className="border-dashed">
          <CardContent className="py-14 text-center">
            <div className="w-14 h-14 mx-auto rounded-2xl bg-gradient-brand-soft flex items-center justify-center mb-4">
              <Wallet className="w-6 h-6 text-primary" />
            </div>
            <div className="text-base font-extrabold text-foreground">
              Sem movimentação de caixa neste escopo
            </div>
            <p className="text-xs text-muted-foreground mt-1.5 max-w-md mx-auto">
              Não há recebimentos registrados nem despesas pagas para o período e filtros
              selecionados. Ajuste o período (por exemplo, "Últimos 12 meses") ou registre
              pagamentos na aba Financeiro.
            </p>
          </CardContent>
        </Card>
      ) : (
        <div className="space-y-5">
          {/* KPIs do caixa */}
          <div className="grid grid-cols-2 md:grid-cols-3 xl:grid-cols-5 gap-3">
            <CartaoKpi
              acento="emerald"
              icone={<ArrowDownCircle className="w-4 h-4" />}
              rotulo="Entradas"
              valor={formatBRL(dados.resumo.entradas)}
              detalhe={`${dados.resumo.qtdPagamentos} recebimento${dados.resumo.qtdPagamentos === 1 ? '' : 's'} efetivo${dados.resumo.qtdPagamentos === 1 ? '' : 's'}`}
            />
            <CartaoKpi
              acento="rose"
              icone={<ArrowUpCircle className="w-4 h-4" />}
              rotulo="Saídas"
              valor={formatBRL(dados.resumo.saidas)}
              detalhe={`${dados.resumo.qtdDespesasPagas} despesa${dados.resumo.qtdDespesasPagas === 1 ? '' : 's'} paga${dados.resumo.qtdDespesasPagas === 1 ? '' : 's'}`}
            />
            <CartaoKpi
              acento={saldoPositivo ? 'brand' : 'rose'}
              icone={<Scale className="w-4 h-4" />}
              rotulo="Saldo do período"
              valor={formatBRL(dados.resumo.saldo)}
              detalhe={saldoPositivo ? 'Caixa positivo no período' : 'Caixa negativo no período'}
            />
            <CartaoKpi
              acento="violet"
              icone={<Layers className="w-4 h-4" />}
              rotulo="Saldo acumulado"
              valor={formatBRL(dados.resumo.acumulado)}
              detalhe={`${dados.resumo.mesesPositivos} mês${dados.resumo.mesesPositivos === 1 ? '' : 'es'} positivo${dados.resumo.mesesPositivos === 1 ? '' : 's'} · ${dados.resumo.mesesNegativos} negativo${dados.resumo.mesesNegativos === 1 ? '' : 's'}`}
            />
            <CartaoKpi
              acento="sky"
              icone={<PiggyBank className="w-4 h-4" />}
              rotulo="Ticket médio"
              valor={formatBRL(dados.resumo.ticketMedioEntrada)}
              detalhe={`Maior entrada: ${formatBRL(dados.resumo.maiorEntradaMensal)}`}
            />
          </div>

          {/* Evolução mensal + composição das saídas */}
          <div className="grid xl:grid-cols-3 gap-4">
            <Card className="xl:col-span-2 border-border/70 shadow-soft card-lift">
              <CardHeader className="pb-1">
                <CardTitle className="text-sm font-extrabold">Evolução mensal do caixa</CardTitle>
                <CardDescription className="text-[11px]">
                  Entradas × saídas por mês, saldo do mês e linha de saldo acumulado
                </CardDescription>
              </CardHeader>
              <CardContent>
                <GraficoFluxoMensal dados={dados.serie} />
              </CardContent>
            </Card>
            <Card className="border-border/70 shadow-soft card-lift">
              <CardHeader className="pb-1">
                <CardTitle className="text-sm font-extrabold">Composição das saídas</CardTitle>
                <CardDescription className="text-[11px]">
                  Despesas pagas por categoria no período
                </CardDescription>
              </CardHeader>
              <CardContent>
                <GraficoComposicaoFluxo dados={dados.saidasPorCategoria} />
                <div className="mt-3 space-y-1.5">
                  {dados.saidasPorCategoria.map((c, i) => (
                    <div key={c.chave} className="flex items-center gap-2 text-[11px]">
                      <span
                        className="w-2 h-2 rounded-full shrink-0"
                        style={{ background: corCategoria(i) }}
                      />
                      <span className="text-muted-foreground flex-1 truncate">{c.rotulo}</span>
                      <span className="font-bold text-foreground tabular-nums">
                        {formatBRL(c.valor)}
                      </span>
                      <span className="text-muted-foreground tabular-nums w-10 text-right">
                        {c.pct.toFixed(0)}%
                      </span>
                    </div>
                  ))}
                </div>
              </CardContent>
            </Card>
          </div>

          {/* Composição das entradas + tabela mês a mês */}
          <div className="grid xl:grid-cols-3 gap-4">
            <Card className="border-border/70 shadow-soft card-lift">
              <CardHeader className="pb-1">
                <CardTitle className="text-sm font-extrabold">Entradas por imóvel</CardTitle>
                <CardDescription className="text-[11px]">
                  Top recebedores — recebimentos efetivos no período
                </CardDescription>
              </CardHeader>
              <CardContent>
                {dados.entradasPorImovel.length === 0 ? (
                  <div className="py-12 text-center text-xs text-muted-foreground">
                    Nenhum recebimento no período selecionado.
                  </div>
                ) : (
                  <>
                    <GraficoComposicaoFluxo dados={dados.entradasPorImovel.slice(0, 8)} />
                    <div className="mt-3 space-y-1.5">
                      {dados.entradasPorImovel.slice(0, 8).map((c, i) => (
                        <div key={c.chave} className="flex items-center gap-2 text-[11px]">
                          <span
                            className="w-2 h-2 rounded-full shrink-0"
                            style={{ background: corCategoria(i) }}
                          />
                          <span className="text-muted-foreground flex-1 truncate">{c.rotulo}</span>
                          <span className="font-bold text-foreground tabular-nums">
                            {formatBRL(c.valor)}
                          </span>
                          <span className="text-muted-foreground tabular-nums w-10 text-right">
                            {c.pct.toFixed(0)}%
                          </span>
                        </div>
                      ))}
                    </div>
                  </>
                )}
              </CardContent>
            </Card>

            <Card className="xl:col-span-2 border-border/70 shadow-soft card-lift">
              <CardHeader className="pb-1">
                <CardTitle className="text-sm font-extrabold">Detalhamento mês a mês</CardTitle>
                <CardDescription className="text-[11px]">
                  Entradas, saídas, saldo e saldo acumulado por competência
                </CardDescription>
              </CardHeader>
              <CardContent>
                <div className="overflow-x-auto rounded-xl border border-border max-h-[360px] overflow-y-auto">
                  <table className="w-full text-xs">
                    <thead className="sticky top-0">
                      <tr className="bg-muted/80 text-muted-foreground backdrop-blur">
                        <th className="text-left font-semibold px-3 py-2.5">Mês</th>
                        <th className="text-right font-semibold px-3 py-2.5">Entradas</th>
                        <th className="text-right font-semibold px-3 py-2.5">Saídas</th>
                        <th className="text-right font-semibold px-3 py-2.5">Saldo</th>
                        <th className="text-right font-semibold px-3 py-2.5">Acumulado</th>
                      </tr>
                    </thead>
                    <tbody className="divide-y divide-border/70">
                      {dados.serie.map((l) => (
                        <tr key={l.competencia} className="hover:bg-accent/40 transition-colors">
                          <td className="px-3 py-2 font-semibold text-foreground">{l.rotulo}</td>
                          <td className="px-3 py-2 text-right tabular-nums text-emerald-600 dark:text-emerald-400">
                            {l.entradas > 0 ? formatBRL(l.entradas) : '—'}
                          </td>
                          <td className="px-3 py-2 text-right tabular-nums text-rose-600 dark:text-rose-400">
                            {l.saidas > 0 ? formatBRL(l.saidas) : '—'}
                          </td>
                          <td
                            className={`px-3 py-2 text-right tabular-nums font-bold flex items-center justify-end gap-1 ${
                              l.saldo > 0
                                ? 'text-emerald-600 dark:text-emerald-400'
                                : l.saldo < 0
                                  ? 'text-rose-600 dark:text-rose-400'
                                  : 'text-muted-foreground'
                            }`}
                          >
                            {l.saldo > 0 ? (
                              <TrendingUp className="w-3 h-3" />
                            ) : l.saldo < 0 ? (
                              <TrendingDown className="w-3 h-3" />
                            ) : null}
                            {formatBRL(l.saldo)}
                          </td>
                          <td className="px-3 py-2 text-right tabular-nums font-semibold text-foreground">
                            {formatBRL(l.acumulado)}
                          </td>
                        </tr>
                      ))}
                    </tbody>
                  </table>
                </div>
              </CardContent>
            </Card>
          </div>
        </div>
      )}
    </div>
  )
}
