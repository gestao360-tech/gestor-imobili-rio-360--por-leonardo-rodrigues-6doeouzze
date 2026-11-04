// ⚙️ Configurações → WhatsApp — CRUD de templates de mensagem.
//
// Lista os templates da fila, permite editar o texto de cada um, criar um novo
// (com nome e categoria cobrança/inadimplência) e restaurar o texto padrão do
// sistema. Os placeholders disponíveis aparecem listados para copiar — e a
// substituição pelos dados reais acontece sempre no backend, na hora do envio.
import { useEffect, useState } from 'react'
import { FileText, Plus, RotateCcw, Save, X } from 'lucide-react'
import { Button } from '@/components/ui/button'
import { Input } from '@/components/ui/input'
import { Label } from '@/components/ui/label'
import { Textarea } from '@/components/ui/textarea'
import { useToast } from '@/hooks/use-toast'
import {
  criarTemplateWhatsapp,
  editarTemplateWhatsapp,
  getTemplatesWhatsapp,
  restaurarTemplateWhatsapp,
  PLACEHOLDERS_WHATSAPP,
  type TemplateWhatsapp,
} from '@/services/whatsapp'

const ROTULO_CATEGORIA: Record<string, string> = {
  cobranca_antecipada: 'Cobrança (a vencer)',
  alerta_inadimplencia: 'Inadimplência',
}

