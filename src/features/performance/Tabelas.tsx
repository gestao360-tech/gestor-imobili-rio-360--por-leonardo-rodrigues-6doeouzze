import { useState } from 'react'
import {
  ArrowUpDown,
  ArrowUp,
  ArrowDown,
  Building2,
  User,
  TrendingUp,
  TrendingDown,
} from 'lucide-react'
import { Badge } from '@/components/ui/badge'
import { Progress } from '@/components/ui/progress'
import { formatBRL } from '@/services/imobiliario'
import { RankingImovel, InadimplenciaInquilino } from './calculos'

/* Tabelas interativas e blocos de ocupação da Performance. */

type ChaveOrdenacao = 'resultado' | 'recebido' | 'faturado' | 'despesas' | 'margem' | 'nome'

export function TabelaRentabilidade({ dados }: { dados: RankingImovel[] }) {
  const [chave, setChave] = useState<ChaveOrdenacao>('resultado')
  const [desc, setDesc] = useState(true)

  const ordenar = (c: ChaveOrdenacao) => {
    if (c === chave) setDesc(!desc)
    else {
      setChave(c)
      setDesc(c !== 'nome')
    }
  }

  const lista = [...dados].sort((a, b) => {
    if (chave === 'nome') return desc ? b.nome.localeCompare(a.nome) : a.nome.localeCompare(b.nome)
    return desc
      ? (b[chave] as number) - (a[chave] as number)
      : (a[chave] as number) - (b[chave] as number)
  })

  const Icone = (c: ChaveOrdenacao) =>
    chave !== c ? (
      <ArrowUpDown className="w-3 h-3 opacity-40" />
    ) : desc ? (
      <ArrowDown className="w-3 h-3" />
    ) : (
      <ArrowUp className="w-3 h-3" />
    )

  if (lista.length === 0) {
    return (
      <div className="py-10 text-center text-sm text-muted-foreground">
        Nenhum imóvel com movimentação financeira no período selecionado.
      </div>
    )
  }

  return (
    <div className="overflow-x-auto rounded-xl border border-border">
      <table className="w-full text-xs">
        <thead>
          <tr className="bg-muted/60 text-muted-foreground">
            <th className="text-left font-semibold px-3 py-2.5">
              <button
                onClick={() => ordenar('nome')}
                className="flex items-center gap-1 hover:text-foreground"
              >
                Imóvel {Icone('nome')}
              </button>
            </th>
            <th className="text-right font-semibold px-3 py-2.5">
              <button
                onClick={() => ordenar('faturado')}
                className="flex items-center gap-1 ml-auto hover:text-foreground"
              >
                Faturado {Icone('faturado')}
              </button>
            </th>
            <th className="text-right font-semibold px-3 py-2.5">
              <button
                onClick={() => ordenar('recebido')}
                className="flex items-center gap-1 ml-auto hover:text-foreground"
              >
                Recebido {Icone('recebido')}
              </button>
            </th>
            <th className="text-right font-semibold px-3 py-2.5">
              <button
                onClick={() => ordenar('despesas')}
                className="flex items-center gap-1 ml-auto hover:text-foreground"
              >
                Despesas {Icone('despesas')}
              </button>
            </th>
            <th className="text-right font-semibold px-3 py-2.5">
              <button
                onClick={() => ordenar('resultado')}
                className="flex items-center gap-1 ml-auto hover:text-foreground"
              >
                Resultado {Icone('resultado')}
              </button>
            </th>
            <th className="text-right font-semibold px-3 py-2.5">
              <button
                onClick={() => ordenar('margem')}
                className="flex items-center gap-1 ml-auto hover:text-foreground"
              >
                Margem {Icone('margem')}
              </button>
            </th>
          </tr>
        </thead>
        <tbody className="divide-y divide-border/70">
          {lista.map((r, idx) => (
            <tr key={r.imovelId} className="hover:bg-accent/40 transition-colors">
              <td className="px-3 py-2.5">
                <div className="flex items-center gap-2">
                  <span
                    className={`w-6 h-6 shrink-0 rounded-lg flex items-center justify-center text-[10px] font-extrabold text-white ${
                      idx < 3
                        ? 'bg-gradient-brand shadow-glow-brand/40'
                        : 'bg-muted-foreground/30 text-foreground'
                    }`}
                  >
                    {idx + 1}
                  </span>
                  <div className="min-w-0">
                    <div className="font-semibold text-foreground truncate max-w-[180px]">
                      {r.nome}
                    </div>
                    <div className="text-[10px] text-muted-foreground">
                      {r.codigo} · {r.situacao === 'alugado' ? 'Alugado' : r.situacao}
                    </div>
                  </div>
                </div>
              </td>
              <td className="px-3 py-2.5 text-right tabular-nums text-muted-foreground">
                {formatBRL(r.faturado)}
              </td>
              <td className="px-3 py-2.5 text-right tabular-nums font-semibold text-foreground">
                {formatBRL(r.recebido)}
              </td>
              <td className="px-3 py-2.5 text-right tabular-nums text-amber-600 dark:text-amber-400">
                {r.despesas > 0 ? formatBRL(r.despesas) : '—'}
              </td>
              <td
                className={`px-3 py-2.5 text-right tabular-nums font-bold ${
                  r.resultado >= 0
                    ? 'text-emerald-600 dark:text-emerald-400'
                    : 'text-rose-600 dark:text-rose-400'
                }`}
              >
                {formatBRL(r.resultado)}
              </td>
              <td className="px-3 py-2.5 text-right">
                <span
                  className={`inline-flex items-center gap-1 text-[11px] font-bold tabular-nums ${
                    r.margem >= 0
                      ? 'text-emerald-600 dark:text-emerald-400'
                      : 'text-rose-600 dark:text-rose-400'
                  }`}
                >
                  {r.margem >= 0 ? (
                    <TrendingUp className="w-3 h-3" />
                  ) : (
                    <TrendingDown className="w-3 h-3" />
                  )}
                  {r.margem.toFixed(1)}%
                </span>
              </td>
            </tr>
          ))}
        </tbody>
      </table>
    </div>
  )
}

