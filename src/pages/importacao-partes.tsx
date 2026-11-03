// Passos da tela de importação que ficam fora do componente principal:
// amostra da região, prévia (plano de gravação) e relatório final.
import { useEffect, useState } from 'react'
import { Button } from '@/components/ui/button'
import { Alert, AlertDescription, AlertTitle } from '@/components/ui/alert'
import { Card, CardContent, CardHeader, CardTitle, CardDescription } from '@/components/ui/card'
import {
  Table,
  TableBody,
  TableCell,
  TableHead,
  TableHeader,
  TableRow,
} from '@/components/ui/table'
import { Progress } from '@/components/ui/progress'
import { letraColuna } from '@/features/importacao/parser'
import type {
  MapeamentoColunas,
  PlanilhaCarregada,
  PlanoImportacao,
  RegiaoTabela,
  RelatorioImportacao,
  TabelaExtraida,
} from '@/features/importacao/types'

/** Prévia da região escolhida: primeiras linhas da planilha, cru. */
export function Amostra({
  planilha,
  aba,
  regiao,
}: {
  planilha: PlanilhaCarregada
  aba: string
  regiao: RegiaoTabela
}) {
  const ab = planilha.abas.find((a) => a.nome === aba)
  if (!ab) return null
  const linhas: unknown[][] = []
  for (
    let r = regiao.linhaCabecalho - 1;
    r < Math.min(ab.matriz.length, regiao.linhaCabecalho + 8);
    r++
  ) {
    const bruta = ab.matriz[r] ?? []
    const recorte: unknown[] = []
    for (let c = regiao.colInicio - 1; c < regiao.colFim; c++) {
      const v = bruta[c]
      recorte.push(v instanceof Date ? v.toISOString().slice(0, 10) : (v ?? ''))
    }
    linhas.push(recorte)
  }
  return (
    <div className="overflow-x-auto rounded-lg border">
      <Table>
        <TableHeader>
          <TableRow>
            {linhas[0]?.map((_, i) => (
              <TableHead key={i} className="whitespace-nowrap">
                {letraColuna(regiao.colInicio + i)}
              </TableHead>
            ))}
          </TableRow>
        </TableHeader>
        <TableBody>
          {linhas.map((linha, ri) => (
            <TableRow key={ri}>
              {linha.map((v, ci) => (
                <TableCell key={ci} className="max-w-[220px] truncate text-xs">
                  {String(v)}
                </TableCell>
              ))}
            </TableRow>
          ))}
        </TableBody>
      </Table>
    </div>
  )
}

/** Etapa 4: prévia do plano — o que será criado/atualizado antes de gravar. */
export function Previa({
  recalcular,
  onVoltar,
  onImportar,
  executando,
  fase,
  faseAtual,
  faseTotal,
}: {
  tabela: TabelaExtraida
  mapeamento: MapeamentoColunas
  anoReferencia: number
  recalcular: () => Promise<PlanoImportacao | null>
  onVoltar: () => void
  onImportar: () => void
  executando: boolean
  fase: string
  faseAtual: number
  faseTotal: number
}) {
  const [plano, setPlano] = useState<PlanoImportacao | null>(null)
  const [carregando, setCarregando] = useState(true)
  const [erro, setErro] = useState('')

  useEffect(() => {
    let ativo = true
    setCarregando(true)
    setErro('')
    recalcular().then((p) => {
      if (!ativo) return
      setPlano(p)
      setCarregando(false)
    })
    return () => {
      ativo = false
    }
  }, [recalcular])

  if (executando) {
    return (
      <Card>
        <CardHeader>
          <CardTitle>Gravando no banco…</CardTitle>
          <CardDescription>
            {fase} {faseTotal > 0 ? `(${faseAtual}/${faseTotal})` : ''}
          </CardDescription>
        </CardHeader>
        <CardContent>
          <Progress className="w-full" value={faseTotal > 0 ? (faseAtual / faseTotal) * 100 : 50} />
        </CardContent>
      </Card>
    )
  }
  if (carregando) {
    return <Progress className="w-full" value={50} />
  }
  if (!plano) {
    return <Alert variant="destructive">Não foi possível montar a prévia.</Alert>
  }

  const { resumo, problemas } = plano
  const erros = problemas.filter((p) => p.severidade === 'erro')
  const avisos = problemas.filter((p) => p.severidade === 'aviso')

  return (
    <Card>
      <CardHeader>
        <CardTitle>4. Prévia da importação</CardTitle>
        <CardDescription>Confira antes de gravar no banco.</CardDescription>
      </CardHeader>
      <CardContent className="space-y-4">
        <div className="grid grid-cols-2 gap-3 sm:grid-cols-4">
          <ItemResumo
            rotulo="Imóveis"
            criar={resumo.imoveisCriar}
            atualizar={resumo.imoveisAtualizar}
          />
          <ItemResumo
            rotulo="Inquilinos"
            criar={resumo.inquilinosCriar}
            atualizar={resumo.inquilinosAtualizar}
          />
          <ItemResumo
            rotulo="Contratos"
            criar={resumo.contratosCriar}
            atualizar={resumo.contratosAtualizar}
          />
          <ItemResumo
            rotulo="Cobranças"
            criar={resumo.cobrancasCriar}
            atualizar={resumo.cobrancasAtualizar}
          />
        </div>
        {resumo.pagamentosCriar > 0 && (
          <p className="text-sm text-muted-foreground">
            {resumo.pagamentosCriar} pagamentos serão registrados junto das cobranças pagas.
          </p>
        )}
        {erros.length > 0 && (
          <Alert variant="destructive">
            <AlertTitle>{erros.length} problema(s) impedem partes da importação</AlertTitle>
            <AlertDescription>
              <ul className="list-disc space-y-1 pl-4">
                {erros.slice(0, 8).map((p, i) => (
                  <li key={i}>
                    Linha {p.linha}: {p.mensagem}
                  </li>
                ))}
              </ul>
              <p className="mt-2 text-xs">
                Você pode importar mesmo assim — as linhas com erro são ignoradas; as demais entram.
              </p>
            </AlertDescription>
          </Alert>
        )}
        {avisos.length > 0 && (
          <Alert>
            <AlertTitle>{avisos.length} itens para revisar</AlertTitle>
            <AlertDescription>
              <ul className="list-disc space-y-1 pl-4">
                {avisos.slice(0, 8).map((p, i) => (
                  <li key={i}>
                    Linha {p.linha}: {p.mensagem}
                  </li>
                ))}
              </ul>
              {avisos.length > 8 && <p className="mt-1 text-xs">… e mais {avisos.length - 8}.</p>}
            </AlertDescription>
          </Alert>
        )}
        {resumo.linhasIgnoradas > 0 && (
          <p className="text-sm text-muted-foreground">
            {resumo.linhasIgnoradas} linha(s) sem endereço serão ignoradas.
          </p>
        )}
        <div className="flex justify-between gap-2">
          <Button variant="outline" onClick={onVoltar}>
            Voltar
          </Button>
          <Button onClick={onImportar} disabled={executando}>
            {executando ? 'Importando…' : 'Importar agora'}
          </Button>
        </div>
      </CardContent>
    </Card>
  )
}

