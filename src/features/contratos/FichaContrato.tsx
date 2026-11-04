import React, { useEffect, useState } from 'react'
import {
  FileText,
  FilePlus2,
  CalendarPlus,
  GitBranch,
  KeyRound,
  KeySquare,
  History,
  Loader2,
} from 'lucide-react'
import { Badge } from '@/components/ui/badge'
import { Button } from '@/components/ui/button'
import { Input } from '@/components/ui/input'
import { Label } from '@/components/ui/label'
import { Textarea } from '@/components/ui/textarea'
import {
  Dialog,
  DialogContent,
  DialogHeader,
  DialogTitle,
  DialogFooter,
} from '@/components/ui/dialog'
import {
  Select,
  SelectContent,
  SelectItem,
  SelectTrigger,
  SelectValue,
} from '@/components/ui/select'
import { toast } from '@/hooks/use-toast'
import {
  AditivoModel,
  CobrancaModel,
  ContratoModel,
  DocumentoModel,
  PendenciaModel,
  RenovacaoModel,
} from '@/types/database'
import { formatBRL } from '@/services/imobiliario'
import {
  ItemHistorico,
  ParamsAditivo,
  ParamsDistrato,
  ParamsRenovacao,
  anexarDocumentoContrato,
  aditivoDocumentoUrl,
  arquivoUrl,
  encerrarPorDistrato,
  formatDateBR,
  getAditivosContrato,
  getCobrancasContrato,
  getDocumentosContrato,
  getHistoricoCronologico,
  getPendenciasContrato,
  getRenovacoesContrato,
  prorrogarPrazo,
  registrarAditivo,
  renovarContrato,
  rotuloAcao,
} from './operacoes'
import {
  SituacaoFinanceira,
  badgeSituacaoFinanceira,
  pendenciasAbertas,
  situacaoFinanceiraContrato,
  statusBadgeContrato,
  statusRenovacaoContrato,
} from './ui'

interface FichaContratoProps {
  contrato: ContratoModel
  onClose: () => void
  aoAlterar: () => void
}

type AcaoAtiva = 'aditivo' | 'renovacao' | 'prorrogar' | 'distrato' | 'anexo' | null

/** Ficha completa do contrato: resumo do briefing, ações de ciclo de vida,
 * anexos e histórico cronológico auditável. */
