import {
  ResponsiveContainer,
  ComposedChart,
  BarChart,
  Bar,
  Line,
  XAxis,
  YAxis,
  CartesianGrid,
  Tooltip,
  Legend,
  Cell,
} from 'recharts'
import { LinhaFluxoMensal, ItemComposicao, corCategoria } from './fluxo'
import { formatBRL } from '@/services/imobiliario'

/* Gráficos da Análise de Fluxo de Caixa — Recharts com a nova identidade (Laranja #F15A24, Dourado #D4A347, Azul-marinho #06182B/#102B46). */

const COR_ENTRADAS = '#10b981'
const COR_SAIDAS = '#f43f5e'
const COR_SALDO = '#F15A24' /* Laranja institucional */
const COR_ACUMULADO = '#D4A347' /* Dourado metálico */

const estiloEixo = { fontSize: 11, fill: 'currentColor' } as const

function moedaCompacta(v: number): string {
  if (Math.abs(v) >= 1000) return `R$ ${(v / 1000).toFixed(1).replace('.', ',')}k`
  return formatBRL(v)
}

function TooltipFluxo({ active, payload, label }: any) {
  if (!active || !payload?.length) return null
  return (
    <div className="rounded-xl border border-border bg-popover/95 backdrop-blur px-3 py-2 shadow-lifted text-xs">
      <div className="font-bold text-foreground mb-1">{label}</div>
      {payload.map((p: any, i: number) => (
        <div key={i} className="flex items-center justify-between gap-4 py-0.5">
          <span className="flex items-center gap-1.5 text-muted-foreground">
            <span className="w-2 h-2 rounded-full" style={{ background: p.color || p.fill }} />
            {p.name}
          </span>
          <span className="font-semibold text-foreground">{formatBRL(Number(p.value))}</span>
        </div>
      ))}
    </div>
  )
}

/** Evolução mensal: entradas × saídas (barras) + saldo e saldo ACUMULADO (linhas). */
export function GraficoFluxoMensal({ dados }: { dados: LinhaFluxoMensal[] }) {
  return (
    <ResponsiveContainer width="100%" height={340}>
      <ComposedChart data={dados} margin={{ top: 8, right: 8, left: 0, bottom: 0 }}>
        <defs>
          <linearGradient id="gradEntradasFx" x1="0" y1="0" x2="0" y2="1">
            <stop offset="0%" stopColor={COR_ENTRADAS} stopOpacity={0.95} />
            <stop offset="100%" stopColor={COR_ENTRADAS} stopOpacity={0.35} />
          </linearGradient>
          <linearGradient id="gradSaidasFx" x1="0" y1="0" x2="0" y2="1">
            <stop offset="0%" stopColor={COR_SAIDAS} stopOpacity={0.9} />
            <stop offset="100%" stopColor={COR_SAIDAS} stopOpacity={0.3} />
          </linearGradient>
        </defs>
        <CartesianGrid
          strokeDasharray="4 4"
          stroke="currentColor"
          className="text-border"
          vertical={false}
        />
        <XAxis dataKey="rotulo" tick={estiloEixo} tickLine={false} axisLine={false} />
        <YAxis
          tick={estiloEixo}
          tickLine={false}
          axisLine={false}
          tickFormatter={(v) => moedaCompacta(Number(v))}
          width={64}
        />
        <Tooltip content={<TooltipFluxo />} cursor={{ fill: 'rgba(241,90,36,0.06)' }} />
        <Legend iconType="circle" wrapperStyle={{ fontSize: 11, paddingTop: 8 }} />
        <Bar
          dataKey="entradas"
          name="Entradas"
          fill="url(#gradEntradasFx)"
          radius={[6, 6, 0, 0]}
          maxBarSize={24}
        />
        <Bar
          dataKey="saidas"
          name="Saídas"
          fill="url(#gradSaidasFx)"
          radius={[6, 6, 0, 0]}
          maxBarSize={24}
        />
        <Line
          type="monotone"
          dataKey="saldo"
          name="Saldo do mês"
          stroke={COR_SALDO}
          strokeWidth={2.5}
          dot={false}
        />
        <Line
          type="monotone"
          dataKey="acumulado"
          name="Saldo acumulado"
          stroke={COR_ACUMULADO}
          strokeWidth={2}
          strokeDasharray="6 4"
          dot={false}
        />
      </ComposedChart>
    </ResponsiveContainer>
  )
}

/** Composição por categoria (saídas) ou por imóvel (entradas) — pizza da marca. */
export function GraficoComposicaoFluxo({ dados }: { dados: ItemComposicao[] }) {
  if (dados.length === 0) {
    return (
      <div className="py-12 text-center text-xs text-muted-foreground">
        Sem movimentação nesta composição no período selecionado.
      </div>
    )
  }
  return (
    <ResponsiveContainer width="100%" height={280}>
      <BarChart data={dados} layout="vertical" margin={{ top: 4, right: 20, left: 8, bottom: 0 }}>
        <CartesianGrid
          strokeDasharray="4 4"
          stroke="currentColor"
          className="text-border"
          horizontal={false}
        />
        <XAxis
          type="number"
          tick={estiloEixo}
          tickLine={false}
          axisLine={false}
          tickFormatter={(v) => moedaCompacta(Number(v))}
        />
        <YAxis
          type="category"
          dataKey="rotulo"
          tick={{ ...estiloEixo, fontSize: 10 }}
          tickLine={false}
          axisLine={false}
          width={150}
        />
        <Tooltip content={<TooltipFluxo />} cursor={{ fill: 'rgba(124,58,237,0.06)' }} />
        <Bar dataKey="valor" name="Total" radius={[0, 6, 6, 0]} maxBarSize={20}>
          {dados.map((_, i) => (
            <Cell key={i} fill={corCategoria(i)} />
          ))}
        </Bar>
      </BarChart>
    </ResponsiveContainer>
  )
}
