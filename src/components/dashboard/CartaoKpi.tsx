import React from 'react'
import { cn } from '@/lib/utils'

export type AcentoKpi = 'brand' | 'emerald' | 'amber' | 'rose' | 'sky' | 'violet' | 'gold' | 'navy'

/** Estilos de destaque por indicador: gradiente suave de fundo, ícone em cápsula colorida e brilho no hover. */
export const kpiStyles: Record<
  AcentoKpi,
  { card: string; chip: string; valor: string; rotulo: string; detalhe: string }
> = {
  brand: {
    card: 'border-orange-300/70 dark:border-orange-500/30 bg-gradient-brand-soft shadow-glow-brand/20 hover:shadow-glow-brand',
    chip: 'bg-gradient-brand text-white shadow-glow-brand',
    valor: 'text-orange-700 dark:text-orange-300',
    rotulo: 'text-orange-950/80 dark:text-orange-200/80',
    detalhe: 'text-orange-900/70 dark:text-orange-300/70',
  },
  emerald: {
    card: 'border-emerald-200/80 dark:border-emerald-500/30 bg-gradient-emerald-soft shadow-glow-emerald/30 hover:shadow-glow-emerald',
    chip: 'bg-gradient-emerald text-white shadow-glow-emerald',
    valor: 'text-emerald-700 dark:text-emerald-200',
    rotulo: 'text-emerald-700/80 dark:text-emerald-300/70',
    detalhe: 'text-emerald-700/70 dark:text-emerald-300/60',
  },
  amber: {
    card: 'border-amber-200/80 dark:border-amber-500/30 bg-gradient-amber-soft shadow-glow-amber/30 hover:shadow-glow-amber',
    chip: 'bg-gradient-amber text-white shadow-glow-amber',
    valor: 'text-amber-700 dark:text-amber-200',
    rotulo: 'text-amber-700/80 dark:text-amber-300/70',
    detalhe: 'text-amber-700/70 dark:text-amber-300/60',
  },
  rose: {
    card: 'border-rose-200/80 dark:border-rose-500/30 bg-gradient-rose-soft shadow-glow-rose/30 hover:shadow-glow-rose',
    chip: 'bg-gradient-rose text-white shadow-glow-rose',
    valor: 'text-rose-700 dark:text-rose-200',
    rotulo: 'text-rose-700/80 dark:text-rose-300/70',
    detalhe: 'text-rose-700/70 dark:text-rose-300/60',
  },
  sky: {
    card: 'border-slate-300/80 dark:border-navy-secondary/60 bg-gradient-sky-soft shadow-glow-sky/20 hover:shadow-glow-sky',
    chip: 'bg-gradient-sky text-white shadow-glow-sky',
    valor: 'text-navy-deep dark:text-gold-light',
    rotulo: 'text-navy-secondary dark:text-slate-300',
    detalhe: 'text-slate-600 dark:text-slate-400',
  },
  violet: {
    /* Mapeado para Dourado Metálico/Luminoso para manter retrocompatibilidade */
    card: 'border-gold-metallic/40 dark:border-gold-metallic/35 bg-gradient-gold-soft shadow-glow-gold/25 hover:shadow-glow-gold',
    chip: 'bg-gradient-gold text-navy-deep font-bold shadow-glow-gold',
    valor: 'text-gold-dark dark:text-gold-luminous',
    rotulo: 'text-gold-bronze dark:text-gold-light/85',
    detalhe: 'text-gold-bronze/80 dark:text-gold-light/65',
  },
  gold: {
    card: 'border-gold-metallic/40 dark:border-gold-metallic/35 bg-gradient-gold-soft shadow-glow-gold/25 hover:shadow-glow-gold',
    chip: 'bg-gradient-gold text-navy-deep font-bold shadow-glow-gold',
    valor: 'text-gold-dark dark:text-gold-luminous',
    rotulo: 'text-gold-bronze dark:text-gold-light/85',
    detalhe: 'text-gold-bronze/80 dark:text-gold-light/65',
  },
  navy: {
    card: 'border-navy-secondary/40 dark:border-navy-border bg-gradient-sky-soft shadow-glow-sky/20 hover:shadow-glow-sky',
    chip: 'bg-gradient-sidebar text-white shadow-glow-sky',
    valor: 'text-navy-deep dark:text-gold-light',
    rotulo: 'text-navy-secondary dark:text-slate-300',
    detalhe: 'text-slate-600 dark:text-slate-400',
  },
}

interface CartaoKpiProps {
  acento: AcentoKpi
  icone: React.ReactNode
  rotulo: string
  valor: React.ReactNode
  detalhe?: React.ReactNode
  className?: string
}

/** Cartão de indicador do Visão Geral: rótulo, valor grande e ícone em cápsula com gradiente por acento. */
export default function CartaoKpi({
  acento,
  icone,
  rotulo,
  valor,
  detalhe,
  className,
}: CartaoKpiProps) {
  const s = kpiStyles[acento]
  return (
    <div
      className={cn(
        'relative overflow-hidden rounded-2xl border p-3.5 sm:p-4 shadow-soft card-lift hover:shadow-lifted transition-all duration-250 group',
        s.card,
        className,
      )}
    >
      <div
        aria-hidden
        className="pointer-events-none absolute -right-6 -top-6 h-20 w-20 rounded-full bg-white/25 blur-xl transition-opacity duration-300 group-hover:opacity-100 opacity-60 dark:bg-white/5"
      />
      <div className="flex items-start justify-between gap-2">
        <span
          className={cn(
            'text-[10px] font-extrabold tracking-wider uppercase leading-tight',
            s.rotulo,
          )}
        >
          {rotulo}
        </span>
        <span
          className={cn(
            'w-8 h-8 shrink-0 rounded-xl flex items-center justify-center transition-transform duration-250 group-hover:scale-110 group-hover:-rotate-3',
            s.chip,
          )}
        >
          {icone}
        </span>
      </div>
      <div className={cn('mt-1.5 text-lg sm:text-xl font-extrabold tracking-tight', s.valor)}>
        {valor}
      </div>
      {detalhe ? (
        <div className={cn('text-[10px] mt-1 font-medium', s.detalhe)}>{detalhe}</div>
      ) : null}
    </div>
  )
}
