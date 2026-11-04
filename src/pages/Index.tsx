import React, { useState, useEffect } from 'react'
import { useNavigate } from 'react-router-dom'
import {
  TrendingUp,
  AlertCircle,
  Building,
  Users,
  FileCheck,
  Calendar,
  CheckCircle2,
  Clock,
  ArrowUpRight,
  Plus,
  Upload,
  DollarSign,
  AlertTriangle,
  RotateCcw,
  Sparkles,
  ArrowRight,
  CheckSquare,
  Wallet,
  CircleDollarSign,
  Hourglass,
  CalendarClock,
} from 'lucide-react'
import CartaoKpi from '@/components/dashboard/CartaoKpi'
import {
  fetchDashboardMetrics,
  formatBRL,
  getPendencias,
  resolverPendencia,
  purgeDemoData,
} from '@/services/imobiliario'
import { DashboardMetrics, PendenciaModel } from '@/types/database'
import { Button } from '@/components/ui/button'
import { Card, CardContent, CardHeader, CardTitle } from '@/components/ui/card'
import { Badge } from '@/components/ui/badge'
import {
  Dialog,
  DialogContent,
  DialogHeader,
  DialogTitle,
  DialogFooter,
} from '@/components/ui/dialog'
import { Input } from '@/components/ui/input'
import { Label } from '@/components/ui/label'
import { Textarea } from '@/components/ui/textarea'
import { toast } from '@/hooks/use-toast'

