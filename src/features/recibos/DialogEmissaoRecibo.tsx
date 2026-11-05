import React, { useEffect, useState } from 'react'
import {
  Dialog,
  DialogContent,
  DialogDescription,
  DialogFooter,
  DialogHeader,
  DialogTitle,
} from '@/components/ui/dialog'
import { Button } from '@/components/ui/button'
import { Input } from '@/components/ui/input'
import { Label } from '@/components/ui/label'
import { Textarea } from '@/components/ui/textarea'
import { RadioGroup, RadioGroupItem } from '@/components/ui/radio-group'
import { useToast } from '@/hooks/use-toast'
import {
  AlertTriangle,
  CheckCircle2,
  Download,
  Eye,
  FileCheck,
  FileSignature,
  FileText,
  Loader2,
  Send,
  Settings2,
} from 'lucide-react'
import { Switch } from '@/components/ui/switch'
import {
  CONFIG_RECIBO_PADRAO,
  buscarRecibo,
  emitirReciboAluguel,
  emitirReciboEEnviar,
  getReciboConfig,
} from '@/services/recibos'
import type {
  CorDestaqueRecibo,
  ReciboAluguelDados,
  ReciboPersonalizacao,
} from '@/features/recibos/tipos'
import type { CobrancaModel } from '@/types/database'
import { PreviaRecibo } from '@/components/configuracoes/PreviaRecibo'
import { cn } from '@/lib/utils'

interface DialogEmissaoReciboProps {
  cobranca: CobrancaModel | null
  open: boolean
  onOpenChange: (open: boolean) => void
  onSucesso?: () => void
}

