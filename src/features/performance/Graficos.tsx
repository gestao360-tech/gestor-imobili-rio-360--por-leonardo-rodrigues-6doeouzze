import {
  ResponsiveContainer,
  ComposedChart,
  Bar,
  Line,
  Area,
  AreaChart,
  BarChart,
  Cell,
  XAxis,
  YAxis,
  CartesianGrid,
  Tooltip,
  Legend,
} from 'recharts'
import { LinhaMensal, ProjecaoMensal, RankingImovel } from './calculos'
import { formatBRL } from '@/services/imobiliario'

/* Gráficos da Performance — Recharts com a identidade violeta/fúcsia. */

const COR_PRIMARIA = '#7c3aed'
const COR_FUCHSIA = '#d946ef'
const COR_EMERALD = '#10b981'
const COR_ROSE = '#f43f5e'
const COR_AMBAR = '#f59e0b'
const COR_SKY = '#0ea5e9'

function moedaCompacta(v: number): string {
  if (Math.abs(v) >= 1000) return `R$ ${(v / 1000).toFixed(1).replace('.', ',')}k`
  return formatBRL(v)
}

const estiloEixo = { fontSize: 11, fill: 'currentColor' } as const

function TooltipMoeda({ active, payload, label }: any) {
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
          <span className="font-semibold text-foreground">
            {p.dataKey === 'pctInadimplencia'
              ? `${Number(p.value).toFixed(1)}%`
              : formatBRL(p.value)}
          </span>
        </div>
      ))}
    </div>
  )
}

/** Evolução mensal: recebimentos (barra), faturado (linha) e despesas (linha) + inadimplência %. */
export function GraficoEvolucaoMensal({ dados }: { dados: LinhaMensal[] }) {
  return (
    <ResponsiveContainer width="100%" height={320}>
      <ComposedChart data={dados} margin={{ top: 8, right: 8, left: 0, bottom: 0 }}>
        <defs>
          <linearGradient id="gradRecebido" x1="0" y1="0" x2="0" y2="1">
            <stop offset="0%" stopColor={COR_EMERALD} stopOpacity={0.95} />
            <stop offset="100%" stopColor={COR_EMERALD} stopOpacity={0.35} />
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
        <YAxis
          yAxisId="pct"
          orientation="right"
          tick={estiloEixo}
          tickLine={false}
          axisLine={false}
          tickFormatter={(v) => `${Number(v).toFixed(0)}%`}
          width={44}
        />
        <Tooltip content={<TooltipMoeda />} />
        <Legend iconType="circle" wrapperStyle={{ fontSize: 11, paddingTop: 8 }} />
        <Bar
          dataKey="recebido"
          name="Recebido"
          fill="url(#gradRecebido)"
          radius={[6, 6, 0, 0]}
          maxBarSize={26}
        />
        <Line
          type="monotone"
          dataKey="faturado"
          name="Faturado"
          stroke={COR_PRIMARIA}
          strokeWidth={2.5}
          dot={false}
        />
        <Line
          type="monotone"
          dataKey="despesas"
          name="Despesas"
          stroke={COR_AMBAR}
          strokeWidth={2}
          dot={false}
        />
        <Line
          yAxisId="pct"
          type="monotone"
          dataKey="pctInadimplencia"
          name="Inadimplência %"
          stroke={COR_ROSE}
          strokeWidth={2}
          strokeDasharray="6 4"
          dot={false}
        />
      </ComposedChart>
    </ResponsiveContainer>
  )
}

/** Projeção dos próximos 12 meses: contratado hoje vs. com reajustes aprovados. */
export function GraficoProjecao({ dados }: { dados: ProjecaoMensal[] }) {
  return (
    <ResponsiveContainer width="100%" height={280}>
      <ComposedChart data={dados} margin={{ top: 8, right: 8, left: 0, bottom: 0 }}>
        <defs>
          <linearGradient id="gradReajustado" x1="0" y1="0" x2="0" y2="1">
            <stop offset="0%" stopColor={COR_FUCHSIA} stopOpacity={0.5} />
            <stop offset="100%" stopColor={COR_FUCHSIA} stopOpacity={0.05} />
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
        <Tooltip content={<TooltipMoeda />} />
        <Legend iconType="circle" wrapperStyle={{ fontSize: 11, paddingTop: 8 }} />
        <Area
          type="monotone"
          dataKey="reajustado"
          name="Com reajustes aprovados"
          stroke={COR_FUCHSIA}
          strokeWidth={2}
          fill="url(#gradReajustado)"
        />
        <Line
          type="monotone"
          dataKey="contratado"
          name="Contratado atual"
          stroke={COR_PRIMARIA}
          strokeWidth={2.5}
          dot={false}
        />
      </ComposedChart>
    </ResponsiveContainer>
  )
}

/** Comparativo faturado vs. recebido por mês. */
export function GraficoFaturadoRecebido({ dados }: { dados: LinhaMensal[] }) {
  return (
    <ResponsiveContainer width="100%" height={300}>
      <BarChart data={dados} margin={{ top: 8, right: 8, left: 0, bottom: 0 }}>
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
        <Tooltip content={<TooltipMoeda />} cursor={{ fill: 'rgba(124,58,237,0.06)' }} />
        <Legend iconType="circle" wrapperStyle={{ fontSize: 11, paddingTop: 8 }} />
        <Bar
          dataKey="faturado"
          name="Faturado"
          fill={COR_PRIMARIA}
          radius={[5, 5, 0, 0]}
          maxBarSize={22}
        />
        <Bar
          dataKey="recebido"
          name="Recebido"
          fill={COR_EMERALD}
          radius={[5, 5, 0, 0]}
          maxBarSize={22}
        />
      </BarChart>
    </ResponsiveContainer>
  )
}

/** Ranking de rentabilidade por imóvel (resultado líquido, colorido por sinal). */
export function GraficoRentabilidade({ dados }: { dados: RankingImovel[] }) {
  return (
    <ResponsiveContainer width="100%" height={Math.max(220, dados.length * 42 + 60)}>
      <BarChart data={dados} layout="vertical" margin={{ top: 4, right: 16, left: 8, bottom: 0 }}>
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
          dataKey="nome"
          tick={{ ...estiloEixo, fontSize: 10 }}
          tickLine={false}
          axisLine={false}
          width={140}
        />
        <Tooltip content={<TooltipMoeda />} cursor={{ fill: 'rgba(124,58,237,0.06)' }} />
        <Bar dataKey="resultado" name="Resultado" radius={[0, 5, 5, 0]} maxBarSize={18}>
          {dados.map((d, i) => (
            <Cell key={i} fill={d.resultado >= 0 ? COR_EMERALD : COR_ROSE} />
          ))}
        </Bar>
      </BarChart>
    </ResponsiveContainer>
  )
}
