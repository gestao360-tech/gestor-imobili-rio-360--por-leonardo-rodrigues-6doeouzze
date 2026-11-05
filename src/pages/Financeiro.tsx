import React, { useState, useEffect } from 'react'
import { useSearchParams } from 'react-router-dom'
import {
  DollarSign,
  Plus,
  Search,
  Filter,
  CheckCircle2,
  Clock,
  AlertTriangle,
  Receipt,
  FileSpreadsheet,
  Download,
  Calendar,
  Building,
  User,
  ArrowDownLeft,
  ArrowUpRight,
  Link2,
  Copy,
  ExternalLink,
  Loader2,
} from 'lucide-react'
import {
  getCobrancas,
  registrarBaixaPagamento,
  formatBRL,
  formatDateBR,
  getDespesas,
} from '@/services/imobiliario'
import { gerarLinkPagamento } from '@/services/pagamentos'
import { emitirReciboAluguel, criarItemFilaRecibo } from '@/services/recibos'
import { CobrancaModel, DespesaModel } from '@/types/database'
import { Button } from '@/components/ui/button'
import { Input } from '@/components/ui/input'
import { Badge } from '@/components/ui/badge'
import { Card, CardHeader, CardTitle, CardContent } from '@/components/ui/card'
import {
  Dialog,
  DialogContent,
  DialogDescription,
  DialogHeader,
  DialogTitle,
  DialogFooter,
} from '@/components/ui/dialog'
import { Send } from 'lucide-react'
import { Label } from '@/components/ui/label'
import { Textarea } from '@/components/ui/textarea'
import { toast } from '@/hooks/use-toast'