export default function FichaContrato({ contrato, onClose, aoAlterar }: FichaContratoProps) {
  const [aditivos, setAditivos] = useState<AditivoModel[]>([])
  const [renovacoes, setRenovacoes] = useState<RenovacaoModel[]>([])
  const [documentos, setDocumentos] = useState<DocumentoModel[]>([])
  const [cobrancas, setCobrancas] = useState<CobrancaModel[]>([])
  const [pendencias, setPendencias] = useState<PendenciaModel[]>([])
  const [historico, setHistorico] = useState<ItemHistorico[]>([])
  const [carregando, setCarregando] = useState(true)
  const [acao, setAcao] = useState<AcaoAtiva>(null)
  const [salvando, setSalvando] = useState(false)

  // Formulários
  const [formAditivo, setFormAditivo] = useState<
    Pick<ParamsAditivo, 'dataAditivo' | 'tipoAlteracao' | 'descricao' | 'valorNovo' | 'dataFimNova'>
  >({ dataAditivo: hoje(), tipoAlteracao: 'valor', descricao: '' })
  const [formRenovacao, setFormRenovacao] = useState<
    Pick<ParamsRenovacao, 'novoFim' | 'novoValor' | 'observacoes'>
  >({ novoFim: '', novoValor: undefined, observacoes: '' })
  const [formProrrogar, setFormProrrogar] = useState('')
  const [formDistrato, setFormDistrato] = useState<
    Pick<ParamsDistrato, 'dataDistrato' | 'motivo' | 'entregaChaves'>
  >({
    dataDistrato: hoje(),
    motivo: '',
    entregaChaves: '',
  })
  const [formAnexo, setFormAnexo] = useState<{
    arquivo: File | null
    titulo: string
    tipo: DocumentoModel['tipo']
  }>({ arquivo: null, titulo: '', tipo: 'contrato' })

  useEffect(() => {
    let ativo = true
    setCarregando(true)
    ;(async () => {
      try {
        const [ad, rn, dc, cb, pd, hs] = await Promise.all([
          getAditivosContrato(contrato.id),
          getRenovacoesContrato(contrato.id),
          getDocumentosContrato(contrato.id),
          getCobrancasContrato(contrato.id),
          getPendenciasContrato(contrato.id),
          getHistoricoCronologico(contrato.id),
        ])
        if (!ativo) return
        setAditivos(ad)
        setRenovacoes(rn)
        setDocumentos(dc)
        setCobrancas(cb)
        setPendencias(pd)
        setHistorico(hs)
      } finally {
        if (ativo) setCarregando(false)
      }
    })()
    return () => {
      ativo = false
    }
  }, [contrato.id])

  const situacao: SituacaoFinanceira = situacaoFinanceiraContrato(cobrancas)
  const renovStatus = statusRenovacaoContrato(renovacoes)
  const abertas = pendenciasAbertas(contrato.id, pendencias)
  const proximaCobranca = cobrancas
    .filter((c) => c.status === 'a_vencer' || c.status === 'vencido')
    .sort((a, b) => (a.vencimento < b.vencimento ? -1 : 1))[0]

  async function salvarAcao() {
    setSalvando(true)
    try {
      if (acao === 'aditivo') {
        if (!formAditivo.descricao.trim()) {
          toast({ title: 'Informe a descrição do aditivo', variant: 'destructive' })
          return
        }
        await registrarAditivo({
          contratoId: contrato.id,
          dataAditivo: formAditivo.dataAditivo,
          tipoAlteracao: formAditivo.tipoAlteracao,
          descricao: formAditivo.descricao,
          valorNovo:
            formAditivo.tipoAlteracao === 'valor' && formAditivo.valorNovo
              ? formAditivo.valorNovo
              : undefined,
          dataFimNova:
            formAditivo.tipoAlteracao === 'prazo'
              ? formAditivo.dataFimNova || undefined
              : undefined,
        })
        toast({
          title: 'Aditivo registrado',
          description: 'Alteração aplicada e registrada no histórico.',
        })
      } else if (acao === 'renovacao') {
        if (!formRenovacao.novoFim) {
          toast({ title: 'Informe a nova data de término', variant: 'destructive' })
          return
        }
        await renovarContrato({
          contratoId: contrato.id,
          novoFim: formRenovacao.novoFim,
          novoValor: formRenovacao.novoValor,
          observacoes: formRenovacao.observacoes,
        })
        toast({
          title: 'Contrato renovado',
          description: 'Valores anteriores preservados no histórico.',
        })
      } else if (acao === 'prorrogar') {
        if (!formProrrogar) {
          toast({ title: 'Informe a nova data de término', variant: 'destructive' })
          return
        }
        await prorrogarPrazo(contrato.id, formProrrogar)
        toast({
          title: 'Prazo prorrogado',
          description: 'Aditivo de prazo registrado no histórico.',
        })
      } else if (acao === 'distrato') {
        if (!formDistrato.motivo.trim()) {
          toast({ title: 'Informe o motivo do distrato', variant: 'destructive' })
          return
        }
        await encerrarPorDistrato({
          contratoId: contrato.id,
          dataDistrato: formDistrato.dataDistrato,
          motivo: formDistrato.motivo,
          entregaChaves: formDistrato.entregaChaves || undefined,
        })
        toast({ title: 'Contrato distratado', description: 'Imóvel devolvido como disponível.' })
      } else if (acao === 'anexo') {
        if (!formAnexo.arquivo) {
          toast({ title: 'Selecione o arquivo (PDF ou documento)', variant: 'destructive' })
          return
        }
        await anexarDocumentoContrato({
          contratoId: contrato.id,
          imovelId: contrato.imovel,
          inquilinoId: contrato.inquilino,
          arquivo: formAnexo.arquivo,
          titulo: formAnexo.titulo || formAnexo.arquivo.name,
          tipo: formAnexo.tipo,
        })
        toast({ title: 'Documento anexado', description: 'Disponível na ficha do contrato.' })
      }
      setAcao(null)
      aoAlterar()
    } catch (e) {
      toast({
        title: 'Erro ao registrar',
        description: 'Verifique os dados e tente novamente.',
        variant: 'destructive',
      })
    } finally {
      setSalvando(false)
    }
  }

  return (
    <div className="space-y-4 text-xs">
      {/* Resumo (tabela do briefing) */}
      <div className="grid grid-cols-2 sm:grid-cols-4 gap-2">
        <Celula rotulo="Imóvel" valor={contrato.expand?.imovel?.nome || contrato.imovel} />
        <Celula rotulo="Inquilino" valor={contrato.expand?.inquilino?.nome || contrato.inquilino} />
        <Celula rotulo="Prazo" valor={`${contrato.prazo_meses || '—'} meses`} />
        <Celula rotulo="Valor inicial" valor={formatBRL(contrato.valor_inicial)} />
        <Celula rotulo="Aluguel atual" valor={formatBRL(contrato.valor_atual)} destaque />
        <Celula rotulo="Garantia" valor={contrato.garantia_tipo.replace('_', ' ')} />
        <Celula rotulo="Início" valor={formatDateBR(contrato.data_inicio)} />
        <Celula rotulo="Término" valor={formatDateBR(contrato.data_fim)} />
        <Celula rotulo="Próx. reajuste" valor={formatDateBR(contrato.data_base_reajuste)} />
        <Celula
          rotulo="Índice"
          valor={`${contrato.indice_reajuste} (${contrato.periodicidade_reajuste})`}
        />
        <Celula
          rotulo="Próx. vencimento"
          valor={
            proximaCobranca
              ? formatDateBR(proximaCobranca.vencimento)
              : `Dia ${contrato.dia_vencimento}`
          }
        />
        <Celula rotulo="Situação financeira" valor={badgeSituacaoFinanceira(situacao)} />
        <Celula
          rotulo="Renovação"
          valor={renovStatus || <span className="text-muted-foreground">Sem negociação</span>}
        />
        <Celula
          rotulo="Pendências vinculadas"
          valor={
            abertas.length > 0 ? (
              <Badge className="bg-gradient-amber text-white border-transparent text-[10px]">
                {abertas.length} em aberto
              </Badge>
            ) : (
              <span className="text-muted-foreground">Nenhuma</span>
            )
          }
        />
        <Celula
          rotulo="Assinatura"
          valor={contrato.data_assinatura ? formatDateBR(contrato.data_assinatura) : '—'}
        />
        <Celula
          rotulo="Locador"
          valor={contrato.locador_nome || contrato.expand?.imovel?.nome || '—'}
        />
      </div>

      {contrato.status === 'distratado' && contrato.motivo_distrato && (
        <div className="p-2.5 rounded-xl border border-rose-200 bg-gradient-rose-soft dark:border-rose-500/30 text-rose-700 dark:text-rose-300">
          <strong>Distrato</strong> em {formatDateBR(contrato.data_distrato)} ·{' '}
          {contrato.motivo_distrato}
          {contrato.entrega_chaves_data
            ? ` · Chaves entregues em ${formatDateBR(contrato.entrega_chaves_data)}`
            : ''}
        </div>
      )}

      {/* Ações do ciclo de vida */}
      <div className="flex flex-wrap gap-2">
        <BotaoAcao icone={<GitBranch className="w-3.5 h-3.5" />} onClick={() => setAcao('aditivo')}>
          Registrar aditivo
        </BotaoAcao>
        <BotaoAcao icone={<History className="w-3.5 h-3.5" />} onClick={() => setAcao('renovacao')}>
          Renovar contrato
        </BotaoAcao>
        <BotaoAcao
          icone={<CalendarPlus className="w-3.5 h-3.5" />}
          onClick={() => setAcao('prorrogar')}
        >
          Prorrogar prazo
        </BotaoAcao>
        <BotaoAcao
          icone={<KeySquare className="w-3.5 h-3.5" />}
          onClick={() => setAcao('distrato')}
        >
          Distrato / encerrar
        </BotaoAcao>
        <BotaoAcao icone={<FilePlus2 className="w-3.5 h-3.5" />} onClick={() => setAcao('anexo')}>
          Anexar documento
        </BotaoAcao>
      </div>

      {/* Aditivos */}
      <Secao titulo={`Aditivos registrados (${aditivos.length})`}>
        {aditivos.length === 0 ? (
          <SemDados texto="Nenhum aditivo registrado." />
        ) : (
          aditivos.map((a) => (
            <div key={a.id} className="p-2.5 rounded-xl border border-border/70 bg-muted/40">
              <div className="flex items-center justify-between gap-2">
                <strong>
                  Aditivo nº {a.numero_sequencial} · {formatDateBR(a.data_aditivo)}
                </strong>
                <Badge variant="outline" className="text-[10px] capitalize">
                  {a.tipo_alteracao}
                </Badge>
              </div>
              <div className="mt-1 text-muted-foreground">{a.descricao}</div>
              <div className="mt-1 flex flex-wrap gap-3 text-[10px] text-muted-foreground">
                {a.valor_anterior != null && a.valor_novo != null && (
                  <span>
                    Valor: {formatBRL(a.valor_anterior)} →{' '}
                    <strong className="text-foreground">{formatBRL(a.valor_novo)}</strong>
                  </span>
                )}
                {a.data_fim_anterior && a.data_fim_nova && (
                  <span>
                    Término: {formatDateBR(a.data_fim_anterior)} →{' '}
                    <strong className="text-foreground">{formatDateBR(a.data_fim_nova)}</strong>
                  </span>
                )}
                <span className="capitalize">Status: {a.status.replace('_', ' ')}</span>
                {a.documento?.length ? (
                  <a
                    className="text-primary underline underline-offset-2"
                    href={aditivoDocumentoUrl(a)}
                    target="_blank"
                    rel="noreferrer"
                  >
                    Ver documento
                  </a>
                ) : null}
              </div>
            </div>
          ))
        )}
      </Secao>

      {/* Documentos anexados */}
      <Secao titulo={`Documentos anexados (${documentos.length})`}>
        {documentos.length === 0 ? (
          <SemDados texto="Nenhum documento anexado — contratos sem documento aparecem sinalizados na listagem." />
        ) : (
          <div className="grid grid-cols-1 sm:grid-cols-2 gap-2">
            {documentos.map((d) => (
              <a
                key={d.id}
                href={arquivoUrl(d)}
                target="_blank"
                rel="noreferrer"
                className="flex items-center gap-2 p-2.5 rounded-xl border border-border/70 bg-muted/40 hover:bg-accent transition-colors"
              >
                <FileText className="w-4 h-4 text-primary shrink-0" />
                <div className="min-w-0">
                  <div className="font-semibold truncate">{d.titulo}</div>
                  <div className="text-[10px] text-muted-foreground capitalize">
                    {d.tipo.replace('_', ' ')}{' '}
                    {d.data_documento ? `· ${formatDateBR(d.data_documento)}` : ''}
                  </div>
                </div>
              </a>
            ))}
          </div>
        )}
      </Secao>

      {/* Histórico cronológico e auditável */}
      <Secao titulo={`Histórico cronológico (${historico.length} eventos)`}>
        {carregando ? (
          <div className="flex items-center gap-2 text-muted-foreground py-2">
            <Loader2 className="w-3.5 h-3.5 animate-spin" /> Carregando histórico...
          </div>
        ) : historico.length === 0 ? (
          <SemDados texto="Sem eventos registrados ainda." />
        ) : (
          <ol className="relative border-l-2 border-violet-200 dark:border-violet-500/30 ml-2 space-y-3">
            {historico.map((h) => (
              <li key={h.id} className="ml-4">
                <span className="absolute -left-[7px] w-3 h-3 rounded-full bg-gradient-brand shadow-glow-brand/50 border-2 border-background" />
                <div className="flex items-baseline gap-2 flex-wrap">
                  <strong className="text-foreground">{h.titulo}</strong>
                  <span className="text-[10px] text-muted-foreground">
                    {formatDateBR(h.data)} · {rotuloAcao(h.acao)}
                  </span>
                </div>
                {h.detalhes && <div className="text-muted-foreground mt-0.5">{h.detalhes}</div>}
              </li>
            ))}
          </ol>
        )}
      </Secao>

      {/* Diálogos de ação */}
      <Dialog open={acao !== null} onOpenChange={(open) => !open && setAcao(null)}>
        <DialogContent className="sm:max-w-md">
          <DialogHeader>
            <DialogTitle className="text-sm font-bold">
              {tituloAcao(acao, contrato.numero)}
            </DialogTitle>
          </DialogHeader>
          <div className="space-y-3 text-xs">
            {acao === 'aditivo' && (
              <>
                <Campo label="Tipo de alteração">
                  <Select
                    value={formAditivo.tipoAlteracao}
                    onValueChange={(v) =>
                      setFormAditivo((f) => ({
                        ...f,
                        tipoAlteracao: v as ParamsAditivo['tipoAlteracao'],
                      }))
                    }
                  >
                    <SelectTrigger className="h-8 text-xs">
                      <SelectValue />
                    </SelectTrigger>
                    <SelectContent>
                      <SelectItem value="valor">Valor do aluguel</SelectItem>
                      <SelectItem value="prazo">Prazo / término</SelectItem>
                      <SelectItem value="garantia">Garantia</SelectItem>
                      <SelectItem value="clausula">Cláusula</SelectItem>
                      <SelectItem value="outros">Outros</SelectItem>
                    </SelectContent>
                  </Select>
                </Campo>
                <Campo label="Data do aditivo">
                  <Input
                    type="date"
                    className="h-8 text-xs"
                    value={formAditivo.dataAditivo}
                    onChange={(e) => setFormAditivo((f) => ({ ...f, dataAditivo: e.target.value }))}
                  />
                </Campo>
                {formAditivo.tipoAlteracao === 'valor' && (
                  <Campo label="Novo valor do aluguel (R$)">
                    <Input
                      type="number"
                      step="0.01"
                      className="h-8 text-xs"
                      value={formAditivo.valorNovo ?? ''}
                      onChange={(e) =>
                        setFormAditivo((f) => ({
                          ...f,
                          valorNovo: parseFloat(e.target.value) || undefined,
                        }))
                      }
                    />
                  </Campo>
                )}
                {formAditivo.tipoAlteracao === 'prazo' && (
                  <Campo label="Nova data de término">
                    <Input
                      type="date"
                      className="h-8 text-xs"
                      value={formAditivo.dataFimNova || ''}
                      onChange={(e) =>
                        setFormAditivo((f) => ({ ...f, dataFimNova: e.target.value }))
                      }
                    />
                  </Campo>
                )}
                <Campo label="Descrição da alteração">
                  <Textarea
                    rows={3}
                    className="text-xs"
                    value={formAditivo.descricao}
                    onChange={(e) => setFormAditivo((f) => ({ ...f, descricao: e.target.value }))}
                    placeholder="Ex.: reajuste antecipado acordado em assembleia..."
                  />
                </Campo>
              </>
            )}
            {acao === 'renovacao' && (
              <>
                <Campo label="Nova data de término">
                  <Input
                    type="date"
                    className="h-8 text-xs"
                    value={formRenovacao.novoFim}
                    onChange={(e) => setFormRenovacao((f) => ({ ...f, novoFim: e.target.value }))}
                  />
                </Campo>
                <Campo label="Novo valor do aluguel (opcional)">
                  <Input
                    type="number"
                    step="0.01"
                    className="h-8 text-xs"
                    value={formRenovacao.novoValor ?? ''}
                    onChange={(e) =>
                      setFormRenovacao((f) => ({
                        ...f,
                        novoValor: parseFloat(e.target.value) || undefined,
                      }))
                    }
                  />
                </Campo>
                <Campo label="Observações da negociação">
                  <Textarea
                    rows={3}
                    className="text-xs"
                    value={formRenovacao.observacoes}
                    onChange={(e) =>
                      setFormRenovacao((f) => ({ ...f, observacoes: e.target.value }))
                    }
                  />
                </Campo>
              </>
            )}
            {acao === 'prorrogar' && (
              <Campo label="Prorrogar término até">
                <Input
                  type="date"
                  className="h-8 text-xs"
                  value={formProrrogar}
                  onChange={(e) => setFormProrrogar(e.target.value)}
                />
              </Campo>
            )}
            {acao === 'distrato' && (
              <>
                <Campo label="Data do distrato">
                  <Input
                    type="date"
                    className="h-8 text-xs"
                    value={formDistrato.dataDistrato}
                    onChange={(e) =>
                      setFormDistrato((f) => ({ ...f, dataDistrato: e.target.value }))
                    }
                  />
                </Campo>
                <Campo label="Motivo">
                  <Textarea
                    rows={3}
                    className="text-xs"
                    value={formDistrato.motivo}
                    onChange={(e) => setFormDistrato((f) => ({ ...f, motivo: e.target.value }))}
                    placeholder="Ex.: devolução amigável pelo inquilino..."
                  />
                </Campo>
                <Campo label="Entrega de chaves (data, opcional)">
                  <Input
                    type="date"
                    className="h-8 text-xs"
                    value={formDistrato.entregaChaves || ''}
                    onChange={(e) =>
                      setFormDistrato((f) => ({ ...f, entregaChaves: e.target.value }))
                    }
                  />
                </Campo>
                <p className="text-[10px] text-muted-foreground">
                  O imóvel vinculado voltará para a situação <strong>disponível</strong>.
                </p>
              </>
            )}
            {acao === 'anexo' && (
              <>
                <Campo label="Arquivo (PDF, imagem, DOCX)">
                  <input
                    type="file"
                    className="text-xs w-full"
                    onChange={(e) =>
                      setFormAnexo((f) => ({ ...f, arquivo: e.target.files?.[0] || null }))
                    }
                  />
                </Campo>
                <Campo label="Título">
                  <Input
                    className="h-8 text-xs"
                    value={formAnexo.titulo}
                    onChange={(e) => setFormAnexo((f) => ({ ...f, titulo: e.target.value }))}
                    placeholder="Ex.: Contrato assinado scan"
                  />
                </Campo>
                <Campo label="Tipo do documento">
                  <Select
                    value={formAnexo.tipo}
                    onValueChange={(v) =>
                      setFormAnexo((f) => ({ ...f, tipo: v as DocumentoModel['tipo'] }))
                    }
                  >
                    <SelectTrigger className="h-8 text-xs">
                      <SelectValue />
                    </SelectTrigger>
                    <SelectContent>
                      <SelectItem value="contrato">Contrato</SelectItem>
                      <SelectItem value="aditivo">Aditivo</SelectItem>
                      <SelectItem value="distrato">Distrato</SelectItem>
                      <SelectItem value="laudo_vistoria">Laudo / vistoria</SelectItem>
                      <SelectItem value="notificacao">Notificação</SelectItem>
                      <SelectItem value="outros">Outros</SelectItem>
                    </SelectContent>
                  </Select>
                </Campo>
              </>
            )}
          </div>
          <DialogFooter>
            <Button variant="outline" size="sm" onClick={() => setAcao(null)}>
              Cancelar
            </Button>
            <Button
              size="sm"
              className="bg-gradient-brand text-white border-transparent"
              onClick={salvarAcao}
              disabled={salvando}
            >
              {salvando ? (
                <Loader2 className="w-3.5 h-3.5 animate-spin" />
              ) : (
                <KeyRound className="w-3.5 h-3.5" />
              )}
              Registrar
            </Button>
          </DialogFooter>
        </DialogContent>
      </Dialog>
    </div>
  )
}