export function TabelaInadimplencia({ dados }: { dados: InadimplenciaInquilino[] }) {
  if (dados.length === 0) {
    return (
      <div className="py-10 text-center">
        <div className="w-12 h-12 mx-auto rounded-2xl bg-gradient-emerald-soft flex items-center justify-center mb-3">
          <span className="text-xl">✅</span>
        </div>
        <div className="text-sm font-semibold text-foreground">Carteira em dia</div>
        <div className="text-xs text-muted-foreground mt-1">
          Nenhuma cobrança vencida em aberto no escopo selecionado.
        </div>
      </div>
    )
  }

  const max = Math.max(...dados.map((d) => d.totalAtraso), 1)

  return (
    <div className="space-y-2.5">
      {dados.map((d, i) => (
        <div
          key={d.inquilinoId}
          className="flex flex-col sm:flex-row sm:items-center gap-2 sm:gap-4 rounded-xl border border-border/80 px-3 py-2.5 hover:bg-accent/30 transition-colors"
        >
          <div className="flex items-center gap-2 min-w-0 sm:w-56">
            <span
              className={`w-7 h-7 shrink-0 rounded-lg flex items-center justify-center ${
                i < 3 ? 'bg-gradient-rose text-white shadow-glow-rose/40' : 'bg-muted'
              }`}
            >
              <User className="w-3.5 h-3.5" />
            </span>
            <div className="min-w-0">
              <div className="text-xs font-semibold text-foreground truncate">{d.nome}</div>
              <div className="text-[10px] text-muted-foreground">
                {d.qtdAtivos} cobrança{d.qtdAtivos > 1 ? 's' : ''} vencida
                {d.qtdAtivos > 1 ? 's' : ''}
              </div>
            </div>
          </div>
          <div className="flex-1 min-w-0">
            <Progress
              value={(d.totalAtraso / max) * 100}
              className="h-2 bg-rose-500/10 [&>div]:bg-gradient-rose"
            />
            <div className="text-[10px] text-muted-foreground mt-1 truncate">
              Competências: {d.competencias.join(', ')}
            </div>
          </div>
          <div className="flex gap-4 sm:justify-end shrink-0">
            <div className="text-right">
              <div className="text-[9px] uppercase tracking-wider text-muted-foreground font-bold">
                Em atraso
              </div>
              <div className="text-xs font-extrabold text-rose-600 dark:text-rose-400 tabular-nums">
                {formatBRL(d.totalAtraso)}
              </div>
            </div>
            <div className="text-right">
              <div className="text-[9px] uppercase tracking-wider text-muted-foreground font-bold">
                Dias médios
              </div>
              <div className="text-xs font-extrabold text-foreground tabular-nums">
                {d.diasAtrasoMedio}
                <span className="text-[9px] font-semibold text-muted-foreground">
                  {' '}
                  (máx {d.maiorAtraso})
                </span>
              </div>
            </div>
          </div>
        </div>
      ))}
    </div>
  )
}

