// ⚙️ Configurações — Importação de dados ("Importar planilha").
// Fluxo: upload → escolha de aba/região → mapeamento de colunas + ano →
// prévia → gravação → relatório. Todo o texto em português.
import React, { useRef, useState } from 'react'
import {
  AlertTriangle,
  ArrowLeft,
  CheckCircle2,
  FileSpreadsheet,
  Loader2,
  Map as MapIcon,
  Upload,
} from 'lucide-react'
import { Button } from '@/components/ui/button'
import { Card, CardContent, CardHeader, CardTitle } from '@/components/ui/card'
import { Badge } from '@/components/ui/badge'
import { Input } from '@/components/ui/input'
import { Label } from '@/components/ui/label'
import { useToast } from '@/hooks/use-toast'
import type {
  ColunaExtraida,
  MapeamentoColunas,
  MesChave,
  PlanilhaCarregada,
  ProblemaImportacao,
  RegiaoTabela,
  RelatorioImportacao,
  TabelaExtraida,
} from '@/features/importacao/types'
import {
  extrairTabela,
  lerArquivoPlanilha,
  mapeamentoSugerido,
  sugerirBlocos,
} from '@/features/importacao/parser'
import { montarPlano } from '@/features/importacao/plano'
import { executarPlano } from '@/features/importacao/execucao'

type Etapa = 'upload' | 'regiao' | 'mapeamento' | 'previa' | 'resultado'

const CAMPOS: Array<{ chave: keyof MapeamentoColunas; rotulo: string; dica: string }> = [
  { chave: 'endereco', rotulo: 'Endereço do imóvel', dica: 'Coluna de endereço da planilha' },
  {
    chave: 'descricao',
    rotulo: 'Descrição (LOJA/SALA/BOX)',
    dica: 'Alimenta a identificação comercial do imóvel',
  },
  {
    chave: 'inquilinoNome',
    rotulo: 'Nome do inquilino',
    dica: 'Linhas "DESOCUPADO" viram imóvel disponível',
  },
  { chave: 'cpfCnpj', rotulo: 'CPF/CNPJ', dica: 'Usado para casar inquilinos existentes' },
  { chave: 'telefone', rotulo: 'Telefone', dica: 'Contato do inquilino' },
  { chave: 'valorAluguel', rotulo: 'Valor do aluguel', dica: 'Valor mensal do contrato' },
  { chave: 'diaVencimento', rotulo: 'Dia de vencimento', dica: 'Dia do mês (1–31)' },
  { chave: 'dataInicio', rotulo: 'Início do contrato', dica: 'Data de início do contrato' },
  { chave: 'matriculaCopasa', rotulo: 'Matrícula Copasa', dica: 'Contrato — utilidades' },
  { chave: 'instalacaoCemig', rotulo: 'Instalação Cemig', dica: 'Contrato — utilidades' },
]

const ROTULO_MESES: Record<MesChave, string> = {
  jan: 'JAN',
  fev: 'FEV',
  mar: 'MAR',
  abr: 'ABR',
  mai: 'MAI',
  jun: 'JUN',
  jul: 'JUL',
  ago: 'AGO',
  set: 'SET',
  out: 'OUT',
  nov: 'NOV',
  dez: 'DEZ',
}

const SEM_COLUNA = 0

