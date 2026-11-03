import { useState, useCallback, useMemo } from 'react'
import { useNavigate } from 'react-router-dom'
import { Button } from '@/components/ui/button'
import { Badge } from '@/components/ui/badge'
import { Card, CardContent, CardHeader, CardTitle, CardDescription } from '@/components/ui/card'
import { Input } from '@/components/ui/input'
import { Label } from '@/components/ui/label'
import { Progress } from '@/components/ui/progress'
import { Separator } from '@/components/ui/separator'
import {
  Select,
  SelectContent,
  SelectItem,
  SelectTrigger,
  SelectValue,
} from '@/components/ui/select'
import { useToast } from '@/hooks/use-toast'
import { PageHeader } from '@/components/PageHeader'
import {
  carregarPlanilha,
  sugerirBlocos,
  extrairTabela,
  mapeamentoSugerido,
  letraColuna,
  type BlocoSugerido,
} from '@/features/importacao/parser'
import { montarPlano } from '@/features/importacao/plano'
import { executarPlano } from '@/features/importacao/execucao'
import { siglaMes, hojeISO } from '@/features/importacao/normalizacao'
import type {
  CampoMapeavelChave,
  MapeamentoColunas,
  PlanilhaCarregada,
  RelatorioImportacao,
  TabelaExtraida,
} from '@/features/importacao/types'
import { Previa, Relatorio } from '@/pages/importacao-partes'

const ROTULOS_CAMPO: Record<CampoMapeavelChave, string> = {
  endereco: 'Endereço do imóvel',
  descricao: 'Descrição (LOJA/SALA/BOX)',
  inquilinoNome: 'Nome do inquilino',
  cpfCnpj: 'CPF/CNPJ do inquilino',
  telefone: 'Telefone do inquilino',
  valorAluguel: 'Valor do aluguel',
  diaVencimento: 'Dia de vencimento',
  dataInicio: 'Início do contrato',
  matriculaCopasa: 'Matrícula Copasa',
  instalacaoCemig: 'Instalação Cemig',
}

type Etapa = 'envio' | 'regiao' | 'mapeamento' | 'previa' | 'relatorio'

const CAMPOS: CampoMapeavelChave[] = [
  'endereco',
  'descricao',
  'inquilinoNome',
  'cpfCnpj',
  'telefone',
  'valorAluguel',
  'diaVencimento',
  'dataInicio',
  'matriculaCopasa',
  'instalacaoCemig',
]

const MES_LISTA = [
  'jan',
  'fev',
  'mar',
  'abr',
  'mai',
  'jun',
  'jul',
  'ago',
  'set',
  'out',
  'nov',
  'dez',
] as const

