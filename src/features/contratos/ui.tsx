import React from 'react'
import { Badge } from '@/components/ui/badge'
import { ContratoModel, CobrancaModel, PendenciaModel, RenovacaoModel } from '@/types/database'

/** Badge de status do contrato na identidade violeta/fúcsia do redesign. */
export function statusBadgeContrato(status: ContratoModel['status']) {
  switch (status) {
    case 'ativo':
      return (
        <Badge className="bg-gradient-emerald text-white border-transparent text-[10px]">
          Ativo
        </Badge>
      )
    case 'vencendo':
      return (
        <Badge className="bg-gradient-amber text-white border-transparent text-[10px]">
          Vencendo
        </Badge>
      )
    case 'prorrogado_legal':
      return (
        <Badge className="bg-gradient-sky text-white border-transparent text-[10px]">
          Prorrogado Legal
        </Badge>
      )
    case 'renovado':
      return (
        <Badge className="bg-gradient-brand text-white border-transparent text-[10px]">
          Renovado
        </Badge>
      )
    case 'em_negociacao':
      return (
        <Badge className="bg-gradient-amber text-white border-transparent text-[10px]">
          Em Negociação
        </Badge>
      )
    case 'distratado':
      return (
        <Badge variant="destructive" className="text-[10px]">
          Distratado
        </Badge>
      )
    case 'encerrado':
      return (
        <Badge variant="secondary" className="text-[10px]">
          Encerrado
        </Badge>
      )
    default:
      return (
        <Badge variant="outline" className="text-[10px]">
          {status}
        </Badge>
      )
  }
}

export type SituacaoFinanceira = 'em_dia' | 'em_aberto' | 'inadimplente' | 'sem_cobranca'

/** Situação financeira do contrato a partir das cobranças reais (vencidas / em aberto). */
export function situacaoFinanceiraContrato(cobrancas: CobrancaModel[]): SituacaoFinanceira {
  if (cobrancas.length === 0) return 'sem_cobranca'
  const hoje = new Date().toISOString().split('T')[0]
  const emAberto = cobrancas.filter(
    (c) =>
      c.status !== 'cancelado' &&
      c.status !== 'pago' &&
      (c.valor_total || 0) - (c.valor_pago || 0) > 0.005,
  )
  if (emAberto.some((c) => c.vencimento < hoje || c.status === 'vencido')) return 'inadimplente'
  if (emAberto.length > 0) return 'em_aberto'
  return 'em_dia'
}

export function badgeSituacaoFinanceira(sit: SituacaoFinanceira) {
  switch (sit) {
    case 'em_dia':
      return <span className="text-emerald-600 dark:text-emerald-400 font-semibold">🟢 Em dia</span>
    case 'em_aberto':
      return <span className="text-amber-600 dark:text-amber-400 font-semibold">🟡 Em aberto</span>
    case 'inadimplente':
      return <span className="text-rose-600 dark:text-rose-400 font-semibold">🔴 Em atraso</span>
    default:
      return <span className="text-muted-foreground">Sem cobranças</span>
  }
}

/** Status de renovação mais relevante do contrato (negociação em aberto ou última resolução). */
export function statusRenovacaoContrato(renovacoes: RenovacaoModel[]): string | null {
  if (renovacoes.length === 0) return null
  const aberta = renovacoes.find((r) => r.status === 'pendente' || r.status === 'em_negociacao')
  if (aberta) return aberta.status === 'pendente' ? 'Renovação pendente' : 'Renovação em negociação'
  const ultima = renovacoes[0]
  const mapa: Record<string, string> = {
    renovado: 'Renovado',
    prorrogado_legal: 'Prorrogado legal',
    distratado: 'Distratado',
    resolvido: 'Resolvido',
  }
  return mapa[ultima.status] || ultima.status
}

/** Pendências vinculadas ainda não resolvidas. */
export function pendenciasAbertas(contratoId: string, pendencias: PendenciaModel[]) {
  return pendencias.filter(
    (p) => p.contrato === contratoId && (p.status === 'pendente' || p.status === 'em_andamento'),
  )
}
