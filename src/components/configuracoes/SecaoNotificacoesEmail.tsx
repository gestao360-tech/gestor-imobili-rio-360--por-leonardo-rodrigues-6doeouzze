/**
 * Subcomponente da tela ⚙️ Configurações: seção "Notificações por e-mail".
 * Destinatários, liga/desliga por categoria, e-mail de teste real e varredura
 * manual dos alertas. Consome as rotas /backend/v1/alertas-email/* do backend.
 */
import { useEffect, useState } from 'react'
import { BellRing, Mail, MailCheck, RefreshCw, Send, Trash2 } from 'lucide-react'
import { Button } from '@/components/ui/button'
import { Card, CardContent, CardHeader, CardTitle } from '@/components/ui/card'
import { Label } from '@/components/ui/label'
import { Loader2 } from 'lucide-react'
import { Switch } from '@/components/ui/switch'
import { Input } from '@/components/ui/input'
import { Badge } from '@/components/ui/badge'
import { useToast } from '@/hooks/use-toast'
import { useAuth } from '@/contexts/AuthContext'
import {
  getAlertasEmailConfig,
  salvarAlertasEmailConfig,
  enviarTesteEmail,
  dispararVarredura,
  getAlertas,
  type AlertaEmailModel,
} from '@/services/notificacoes'

interface CategoriaDef {
  chave: 'inadimplencia' | 'contratos' | 'reajustes' | 'pendencias' | 'resumo_semanal'
  rotulo: string
  descricao: string
}

const CATEGORIAS: CategoriaDef[] = [
  {
    chave: 'inadimplencia',
    rotulo: 'Inadimplência',
    descricao: 'Aluguéis vencidos sem pagamento integral',
  },
  {
    chave: 'contratos',
    rotulo: 'Contratos a vencer',
    descricao: 'Janelas de 120/90/60/30/15/7 dias',
  },
  {
    chave: 'reajustes',
    rotulo: 'Reajustes',
    descricao: 'Data-base prevista para o próximo mês',
  },
  {
    chave: 'pendencias',
    rotulo: 'Pendências',
    descricao: 'Prazo vencido ou nos próximos 7 dias',
  },
  {
    chave: 'resumo_semanal',
    rotulo: 'Resumo semanal',
    descricao: 'Resumo gerencial toda segunda-feira',
  },
]

const ROTULO_SEV: Record<string, string> = {
  urgente: 'Urgente',
  alta: 'Alta',
  media: 'Média',
  info: 'Informativo',
}

const CLASSE_SEV: Record<string, string> = {
  urgente: 'bg-red-100 text-red-800 dark:bg-red-950/40 dark:text-red-300',
  alta: 'bg-amber-100 text-amber-800 dark:bg-amber-950/40 dark:text-amber-300',
  media: 'bg-lime-100 text-lime-800 dark:bg-lime-950/40 dark:text-lime-300',
  info: 'bg-slate-100 text-slate-700 dark:bg-slate-800 dark:text-slate-300',
}