function hoje(): string {
  return new Date().toISOString().split('T')[0]
}

function tituloAcao(acao: AcaoAtiva, numero: string): string {
  switch (acao) {
    case 'aditivo':
      return `Registrar aditivo · ${numero}`
    case 'renovacao':
      return `Renovar contrato · ${numero}`
    case 'prorrogar':
      return `Prorrogar prazo · ${numero}`
    case 'distrato':
      return `Distrato / encerramento · ${numero}`
    case 'anexo':
      return `Anexar documento · ${numero}`
    default:
      return ''
  }
}

function Celula({
  rotulo,
  valor,
  destaque,
}: {
  rotulo: string
  valor: React.ReactNode
  destaque?: boolean
}) {
  return (
    <div
      className={`p-2.5 rounded-xl border ${destaque ? 'border-violet-200/80 bg-gradient-brand-soft dark:border-violet-500/30' : 'border-border/70 bg-muted/40'}`}
    >
      <div className="text-[10px] font-extrabold uppercase tracking-wider text-muted-foreground">
        {rotulo}
      </div>
      <div
        className={`mt-0.5 font-bold capitalize ${destaque ? 'text-violet-700 dark:text-violet-200' : 'text-foreground'}`}
      >
        {valor}
      </div>
    </div>
  )
}

function BotaoAcao({
  icone,
  onClick,
  children,
}: {
  icone: React.ReactNode
  onClick: () => void
  children: React.ReactNode
}) {
  return (
    <Button
      variant="outline"
      size="sm"
      className="h-8 text-[11px] rounded-full gap-1.5 hover:border-primary/50"
      onClick={onClick}
    >
      {icone}
      {children}
    </Button>
  )
}

function Secao({ titulo, children }: { titulo: string; children: React.ReactNode }) {
  return (
    <div>
      <div className="text-[10px] font-extrabold uppercase tracking-wider text-muted-foreground mb-1.5">
        {titulo}
      </div>
      <div className="space-y-2">{children}</div>
    </div>
  )
}

function SemDados({ texto }: { texto: string }) {
  return <div className="text-muted-foreground italic">{texto}</div>
}

function Campo({ label, children }: { label: string; children: React.ReactNode }) {
  return (
    <div>
      <Label className="text-[11px] font-bold text-muted-foreground">{label}</Label>
      <div className="mt-1">{children}</div>
    </div>
  )
}

/* fim */
