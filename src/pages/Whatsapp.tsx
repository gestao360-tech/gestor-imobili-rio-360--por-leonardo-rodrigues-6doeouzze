// 📱 WhatsApp / Cobranças — fila de mensagens do Gestor Imobiliário 360.
//
// Fluxo "Fila com confirmação": o sistema MONTA a fila a partir dos dados
// reais (cobrança de aluguel X dias antes do vencimento + alerta de
// inadimplência), o usuário revisa, edita e aprova cada item e SÓ ENTÃO a
// mensagem sai pelo WhatsApp do proprietário (número fixo, conector owner).
// Nada é enviado sozinho.
import { useEffect, useState } from 'react'
import {
  AlertTriangle,
  CheckCircle2,
  Clock,
  MessageCircle,
  RefreshCw,
  Send,
  Trash2,
  XCircle,
  Edit3,
  Link2,
  Receipt,
} from 'lucide-react'
import { Button } from '@/components/ui/button'
import { Card, CardContent, CardHeader, CardTitle } from '@/components/ui/card'
import { Badge } from '@/components/ui/badge'
import { Input } from '@/components/ui/input'
import { Textarea } from '@/components/ui/textarea'
import { useToast } from '@/hooks/use-toast'
import { formatBRL, formatDateBR } from '@/services/imobiliario'
import {
  aplicarTemplateFila,
  aprovarItensFila,
  descartarItensFila,
  editarDestinatarioFila,
  editarMensagemFila,
  enviarItensFila,
  enviarTesteWhatsapp,
  getConfigWhatsapp,
  getFilaWhatsapp,
  getTemplatesWhatsapp,
  salvarConfigWhatsapp,
  usarTelefoneCadastro,
  varrerFilaWhatsapp,
  type TemplateWhatsapp,
} from '@/services/whatsapp'
import { FilaWhatsappModel } from '@/types/database'

type FiltroFila = 'pendentes' | 'todos' | 'enviados'

const STATUS_BADGE: Record<string, { label: string; classe: string }> = {
  pendente: { label: 'Pendente', classe: 'bg-amber-100 text-amber-800 border-amber-200' },
  aprovado: { label: 'Aprovado', classe: 'bg-blue-100 text-blue-800 border-blue-200' },
  enviado: { label: 'Enviado', classe: 'bg-emerald-100 text-emerald-800 border-emerald-200' },
  falhado: { label: 'Falhou', classe: 'bg-red-100 text-red-800 border-red-200' },
  descartado: { label: 'Descartado', classe: 'bg-slate-200 text-slate-600 border-slate-300' },
}