export default function FinanceiroPage() {
  const [searchParams] = useSearchParams()
  const openAction = searchParams.get('action')

  const [cobrancas, setCobrancas] = useState<CobrancaModel[]>([])
  const [despesas, setDespesas] = useState<DespesaModel[]>([])
  const [loading, setLoading] = useState(true)
  const [search, setSearch] = useState('')
  const [filtroStatus, setFiltroStatus] = useState<string>('todos')
  const [abaAtiva, setAbaAtiva] = useState<'receber' | 'pagar' | 'fluxo'>('receber')

  // Modal Baixa de Pagamento
  const [cobrancaBaixa, setCobrancaBaixa] = useState<CobrancaModel | null>(null)
  const [valorBaixa, setValorBaixa] = useState<number>(0)
  const [dataBaixa, setDataBaixa] = useState<string>('')
  const [formaPagamento, setFormaPagamento] = useState<
    'pix' | 'boleto' | 'ted_doc' | 'dinheiro' | 'cartao' | 'outra'
  >('pix')
  const [contaBancaria, setContaBancaria] = useState('Itaú Ag 1234 CC 56789-0')
  const [observacoesBaixa, setObservacoesBaixa] = useState('')
  const [salvandoBaixa, setSalvandoBaixa] = useState(false)

  // Recibo de aluguel — estado por cobrança (emissão / envio à fila)
  const [emitindoRecibo, setEmitindoRecibo] = useState<string>('')
  const [avisosRecibo, setAvisosRecibo] = useState<{ cobranca: string; mensagem: string } | null>(
    null,
  )
  const [erroRecibo, setErroRecibo] = useState<{ cobranca: string; mensagem: string } | null>(null)
  const [enviandoReciboFila, setEnviandoReciboFila] = useState<string>('')
  // Pós-baixa: URL do recibo emitido, para oferecer "Enviar recibo ao WhatsApp"
  const [baixaConcluida, setBaixaConcluida] = useState<{
    cobranca: CobrancaModel
    reciboUrl: string
  } | null>(null)
  // Cobranças com recibo já emitido (número + URL), mescladas com os dados reais
  const [recibos, setRecibos] = useState<Record<string, { numero?: string; url?: string }>>({})
  const [reciboVisualizar, setReciboVisualizar] = useState<CobrancaModel | null>(null)

  const reciboDe = (item: CobrancaModel) => recibos[item.id] || {}
  const cobrancaQuitavel = (item: CobrancaModel) =>
    (item.status === 'pago' || item.status === 'pago_parcialmente') && (item.valor_pago || 0) > 0
  const urlRecibo = (item: CobrancaModel) => reciboDe(item).url || item.recibo_url || ''

  // Links de pagamento (Stripe) — estado por cobrança (gerar/copiar)
  const [gerandoLink, setGerandoLink] = useState<string>('')
  const [copiandoLink, setCopiandoLink] = useState<string>('')
  const [erroLink, setErroLink] = useState<{ cobranca: string; mensagem: string } | null>(null)
  const [cobrancasComLink, setCobrancasComLink] = useState<Record<string, string>>({})

  // Status "em aberto" = qualquer um que ainda tem dinheiro a receber
  const cobrancaEmAberto = (c: CobrancaModel) =>
    c.status !== 'pago' &&
    c.status !== 'cancelado' &&
    c.status !== 'renegociado' &&
    (c.valor_total || 0) - (c.valor_pago || 0) > 0

  const handleGerarLink = async (item: CobrancaModel) => {
    setErroLink(null)
    setGerandoLink(item.id)
    try {
      const res = await gerarLinkPagamento(item.id)
      if (res.ok && res.url) {
        setCobrancasComLink((prev) => ({ ...prev, [item.id]: res.url as string }))
        toast({
          title: res.criado ? 'Link de pagamento criado!' : 'Link de pagamento existente',
          description: res.criado
            ? 'O link do Stripe foi gerado e vinculado à cobrança.'
            : 'A cobrança já tinha um link — ele foi reutilizado (nada duplicado).',
        })
      } else {
        const msg = res.erro || 'Não foi possível gerar o link de pagamento.'
        setErroLink({ cobranca: item.id, mensagem: msg })
        toast({ title: 'Erro ao gerar link', description: msg, variant: 'destructive' })
      }
    } catch (err: unknown) {
      const msg = err instanceof Error ? err.message : 'Falha ao comunicar com o servidor.'
      setErroLink({ cobranca: item.id, mensagem: msg })
      toast({
        title: 'Erro ao gerar link',
        description: msg.includes('Stripe')
          ? msg
          : msg + ' — conecte/autorize o Stripe nas configurações (Conectores).',
        variant: 'destructive',
      })
    } finally {
      setGerandoLink('')
    }
  }

  const handleCopiarLink = async (item: CobrancaModel) => {
    const url = cobrancasComLink[item.id] || item.link_pagamento || ''
    if (!url) return
    setCopiandoLink(item.id)
    try {
      if (navigator.clipboard && window.isSecureContext) {
        await navigator.clipboard.writeText(url)
      } else {
        const ta = document.createElement('textarea')
        ta.value = url
        ta.style.position = 'fixed'
        ta.style.opacity = '0'
        document.body.appendChild(ta)
        ta.select()
        document.execCommand('copy')
        document.body.removeChild(ta)
      }
      toast({ title: 'Link copiado', description: 'Envie ao inquilino por qualquer canal.' })
    } catch (err: unknown) {
      const msg = err instanceof Error ? err.message : 'Não foi possível copiar o link.'
      setErroLink({ cobranca: item.id, mensagem: msg })
      toast({ title: 'Erro ao copiar', description: msg, variant: 'destructive' })
    } finally {
      setCopiandoLink('')
    }
  }

  useEffect(() => {
    loadData()
  }, [])

  useEffect(() => {
    if (openAction === 'pagamento' && cobrancas.length > 0) {
      // Abre a primeira cobrança pendente para registrar pagamento
      const pend = cobrancas.find(
        (c) =>
          c.status === 'vencido' || c.status === 'a_vencer' || c.status === 'pago_parcialmente',
      )
      if (pend) handleOpenBaixa(pend)
    }
  }, [openAction, cobrancas])

  const loadData = async () => {
    setLoading(true)
    try {
      const [cobList, despList] = await Promise.all([getCobrancas(), getDespesas()])
      setCobrancas(cobList)
      setDespesas(despList)
    } catch (err) {
      toast({
        title: 'Erro ao carregar',
        description: 'Não foi possível carregar dados financeiros.',
        variant: 'destructive',
      })
    } finally {
      setLoading(false)
    }
  }

  /** Emite o recibo: busca dados no backend, gera o PDF no cliente, sobe em
   *  documentos e grava número/URL na cobrança. Cobrança em aberto NUNCA finge
   *  sucesso — o erro do backend ("exige baixa") vira aviso visível. */
  const handleEmitirRecibo = async (item: CobrancaModel) => {
    if (!cobrancaQuitavel(item)) {
      setAvisosRecibo({
        cobranca: item.id,
        mensagem:
          'O recibo de quitação exige baixa: registre o pagamento (total ou parcial) antes de emitir o recibo.',
      })
      toast({
        title: 'Recibo exige baixa',
        description: 'Registre o pagamento (total ou parcial) antes de emitir o recibo.',
        variant: 'destructive',
      })
      return
    }
    setErroRecibo(null)
    setAvisosRecibo(null)
    setEmitindoRecibo(item.id)
    try {
      const dados = await emitirReciboAluguel(item.id)
      setRecibos((prev) => ({
        ...prev,
        [item.id]: { numero: dados.numero, url: dados.url },
      }))
      if (dados.url) {
        const a = document.createElement('a')
        a.href = dados.url
        a.target = '_blank'
        a.rel = 'noreferrer'
        a.download = 'recibo-' + dados.numero + '.pdf'
        document.body.appendChild(a)
        a.click()
        document.body.removeChild(a)
      }
      toast({
        title: 'Recibo ' + dados.numero + ' emitido!',
        description:
          dados.saldo > 0.005
            ? 'PDF gerado e salvo em Documentos (saldo parcial: ' + formatBRL(dados.saldo) + ').'
            : 'PDF gerado, baixado e salvo em Documentos.',
      })
    } catch (err: unknown) {
      const msg = err instanceof Error ? err.message : 'Falha ao emitir o recibo.'
      setErroRecibo({ cobranca: item.id, mensagem: msg })
      toast({ title: 'Erro ao emitir recibo', description: msg, variant: 'destructive' })
    } finally {
      setEmitindoRecibo('')
    }
  }

  /** Cria o item PENDENTE na fila de WhatsApp (nada dispara sozinho). Dedupe
   *  no backend; aviso "precisa de atenção" quando o WhatsApp é inválido. */
  const handleEnviarReciboWhatsApp = async (cobrancaId: string, url: string) => {
    setErroRecibo(null)
    setAvisosRecibo(null)
    setEnviandoReciboFila(cobrancaId)
    try {
      const res = await criarItemFilaRecibo(cobrancaId, url)
      if (res.aviso) {
        setAvisosRecibo({ cobranca: cobrancaId, mensagem: res.aviso })
        toast({ title: 'Atenção', description: res.aviso, variant: 'destructive' })
        return
      }
      if (res.dedupe) {
        toast({
          title: 'Recibo já está na fila',
          description: 'Esta cobrança já tem um item de recibo aguardando confirmação.',
        })
      } else {
        toast({
          title: 'Recibo na fila do WhatsApp!',
          description:
            'Item pendente criado — revise e confirme o envio na página 📱 WhatsApp (nada dispara sozinho).',
        })
      }
    } catch (err: unknown) {
      const msg = err instanceof Error ? err.message : 'Falha ao enfileirar o recibo.'
      setErroRecibo({ cobranca: cobrancaId, mensagem: msg })
      toast({ title: 'Erro ao enviar recibo', description: msg, variant: 'destructive' })
    } finally {
      setEnviandoReciboFila('')
    }
  }

  const handleOpenBaixa = (cob: CobrancaModel) => {
    setCobrancaBaixa(cob)
    const saldoRestante = Math.max(0, (cob.valor_total || 0) - (cob.valor_pago || 0))
    setValorBaixa(saldoRestante)
    setDataBaixa(new Date().toISOString().split('T')[0])
    setFormaPagamento('pix')
    setObservacoesBaixa('')
  }

  const handleConfirmarBaixa = async () => {
    if (!cobrancaBaixa) return
    if (valorBaixa <= 0) {
      toast({
        title: 'Valor inválido',
        description: 'Informe um valor maior que zero.',
        variant: 'destructive',
      })
      return
    }

    setSalvandoBaixa(true)
    try {
      const cobrancaAlvo = cobrancaBaixa
      await registrarBaixaPagamento({
        cobrancaId: cobrancaBaixa.id,
        valorPago: valorBaixa,
        dataPagamento: dataBaixa,
        formaPagamento: formaPagamento,
        contaBancaria: contaBancaria,
        observacoes: observacoesBaixa,
      })

      toast({
        title: 'Pagamento registrado com sucesso!',
        description: `Baixa de ${formatBRL(valorBaixa)} confirmada.`,
      })

      setCobrancaBaixa(null)
      loadData()

      // Recibo automaticamente após a baixa: emite o PDF e OFERECE o envio ao
      // WhatsApp — o envio em si nunca dispara sozinho (fila pendente).
      try {
        const dados = await emitirReciboAluguel(cobrancaAlvo.id)
        setRecibos((prev) => ({
          ...prev,
          [cobrancaAlvo.id]: { numero: dados.numero, url: dados.url },
        }))
        setBaixaConcluida({ cobranca: cobrancaAlvo, reciboUrl: dados.url })
      } catch (errRecibo: unknown) {
        // Recibo não é crítico para a baixa: o usuário pode emitir depois pelo botão.
        console.warn('Recibo pós-baixa não emitido:', errRecibo)
      }
    } catch (err) {
      toast({
        title: 'Erro ao registrar baixa',
        description: 'Tente novamente.',
        variant: 'destructive',
      })
    } finally {
      setSalvandoBaixa(false)
    }
  }

  // Exportar para Excel (.csv simples formato pt-BR)
  const handleExportCSV = () => {
    const headers = [
      'Competencia',
      'Imovel',
      'Inquilino',
      'Vencimento',
      'Aluguel',
      'IPTU',
      'Condominio',
      'Total',
      'Valor Pago',
      'Data Pagto',
      'Status',
    ]
    const rows = cobrancas.map((c) => [
      c.competencia,
      c.expand?.imovel?.nome || c.imovel,
      c.expand?.inquilino?.nome || c.inquilino,
      c.vencimento,
      c.valor_aluguel,
      c.valor_iptu || 0,
      c.valor_condominio || 0,
      c.valor_total,
      c.valor_pago || 0,
      c.data_pagamento || '',
      c.status,
    ])

    const csvContent =
      'data:text/csv;charset=utf-8,' +
      [headers.join(';'), ...rows.map((r) => r.join(';'))].join('\n')
    const encodedUri = encodeURI(csvContent)
    const link = document.createElement('a')
    link.setAttribute('href', encodedUri)
    link.setAttribute(
      'download',
      `Financeiro_Alugueis_${new Date().toISOString().slice(0, 10)}.csv`,
    )
    document.body.appendChild(link)
    link.click()
    document.body.removeChild(link)
    toast({ title: 'Exportação concluída', description: 'Planilha exportada com sucesso.' })
  }

  const statusCobrancaBadge = (st: string) => {
    switch (st) {
      case 'pago':
        return (
          <Badge className="bg-emerald-600 hover:bg-emerald-700 text-white font-bold">Pago</Badge>
        )
      case 'pago_parcialmente':
        return (
          <Badge className="bg-amber-600 hover:bg-amber-700 text-white font-bold">
            Pago Parcialmente
          </Badge>
        )
      case 'vencido':
        return (
          <Badge variant="destructive" className="font-bold">
            Vencido
          </Badge>
        )
      case 'em_negociacao':
        return (
          <Badge className="bg-navy-secondary text-white border-navy-border font-bold">
            Em Negociação
          </Badge>
        )
      case 'renegociado':
        return (
          <Badge className="bg-blue-600 hover:bg-blue-700 text-white font-bold">Renegociado</Badge>
        )
      case 'cancelado':
        return (
          <Badge variant="secondary" className="font-medium">
            Cancelado
          </Badge>
        )
      default:
        return (
          <Badge
            variant="outline"
            className="border-slate-400 dark:border-slate-600 text-slate-700 dark:text-slate-300 font-semibold"
          >
            A Vencer
          </Badge>
        )
    }
  }

  // Totais rápidos
  const totalFaturado = cobrancas.reduce((acc, c) => acc + (c.valor_total || 0), 0)
  const totalRecebido = cobrancas.reduce((acc, c) => acc + (c.valor_pago || 0), 0)
  const totalVencido = cobrancas
    .filter((c) => c.status === 'vencido')
    .reduce((acc, c) => acc + (c.valor_total - (c.valor_pago || 0)), 0)
  const totalDespesas = despesas.reduce((acc, d) => acc + (d.valor || 0), 0)

  const filtered = cobrancas.filter((c) => {
    const imov = c.expand?.imovel?.nome?.toLowerCase() || ''
    const inq = c.expand?.inquilino?.nome?.toLowerCase() || ''
    const comp = c.competencia.toLowerCase()
    const q = search.toLowerCase()
    const matchSearch = imov.includes(q) || inq.includes(q) || comp.includes(q)
    const matchStatus = filtroStatus === 'todos' || c.status === filtroStatus
    return matchSearch && matchStatus
  })

  return (
    <div className="space-y-6">
      {/* HEADER */}
      <div className="flex flex-col sm:flex-row sm:items-center justify-between gap-4 border-b border-slate-200 dark:border-slate-800 pb-4">
        <div>
          <h1 className="text-xl font-bold tracking-tight text-slate-900 dark:text-slate-100 flex items-center gap-2">
            <span>💰 Gestão Financeira dos Aluguéis & Fluxo de Caixa</span>
          </h1>
          <p className="text-xs text-slate-500 mt-1">
            Contas a receber, competências automáticas, baixa total e parcial, recibos em PDF e
            despesas de imóveis.
          </p>
        </div>

        <div className="flex items-center gap-2">
          <Button
            size="sm"
            variant="outline"
            onClick={handleExportCSV}
            className="text-xs h-8 gap-1.5 border-slate-300 dark:border-slate-700"
          >
            <Download className="w-3.5 h-3.5" />
            Exportar Excel (.csv)
          </Button>
        </div>
      </div>

      {/* CARDS COM RESUMO FINANCEIRO */}
      <div className="grid grid-cols-2 md:grid-cols-4 gap-3 sm:gap-4">
        <div className="p-3.5 bg-white dark:bg-slate-900 rounded-lg border border-slate-200 dark:border-slate-800 shadow-2xs">
          <div className="text-[10px] font-semibold text-slate-500 uppercase">TOTAL FATURADO</div>
          <div className="text-lg font-bold text-slate-900 dark:text-slate-100 mt-0.5">
            {formatBRL(totalFaturado)}
          </div>
          <div className="text-[10px] text-slate-400">todas as competências</div>
        </div>

        <div className="p-3.5 bg-emerald-50/50 dark:bg-emerald-950/20 rounded-lg border border-emerald-200 dark:border-emerald-900/60 shadow-2xs">
          <div className="text-[10px] font-semibold text-emerald-700 dark:text-emerald-400 uppercase">
            EFETIVAMENTE RECEBIDO
          </div>
          <div className="text-lg font-bold text-emerald-700 dark:text-emerald-300 mt-0.5">
            {formatBRL(totalRecebido)}
          </div>
          <div className="text-[10px] text-emerald-600/80">baixado no caixa</div>
        </div>

        <div className="p-3.5 bg-rose-50/50 dark:bg-rose-950/20 rounded-lg border border-rose-200 dark:border-rose-900/60 shadow-2xs">
          <div className="text-[10px] font-semibold text-rose-700 dark:text-rose-400 uppercase">
            INADIMPLÊNCIA / VENCIDOS
          </div>
          <div className="text-lg font-bold text-rose-700 dark:text-rose-300 mt-0.5">
            {formatBRL(totalVencido)}
          </div>
          <div className="text-[10px] text-rose-600/80">aluguéis em atraso</div>
        </div>

        <div className="p-3.5 bg-slate-50 dark:bg-slate-900 rounded-lg border border-slate-200 dark:border-slate-800 shadow-2xs">
          <div className="text-[10px] font-semibold text-slate-500 uppercase">
            DESPESAS DOS IMÓVEIS
          </div>
          <div className="text-lg font-bold text-slate-700 dark:text-slate-300 mt-0.5">
            {formatBRL(totalDespesas)}
          </div>
          <div className="text-[10px] text-slate-400">manutenção, IPTU, etc.</div>
        </div>
      </div>

      {/* ABAS: CONTAS A RECEBER / CONTAS A PAGAR / FLUXO DE CAIXA */}
      <div className="flex items-center gap-2 border-b border-slate-200 dark:border-slate-800">
        <button
          onClick={() => setAbaAtiva('receber')}
          className={`px-4 py-2 text-xs font-semibold border-b-2 transition-colors ${
            abaAtiva === 'receber'
              ? 'border-emerald-600 text-emerald-600 dark:text-emerald-400'
              : 'border-transparent text-slate-500 hover:text-slate-800'
          }`}
        >
          Contas a Receber (Aluguéis)
        </button>
        <button
          onClick={() => setAbaAtiva('pagar')}
          className={`px-4 py-2 text-xs font-semibold border-b-2 transition-colors ${
            abaAtiva === 'pagar'
              ? 'border-emerald-600 text-emerald-600 dark:text-emerald-400'
              : 'border-transparent text-slate-500 hover:text-slate-800'
          }`}
        >
          Contas a Pagar (Despesas Imóveis)
        </button>
      </div>

      {abaAtiva === 'receber' && (
        <>
          {/* ERRO DO LINK DE PAGAMENTO — mensagem clara, nunca sucesso falso */}
          {erroLink && (
            <div className="flex items-start gap-2 rounded-lg border border-amber-300 bg-amber-50 p-3 text-xs text-amber-900 dark:border-amber-800 dark:bg-amber-950/40 dark:text-amber-200">
              <AlertTriangle className="mt-0.5 h-4 w-4 shrink-0" />
              <div>
                <strong>Link de pagamento:</strong> {erroLink.mensagem}
                <div className="mt-0.5 text-amber-700 dark:text-amber-300">
                  Verifique a conexão do Stripe em Configurações (Conectores) e tente novamente.
                </div>
              </div>
              <button
                onClick={() => setErroLink(null)}
                className="ml-auto shrink-0 text-amber-600 hover:text-amber-800 dark:text-amber-300"
                aria-label="Fechar aviso"
              >
                ✕
              </button>
            </div>
          )}
          {/* FILTROS E BUSCA */}
          <div className="flex flex-wrap items-center justify-between gap-3 bg-white dark:bg-slate-900 p-3 rounded-lg border border-slate-200 dark:border-slate-800">
            <div className="relative w-full sm:w-72">
              <Search className="w-3.5 h-3.5 absolute left-3 top-1/2 -translate-y-1/2 text-slate-400" />
              <Input
                type="text"
                placeholder="Filtrar por imóvel, inquilino ou competência..."
                value={search}
                onChange={(e) => setSearch(e.target.value)}
                className="pl-8 h-8 text-xs bg-slate-50 dark:bg-slate-800"
              />
            </div>

            <div className="flex items-center gap-2">
              <select
                value={filtroStatus}
                onChange={(e) => setFiltroStatus(e.target.value)}
                className="h-8 text-xs bg-slate-50 dark:bg-slate-800 border border-slate-200 dark:border-slate-700 rounded-md px-2 text-slate-700 dark:text-slate-300"
              >
                <option value="todos">Todos os Status</option>
                <option value="a_vencer">A Vencer</option>
                <option value="pago">Pago</option>
                <option value="pago_parcialmente">Pago Parcialmente</option>
                <option value="vencido">Vencido</option>
                <option value="em_negociacao">Em Negociação</option>
              </select>
            </div>
          </div>

          {/* TABELA DE COBRANÇAS */}
          <div className="bg-white dark:bg-slate-900 border border-slate-200 dark:border-slate-800 rounded-lg overflow-hidden shadow-2xs">
            <div className="overflow-x-auto">
              <table className="w-full text-left border-collapse text-xs">
                <thead>
                  <tr className="border-b border-slate-200 dark:border-slate-800 bg-slate-50 dark:bg-slate-850 text-slate-500 uppercase tracking-wider text-[10px]">
                    <th className="p-3">Competência</th>
                    <th className="p-3">Imóvel</th>
                    <th className="p-3">Inquilino</th>
                    <th className="p-3">Vencimento</th>
                    <th className="p-3">Aluguel</th>
                    <th className="p-3">Encargos (IPTU/Cond)</th>
                    <th className="p-3">Total Faturado</th>
                    <th className="p-3">Total Recebido</th>
                    <th className="p-3">Status</th>
                    <th className="p-3">Link de Pagamento</th>
                    <th className="p-3 text-right">Ações</th>
                  </tr>
                </thead>
                <tbody className="divide-y divide-slate-100 dark:divide-slate-800">
                  {filtered.length === 0 ? (
                    <tr>
                      <td colSpan={11} className="p-8 text-center text-slate-400">
                        Nenhuma cobrança encontrada.
                      </td>
                    </tr>
                  ) : (
                    filtered.map((item) => {
                      const encargos =
                        (item.valor_iptu || 0) +
                        (item.valor_condominio || 0) +
                        (item.valor_multa || 0) +
                        (item.valor_juros || 0)
                      return (
                        <tr
                          key={item.id}
                          className="hover:bg-slate-50/80 dark:hover:bg-slate-800/40 transition-colors"
                        >
                          <td className="p-3 font-semibold font-mono text-slate-900 dark:text-slate-100">
                            {item.competencia}
                          </td>
                          <td className="p-3 font-medium text-slate-800 dark:text-slate-200">
                            {item.expand?.imovel?.nome || item.imovel}
                          </td>
                          <td className="p-3 text-slate-700 dark:text-slate-300">
                            {item.expand?.inquilino?.nome || item.inquilino}
                          </td>
                          <td className="p-3 text-slate-600 dark:text-slate-400">
                            {formatDateBR(item.vencimento)}
                          </td>
                          <td className="p-3 text-slate-600 dark:text-slate-400">
                            {formatBRL(item.valor_aluguel)}
                          </td>
                          <td className="p-3 text-slate-600 dark:text-slate-400">
                            {formatBRL(encargos)}
                          </td>
                          <td className="p-3 font-bold text-slate-900 dark:text-slate-100">
                            {formatBRL(item.valor_total)}
                          </td>
                          <td className="p-3 font-bold text-emerald-600">
                            {formatBRL(item.valor_pago || 0)}
                          </td>
                          <td className="p-3">{statusCobrancaBadge(item.status)}</td>
                          <td className="p-3">
                            {(cobrancasComLink[item.id] || item.link_pagamento) && (
                              <Badge className="bg-navy-secondary text-gold-luminous border border-gold-metallic/40 gap-1 whitespace-nowrap shadow-2xs font-semibold">
                                <Link2 className="w-3 h-3 text-gold-luminous" />
                                com link
                              </Badge>
                            )}
                          </td>
                          <td className="p-3 text-right">
                            <div className="flex items-center justify-end gap-1.5">
                              {cobrancaEmAberto(item) && (
                                <>
                                  {!cobrancasComLink[item.id] && !item.link_pagamento ? (
                                    <Button
                                      size="sm"
                                      variant="outline"
                                      className="h-7 px-2 text-[11px] text-primary hover:text-primary-hover border-primary/40 hover:bg-primary/10 gap-1"
                                      disabled={gerandoLink === item.id}
                                      onClick={() => handleGerarLink(item)}
                                    >
                                      {gerandoLink === item.id ? (
                                        <Loader2 className="w-3 h-3 animate-spin" />
                                      ) : (
                                        <Link2 className="w-3 h-3" />
                                      )}
                                      {gerandoLink === item.id ? 'Gerando...' : 'Gerar link'}
                                    </Button>
                                  ) : (
                                    <>
                                      <Button
                                        size="sm"
                                        variant="outline"
                                        className="h-7 px-2 text-[11px] text-slate-600 dark:text-slate-300 gap-1"
                                        disabled={copiandoLink === item.id}
                                        onClick={() => handleCopiarLink(item)}
                                      >
                                        {copiandoLink === item.id ? (
                                          <Loader2 className="w-3 h-3 animate-spin" />
                                        ) : (
                                          <Copy className="w-3 h-3" />
                                        )}
                                        Copiar
                                      </Button>
                                      <a
                                        href={cobrancasComLink[item.id] || item.link_pagamento}
                                        target="_blank"
                                        rel="noreferrer"
                                        className="inline-flex h-7 items-center gap-1 rounded-md border border-slate-200 dark:border-slate-700 px-2 text-[11px] text-slate-600 hover:bg-slate-50 dark:text-slate-300 dark:hover:bg-slate-800"
                                      >
                                        <ExternalLink className="w-3 h-3" />
                                        Abrir
                                      </a>
                                    </>
                                  )}
                                </>
                              )}
                              {item.status !== 'pago' && (
                                <Button
                                  size="sm"
                                  className="h-7 px-2 text-[11px] bg-emerald-600 hover:bg-emerald-700 text-white gap-1"
                                  onClick={() => handleOpenBaixa(item)}
                                >
                                  <DollarSign className="w-3 h-3" />
                                  Registrar Baixa
                                </Button>
                              )}
                              {item.status !== 'cancelado' && item.status !== 'renegociado' && (
                                <Button
                                  size="sm"
                                  variant="outline"
                                  className={
                                    cobrancaQuitavel(item)
                                      ? 'h-7 px-2 text-[11px] text-gold-dark dark:text-gold-luminous border-gold-metallic/50 hover:bg-gold-light/20 dark:hover:bg-gold-metallic/15 gap-1 font-medium'
                                      : 'h-7 px-2 text-[11px] text-slate-400 dark:text-slate-500 gap-1'
                                  }
                                  title={
                                    cobrancaQuitavel(item)
                                      ? 'Gerar e baixar o recibo de quitação (PDF)'
                                      : 'O recibo de quitação exige baixa — registre o pagamento primeiro'
                                  }
                                  disabled={emitindoRecibo === item.id}
                                  onClick={() => handleEmitirRecibo(item)}
                                >
                                  {emitindoRecibo === item.id ? (
                                    <Loader2 className="w-3 h-3 animate-spin" />
                                  ) : (
                                    <Receipt className="w-3 h-3" />
                                  )}
                                  Recibo
                                </Button>
                              )}
                              {urlRecibo(item) && (
                                <a
                                  href={urlRecibo(item)}
                                  target="_blank"
                                  rel="noreferrer"
                                  className="inline-flex h-7 items-center gap-1 rounded-md border border-gold-metallic/40 bg-gold-light/20 dark:bg-gold-metallic/15 px-2 text-[11px] font-medium text-gold-dark dark:text-gold-luminous hover:bg-gold-light/35 dark:hover:bg-gold-metallic/25"
                                  title="Abrir o PDF do recibo emitido"
                                >
                                  <ExternalLink className="w-3 h-3" />
                                  PDF
                                </a>
                              )}
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
        </>
      )}

      {abaAtiva === 'pagar' && (
        <div className="bg-white dark:bg-slate-900 border border-slate-200 dark:border-slate-800 rounded-lg overflow-hidden shadow-2xs">
          <div className="p-4 border-b border-slate-100 dark:border-slate-800 flex items-center justify-between">
            <h3 className="font-bold text-sm">Despesas e Manutenções dos Imóveis</h3>
            <span className="text-xs text-slate-500">
              Total cadastrado: {formatBRL(totalDespesas)}
            </span>
          </div>
          <div className="overflow-x-auto">
            <table className="w-full text-left border-collapse text-xs">
              <thead>
                <tr className="border-b border-slate-200 dark:border-slate-800 bg-slate-50 dark:bg-slate-850 text-slate-500 uppercase tracking-wider text-[10px]">
                  <th className="p-3">Imóvel</th>
                  <th className="p-3">Categoria</th>
                  <th className="p-3">Descrição da Despesa</th>
                  <th className="p-3">Vencimento</th>
                  <th className="p-3">Valor</th>
                  <th className="p-3">Status</th>
                </tr>
              </thead>
              <tbody className="divide-y divide-slate-100 dark:divide-slate-800">
                {despesas.length === 0 ? (
                  <tr>
                    <td colSpan={6} className="p-8 text-center text-slate-400">
                      Nenhuma despesa cadastrada.
                    </td>
                  </tr>
                ) : (
                  despesas.map((d) => (
                    <tr key={d.id} className="hover:bg-slate-50/80 dark:hover:bg-slate-800/40">
                      <td className="p-3 font-medium">{d.expand?.imovel?.nome || d.imovel}</td>
                      <td className="p-3 capitalize">{d.categoria.replace('_', ' ')}</td>
                      <td className="p-3 text-slate-600 dark:text-slate-300">{d.descricao}</td>
                      <td className="p-3">{formatDateBR(d.data_vencimento)}</td>
                      <td className="p-3 font-bold text-slate-900 dark:text-slate-100">
                        {formatBRL(d.valor)}
                      </td>
                      <td className="p-3">
                        <Badge
                          className={
                            d.status === 'pago'
                              ? 'bg-emerald-600 text-white'
                              : 'bg-amber-600 text-white'
                          }
                        >
                          {d.status}
                        </Badge>
                      </td>
                    </tr>
                  ))
                )}
              </tbody>
            </table>
          </div>
        </div>
      )}

      {/* DIALOG DE REGISTRAR BAIXA (TOTAL OU PARCIAL) */}
      <Dialog open={!!cobrancaBaixa} onOpenChange={(open) => !open && setCobrancaBaixa(null)}>
        <DialogContent className="sm:max-w-md">
          <DialogHeader>
            <DialogTitle className="text-base font-bold flex items-center gap-2">
              <DollarSign className="w-5 h-5 text-emerald-600" />
              <span>Registrar Baixa de Pagamento</span>
            </DialogTitle>
          </DialogHeader>

          {cobrancaBaixa && (
            <div className="space-y-4 text-xs">
              <div className="p-3 bg-slate-50 dark:bg-slate-800 rounded border border-slate-200 dark:border-slate-700 space-y-1">
                <div>
                  Imóvel:{' '}
                  <strong>{cobrancaBaixa.expand?.imovel?.nome || cobrancaBaixa.imovel}</strong>
                </div>
                <div>
                  Inquilino:{' '}
                  <strong>
                    {cobrancaBaixa.expand?.inquilino?.nome || cobrancaBaixa.inquilino}
                  </strong>
                </div>
                <div>
                  Competência: <strong>{cobrancaBaixa.competencia}</strong> • Vencimento:{' '}
                  <strong>{formatDateBR(cobrancaBaixa.vencimento)}</strong>
                </div>
                <div className="pt-1 flex justify-between border-t border-slate-200 dark:border-slate-700">
                  <span>
                    Total da Cobrança: <strong>{formatBRL(cobrancaBaixa.valor_total)}</strong>
                  </span>
                  <span>
                    Já Pago:{' '}
                    <strong className="text-emerald-600">
                      {formatBRL(cobrancaBaixa.valor_pago || 0)}
                    </strong>
                  </span>
                </div>
              </div>

              <div>
                <Label htmlFor="v_baixa" className="text-xs">
                  Valor do Pagamento Atual (R$) *
                </Label>
                <Input
                  id="v_baixa"
                  type="number"
                  step="0.01"
                  required
                  value={valorBaixa}
                  onChange={(e) => setValorBaixa(parseFloat(e.target.value) || 0)}
                  className="text-sm font-bold text-emerald-600 mt-1"
                />
                <span className="text-[10px] text-slate-400">
                  Pode ser baixa total ou parcial. O saldo em aberto atualizará o status
                  automaticamente.
                </span>
              </div>

              <div className="grid grid-cols-2 gap-3">
                <div>
                  <Label htmlFor="dt_baixa" className="text-xs">
                    Data do Pagamento *
                  </Label>
                  <Input
                    id="dt_baixa"
                    type="date"
                    required
                    value={dataBaixa}
                    onChange={(e) => setDataBaixa(e.target.value)}
                    className="text-xs mt-1"
                  />
                </div>
                <div>
                  <Label htmlFor="forma" className="text-xs">
                    Forma de Pagamento *
                  </Label>
                  <select
                    id="forma"
                    value={formaPagamento}
                    onChange={(e) => setFormaPagamento(e.target.value as any)}
                    className="w-full h-9 text-xs mt-1 bg-slate-50 dark:bg-slate-800 border border-slate-200 dark:border-slate-700 rounded-md px-2"
                  >
                    <option value="pix">PIX</option>
                    <option value="boleto">Boleto Bancário</option>
                    <option value="ted_doc">TED / DOC</option>
                    <option value="dinheiro">Dinheiro</option>
                    <option value="cartao">Cartão</option>
                    <option value="outra">Outra</option>
                  </select>
                </div>
              </div>

              <div>
                <Label htmlFor="cta" className="text-xs">
                  Conta Bancária de Destino
                </Label>
                <Input
                  id="cta"
                  value={contaBancaria}
                  onChange={(e) => setContaBancaria(e.target.value)}
                  placeholder="Ex: Itaú Ag 1234 CC 56789-0"
                  className="text-xs mt-1"
                />
              </div>

              <div>
                <Label htmlFor="obs_baixa" className="text-xs">
                  Observações da Baixa
                </Label>
                <Textarea
                  id="obs_baixa"
                  rows={2}
                  value={observacoesBaixa}
                  onChange={(e) => setObservacoesBaixa(e.target.value)}
                  placeholder="Comprovante de transferência, negociação de saldo..."
                  className="text-xs mt-1"
                />
              </div>
            </div>
          )}

          <DialogFooter className="gap-2 sm:gap-0">
            <Button
              variant="outline"
              size="sm"
              onClick={() => setCobrancaBaixa(null)}
              className="text-xs"
            >
              Cancelar
            </Button>
            <Button
              size="sm"
              onClick={handleConfirmarBaixa}
              disabled={salvandoBaixa}
              className="bg-emerald-600 hover:bg-emerald-700 text-white text-xs font-semibold"
            >
              {salvandoBaixa ? 'Salvando...' : 'Confirmar e Salvar Baixa'}
            </Button>
          </DialogFooter>
        </DialogContent>
      </Dialog>

      {/* MODAL DE RECIBO DE PAGAMENTO (EMISSÃO E IMPRESSÃO) */}
      <Dialog open={!!reciboVisualizar} onOpenChange={(open) => !open && setReciboVisualizar(null)}>
        <DialogContent className="sm:max-w-lg">
          <DialogHeader>
            <DialogTitle className="text-base font-bold flex items-center justify-between">
              <span>Recibo de Pagamento de Locação</span>
              <span className="font-mono text-xs text-slate-500">
                {reciboVisualizar?.recibo_gerado || 'REC-CONFIRMADO'}
              </span>
            </DialogTitle>
          </DialogHeader>

          {reciboVisualizar && (
            <div className="p-4 border rounded bg-white text-slate-900 space-y-4 text-xs font-sans">
              <div className="border-b pb-3 flex justify-between items-start">
                <div>
                  <div className="font-bold text-sm">GESTOR IMOBILIÁRIO 360</div>
                  <div className="text-[10px] text-slate-500">Gestão Patrimonial e Imobiliária</div>
                </div>
                <div className="text-right text-[10px] text-slate-500">
                  Data:{' '}
                  {formatDateBR(
                    reciboVisualizar.data_pagamento || new Date().toISOString().slice(0, 10),
                  )}
                </div>
              </div>

              <div className="space-y-1.5">
                <div>
                  Recebemos de{' '}
                  <strong>{reciboVisualizar.expand?.inquilino?.nome || 'Inquilino'}</strong>,
                  inscrito no CPF/CNPJ sob o nº{' '}
                  <strong>{reciboVisualizar.expand?.inquilino?.cpf_cnpj || '-'}</strong>.
                </div>
                <div>
                  A importância de{' '}
                  <strong className="text-sm font-bold text-emerald-700">
                    {formatBRL(reciboVisualizar.valor_pago || reciboVisualizar.valor_total)}
                  </strong>
                  , referente ao pagamento do aluguel e encargos da competência{' '}
                  <strong>{reciboVisualizar.competencia}</strong>.
                </div>
                <div>
                  Imóvel: <strong>{reciboVisualizar.expand?.imovel?.nome}</strong> (
                  {reciboVisualizar.expand?.imovel?.endereco})
                </div>
              </div>

              <div className="p-2.5 bg-slate-50 border rounded text-[11px] space-y-1">
                <div className="flex justify-between">
                  <span>Aluguel:</span>
                  <span>{formatBRL(reciboVisualizar.valor_aluguel)}</span>
                </div>
                {reciboVisualizar.valor_iptu ? (
                  <div className="flex justify-between">
                    <span>IPTU:</span>
                    <span>{formatBRL(reciboVisualizar.valor_iptu)}</span>
                  </div>
                ) : null}
                {reciboVisualizar.valor_condominio ? (
                  <div className="flex justify-between">
                    <span>Condomínio:</span>
                    <span>{formatBRL(reciboVisualizar.valor_condominio)}</span>
                  </div>
                ) : null}
                <div className="flex justify-between font-bold border-t pt-1">
                  <span>Total Recebido:</span>
                  <span className="text-emerald-700">{formatBRL(reciboVisualizar.valor_pago)}</span>
                </div>
                <div className="text-[10px] text-slate-400">
                  Forma: {reciboVisualizar.forma_pagamento?.toUpperCase()} • Destino:{' '}
                  {reciboVisualizar.conta_bancaria || 'Conta Administradora'}
                </div>
              </div>

              <div className="pt-6 text-center text-[10px] text-slate-500 border-t">
                Recibo emitido eletronicamente pela plataforma Gestor Imobiliário 360.
              </div>
            </div>
          )}

          <DialogFooter>
            <Button
              size="sm"
              variant="outline"
              onClick={() => window.print()}
              className="text-xs gap-1"
            >
              Imprimir / Salvar PDF
            </Button>
            <Button
              size="sm"
              onClick={() => setReciboVisualizar(null)}
              className="text-xs bg-slate-800 text-white"
            >
              Fechar
            </Button>
          </DialogFooter>
        </DialogContent>
      </Dialog>

      {/* RECIBO PÓS-BAIXA: OFERECE "ENVIAR RECIBO AO WHATSAPP" (nada dispara sozinho) */}
      <Dialog open={!!baixaConcluida} onOpenChange={(open) => !open && setBaixaConcluida(null)}>
        <DialogContent className="sm:max-w-md">
          <DialogHeader>
            <DialogTitle className="text-base font-bold flex items-center gap-2">
              <Receipt className="w-5 h-5 text-gold-dark dark:text-gold-luminous" />
              <span>Pagamento registrado — enviar recibo?</span>
            </DialogTitle>
            <DialogDescription className="text-xs">
              O recibo de quitação foi gerado e salvo em Documentos. Você pode enviá-lo ao inquilino
              pelo WhatsApp — a mensagem entra PENDENTE na fila e só sai após a sua confirmação.
            </DialogDescription>
          </DialogHeader>

          {baixaConcluida && (
            <div className="space-y-3 text-xs">
              <div className="p-3 bg-gold-light/20 dark:bg-navy-secondary/60 border border-gold-metallic/35 dark:border-navy-border rounded space-y-1">
                <div>
                  Inquilino:{' '}
                  <strong>
                    {baixaConcluida.cobranca.expand?.inquilino?.nome ||
                      baixaConcluida.cobranca.inquilino}
                  </strong>
                </div>
                <div>
                  Competência: <strong>{baixaConcluida.cobranca.competencia}</strong>
                </div>
                <div className="flex items-center gap-2 pt-1">
                  <a
                    href={baixaConcluida.reciboUrl}
                    target="_blank"
                    rel="noreferrer"
                    className="inline-flex items-center gap-1 text-gold-dark dark:text-gold-luminous hover:underline font-medium"
                  >
                    <Receipt className="w-3 h-3 text-gold-metallic" />
                    Ver recibo em PDF
                  </a>
                </div>
              </div>

              {avisosRecibo && avisosRecibo.cobranca === baixaConcluida.cobranca.id && (
                <div className="p-2.5 rounded border border-amber-300 dark:border-amber-700 bg-amber-50 dark:bg-amber-950/40 text-amber-800 dark:text-amber-200 flex items-start gap-2">
                  <AlertTriangle className="w-4 h-4 shrink-0 mt-0.5" />
                  <span>{avisosRecibo.mensagem}</span>
                </div>
              )}
              {erroRecibo && erroRecibo.cobranca === baixaConcluida.cobranca.id && (
                <div className="p-2.5 rounded border border-red-300 dark:border-red-700 bg-red-50 dark:bg-red-950/40 text-red-700 dark:text-red-300 flex items-start gap-2">
                  <AlertTriangle className="w-4 h-4 shrink-0 mt-0.5" />
                  <span>{erroRecibo.mensagem}</span>
                </div>
              )}

              <DialogFooter className="gap-2 sm:gap-0">
                <Button
                  size="sm"
                  variant="outline"
                  onClick={() => setBaixaConcluida(null)}
                  className="text-xs"
                >
                  Depois
                </Button>
                <Button
                  size="sm"
                  className="bg-primary hover:bg-primary-hover text-white text-xs gap-1 shadow-glow-brand/30"
                  disabled={
                    enviandoReciboFila === baixaConcluida.cobranca.id || !baixaConcluida.reciboUrl
                  }
                  onClick={async () => {
                    await handleEnviarReciboWhatsApp(
                      baixaConcluida.cobranca.id,
                      baixaConcluida.reciboUrl,
                    )
                    setBaixaConcluida(null)
                  }}
                >
                  {enviandoReciboFila === baixaConcluida.cobranca.id ? (
                    <Loader2 className="w-3 h-3 animate-spin" />
                  ) : (
                    <Send className="w-3 h-3" />
                  )}
                  Enviar recibo ao WhatsApp
                </Button>
              </DialogFooter>
            </div>
          )}
        </DialogContent>
      </Dialog>
    </div>
  )
}
