import React, { useState, useEffect } from 'react'
import { useNavigate } from 'react-router-dom'
import {
  RefreshCw,
  Clock,
  AlertCircle,
  FileText,
  CheckCircle2,
  Calendar,
  Building,
  User,
  ArrowRight,
  ShieldCheck,
  Plus,
} from 'lucide-react'
import { getRenovacoes, resolverRenovacao, formatBRL, formatDateBR } from '@/services/imobiliario'
import { RenovacaoModel } from '@/types/database'
import { Button } from '@/components/ui/button'
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

export default function RenovacoesPage() {
  const navigate = useNavigate()
  const [renovacoes, setRenovacoes] = useState<RenovacaoModel[]>([])
  const [loading, setLoading] = useState(true)

  // Modal para Ação de Renovação / Negociação
  const [selectedRenovacao, setSelectedRenovacao] = useState<RenovacaoModel | null>(null)
  const [tipoResolucao, setTipoResolucao] = useState<
    'renovado' | 'prorrogado_legal' | 'distratado' | 'resolvido'
  >('renovado')
  const [obsNegociacao, setObsNegociacao] = useState('')
  const [salvando, setSalvando] = useState(false)

  useEffect(() => {
    loadData()
  }, [])

  const loadData = async () => {
    setLoading(true)
    try {
      const list = await getRenovacoes()
      setRenovacoes(list)
    } catch (err) {
      toast({
        title: 'Erro ao carregar',
        description: 'Não foi possível carregar renovações.',
        variant: 'destructive',
      })
    } finally {
      setLoading(false)
    }
  }

  const handleResolver = async () => {
    if (!selectedRenovacao) return
    setSalvando(true)
    try {
      await resolverRenovacao(selectedRenovacao.id, tipoResolucao, obsNegociacao)
      toast({
        title: 'Status de Renovação Atualizado!',
        description: `Contrato marcado como "${tipoResolucao}". Histórico arquivado.`,
      })
      setSelectedRenovacao(null)
      loadData()
    } catch (err) {
      toast({ title: 'Erro ao atualizar', description: 'Tente novamente.', variant: 'destructive' })
    } finally {
      setSalvando(false)
    }
  }

  return (
    <div className="space-y-6">
      {/* HEADER */}
      <div className="flex flex-col sm:flex-row sm:items-center justify-between gap-4 border-b border-slate-200 dark:border-slate-800 pb-4">
        <div>
          <h1 className="text-xl font-bold tracking-tight text-slate-900 dark:text-slate-100 flex items-center gap-2">
            <span>🔄 Sistema Automático de Renovações</span>
            <Badge variant="secondary" className="text-xs">
              {renovacoes.length} alertas monitorados
            </Badge>
          </h1>
          <p className="text-xs text-slate-500 mt-1">
            Monitoramento de vencimentos nos próximos 120, 90, 60, 30, 15 e 7 dias. Distinção clara
            entre prorrogação legal, renovação formal e distrato.
          </p>
        </div>
      </div>

      {/* ALERTAS NO FORMATO EXATO DO BRIEFING DO USUÁRIO */}
      <div className="space-y-4">
        {renovacoes.map((item) => (
          <Card
            key={item.id}
            className="border-slate-200 dark:border-slate-800 bg-white dark:bg-slate-900 shadow-sm overflow-hidden"
          >
            {/* Header de Alerta no formato exigido */}
            <div className="bg-amber-600 text-white px-4 py-2.5 flex items-center justify-between">
              <div className="flex items-center gap-2 font-bold text-xs uppercase tracking-wider">
                <Clock className="w-4 h-4" />
                <span>ATENÇÃO — CONTRATO PRÓXIMO DO VENCIMENTO</span>
              </div>
              <Badge className="bg-amber-950 text-amber-100 border-none text-[10px]">
                Prazo restante: {item.dias_restantes} dias
              </Badge>
            </div>

            <CardContent className="p-4">
              <div className="grid grid-cols-2 sm:grid-cols-3 lg:grid-cols-6 gap-3 text-xs mb-4">
                <div>
                  <span className="text-slate-400 text-[10px] uppercase font-semibold">Imóvel</span>
                  <div className="font-semibold text-slate-900 dark:text-slate-100 mt-0.5">
                    Sala Comercial 01 — Paulista
                  </div>
                </div>

                <div>
                  <span className="text-slate-400 text-[10px] uppercase font-semibold">
                    Inquilino
                  </span>
                  <div className="font-semibold text-slate-900 dark:text-slate-100 mt-0.5">
                    Empresa ABC Soluções
                  </div>
                </div>

                <div>
                  <span className="text-slate-400 text-[10px] uppercase font-semibold">
                    Aluguel Atual
                  </span>
                  <div className="font-bold text-emerald-600 dark:text-emerald-400 mt-0.5">
                    R$ 3.500,00
                  </div>
                </div>

                <div>
                  <span className="text-slate-400 text-[10px] uppercase font-semibold">
                    Vencimento Contratual
                  </span>
                  <div className="font-medium text-slate-700 dark:text-slate-300 mt-0.5">
                    28/02/2027
                  </div>
                </div>

                <div>
                  <span className="text-slate-400 text-[10px] uppercase font-semibold">
                    Prazo Restante
                  </span>
                  <div className="font-bold text-amber-600 mt-0.5">{item.dias_restantes} dias</div>
                </div>

                <div>
                  <span className="text-slate-400 text-[10px] uppercase font-semibold">
                    Situação
                  </span>
                  <div className="mt-0.5">
                    <Badge
                      variant="outline"
                      className="border-amber-500 text-amber-700 dark:text-amber-300 capitalize text-[10px]"
                    >
                      {item.status.replace('_', ' ')}
                    </Badge>
                  </div>
                </div>
              </div>

              {/* AS 5 AÇÕES DISPONÍVEIS EXATAS DO BRIEFING:
                  [Visualizar contrato] [Iniciar renovação] [Registrar negociação] [Gerar aditivo] [Marcar como resolvido] */}
              <div className="pt-3 border-t border-slate-100 dark:border-slate-800 flex flex-wrap items-center gap-2">
                <Button
                  size="sm"
                  variant="outline"
                  className="text-xs h-7 gap-1"
                  onClick={() => navigate('/contratos')}
                >
                  <FileText className="w-3 h-3 text-slate-500" />
                  [Visualizar contrato]
                </Button>

                <Button
                  size="sm"
                  variant="outline"
                  className="text-xs h-7 gap-1 border-blue-300 text-blue-700 hover:bg-blue-50 dark:border-blue-800 dark:text-blue-300"
                  onClick={() => {
                    setSelectedRenovacao(item)
                    setTipoResolucao('renovado')
                  }}
                >
                  <RefreshCw className="w-3 h-3 text-blue-600" />
                  [Iniciar renovação]
                </Button>

                <Button
                  size="sm"
                  variant="outline"
                  className="text-xs h-7 gap-1 border-purple-300 text-purple-700 hover:bg-purple-50 dark:border-purple-800 dark:text-purple-300"
                  onClick={() => {
                    setSelectedRenovacao(item)
                    setTipoResolucao('prorrogado_legal')
                  }}
                >
                  [Registrar negociação]
                </Button>

                <Button
                  size="sm"
                  variant="outline"
                  className="text-xs h-7 gap-1 border-emerald-300 text-emerald-700 hover:bg-emerald-50 dark:border-emerald-800 dark:text-emerald-300"
                  onClick={() => navigate('/contratos?action=aditivo')}
                >
                  <ShieldCheck className="w-3 h-3 text-emerald-600" />
                  [Gerar aditivo]
                </Button>

                <Button
                  size="sm"
                  className="text-xs h-7 gap-1 bg-emerald-600 hover:bg-emerald-700 text-white"
                  onClick={() => {
                    setSelectedRenovacao(item)
                    setTipoResolucao('resolvido')
                  }}
                >
                  <CheckCircle2 className="w-3 h-3" />
                  [Marcar como resolvido]
                </Button>
              </div>
            </CardContent>
          </Card>
        ))}
      </div>

      {/* DIALOG DE RESOLUÇÃO DE RENOVAÇÃO */}
      <Dialog
        open={!!selectedRenovacao}
        onOpenChange={(open) => !open && setSelectedRenovacao(null)}
      >
        <DialogContent className="sm:max-w-md">
          <DialogHeader>
            <DialogTitle className="text-base font-bold flex items-center gap-2">
              <RefreshCw className="w-4 h-4 text-emerald-600" />
              <span>Tratar Renovação Contratual</span>
            </DialogTitle>
          </DialogHeader>

          {selectedRenovacao && (
            <div className="space-y-4 text-xs">
              <div>
                <Label htmlFor="tipo_res" className="text-xs">
                  Desfecho Contratual
                </Label>
                <select
                  id="tipo_res"
                  value={tipoResolucao}
                  onChange={(e) => setTipoResolucao(e.target.value as any)}
                  className="w-full h-9 text-xs mt-1 bg-slate-50 dark:bg-slate-800 border border-slate-200 dark:border-slate-700 rounded-md px-2"
                >
                  <option value="renovado">Renovação Formal (Novo Período/Valor)</option>
                  <option value="prorrogado_legal">Prorrogação Legal (Prazo Indeterminado)</option>
                  <option value="distratado">Distrato / Devolução de Chaves</option>
                  <option value="resolvido">Resolvido (Manter Condições)</option>
                </select>
              </div>

              <div>
                <Label htmlFor="obs_ren" className="text-xs">
                  Registro da Negociação / Condições Acordadas
                </Label>
                <Textarea
                  id="obs_ren"
                  rows={3}
                  value={obsNegociacao}
                  onChange={(e) => setObsNegociacao(e.target.value)}
                  placeholder="Ex: Proposta aceita pelo inquilino de R$ 3.800,00 por mais 24 meses; minuta enviada para assinatura digital."
                  className="text-xs mt-1"
                />
              </div>

              <div className="p-2.5 bg-slate-50 dark:bg-slate-800 rounded text-slate-500 text-[11px]">
                ℹ️ <strong>Importante:</strong> Contratos vencidos NÃO são automaticamente
                encerrados na plataforma, garantindo segurança jurídica patrimonial.
              </div>
            </div>
          )}

          <DialogFooter className="gap-2 sm:gap-0">
            <Button
              variant="outline"
              size="sm"
              onClick={() => setSelectedRenovacao(null)}
              className="text-xs"
            >
              Cancelar
            </Button>
            <Button
              size="sm"
              onClick={handleResolver}
              disabled={salvando}
              className="bg-emerald-600 hover:bg-emerald-700 text-white text-xs"
            >
              {salvando ? 'Salvando...' : 'Confirmar e Atualizar'}
            </Button>
          </DialogFooter>
        </DialogContent>
      </Dialog>
    </div>
  )
}