export function DialogEmissaoRecibo({
  cobranca,
  open,
  onOpenChange,
  onSucesso,
}: DialogEmissaoReciboProps) {
  const { toast } = useToast()

  const [carregandoDados, setCarregandoDados] = useState(false)
  const [emitindo, setEmitindo] = useState(false)
  const [enviandoWhats, setEnviandoWhats] = useState(false)
  const [dadosRecibo, setDadosRecibo] = useState<ReciboAluguelDados | null>(null)
  const [reciboGeradoUrl, setReciboGeradoUrl] = useState<string | null>(null)

  // Personalização editável para ESTE recibo
  const [personalizacao, setPersonalizacao] = useState<ReciboPersonalizacao>(CONFIG_RECIBO_PADRAO)
  const [expandirAjustes, setExpandirAjustes] = useState(false)

  // Status de bloqueio se não houver quitação
  const valorRecebido = Number(cobranca?.valor_pago || 0)
  const statusPago = cobranca?.status === 'pago' || cobranca?.status === 'pago_parcialmente'
  const podeEmitir = statusPago && valorRecebido > 0

  useEffect(() => {
    if (!open || !cobranca) {
      setDadosRecibo(null)
      setReciboGeradoUrl(null)
      setExpandirAjustes(false)
      return
    }

    const carregar = async () => {
      setCarregandoDados(true)
      try {
        const [configSalva, dados] = await Promise.all([
          getReciboConfig().catch(() => CONFIG_RECIBO_PADRAO),
          buscarRecibo(cobranca.id),
        ])

        setPersonalizacao(configSalva)
        setDadosRecibo(dados)
        if (dados.url) {
          setReciboGeradoUrl(dados.url)
        }
      } catch (err: unknown) {
        const msg = err instanceof Error ? err.message : 'Falha ao buscar dados da cobrança.'
        toast({
          title: 'Não foi possível preparar o recibo',
          description: msg,
          variant: 'destructive',
        })
      } finally {
        setCarregandoDados(false)
      }
    }

    carregar()
  }, [open, cobranca, toast])

  const handleGerarApenasPdf = async () => {
    if (!cobranca) return
    setEmitindo(true)
    try {
      const res = await emitirReciboAluguel(cobranca.id, personalizacao)
      setReciboGeradoUrl(res.url)
      toast({
        title: 'Recibo gerado com sucesso!',
        description: `Recibo nº ${res.numero} salvo em Documentos.`,
      })
      onSucesso?.()
    } catch (err: unknown) {
      const msg = err instanceof Error ? err.message : 'Erro ao emitir recibo.'
      toast({
        title: 'Falha na emissão',
        description: msg,
        variant: 'destructive',
      })
    } finally {
      setEmitindo(false)
    }
  }

  const handleGerarEEnviarWhatsApp = async () => {
    if (!cobranca) return
    setEnviandoWhats(true)
    try {
      const resRecibo = await emitirReciboAluguel(cobranca.id, personalizacao)
      setReciboGeradoUrl(resRecibo.url)
      const resFila = await emitirReciboEEnviar(cobranca.id, resRecibo.url)

      toast({
        title: 'Recibo gerado e encaminhado!',
        description: resFila.dedupe
          ? `Recibo ${resRecibo.numero} já constava na fila do WhatsApp.`
          : `Recibo ${resRecibo.numero} adicionado à fila do WhatsApp (📱 WhatsApp para envio).`,
      })
      onSucesso?.()
      onOpenChange(false)
    } catch (err: unknown) {
      const msg = err instanceof Error ? err.message : 'Erro ao processar recibo e fila WhatsApp.'
      toast({
        title: 'Falha na operação',
        description: msg,
        variant: 'destructive',
      })
    } finally {
      setEnviandoWhats(false)
    }
  }

  return (
    <Dialog open={open} onOpenChange={onOpenChange}>
      <DialogContent className="max-w-4xl max-h-[90vh] overflow-y-auto">
        <DialogHeader>
          <DialogTitle className="flex items-center gap-2 text-base font-bold text-slate-900 dark:text-slate-100">
            <FileText className="w-5 h-5 text-primary" />
            Emissão de Recibo de Aluguel
            {cobranca && (
              <span className="text-xs font-normal text-slate-500">
                · Competência {cobranca.competencia}
              </span>
            )}
          </DialogTitle>
          <DialogDescription className="text-xs">
            Revise a prévia, personalize os dados do emitente e observações deste recibo antes de
            gerar o documento oficial.
          </DialogDescription>
        </DialogHeader>

        {carregandoDados ? (
          <div className="flex flex-col items-center justify-center p-12 text-slate-500">
            <Loader2 className="w-6 h-6 animate-spin text-primary mb-2" />
            <span className="text-xs">Carregando dados da cobrança e personalização...</span>
          </div>
        ) : !podeEmitir ? (
          <div className="p-4 rounded-lg border border-amber-200 dark:border-amber-900/60 bg-amber-50 dark:bg-amber-950/30 text-amber-900 dark:text-amber-200 space-y-2">
            <div className="flex items-center gap-2 font-semibold text-xs">
              <AlertTriangle className="w-4 h-4 text-amber-600 dark:text-amber-400 shrink-0" />
              Recibo bloqueado: cobrança ainda não quitada
            </div>
            <p className="text-xs leading-relaxed">
              O recibo de quitação só pode ser emitido após o registro da baixa do pagamento (status{' '}
              <strong>Pago</strong> ou <strong>Pago parcialmente</strong>). Dê a baixa nesta
              cobrança antes de emitir o recibo.
            </p>
          </div>
        ) : (
          <div className="space-y-4">
            {/* AVISO SE JÁ TEM RECIBO GERADO */}
            {reciboGeradoUrl && (
              <div className="p-3 rounded-lg border border-emerald-200 dark:border-emerald-900/60 bg-emerald-50 dark:bg-emerald-950/30 text-emerald-900 dark:text-emerald-200 flex items-center justify-between gap-3 text-xs">
                <div className="flex items-center gap-2">
                  <CheckCircle2 className="w-4 h-4 text-emerald-600 dark:text-emerald-400 shrink-0" />
                  <span>
                    Esta cobrança já possui um recibo oficial emitido (nº{' '}
                    {dadosRecibo?.numero || cobranca?.recibo_gerado || '—'}).
                  </span>
                </div>
                <Button
                  type="button"
                  size="sm"
                  variant="outline"
                  className="h-7 text-xs gap-1 border-emerald-300 dark:border-emerald-800"
                  onClick={() => window.open(reciboGeradoUrl, '_blank')}
                >
                  <Download className="w-3.5 h-3.5" />
                  Abrir PDF Existente
                </Button>
              </div>
            )}

            {/* BARRA DE ATALHO PARA PERSONALIZAÇÃO RÁPIDA */}
            <div className="border border-slate-200 dark:border-slate-800 rounded-lg p-3 bg-slate-50 dark:bg-slate-900/50 space-y-3">
              <div className="flex items-center justify-between">
                <span className="text-xs font-semibold text-slate-800 dark:text-slate-200 flex items-center gap-1.5">
                  <Settings2 className="w-4 h-4 text-gold-dark dark:text-gold-luminous" />
                  Ajustes pontuais para este recibo
                </span>
                <Button
                  type="button"
                  variant="ghost"
                  size="sm"
                  onClick={() => setExpandirAjustes((v) => !v)}
                  className="text-xs h-7 text-slate-600 dark:text-slate-400"
                >
                  {expandirAjustes ? 'Ocultar ajustes' : 'Personalizar textos e emitente'}
                </Button>
              </div>

              {expandirAjustes && (
                <div className="pt-2 border-t border-slate-200 dark:border-slate-800 grid grid-cols-1 md:grid-cols-2 gap-3 text-xs">
                  <div className="space-y-1">
                    <Label className="text-[11px]">Emitente / Locador</Label>
                    <Input
                      value={personalizacao.emitente_nome || ''}
                      onChange={(e) =>
                        setPersonalizacao({ ...personalizacao, emitente_nome: e.target.value })
                      }
                      placeholder="Nome ou razão social"
                      className="text-xs h-8"
                    />
                  </div>

                  <div className="space-y-1">
                    <Label className="text-[11px]">CPF/CNPJ do Emitente</Label>
                    <Input
                      value={personalizacao.emitente_cpf_cnpj || ''}
                      onChange={(e) =>
                        setPersonalizacao({
                          ...personalizacao,
                          emitente_cpf_cnpj: e.target.value,
                        })
                      }
                      placeholder="CPF ou CNPJ"
                      className="text-xs h-8"
                    />
                  </div>

                  <div className="space-y-1">
                    <Label className="text-[11px]">Título do Documento</Label>
                    <Input
                      value={personalizacao.titulo_documento || ''}
                      onChange={(e) =>
                        setPersonalizacao({
                          ...personalizacao,
                          titulo_documento: e.target.value,
                        })
                      }
                      placeholder="Ex: RECIBO DE ALUGUEL"
                      className="text-xs h-8"
                    />
                  </div>

                  <div className="space-y-1">
                    <Label className="text-[11px]">Cor de Destaque</Label>
                    <RadioGroup
                      value={personalizacao.cor_destaque || 'navy'}
                      onValueChange={(v) =>
                        setPersonalizacao({
                          ...personalizacao,
                          cor_destaque: v as CorDestaqueRecibo,
                        })
                      }
                      className="flex gap-2"
                    >
                      {[
                        { id: 'navy', label: 'Azul', cor: 'bg-[#06182B]' },
                        { id: 'gold', label: 'Dourado', cor: 'bg-[#D4A347]' },
                        { id: 'orange', label: 'Laranja', cor: 'bg-[#F15A24]' },
                      ].map((item) => (
                        <label
                          key={item.id}
                          className={cn(
                            'flex items-center gap-1.5 px-2 py-1 rounded border text-[11px] cursor-pointer',
                            (personalizacao.cor_destaque || 'navy') === item.id
                              ? 'border-primary bg-primary/5'
                              : 'border-slate-200 dark:border-slate-800',
                          )}
                        >
                          <RadioGroupItem value={item.id} className="sr-only" />
                          <span className={cn('w-2.5 h-2.5 rounded-full', item.cor)} />
                          <span>{item.label}</span>
                        </label>
                      ))}
                    </RadioGroup>
                  </div>

                  <div className="space-y-1 md:col-span-2">
                    <div className="flex items-center justify-between">
                      <Label className="text-[11px] font-semibold text-slate-800 dark:text-slate-200">
                        Observações específicas desta quitação
                      </Label>
                      <span className="text-[10px] text-slate-400">
                        Deixe vazio para não exibir o bloco
                      </span>
                    </div>
                    <Textarea
                      rows={2}
                      value={personalizacao.observacoes || ''}
                      onChange={(e) =>
                        setPersonalizacao({ ...personalizacao, observacoes: e.target.value })
                      }
                      placeholder="Ex: Pagamento referente ao aluguel e encargos locatícios..."
                      className="text-xs"
                    />
                    <p className="text-[10px] text-slate-400">
                      Exibido no documento impresso como bloco visível acima da assinatura. Altera
                      apenas esta emissão pontual.
                    </p>
                  </div>

                  {/* Ajustes de Assinatura no Diálogo */}
                  <div className="md:col-span-2 pt-2 border-t border-slate-200 dark:border-slate-800 space-y-2">
                    <div className="flex items-center justify-between">
                      <Label
                        htmlFor="dialog_exibir_assinaturas"
                        className="text-[11px] font-semibold flex items-center gap-1.5 cursor-pointer"
                      >
                        <FileSignature className="w-3.5 h-3.5 text-primary" />
                        Linha de Assinatura (Locador / Emitente)
                      </Label>
                      <div className="flex items-center gap-1.5">
                        <span className="text-[10px] text-slate-500">
                          {personalizacao.exibir_assinaturas !== false
                            ? 'Exibir no recibo'
                            : 'Ocultar'}
                        </span>
                        <Switch
                          id="dialog_exibir_assinaturas"
                          checked={personalizacao.exibir_assinaturas !== false}
                          onCheckedChange={(checked) =>
                            setPersonalizacao({ ...personalizacao, exibir_assinaturas: checked })
                          }
                        />
                      </div>
                    </div>

                    {personalizacao.exibir_assinaturas !== false && (
                      <div className="space-y-0.5 pt-1">
                        <Label className="text-[10px] text-slate-500">
                          Rótulo Emitente / Locador
                        </Label>
                        <Input
                          value={personalizacao.rotulo_assinatura_emitente ?? 'Locador / Emitente'}
                          onChange={(e) =>
                            setPersonalizacao({
                              ...personalizacao,
                              rotulo_assinatura_emitente: e.target.value,
                            })
                          }
                          placeholder="Locador / Emitente"
                          className="text-xs h-7"
                        />
                      </div>
                    )}
                  </div>
                </div>
              )}
            </div>

            {/* PRÉVIA VISUAL DO RECIBO */}
            <div className="space-y-2">
              <div className="flex items-center justify-between text-xs text-slate-500 font-semibold">
                <span className="flex items-center gap-1.5">
                  <Eye className="w-3.5 h-3.5 text-primary" />
                  Prévia do documento oficial a ser gerado
                </span>
                <span>Visualização A4 proporcional</span>
              </div>

              <div className="max-h-[380px] overflow-y-auto p-3 bg-slate-100 dark:bg-slate-900/80 rounded-lg border border-slate-200 dark:border-slate-800 flex justify-center">
                <PreviaRecibo
                  dados={personalizacao}
                  amostra={
                    dadosRecibo
                      ? {
                          numero: dadosRecibo.numero || 'A GERAR',
                          competencia: dadosRecibo.cobranca.competencia,
                          inquilinoNome: dadosRecibo.inquilino.nome,
                          inquilinoDoc: dadosRecibo.inquilino.cpf_cnpj,
                          imovelRotulo:
                            dadosRecibo.imovel.rotulo || dadosRecibo.imovel.endereco || '—',
                          valorAluguel: dadosRecibo.cobranca.valor_aluguel,
                          valorCondominio: dadosRecibo.cobranca.valor_condominio,
                          valorIptu: dadosRecibo.cobranca.valor_iptu,
                          valorTotal: dadosRecibo.cobranca.valor_total,
                          valorPago: dadosRecibo.cobranca.valor_pago,
                          dataPagamento: dadosRecibo.data_pagamento_br,
                          formaPagamento: dadosRecibo.cobranca.forma_pagamento,
                        }
                      : undefined
                  }
                />
              </div>
            </div>
          </div>
        )}

        <DialogFooter className="flex flex-col sm:flex-row sm:items-center justify-between gap-2 pt-2 border-t border-slate-200 dark:border-slate-800">
          <Button
            type="button"
            variant="ghost"
            size="sm"
            onClick={() => onOpenChange(false)}
            className="text-xs"
          >
            Fechar
          </Button>

          {podeEmitir && (
            <div className="flex items-center gap-2">
              <Button
                type="button"
                variant="outline"
                size="sm"
                onClick={handleGerarApenasPdf}
                disabled={emitindo || enviandoWhats}
                className="text-xs gap-1.5 border-slate-300 dark:border-slate-700"
              >
                {emitindo ? (
                  <Loader2 className="w-3.5 h-3.5 animate-spin" />
                ) : (
                  <FileCheck className="w-3.5 h-3.5" />
                )}
                {reciboGeradoUrl ? 'Regerar Recibo (PDF)' : 'Gerar Recibo (PDF)'}
              </Button>

              <Button
                type="button"
                size="sm"
                onClick={handleGerarEEnviarWhatsApp}
                disabled={emitindo || enviandoWhats}
                className="text-xs gap-1.5 bg-emerald-600 hover:bg-emerald-700 text-white"
              >
                {enviandoWhats ? (
                  <Loader2 className="w-3.5 h-3.5 animate-spin" />
                ) : (
                  <Send className="w-3.5 h-3.5" />
                )}
                Gerar e Enviar p/ WhatsApp
              </Button>
            </div>
          )}
        </DialogFooter>
      </DialogContent>
    </Dialog>
  )
}
export default DialogEmissaoRecibo