export default function ImportarPlanilhaPage() {
  const navigate = useNavigate()
  const { toast } = useToast()

  const [etapa, setEtapa] = useState<Etapa>('envio')
  const [carregando, setCarregando] = useState(false)
  const [planilha, setPlanilha] = useState<PlanilhaCarregada | null>(null)
  const [aba, setAba] = useState('')
  const [blocos, setBlocos] = useState<BlocoSugerido[]>([])
  const [regiao, setRegiao] = useState({ linhaCabecalho: 1, colInicio: 1, colFim: 10 })
  const [tabela, setTabela] = useState<TabelaExtraida | null>(null)
  const [mapeamento, setMapeamento] = useState<MapeamentoColunas | null>(null)
  const [anoReferencia, setAnoReferencia] = useState(new Date().getFullYear())
  const [executando, setExecutando] = useState(false)
  const [relatorio, setRelatorio] = useState<RelatorioImportacao | null>(null)
  const [fase, setFase] = useState('')
  const [faseAtual, setFaseAtual] = useState(0)
  const [faseTotal, setFaseTotal] = useState(0)

  const passo = useMemo(
    () => ({ envio: 1, regiao: 2, mapeamento: 3, previa: 4, relatorio: 5 })[etapa],
    [etapa],
  )

  const receberArquivo = useCallback(
    async (file: File | null) => {
      if (!file) return
      setCarregando(true)
      try {
        const p = await carregarPlanilha(file)
        setPlanilha(p)
        const ab0 = p.abas[0]
        if (ab0) {
          setAba(ab0.nome)
          setBlocos(sugerirBlocos(ab0))
          setRegiao({ linhaCabecalho: 1, colInicio: 1, colFim: Math.min(12, ab0.largura) })
        }
        setRelatorio(null)
        setEtapa('regiao')
      } catch {
        toast({
          title: 'Não foi possível ler o arquivo',
          description: 'Confirme que é um .xlsx, .xls ou .csv válido.',
          variant: 'destructive',
        })
      } finally {
        setCarregando(false)
      }
    },
    [toast],
  )

  const trocarAba = useCallback(
    (nome: string) => {
      setAba(nome)
      setRelatorio(null)
      setEtapa('regiao')
      const ab = planilha?.abas.find((a) => a.nome === nome)
      setBlocos(ab ? sugerirBlocos(ab) : [])
      if (ab) setRegiao({ linhaCabecalho: 1, colInicio: 1, colFim: Math.min(12, ab.largura) })
    },
    [planilha],
  )

  const aplicarRegiao = useCallback(() => {
    if (!planilha) return
    const ab = planilha.abas.find((a) => a.nome === aba)
    if (!ab) return
    const tab = extrairTabela(ab, regiao)
    setTabela(tab)
    setMapeamento(mapeamentoSugerido(tab.colunas))
    setEtapa('mapeamento')
  }, [planilha, aba, regiao])

  const importar = useCallback(async () => {
    if (!tabela || !mapeamento) return
    setExecutando(true)
    try {
      const { plano } = await montarPlano(tabela, mapeamento, anoReferencia)
      const rel = await executarPlano(plano, (f, a, t) => {
        setFase(f)
        setFaseAtual(a + 1)
        setFaseTotal(t)
      })
      setRelatorio(rel)
      setEtapa('relatorio')
      toast({ title: 'Importação concluída', description: resumoCurto(rel) })
    } catch (e) {
      toast({
        title: 'Erro na importação',
        description: e instanceof Error ? e.message : String(e),
        variant: 'destructive',
      })
    } finally {
      setExecutando(false)
    }
  }, [tabela, mapeamento, anoReferencia, toast])

  const reiniciar = useCallback(() => {
    setPlanilha(null)
    setTabela(null)
    setMapeamento(null)
    setRelatorio(null)
    setEtapa('envio')
  }, [])

  return (
    <div className="space-y-6">
      <PageHeader
        title="Importar planilha"
        subtitle="Traga os dados do seu controle de aluguéis em Excel para o sistema."
        onBack={() => navigate('/configuracoes')}
      />

      <div className="flex items-center gap-2">
        {(['envio', 'regiao', 'mapeamento', 'previa', 'relatorio'] as Etapa[]).map((e, i) => (
          <div key={e} className="flex items-center gap-2">
            <Badge variant={i + 1 <= passo ? 'default' : 'outline'}>{i + 1}</Badge>
            {i < 4 && <span className="h-px w-6 bg-border" />}
          </div>
        ))}
      </div>

      {etapa === 'envio' && (
        <Card>
          <CardHeader>
            <CardTitle>1. Envie o arquivo</CardTitle>
            <CardDescription>Formatos aceitos: .xlsx, .xls e .csv</CardDescription>
          </CardHeader>
          <CardContent className="space-y-4">
            <Input
              type="file"
              accept=".xlsx,.xls,.csv"
              onChange={(e) => receberArquivo(e.target.files?.[0] ?? null)}
              disabled={carregando}
            />
            {carregando && <Progress value={66} />}
            <p className="text-sm text-muted-foreground">
              O arquivo é lido no seu navegador. As linhas vão direto para o banco conectado — nada
              fica salvo em código.
            </p>
          </CardContent>
        </Card>
      )}

      {etapa === 'regiao' && planilha && (
        <Card>
          <CardHeader>
            <CardTitle>2. Escolha a aba e o intervalo</CardTitle>
            <CardDescription>
              A planilha pode ter mais de uma tabela na mesma aba — escolha a linha de cabeçalho e o
              intervalo de colunas de cada importação.
            </CardDescription>
          </CardHeader>
          <CardContent className="space-y-4">
            <div className="grid gap-4 md:grid-cols-4">
              <div className="space-y-2 md:col-span-2">
                <Label>Aba</Label>
                <Select value={aba} onValueChange={trocarAba}>
                  <SelectTrigger>
                    <SelectValue placeholder="Selecione a aba" />
                  </SelectTrigger>
                  <SelectContent>
                    {planilha.abas.map((a) => (
                      <SelectItem key={a.nome} value={a.nome}>
                        {a.nome}
                      </SelectItem>
                    ))}
                  </SelectContent>
                </Select>
              </div>
              <div className="space-y-2">
                <Label>Linha do cabeçalho</Label>
                <Input
                  type="number"
                  min={1}
                  value={regiao.linhaCabecalho}
                  onChange={(e) =>
                    setRegiao({ ...regiao, linhaCabecalho: Number(e.target.value) || 1 })
                  }
                />
              </div>
              <div className="space-y-2">
                <Label>Da coluna</Label>
                <Input
                  type="number"
                  min={1}
                  value={regiao.colInicio}
                  onChange={(e) => setRegiao({ ...regiao, colInicio: Number(e.target.value) || 1 })}
                />
              </div>
              <div className="space-y-2">
                <Label>Até a coluna</Label>
                <Input
                  type="number"
                  min={1}
                  value={regiao.colFim}
                  onChange={(e) => setRegiao({ ...regiao, colFim: Number(e.target.value) || 1 })}
                />
              </div>
            </div>
            {blocos.length > 1 && (
              <div className="flex flex-wrap gap-2">
                {blocos.map((b) => (
                  <Button
                    key={b.rotulo}
                    variant="outline"
                    size="sm"
                    onClick={() =>
                      setRegiao({
                        linhaCabecalho: b.linhaCabecalho,
                        colInicio: b.colInicio,
                        colFim: b.colFim,
                      })
                    }
                  >
                    {b.rotulo}
                  </Button>
                ))}
              </div>
            )}
            <Amostra planilha={planilha} aba={aba} regiao={regiao} />
            <div className="flex justify-end gap-2">
              <Button variant="outline" onClick={() => setEtapa('envio')}>
                Voltar
              </Button>
              <Button onClick={aplicarRegiao}>Continuar para o mapeamento</Button>
            </div>
          </CardContent>
        </Card>
      )}

      {etapa === 'mapeamento' && tabela && mapeamento && (
        <Card>
          <CardHeader>
            <CardTitle>3. Vincule as colunas</CardTitle>
            <CardDescription>
              Escolha de qual coluna do arquivo vem cada campo do sistema, e o ano das colunas
              mensais.
            </CardDescription>
          </CardHeader>
          <CardContent className="space-y-6">
            <div className="grid gap-4 md:grid-cols-2">
              {CAMPOS.map((campo) => (
                <div key={campo} className="space-y-2">
                  <Label>{ROTULOS_CAMPO[campo]}</Label>
                  <Select
                    value={String(mapeamento[campo] ?? '')}
                    onValueChange={(v) =>
                      setMapeamento({ ...mapeamento, [campo]: v === '' ? null : Number(v) })
                    }
                  >
                    <SelectTrigger>
                      <SelectValue placeholder="Não usar" />
                    </SelectTrigger>
                    <SelectContent>
                      <SelectItem value="">Não usar</SelectItem>
                      {tabela.colunas.map((c) => (
                        <SelectItem key={c.indice} value={String(c.indice)}>
                          {c.letra} — {c.cabecalho}
                        </SelectItem>
                      ))}
                    </SelectContent>
                  </Select>
                </div>
              ))}
            </div>
            <Separator />
            <div>
              <Label>Colunas mensais (JAN–DEZ = data de pagamento da competência)</Label>
              <div className="mt-3 grid grid-cols-6 gap-2 sm:grid-cols-12">
                {MES_LISTA.map((mes) => (
                  <div key={mes} className="space-y-1">
                    <span className="text-xs font-medium uppercase">{mes}</span>
                    <Select
                      value={String(mapeamento.meses[mes] ?? '')}
                      onValueChange={(v) =>
                        setMapeamento({
                          ...mapeamento,
                          meses: { ...mapeamento.meses, [mes]: v === '' ? null : Number(v) },
                        })
                      }
                    >
                      <SelectTrigger className="h-8 px-2 text-xs">
                        <SelectValue placeholder="—" />
                      </SelectTrigger>
                      <SelectContent>
                        <SelectItem value="">—</SelectItem>
                        {tabela.colunas.map((c) => (
                          <SelectItem key={c.indice} value={String(c.indice)}>
                            {c.letra}
                          </SelectItem>
                        ))}
                      </SelectContent>
                    </Select>
                  </div>
                ))}
              </div>
            </div>
            <div className="space-y-2 md:w-1/3">
              <Label>Ano de referência das competências</Label>
              <Input
                type="number"
                value={anoReferencia}
                onChange={(e) =>
                  setAnoReferencia(Number(e.target.value) || new Date().getFullYear())
                }
              />
            </div>
            <div className="flex justify-between gap-2">
              <Button variant="outline" onClick={() => setEtapa('regiao')}>
                Voltar
              </Button>
              <Button onClick={() => setEtapa('previa')}>Gerar prévia</Button>
            </div>
          </CardContent>
        </Card>
      )}

      {etapa === 'previa' && tabela && mapeamento && (
        <Previa
          tabela={tabela}
          mapeamento={mapeamento}
          anoReferencia={anoReferencia}
          onVoltar={() => setEtapa('mapeamento')}
          onImportar={importar}
          executando={executando}
          fase={fase}
          faseAtual={faseAtual}
          faseTotal={faseTotal}
        />
      )}

      {etapa === 'relatorio' && relatorio && (
        <Relatorio relatorio={relatorio} onFechar={reiniciar} onNova={reiniciar} />
      )}
    </div>
  )
}

function resumoCurto(rel: RelatorioImportacao): string {
  const r = rel.resumo
  const p = []
  if (r.imoveisCriar || r.imoveisAtualizar)
    p.push(`${r.imoveisCriar} imóveis criados, ${r.imoveisAtualizar} atualizados`)
  if (r.inquilinosCriar || r.inquilinosAtualizar)
    p.push(`${r.inquilinosCriar} inquilinos criados, ${r.inquilinosAtualizar} atualizados`)
  if (r.contratosCriar || r.contratosAtualizar)
    p.push(`${r.contratosCriar} contratos criados, ${r.contratosAtualizar} atualizados`)
  if (r.cobrancasCriar || r.cobrancasAtualizar)
    p.push(`${r.cobrancasCriar} cobranças criadas, ${r.cobrancasAtualizar} atualizadas`)
  return p.join(' · ') || 'Nada a gravar'
}
