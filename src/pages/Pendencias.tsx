import React, { useState, useEffect } from 'react'
import { useSearchParams } from 'react-router-dom'
import {
  AlertTriangle,
  Plus,
  Search,
  Filter,
  CheckCircle2,
  Clock,
  Building,
  User,
  ShieldCheck,
  Tag,
} from 'lucide-react'
import {
  getPendencias,
  createPendencia,
  updatePendencia,
  resolverPendencia,
  getImoveis,
  getInquilinos,
  formatDateBR,
} from '@/services/imobiliario'
import { PendenciaModel, ImovelModel, InquilinoModel } from '@/types/database'
import { Button } from '@/components/ui/button'
import { Input } from '@/components/ui/input'
import { Badge } from '@/components/ui/badge'
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

export default function PendenciasPage() {
  const [searchParams] = useSearchParams()
  const openAction = searchParams.get('action')

  const [pendencias, setPendencias] = useState<PendenciaModel[]>([])
  const [imoveis, setImoveis] = useState<ImovelModel[]>([])
  const [inquilinos, setInquilinos] = useState<InquilinoModel[]>([])
  const [loading, setLoading] = useState(true)

  const [filtroCategoria, setFiltroCategoria] = useState<string>('todas')
  const [filtroPrioridade, setFiltroPrioridade] = useState<string>('todas')
  const [filtroStatus, setFiltroStatus] = useState<string>('pendentes')

  // Modais
  const [isModalOpen, setIsModalOpen] = useState(false)
  const [novaPendencia, setNovaPendencia] = useState<Partial<PendenciaModel>>({
    titulo: '',
    categoria: 'contratual',
    prioridade: 'alta',
    status: 'pendente',
    prazo: new Date().toISOString().split('T')[0],
    responsavel: 'Gestor Imobiliário',
    descricao: '',
  })

  const [resolvendoPendencia, setResolvendoPendencia] = useState<PendenciaModel | null>(null)
  const [solucaoTexto, setSolucaoTexto] = useState('')

  useEffect(() => {
    loadData()
  }, [])

  useEffect(() => {
    if (openAction === 'novo') {
      setIsModalOpen(true)
    }
  }, [openAction])

  const loadData = async () => {
    setLoading(true)
    try {
      const [pList, imovList, inqList] = await Promise.all([
        getPendencias(),
        getImoveis(),
        getInquilinos(),
      ])
      setPendencias(pList)
      setImoveis(imovList)
      setInquilinos(inqList)
    } catch (err) {
      toast({
        title: 'Erro ao carregar',
        description: 'Não foi possível carregar pendências.',
        variant: 'destructive',
      })
    } finally {
      setLoading(false)
    }
  }

  const handleCreate = async (e: React.FormEvent) => {
    e.preventDefault()
    if (!novaPendencia.titulo || !novaPendencia.descricao) {
      toast({
        title: 'Campos obrigatórios',
        description: 'Preencha o título e descrição.',
        variant: 'destructive',
      })
      return
    }

    try {
      await createPendencia(novaPendencia)
      toast({
        title: 'Pendência registrada',
        description: 'Tarefa cadastrada na Central de Providências.',
      })
      setIsModalOpen(false)
      setNovaPendencia({
        titulo: '',
        categoria: 'contratual',
        prioridade: 'alta',
        status: 'pendente',
        prazo: new Date().toISOString().split('T')[0],
        responsavel: 'Gestor Imobiliário',
        descricao: '',
      })
      loadData()
    } catch (err) {
      toast({ title: 'Erro ao salvar', description: 'Tente novamente.', variant: 'destructive' })
    }
  }

  const handleConfirmarSolucao = async () => {
    if (!resolvendoPendencia) return
    try {
      await resolverPendencia(
        resolvendoPendencia.id,
        solucaoTexto || 'Resolvido pela Central de Providências',
      )
      toast({
        title: 'Providência concluída!',
        description: 'A tarefa foi arquivada com registro da solução.',
      })
      setResolvendoPendencia(null)
      setSolucaoTexto('')
      loadData()
    } catch (err) {
      toast({ title: 'Erro ao resolver', description: 'Tente novamente.', variant: 'destructive' })
    }
  }

  const prioridadeBadge = (prio: string) => {
    switch (prio) {
      case 'urgente':
        return (
          <Badge variant="destructive" className="text-[10px] font-bold">
            🔴 Urgente
          </Badge>
        )
      case 'alta':
        return (
          <Badge className="bg-orange-600 hover:bg-orange-700 text-white text-[10px] font-bold">
            🟠 Alta
          </Badge>
        )
      case 'media':
        return (
          <Badge className="bg-amber-600 hover:bg-amber-700 text-white text-[10px] font-bold">
            🟡 Média
          </Badge>
        )
      default:
        return (
          <Badge className="bg-emerald-600 hover:bg-emerald-700 text-white text-[10px] font-bold">
            🟢 Baixa
          </Badge>
        )
    }
  }

  const filtered = pendencias.filter((p) => {
    const matchCat = filtroCategoria === 'todas' || p.categoria === filtroCategoria
    const matchPrio = filtroPrioridade === 'todas' || p.prioridade === filtroPrioridade
    const matchSt =
      filtroStatus === 'todas'
        ? true
        : filtroStatus === 'pendentes'
          ? p.status === 'pendente' || p.status === 'em_andamento'
          : p.status === filtroStatus
    return matchCat && matchPrio && matchSt
  })

  return (
    <div className="space-y-6">
      {/* HEADER */}
      <div className="flex flex-col sm:flex-row sm:items-center justify-between gap-4 border-b border-slate-200 dark:border-slate-800 pb-4">
        <div>
          <h1 className="text-xl font-bold tracking-tight text-slate-900 dark:text-slate-100 flex items-center gap-2">
            <span>⚠️ CENTRAL DE PROVIDÊNCIAS</span>
            <Badge variant="secondary" className="text-xs">
              {pendencias.filter((p) => p.status === 'pendente').length} pendentes
            </Badge>
          </h1>
          <p className="text-xs text-slate-500 mt-1">
            Sistema inteligente de acompanhamento de obrigações: Contratuais, Financeiras,
            Documentais e Operacionais com severidade e histórico de soluções.
          </p>
        </div>

        <Button
          size="sm"
          onClick={() => setIsModalOpen(true)}
          className="bg-emerald-600 hover:bg-emerald-700 text-white text-xs h-8 gap-1.5"
        >
          <Plus className="w-3.5 h-3.5" />+ Nova Pendência
        </Button>
      </div>

      {/* FILTROS POR CATEGORIAS EXATAS DO BRIEFING */}
      <div className="flex flex-wrap items-center justify-between gap-3 bg-white dark:bg-slate-900 p-3 rounded-lg border border-slate-200 dark:border-slate-800">
        <div className="flex flex-wrap items-center gap-2">
          <select
            value={filtroCategoria}
            onChange={(e) => setFiltroCategoria(e.target.value)}
            className="h-8 text-xs bg-slate-50 dark:bg-slate-800 border border-slate-200 dark:border-slate-700 rounded-md px-2"
          >
            <option value="todas">Todas as Categorias</option>
            <option value="contratual">Contratuais (Renovar, Aditivo, Assinatura)</option>
            <option value="financeira">Financeiras (Cobrança, Caução, Pagamentos)</option>
            <option value="documental">Documentais (Matrícula, IPTU, Seguro)</option>
            <option value="operacional">Operacionais (Vistorias, Manutenções, Chaves)</option>
          </select>

          <select
            value={filtroPrioridade}
            onChange={(e) => setFiltroPrioridade(e.target.value)}
            className="h-8 text-xs bg-slate-50 dark:bg-slate-800 border border-slate-200 dark:border-slate-700 rounded-md px-2"
          >
            <option value="todas">Todas as Prioridades</option>
            <option value="urgente">🔴 Urgente</option>
            <option value="alta">🟠 Alta</option>
            <option value="media">🟡 Média</option>
            <option value="baixa">🟢 Baixa</option>
          </select>

          <select
            value={filtroStatus}
            onChange={(e) => setFiltroStatus(e.target.value)}
            className="h-8 text-xs bg-slate-50 dark:bg-slate-800 border border-slate-200 dark:border-slate-700 rounded-md px-2"
          >
            <option value="pendentes">Apenas Pendentes / Em Andamento</option>
            <option value="resolvida">Apenas Resolvidas (Histórico)</option>
            <option value="todas">Todas as Ocorrências</option>
          </select>
        </div>
      </div>

      {/* LISTA DE PENDÊNCIAS */}
      <div className="space-y-3">
        {filtered.length === 0 ? (
          <div className="p-8 text-center bg-white dark:bg-slate-900 rounded-lg border text-slate-400 text-xs">
            Nenhuma providência encontrada com os filtros selecionados.
          </div>
        ) : (
          filtered.map((item) => (
            <div
              key={item.id}
              className={`p-4 rounded-lg border transition-colors bg-white dark:bg-slate-900 ${
                item.status === 'resolvida'
                  ? 'border-slate-200 dark:border-slate-800 opacity-60'
                  : item.prioridade === 'urgente'
                    ? 'border-rose-300 dark:border-rose-900 shadow-2xs'
                    : 'border-slate-200 dark:border-slate-800'
              }`}
            >
              <div className="flex flex-col sm:flex-row sm:items-start justify-between gap-3">
                <div className="space-y-1">
                  <div className="flex items-center gap-2 flex-wrap">
                    {prioridadeBadge(item.prioridade)}
                    <Badge variant="outline" className="text-[10px] capitalize">
                      {item.categoria}
                    </Badge>
                    <span className="font-bold text-sm text-slate-900 dark:text-slate-100">
                      {item.titulo}
                    </span>
                    {item.status === 'resolvida' && (
                      <Badge className="bg-emerald-100 text-emerald-800 dark:bg-emerald-950 dark:text-emerald-300 text-[10px]">
                        ✓ Resolvida
                      </Badge>
                    )}
                  </div>

                  <p className="text-xs text-slate-600 dark:text-slate-300 leading-relaxed pt-1">
                    {item.descricao}
                  </p>

                  <div className="flex flex-wrap items-center gap-3 text-[11px] text-slate-400 pt-2">
                    <span>
                      Responsável:{' '}
                      <strong className="text-slate-700 dark:text-slate-300">
                        {item.responsavel}
                      </strong>
                    </span>
                    <span>
                      Prazo limite:{' '}
                      <strong className="text-slate-700 dark:text-slate-300">
                        {formatDateBR(item.prazo)}
                      </strong>
                    </span>
                    {item.solucao_registro && (
                      <span className="text-emerald-600">
                        Solução: {item.solucao_registro} ({formatDateBR(item.data_resolucao)})
                      </span>
                    )}
                  </div>
                </div>

                {item.status !== 'resolvida' && (
                  <Button
                    size="sm"
                    className="h-8 text-xs bg-emerald-600 hover:bg-emerald-700 text-white shrink-0 gap-1.5"
                    onClick={() => {
                      setResolvendoPendencia(item)
                      setSolucaoTexto('')
                    }}
                  >
                    <CheckCircle2 className="w-3.5 h-3.5" />
                    Registrar Solução
                  </Button>
                )}
              </div>
            </div>
          ))
        )}
      </div>

      {/* DIALOG DE RESOLVER PENDÊNCIA */}
      <Dialog
        open={!!resolvendoPendencia}
        onOpenChange={(open) => !open && setResolvendoPendencia(null)}
      >
        <DialogContent className="sm:max-w-md">
          <DialogHeader>
            <DialogTitle className="text-base font-bold flex items-center gap-2">
              <CheckCircle2 className="w-5 h-5 text-emerald-600" />
              <span>Concluir Providência</span>
            </DialogTitle>
          </DialogHeader>

          {resolvendoPendencia && (
            <div className="space-y-4 text-xs">
              <div className="p-3 bg-slate-50 dark:bg-slate-800 rounded">
                <div className="font-semibold text-slate-900 dark:text-slate-100">
                  {resolvendoPendencia.titulo}
                </div>
                <div className="text-slate-500 mt-1">{resolvendoPendencia.descricao}</div>
              </div>

              <div>
                <Label htmlFor="sol_txt" className="text-xs">
                  Descrição da Ação Tomada *
                </Label>
                <Textarea
                  id="sol_txt"
                  rows={3}
                  required
                  value={solucaoTexto}
                  onChange={(e) => setSolucaoTexto(e.target.value)}
                  placeholder="Descreva detalhadamente o desfecho (ex: aluguel cobrado e quitado; seguro renovado; vistoria realizada com entrega de chaves)."
                  className="text-xs mt-1"
                />
              </div>
            </div>
          )}

          <DialogFooter className="gap-2 sm:gap-0">
            <Button
              variant="outline"
              size="sm"
              onClick={() => setResolvendoPendencia(null)}
              className="text-xs"
            >
              Cancelar
            </Button>
            <Button
              size="sm"
              onClick={handleConfirmarSolucao}
              className="bg-emerald-600 hover:bg-emerald-700 text-white text-xs font-semibold"
            >
              Salvar e Arquivar
            </Button>
          </DialogFooter>
        </DialogContent>
      </Dialog>

      {/* MODAL NOVA PENDÊNCIA */}
      <Dialog open={isModalOpen} onOpenChange={setIsModalOpen}>
        <DialogContent className="sm:max-w-md">
          <DialogHeader>
            <DialogTitle className="text-base font-bold">
              Cadastrar Nova Providência / Tarefa
            </DialogTitle>
          </DialogHeader>

          <form onSubmit={handleCreate} className="space-y-4 text-xs">
            <div>
              <Label htmlFor="tit" className="text-xs">
                Título da Tarefa *
              </Label>
              <Input
                id="tit"
                required
                value={novaPendencia.titulo}
                onChange={(e) => setNovaPendencia({ ...novaPendencia, titulo: e.target.value })}
                placeholder="Ex: Realizar vistoria de saída da Sala 05"
                className="text-xs mt-1"
              />
            </div>

            <div className="grid grid-cols-2 gap-3">
              <div>
                <Label htmlFor="cat" className="text-xs">
                  Categoria
                </Label>
                <select
                  id="cat"
                  value={novaPendencia.categoria}
                  onChange={(e) =>
                    setNovaPendencia({ ...novaPendencia, categoria: e.target.value as any })
                  }
                  className="w-full h-9 text-xs mt-1 bg-slate-50 dark:bg-slate-800 border border-slate-200 dark:border-slate-700 rounded-md px-2"
                >
                  <option value="contratual">Contratual</option>
                  <option value="financeira">Financeira</option>
                  <option value="documental">Documental</option>
                  <option value="operacional">Operacional</option>
                </select>
              </div>

              <div>
                <Label htmlFor="prio" className="text-xs">
                  Prioridade
                </Label>
                <select
                  id="prio"
                  value={novaPendencia.prioridade}
                  onChange={(e) =>
                    setNovaPendencia({ ...novaPendencia, prioridade: e.target.value as any })
                  }
                  className="w-full h-9 text-xs mt-1 bg-slate-50 dark:bg-slate-800 border border-slate-200 dark:border-slate-700 rounded-md px-2"
                >
                  <option value="urgente">🔴 Urgente</option>
                  <option value="alta">🟠 Alta</option>
                  <option value="media">🟡 Média</option>
                  <option value="baixa">🟢 Baixa</option>
                </select>
              </div>
            </div>

            <div className="grid grid-cols-2 gap-3">
              <div>
                <Label htmlFor="prz" className="text-xs">
                  Prazo Limite
                </Label>
                <Input
                  id="prz"
                  type="date"
                  value={novaPendencia.prazo}
                  onChange={(e) => setNovaPendencia({ ...novaPendencia, prazo: e.target.value })}
                  className="text-xs mt-1"
                />
              </div>

              <div>
                <Label htmlFor="resp" className="text-xs">
                  Responsável
                </Label>
                <Input
                  id="resp"
                  value={novaPendencia.responsavel}
                  onChange={(e) =>
                    setNovaPendencia({ ...novaPendencia, responsavel: e.target.value })
                  }
                  className="text-xs mt-1"
                />
              </div>
            </div>

            <div>
              <Label htmlFor="desc" className="text-xs">
                Descrição / Detalhes *
              </Label>
              <Textarea
                id="desc"
                rows={3}
                required
                value={novaPendencia.descricao}
                onChange={(e) => setNovaPendencia({ ...novaPendencia, descricao: e.target.value })}
                placeholder="Detalhes operacionais para cumprimento da tarefa..."
                className="text-xs mt-1"
              />
            </div>

            <DialogFooter>
              <Button
                type="button"
                variant="outline"
                size="sm"
                onClick={() => setIsModalOpen(false)}
              >
                Cancelar
              </Button>
              <Button
                type="submit"
                size="sm"
                className="bg-emerald-600 hover:bg-emerald-700 text-white"
              >
                Salvar Pendência
              </Button>
            </DialogFooter>
          </form>
        </DialogContent>
      </Dialog>
    </div>
  )
}