function ItemResumo({
  rotulo,
  criar,
  atualizar,
}: {
  rotulo: string
  criar: number
  atualizar: number
}) {
  return (
    <div className="rounded-lg border p-3">
      <p className="text-sm font-medium">{rotulo}</p>
      <p className="text-2xl font-bold">{criar + atualizar}</p>
      <p className="text-xs text-muted-foreground">
        {criar} novos · {atualizar} atualizações
      </p>
    </div>
  )
}

/** Etapa 5: relatório final. */
export function Relatorio({
  relatorio,
  onFechar,
  onNova,
}: {
  relatorio: RelatorioImportacao
  onFechar: () => void
  onNova: () => void
}) {
  const { resumo, erros, itensRevisao } = relatorio
  return (
    <Card>
      <CardHeader>
        <CardTitle>5. Importação concluída</CardTitle>
        <CardDescription>Resultado gravado no banco conectado.</CardDescription>
      </CardHeader>
      <CardContent className="space-y-4">
        <div className="grid grid-cols-2 gap-3 sm:grid-cols-4">
          <ItemResumo
            rotulo="Imóveis"
            criar={resumo.imoveisCriar}
            atualizar={resumo.imoveisAtualizar}
          />
          <ItemResumo
            rotulo="Inquilinos"
            criar={resumo.inquilinosCriar}
            atualizar={resumo.inquilinosAtualizar}
          />
          <ItemResumo
            rotulo="Contratos"
            criar={resumo.contratosCriar}
            atualizar={resumo.contratosAtualizar}
          />
          <ItemResumo
            rotulo="Cobranças"
            criar={resumo.cobrancasCriar}
            atualizar={resumo.cobrancasAtualizar}
          />
        </div>
        {resumo.linhasIgnoradas > 0 && (
          <p className="text-sm text-muted-foreground">
            {resumo.linhasIgnoradas} linha(s) ignorada(s).
          </p>
        )}
        {erros.length > 0 && (
          <Alert variant="destructive">
            <AlertTitle>Erros durante a gravação</AlertTitle>
            <AlertDescription>
              <ul className="list-disc space-y-1 pl-4">
                {erros.slice(0, 10).map((e, i) => (
                  <li key={i}>{e}</li>
                ))}
              </ul>
            </AlertDescription>
          </Alert>
        )}
        {itensRevisao.length > 0 && (
          <Alert>
            <AlertTitle>Itens para revisão</AlertTitle>
            <AlertDescription>
              <ul className="list-disc space-y-1 pl-4">
                {itensRevisao.slice(0, 10).map((p, i) => (
                  <li key={i}>
                    Linha {p.linha}: {p.mensagem}
                  </li>
                ))}
              </ul>
              {itensRevisao.length > 10 && (
                <p className="mt-1 text-xs">… e mais {itensRevisao.length - 10}.</p>
              )}
            </AlertDescription>
          </Alert>
        )}
        <div className="flex justify-end gap-2">
          <Button variant="outline" onClick={onNova}>
            Importar outro intervalo
          </Button>
          <Button onClick={onFechar}>Concluir</Button>
        </div>
      </CardContent>
    </Card>
  )
}
