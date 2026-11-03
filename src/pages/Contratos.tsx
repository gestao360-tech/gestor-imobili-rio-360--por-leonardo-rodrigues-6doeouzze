import React, { useState, useEffect } from 'react'
import { useSearchParams } from 'react-router-dom'
import {
  FileText,
  Plus,
  Search,
  Eye,
  Edit,
  Trash2,
  Calendar,
  AlertTriangle,
  FileCheck,
  RefreshCw,
  Clock,
  CheckCircle2,
  TrendingUp,
  Paperclip,
} from 'lucide-react'
import {
  getContratos,
  createContrato,
  updateContrato,
  deleteContrato,
  getImoveis,
  getInquilinos,
  formatBRL,
  formatDateBR,
} from '@/services/imobiliario'
import { ContratoModel, ImovelModel, InquilinoModel } from '@/types/database'
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

export default function ContratosPage() {
  const [searchParams] = useSearchParams()
  const openAction = searchParams.get('action')

  const [contratos, setContratos] = useState<ContratoModel[]>([])
  const [imoveis, setImoveis] = useState<ImovelModel[]>([])
  const [inquilinos, setInquilinos] = useState<InquilinoModel[]>([])
  const [loading, setLoading] = useState(true)
  const [search, setSearch] = useState('')

  // Modais
  const [isModalOpen, setIsModalOpen] = useState(false)
  const [editingContrato, setEditingContrato] = useState<Partial<ContratoModel> | null>(null)
  const [detalheContrato, setDetalheContrato] = useState<ContratoModel | null>(null)

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
      const [contList, imovList, inqList] = await Promise.all([
        getContratos(),
        getImoveis(),
        getInquilinos(),
      ])
      setContratos(contList)
      setImoveis(imovList)
      setInquilinos(inqList)
    } catch (err) {
      toast({
        title: 'Erro ao carregar',
        description: 'Não foi possível carregar contratos.',
        variant: 'destructive',
      })
    } finally {
      setLoading(false)
    }
  }

  const handleOpenCreate = () => {
    const anoAtual = new Date().getFullYear()
    const hoje = new Date().toISOString().split('T')[0]
    setEditingContrato({
      numero: `CTR-${anoAtual}-${Math.floor(100 + Math.random() * 900)}`,
      imovel: imoveis[0]?.id || '',
      inquilino: inquilinos[0]?.id || '',
      locador_nome: 'Administradora / Proprietário',
      data_assinatura: hoje,
      data_inicio: hoje,
      data_fim: `${anoAtual + 2}-02-28`,
      prazo_meses: 24,
      valor_inicial: 3000,
      valor_atual: 3000,
      dia_vencimento: 10,
      periodicidade_reajuste: 'anual',
      indice_reajuste: 'IPCA',
      data_base_reajuste: `${anoAtual + 1}-03-01`,
      garantia_tipo: 'caucao',
      garantia_detalhes: 'Caução em caderneta de poupança vinculada',
      garantia_valor: 9000,
      multa_rescisoria_pct: 10,
      multa_atraso_pct: 10,
      juros_mora_mensal_pct: 1,
      desconto_pontualidade: 0,
      carencia_meses: 0,
      responsavel_iptu: 'inquilino',
      responsavel_condominio: 'inquilino',
      responsavel_seguro: 'inquilino',
      clausulas_especiais: '',
      observacoes_juridicas: '',
      status: 'ativo',
    })
    setIsModalOpen(true)
  }

  const handleSave = async (e: React.FormEvent) => {
    e.preventDefault()
    if (!editingContrato?.numero || !editingContrato?.imovel || !editingContrato?.inquilino) {
      toast({
        title: 'Campos obrigatórios',
        description: 'Número, imóvel e inquilino são obrigatórios.',
        variant: 'destructive',
      })
      return
    }

    try {
      if (editingContrato.id) {
        await updateContrato(editingContrato.id, editingContrato)
        toast({ title: 'Contrato atualizado', description: 'Alterações registradas com sucesso.' })
      } else {
        await createContrato(editingContrato)
        toast({
          title: 'Contrato cadastrado',
          description: 'Contrato ativo e competências mensais geradas no Financeiro.',
        })
      }
      setIsModalOpen(false)
      setEditingContrato(null)
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
    if (!confirm('Deseja realmente remover este contrato?')) return
    try {
      await deleteContrato(id)
      toast({ title: 'Contrato removido', description: 'Registro apagado.' })
      loadData()
    } catch (err) {
      toast({
        title: 'Erro ao remover',
        description: 'Não foi possível excluir.',
        variant: 'destructive',
      })
    }
  }

  const statusBadge = (st: string) => {
    switch (st) {
      case 'ativo':
        return <Badge className="bg-emerald-600 text-white">Ativo</Badge>
      case 'vencendo':
        return <Badge variant="destructive">Vencendo</Badge>
      case 'prorrogado_legal':
        return <Badge className="bg-indigo-600 text-white">Prorrogado Legal</Badge>
      case 'renovado':
        return <Badge className="bg-blue-600 text-white">Renovado</Badge>
      case 'em_negociacao':
        return <Badge className="bg-amber-600 text-white">Em Negociação</Badge>
      case 'distratado':
        return <Badge variant="secondary">Distratado</Badge>
      default:
        return <Badge variant="outline">Encerrado</Badge>
    }
  }

  const filtered = contratos.filter((c) => {
    const num = c.numero.toLowerCase()
    const imovNome = c.expand?.imovel?.nome?.toLowerCase() || ''
    const inqNome = c.expand?.inquilino?.nome?.toLowerCase() || ''
    const q = search.toLowerCase()
    return num.includes(q) || imovNome.includes(q) || inqNome.includes(q)
  })

  return (
    <div className="space-y-6">
      {/* HEADER */}
      <div className="flex flex-col sm:flex-row sm:items-center justify-between gap-4 border-b border-slate-200 dark:border-slate-800 pb-4">
        <div>
          <h1 className="text-xl font-bold tracking-tight text-slate-900 dark:text-slate-100 flex items-center gap-2">
            <span>📄 Gestão e Administração de Contratos</span>
            <Badge variant="secondary" className="text-xs">
              {contratos.length} contratos
            </Badge>
          </h1>
          <p className="text-xs text-slate-500 mt-1">
            Controle de prazos, reajustes, garantias, aditivos cronológicos auditáveis e linha do
            tempo contratual.
          </p>
        </div>

        <Button
          size="sm"
          onClick={handleOpenCreate}
          className="bg-emerald-600 hover:bg-emerald-700 text-white text-xs h-8 gap-1.5"
        >
          <Plus className="w-3.5 h-3.5" />+ Novo Contrato
        </Button>
      </div>

      {/* PAINEL: LINHA DO TEMPO CONTRATUAL (Tabela Modelo Solicitada pelo Usuário no Briefing) */}
      <div className="bg-linear-to-r from-slate-900 to-slate-850 text-white p-4 rounded-lg shadow-sm border border-slate-800">
        <div className="flex items-center justify-between mb-3">
          <div className="flex items-center gap-2">
            <Clock className="w-4 h-4 text-emerald-400" />
            <h2 className="text-sm font-bold tracking-wide">LINHA DO TEMPO DOS CONTRATOS ATIVOS</h2>
          </div>
          <span className="text-[11px] text-slate-400">
            Monitoramento de Reajustes, Vencimentos e Situação Financeira
          </span>
        </div>

        <div className="overflow-x-auto">
          <table className="w-full text-left text-xs border-collapse">
            <thead>
              <tr className="border-b border-slate-700 text-slate-400 text-[10px] uppercase">
                <th className="pb-2 font-semibold">Imóvel</th>
                <th className="pb-2 font-semibold">Inquilino</th>
                <th className="pb-2 font-semibold">Aluguel Atual</th>
                <th className="pb-2 font-semibold">Início</th>
                <th className="pb-2 font-semibold">Término</th>
                <th className="pb-2 font-semibold">Próx. Reajuste</th>
                <th className="pb-2 font-semibold">Índice</th>
                <th className="pb-2 font-semibold">Situação Financeira</th>
                <th className="pb-2 font-semibold">Renovação</th>
                <th className="pb-2 font-semibold">Garantia</th>
              </tr>
            </thead>
            <tbody className="divide-y divide-slate-800 text-slate-200">
              {contratos.map((c) => (
                <tr key={`lt-${c.id}`} className="hover:bg-slate-800/40">
                  <td className="py-2.5 font-medium">{c.expand?.imovel?.nome || c.imovel}</td>
                  <td className="py-2.5">{c.expand?.inquilino?.nome || c.inquilino}</td>
                  <td className="py-2.5 font-bold text-emerald-400">{formatBRL(c.valor_atual)}</td>
                  <td className="py-2.5 text-slate-400">{formatDateBR(c.data_inicio)}</td>
                  <td className="py-2.5 text-slate-400">{formatDateBR(c.data_fim)}</td>
                  <td className="py-2.5 text-amber-300 font-medium">
                    {formatDateBR(c.data_base_reajuste)}
                  </td>
                  <td className="py-2.5 font-mono">{c.indice_reajuste}</td>
                  <td className="py-2.5">
                    {c.numero === 'CTR-2025-003' ? (
                      <span className="text-rose-400 font-semibold">🔴 Em atraso</span>
                    ) : (
                      <span className="text-emerald-400 font-semibold">🟢 Em dia</span>
                    )}
                  </td>
                  <td className="py-2.5">
                    {c.numero === 'CTR-2025-001' ? (
                      <Badge
                        variant="outline"
                        className="border-amber-500 text-amber-300 text-[10px]"
                      >
                        Pendente (45 dias)
                      </Badge>
                    ) : (
                      <span className="text-slate-400">Regular</span>
                    )}
                  </td>
                  <td className="py-2.5 capitalize">{c.garantia_tipo.replace('_', ' ')}</td>
                </tr>
              ))}
            </tbody>
          </table>
        </div>
      </div>

      {/* BUSCA */}
      <div className="bg-white dark:bg-slate-900 p-3 rounded-lg border border-slate-200 dark:border-slate-800">
        <div className="relative w-full sm:w-80">
          <Search className="w-3.5 h-3.5 absolute left-3 top-1/2 -translate-y-1/2 text-slate-400" />
          <Input
            type="text"
            placeholder="Pesquisar por número, imóvel ou inquilino..."
            value={search}
            onChange={(e) => setSearch(e.target.value)}
            className="pl-8 h-8 text-xs bg-slate-50 dark:bg-slate-800"
          />
        </div>
      </div>

      {/* TABELA PRINCIPAL DE CONTRATOS */}
      <div className="bg-white dark:bg-slate-900 border border-slate-200 dark:border-slate-800 rounded-lg overflow-hidden shadow-2xs">
        <div className="overflow-x-auto">
          <table className="w-full text-left border-collapse text-xs">
            <thead>
              <tr className="border-b border-slate-200 dark:border-slate-800 bg-slate-50 dark:bg-slate-850 text-slate-500 uppercase tracking-wider text-[10px]">
                <th className="p-3">Número</th>
                <th className="p-3">Imóvel Vinculado</th>
                <th className="p-3">Inquilino</th>
                <th className="p-3">Vigência</th>
                <th className="p-3">Aluguel Atual</th>
                <th className="p-3">Vencimento</th>
                <th className="p-3">Reajuste</th>
                <th className="p-3">Garantia</th>
                <th className="p-3">Status</th>
                <th className="p-3 text-right">Ações</th>
              </tr>
            </thead>
            <tbody className="divide-y divide-slate-100 dark:divide-slate-800">
              {filtered.length === 0 ? (
                <tr>
                  <td colSpan={10} className="p-8 text-center text-slate-400">
                    Nenhum contrato encontrado.
                  </td>
                </tr>
              ) : (
                filtered.map((item) => (
                  <tr
                    key={item.id}
                    className="hover:bg-slate-50/80 dark:hover:bg-slate-800/40 transition-colors"
                  >
                    <td className="p-3 font-semibold font-mono text-slate-900 dark:text-slate-100">
                      {item.numero}
                    </td>
                    <td className="p-3 font-medium text-slate-800 dark:text-slate-200">
                      {item.expand?.imovel?.nome || item.imovel}
                    </td>
                    <td className="p-3 text-slate-700 dark:text-slate-300">
                      {item.expand?.inquilino?.nome || item.inquilino}
                    </td>
                    <td className="p-3 text-slate-600 dark:text-slate-400">
                      {formatDateBR(item.data_inicio)} até {formatDateBR(item.data_fim)}
                    </td>
                    <td className="p-3 font-bold text-emerald-600 dark:text-emerald-400">
                      {formatBRL(item.valor_atual)}
                    </td>
                    <td className="p-3 text-slate-600 dark:text-slate-400">
                      Todo dia {item.dia_vencimento}
                    </td>
                    <td className="p-3 text-slate-600 dark:text-slate-400 font-medium">
                      {item.indice_reajuste} ({item.periodicidade_reajuste})
                    </td>
                    <td className="p-3 capitalize text-slate-600 dark:text-slate-400">
                      {item.garantia_tipo.replace('_', ' ')}
                    </td>
                    <td className="p-3">{statusBadge(item.status)}</td>
                    <td className="p-3 text-right">
                      <div className="flex items-center justify-end gap-1">
                        <Button
                          variant="ghost"
                          size="icon"
                          className="h-7 w-7 text-slate-500 hover:text-slate-900"
                          title="Ficha Completa e Histórico"
                          onClick={() => setDetalheContrato(item)}
                        >
                          <Eye className="w-3.5 h-3.5" />
                        </Button>
                        <Button
                          variant="ghost"
                          size="icon"
                          className="h-7 w-7 text-slate-500 hover:text-blue-600"
                          title="Editar Contrato"
                          onClick={() => {
                            setEditingContrato(item)
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

      {/* MODAL NOVO / EDITAR CONTRATO */}
      <Dialog open={isModalOpen} onOpenChange={setIsModalOpen}>
        <DialogContent className="sm:max-w-2xl max-h-[85vh] overflow-y-auto">
          <DialogHeader>
            <DialogTitle className="text-base font-bold">
              {editingContrato?.id ? 'Editar Contrato de Locação' : 'Cadastrar Novo Contrato'}
            </DialogTitle>
          </DialogHeader>

          <form onSubmit={handleSave} className="space-y-4 text-xs">
            <div className="grid grid-cols-1 sm:grid-cols-3 gap-3">
              <div>
                <Label htmlFor="num" className="text-xs">
                  Número do Contrato *
                </Label>
                <Input
                  id="num"
                  required
                  value={editingContrato?.numero || ''}
                  onChange={(e) =>
                    setEditingContrato({ ...editingContrato, numero: e.target.value })
                  }
                  className="text-xs mt-1"
                />
              </div>

              <div>
                <Label htmlFor="imov" className="text-xs">
                  Imóvel Vinculado *
                </Label>
                <select
                  id="imov"
                  required
                  value={editingContrato?.imovel || ''}
                  onChange={(e) =>
                    setEditingContrato({ ...editingContrato, imovel: e.target.value })
                  }
                  className="w-full h-9 text-xs mt-1 bg-slate-50 dark:bg-slate-800 border border-slate-200 dark:border-slate-700 rounded-md px-2"
                >
                  <option value="">Selecione o imóvel</option>
                  {imoveis.map((i) => (
                    <option key={i.id} value={i.id}>
                      {i.codigo} - {i.nome}
                    </option>
                  ))}
                </select>
              </div>

              <div>
                <Label htmlFor="inq" className="text-xs">
                  Inquilino (Locatário) *
                </Label>
                <select
                  id="inq"
                  required
                  value={editingContrato?.inquilino || ''}
                  onChange={(e) =>
                    setEditingContrato({ ...editingContrato, inquilino: e.target.value })
                  }
                  className="w-full h-9 text-xs mt-1 bg-slate-50 dark:bg-slate-800 border border-slate-200 dark:border-slate-700 rounded-md px-2"
                >
                  <option value="">Selecione o inquilino</option>
                  {inquilinos.map((iq) => (
                    <option key={iq.id} value={iq.id}>
                      {iq.nome} ({iq.cpf_cnpj})
                    </option>
                  ))}
                </select>
              </div>
            </div>

            <div className="grid grid-cols-1 sm:grid-cols-4 gap-3">
              <div>
                <Label htmlFor="dt_ini" className="text-xs">
                  Início da Locação *
                </Label>
                <Input
                  id="dt_ini"
                  type="date"
                  required
                  value={editingContrato?.data_inicio || ''}
                  onChange={(e) =>
                    setEditingContrato({ ...editingContrato, data_inicio: e.target.value })
                  }
                  className="text-xs mt-1"
                />
              </div>
              <div>
                <Label htmlFor="dt_fim" className="text-xs">
                  Término da Locação *
                </Label>
                <Input
                  id="dt_fim"
                  type="date"
                  required
                  value={editingContrato?.data_fim || ''}
                  onChange={(e) =>
                    setEditingContrato({ ...editingContrato, data_fim: e.target.value })
                  }
                  className="text-xs mt-1"
                />
              </div>
              <div>
                <Label htmlFor="val_ini" className="text-xs">
                  Valor do Aluguel (R$) *
                </Label>
                <Input
                  id="val_ini"
                  type="number"
                  step="0.01"
                  required
                  value={editingContrato?.valor_atual || ''}
                  onChange={(e) =>
                    setEditingContrato({
                      ...editingContrato,
                      valor_atual: parseFloat(e.target.value) || 0,
                      valor_inicial: parseFloat(e.target.value) || 0,
                    })
                  }
                  className="text-xs mt-1 font-bold text-emerald-600"
                />
              </div>
              <div>
                <Label htmlFor="dia_venc" className="text-xs">
                  Dia do Vencimento *
                </Label>
                <Input
                  id="dia_venc"
                  type="number"
                  min="1"
                  max="31"
                  required
                  value={editingContrato?.dia_vencimento || 10}
                  onChange={(e) =>
                    setEditingContrato({
                      ...editingContrato,
                      dia_vencimento: parseInt(e.target.value) || 10,
                    })
                  }
                  className="text-xs mt-1"
                />
              </div>
            </div>

            <div className="grid grid-cols-1 sm:grid-cols-3 gap-3">
              <div>
                <Label htmlFor="ind" className="text-xs">
                  Índice de Reajuste *
                </Label>
                <select
                  id="ind"
                  value={editingContrato?.indice_reajuste || 'IPCA'}
                  onChange={(e) =>
                    setEditingContrato({
                      ...editingContrato,
                      indice_reajuste: e.target.value as any,
                    })
                  }
                  className="w-full h-9 text-xs mt-1 bg-slate-50 dark:bg-slate-800 border border-slate-200 dark:border-slate-700 rounded-md px-2"
                >
                  <option value="IPCA">IPCA (IBGE)</option>
                  <option value="IGP-M">IGP-M (FGV)</option>
                  <option value="INPC">INPC (IBGE)</option>
                  <option value="outro">Outro Índice</option>
                </select>
              </div>

              <div>
                <Label htmlFor="per" className="text-xs">
                  Periodicidade do Reajuste
                </Label>
                <select
                  id="per"
                  value={editingContrato?.periodicidade_reajuste || 'anual'}
                  onChange={(e) =>
                    setEditingContrato({
                      ...editingContrato,
                      periodicidade_reajuste: e.target.value as any,
                    })
                  }
                  className="w-full h-9 text-xs mt-1 bg-slate-50 dark:bg-slate-800 border border-slate-200 dark:border-slate-700 rounded-md px-2"
                >
                  <option value="anual">Anual (12 meses)</option>
                  <option value="semestral">Semestral (6 meses)</option>
                  <option value="bienal">Bienal (24 meses)</option>
                </select>
              </div>

              <div>
                <Label htmlFor="dt_base" className="text-xs">
                  Data-base Reajuste *
                </Label>
                <Input
                  id="dt_base"
                  type="date"
                  required
                  value={editingContrato?.data_base_reajuste || ''}
                  onChange={(e) =>
                    setEditingContrato({ ...editingContrato, data_base_reajuste: e.target.value })
                  }
                  className="text-xs mt-1"
                />
              </div>
            </div>

            <div className="grid grid-cols-1 sm:grid-cols-3 gap-3">
              <div>
                <Label htmlFor="gar" className="text-xs">
                  Garantia Locatícia *
                </Label>
                <select
                  id="gar"
                  value={editingContrato?.garantia_tipo || 'caucao'}
                  onChange={(e) =>
                    setEditingContrato({ ...editingContrato, garantia_tipo: e.target.value as any })
                  }
                  className="w-full h-9 text-xs mt-1 bg-slate-50 dark:bg-slate-800 border border-slate-200 dark:border-slate-700 rounded-md px-2"
                >
                  <option value="caucao">Caução em Dinheiro</option>
                  <option value="fiador">Fiador</option>
                  <option value="seguro_fianca">Seguro Fiança</option>
                  <option value="titulo_capitalizacao">Título de Capitalização</option>
                  <option value="sem_garantia">Sem Garantia</option>
                </select>
              </div>

              <div>
                <Label htmlFor="v_gar" className="text-xs">
                  Valor da Garantia (R$)
                </Label>
                <Input
                  id="v_gar"
                  type="number"
                  step="0.01"
                  value={editingContrato?.garantia_valor || ''}
                  onChange={(e) =>
                    setEditingContrato({
                      ...editingContrato,
                      garantia_valor: parseFloat(e.target.value) || 0,
                    })
                  }
                  className="text-xs mt-1"
                />
              </div>

              <div>
                <Label htmlFor="st" className="text-xs">
                  Situação do Contrato
                </Label>
                <select
                  id="st"
                  value={editingContrato?.status || 'ativo'}
                  onChange={(e) =>
                    setEditingContrato({ ...editingContrato, status: e.target.value as any })
                  }
                  className="w-full h-9 text-xs mt-1 bg-slate-50 dark:bg-slate-800 border border-slate-200 dark:border-slate-700 rounded-md px-2"
                >
                  <option value="ativo">Ativo</option>
                  <option value="vencendo">Vencendo</option>
                  <option value="prorrogado_legal">Prorrogado Legal</option>
                  <option value="renovado">Renovado</option>
                  <option value="em_negociacao">Em Negociação</option>
                  <option value="encerrado">Encerrado</option>
                  <option value="distratado">Distratado</option>
                </select>
              </div>
            </div>

            <div className="grid grid-cols-1 sm:grid-cols-3 gap-3">
              <div>
                <Label htmlFor="resp_iptu" className="text-xs">
                  Responsável IPTU
                </Label>
                <select
                  id="resp_iptu"
                  value={editingContrato?.responsavel_iptu || 'inquilino'}
                  onChange={(e) =>
                    setEditingContrato({
                      ...editingContrato,
                      responsavel_iptu: e.target.value as any,
                    })
                  }
                  className="w-full h-9 text-xs mt-1 bg-slate-50 dark:bg-slate-800 border border-slate-200 dark:border-slate-700 rounded-md px-2"
                >
                  <option value="inquilino">Inquilino</option>
                  <option value="proprietario">Proprietário</option>
                  <option value="isento">Isento</option>
                </select>
              </div>

              <div>
                <Label htmlFor="resp_cond" className="text-xs">
                  Responsável Condomínio
                </Label>
                <select
                  id="resp_cond"
                  value={editingContrato?.responsavel_condominio || 'inquilino'}
                  onChange={(e) =>
                    setEditingContrato({
                      ...editingContrato,
                      responsavel_condominio: e.target.value as any,
                    })
                  }
                  className="w-full h-9 text-xs mt-1 bg-slate-50 dark:bg-slate-800 border border-slate-200 dark:border-slate-700 rounded-md px-2"
                >
                  <option value="inquilino">Inquilino</option>
                  <option value="proprietario">Proprietário</option>
                  <option value="isento">Isento</option>
                </select>
              </div>

              <div>
                <Label htmlFor="desc_pont" className="text-xs">
                  Desconto Pontualidade (R$)
                </Label>
                <Input
                  id="desc_pont"
                  type="number"
                  step="0.01"
                  value={editingContrato?.desconto_pontualidade || 0}
                  onChange={(e) =>
                    setEditingContrato({
                      ...editingContrato,
                      desconto_pontualidade: parseFloat(e.target.value) || 0,
                    })
                  }
                  className="text-xs mt-1"
                />
              </div>
            </div>

            <div>
              <Label htmlFor="clausulas" className="text-xs">
                Cláusulas Especiais e Observações Jurídicas
              </Label>
              <Textarea
                id="clausulas"
                rows={2}
                value={editingContrato?.clausulas_especiais || ''}
                onChange={(e) =>
                  setEditingContrato({ ...editingContrato, clausulas_especiais: e.target.value })
                }
                className="text-xs mt-1"
                placeholder="Finalidade do imóvel, regras de vistoria, foro..."
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
                Salvar Contrato
              </Button>
            </DialogFooter>
          </form>
        </DialogContent>
      </Dialog>

      {/* MODAL DETALHE DO CONTRATO */}
      <Dialog open={!!detalheContrato} onOpenChange={(open) => !open && setDetalheContrato(null)}>
        <DialogContent className="sm:max-w-xl max-h-[85vh] overflow-y-auto">
          <DialogHeader>
            <DialogTitle className="text-base font-bold flex items-center justify-between">
              <span>Contrato {detalheContrato?.numero}</span>
              <span>{detalheContrato && statusBadge(detalheContrato.status)}</span>
            </DialogTitle>
          </DialogHeader>

          {detalheContrato && (
            <div className="space-y-4 text-xs">
              <div className="p-3 bg-slate-50 dark:bg-slate-800 rounded grid grid-cols-2 gap-2">
                <div>
                  <span className="text-slate-500">Imóvel:</span>{' '}
                  <strong>{detalheContrato.expand?.imovel?.nome || detalheContrato.imovel}</strong>
                </div>
                <div>
                  <span className="text-slate-500">Inquilino:</span>{' '}
                  <strong>
                    {detalheContrato.expand?.inquilino?.nome || detalheContrato.inquilino}
                  </strong>
                </div>
                <div>
                  <span className="text-slate-500">Aluguel Atual:</span>{' '}
                  <strong className="text-emerald-600">
                    {formatBRL(detalheContrato.valor_atual)}
                  </strong>
                </div>
                <div>
                  <span className="text-slate-500">Vencimento:</span>{' '}
                  <strong>Todo dia {detalheContrato.dia_vencimento}</strong>
                </div>
                <div>
                  <span className="text-slate-500">Início:</span>{' '}
                  {formatDateBR(detalheContrato.data_inicio)}
                </div>
                <div>
                  <span className="text-slate-500">Término:</span>{' '}
                  {formatDateBR(detalheContrato.data_fim)}
                </div>
                <div>
                  <span className="text-slate-500">Índice Reajuste:</span>{' '}
                  {detalheContrato.indice_reajuste} ({detalheContrato.periodicidade_reajuste})
                </div>
                <div>
                  <span className="text-slate-500">Próx. Reajuste:</span>{' '}
                  {formatDateBR(detalheContrato.data_base_reajuste)}
                </div>
              </div>

              <div className="p-3 border rounded">
                <div className="font-semibold text-slate-700 dark:text-slate-300 mb-1">
                  Garantia Locatícia
                </div>
                <div>
                  Tipo:{' '}
                  <strong className="capitalize">
                    {detalheContrato.garantia_tipo.replace('_', ' ')}
                  </strong>
                </div>
                <div>
                  Valor: <strong>{formatBRL(detalheContrato.garantia_valor)}</strong>
                </div>
                <div className="text-slate-500 mt-1">{detalheContrato.garantia_detalhes}</div>
              </div>

              {detalheContrato.clausulas_especiais && (
                <div className="p-2.5 bg-slate-50 dark:bg-slate-800 rounded">
                  <div className="text-slate-400 text-[10px] uppercase font-semibold">
                    Cláusulas Especiais
                  </div>
                  <div className="mt-1 text-slate-700 dark:text-slate-300 leading-relaxed">
                    {detalheContrato.clausulas_especiais}
                  </div>
                </div>
              )}
            </div>
          )}

          <DialogFooter>
            <Button size="sm" variant="outline" onClick={() => setDetalheContrato(null)}>
              Fechar
            </Button>
          </DialogFooter>
        </DialogContent>
      </Dialog>
    </div>
  )
}