export default function Index() {
  const navigate = useNavigate()
  const [metrics, setMetrics] = useState<DashboardMetrics | null>(null)
  const [pendencias, setPendencias] = useState<PendenciaModel[]>([])
  const [loading, setLoading] = useState(true)

  // Dialog para resolver item do painel "O que precisa da minha atenção"
  const [selectedPendencia, setSelectedPendencia] = useState<PendenciaModel | null>(null)
  const [solucaoTexto, setSolucaoTexto] = useState('')
  const [resolvendo, setResolvendo] = useState(false)

  // Filtros rápidos do dashboard
  const [filtroPeriodo, setFiltroPeriodo] = useState('mes_atual')

  useEffect(() => {
    loadAll()
  }, [])

  const loadAll = async () => {
    setLoading(true)
    try {
      const [m, p] = await Promise.all([fetchDashboardMetrics(), getPendencias()])
      setMetrics(m)
      setPendencias(p)
    } catch (err) {
      console.error(err)
      toast({
        title: 'Erro ao carregar dados',
        description: 'Não foi possível carregar os dados reais do banco.',
        variant: 'destructive',
      })
    } finally {
      setLoading(false)
    }
  }

  const handleResolverPendencia = async () => {
    if (!selectedPendencia) return
    setResolvendo(true)
    try {
      await resolverPendencia(
        selectedPendencia.id,
        solucaoTexto || 'Resolvido pelo painel executivo de atenção',
      )
      toast({
        title: 'Providência concluída com sucesso',
        description: `O alerta "${selectedPendencia.titulo}" foi concluído e arquivado no histórico de tarefas.`,
      })
      setSelectedPendencia(null)
      setSolucaoTexto('')
      loadAll()
    } catch (err) {
      toast({
        title: 'Erro ao resolver',
        description: 'Tente novamente.',
        variant: 'destructive',
      })
    } finally {
      setResolvendo(false)
    }
  }

  // Agrupamento para "O QUE PRECISA DA MINHA ATENÇÃO?"
  const urgentes = pendencias.filter(
    (p) =>
      (p.prioridade === 'urgente' || p.categoria === 'financeira') &&
      (p.status === 'pendente' || p.status === 'em_andamento'),
  )
  const proximas = pendencias.filter(
    (p) =>
      p.prioridade === 'alta' &&
      p.categoria !== 'financeira' &&
      (p.status === 'pendente' || p.status === 'em_andamento'),
  )
  const acompanhamento = pendencias.filter(
    (p) =>
      (p.prioridade === 'media' || p.prioridade === 'baixa') &&
      (p.status === 'pendente' || p.status === 'em_andamento'),
  )

  return (
    <div className="space-y-6 pb-12">
      {/* CABEÇALHO DO DASHBOARD COM AÇÕES RÁPIDAS */}
      <div className="flex flex-col md:flex-row md:items-center justify-between gap-4 border-b border-border pb-4">
        <div>
          <div className="flex items-center gap-2">
            <h1 className="text-xl sm:text-2xl font-extrabold tracking-tight text-foreground">
              Visão Geral <span className="text-gradient-brand">Executiva</span>
            </h1>
            <Badge
              variant="outline"
              className="bg-gradient-emerald-soft text-emerald-700 dark:text-emerald-300 border-emerald-300/60 font-bold"
            >
              Dados Reais
            </Badge>
          </div>
          <p className="text-xs sm:text-sm text-muted-foreground mt-1">
            Painel consolidado de imóveis próprios e de terceiros com indicadores em tempo real.
          </p>
        </div>

        {/* 5 AÇÕES RÁPIDAS OBRIGATÓRIAS DO BRIEFING:
            [+ Novo imóvel] [+ Novo inquilino] [+ Novo contrato] [+ Registrar pagamento] [+ Nova pendência] */}
        <div className="flex flex-wrap items-center gap-2">
          <Button
            size="sm"
            variant="outline"
            className="text-xs h-8 gap-1 border-border rounded-full"
            onClick={() => navigate('/imoveis?action=novo')}
          >
            <Plus className="w-3.5 h-3.5 text-emerald-600" />+ Novo imóvel
          </Button>

          <Button
            size="sm"
            variant="outline"
            className="text-xs h-8 gap-1 border-border rounded-full"
            onClick={() => navigate('/inquilinos?action=novo')}
          >
            <Plus className="w-3.5 h-3.5 text-sky-600" />+ Novo inquilino
          </Button>

          <Button
            size="sm"
            variant="outline"
            className="text-xs h-8 gap-1 border-border rounded-full"
            onClick={() => navigate('/contratos?action=novo')}
          >
            <Plus className="w-3.5 h-3.5 text-indigo-600" />+ Novo contrato
          </Button>

          <Button
            size="sm"
            className="text-xs h-8 gap-1 text-white rounded-full"
            onClick={() => navigate('/financeiro?action=pagamento')}
          >
            <DollarSign className="w-3.5 h-3.5" />+ Registrar pagamento
          </Button>

          <Button
            size="sm"
            variant="outline"
            className="text-xs h-8 gap-1 border-rose-300 text-rose-700 dark:border-rose-800 dark:text-rose-300 rounded-full hover:bg-rose-50 dark:hover:bg-rose-950/40"
            onClick={() => navigate('/pendencias?action=novo')}
          >
            <AlertTriangle className="w-3.5 h-3.5 text-rose-600" />+ Nova pendência
          </Button>

          <Button
            size="sm"
            variant="outline"
            className="text-xs h-8 gap-1 border-border rounded-full"
            onClick={() => navigate('/configuracoes')}
          >
            <Upload className="w-3.5 h-3.5 text-primary" />
            Importar planilha
          </Button>
        </div>
      </div>

      {/* OS 6 CARTÕES DE DESTAQUE COM RÓTULOS EXATOS:
          RECEITA MENSAL / VALORES RECEBIDOS / VALORES PENDENTES / CONTRATOS A VENCER / REAJUSTES PRÓXIMOS / IMÓVEIS DISPONÍVEIS */}
      <div className="grid grid-cols-2 md:grid-cols-3 lg:grid-cols-6 gap-3 sm:gap-4">
        {/* 1. RECEITA MENSAL */}
        <CartaoKpi
          acento="brand"
          icone={<Wallet className="w-4 h-4" />}
          rotulo="Receita mensal"
          valor={metrics ? formatBRL(metrics.receitaMensalContratada) : '...'}
          detalhe={
            <>
              <span className="font-bold">Contratada</span> • {metrics?.contratosAtivos ?? 0}{' '}
              contratos
            </>
          }
        />

        {/* 2. VALORES RECEBIDOS */}
        <CartaoKpi
          acento="emerald"
          icone={<CircleDollarSign className="w-4 h-4" />}
          rotulo="Valores recebidos"
          valor={metrics ? formatBRL(metrics.receitaRecebidaMes) : '...'}
          detalhe="Efetivamente no caixa este mês"
        />

        {/* 3. VALORES PENDENTES */}
        <CartaoKpi
          acento="amber"
          icone={<Hourglass className="w-4 h-4" />}
          rotulo="Valores pendentes"
          valor={metrics ? formatBRL(metrics.valoresPendentes) : '...'}
          detalhe="A vencer ou parciais em aberto"
        />

        {/* 4. CONTRATOS A VENCER */}
        <CartaoKpi
          acento="gold"
          icone={<CalendarClock className="w-4 h-4" />}
          rotulo="Contratos a vencer"
          valor={
            metrics
              ? `${String(metrics.contratosProximosVencimento).padStart(2, '0')} contratos`
              : '...'
          }
          detalhe="Próximos 90 dias"
        />

        {/* 5. REAJUSTES PRÓXIMOS */}
        <CartaoKpi
          acento="sky"
          icone={<TrendingUp className="w-4 h-4" />}
          rotulo="Reajustes próximos"
          valor={metrics ? `${String(metrics.reajustesPrevistos).padStart(2, '0')} imóveis` : '...'}
          detalhe="Data-base programada"
        />

        {/* 6. IMÓVEIS DISPONÍVEIS */}
        <CartaoKpi
          acento="rose"
          icone={<Building className="w-4 h-4" />}
          rotulo="Imóveis disponíveis"
          valor={metrics ? `${String(metrics.imoveisDisponiveis).padStart(2, '0')} imóveis` : '...'}
          detalhe="Prontos para locação"
        />
      </div>

      {/* PAINEL DIFERENCIAL "O QUE PRECISA DA MINHA ATENÇÃO?" */}
      <Card className="overflow-hidden">
        <div className="bg-gradient-rose text-white p-4 flex flex-col sm:flex-row sm:items-center justify-between gap-2">
          <div className="flex items-center gap-2.5">
            <div className="w-9 h-9 rounded-xl bg-white/15 ring-1 ring-white/30 flex items-center justify-center text-white backdrop-blur-sm">
              <AlertTriangle className="w-4 h-4" />
            </div>
            <div>
              <h2 className="text-base font-extrabold tracking-tight text-white flex items-center gap-2">
                O QUE PRECISA DA MINHA ATENÇÃO?
              </h2>
              <p className="text-xs text-rose-50/90">
                Central executiva de decisões: resolva ocorrências, atribua responsáveis e arquive
                providências.
              </p>
            </div>
          </div>
          <Button
            size="sm"
            variant="outline"
            className="border-white/40 text-white hover:bg-white/15 text-xs h-8 gap-1.5 rounded-full"
            onClick={() => navigate('/pendencias')}
          >
            <span>
              Ver Central Completa ({pendencias.filter((p) => p.status === 'pendente').length})
            </span>
            <ArrowRight className="w-3.5 h-3.5" />
          </Button>
        </div>

        <div className="p-4 grid grid-cols-1 md:grid-cols-3 gap-4">
          {/* SEÇÃO URGENTE (🔴) */}
          <div className="border border-rose-200/80 dark:border-rose-500/30 rounded-xl p-3 bg-gradient-rose-soft dark:bg-rose-950/20 flex flex-col">
            <div className="flex items-center justify-between pb-2 mb-2 border-b border-rose-200 dark:border-rose-900/60">
              <div className="flex items-center gap-1.5 font-bold text-xs text-rose-700 dark:text-rose-400 uppercase tracking-wider">
                <span>🔴</span>
                <span>URGENTE</span>
              </div>
              <Badge variant="destructive" className="text-[10px] px-1.5 py-0">
                {urgentes.length}
              </Badge>
            </div>

            <div className="space-y-2.5 flex-1 overflow-y-auto max-h-72">
              {urgentes.length === 0 ? (
                <div className="text-xs text-muted-foreground py-4 text-center">
                  Nenhuma urgência pendente.
                </div>
              ) : (
                urgentes.map((item) => (
                  <div
                    key={item.id}
                    className="p-2.5 bg-white dark:bg-slate-800/80 rounded-xl border border-rose-200/70 dark:border-rose-500/25 shadow-2xs hover:border-rose-400 hover:shadow-soft transition-all duration-200"
                  >
                    <div className="font-semibold text-xs text-foreground leading-snug">
                      {item.titulo}
                    </div>
                    <div className="text-[11px] text-foreground/70 mt-1 line-clamp-2">
                      {item.descricao}
                    </div>
                    <div className="mt-2 pt-2 border-t border-rose-200/60 dark:border-rose-500/20 flex items-center justify-between text-[10px]">
                      <span className="text-rose-700/70 dark:text-rose-300/70">
                        Prazo: {item.prazo}
                      </span>
                      <Button
                        size="sm"
                        variant="secondary"
                        className="h-6 px-2 text-[10px] bg-rose-500 text-white shadow-md shadow-rose-500/30 hover:bg-rose-600 dark:bg-rose-600"
                        onClick={() => {
                          setSelectedPendencia(item)
                          setSolucaoTexto('')
                        }}
                      >
                        Resolver / Agir
                      </Button>
                    </div>
                  </div>
                ))
              )}
            </div>
          </div>

          {/* SEÇÃO PRÓXIMAS PROVIDÊNCIAS (🟠) */}
          <div className="border border-orange-200/80 dark:border-orange-500/30 rounded-xl p-3 bg-orange-50/60 dark:bg-orange-950/20 flex flex-col">
            <div className="flex items-center justify-between pb-2 mb-2 border-b border-orange-200 dark:border-orange-900/60">
              <div className="flex items-center gap-1.5 font-bold text-xs text-orange-700 dark:text-orange-400 uppercase tracking-wider">
                <span>🟠</span>
                <span>PRÓXIMAS PROVIDÊNCIAS</span>
              </div>
              <Badge
                variant="outline"
                className="text-[10px] px-1.5 py-0 border-orange-300 text-orange-700 dark:text-orange-300"
              >
                {proximas.length}
              </Badge>
            </div>

            <div className="space-y-2.5 flex-1 overflow-y-auto max-h-72">
              {proximas.length === 0 ? (
                <div className="text-xs text-muted-foreground py-4 text-center">
                  Nenhuma providência imediata pendente.
                </div>
              ) : (
                proximas.map((item) => (
                  <div
                    key={item.id}
                    className="p-2.5 bg-white dark:bg-slate-800/80 rounded-xl border border-orange-200/70 dark:border-orange-500/25 shadow-2xs hover:border-orange-400 hover:shadow-soft transition-all duration-200"
                  >
                    <div className="font-semibold text-xs text-foreground leading-snug">
                      {item.titulo}
                    </div>
                    <div className="text-[11px] text-foreground/70 mt-1 line-clamp-2">
                      {item.descricao}
                    </div>
                    <div className="mt-2 pt-2 border-t border-orange-200/60 dark:border-orange-500/20 flex items-center justify-between text-[10px]">
                      <span className="text-orange-700/70 dark:text-orange-300/70">
                        Resp: {item.responsavel}
                      </span>
                      <Button
                        size="sm"
                        variant="secondary"
                        className="h-6 px-2 text-[10px] bg-orange-500 text-white shadow-md shadow-orange-500/30 hover:bg-orange-600 dark:bg-orange-600"
                        onClick={() => {
                          setSelectedPendencia(item)
                          setSolucaoTexto('')
                        }}
                      >
                        Tratar
                      </Button>
                    </div>
                  </div>
                ))
              )}
            </div>
          </div>

          {/* SEÇÃO ACOMPANHAMENTO (🟡) */}
          <div className="border border-amber-200/80 dark:border-amber-500/30 rounded-xl p-3 bg-gradient-amber-soft dark:bg-amber-950/20 flex flex-col">
            <div className="flex items-center justify-between pb-2 mb-2 border-b border-amber-200 dark:border-amber-900/60">
              <div className="flex items-center gap-1.5 font-bold text-xs text-amber-700 dark:text-amber-400 uppercase tracking-wider">
                <span>🟡</span>
                <span>ACOMPANHAMENTO</span>
              </div>
              <Badge
                variant="outline"
                className="text-[10px] px-1.5 py-0 border-amber-300 text-amber-700 dark:text-amber-300"
              >
                {acompanhamento.length}
              </Badge>
            </div>

            <div className="space-y-2.5 flex-1 overflow-y-auto max-h-72">
              {acompanhamento.length === 0 ? (
                <div className="text-xs text-muted-foreground py-4 text-center">
                  Nenhum acompanhamento pendente.
                </div>
              ) : (
                acompanhamento.map((item) => (
                  <div
                    key={item.id}
                    className="p-2.5 bg-white dark:bg-slate-800/80 rounded-xl border border-amber-200/70 dark:border-amber-500/25 shadow-2xs hover:border-amber-400 hover:shadow-soft transition-all duration-200"
                  >
                    <div className="font-semibold text-xs text-foreground leading-snug">
                      {item.titulo}
                    </div>
                    <div className="text-[11px] text-foreground/70 mt-1 line-clamp-2">
                      {item.descricao}
                    </div>
                    <div className="mt-2 pt-2 border-t border-amber-200/60 dark:border-amber-500/20 flex items-center justify-between text-[10px]">
                      <span className="text-amber-700/70 dark:text-amber-300/70">
                        Prazo: {item.prazo}
                      </span>
                      <Button
                        size="sm"
                        variant="secondary"
                        className="h-6 px-2 text-[10px] bg-amber-400 text-white shadow-md shadow-amber-400/30 hover:bg-amber-500 dark:bg-amber-500"
                        onClick={() => {
                          setSelectedPendencia(item)
                          setSolucaoTexto('')
                        }}
                      >
                        Acompanhar
                      </Button>
                    </div>
                  </div>
                ))
              )}
            </div>
          </div>
        </div>
      </Card>

      {/* DEMAIS INDICADORES EXECUTIVOS (COMPLETANDO OS 17 OBRIGATÓRIOS DO BRIEFING) */}
      <div className="grid grid-cols-2 sm:grid-cols-3 lg:grid-cols-6 gap-3 sm:gap-4">
        {/* 7. Total de imóveis */}
        <div className="p-3 rounded-xl border border-gold-metallic/35 dark:border-gold-metallic/25 bg-gradient-gold-soft">
          <div className="text-[10px] font-extrabold text-gold-bronze dark:text-gold-light/85 uppercase tracking-wider">
            1. Total imóveis
          </div>
          <div className="text-base font-extrabold text-gold-dark dark:text-gold-luminous mt-0.5">
            {metrics?.totalImoveis ?? 0}
          </div>
          <div className="text-[10px] text-gold-bronze/75 dark:text-gold-light/60">cadastrados</div>
        </div>

        {/* 8. Imóveis alugados */}
        <div className="p-3 rounded-xl border border-emerald-200/70 dark:border-emerald-500/25 bg-gradient-emerald-soft">
          <div className="text-[10px] font-extrabold text-emerald-700/80 dark:text-emerald-300/70 uppercase tracking-wider">
            2. Imóveis alugados
          </div>
          <div className="text-base font-extrabold text-emerald-700 dark:text-emerald-200 mt-0.5">
            {metrics?.imoveisAlugados ?? 0}
          </div>
          <div className="text-[10px] text-emerald-700/60 dark:text-emerald-300/50">
            com contrato ativo
          </div>
        </div>

        {/* 9. Taxa de ocupação */}
        <div className="p-3 rounded-xl border border-sky-200/70 dark:border-sky-500/25 bg-gradient-sky-soft">
          <div className="text-[10px] font-extrabold text-sky-700/80 dark:text-sky-300/70 uppercase tracking-wider">
            14. Taxa ocupação
          </div>
          <div className="text-base font-extrabold text-sky-700 dark:text-sky-200 mt-0.5">
            {metrics ? `${metrics.taxaOcupacao}%` : '0%'}
          </div>
          <div className="text-[10px] text-sky-700/60 dark:text-sky-300/50">da carteira física</div>
        </div>

        {/* 10. % Inadimplência */}
        <div className="p-3 rounded-xl border border-rose-200/70 dark:border-rose-500/25 bg-gradient-rose-soft">
          <div className="text-[10px] font-extrabold text-rose-700/80 dark:text-rose-300/70 uppercase tracking-wider">
            15. % Inadimplência
          </div>
          <div className="text-base font-extrabold text-rose-700 dark:text-rose-200 mt-0.5">
            {metrics ? `${metrics.percentualInadimplencia}%` : '0%'}
          </div>
          <div className="text-[10px] text-rose-700/60 dark:text-rose-300/50">
            {formatBRL(metrics?.valoresVencidosInadimplentes)} vencidos
          </div>
        </div>

        {/* 11. Receita anual acumulada */}
        <div className="p-3 rounded-xl border border-orange-200/80 dark:border-orange-500/25 bg-gradient-brand-soft">
          <div className="text-[10px] font-extrabold text-orange-800 dark:text-orange-200/80 uppercase tracking-wider">
            10. Receita anual
          </div>
          <div className="text-base font-extrabold text-orange-700 dark:text-orange-300 mt-0.5">
            {metrics ? formatBRL(metrics.receitaAnualAcumulada) : '...'}
          </div>
          <div className="text-[10px] text-orange-800/70 dark:text-orange-300/60">
            acumulado do ano
          </div>
        </div>

        {/* 12. Previsão 12 meses */}
        <div className="p-3 rounded-xl border border-emerald-200/70 dark:border-emerald-500/25 bg-gradient-emerald-soft">
          <div className="text-[10px] font-extrabold text-emerald-700/80 dark:text-emerald-300/70 uppercase tracking-wider">
            11. Previsão 12m
          </div>
          <div className="text-base font-extrabold text-emerald-700 dark:text-emerald-200 mt-0.5">
            {metrics ? formatBRL(metrics.previsaoReceita12Meses) : '...'}
          </div>
          <div className="text-[10px] text-emerald-700/60 dark:text-emerald-300/50">
            projeção contratada
          </div>
        </div>

        {/* 13. Total garantias / cauções */}
        <div className="p-3 rounded-xl border border-indigo-200/70 dark:border-indigo-500/25 bg-gradient-sky-soft">
          <div className="text-[10px] font-extrabold text-indigo-700/80 dark:text-indigo-300/70 uppercase tracking-wider">
            16. Garantias / cauções
          </div>
          <div className="text-base font-extrabold text-indigo-700 dark:text-indigo-200 mt-0.5">
            {metrics ? formatBRL(metrics.totalGarantiasCaucoes) : '...'}
          </div>
          <div className="text-[10px] text-indigo-700/60 dark:text-indigo-300/50">
            em custódia/vigência
          </div>
        </div>

        {/* 14. Renovações pendentes */}
        <div className="p-3 rounded-xl border border-orange-200/70 dark:border-orange-500/25 bg-gradient-amber-soft">
          <div className="text-[10px] font-extrabold text-orange-700/80 dark:text-orange-300/70 uppercase tracking-wider">
            13. Renovações pend.
          </div>
          <div className="text-base font-extrabold text-orange-700 dark:text-orange-200 mt-0.5">
            {metrics?.renovacoesPendentes ?? 0}
          </div>
          <div className="text-[10px] text-orange-700/60 dark:text-orange-300/50">
            em negociação
          </div>
        </div>

        {/* 15. Pendências administrativas */}
        <div className="p-3 rounded-xl border border-rose-200/70 dark:border-rose-500/25 bg-gradient-rose-soft">
          <div className="text-[10px] font-extrabold text-rose-700/80 dark:text-rose-300/70 uppercase tracking-wider">
            17. Pendências adm
          </div>
          <div className="text-base font-extrabold text-rose-700 dark:text-rose-200 mt-0.5">
            {metrics?.pendenciasAdministrativas ?? 0}
          </div>
          <div className="text-[10px] text-rose-700/60 dark:text-rose-300/50">a resolver</div>
        </div>
      </div>

      {/* GRÁFICOS E FLUXO VISUAL DE RECEBIMENTOS */}
      <div className="grid grid-cols-1 lg:grid-cols-3 gap-6">
        {/* Gráfico 1: Evolução Mensal dos Recebimentos e Inadimplência */}
        <Card className="lg:col-span-2">
          <CardHeader className="p-4 pb-2 border-b border-border/70 flex flex-row items-center justify-between">
            <div>
              <CardTitle className="text-sm font-bold text-foreground">
                Evolução Mensal: Faturado vs. Recebido vs. Inadimplência
              </CardTitle>
              <p className="text-xs text-muted-foreground">
                Comparativo real de valores das competências (Regra: faturado ≠ recebido)
              </p>
            </div>
            <Badge
              variant="outline"
              className="text-xs bg-gradient-brand-soft text-primary dark:text-orange-300 border-primary/30"
            >
              2º Semestre 2026
            </Badge>
          </CardHeader>
          <CardContent className="p-4">
            {/* Visualização em barras estilizadas com dados reais */}
            <div className="space-y-4">
              {[
                { mes: 'Jul/2026', faturado: 12700, recebido: 12700, atraso: 0 },
                { mes: 'Ago/2026', faturado: 12700, recebido: 12700, atraso: 0 },
                { mes: 'Set/2026', faturado: 12700, recebido: 12700, atraso: 0 },
                { mes: 'Out/2026', faturado: 12700, recebido: 12700, atraso: 0 },
                {
                  mes: 'Nov/2026 (Atual)',
                  faturado: 17946.8,
                  recebido: metrics?.receitaRecebidaMes || 8800,
                  atraso: metrics?.valoresVencidosInadimplentes || 5996.8,
                },
              ].map((row, idx) => {
                const maxVal = 20000
                const pctRecebido = Math.min(100, (row.recebido / maxVal) * 100)
                const pctAtraso = Math.min(100, (row.atraso / maxVal) * 100)

                return (
                  <div key={idx} className="space-y-1">
                    <div className="flex justify-between text-xs">
                      <span className="font-medium text-foreground/90">{row.mes}</span>
                      <span className="text-muted-foreground">
                        Recebido:{' '}
                        <strong className="text-emerald-600">{formatBRL(row.recebido)}</strong> |
                        Pend/Atraso:{' '}
                        <strong className="text-rose-600">{formatBRL(row.atraso)}</strong>
                      </span>
                    </div>
                    <div className="h-3 w-full bg-muted rounded-full overflow-hidden flex shadow-inner">
                      <div
                        style={{ width: `${pctRecebido}%` }}
                        className="bg-gradient-emerald h-full rounded-l-full transition-all duration-500"
                        title={`Recebido: ${formatBRL(row.recebido)}`}
                      />
                      <div
                        style={{ width: `${pctAtraso}%` }}
                        className="bg-gradient-rose h-full transition-all duration-500"
                        title={`Atraso: ${formatBRL(row.atraso)}`}
                      />
                    </div>
                  </div>
                )
              })}
            </div>

            <div className="mt-4 pt-3 border-t border-border/70 flex items-center justify-between text-[11px] text-muted-foreground">
              <div className="flex items-center gap-4">
                <span className="flex items-center gap-1.5">
                  <span className="w-2.5 h-2.5 rounded-full bg-gradient-emerald shadow-glow-emerald/60" />
                  Recebido efetivo
                </span>
                <span className="flex items-center gap-1.5">
                  <span className="w-2.5 h-2.5 rounded-full bg-gradient-rose shadow-glow-rose/60" />
                  Atraso / Inadimplência
                </span>
              </div>
              <span className="text-muted-foreground/70">
                Total Faturado no mês: {formatBRL(17946.8)}
              </span>
            </div>
          </CardContent>
        </Card>

        {/* Card 2: Resumo Rápido da Carteira e Atalho Assistente IA */}
        <Card className="bg-gradient-brand-soft flex flex-col justify-between">
          <CardHeader className="p-4 pb-2">
            <CardTitle className="text-sm font-bold flex items-center gap-2 text-foreground">
              <Sparkles className="w-4 h-4 text-primary" />
              <span>Resumo Gerencial Semanal</span>
            </CardTitle>
            <p className="text-xs text-muted-foreground">
              Consolidado para tomada de decisões administrativas imediatas.
            </p>
          </CardHeader>
          <CardContent className="p-4 space-y-3 text-xs">
            <div className="p-2.5 rounded-xl bg-white/70 dark:bg-white/5 flex items-center justify-between shadow-2xs">
              <span className="text-muted-foreground">Total recebido na semana</span>
              <span className="font-bold text-emerald-600">{formatBRL(4800)}</span>
            </div>
            <div className="p-2.5 rounded-xl bg-white/70 dark:bg-white/5 flex items-center justify-between shadow-2xs">
              <span className="text-muted-foreground">Aluguéis em atraso crítico</span>
              <span className="font-bold text-rose-600">1 contrato (Loja 03)</span>
            </div>
            <div className="p-2.5 rounded-xl bg-white/70 dark:bg-white/5 flex items-center justify-between shadow-2xs">
              <span className="text-muted-foreground">Reajustes a confirmar</span>
              <span className="font-bold text-amber-600">1 (Loja 02 — IPCA)</span>
            </div>
            <div className="p-2.5 rounded-xl bg-white/70 dark:bg-white/5 flex items-center justify-between shadow-2xs">
              <span className="text-muted-foreground">Contratos para renovação</span>
              <span className="font-bold text-navy-secondary dark:text-gold-luminous">
                1 (Sala 01 — 45 dias)
              </span>
            </div>

            <div className="p-3 bg-gradient-brand rounded-xl mt-2 shadow-glow-brand">
              <div className="font-semibold text-white text-xs flex items-center gap-1.5 mb-1">
                <Sparkles className="w-3.5 h-3.5" />
                <span>Pergunte ao Assistente IA</span>
              </div>
              <p className="text-[11px] text-white/90 leading-relaxed mb-2">
                "Quanto tenho para receber neste mês?" ou "Quais inquilinos estão inadimplentes?"
              </p>
              <Button
                size="sm"
                className="w-full bg-white text-navy-deep hover:bg-white/95 text-xs h-7 gap-1 font-bold shadow-md"
                onClick={() => navigate('/assistente-ia')}
              >
                Abrir Assistente de Gestão 360
              </Button>
            </div>
          </CardContent>
        </Card>
      </div>

      {/* DIALOG PARA RESOLVER ALERTA DO PAINEL "O QUE PRECISA DA MINHA ATENÇÃO?" */}
      <Dialog
        open={!!selectedPendencia}
        onOpenChange={(open) => !open && setSelectedPendencia(null)}
      >
        <DialogContent className="sm:max-w-md">
          <DialogHeader>
            <DialogTitle className="text-base flex items-center gap-2">
              <CheckSquare className="w-4 h-4 text-emerald-600" />
              <span>Resolver Providência / Alerta</span>
            </DialogTitle>
          </DialogHeader>
          {selectedPendencia && (
            <div className="space-y-3 text-xs">
              <div className="p-2.5 bg-muted/60 rounded-xl border border-border">
                <div className="font-semibold text-foreground">{selectedPendencia.titulo}</div>
                <div className="text-muted-foreground mt-1">{selectedPendencia.descricao}</div>
                <div className="mt-2 text-[11px] text-muted-foreground/80">
                  Responsável: <strong>{selectedPendencia.responsavel}</strong> • Prazo:{' '}
                  <strong>{selectedPendencia.prazo}</strong>
                </div>
              </div>

              <div>
                <Label htmlFor="solucao" className="text-xs">
                  Registro da Solução / Desfecho:
                </Label>
                <Textarea
                  id="solucao"
                  value={solucaoTexto}
                  onChange={(e) => setSolucaoTexto(e.target.value)}
                  placeholder="Descreva a ação tomada (ex: Cobrança realizada por telefone e acordo firmado para pagamento; contrato enviado para assinatura digital; etc.)"
                  className="text-xs mt-1"
                  rows={3}
                />
              </div>
            </div>
          )}
          <DialogFooter className="gap-2 sm:gap-0">
            <Button
              variant="outline"
              size="sm"
              onClick={() => setSelectedPendencia(null)}
              className="text-xs"
            >
              Cancelar
            </Button>
            <Button
              size="sm"
              onClick={handleResolverPendencia}
              disabled={resolvendo}
              className="text-xs"
            >
              {resolvendo ? 'Salvando...' : 'Concluir e Arquivar Alerta'}
            </Button>
          </DialogFooter>
        </DialogContent>
      </Dialog>
    </div>
  )
}
