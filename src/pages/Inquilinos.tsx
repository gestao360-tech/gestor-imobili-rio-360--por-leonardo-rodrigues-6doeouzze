import React, { useState, useEffect } from 'react'
import { useSearchParams } from 'react-router-dom'
import {
  Users,
  Plus,
  Search,
  Mail,
  Phone,
  MessageSquare,
  Eye,
  Edit,
  Trash2,
  Building,
  DollarSign,
  AlertCircle,
} from 'lucide-react'
import {
  getInquilinos,
  createInquilino,
  updateInquilino,
  deleteInquilino,
  getContratos,
} from '@/services/imobiliario'
import { InquilinoModel, ContratoModel } from '@/types/database'
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

export default function InquilinosPage() {
  const [searchParams] = useSearchParams()
  const openAction = searchParams.get('action')

  const [inquilinos, setInquilinos] = useState<InquilinoModel[]>([])
  const [contratos, setContratos] = useState<ContratoModel[]>([])
  const [loading, setLoading] = useState(true)
  const [search, setSearch] = useState('')

  // Modais
  const [isModalOpen, setIsModalOpen] = useState(false)
  const [editingInq, setEditingInq] = useState<Partial<InquilinoModel> | null>(null)
  const [detalheInq, setDetalheInq] = useState<InquilinoModel | null>(null)

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
      const [inqList, contList] = await Promise.all([getInquilinos(), getContratos()])
      setInquilinos(inqList)
      setContratos(contList)
    } catch (err) {
      toast({
        title: 'Erro ao carregar',
        description: 'Não foi possível carregar inquilinos.',
        variant: 'destructive',
      })
    } finally {
      setLoading(false)
    }
  }

  const handleOpenCreate = () => {
    setEditingInq({
      tipo_pessoa: 'PJ',
      nome: '',
      cpf_cnpj: '',
      rg_ie: '',
      data_nasc_const: '',
      email: '',
      telefone: '',
      whatsapp: '',
      endereco: '',
      representante_legal: '',
      contato_financeiro: '',
      observacoes: '',
    })
    setIsModalOpen(true)
  }

  const handleSave = async (e: React.FormEvent) => {
    e.preventDefault()
    if (!editingInq?.nome || !editingInq?.cpf_cnpj) {
      toast({
        title: 'Campos obrigatórios',
        description: 'Nome e CPF/CNPJ são obrigatórios.',
        variant: 'destructive',
      })
      return
    }

    try {
      if (editingInq.id) {
        await updateInquilino(editingInq.id, editingInq)
        toast({ title: 'Inquilino atualizado', description: 'Dados salvos com sucesso.' })
      } else {
        await createInquilino(editingInq)
        toast({ title: 'Inquilino cadastrado', description: 'Novo locatário inserido na base.' })
      }
      setIsModalOpen(false)
      setEditingInq(null)
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
    if (!confirm('Deseja realmente remover este inquilino?')) return
    try {
      await deleteInquilino(id)
      toast({ title: 'Inquilino removido', description: 'Registro apagado com sucesso.' })
      loadData()
    } catch (err) {
      toast({
        title: 'Erro ao excluir',
        description: 'Não foi possível remover.',
        variant: 'destructive',
      })
    }
  }

  const filtered = inquilinos.filter(
    (i) =>
      i.nome.toLowerCase().includes(search.toLowerCase()) ||
      i.cpf_cnpj.toLowerCase().includes(search.toLowerCase()) ||
      (i.email && i.email.toLowerCase().includes(search.toLowerCase())),
  )

  const getContratosDoInquilino = (inqId: string) => {
    return contratos.filter((c) => c.inquilino === inqId)
  }

  return (
    <div className="space-y-6">
      {/* HEADER */}
      <div className="flex flex-col sm:flex-row sm:items-center justify-between gap-4 border-b border-slate-200 dark:border-slate-800 pb-4">
        <div>
          <h1 className="text-xl font-bold tracking-tight text-slate-900 dark:text-slate-100 flex items-center gap-2">
            <span>👥 Gestão de Inquilinos (Locatários)</span>
            <Badge variant="secondary" className="text-xs">
              {inquilinos.length} cadastrados
            </Badge>
          </h1>
          <p className="text-xs text-slate-500 mt-1">
            Cadastro centralizado de PF e PJ, múltiplos contratos simultâneos, histórico financeiro
            e garantias.
          </p>
        </div>

        <Button
          size="sm"
          onClick={handleOpenCreate}
          className="bg-emerald-600 hover:bg-emerald-700 text-white text-xs h-8 gap-1.5"
        >
          <Plus className="w-3.5 h-3.5" />+ Cadastrar Inquilino
        </Button>
      </div>

      {/* BUSCA */}
      <div className="bg-white dark:bg-slate-900 p-3 rounded-lg border border-slate-200 dark:border-slate-800">
        <div className="relative w-full sm:w-80">
          <Search className="w-3.5 h-3.5 absolute left-3 top-1/2 -translate-y-1/2 text-slate-400" />
          <Input
            type="text"
            placeholder="Pesquisar por nome, CPF/CNPJ, e-mail..."
            value={search}
            onChange={(e) => setSearch(e.target.value)}
            className="pl-8 h-8 text-xs bg-slate-50 dark:bg-slate-800"
          />
        </div>
      </div>

      {/* LISTA / TABELA */}
      <div className="bg-white dark:bg-slate-900 border border-slate-200 dark:border-slate-800 rounded-lg overflow-hidden shadow-2xs">
        <div className="overflow-x-auto">
          <table className="w-full text-left border-collapse text-xs">
            <thead>
              <tr className="border-b border-slate-200 dark:border-slate-800 bg-slate-50 dark:bg-slate-850 text-slate-500 uppercase tracking-wider text-[10px]">
                <th className="p-3">Nome / Razão Social</th>
                <th className="p-3">Tipo</th>
                <th className="p-3">CPF / CNPJ</th>
                <th className="p-3">Contatos</th>
                <th className="p-3">Contratos Vinculados</th>
                <th className="p-3">Representante Legal</th>
                <th className="p-3 text-right">Ações</th>
              </tr>
            </thead>
            <tbody className="divide-y divide-slate-100 dark:divide-slate-800">
              {filtered.length === 0 ? (
                <tr>
                  <td colSpan={7} className="p-8 text-center text-slate-400">
                    Nenhum inquilino encontrado.
                  </td>
                </tr>
              ) : (
                filtered.map((item) => {
                  const conts = getContratosDoInquilino(item.id)
                  return (
                    <tr
                      key={item.id}
                      className="hover:bg-slate-50/80 dark:hover:bg-slate-800/40 transition-colors"
                    >
                      <td className="p-3 font-semibold text-slate-900 dark:text-slate-100">
                        {item.nome}
                      </td>
                      <td className="p-3">
                        <Badge variant="outline" className="text-[10px]">
                          {item.tipo_pessoa}
                        </Badge>
                      </td>
                      <td className="p-3 font-mono text-slate-600 dark:text-slate-400">
                        {item.cpf_cnpj}
                      </td>
                      <td className="p-3 text-slate-600 dark:text-slate-400">
                        <div className="flex flex-col gap-0.5">
                          {item.email && (
                            <span className="flex items-center gap-1">
                              <Mail className="w-3 h-3 text-slate-400" /> {item.email}
                            </span>
                          )}
                          {(item.whatsapp || item.telefone) && (
                            <span className="flex items-center gap-1">
                              <Phone className="w-3 h-3 text-slate-400" />{' '}
                              {item.whatsapp || item.telefone}
                            </span>
                          )}
                        </div>
                      </td>
                      <td className="p-3">
                        <Badge
                          className={
                            conts.length > 0
                              ? 'bg-emerald-600 text-white'
                              : 'bg-slate-200 text-slate-700'
                          }
                        >
                          {conts.length} {conts.length === 1 ? 'contrato' : 'contratos'}
                        </Badge>
                      </td>
                      <td className="p-3 text-slate-600 dark:text-slate-400">
                        {item.representante_legal || '-'}
                      </td>
                      <td className="p-3 text-right">
                        <div className="flex items-center justify-end gap-1">
                          <Button
                            variant="ghost"
                            size="icon"
                            className="h-7 w-7 text-slate-500 hover:text-slate-900"
                            title="Ver Ficha do Inquilino"
                            onClick={() => setDetalheInq(item)}
                          >
                            <Eye className="w-3.5 h-3.5" />
                          </Button>
                          <Button
                            variant="ghost"
                            size="icon"
                            className="h-7 w-7 text-slate-500 hover:text-blue-600"
                            title="Editar Inquilino"
                            onClick={() => {
                              setEditingInq(item)
                              setIsModalOpen(true)
                            }}
                          >
                            <Edit className="w-3.5 h-3.5" />
                          </Button>
                          <Button
                            variant="ghost"
                            size="icon"
                            className="h-7 w-7 text-slate-500 hover:text-rose-600"
                            title="Remover"
                            onClick={() => handleDelete(item.id)}
                          >
                            <Trash2 className="w-3.5 h-3.5" />
                          </Button>
                        </div>
                      </td>
                    </tr>
                  )
                })
              )}
            </tbody>
          </table>
        </div>
      </div>

      {/* MODAL CRIAR/EDITAR */}
      <Dialog open={isModalOpen} onOpenChange={setIsModalOpen}>
        <DialogContent className="sm:max-w-xl max-h-[85vh] overflow-y-auto">
          <DialogHeader>
            <DialogTitle className="text-base font-bold">
              {editingInq?.id ? 'Editar Cadastro de Inquilino' : 'Novo Inquilino (Locatário)'}
            </DialogTitle>
          </DialogHeader>

          <form onSubmit={handleSave} className="space-y-4 text-xs">
            <div className="grid grid-cols-1 sm:grid-cols-3 gap-3">
              <div>
                <Label htmlFor="tipo" className="text-xs">
                  Tipo de Pessoa
                </Label>
                <select
                  id="tipo"
                  value={editingInq?.tipo_pessoa || 'PJ'}
                  onChange={(e) =>
                    setEditingInq({ ...editingInq, tipo_pessoa: e.target.value as any })
                  }
                  className="w-full h-9 text-xs mt-1 bg-slate-50 dark:bg-slate-800 border border-slate-200 dark:border-slate-700 rounded-md px-2"
                >
                  <option value="PJ">Pessoa Jurídica (PJ)</option>
                  <option value="PF">Pessoa Física (PF)</option>
                </select>
              </div>
              <div className="sm:col-span-2">
                <Label htmlFor="nome" className="text-xs">
                  Nome Completo ou Razão Social *
                </Label>
                <Input
                  id="nome"
                  required
                  value={editingInq?.nome || ''}
                  onChange={(e) => setEditingInq({ ...editingInq, nome: e.target.value })}
                  placeholder="Ex: Empresa ABC Ltda ou Dr. João da Silva"
                  className="text-xs mt-1"
                />
              </div>
            </div>

            <div className="grid grid-cols-1 sm:grid-cols-3 gap-3">
              <div>
                <Label htmlFor="doc" className="text-xs">
                  CPF ou CNPJ *
                </Label>
                <Input
                  id="doc"
                  required
                  value={editingInq?.cpf_cnpj || ''}
                  onChange={(e) => setEditingInq({ ...editingInq, cpf_cnpj: e.target.value })}
                  placeholder="00.000.000/0001-00"
                  className="text-xs mt-1"
                />
              </div>
              <div>
                <Label htmlFor="rg" className="text-xs">
                  RG ou Inscrição Estadual
                </Label>
                <Input
                  id="rg"
                  value={editingInq?.rg_ie || ''}
                  onChange={(e) => setEditingInq({ ...editingInq, rg_ie: e.target.value })}
                  placeholder="Inscrição ou RG"
                  className="text-xs mt-1"
                />
              </div>
              <div>
                <Label htmlFor="nasc" className="text-xs">
                  Data Nasc. / Fundação
                </Label>
                <Input
                  id="nasc"
                  type="date"
                  value={editingInq?.data_nasc_const || ''}
                  onChange={(e) =>
                    setEditingInq({ ...editingInq, data_nasc_const: e.target.value })
                  }
                  className="text-xs mt-1"
                />
              </div>
            </div>

            <div className="grid grid-cols-1 sm:grid-cols-3 gap-3">
              <div>
                <Label htmlFor="email" className="text-xs">
                  E-mail
                </Label>
                <Input
                  id="email"
                  type="email"
                  value={editingInq?.email || ''}
                  onChange={(e) => setEditingInq({ ...editingInq, email: e.target.value })}
                  placeholder="financeiro@empresa.com"
                  className="text-xs mt-1"
                />
              </div>
              <div>
                <Label htmlFor="whatsapp" className="text-xs">
                  WhatsApp
                </Label>
                <Input
                  id="whatsapp"
                  value={editingInq?.whatsapp || ''}
                  onChange={(e) => setEditingInq({ ...editingInq, whatsapp: e.target.value })}
                  placeholder="(11) 98765-4321"
                  className="text-xs mt-1"
                />
              </div>
              <div>
                <Label htmlFor="telefone" className="text-xs">
                  Telefone Fixo
                </Label>
                <Input
                  id="telefone"
                  value={editingInq?.telefone || ''}
                  onChange={(e) => setEditingInq({ ...editingInq, telefone: e.target.value })}
                  placeholder="(11) 3000-0000"
                  className="text-xs mt-1"
                />
              </div>
            </div>

            <div>
              <Label htmlFor="endereco" className="text-xs">
                Endereço Completo
              </Label>
              <Input
                id="endereco"
                value={editingInq?.endereco || ''}
                onChange={(e) => setEditingInq({ ...editingInq, endereco: e.target.value })}
                placeholder="Rua, número, complemento, bairro, cidade/UF"
                className="text-xs mt-1"
              />
            </div>

            <div className="grid grid-cols-1 sm:grid-cols-2 gap-3">
              <div>
                <Label htmlFor="rep" className="text-xs">
                  Representante Legal
                </Label>
                <Input
                  id="rep"
                  value={editingInq?.representante_legal || ''}
                  onChange={(e) =>
                    setEditingInq({ ...editingInq, representante_legal: e.target.value })
                  }
                  placeholder="Nome do sócio / administrador"
                  className="text-xs mt-1"
                />
              </div>
              <div>
                <Label htmlFor="fin" className="text-xs">
                  Contato Financeiro
                </Label>
                <Input
                  id="fin"
                  value={editingInq?.contato_financeiro || ''}
                  onChange={(e) =>
                    setEditingInq({ ...editingInq, contato_financeiro: e.target.value })
                  }
                  placeholder="Nome e contato do depto financeiro"
                  className="text-xs mt-1"
                />
              </div>
            </div>

            <div>
              <Label htmlFor="obs" className="text-xs">
                Observações / Histórico de Ocorrências
              </Label>
              <Textarea
                id="obs"
                rows={2}
                value={editingInq?.observacoes || ''}
                onChange={(e) => setEditingInq({ ...editingInq, observacoes: e.target.value })}
                className="text-xs mt-1"
                placeholder="Pontualidade, garantias apresentadas, histórico..."
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
                Salvar Inquilino
              </Button>
            </DialogFooter>
          </form>
        </DialogContent>
      </Dialog>

      {/* FICHA DO INQUILINO */}
      <Dialog open={!!detalheInq} onOpenChange={(open) => !open && setDetalheInq(null)}>
        <DialogContent className="sm:max-w-xl max-h-[85vh] overflow-y-auto">
          <DialogHeader>
            <DialogTitle className="text-base font-bold">{detalheInq?.nome}</DialogTitle>
          </DialogHeader>

          {detalheInq && (
            <div className="space-y-4 text-xs">
              <div className="p-3 bg-slate-50 dark:bg-slate-800 rounded grid grid-cols-2 gap-2">
                <div>
                  <span className="text-slate-500">Documento:</span>{' '}
                  <strong className="font-mono">{detalheInq.cpf_cnpj}</strong>
                </div>
                <div>
                  <span className="text-slate-500">Tipo:</span>{' '}
                  <strong>{detalheInq.tipo_pessoa}</strong>
                </div>
                <div>
                  <span className="text-slate-500">E-mail:</span> {detalheInq.email || '-'}
                </div>
                <div>
                  <span className="text-slate-500">Telefone:</span>{' '}
                  {detalheInq.whatsapp || detalheInq.telefone || '-'}
                </div>
                <div className="col-span-2">
                  <span className="text-slate-500">Endereço:</span> {detalheInq.endereco || '-'}
                </div>
              </div>

              <div>
                <div className="font-semibold text-slate-800 dark:text-slate-200 mb-2">
                  Contratos Vinculados ({getContratosDoInquilino(detalheInq.id).length})
                </div>
                {getContratosDoInquilino(detalheInq.id).length === 0 ? (
                  <div className="text-slate-400">Nenhum contrato ativo para este inquilino.</div>
                ) : (
                  <div className="space-y-2">
                    {getContratosDoInquilino(detalheInq.id).map((c) => (
                      <div
                        key={c.id}
                        className="p-2 border rounded flex items-center justify-between"
                      >
                        <div>
                          <div className="font-semibold">{c.numero}</div>
                          <div className="text-slate-500 text-[11px]">
                            Vigência: {c.data_inicio} até {c.data_fim}
                          </div>
                        </div>
                        <div className="text-right">
                          <div className="font-bold text-emerald-600">
                            R$ {c.valor_atual?.toLocaleString('pt-BR')}
                          </div>
                          <Badge variant="outline" className="text-[10px] capitalize">
                            {c.status}
                          </Badge>
                        </div>
                      </div>
                    ))}
                  </div>
                )}
              </div>

              {detalheInq.observacoes && (
                <div className="p-2.5 bg-slate-50 dark:bg-slate-800 rounded">
                  <div className="text-slate-400 text-[10px] uppercase font-semibold">
                    Histórico de Ocorrências
                  </div>
                  <div className="mt-1 text-slate-700 dark:text-slate-300 leading-relaxed">
                    {detalheInq.observacoes}
                  </div>
                </div>
              )}
            </div>
          )}

          <DialogFooter>
            <Button size="sm" variant="outline" onClick={() => setDetalheInq(null)}>
              Fechar
            </Button>
          </DialogFooter>
        </DialogContent>
      </Dialog>
    </div>
  )
}