export default function ImportacaoWizard() {
  const { toast } = useToast()
  const inputArquivo = useRef<HTMLInputElement>(null)

  const [etapa, setEtapa] = useState<Etapa>('upload')
  const [carregando, setCarregando] = useState(false)
  const [planilha, setPlanilha] = useState<PlanilhaCarregada | null>(null)
  const [abaSel, setAbaSel] = useState(0)
  const [blocos, setBlocos] = useState<RegiaoTabela[]>([])
  const [blocoSel, setBlocoSel] = useState(0)
  const [colunas, setColunas] = useState<ColunaExtraida[]>([])
  const [linhas, setLinhas] = useState<TabelaExtraida['linhas']>([])
  const [mapeamento, setMapeamento] = useState<MapeamentoColunas | null>(null)
  const [anoReferencia, setAnoReferencia] = useState<number>(new Date().getFullYear())
  const [previa, setPrevia] = useState<Awaited<ReturnType<typeof montarPlano>> | null>(null)
  const [calculando, setCalculando] = useState(false)
  const [importando, setImportando] = useState(false)
  const [relatorio, setRelatorio] = useState<RelatorioImportacao | null>(null)
  const [fase, setFase] = useState('')

  const abaAtual = planilha?.abas[abaSel] ?? null

  async function aoEscolherArquivo(e: React.ChangeEvent<HTMLInputElement>) {
    const file = e.target.files?.[0]
    if (!file) return
    setCarregando(true)
    try {
      const pl = await lerArquivoPlanilha(file)
      if (!pl.abas.length) throw new Error('sem abas')
      setPlanilha(pl)
      setAbaSel(0)
      prepararRegioes(pl, 0)
      setEtapa('regiao')
      toast({
        title: 'Planilha carregada',
        description: `${pl.abas.length} aba(s) reconhecida(s).`,
      })
    } catch {
      toast({
        title: 'Não foi possível ler o arquivo',
        description: 'Verifique se é um .xlsx, .xls ou .csv válido.',
        variant: 'destructive',
      })
    } finally {
      setCarregando(false)
    }
  }

  function prepararRegioes(pl: PlanilhaCarregada, idxAba: number) {
    const aba = pl.abas[idxAba]
    const sugestoes = sugerirBlocos(aba)
    setBlocos(
      sugestoes.map((b) => ({
        aba: aba.nome,
        linhaCabecalho: b.linhaCabecalho || 1,
        colInicio: b.colInicio,
        colFim: b.colFim,
        rotulo: b.rotulo,
      })),
    )
    setBlocoSel(0)
  }

  function aplicarBloco() {
    const aba = abaAtual
    const regiao = blocos[blocoSel]
    if (!aba || !regiao) return
    const tabela = extrairTabela(aba, regiao)
    setColunas(tabela.colunas)
    setLinhas(tabela.linhas)
    setMapeamento(mapeamentoSugerido(tabela.colunas))
    setEtapa('mapeamento')
  }

  function definir(campo: keyof MapeamentoColunas, valor: number) {
    setMapeamento((m) => {
      if (!m) return m
      return { ...m, [campo]: valor === SEM_COLUNA ? null : valor }
    })
  }

  function definirMes(mes: MesChave, valor: number) {
    setMapeamento((m) => {
      if (!m) return m
      return { ...m, meses: { ...m.meses, [mes]: valor === SEM_COLUNA ? null : valor } }
    })
  }

  async function calcularPrevia() {
    if (!mapeamento || !mapeamento.endereco) {
      toast({
        title: 'Mapeamento incompleto',
        description: 'Vincule ao menos a coluna de endereço do imóvel.',
        variant: 'destructive',
      })
      return
    }
    setCalculando(true)
    try {
      const tabela: TabelaExtraida = { regiao: blocos[blocoSel], colunas, linhas }
      const resultado = await montarPlano(tabela, mapeamento, anoReferencia)
      setPrevia(resultado)
      setEtapa('previa')
    } catch (e) {
      toast({
        title: 'Erro ao montar a prévia',
        description: e instanceof Error ? e.message : 'Tente novamente.',
        variant: 'destructive',
      })
    } finally {
      setCalculando(false)
    }
  }

  async function confirmarImportacao() {
    if (!previa) return
    setImportando(true)
    try {
      const rel = await executarPlano(previa.plano, (f, a, t) => setFase(`${f} (${a}/${t})`))
      setRelatorio(rel)
      setEtapa('resultado')
      toast({ title: 'Importação concluída', description: 'Dados gravados no banco conectado.' })
    } catch (e) {
      toast({
        title: 'Erro durante a importação',
        description: e instanceof Error ? e.message : 'Tente novamente.',
        variant: 'destructive',
      })
    } finally {
      setImportando(false)
      setFase('')
    }
  }

  function reiniciar() {
    setPlanilha(null)
    setAbaSel(0)
    setBlocos([])
    setBlocoSel(0)
    setColunas([])
    setLinhas([])
    setMapeamento(null)
    setPrevia(null)
    setRelatorio(null)
    setEtapa('upload')
  }

  const passoClasse = (p: Etapa) =>
    `flex items-center gap-1.5 text-xs ${
      etapa === p ? 'font-bold text-emerald-700 dark:text-emerald-400' : 'text-slate-400'
    }`

  return (
    <div className="space-y-4">
      {/* Passos */}
      <div className="flex items-center gap-2 flex-wrap">
        {(['upload', 'regiao', 'mapeamento', 'previa', 'resultado'] as Etapa[]).map((p, i) => (
          <React.Fragment key={p}>
            {i > 0 && <span className="text-slate-300">→</span>}
            <span className={passoClasse(p)}>
              <span
                className={`w-4 h-4 rounded-full text-[9px] flex items-center justify-center ${
                  etapa === p
                    ? 'bg-emerald-600 text-white'
                    : 'bg-slate-200 dark:bg-slate-800 text-slate-500'
                }`}
              >
                {i + 1}
              </span>
              {p === 'upload' && 'Enviar arquivo'}
              {p === 'regiao' && 'Aba e colunas'}
              {p === 'mapeamento' && 'Mapeamento'}
              {p === 'previa' && 'Prévia'}
              {p === 'resultado' && 'Relatório'}
            </span>
          </React.Fragment>
        ))}
      </div>

      {/* ETAPA 1: UPLOAD */}
      {etapa === 'upload' && (
        <Card>
          <CardHeader className="pb-2">
            <CardTitle className="text-sm flex items-center gap-2">
              <FileSpreadsheet className="w-4 h-4 text-emerald-600" />
              Enviar planilha
            </CardTitle>
          </CardHeader>
          <CardContent className="space-y-3">
            <p className="text-xs text-slate-500 dark:text-slate-400">
              Aceita .xlsx, .xls e .csv. O arquivo é lido no seu navegador e os dados são gravados
              diretamente no banco conectado — nada da planilha fica guardado no código do sistema.
            </p>
            <div className="border border-dashed border-slate-300 dark:border-slate-700 rounded-lg p-6 text-center">
              <Upload className="w-8 h-8 mx-auto text-slate-400" />
              <p className="text-xs text-slate-500 mt-2">
                Selecione o arquivo da planilha de aluguéis
              </p>
              <input
                ref={inputArquivo}
                type="file"
                accept=".xlsx,.xls,.csv"
                className="hidden"
                onChange={aoEscolherArquivo}
              />
              <Button
                size="sm"
                className="mt-3 bg-emerald-600 hover:bg-emerald-700 text-white"
                disabled={carregando}
                onClick={() => inputArquivo.current?.click()}
              >
                {carregando ? <Loader2 className="w-4 h-4 animate-spin mr-1" /> : null}
                Escolher arquivo
              </Button>
            </div>
          </CardContent>
        </Card>
      )}

      {/* ETAPA 2: ABA E REGIÃO */}
      {etapa === 'regiao' && planilha && (
        <Card>
          <CardHeader className="pb-2">
            <CardTitle className="text-sm">Escolher aba e bloco de colunas</CardTitle>
          </CardHeader>
          <CardContent className="space-y-4">
            <div>
              <Label className="text-xs">Aba da planilha</Label>
              <div className="flex flex-wrap gap-2 mt-1.5">
                {planilha.abas.map((a, i) => (
                  <Button
                    key={a.nome}
                    size="sm"
                    variant={i === abaSel ? 'default' : 'outline'}
                    className={`h-8 text-xs ${
                      i === abaSel ? 'bg-emerald-600 hover:bg-emerald-700 text-white' : ''
                    }`}
                    onClick={() => {
                      setAbaSel(i)
                      prepararRegioes(planilha, i)
                    }}
                  >
                    {a.nome}
                  </Button>
                ))}
              </div>
            </div>
            <div>
              <Label className="text-xs">Bloco de colunas</Label>
              <div className="flex flex-wrap gap-2 mt-1.5">
                {blocos.map((b, i) => (
                  <Button
                    key={i}
                    size="sm"
                    variant={i === blocoSel ? 'default' : 'outline'}
                    className={`h-8 text-xs ${
                      i === blocoSel ? 'bg-emerald-600 hover:bg-emerald-700 text-white' : ''
                    }`}
                    onClick={() => setBlocoSel(i)}
                  >
                    {b.rotulo}
                  </Button>
                ))}
              </div>
            </div>
            <div className="grid grid-cols-3 gap-2 max-w-md">
              <div>
                <Label className="text-[10px]">Linha do cabeçalho</Label>
                <Input
                  type="number"
                  min={1}
                  value={blocos[blocoSel]?.linhaCabecalho ?? 1}
                  onChange={(e) => {
                    const copia = [...blocos]
                    copia[blocoSel] = {
                      ...copia[blocoSel],
                      linhaCabecalho: Math.max(1, Number(e.target.value) || 1),
                    }
                    setBlocos(copia)
                  }}
                  className="h-8 text-xs mt-1"
                />
              </div>
              <div>
                <Label className="text-[10px]">Coluna inicial</Label>
                <Input
                  type="number"
                  min={1}
                  value={(blocos[blocoSel]?.colInicio ?? 0) + 1}
                  onChange={(e) => {
                    const copia = [...blocos]
                    copia[blocoSel] = {
                      ...copia[blocoSel],
                      colInicio: Math.max(0, Number(e.target.value) - 1),
                    }
                    setBlocos(copia)
                  }}
                  className="h-8 text-xs mt-1"
                />
              </div>
              <div>
                <Label className="text-[10px]">Coluna final</Label>
                <Input
                  type="number"
                  min={1}
                  value={(blocos[blocoSel]?.colFim ?? 0) + 1}
                  onChange={(e) => {
                    const copia = [...blocos]
                    copia[blocoSel] = {
                      ...copia[blocoSel],
                      colFim: Math.max(0, Number(e.target.value) - 1),
                    }
                    setBlocos(copia)
                  }}
                  className="h-8 text-xs mt-1"
                />
              </div>
            </div>
            <div className="flex gap-2">
              <Button
                size="sm"
                variant="outline"
                onClick={() => setEtapa('upload')}
                className="h-8 text-xs"
              >
                <ArrowLeft className="w-3.5 h-3.5" /> Voltar
              </Button>
              <Button
                size="sm"
                className="h-8 text-xs bg-emerald-600 hover:bg-emerald-700 text-white"
                onClick={aplicarBloco}
              >
                Continuar
              </Button>
            </div>
          </CardContent>
        </Card>
      )}

      {/* ETAPA 3: MAPEAMENTO */}
      {etapa === 'mapeamento' && mapeamento && (
        <Card>
          <CardHeader className="pb-2">
            <CardTitle className="text-sm flex items-center gap-2">
              <MapIcon className="w-4 h-4 text-emerald-600" />
              Mapeamento de colunas
            </CardTitle>
          </CardHeader>
          <CardContent className="space-y-4">
            <p className="text-xs text-slate-500 dark:text-slate-400">
              Vincule cada coluna do arquivo aos campos do sistema. {linhas.length} linha(s) de
              dados detectada(s).
            </p>
            <div className="grid grid-cols-1 md:grid-cols-2 gap-3">
              {CAMPOS.map((campo) => (
                <div key={campo.chave}>
                  <Label className="text-xs">{campo.rotulo}</Label>
                  <p className="text-[10px] text-slate-400">{campo.dica}</p>
                  <select
                    className="mt-1 w-full h-8 text-xs rounded-md border border-slate-300 dark:border-slate-700 bg-white dark:bg-slate-900 px-2"
                    value={(mapeamento[campo.chave] ?? SEM_COLUNA) as number}
                    onChange={(e) => definir(campo.chave, Number(e.target.value))}
                  >
                    <option value={SEM_COLUNA}>— Não importar —</option>
                    {colunas.map((col) => (
                      <option key={col.indice} value={col.indice}>
                        {col.letra} — {col.cabecalho || '(sem título)'}
                      </option>
                    ))}
                  </select>
                </div>
              ))}
            </div>

            <div>
              <Label className="text-xs font-semibold">
                Colunas mensais (JAN–DEZ) — data de pagamento da competência
              </Label>
              <div className="grid grid-cols-3 sm:grid-cols-6 gap-2 mt-1.5">
                {(Object.keys(ROTULO_MESES) as MesChave[]).map((mes) => (
                  <div key={mes}>
                    <select
                      className="w-full h-8 text-[11px] rounded-md border border-slate-300 dark:border-slate-700 bg-white dark:bg-slate-900 px-1"
                      value={mapeamento.meses[mes] ?? SEM_COLUNA}
                      onChange={(e) => definirMes(mes, Number(e.target.value))}
                    >
                      <option value={SEM_COLUNA}>—</option>
                      {colunas.map((col) => (
                        <option key={col.indice} value={col.indice}>
                          {col.letra}
                        </option>
                      ))}
                    </select>
                  </div>
                ))}
              </div>
            </div>

            <div>
              <Label className="text-xs">Ano de referência das competências</Label>
              <Input
                type="number"
                min={2000}
                max={2100}
                value={anoReferencia}
                onChange={(e) =>
                  setAnoReferencia(Number(e.target.value) || new Date().getFullYear())
                }
                className="h-8 text-xs w-28 mt-1"
              />
            </div>

            <div className="flex gap-2">
              <Button
                size="sm"
                variant="outline"
                onClick={() => setEtapa('regiao')}
                className="h-8 text-xs"
              >
                <ArrowLeft className="w-3.5 h-3.5" /> Voltar
              </Button>
              <Button
                size="sm"
                className="h-8 text-xs bg-emerald-600 hover:bg-emerald-700 text-white"
                onClick={calcularPrevia}
                disabled={calculando}
              >
                {calculando ? <Loader2 className="w-4 h-4 animate-spin mr-1" /> : null}
                Montar prévia
              </Button>
            </div>
          </CardContent>
        </Card>
      )}

      {/* ETAPA 4: PRÉVIA */}
      {etapa === 'previa' && previa && (
        <Card>
          <CardHeader className="pb-2">
            <CardTitle className="text-sm">Prévia antes de gravar</CardTitle>
          </CardHeader>
          <CardContent className="space-y-4">
            <div className="grid grid-cols-2 sm:grid-cols-4 gap-2">
              <MiniStat
                rotulo="Imóveis"
                criar={previa.plano.resumo.imoveisCriar}
                atualizar={previa.plano.resumo.imoveisAtualizar}
              />
              <MiniStat
                rotulo="Inquilinos"
                criar={previa.plano.resumo.inquilinosCriar}
                atualizar={previa.plano.resumo.inquilinosAtualizar}
              />
              <MiniStat
                rotulo="Contratos"
                criar={previa.plano.resumo.contratosCriar}
                atualizar={previa.plano.resumo.contratosAtualizar}
              />
              <MiniStat
                rotulo="Cobranças"
                criar={previa.plano.resumo.cobrancasCriar}
                atualizar={previa.plano.resumo.cobrancasAtualizar}
                ign={previa.plano.resumo.cobrancasIgnoradas}
              />
            </div>
            {previa.plano.problemas.length > 0 && (
              <div className="border border-amber-200 dark:border-amber-900 bg-amber-50 dark:bg-amber-950/30 rounded-lg p-3">
                <div className="text-xs font-semibold text-amber-800 dark:text-amber-300 flex items-center gap-1.5">
                  <AlertTriangle className="w-3.5 h-3.5" />
                  {previa.plano.problemas.length} item(ns) para revisar
                </div>
                <div className="mt-1.5 max-h-40 overflow-y-auto space-y-1">
                  {previa.plano.problemas.slice(0, 60).map((p, i) => (
                    <div key={i} className="text-[11px] text-amber-800 dark:text-amber-200">
                      Linha {p.linha}: {p.mensagem}
                      <Badge variant="outline" className="ml-1 text-[9px]">
                        {p.severidade === 'erro' ? 'erro' : 'aviso'}
                      </Badge>
                    </div>
                  ))}
                </div>
              </div>
            )}
            <div className="flex gap-2">
              <Button
                size="sm"
                variant="outline"
                onClick={() => setEtapa('mapeamento')}
                className="h-8 text-xs"
              >
                <ArrowLeft className="w-3.5 h-3.5" /> Voltar
              </Button>
              <Button
                size="sm"
                className="h-8 text-xs bg-emerald-600 hover:bg-emerald-700 text-white"
                onClick={confirmarImportacao}
                disabled={importando}
              >
                {importando ? <Loader2 className="w-4 h-4 animate-spin mr-1" /> : null}
                Confirmar e gravar{importando ? ` · ${fase}` : ''}
              </Button>
            </div>
          </CardContent>
        </Card>
      )}

      {/* ETAPA 5: RELATÓRIO */}
      {etapa === 'resultado' && relatorio && (
        <Card>
          <CardHeader className="pb-2">
            <CardTitle className="text-sm flex items-center gap-2">
              <CheckCircle2 className="w-4 h-4 text-emerald-600" />
              Importação concluída
            </CardTitle>
          </CardHeader>
          <CardContent className="space-y-3">
            <div className="grid grid-cols-2 sm:grid-cols-4 gap-2">
              <MiniStat
                rotulo="Imóveis"
                criar={relatorio.resumo.imoveisCriar}
                atualizar={relatorio.resumo.imoveisAtualizar}
              />
              <MiniStat
                rotulo="Inquilinos"
                criar={relatorio.resumo.inquilinosCriar}
                atualizar={relatorio.resumo.inquilinosAtualizar}
              />
              <MiniStat
                rotulo="Contratos"
                criar={relatorio.contratosCriar ?? relatorio.resumo.contratosCriar}
                atualizar={relatorio.resumo.contratosAtualizar}
              />
              <MiniStat
                rotulo="Cobranças"
                criar={relatorio.resumo.cobrancasCriar}
                atualizar={relatorio.resumo.cobrancasAtualizar}
                ign={relatorio.resumo.cobrancasIgnoradas}
              />
            </div>
            {relatorio.resumo.pagamentosCriar > 0 && (
              <p className="text-xs text-slate-500">
                {relatorio.resumo.pagamentosCriar} pagamento(s) registrados na coleção de
                pagamentos.
              </p>
            )}
            {relatorio.erros.length > 0 && (
              <div className="border border-rose-200 dark:border-rose-900 bg-rose-50 dark:bg-rose-950/30 rounded-lg p-3">
                <div className="text-xs font-semibold text-rose-700 dark:text-rose-300">
                  {relatorio.erros.length} erro(s) durante a gravação
                </div>
                <div className="mt-1.5 max-h-40 overflow-y-auto space-y-1">
                  {relatorio.erros.slice(0, 40).map((e, i) => (
                    <div key={i} className="text-[11px] text-rose-700 dark:text-rose-200">
                      {e}
                    </div>
                  ))}
                </div>
              </div>
            )}
            {relatorio.itensRevisao.length > 0 && (
              <div className="border border-amber-200 dark:border-amber-900 bg-amber-50 dark:bg-amber-950/30 rounded-lg p-3">
                <div className="text-xs font-semibold text-amber-800 dark:text-amber-300">
                  Itens para revisão
                </div>
                <div className="mt-1.5 max-h-40 overflow-y-auto space-y-1">
                  {relatorio.itensRevisao.slice(0, 60).map((p: ProblemaImportacao, i: number) => (
                    <div key={i} className="text-[11px] text-amber-800 dark:text-amber-200">
                      Linha {p.linha}: {p.mensagem}
                    </div>
                  ))}
                </div>
              </div>
            )}
            <div className="flex gap-2">
              <Button
                size="sm"
                className="h-8 text-xs bg-emerald-600 hover:bg-emerald-700 text-white"
                onClick={reiniciar}
              >
                Importar outra planilha
              </Button>
            </div>
          </CardContent>
        </Card>
      )}
    </div>
  )
}

function MiniStat({
  rotulo,
  criar,
  atualizar,
  ign,
}: {
  rotulo: string
  criar: number
  atualizar: number
  ign?: number
}) {
  return (
    <div className="border border-slate-200 dark:border-slate-800 rounded-md p-2.5 bg-slate-50 dark:bg-slate-900/60">
      <div className="text-[10px] uppercase tracking-wider text-slate-500 font-semibold">
        {rotulo}
      </div>
      <div className="text-sm font-bold mt-0.5">
        <span className="text-emerald-600">+{criar}</span>
        <span className="text-slate-400 text-[10px]"> criar</span>
        <span className="text-blue-600 ml-2">{atualizar}</span>
        <span className="text-slate-400 text-[10px]"> atualizar</span>
        {ign !== undefined && (
          <>
            <span className="text-slate-500 ml-2">{ign}</span>
            <span className="text-slate-400 text-[10px]"> ig.</span>
          </>
        )}
      </div>
    </div>
  )
}