export default function SecaoNotificacoesEmail() {
  const { toast } = useToast()
  const { user } = useAuth()
  const [carregando, setCarregando] = useState(true)
  const [salvando, setSalvando] = useState(false)
  const [enviandoTeste, setEnviandoTeste] = useState(false)
  const [varrendo, setVarrendo] = useState(false)
  const [novoEmail, setNovoEmail] = useState('')
  const [config, setConfig] = useState<Awaited<ReturnType<typeof getAlertasEmailConfig>> | null>(
    null,
  )
  const [destinatarios, setDestinatarios] = useState<string[]>([])
  const [categorias, setCategorias] = useState<Record<string, boolean>>({})
  const [alertas, setAlertas] = useState<AlertaEmailModel[]>([])

  useEffect(() => {
    let vivo = true
    async function carregar() {
      try {
        const cfg = await getAlertasEmailConfig()
        if (!vivo) return
        setConfig(cfg)
        setDestinatarios(cfg.destinatarios?.length ? cfg.destinatarios : [])
        setCategorias(cfg.categorias || {})
      } catch {
        if (vivo) {
          toast({
            title: 'Não foi possível carregar as configurações',
            description: 'Verifique a conexão com o banco e tente novamente.',
            variant: 'destructive',
          })
        }
      } finally {
        if (vivo) setCarregando(false)
      }
    }
    carregar()
    return () => {
      vivo = false
    }
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [])

  async function recarregarAlertas() {
    try {
      setAlertas(await getAlertas(true))
    } catch {
      /* silencioso — a lista é complementar */
    }
  }

  useEffect(() => {
    if (config) recarregarAlertas()
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [config])

  function adicionarDestinatario() {
    const email = novoEmail.trim().toLowerCase()
    if (!/^[^\s@]+@[^\s@]+\.[^\s@]+$/.test(email)) {
      toast({
        title: 'E-mail inválido',
        description: 'Informe um e-mail válido para receber os alertas.',
        variant: 'destructive',
      })
      return
    }
    if (destinatarios.includes(email)) {
      toast({ title: 'Este e-mail já está na lista de destinatários.' })
      return
    }
    setDestinatarios([...destinatarios, email])
    setNovoEmail('')
  }

  async function salvar() {
    if (!destinatarios.length) {
      toast({
        title: 'Informe ao menos um destinatário',
        description: 'Sem destinatário válido o sistema não envia os e-mails.',
        variant: 'destructive',
      })
      return
    }
    setSalvando(true)
    try {
      await salvarAlertasEmailConfig({ destinatarios, categorias })
      toast({
        title: 'Configuração salva',
        description: `${destinatarios.length} destinatário(s). Os alertas seguem as categorias marcadas.`,
      })
    } catch (e) {
      toast({
        title: 'Erro ao salvar',
        description: e instanceof Error ? e.message : 'Tente novamente.',
        variant: 'destructive',
      })
    } finally {
      setSalvando(false)
    }
  }

  async function enviarTeste() {
    if (!destinatarios.length) {
      toast({
        title: 'Salve um destinatário antes de testar',
        description: 'Adicione um e-mail, salve e depois envie o teste.',
        variant: 'destructive',
      })
      return
    }
    setEnviandoTeste(true)
    try {
      await salvarAlertasEmailConfig({ destinatarios, categorias })
      const resultado = await enviarTesteEmail()
      toast({
        title: 'E-mail de teste enviado',
        description: `Verifique a caixa de ${resultado.destino}.`,
      })
      const cfg = await getAlertasEmailConfig()
      setConfig(cfg)
    } catch (e) {
      toast({
        title: 'Falha no envio do teste',
        description: e instanceof Error ? e.message : 'O backend reportou um erro no envio.',
        variant: 'destructive',
      })
    } finally {
      setEnviandoTeste(false)
    }
  }

  async function rodarVarredura() {
    setVarrendo(true)
    try {
      const r = await dispararVarredura()
      toast({
        title: 'Verificação concluída',
        description:
          `${r.novos_alertas} alerta(s) novo(s); ${r.alertas_em_aberto} em aberto. ` +
          (r.email_enviado
            ? `E-mail enviado para ${r.destino}.`
            : 'Sem e-mail novo neste momento.'),
      })
      await recarregarAlertas()
    } catch (e) {
      toast({
        title: 'Erro na verificação',
        description: e instanceof Error ? e.message : 'Tente novamente.',
        variant: 'destructive',
      })
    } finally {
      setVarrendo(false)
    }
  }

  const emailInicial = user?.email ?? config?.admin_email ?? ''

  return (
    <div className="space-y-4">
      <Card>
        <CardHeader className="pb-2">
          <CardTitle className="text-sm flex items-center gap-2">
            <BellRing className="w-4 h-4 text-emerald-600" />
            Notificações por e-mail
          </CardTitle>
        </CardHeader>
        <CardContent className="space-y-4">
          {carregando ? (
            <p className="text-xs text-slate-500">Carregando configuração…</p>
          ) : (
            <>
              <p className="text-xs text-slate-500 dark:text-slate-400">
                O sistema varre os dados todos os dias e envia um e-mail consolidado com os alertas
                novos — cobranças vencidas, contratos a vencer (120/90/60/30/15/7 dias), reajustes
                do próximo mês e pendências com prazo. Todo segunda-feira vai o resumo gerencial
                semanal.
              </p>

              {/* Destinatários */}
              <div>
                <Label className="text-xs">Destinatários</Label>
                <p className="text-[10px] text-slate-400">
                  Quem recebe os alertas. Inicializado com o e-mail da conta de administrador
                  {emailInicial ? `: ${emailInicial}` : ''}.
                </p>
                <div className="flex gap-2 mt-1.5 max-w-md">
                  <Input
                    type="email"
                    placeholder="email@exemplo.com"
                    value={novoEmail}
                    onChange={(e) => setNovoEmail(e.target.value)}
                    onKeyDown={(e) => {
                      if (e.key === 'Enter') adicionarDestinatario()
                    }}
                    className="h-8 text-xs"
                  />
                  <Button
                    size="sm"
                    variant="outline"
                    className="h-8 text-xs"
                    onClick={adicionarDestinatario}
                  >
                    Adicionar
                  </Button>
                </div>
                {destinatarios.length > 0 && (
                  <div className="flex flex-wrap gap-1.5 mt-2">
                    {destinatarios.map((d) => (
                      <Badge key={d} variant="outline" className="text-[11px] gap-1">
                        {d}
                        <button
                          type="button"
                          aria-label={`Remover ${d}`}
                          onClick={() => setDestinatarios(destinatarios.filter((x) => x !== d))}
                          className="text-slate-400 hover:text-red-600"
                        >
                          <Trash2 className="w-3 h-3" />
                        </button>
                      </Badge>
                    ))}
                  </div>
                )}
              </div>

              {/* Categorias */}
              <div>
                <Label className="text-xs">Categorias de alerta</Label>
                <div className="mt-1.5 space-y-2">
                  {CATEGORIAS.map((cat) => (
                    <div
                      key={cat.chave}
                      className="flex items-center justify-between gap-3 border border-slate-200 dark:border-slate-800 rounded-md px-3 py-2"
                    >
                      <div>
                        <div className="text-xs font-medium">{cat.rotulo}</div>
                        <div className="text-[10px] text-slate-400">{cat.descricao}</div>
                      </div>
                      <Switch
                        checked={categorias[cat.chave] !== false}
                        onCheckedChange={(v) => setCategorias((c) => ({ ...c, [cat.chave]: v }))}
                      />
                    </div>
                  ))}
                </div>
              </div>

              {/* Ações */}
              <div className="flex flex-wrap gap-2 items-center">
                <Button
                  size="sm"
                  className="bg-emerald-600 hover:bg-emerald-700 text-white"
                  disabled={salvando}
                  onClick={salvar}
                >
                  {salvando ? 'Salvando…' : 'Salvar configuração'}
                </Button>
                <Button size="sm" variant="outline" disabled={enviandoTeste} onClick={enviarTeste}>
                  {enviandoTeste ? (
                    <Loader2 className="w-4 h-4 animate-spin mr-1" />
                  ) : (
                    <Send className="w-4 h-4 mr-1" />
                  )}
                  Enviar e-mail de teste
                </Button>
                <Button size="sm" variant="outline" disabled={varrendo} onClick={rodarVarredura}>
                  {varrendo ? (
                    <RefreshCw className="w-4 h-4 animate-spin mr-1" />
                  ) : (
                    <RefreshCw className="w-4 h-4 mr-1" />
                  )}
                  Verificar alertas agora
                </Button>
              </div>

              {/* Último teste */}
              {config?.ultimo_teste?.executado_em && (
                <div
                  className={`text-[11px] flex items-center gap-1.5 ${
                    config.ultimo_teste.sucesso
                      ? 'text-emerald-700 dark:text-emerald-400'
                      : 'text-red-700 dark:text-red-400'
                  }`}
                >
                  {config.ultimo_teste.sucesso ? (
                    <MailCheck className="w-3.5 h-3.5" />
                  ) : (
                    <Mail className="w-3.5 h-3.5" />
                  )}
                  Último teste: {new Date(config.ultimo_teste.executado_em).toLocaleString('pt-BR')}{' '}
                  — {config.ultimo_teste.resultado}
                </div>
              )}

              {/* Lista interna de alertas em aberto */}
              {alertas.length > 0 && (
                <div className="border-t border-slate-200 dark:border-slate-800 pt-3">
                  <div className="text-xs font-semibold mb-2">
                    Alertas em aberto ({alertas.length})
                  </div>
                  <div className="max-h-56 overflow-y-auto space-y-1.5">
                    {alertas.map((a) => (
                      <div
                        key={a.id}
                        className="flex items-start gap-2 text-[11px] border border-slate-200 dark:border-slate-800 rounded-md px-2 py-1.5"
                      >
                        <Badge
                          className={`text-[9px] ${CLASSE_SEV[a.severidade] || CLASSE_SEV.info}`}
                        >
                          {ROTULO_SEV[a.severidade] || a.severidade}
                        </Badge>
                        <div className="min-w-0">
                          <div className="font-medium truncate">{a.titulo}</div>
                          <div className="text-slate-500 dark:text-slate-400">
                            {a.ref_status}
                            {a.email_enviado ? ' · já enviado por e-mail' : ' · e-mail pendente'}
                          </div>
                        </div>
                      </div>
                    ))}
                  </div>
                </div>
              )}
            </>
          )}
        </CardContent>
      </Card>
    </div>
  )
}