export function BlocoOcupacao({
  taxaOcupacao,
  alugados,
  total,
  porSituacao,
  porTipo,
}: {
  taxaOcupacao: number
  alugados: number
  total: number
  porSituacao: { chave: string; rotulo: string; qtd: number }[]
  porTipo: { chave: string; rotulo: string; qtd: number }[]
}) {
  const coresSituacao: Record<string, string> = {
    alugado: 'bg-gradient-emerald',
    disponivel: 'bg-gradient-sky',
    reservado: 'bg-gradient-amber',
    em_reforma: 'bg-gradient-rose',
    inativo: 'bg-muted-foreground/50',
  }

  return (
    <div className="space-y-4">
      <div className="flex items-center gap-4">
        <div className="relative w-24 h-24 shrink-0">
          <svg viewBox="0 0 100 100" className="w-full h-full -rotate-90">
            <circle cx="50" cy="50" r="40" fill="none" strokeWidth="12" className="stroke-muted" />
            <circle
              cx="50"
              cy="50"
              r="40"
              fill="none"
              strokeWidth="12"
              strokeLinecap="round"
              strokeDasharray={`${(taxaOcupacao / 100) * 251.2} 251.2`}
              className="stroke-[url(#gradOcup)]"
            />
            <defs>
              <linearGradient id="gradOcup" x1="0" y1="0" x2="1" y2="1">
                <stop offset="0%" stopColor="#7c3aed" />
                <stop offset="100%" stopColor="#d946ef" />
              </linearGradient>
            </defs>
          </svg>
          <div className="absolute inset-0 flex flex-col items-center justify-center">
            <span className="text-lg font-extrabold text-foreground tabular-nums">
              {taxaOcupacao.toFixed(0)}%
            </span>
            <span className="text-[9px] font-semibold text-muted-foreground uppercase tracking-wider">
              Ocupação
            </span>
          </div>
        </div>
        <div className="min-w-0">
          <div className="flex items-center gap-2 text-sm font-extrabold text-foreground">
            <Building2 className="w-4 h-4 text-primary" />
            {alugados} de {total} imóveis alugados
          </div>
          <div className="flex flex-wrap gap-1.5 mt-2">
            {porSituacao.map((s) => (
              <Badge key={s.chave} variant="outline" className="text-[10px] gap-1 border-border">
                <span className={`w-2 h-2 rounded-full ${coresSituacao[s.chave] ?? 'bg-muted'}`} />
                {s.rotulo}: {s.qtd}
              </Badge>
            ))}
          </div>
        </div>
      </div>
      <div className="space-y-1.5">
        {porTipo.map((t) => {
          const pct = total > 0 ? (t.qtd / total) * 100 : 0
          return (
            <div key={t.chave} className="flex items-center gap-2">
              <span className="text-[10px] font-semibold text-muted-foreground w-20 shrink-0">
                {t.rotulo}
              </span>
              <div className="flex-1 h-2 rounded-full bg-muted overflow-hidden">
                <div
                  className="h-full rounded-full bg-gradient-brand"
                  style={{ width: `${pct}%` }}
                />
              </div>
              <span className="text-[10px] font-bold text-foreground tabular-nums w-8 text-right">
                {t.qtd}
              </span>
            </div>
          )
        })}
      </div>
    </div>
  )
}
