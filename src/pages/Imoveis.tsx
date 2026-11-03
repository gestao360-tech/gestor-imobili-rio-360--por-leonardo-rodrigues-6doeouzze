import React, { useState, useEffect } from 'react'
import { useSearchParams } from 'react-router-dom'
import {
  Building2,
  Plus,
  Search,
  Filter,
  Eye,
  Edit,
  Trash2,
  MapPin,
  CheckCircle,
  FileSpreadsheet,
} from 'lucide-react'
import {
  getImoveis,
  createImovel,
  updateImovel,
  deleteImovel,
  formatBRL,
  getProprietarios,
} from '@/services/imobiliario'
import { ImovelModel, ProprietarioModel } from '@/types/database'
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

export default function ImoveisPage() {
  const [searchParams] = useSearchParams()
  const initialSearch = searchParams.get('search') || ''
  const openAction = searchParams.get('action')

  const [imoveis, setImoveis] = useState<ImovelModel[]>([])
  const [proprietarios, setProprietarios] = useState<ProprietarioModel[]>([])
  const [loading, setLoading] = useState(true)
  const [search, setSearch] = useState(initialSearch)
  const [filtroTipo, setFiltroTipo] = useState<string>('todos')
  const [filtroSituacao, setFiltroSituacao] = useState<string>('todos')

  // Modais
  const [isModalOpen, setIsModalOpen] = useState(false)
  const [editingImovel, setEditingImovel] = useState<Partial<ImovelModel> | null>(null)
  const [detalheImovel, setDetalheImovel] = useState<ImovelModel | null>(null)

  useEffect(() => {
    loadData()
  }, [])

  useEffect(() => {
    if (openAction === 'novo') {
      handleOpenCreate()
    }
  }, [openAction])

  const loadData = async () => {
    setLoading(true)
    try {
      const [imovList, propList] = await Promise.all([getImoveis(), getProprietarios()])
      setImoveis(imovList)
      setProprietarios(propList)
    } catch (err) {
      toast({
        title: 'Erro ao carregar',
        description: 'Não foi possível carregar imóveis.',
        variant: 'destructive',
      })
    } finally {
      setLoading(false)
    }
  }

  const handleOpenCreate = () => {
    setEditingImovel({
      codigo: `IMO-${Math.floor(1000 + Math.random() * 9000)}`,
      nome: '',
      tipo: 'comercial',
      situacao: 'disponivel',
      endereco: '',
      numero: '',
      bairro: '',
      cidade: 'São Paulo',
      estado: 'SP',
      cep: '',
      matricula: '',
      inscricao_municipal: '',
      area_total: 0,
      area_construida: 0,
      valor_estimado: 0,
      valor_aquisicao: 0,
      data_aquisicao: new Date().toISOString().split('T')[0],
      valor_iptu_mensal: 0,
      valor_condominio_mensal: 0,
      valor_seguro_mensal: 0,
      observacoes: '',
    })
    setIsModalOpen(true)
  }

  const handleSave = async (e: React.FormEvent) => {
    e.preventDefault()
    if (!editingImovel?.codigo || !editingImovel?.nome) {
      toast({
        title: 'Campos obrigatórios',
        description: 'Informe o código e nome comercial do imóvel.',
        variant: 'destructive',
      })
      return
    }

    try {
      if (editingImovel.id) {
        await updateImovel(editingImovel.id, editingImovel)
        toast({
          title: 'Imóvel atualizado',
          description: 'Dados salvos com sucesso no Skip Cloud.',
        })
      } else {
        await createImovel(editingImovel)
        toast({
          title: 'Imóvel cadastrado',
          description: 'Novo imóvel inserido na carteira imobiliária.',
        })
      }
      setIsModalOpen(false)
      setEditingImovel(null)
      loadData()
    } catch (err) {
      toast({
        title: 'Erro ao salvar',
        description: 'Verifique os dados preenchidos.',
        variant: 'destructive',
      })
    }
  }

  const handleDelete = async (id: string) => {
    if (!confirm('Deseja realmente remover este imóvel? Todos os vínculos serão afetados.')) return
    try {
      await deleteImovel(id)
      toast({ title: 'Imóvel removido', description: 'Registro apagado com sucesso.' })
      loadData()
    } catch (err) {
      toast({
        title: 'Erro ao remover',
        description: 'Não foi possível excluir.',
        variant: 'destructive',
      })
    }
  }

  const situacaoBadge = (sit: string) => {
    switch (sit) {
      case 'alugado':
        return <Badge className="bg-emerald-600 text-white">Alugado</Badge>
      case 'disponivel':
        return (
          <Badge variant="outline" className="border-blue-500 text-blue-600">
            Disponível
          </Badge>
        )
      case 'reservado':
        return (
          <Badge variant="outline" className="border-amber-500 text-amber-600">
            Reservado
          </Badge>
        )
      case 'em_reforma':
        return (
          <Badge variant="outline" className="border-purple-500 text-purple-600">
            Em Reforma
          </Badge>
        )
      default:
        return <Badge variant="secondary">Inativo</Badge>
    }
  }

  const filtered = imoveis.filter((i) => {
    const matchSearch =
      i.nome.toLowerCase().includes(search.toLowerCase()) ||
      i.codigo.toLowerCase().includes(search.toLowerCase()) ||
      i.endereco.toLowerCase().includes(search.toLowerCase()) ||
      i.bairro.toLowerCase().includes(search.toLowerCase())
    const matchTipo = filtroTipo === 'todos' || i.tipo === filtroTipo
    const matchSituacao = filtroSituacao === 'todos' || i.situacao === filtroSituacao
    return matchSearch && matchTipo && matchSituacao
  })

  return (
    <div className="space-y-6">
      {/* HEADER */}
      <div className="flex flex-col sm:flex-row sm:items-center justify-between gap-4 border-b border-slate-200 dark:border-slate-800 pb-4">
        <div>
          <h1 className="text-xl font-bold tracking-tight text-slate-900 dark:text-slate-100 flex items-center gap-2">
            <span>🏢 Gestão Patrimonial de Imóveis</span>
            <Badge variant="secondary" className="text-xs">
              {imoveis.length} cadastrados
            </Badge>
          </h1>
          <p className="text-xs text-slate-500 mt-1">
            Ficha completa, dados cadastrais, múltiplos proprietários, vistorias e controle de
            vacância.
          </p>
        </div>

        <div className="flex items-center gap-2">
          <Button
            size="sm"
            onClick={handleOpenCreate}
            className="bg-emerald-600 hover:bg-emerald-700 text-white text-xs h-8 gap-1.5"
          >
            <Plus className="w-3.5 h-3.5" />+ Cadastrar Imóvel
          </Button>
        </div>
      </div>

      {/* FILTROS E BUSCA */}
      <div className="flex flex-wrap items-center justify-between gap-3 bg-white dark:bg-slate-900 p-3 rounded-lg border border-slate-200 dark:border-slate-800">
        <div className="relative w-full sm:w-72">
          <Search className="w-3.5 h-3.5 absolute left-3 top-1/2 -translate-y-1/2 text-slate-400" />
          <Input
            type="text"
            placeholder="Buscar por código, nome, bairro..."
            value={search}
            onChange={(e) => setSearch(e.target.value)}
            className="pl-8 h-8 text-xs bg-slate-50 dark:bg-slate-800"
          />
        </div>

        <div className="flex flex-wrap items-center gap-2">
          <select
            value={filtroTipo}
            onChange={(e) => setFiltroTipo(e.target.value)}
            className="h-8 text-xs bg-slate-50 dark:bg-slate-800 border border-slate-200 dark:border-slate-700 rounded-md px-2 text-slate-700 dark:text-slate-300"
          >
            <option value="todos">Todos os Tipos</option>
            <option value="sala">Sala Comercial</option>
            <option value="loja">Loja</option>
            <option value="comercial">Comercial</option>
            <option value="residencial">Residencial</option>
            <option value="galpao">Galpão</option>
            <option value="lote">Lote</option>
          </select>

          <select
            value={filtroSituacao}
            onChange={(e) => setFiltroSituacao(e.target.value)}
            className="h-8 text-xs bg-slate-50 dark:bg-slate-800 border border-slate-200 dark:border-slate-700 rounded-md px-2 text-slate-700 dark:text-slate-300"
          >
            <option value="todos">Todas as Situações</option>
            <option value="alugado">Alugado</option>
            <option value="disponivel">Disponível</option>
            <option value="reservado">Reservado</option>
            <option value="em_reforma">Em Reforma</option>
            <option value="inativo">Inativo</option>
          </select>
        </div>
      </div>

      {/* TABELA DE IMÓVEIS */}
      <div className="bg-white dark:bg-slate-900 border border-slate-200 dark:border-slate-800 rounded-lg overflow-hidden shadow-2xs">
        <div className="overflow-x-auto">
          <table className="w-full text-left border-collapse text-xs">
            <thead>
              <tr className="border-b border-slate-200 dark:border-slate-800 bg-slate-50 dark:bg-slate-850 text-slate-500 uppercase tracking-wider text-[10px]">
                <th className="p-3">Código</th>
                <th className="p-3">Identificação / Nome Comercial</th>
                <th className="p-3">Tipo</th>
                <th className="p-3">Endereço</th>
                <th className="p-3">Área (m²)</th>
                <th className="p-3">IPTU / Condomínio</th>
                <th className="p-3">Situação</th>
                <th className="p-3 text-right">Ações</th>
              </tr>
            </thead>
            <tbody className="divide-y divide-slate-100 dark:divide-slate-800">
              {filtered.length === 0 ? (
                <tr>
                  <td colSpan={8} className="p-8 text-center text-slate-400">
                    Nenhum imóvel encontrado com os filtros aplicados.
                  </td>
                </tr>
              ) : (
                filtered.map((item) => (
                  <tr
                    key={item.id}
                    className="hover:bg-slate-50/80 dark:hover:bg-slate-800/40 transition-colors"
                  >
                    <td className="p-3 font-semibold text-slate-900 dark:text-slate-100 font-mono">
                      {item.codigo}
                    </td>
                    <td className="p-3 font-medium text-slate-800 dark:text-slate-200">
                      {item.nome}
                    </td>
                    <td className="p-3 capitalize text-slate-600 dark:text-slate-400">
                      {item.tipo}
                    </td>
                    <td className="p-3 text-slate-600 dark:text-slate-400">
                      {item.endereco}, {item.numero} — {item.bairro}, {item.cidade}/{item.estado}
                    </td>
                    <td className="p-3 text-slate-600 dark:text-slate-400">
                      {item.area_construida || item.area_total || '-'} m²
                    </td>
                    <td className="p-3 text-slate-600 dark:text-slate-400">
                      {formatBRL(item.valor_iptu_mensal)} /{' '}
                      {formatBRL(item.valor_condominio_mensal)}
                    </td>
                    <td className="p-3">{situacaoBadge(item.situacao)}</td>
                    <td className="p-3 text-right">
                      <div className="flex items-center justify-end gap-1">
                        <Button
                          variant="ghost"
                          size="icon"
                          className="h-7 w-7 text-slate-500 hover:text-slate-900"
                          title="Visualizar Ficha Completa"
                          onClick={() => setDetalheImovel(item)}
                        >
                          <Eye className="w-3.5 h-3.5" />
                        </Button>
                        <Button
                          variant="ghost"
                          size="icon"
                          className="h-7 w-7 text-slate-500 hover:text-blue-600"
                          title="Editar Imóvel"
                          onClick={() => {
                            setEditingImovel(item)
                            setIsModalOpen(true)
                          }}
                        >
                          <Edit className="w-3.5 h-3.5" />
                        </Button>
                        <Button
                          variant="ghost"
                          size="icon"
                          className="h-7 w-7 text-slate-500 hover:text-rose-600"
                          title="Excluir"
                          onClick={() => handleDelete(item.id)}
                        >
                          <Trash2 className="w-3.5 h-3.5" />
                        </Button>
                      </div>
                    </td>
                  </tr>
                ))
              )}
            </tbody>
          </table>
        </div>
      </div>

      {/* MODAL DE CRIAÇÃO / EDIÇÃO */}
      <Dialog open={isModalOpen} onOpenChange={setIsModalOpen}>
        <DialogContent className="sm:max-w-2xl max-h-[85vh] overflow-y-auto">
          <DialogHeader>
            <DialogTitle className="text-base font-bold">
              {editingImovel?.id ? 'Editar Imóvel' : 'Cadastrar Novo Imóvel'}
            </DialogTitle>
          </DialogHeader>

          <form onSubmit={handleSave} className="space-y-4 text-xs">
            <div className="grid grid-cols-1 sm:grid-cols-3 gap-3">
              <div>
                <Label htmlFor="codigo" className="text-xs">
                  Código Interno *
                </Label>
                <Input
                  id="codigo"
                  required
                  value={editingImovel?.codigo || ''}
                  onChange={(e) => setEditingImovel({ ...editingImovel, codigo: e.target.value })}
                  placeholder="Ex: SALA-01"
                  className="text-xs mt-1"
                />
              </div>
              <div className="sm:col-span-2">
                <Label htmlFor="nome" className="text-xs">
                  Nome / Identificação Comercial *
                </Label>
                <Input
                  id="nome"
                  required
                  value={editingImovel?.nome || ''}
                  onChange={(e) => setEditingImovel({ ...editingImovel, nome: e.target.value })}
                  placeholder="Ex: Sala 01 — Edifício Corporate"
                  className="text-xs mt-1"
                />
              </div>
            </div>

            <div className="grid grid-cols-1 sm:grid-cols-3 gap-3">
              <div>
                <Label htmlFor="tipo" className="text-xs">
                  Tipo de Imóvel
                </Label>
                <select
                  id="tipo"
                  value={editingImovel?.tipo || 'comercial'}
                  onChange={(e) =>
                    setEditingImovel({ ...editingImovel, tipo: e.target.value as any })
                  }
                  className="w-full h-9 text-xs mt-1 bg-slate-50 dark:bg-slate-800 border border-slate-200 dark:border-slate-700 rounded-md px-2"
                >
                  <option value="sala">Sala Comercial</option>
                  <option value="loja">Loja</option>
                  <option value="comercial">Comercial</option>
                  <option value="residencial">Residencial</option>
                  <option value="galpao">Galpão</option>
                  <option value="lote">Lote</option>
                  <option value="outros">Outros</option>
                </select>
              </div>

              <div>
                <Label htmlFor="situacao" className="text-xs">
                  Situação Contratual
                </Label>
                <select
                  id="situacao"
                  value={editingImovel?.situacao || 'disponivel'}
                  onChange={(e) =>
                    setEditingImovel({ ...editingImovel, situacao: e.target.value as any })
                  }
                  className="w-full h-9 text-xs mt-1 bg-slate-50 dark:bg-slate-800 border border-slate-200 dark:border-slate-700 rounded-md px-2"
                >
                  <option value="disponivel">Disponível</option>
                  <option value="alugado">Alugado</option>
                  <option value="reservado">Reservado</option>
                  <option value="em_reforma">Em Reforma</option>
                  <option value="inativo">Inativo</option>
                </select>
              </div>

              <div>
                <Label htmlFor="matricula" className="text-xs">
                  Matrícula Imobiliária
                </Label>
                <Input
                  id="matricula"
                  value={editingImovel?.matricula || ''}
                  onChange={(e) =>
                    setEditingImovel({ ...editingImovel, matricula: e.target.value })
                  }
                  placeholder="Nº da matrícula"
                  className="text-xs mt-1"
                />
              </div>
            </div>

            <div className="grid grid-cols-1 sm:grid-cols-4 gap-3">
              <div className="sm:col-span-2">
                <Label htmlFor="endereco" className="text-xs">
                  Logradouro / Endereço *
                </Label>
                <Input
                  id="endereco"
                  required
                  value={editingImovel?.endereco || ''}
                  onChange={(e) => setEditingImovel({ ...editingImovel, endereco: e.target.value })}
                  placeholder="Av. Paulista"
                  className="text-xs mt-1"
                />
              </div>
              <div>
                <Label htmlFor="numero" className="text-xs">
                  Número
                </Label>
                <Input
                  id="numero"
                  value={editingImovel?.numero || ''}
                  onChange={(e) => setEditingImovel({ ...editingImovel, numero: e.target.value })}
                  placeholder="1000"
                  className="text-xs mt-1"
                />
              </div>
              <div>
                <Label htmlFor="complemento" className="text-xs">
                  Complemento
                </Label>
                <Input
                  id="complemento"
                  value={editingImovel?.complemento || ''}
                  onChange={(e) =>
                    setEditingImovel({ ...editingImovel, complemento: e.target.value })
                  }
                  placeholder="Sala 501"
                  className="text-xs mt-1"
                />
              </div>
            </div>

            <div className="grid grid-cols-1 sm:grid-cols-4 gap-3">
              <div>
                <Label htmlFor="bairro" className="text-xs">
                  Bairro *
                </Label>
                <Input
                  id="bairro"
                  required
                  value={editingImovel?.bairro || ''}
                  onChange={(e) => setEditingImovel({ ...editingImovel, bairro: e.target.value })}
                  placeholder="Bela Vista"
                  className="text-xs mt-1"
                />
              </div>
              <div>
                <Label htmlFor="cidade" className="text-xs">
                  Cidade *
                </Label>
                <Input
                  id="cidade"
                  required
                  value={editingImovel?.cidade || ''}
                  onChange={(e) => setEditingImovel({ ...editingImovel, cidade: e.target.value })}
                  placeholder="São Paulo"
                  className="text-xs mt-1"
                />
              </div>
              <div>
                <Label htmlFor="estado" className="text-xs">
                  Estado *
                </Label>
                <Input
                  id="estado"
                  required
                  value={editingImovel?.estado || ''}
                  onChange={(e) => setEditingImovel({ ...editingImovel, estado: e.target.value })}
                  placeholder="SP"
                  className="text-xs mt-1"
                />
              </div>
              <div>
                <Label htmlFor="cep" className="text-xs">
                  CEP
                </Label>
                <Input
                  id="cep"
                  value={editingImovel?.cep || ''}
                  onChange={(e) => setEditingImovel({ ...editingImovel, cep: e.target.value })}
                  placeholder="01310-100"
                  className="text-xs mt-1"
                />
              </div>
            </div>

            <div className="grid grid-cols-1 sm:grid-cols-3 gap-3">
              <div>
                <Label htmlFor="iptu" className="text-xs">
                  IPTU Mensal (R$)
                </Label>
                <Input
                  id="iptu"
                  type="number"
                  step="0.01"
                  value={editingImovel?.valor_iptu_mensal || ''}
                  onChange={(e) =>
                    setEditingImovel({
                      ...editingImovel,
                      valor_iptu_mensal: parseFloat(e.target.value) || 0,
                    })
                  }
                  className="text-xs mt-1"
                />
              </div>
              <div>
                <Label htmlFor="condominio" className="text-xs">
                  Condomínio Mensal (R$)
                </Label>
                <Input
                  id="condominio"
                  type="number"
                  step="0.01"
                  value={editingImovel?.valor_condominio_mensal || ''}
                  onChange={(e) =>
                    setEditingImovel({
                      ...editingImovel,
                      valor_condominio_mensal: parseFloat(e.target.value) || 0,
                    })
                  }
                  className="text-xs mt-1"
                />
              </div>
              <div>
                <Label htmlFor="seguro" className="text-xs">
                  Seguro Mensal (R$)
                </Label>
                <Input
                  id="seguro"
                  type="number"
                  step="0.01"
                  value={editingImovel?.valor_seguro_mensal || ''}
                  onChange={(e) =>
                    setEditingImovel({
                      ...editingImovel,
                      valor_seguro_mensal: parseFloat(e.target.value) || 0,
                    })
                  }
                  className="text-xs mt-1"
                />
              </div>
            </div>

            <div>
              <Label htmlFor="obs" className="text-xs">
                Observações Administrativas
              </Label>
              <Textarea
                id="obs"
                rows={2}
                value={editingImovel?.observacoes || ''}
                onChange={(e) =>
                  setEditingImovel({ ...editingImovel, observacoes: e.target.value })
                }
                className="text-xs mt-1"
                placeholder="Histórico de manutenções, benfeitorias, acabamentos..."
              />
            </div>

            <DialogFooter className="pt-2">
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
                Salvar Imóvel
              </Button>
            </DialogFooter>
          </form>
        </DialogContent>
      </Dialog>

      {/* FICHA COMPLETA DO IMÓVEL */}
      <Dialog open={!!detalheImovel} onOpenChange={(open) => !open && setDetalheImovel(null)}>
        <DialogContent className="sm:max-w-xl max-h-[85vh] overflow-y-auto">
          <DialogHeader>
            <DialogTitle className="text-base font-bold flex items-center justify-between">
              <span>{detalheImovel?.nome}</span>
              <span className="text-xs font-mono text-slate-500">{detalheImovel?.codigo}</span>
            </DialogTitle>
          </DialogHeader>

          {detalheImovel && (
            <div className="space-y-4 text-xs">
              <div className="grid grid-cols-2 gap-2 p-3 bg-slate-50 dark:bg-slate-800 rounded-lg">
                <div>
                  <span className="text-slate-500">Situação:</span>{' '}
                  <span className="font-semibold">{situacaoBadge(detalheImovel.situacao)}</span>
                </div>
                <div>
                  <span className="text-slate-500">Tipo:</span>{' '}
                  <span className="font-semibold capitalize">{detalheImovel.tipo}</span>
                </div>
                <div>
                  <span className="text-slate-500">Área Privativa:</span>{' '}
                  <span className="font-semibold">{detalheImovel.area_construida || '-'} m²</span>
                </div>
                <div>
                  <span className="text-slate-500">Área Total:</span>{' '}
                  <span className="font-semibold">{detalheImovel.area_total || '-'} m²</span>
                </div>
              </div>

              <div>
                <div className="font-semibold text-slate-700 dark:text-slate-300 mb-1">
                  Localização
                </div>
                <div className="text-slate-600 dark:text-slate-400">
                  {detalheImovel.endereco}, {detalheImovel.numero} {detalheImovel.complemento} —{' '}
                  {detalheImovel.bairro}, {detalheImovel.cidade}/{detalheImovel.estado} • CEP:{' '}
                  {detalheImovel.cep}
                </div>
              </div>

              <div className="grid grid-cols-3 gap-2">
                <div className="p-2 border rounded">
                  <div className="text-slate-400 text-[10px]">IPTU Mensal</div>
                  <div className="font-bold">{formatBRL(detalheImovel.valor_iptu_mensal)}</div>
                </div>
                <div className="p-2 border rounded">
                  <div className="text-slate-400 text-[10px]">Condomínio</div>
                  <div className="font-bold">
                    {formatBRL(detalheImovel.valor_condominio_mensal)}
                  </div>
                </div>
                <div className="p-2 border rounded">
                  <div className="text-slate-400 text-[10px]">Seguro</div>
                  <div className="font-bold">{formatBRL(detalheImovel.valor_seguro_mensal)}</div>
                </div>
              </div>

              {detalheImovel.observacoes && (
                <div className="p-2.5 bg-slate-50 dark:bg-slate-800 rounded">
                  <div className="text-slate-400 text-[10px] uppercase font-semibold">
                    Observações / Vistorias
                  </div>
                  <div className="mt-1 text-slate-700 dark:text-slate-300 leading-relaxed">
                    {detalheImovel.observacoes}
                  </div>
                </div>
              )}
            </div>
          )}

          <DialogFooter>
            <Button size="sm" variant="outline" onClick={() => setDetalheImovel(null)}>
              Fechar
            </Button>
          </DialogFooter>
        </DialogContent>
      </Dialog>
    </div>
  )
}