export default function PaginaWhatsapp() {
  const { toast } = useToast()
  const [itens, setItens] = useState<FilaWhatsappModel[]>([])
  const [carregando, setCarregando] = useState(true)
  const [filtro, setFiltro] = useState<FiltroFila>('pendentes')
  const [editandoId, setEditandoId] = useState<string | null>(null)
  const [mensagemEditada, setMensagemEditada] = useState('')
  const [telEditadoId, setTelEditadoId] = useState<string | null>(null)
  const [telEditado, setTelEditado] = useState('')
  const [processando, setProcessando] = useState(false)

  const [gerandoFila, setGerandoFila] = useState(false)
  const [numPendentes, setNumPendentes] = useState(0)
  const [numAprovados, setNumAprovados] = useState(0)
  const [numFalhados, setNumFalhados] = useState(0)

  const [config, setConfig] = useState<{
    cobranca_antecipada: boolean
    alerta_inadimplencia: boolean
  } | null>(null)
  const [diasAntes, setDiasAntes] = useState(3)
  const [testando, setTestando] = useState(false)
  const [numeroTeste, setNumeroTeste] = useState('')
  const [mostrarTeste, setMostrarTeste] = useState(false)

  const [templates, setTemplates] = useState<TemplateWhatsapp[]>([])
  const [templateLote, setTemplateLote] = useState('')
  const [aplicandoLote, setAplicandoLote] = useState(false)
  const [templatePorItem, setTemplatePorItem] = useState<Record<string, string>>({})
  const [aplicandoItem, setAplicandoItem] = useState<string | null>(null)

  const carregar = async () => {
    setCarregando(true)
    try {
      const lista = await getFilaWhatsapp(filtro)
      setItens(lista)
      const todos = await getFilaWhatsapp('todos')
      setNumPendentes(todos.filter((i) => i.status === 'pendente').length)
      setNumAprovados(todos.filter((i) => i.status === 'aprovado').length)
      setNumFalhados(todos.filter((i) => i.status === 'falhado').length)
    } catch (e) {
      toast({
        title: 'Erro ao carregar a fila',
        description: e instanceof Error ? e.message : 'Tente novamente.',
        variant: 'destructive',
      })
    } finally {
      setCarregando(false)
    }
  }

  useEffect(() => {
    carregar()
    getConfigWhatsapp()
      .then((cfg) => {
        setConfig(cfg.categorias)
        setDiasAntes(cfg.dias_antes_vencimento)
      })
      .catch(() => setConfig(null))
    getTemplatesWhatsapp()
      .then((t) => {
        setTemplates(t)
        const inicial: Record<string, string> = {}
        for (const tpl of t) {
          if (tpl.categoria === 'cobranca_antecipada' && !inicial.cobranca)
            inicial.cobranca = tpl.id
          if (tpl.categoria === 'alerta_inadimplencia' && !inicial.inadimplencia)
            inicial.inadimplencia = tpl.id
        }
        setTemplatePorItem(inicial)
      })
      .catch(() => setTemplates([]))
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [filtro])

  const gerarFila = async () => {
    setGerandoFila(true)
    try {
      const r = await varrerFilaWhatsapp()
      toast({
        title: 'Fila gerada',
        description: `${r.novos_itens} novo(s) item(ns), ${r.ja_existentes} já existente(s).`,
      })
      await carregar()
    } catch (e) {
      toast({
        title: 'Erro ao gerar a fila',
        description: e instanceof Error ? e.message : 'Tente novamente.',
        variant: 'destructive',
      })
    } finally {
      setGerandoFila(false)
    }
  }

  const aprovarSelecionados = async (ids: string[]) => {
    if (!ids.length) return
    setProcessando(true)
    try {
      const r = await aprovarItensFila(ids)
      if (r.erros?.length) {
        toast({
          title: 'Alguns itens não puderam ser aprovados',
          description: r.erros[0],
          variant: 'destructive',
        })
      } else {
        toast({
          title: 'Itens aprovados',
          description: `${r.aprovados} item(ns) pronto(s) para envio.`,
        })
      }
      await carregar()
    } finally {
      setProcessando(false)
    }
  }

  const enviarAprovados = async (ids: string[]) => {
    if (!ids.length) return
    setProcessando(true)
    try {
      const r = await enviarItensFila(ids)
      if (r.falhas > 0) {
        const erros = (r.detalhes || [])
          .filter((d) => !d.ok)
          .map((d) => d.erro)
          .join(' · ')
        toast({
          title: `${r.enviados} enviada(s), ${r.falhas} falharam`,
          description: erros || 'Veja o erro real no item da fila.',
          variant: 'destructive',
        })
      } else {
        toast({
          title: 'Mensagens enviadas',
          description: `${r.enviados} mensagem(ns) enviada(s) com sucesso.`,
        })
      }
      await carregar()
    } catch (e) {
      toast({
        title: 'Erro no envio',
        description: e instanceof Error ? e.message : 'Tente novamente.',
        variant: 'destructive',
      })
    } finally {
      setProcessando(false)
    }
  }

  const descartar = async (ids: string[]) => {
    if (!ids.length) return
    setProcessando(true)
    try {
      const r = await descartarItensFila(ids)
      if (r.erros?.length) {
        toast({ title: 'Erro ao descartar', description: r.erros[0], variant: 'destructive' })
      } else {
        toast({ title: 'Itens descartados', description: `${r.aprovados} item(ns) descartado(s).` })
      }
      await carregar()
    } finally {
      setProcessando(false)
    }
  }

  const enviarTeste = async () => {
    if (!numeroTeste.trim()) {
      toast({ title: 'Informe o número para o teste', variant: 'destructive' })
      return
    }
    setTestando(true)
    try {
      const r = await enviarTesteWhatsapp(numeroTeste.trim())
      if (r.ok) {
        toast({
          title: 'Mensagem de teste enviada',
          description: `Número normalizado: ${r.numero_normalizado || numeroTeste}`,
        })
      } else {
        toast({
          title: 'Falha no envio de teste',
          description: r.erro || 'Tente novamente.',
          variant: 'destructive',
        })
      }
    } catch (e) {
      toast({
        title: 'Erro no envio de teste',
        description: e instanceof Error ? e.message : 'Tente novamente.',
        variant: 'destructive',
      })
    } finally {
      setTestando(false)
    }
  }

  const salvarConfig = async (categorias?: {
    cobranca_antecipada: boolean
    alerta_inadimplencia: boolean
  }) => {
    try {
      await salvarConfigWhatsapp({
        categorias: categorias ||
          config || { cobranca_antecipada: true, alerta_inadimplencia: true },
        dias_antes_vencimento: diasAntes,
      })
      toast({ title: 'Configuração salva', description: 'Preferências de WhatsApp atualizadas.' })
    } catch (e) {
      toast({
        title: 'Erro ao salvar a configuração',
        description: e instanceof Error ? e.message : 'Tente novamente.',
        variant: 'destructive',
      })
    }
  }

  const salvarEdicaoMensagem = async (id: string) => {
    try {
      await editarMensagemFila(id, mensagemEditada)
      toast({ title: 'Mensagem atualizada' })
      setEditandoId(null)
      await carregar()
    } catch (e) {
      toast({
        title: 'Erro ao salvar a mensagem',
        description: e instanceof Error ? e.message : 'Tente novamente.',
        variant: 'destructive',
      })
    }
  }

  const salvarEdicaoTelefone = async (id: string) => {
    try {
      await editarDestinatarioFila(id, telEditado)
      toast({ title: 'Destinatário atualizado' })
      setTelEditadoId(null)
      await carregar()
    } catch (e) {
      toast({
        title: 'Erro ao salvar o destinatário',
        description: e instanceof Error ? e.message : 'Tente novamente.',
        variant: 'destructive',
      })
    }
  }

  const usarCadastro = async (id: string) => {
    try {
      await usarTelefoneCadastro(id)
      toast({ title: 'Número do cadastro reaproveitado' })
      await carregar()
    } catch (e) {
      toast({
        title: 'Erro',
        description: e instanceof Error ? e.message : 'Tente novamente.',
        variant: 'destructive',
      })
    }
  }

  /** Aplica o template escolhido a UM item (mensagem re-renderizada no backend). */
  const aplicarTemplateEmUm = async (item: FilaWhatsappModel, templateId: string) => {
    if (!templateId) return
    setAplicandoItem(item.id)
    try {
      const r = await aplicarTemplateFila([item.id], templateId)
      if (r.aplicados > 0) {
        toast({
          title: 'Template aplicado',
          description: 'Mensagem re-renderizada com os dados do item.',
        })
      } else {
        toast({
          title: 'Não foi possível aplicar o template',
          description: r.erros[0] || 'Item não pode mais ser editado.',
          variant: 'destructive',
        })
      }
      await carregar()
    } catch (e) {
      toast({
        title: 'Erro ao aplicar o template',
        description: e instanceof Error ? e.message : 'Tente novamente.',
        variant: 'destructive',
      })
    } finally {
      setAplicandoItem(null)
    }
  }

  /** Aplica o template escolhido EM LOTE a todos os itens editáveis da lista. */
  const aplicarTemplateEmLote = async () => {
    if (!templateLote) return
    const alvo = itens.filter((i) => i.status !== 'enviado' && i.status !== 'descartado')
    if (!alvo.length) {
      toast({ title: 'Nenhum item editável na lista atual', variant: 'destructive' })
      return
    }
    setAplicandoLote(true)
    try {
      const r = await aplicarTemplateFila(
        alvo.map((i) => i.id),
        templateLote,
      )
      if (r.erros?.length) {
        toast({
          title: 'Alguns itens não receberam o template',
          description: r.erros[0],
          variant: 'destructive',
        })
      } else {
        toast({
          title: 'Template aplicado em lote',
          description: `${r.aplicados} mensagem(ns) re-renderizada(s).`,
        })
      }
      await carregar()
    } catch (e) {
      toast({
        title: 'Erro ao aplicar o template',
        description: e instanceof Error ? e.message : 'Tente novamente.',
        variant: 'destructive',
      })
    } finally {
      setAplicandoLote(false)
    }
  }

  const templatesDoTipo = (tipo: string) =>
    templates.filter((t) => t.categoria === tipo && t.ativo !== false)

  const idsAprovados = itens
    .filter((i) => i.status === 'aprovado' || i.status === 'falhado')
    .map((i) => i.id)
  const idsPendentes = itens.filter((i) => i.status === 'pendente').map((i) => i.id)

  return (
    <div className="space-y-4">
      {/* Cabeçalho */}
      <div className="flex items-center justify-between flex-wrap gap-2">
        <div>
          <h1 className="text-lg font-bold text-slate-900 dark:text-slate-100 flex items-center gap-2">
            <MessageCircle className="w-5 h-5 text-emerald-600" /> WhatsApp / Cobranças
          </h1>
          <p className="text-xs text-slate-500 dark:text-slate-400">
            Fila de mensagens montada a partir dos dados reais. Nada é enviado sem a sua aprovação.
          </p>
        </div>
        <div className="flex items-center gap-2 flex-wrap">
          <Button size="sm" variant="outline" onClick={gerarFila} disabled={gerandoFila}>
            <RefreshCw className={`w-4 h-4 mr-1 ${gerandoFila ? 'animate-spin' : ''}`} />
            Gerar fila agora
          </Button>
          <Button size="sm" variant="outline" onClick={() => setMostrarTeste(!mostrarTeste)}>
            Enviar teste
          </Button>
          {mostrarTeste && (
            <div className="flex items-center gap-1">
              <Input
                value={numeroTeste}
                onChange={(e) => setNumeroTeste(e.target.value)}
                placeholder="(11) 97777-1234"
                className="w-44 text-xs"
              />
              <Button size="sm" onClick={enviarTeste} disabled={testando}>
                {testando ? 'Enviando…' : 'Enviar'}
              </Button>
            </div>
          )}
        </div>
      </div>

      {/* Painel de configuração rápida */}
      {config && (
        <Card>
          <CardContent className="pt-4 pb-4 flex items-center gap-4 flex-wrap text-xs">
            <label className="flex items-center gap-2">
              <input
                type="checkbox"
                checked={config.cobranca_antecipada}
                onChange={(e) => {
                  const nova = { ...config, cobranca_antecipada: e.target.checked }
                  setConfig(nova)
                  salvarConfig(nova)
                }}
              />
              Cobrança antecipada
            </label>
            <label className="flex items-center gap-2">
              <input
                type="checkbox"
                checked={config.alerta_inadimplencia}
                onChange={(e) => {
                  const nova = { ...config, alerta_inadimplencia: e.target.checked }
                  setConfig(nova)
                  salvarConfig(nova)
                }}
              />
              Alerta de inadimplência
            </label>
            <div className="flex items-center gap-2">
              <span>Dias antes do vencimento:</span>
              <Input
                type="number"
                min={1}
                max={30}
                value={diasAntes}
                onChange={(e) => setDiasAntes(Number(e.target.value) || 3)}
                className="w-16 text-xs"
              />
              <Button size="sm" variant="outline" onClick={() => salvarConfig()}>
                Salvar
              </Button>
            </div>
            <span className="text-[11px] text-slate-400">
              Mensagens saem do número fixo conectado (conta do proprietário, via conector).
            </span>
          </CardContent>
        </Card>
      )}

      {/* Abas da fila + ações em lote */}
      <div className="flex items-center gap-2 flex-wrap">
        {(['pendentes', 'todos', 'enviados'] as FiltroFila[]).map((f) => (
          <Button
            key={f}
            size="sm"
            variant={filtro === f ? 'default' : 'outline'}
            onClick={() => setFiltro(f)}
          >
            {f === 'pendentes' && `Pendentes (${numPendentes + numAprovados + numFalhados})`}
            {f === 'todos' && 'Todos'}
            {f === 'enviados' && 'Enviados'}
          </Button>
        ))}
        <Button
          size="sm"
          variant="outline"
          onClick={() => aprovarSelecionados(idsPendentes)}
          disabled={processando || idsPendentes.length === 0}
        >
          <CheckCircle2 className="w-4 h-4 mr-1" /> Aprovar todos os pendentes
        </Button>
        <Button
          size="sm"
          onClick={() => enviarAprovados(idsAprovados)}
          disabled={processando || idsAprovados.length === 0}
          className="bg-emerald-600 hover:bg-emerald-700"
        >
          <Send className="w-4 h-4 mr-1" /> Enviar aprovados
        </Button>
        <span className="text-[11px] text-slate-400">
          A prévia aparece antes de qualquer envio.
        </span>
      </div>

      {/* Aplicação de template em lote */}
      {templates.length > 0 && (
        <div className="flex items-center gap-2 flex-wrap border rounded-lg p-2 bg-slate-50 dark:bg-slate-900">
          <span className="text-xs font-medium">Template em lote:</span>
          <select
            value={templateLote}
            onChange={(e) => setTemplateLote(e.target.value)}
            className="text-xs border rounded px-2 py-1 bg-white dark:bg-slate-800"
          >
            <option value="">Escolher template…</option>
            {templates.map((t) => (
              <option key={t.id} value={t.id}>
                {t.nome}
                {t.padrao ? ' (padrão)' : ''}
              </option>
            ))}
          </select>
          <Button
            size="sm"
            variant="outline"
            onClick={aplicarTemplateEmLote}
            disabled={!templateLote || aplicandoLote}
          >
            Aplicar a todos os itens da lista
          </Button>
          <span className="text-[11px] text-slate-400">
            Cada mensagem é re-renderizada com os dados do próprio item.
          </span>
        </div>
      )}

      {/* Lista de itens */}
      {carregando ? (
        <Card>
          <CardContent className="py-8 text-center text-xs text-slate-400">
            Carregando fila…
          </CardContent>
        </Card>
      ) : itens.length === 0 ? (
        <Card>
          <CardContent className="py-8 text-center text-xs text-slate-400">
            Nenhum item na fila com este filtro. Use “Gerar fila agora” para montar a fila a partir
            das cobranças reais.
          </CardContent>
        </Card>
      ) : (
        <div className="space-y-2">
          {itens.map((item) => {
            const badge = STATUS_BADGE[item.status] || { label: item.status, classe: '' }
            const rotuloImovel = item.expand?.imovel
              ? `${item.expand.imovel.endereco || ''}${
                  item.expand.imovel.numero ? ', ' + item.expand.imovel.numero : ''
                }`
              : '—'
            const rotuloInquilino = item.expand?.inquilino?.nome || '—'
            return (
              <Card key={item.id} className="border-l-4 border-l-amber-400">
                <CardContent className="py-3 space-y-2">
                  <div className="flex items-start justify-between gap-2 flex-wrap">
                    <div className="space-y-0.5">
                      <div className="text-sm font-semibold text-slate-900 dark:text-slate-100 flex items-center gap-2 flex-wrap">
                        {item.tipo === 'cobranca_antecipada' ? (
                          <span className="inline-flex items-center gap-1">
                            <Clock className="w-3.5 h-3.5 text-blue-600" /> Cobrança de aluguel
                          </span>
                        ) : item.tipo === 'recibo_aluguel' ? (
                          <span className="inline-flex items-center gap-1">
                            <Receipt className="w-3.5 h-3.5 text-gold-metallic" /> Recibo de aluguel
                          </span>
                        ) : (
                          <span className="inline-flex items-center gap-1">
                            <AlertTriangle className="w-3.5 h-3.5 text-red-600" /> Alerta de
                            inadimplência
                          </span>
                        )}
                        <Badge className={badge.classe} variant="outline">
                          {badge.label}
                        </Badge>
                        {(item.dias_atraso || 0) > 0 && (
                          <Badge variant="destructive">{item.dias_atraso} dia(s) de atraso</Badge>
                        )}
                        {!item.telefone_ok && (
                          <Badge variant="destructive">⚠️ Sem WhatsApp válido</Badge>
                        )}
                        {item.link_incluido && (
                          <Badge className="bg-navy-secondary text-gold-light gap-1 border border-gold-metallic/40">
                            <Link2 className="w-3 h-3 text-gold-luminous" />
                            Link de pagamento incluído
                          </Badge>
                        )}
                        {item.tipo === 'recibo_aluguel' && item.link_recibo && (
                          <a
                            href={item.link_recibo}
                            target="_blank"
                            rel="noreferrer"
                            className="inline-flex items-center gap-1 rounded-md border border-gold-metallic/50 bg-gold-light/20 dark:bg-navy-secondary px-1.5 py-0.5 text-[10px] font-medium text-gold-dark dark:text-gold-luminous hover:bg-gold-light/40 transition-colors"
                          >
                            <Receipt className="w-3 h-3" />
                            Recibo em PDF
                          </a>
                        )}
                      </div>
                      <div className="text-xs text-slate-500">
                        {rotuloImovel} · {rotuloInquilino} · Competência {item.competencia || '—'} ·
                        Venc. {formatDateBR(item.vencimento)} ·{' '}
                        <span className="font-semibold text-slate-700 dark:text-slate-300">
                          {formatBRL(item.valor_devido || 0)}
                        </span>
                        {item.expand?.contrato?.numero
                          ? ` · Contrato ${item.expand.contrato.numero}`
                          : ''}
                      </div>
                      {!item.telefone_ok && (
                        <div className="text-[11px] text-amber-700 dark:text-amber-400 flex items-center gap-1">
                          <XCircle className="w-3 h-3" />
                          Precisa de atenção: preencha o WhatsApp do inquilino no cadastro (👥
                          Inquilinos) ou edite o número aqui mesmo.
                        </div>
                      )}
                    </div>
                    <div className="flex items-center gap-1 flex-wrap">
                      {item.status === 'pendente' && (
                        <Button
                          size="sm"
                          variant="outline"
                          onClick={() => aprovarSelecionados([item.id])}
                        >
                          Aprovar
                        </Button>
                      )}
                      {(item.status === 'aprovado' || item.status === 'falhado') && (
                        <Button
                          size="sm"
                          className="bg-emerald-600 hover:bg-emerald-700"
                          onClick={() => enviarAprovados([item.id])}
                        >
                          <Send className="w-4 h-4 mr-1" />
                          {item.status === 'falhado' ? 'Reenviar' : 'Enviar'}
                        </Button>
                      )}
                      <Button
                        size="sm"
                        variant="ghost"
                        title="Editar mensagem"
                        onClick={() => {
                          setEditandoId(item.id === editandoId ? null : item.id)
                          setMensagemEditada(item.mensagem)
                        }}
                      >
                        <Edit3 className="w-4 h-4" />
                      </Button>
                      {item.status !== 'enviado' && (
                        <Button
                          size="sm"
                          variant="ghost"
                          title="Descartar"
                          onClick={() => descartar([item.id])}
                        >
                          <Trash2 className="w-4 h-4" />
                        </Button>
                      )}
                    </div>
                  </div>

                  {/* Status do envio */}
                  {item.status === 'enviado' && item.enviado_em && (
                    <div className="text-[11px] text-emerald-700 dark:text-emerald-400">
                      Enviado em{' '}
                      {new Date(item.enviado_em.replace(' ', 'T')).toLocaleString('pt-BR')}
                      {item.resultado_envio ? ` — ${item.resultado_envio}` : ''}
                    </div>
                  )}
                  {item.status === 'falhado' && item.resultado_envio && (
                    <div className="text-[11px] text-red-700 dark:text-red-400">
                      Erro real: {item.resultado_envio}
                    </div>
                  )}

                  {/* Seletor de template do item */}
                  {item.status !== 'enviado' && item.status !== 'descartado' && (
                    <div className="flex items-center gap-2 flex-wrap">
                      <span className="text-[11px] text-slate-500">Template:</span>
                      <select
                        value={templatePorItem[item.tipo] || ''}
                        onChange={(e) => {
                          setTemplatePorItem((prev) => ({ ...prev, [item.tipo]: e.target.value }))
                          aplicarTemplateEmUm(item, e.target.value)
                        }}
                        disabled={aplicandoItem === item.id}
                        className="text-xs border rounded px-2 py-1 bg-white dark:bg-slate-800 max-w-56"
                      >
                        <option value="">Escolher template…</option>
                        {templatesDoTipo(item.tipo).map((t) => (
                          <option key={t.id} value={t.id}>
                            {t.nome}
                            {t.padrao ? ' (padrão)' : ''}
                          </option>
                        ))}
                      </select>
                      {aplicandoItem === item.id && (
                        <span className="text-[11px] text-slate-400">aplicando…</span>
                      )}
                      {item.template && (
                        <span className="text-[11px] text-slate-400">
                          (em uso:{' '}
                          {templates.find((t) => t.id === item.template)?.nome || 'template'})
                        </span>
                      )}
                    </div>
                  )}
                  {item.status === 'enviado' && item.mensagem_enviada && (
                    <details className="text-[11px] text-slate-500">
                      <summary className="cursor-pointer">Mensagem enviada (histórico)</summary>
                      <pre className="text-xs bg-emerald-50 dark:bg-emerald-950 rounded p-2 whitespace-pre-wrap font-sans text-emerald-800 dark:text-emerald-300 mt-1">
                        {item.mensagem_enviada}
                      </pre>
                    </details>
                  )}

                  {/* Destinatário */}
                  {telEditadoId === item.id ? (
                    <div className="flex items-center gap-1 flex-wrap">
                      <Input
                        value={telEditado}
                        onChange={(e) => setTelEditado(e.target.value)}
                        placeholder="+55 (11) 97777-1234"
                        className="text-xs w-56"
                      />
                      <Button size="sm" onClick={() => salvarEdicaoTelefone(item.id)}>
                        Salvar
                      </Button>
                      <Button size="sm" variant="outline" onClick={() => setTelEditadoId(null)}>
                        Cancelar
                      </Button>
                    </div>
                  ) : (
                    <div className="text-xs text-slate-500 flex items-center gap-2 flex-wrap">
                      <span>Para: {item.destinatario || '—'}</span>
                      <button
                        className="text-emerald-700 dark:text-emerald-400 underline text-[11px]"
                        onClick={() => {
                          setTelEditadoId(item.id)
                          setTelEditado(item.destinatario || '')
                        }}
                      >
                        editar
                      </button>
                      {item.destinatario_cadastro &&
                        item.destinatario_cadastro !== item.destinatario && (
                          <button
                            className="text-emerald-700 dark:text-emerald-400 underline text-[11px]"
                            onClick={() => usarCadastro(item.id)}
                          >
                            usar o do cadastro
                          </button>
                        )}
                    </div>
                  )}

                  {/* Mensagem (prévia / edição) */}
                  {editandoId === item.id ? (
                    <div className="space-y-1">
                      <Textarea
                        value={mensagemEditada}
                        onChange={(e) => setMensagemEditada(e.target.value)}
                        className="text-xs min-h-32"
                      />
                      <div className="flex items-center gap-1">
                        <Button size="sm" onClick={() => salvarEdicaoMensagem(item.id)}>
                          Salvar mensagem
                        </Button>
                        <Button size="sm" variant="outline" onClick={() => setEditandoId(null)}>
                          Cancelar
                        </Button>
                      </div>
                    </div>
                  ) : (
                    <pre className="text-xs bg-slate-50 dark:bg-slate-900 rounded p-2 whitespace-pre-wrap font-sans text-slate-700 dark:text-slate-300">
                      {item.mensagem}
                    </pre>
                  )}
                </CardContent>
              </Card>
            )
          })}
        </div>
      )}

      {/* Nota de rodapé */}
      <p className="text-[11px] text-slate-400">
        A fila é gerada automaticamente todos os dias às 10h05 UTC (e pode ser gerada manualmente a
        qualquer momento). O envio acontece somente após a sua aprovação, pelo número fixo conectado
        — nunca sozinho.
      </p>
    </div>
  )
}
