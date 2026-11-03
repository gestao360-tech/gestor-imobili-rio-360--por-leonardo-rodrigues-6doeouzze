import React, { useState, useEffect } from 'react'
import {
  TrendingUp,
  Search,
  CheckCircle2,
  Calculator,
  AlertCircle,
  FileCheck,
  Building,
  User,
  Clock,
  ArrowRight,
} from 'lucide-react'
import { getReajustes, aprovarReajuste, formatBRL, formatDateBR } from '@/services/imobiliario'
import { ReajusteModel } from '@/types/database'
import { Button } from '@/components/ui/button'
import { Input } from '@/components/ui/input'
import { Badge } from '@/components/ui/badge'
import { Card, CardHeader, CardTitle, CardContent } from '@/components/ui/card'
import {
  Dialog,
  DialogContent,
  DialogHeader,
  DialogTitle,
  DialogFooter,
} from '@/components/ui/dialog'
import { Label } from '@/components/ui/label'
import { Textarea } from '@/components/ui/textarea'
import { toast } from '@/hooks/use-toast'

export default function ReajustesPage() {
  const [reajustes, setReajustes] = useState<ReajusteModel[]>([])
  const [loading, setLoading] = useState(true)
  const [search, setSearch] = useState('')

  // Modal de Simulação & Aprovação Manual
  const [selectedReajuste, setSelectedReajuste] = useState<ReajusteModel | null>(null)
  const [valorSimulado, setValorSimulado] = useState<number>(0)
  const [percentualSimulado, setPercentualSimulado] = useState<number>(0)
  const [obsAprovacao, setObsAprovacao] = useState('')
  const [salvando, setSalvando] = useState(false)

  useEffect(() => {
    loadData()
  }, [])

  const loadData = async () => {
    setLoading(true)
    try {
      const list = await getReajustes()
      setReajustes(list)
    } catch (err) {
      toast({
        title: 'Erro ao carregar',
        description: 'Não foi possível carregar reajustes.',
        variant: 'destructive',
      })
    } finally {
      setLoading(false)
    }
  }

  const handleOpenAprovar = (r: ReajusteModel) => {
    setSelectedReajuste(r)
    setValorSimulado(r.aluguel_novo_projetado)
    setPercentualSimulado(r.percentual_aplicavel)
    setObsAprovacao(r.observacao_negociacao || '')
  }

  const handleRecalcularPorPercentual = (novoPct: number) => {
    setPercentualSimulado(novoPct)
    if (selectedReajuste) {
      const novoVal = selectedReajuste.aluguel_anterior * (1 + novoPct / 100)
      setValorSimulado(Math.round(novoVal * 100) / 100)
    }
  }

  const handleRecalcularPorValor = (novoVal: number) => {
    setValorSimulado(novoVal)
    if (selectedReajuste && selectedReajuste.aluguel_anterior > 0) {
      const pct =
        ((novoVal - selectedReajuste.aluguel_anterior) / selectedReajuste.aluguel_anterior) * 100
      setPercentualSimulado(Math.round(pct * 100) / 100)
    }
  }

  const handleConfirmarAprovacao = async () => {
    if (!selectedReajuste) return
    setSalvando(true)
    try {
      // Regra obrigatória: NENHUM reajuste efetivado sem confirmação do administrador
      await aprovarReajuste(selectedReajuste.id, valorSimulado, obsAprovacao)
      toast({
        title: 'Reajuste Aprovado com Sucesso!',
        description: `O novo aluguel de ${formatBRL(valorSimulado)} foi confirmado e o contrato foi atualizado.`,
      })
      setSelectedReajuste(null)
      loadData()
    } catch (err) {
      toast({
        title: 'Erro ao aprovar reajuste',
        description: 'Tente novamente.',
        variant: 'destructive',
      })
    } finally {
      setSalvando(false)
    }
  }

  const statusBadge = (st: string) => {
    switch (st) {
      case 'aprovado':
        return <Badge className="bg-emerald-600 text-white">Aprovado</Badge>
      case 'em_negociacao':
        return <Badge className="bg-amber-600 text-white">Em Negociação</Badge>
      case 'nao_aplicado':
        return <Badge variant="secondary">Não Aplicado</Badge>
      case 'rejeitado':
        return <Badge variant="destructive">Rejeitado</Badge>
      default:
        return (
          <Badge variant="outline" className="border-amber-500 text-amber-600 font-medium">
            Aguardando Aprovação
          </Badge>
        )
    }
  }

  return (
    <div className="space-y-6">
      {/* HEADER */}
      <div className="flex flex-col sm:flex-row sm:items-center justify-between gap-4 border-b border-slate-200 dark:border-slate-800 pb-4">
        <div>
          <h1 className="text-xl font-bold tracking-tight text-slate-900 dark:text-slate-100 flex items-center gap-2">
            <span>📈 Módulo Exclusivo de Reajustes de Aluguel</span>
            <Badge variant="secondary" className="text-xs">
              {reajustes.length} registros
            </Badge>
          </h1>
          <p className="text-xs text-slate-500 mt-1">
            Cálculo automático pelos índices oficiais (IPCA, IGP-M, INPC), simulações, negociações e
            aprovação obrigatória do gestor.
          </p>
        </div>
      </div>

      {/* DESTAQUE DE REAJUSTE PROGRAMADO — EXATAMENTE NO FORMATO SOLICITADO NO BRIEFING */}
      {reajustes.map((item) => (
        <Card
          key={item.id}
          className="border-slate-200 dark:border-slate-800 bg-white dark:bg-slate-900 shadow-sm overflow-hidden"
        >
          <div className="bg-slate-900 text-white px-4 py-3 flex flex-col sm:flex-row sm:items-center justify-between gap-2 border-b border-slate-800">
            <div className="flex items-center gap-2">
              <TrendingUp className="w-4 h-4 text-emerald-400" />
              <span className="font-bold text-xs tracking-wider uppercase text-emerald-400">
                REAJUSTE PROGRAMADO
              </span>
              <span className="text-slate-400 text-xs">
                • Contrato {item.expand?.contrato?.numero || item.contrato}
              </span>
            </div>
            <div>{statusBadge(item.status)}</div>
          </div>

          <CardContent className="p-4">
            <div className="grid grid-cols-2 sm:grid-cols-4 lg:grid-cols-8 gap-3 text-xs">
              <div>
                <span className="text-slate-400 text-[10px] uppercase font-semibold">
                  Aluguel Atual
                </span>
                <div className="font-bold text-slate-800 dark:text-slate-200 mt-0.5">
                  {formatBRL(item.aluguel_anterior)}
                </div>
              </div>

              <div>
                <span className="text-slate-400 text-[10px] uppercase font-semibold">Índice</span>
                <div className="font-bold text-indigo-600 dark:text-indigo-400 mt-0.5">
                  {item.indice} ({item.tipo_indice})
                </div>
              </div>

              <div>
                <span className="text-slate-400 text-[10px] uppercase font-semibold">
                  Reajuste Estimado
                </span>
                <div className="font-bold text-slate-800 dark:text-slate-200 mt-0.5">
                  {item.percentual_aplicavel?.toFixed(2)}%
                </div>
              </div>

              <div>
                <span className="text-slate-400 text-[10px] uppercase font-semibold">
                  Novo Aluguel Estimado
                </span>
                <div className="font-bold text-emerald-600 dark:text-emerald-400 mt-0.5">
                  {formatBRL(item.aluguel_novo_projetado)}
                </div>
              </div>

              <div>
                <span className="text-slate-400 text-[10px] uppercase font-semibold">
                  Diferença Mensal
                </span>
                <div className="font-bold text-emerald-600 mt-0.5">
                  +
                  {formatBRL(
                    item.diferenca_mensal || item.aluguel_novo_projetado - item.aluguel_anterior,
                  )}
                </div>
              </div>

              <div>
                <span className="text-slate-400 text-[10px] uppercase font-semibold">
                  Diferença Anual
                </span>
                <div className="font-bold text-emerald-600 mt-0.5">
                  +
                  {formatBRL(
                    item.diferenca_anual ||
                      (item.aluguel_novo_projetado - item.aluguel_anterior) * 12,
                  )}
                </div>
              </div>

              <div>
                <span className="text-slate-400 text-[10px] uppercase font-semibold">
                  Data-base
                </span>
                <div className="font-medium text-slate-700 dark:text-slate-300 mt-0.5">
                  {formatDateBR(item.data_base)}
                </div>
              </div>

              <div className="flex items-center sm:justify-end">
                {item.status !== 'aprovado' ? (
                  <Button
                    size="sm"
                    className="bg-emerald-600 hover:bg-emerald-700 text-white text-xs h-8 gap-1 w-full sm:w-auto"
                    onClick={() => handleOpenAprovar(item)}
                  >
                    <CheckCircle2 className="w-3.5 h-3.5" />
                    Simular / Aprovar
                  </Button>
                ) : (
                  <Badge className="bg-emerald-100 text-emerald-800 border-emerald-300 dark:bg-emerald-950 dark:text-emerald-300">
                    Efetivado: {formatBRL(item.aluguel_novo_aprovado)}
                  </Badge>
                )}
              </div>
            </div>

            {item.observacao_negociacao && (
              <div className="mt-3 pt-3 border-t border-slate-100 dark:border-slate-800 text-[11px] text-slate-500">
                <strong>Observações da negociação:</strong> {item.observacao_negociacao}
              </div>
            )}
          </CardContent>
        </Card>
      ))}

      {/* DIALOG DE SIMULAÇÃO E APROVAÇÃO MANUAL */}
      <Dialog open={!!selectedReajuste} onOpenChange={(open) => !open && setSelectedReajuste(null)}>
        <DialogContent className="sm:max-w-lg">
          <DialogHeader>
            <DialogTitle className="text-base font-bold flex items-center gap-2">
              <Calculator className="w-5 h-5 text-emerald-600" />
              <span>Simulação & Aprovação de Reajuste</span>
            </DialogTitle>
          </DialogHeader>

          {selectedReajuste && (
            <div className="space-y-4 text-xs">
              <div className="p-3 bg-slate-50 dark:bg-slate-800 rounded border border-slate-200 dark:border-slate-700 space-y-1">
                <div>
                  Aluguel Atual Vigente:{' '}
                  <strong className="text-slate-900 dark:text-slate-100">
                    {formatBRL(selectedReajuste.aluguel_anterior)}
                  </strong>
                </div>
                <div>
                  Índice Contratual:{' '}
                  <strong>
                    {selectedReajuste.indice} ({selectedReajuste.tipo_indice})
                  </strong>
                </div>
                <div>
                  Período de Apuração:{' '}
                  <strong>{selectedReajuste.periodo_apuracao || 'Últimos 12 meses'}</strong>
                </div>
                <div>
                  Data de Aplicação:{' '}
                  <strong>{formatDateBR(selectedReajuste.data_aplicacao)}</strong>
                </div>
              </div>

              <div className="grid grid-cols-2 gap-3">
                <div>
                  <Label htmlFor="pct_sim" className="text-xs">
                    Percentual de Reajuste (%)
                  </Label>
                  <Input
                    id="pct_sim"
                    type="number"
                    step="0.01"
                    value={percentualSimulado}
                    onChange={(e) => handleRecalcularPorPercentual(parseFloat(e.target.value) || 0)}
                    className="text-xs mt-1"
                  />
                </div>
                <div>
                  <Label htmlFor="val_sim" className="text-xs">
                    Novo Aluguel Proposto (R$)
                  </Label>
                  <Input
                    id="val_sim"
                    type="number"
                    step="0.01"
                    value={valorSimulado}
                    onChange={(e) => handleRecalcularPorValor(parseFloat(e.target.value) || 0)}
                    className="text-xs font-bold text-emerald-600 mt-1"
                  />
                </div>
              </div>

              <div className="p-3 bg-emerald-50/50 dark:bg-emerald-950/20 rounded border border-emerald-200 dark:border-emerald-900/60 flex justify-between">
                <span>
                  Diferença Mensal:{' '}
                  <strong className="text-emerald-700">
                    +{formatBRL(valorSimulado - selectedReajuste.aluguel_anterior)}
                  </strong>
                </span>
                <span>
                  Impacto Anual:{' '}
                  <strong className="text-emerald-700">
                    +{formatBRL((valorSimulado - selectedReajuste.aluguel_anterior) * 12)}
                  </strong>
                </span>
              </div>

              <div>
                <Label htmlFor="obs_aprov" className="text-xs">
                  Registro da Negociação / Justificativa
                </Label>
                <Textarea
                  id="obs_aprov"
                  rows={2}
                  value={obsAprovacao}
                  onChange={(e) => setObsAprovacao(e.target.value)}
                  placeholder="Ex: Reajuste integral aplicado pelo IPCA fechado do período; ou desconto comercial acordado de R$ 100,00."
                  className="text-xs mt-1"
                />
              </div>

              <div className="p-2.5 bg-amber-50 dark:bg-amber-950/20 text-amber-800 dark:text-amber-300 rounded border border-amber-200 dark:border-amber-800 text-[11px]">
                ⚠️ <strong>Aviso Legal de Segurança:</strong> Ao aprovar, o valor do contrato ativo
                será alterado para {formatBRL(valorSimulado)} e as próximas competências mensais
                refletirão esse novo montante.
              </div>
            </div>
          )}

          <DialogFooter className="gap-2 sm:gap-0">
            <Button
              variant="outline"
              size="sm"
              onClick={() => setSelectedReajuste(null)}
              className="text-xs"
            >
              Cancelar
            </Button>
            <Button
              size="sm"
              onClick={handleConfirmarAprovacao}
              disabled={salvando}
              className="bg-emerald-600 hover:bg-emerald-700 text-white text-xs font-semibold"
            >
              {salvando ? 'Processando...' : 'Confirmar e Efetivar Reajuste'}
            </Button>
          </DialogFooter>
        </DialogContent>
      </Dialog>
    </div>
  )
}
