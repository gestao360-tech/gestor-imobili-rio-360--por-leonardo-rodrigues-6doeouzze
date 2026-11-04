// ⚙️ Configurações — seção WhatsApp da fila de cobranças.
//
// Liga/desliga por categoria (cobrança antecipada, alerta de inadimplência),
// dias antes do vencimento e botão "Enviar teste" com resultado real.
import { useEffect, useState } from 'react'
import { Card, CardContent, CardHeader, CardTitle } from '@/components/ui/card'
import { Button } from '@/components/ui/button'
import { Input } from '@/components/ui/input'
import { Switch } from '@/components/ui/switch'
import { useToast } from '@/hooks/use-toast'
import {
  enviarTesteWhatsapp,
  getConfigWhatsapp,
  salvarConfigWhatsapp,
  type ConfigWhatsapp,
} from '@/services/whatsapp'
import SecaoTemplatesWhatsapp from './SecaoTemplatesWhatsapp'

export default function SecaoWhatsapp() {
  const { toast } = useToast()
  const [config, setConfig] = useState<ConfigWhatsapp | null>(null)
  const [carregando, setCarregando] = useState(true)
  const [diasAntes, setDiasAntes] = useState(3)
  const [numeroTeste, setNumeroTeste] = useState('')
  const [testando, setTestando] = useState(false)
  const [salvando, setSalvando] = useState(false)

  useEffect(() => {
    getConfigWhatsapp()
      .then((c) => {
        setConfig(c)
        setDiasAntes(c.dias_antes_vencimento)
      })
      .catch((e) =>
        toast({
          title: 'Erro ao carregar a configuração do WhatsApp',
          description: e instanceof Error ? e.message : 'Tente novamente.',
          variant: 'destructive',
        }),
      )
      .finally(() => setCarregando(false))
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [])

  const salvar = async (nova: Partial<ConfigWhatsapp>) => {
    if (!config) return
    const mesclada = { ...config, ...nova }
    setConfig(mesclada as ConfigWhatsapp)
    setSalvando(true)
    try {
      await salvarConfigWhatsapp({
        categorias: mesclada.categorias,
        dias_antes_vencimento: mesclada.dias_antes_vencimento,
      })
      toast({ title: 'Configuração salva' })
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

  const enviarTeste = async () => {
    if (!numeroTeste.trim()) {
      toast({ title: 'Informe o número para o teste', variant: 'destructive' })
      return
    }
    setTestando(true)
    try {
      const r = await enviarTesteWhatsapp(numeroTeste.trim())
      if (r.ok) {
        toast({
          title: 'Mensagem de teste enviada',
          description: `Número normalizado: ${r.numero_normalizado || numeroTeste}`,
        })
      } else {
        toast({
          title: 'Falha no envio de teste',
          description: r.erro || 'Verifique o conector WhatsApp no painel de Conectores.',
          variant: 'destructive',
        })
      }
    } catch (e) {
      toast({
        title: 'Erro no envio de teste',
        description: e instanceof Error ? e.message : 'Tente novamente.',
        variant: 'destructive',
      })
    } finally {
      setTestando(false)
    }
  }

  if (carregando) {
    return (
      <Card>
        <CardContent className="py-6 text-center text-xs text-slate-400">Carregando…</CardContent>
      </Card>
    )
  }
  if (!config) return null

  return (
    <Card>
      <CardHeader className="pb-2">
        <CardTitle className="text-sm flex items-center gap-2">📱 WhatsApp / Cobranças</CardTitle>
      </CardHeader>
      <CardContent className="space-y-3">
        <div className="flex items-center justify-between gap-4 flex-wrap">
          <div>
            <p className="text-xs font-medium">Cobrança antecipada (lembrança de vencimento)</p>
            <p className="text-[11px] text-slate-500">
              Entra na fila {diasAntes} dia(s) antes do vencimento da competência.
            </p>
          </div>
          <Switch
            checked={config.categorias.cobranca_antecipada}
            disabled={salvando}
            onCheckedChange={(v) =>
              salvar({ categorias: { ...config.categorias, cobranca_antecipada: v } })
            }
          />
        </div>
        <div className="flex items-center justify-between gap-4 flex-wrap">
          <div>
            <p className="text-xs font-medium">Alerta de inadimplência</p>
            <p className="text-[11px] text-slate-500">
              Entra na fila quando a cobrança vence sem pagamento integral.
            </p>
          </div>
          <Switch
            checked={config.categorias.alerta_inadimplencia}
            disabled={salvando}
            onCheckedChange={(v) =>
              salvar({ categorias: { ...config.categorias, alerta_inadimplencia: v } })
            }
          />
        </div>
        <div className="flex items-center gap-2 flex-wrap">
          <span className="text-xs">Dias antes do vencimento:</span>
          <Input
            type="number"
            min={1}
            max={30}
            value={diasAntes}
            onChange={(e) => setDiasAntes(Number(e.target.value) || 3)}
            className="w-16 text-xs"
          />
          <Button
            size="sm"
            variant="outline"
            onClick={() => salvar({ dias_antes_vencimento: diasAntes })}
          >
            Salvar
          </Button>
        </div>
        <div className="flex items-center gap-2 flex-wrap border-t pt-3">
          <span className="text-xs">Enviar teste para:</span>
          <Input
            value={numeroTeste}
            onChange={(e) => setNumeroTeste(e.target.value)}
            placeholder="(11) 97777-1234"
            className="w-48 text-xs"
          />
          <Button size="sm" onClick={enviarTeste} disabled={testando}>
            {testando ? 'Enviando…' : 'Enviar teste'}
          </Button>
          <span className="text-[11px] text-slate-400">
            Mensagens saem do número fixo conectado (conta do proprietário, via conector).
          </span>
        </div>
        <SecaoTemplatesWhatsapp />
      </CardContent>
    </Card>
  )
}