export default function SecaoTemplatesWhatsapp() {
  const { toast } = useToast()
  const [templates, setTemplates] = useState<TemplateWhatsapp[]>([])
  const [carregando, setCarregando] = useState(true)
  const [editandoId, setEditandoId] = useState<string | null>(null)
  const [textoEditado, setTextoEditado] = useState('')
  const [salvandoId, setSalvandoId] = useState<string | null>(null)
  const [novoAberto, setNovoAberto] = useState(false)
  const [novoNome, setNovoNome] = useState('')
  const [novoCategoria, setNovoCategoria] = useState<
    'cobranca_antecipada' | 'alerta_inadimplencia'
  >('cobranca_antecipada')
  const [novoTexto, setNovoTexto] = useState('')
  const [criando, setCriando] = useState(false)

  const carregar = async () => {
    try {
      const lista = await getTemplatesWhatsapp()
      setTemplates(lista)
    } catch (e) {
      toast({
        title: 'Erro ao carregar os templates',
        description: e instanceof Error ? e.message : 'Tente novamente.',
        variant: 'destructive',
      })
    } finally {
      setCarregando(false)
    }
  }

  useEffect(() => {
    carregar()
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [])

  const salvarEdicao = async (id: string) => {
    setSalvandoId(id)
    try {
      await editarTemplateWhatsapp(id, textoEditado)
      toast({ title: 'Template atualizado' })
      setEditandoId(null)
      await carregar()
    } catch (e) {
      toast({
        title: 'Erro ao salvar o template',
        description: e instanceof Error ? e.message : 'Tente novamente.',
        variant: 'destructive',
      })
    } finally {
      setSalvandoId(null)
    }
  }

  const restaurar = async (id: string) => {
    try {
      const r = await restaurarTemplateWhatsapp(id)
      if (r.ok) {
        toast({ title: 'Texto padrão restaurado' })
      } else {
        toast({ title: 'Não foi possível restaurar', description: r.erro, variant: 'destructive' })
      }
      await carregar()
    } catch (e) {
      toast({
        title: 'Erro ao restaurar o padrão',
        description: e instanceof Error ? e.message : 'Tente novamente.',
        variant: 'destructive',
      })
    }
  }

  const criar = async () => {
    if (novoNome.trim().length < 2) {
      toast({ title: 'Informe um nome para o template', variant: 'destructive' })
      return
    }
    if (!novoTexto.trim()) {
      toast({ title: 'Escreva o texto do template', variant: 'destructive' })
      return
    }
    setCriando(true)
    try {
      const r = await criarTemplateWhatsapp({
        nome: novoNome.trim(),
        categoria: novoCategoria,
        texto: novoTexto,
      })
      if (r.ok) {
        toast({ title: 'Template criado', description: `“${novoNome.trim()}” disponível na fila.` })
        setNovoAberto(false)
        setNovoNome('')
        setNovoTexto('')
        await carregar()
      } else {
        toast({ title: 'Não foi possível criar', description: r.erro, variant: 'destructive' })
      }
    } catch (e) {
      toast({
        title: 'Erro ao criar o template',
        description: e instanceof Error ? e.message : 'Tente novamente.',
        variant: 'destructive',
      })
    } finally {
      setCriando(false)
    }
  }

  if (carregando) {
    return <p className="text-xs text-slate-400 py-2">Carregando templates…</p>
  }

  return (
    <div className="border-t pt-3 space-y-2">
      <div className="flex items-center justify-between flex-wrap gap-2">
        <div>
          <p className="text-xs font-semibold flex items-center gap-1.5">
            <FileText className="w-3.5 h-3.5 text-emerald-600" /> Templates de mensagem
          </p>
          <p className="text-[11px] text-slate-500">
            Textos pré-definidos com placeholders — preenchidos automaticamente com os dados de cada
            item da fila no momento do envio.
          </p>
        </div>
        <Button size="sm" variant="outline" onClick={() => setNovoAberto(!novoAberto)}>
          <Plus className="w-3.5 h-3.5 mr-1" /> Novo template
        </Button>
      </div>

      {/* Placeholders disponíveis */}
      <div className="rounded-md bg-slate-50 dark:bg-slate-900 border p-2">
        <p className="text-[11px] font-medium mb-1">
          Placeholders disponíveis (clique para copiar):
        </p>
        <div className="flex flex-wrap gap-1">
          {PLACEHOLDERS_WHATSAPP.map((p) => (
            <button
              key={p.chave}
              title={p.descricao}
              className="text-[11px] font-mono bg-white dark:bg-slate-800 border rounded px-1.5 py-0.5 hover:bg-emerald-50 dark:hover:bg-emerald-950"
              onClick={() => navigator.clipboard?.writeText(p.chave)}
            >
              {p.chave}
            </button>
          ))}
        </div>
        <p className="text-[10px] text-slate-400 mt-1">
          Passe o mouse sobre cada um para ver o que ele representa.
        </p>
      </div>

      {/* Formulário de novo template */}
      {novoAberto && (
        <div className="rounded-md border p-2 space-y-2">
          <div className="grid grid-cols-1 sm:grid-cols-2 gap-2">
            <div className="space-y-1">
              <Label className="text-[11px]">Nome</Label>
              <Input
                value={novoNome}
                onChange={(e) => setNovoNome(e.target.value)}
                placeholder="Ex.: Cobrança cordial com prazo"
                className="text-xs"
              />
            </div>
            <div className="space-y-1">
              <Label className="text-[11px]">Categoria</Label>
              <select
                value={novoCategoria}
                onChange={(e) =>
                  setNovoCategoria(e.target.value as 'cobranca_antecipada' | 'alerta_inadimplencia')
                }
                className="text-xs border rounded px-2 py-1 w-full bg-white dark:bg-slate-800"
              >
                <option value="cobranca_antecipada">Cobrança (a vencer)</option>
                <option value="alerta_inadimplencia">Inadimplência</option>
              </select>
            </div>
          </div>
          <div className="space-y-1">
            <Label className="text-[11px]">Texto</Label>
            <Textarea
              value={novoTexto}
              onChange={(e) => setNovoTexto(e.target.value)}
              placeholder={
                'Olá, {primeiro_nome}! Tudo bem?\n\nO aluguel de {competencia} vence em {vencimento}.'
              }
              className="text-xs min-h-28"
            />
          </div>
          <div className="flex items-center gap-1">
            <Button size="sm" onClick={criar} disabled={criando}>
              {criando ? 'Criando…' : 'Criar template'}
            </Button>
            <Button size="sm" variant="ghost" onClick={() => setNovoAberto(false)}>
              <X className="w-3.5 h-3.5 mr-0.5" /> Cancelar
            </Button>
          </div>
        </div>
      )}

      {/* Lista de templates */}
      <div className="space-y-1.5">
        {templates.length === 0 && (
          <p className="text-xs text-slate-400 py-2">
            Nenhum template ainda — crie o primeiro com “Novo template”.
          </p>
        )}
        {templates.map((t) => (
          <div key={t.id} className="rounded-md border p-2 space-y-1">
            <div className="flex items-center justify-between gap-2 flex-wrap">
              <div className="flex items-center gap-1.5 flex-wrap">
                <span className="text-xs font-medium">{t.nome}</span>
                <span className="text-[10px] px-1.5 py-0.5 rounded-full bg-slate-100 dark:bg-slate-800 text-slate-600 dark:text-slate-300">
                  {ROTULO_CATEGORIA[t.categoria] || t.categoria}
                </span>
                {t.padrao && (
                  <span className="text-[10px] px-1.5 py-0.5 rounded-full bg-emerald-100 dark:bg-emerald-950 text-emerald-700 dark:text-emerald-300">
                    padrão
                  </span>
                )}
              </div>
              <div className="flex items-center gap-1">
                {editandoId === t.id ? (
                  <>
                    <Button
                      size="sm"
                      onClick={() => salvarEdicao(t.id)}
                      disabled={salvandoId === t.id}
                    >
                      <Save className="w-3.5 h-3.5 mr-1" />
                      {salvandoId === t.id ? 'Salvando…' : 'Salvar'}
                    </Button>
                    <Button size="sm" variant="ghost" onClick={() => setEditandoId(null)}>
                      <X className="w-3.5 h-3.5" />
                    </Button>
                  </>
                ) : (
                  <>
                    <Button
                      size="sm"
                      variant="outline"
                      onClick={() => {
                        setEditandoId(t.id)
                        setTextoEditado(t.texto)
                      }}
                    >
                      Editar
                    </Button>
                    {t.padrao && (
                      <Button size="sm" variant="ghost" onClick={() => restaurar(t.id)}>
                        <RotateCcw className="w-3.5 h-3.5 mr-1" /> Restaurar padrão
                      </Button>
                    )}
                  </>
                )}
              </div>
            </div>
            {editandoId === t.id ? (
              <Textarea
                value={textoEditado}
                onChange={(e) => setTextoEditado(e.target.value)}
                className="text-xs min-h-32"
              />
            ) : (
              <pre className="text-[11px] bg-slate-50 dark:bg-slate-900 rounded p-1.5 whitespace-pre-wrap font-sans text-slate-600 dark:text-slate-300 max-h-40 overflow-y-auto">
                {t.texto}
              </pre>
            )}
          </div>
        ))}
      </div>
    </div>
  )
}
