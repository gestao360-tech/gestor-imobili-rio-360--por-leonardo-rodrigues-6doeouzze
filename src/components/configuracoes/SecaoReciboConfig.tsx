import React, { useEffect, useRef, useState } from 'react'
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from '@/components/ui/card'
import { Button } from '@/components/ui/button'
import { Input } from '@/components/ui/input'
import { Label } from '@/components/ui/label'
import { Textarea } from '@/components/ui/textarea'
import { RadioGroup, RadioGroupItem } from '@/components/ui/radio-group'
import { useToast } from '@/hooks/use-toast'
import {
  Check,
  Eye,
  FileText,
  Image as ImageIcon,
  Loader2,
  RefreshCw,
  Save,
  Trash2,
  Upload,
} from 'lucide-react'
import {
  CONFIG_RECIBO_PADRAO,
  getReciboConfig,
  salvarReciboConfig,
  uploadLogoRecibo,
} from '@/services/recibos'
import type { CorDestaqueRecibo, ReciboConfig } from '@/features/recibos/tipos'
import { PreviaRecibo } from './PreviaRecibo'

import { cn } from '@/lib/utils'

export function SecaoReciboConfig() {
  const { toast } = useToast()
  const fileInputRef = useRef<HTMLInputElement>(null)

  const [loading, setLoading] = useState(true)
  const [salvando, setSalvando] = useState(false)
  const [uploadingLogo, setUploadingLogo] = useState(false)
  const [form, setForm] = useState<ReciboConfig>(CONFIG_RECIBO_PADRAO)

  useEffect(() => {
    carregar()
  }, [])

  const carregar = async () => {
    setLoading(true)
    try {
      const cfg = await getReciboConfig()
      setForm(cfg)
    } catch (e) {
      toast({
        title: 'Erro ao carregar',
        description: 'Não foi possível carregar as configurações do recibo.',
        variant: 'destructive',
      })
    } finally {
      setLoading(false)
    }
  }

  const handleSalvar = async () => {
    setSalvando(true)
    try {
      await salvarReciboConfig(form)
      toast({
        title: 'Configurações salvas!',
        description: 'Os dados personalizados serão aplicados nos próximos recibos emitidos.',
      })
    } catch (e) {
      toast({
        title: 'Erro ao salvar',
        description: 'Falha ao gravar configurações do recibo.',
        variant: 'destructive',
      })
    } finally {
      setSalvando(false)
    }
  }

  const handleRestaurarPadroes = () => {
    setForm(CONFIG_RECIBO_PADRAO)
    toast({
      title: 'Padrões restaurados',
      description: 'Clique em "Salvar alterações" para persistir as definições originais.',
    })
  }

  const handleUploadLogo = async (e: React.ChangeEvent<HTMLInputElement>) => {
    const file = e.target.files?.[0]
    if (!file) return

    if (!file.type.startsWith('image/')) {
      toast({
        title: 'Arquivo inválido',
        description: 'Por favor, selecione uma imagem (PNG, JPG, SVG ou WEBP).',
        variant: 'destructive',
      })
      return
    }

    setUploadingLogo(true)
    try {
      const { url, documentoId } = await uploadLogoRecibo(file)
      setForm((prev) => ({
        ...prev,
        logo_url: url,
        logo_documento_id: documentoId,
      }))
      toast({
        title: 'Logotipo anexado!',
        description: 'A imagem foi salva e já aparece na prévia do recibo.',
      })
    } catch (err) {
      toast({
        title: 'Erro no upload',
        description: 'Não foi possível carregar o arquivo do logotipo.',
        variant: 'destructive',
      })
    } finally {
      setUploadingLogo(false)
      if (fileInputRef.current) fileInputRef.current.value = ''
    }
  }

  const handleRemoverLogo = () => {
    setForm((prev) => ({ ...prev, logo_url: '', logo_documento_id: '' }))
    toast({
      title: 'Logotipo removido',
      description: 'Lembre-se de salvar as alterações.',
    })
  }

  if (loading) {
    return (
      <div className="flex items-center justify-center p-12 text-slate-500">
        <Loader2 className="w-5 h-5 animate-spin mr-2" />
        Carregando configurações do recibo...
      </div>
    )
  }

  return (
    <div className="space-y-6">
      <div className="flex flex-col sm:flex-row sm:items-center justify-between gap-3 border-b border-slate-200 dark:border-slate-800 pb-4">
        <div>
          <h2 className="text-lg font-bold text-slate-900 dark:text-slate-100 flex items-center gap-2">
            <FileText className="w-5 h-5 text-gold-dark dark:text-gold-luminous" />
            Personalização do Recibo de Aluguel
          </h2>
          <p className="text-xs text-slate-500 dark:text-slate-400 mt-0.5">
            Configure a identidade visual do emitente, textos e cores do PDF gerado e enviado pelo
            WhatsApp.
          </p>
        </div>
        <div className="flex items-center gap-2">
          <Button
            type="button"
            variant="outline"
            size="sm"
            onClick={handleRestaurarPadroes}
            className="text-xs gap-1.5"
          >
            <RefreshCw className="w-3.5 h-3.5" />
            Restaurar Padrão
          </Button>
          <Button
            type="button"
            size="sm"
            onClick={handleSalvar}
            disabled={salvando}
            className="bg-primary hover:bg-primary-hover text-white text-xs gap-1.5 shadow-glow-brand/30"
          >
            {salvando ? (
              <Loader2 className="w-3.5 h-3.5 animate-spin" />
            ) : (
              <Save className="w-3.5 h-3.5" />
            )}
            Salvar Alterações
          </Button>
        </div>
      </div>

      <div className="grid grid-cols-1 lg:grid-cols-12 gap-6 items-start">
        {/* FORMULÁRIO DE CONFIGURAÇÃO */}
        <div className="lg:col-span-7 space-y-5">
          {/* IDENTIDADE DO EMITENTE */}
          <Card className="border-slate-200 dark:border-slate-800">
            <CardHeader className="pb-3">
              <CardTitle className="text-sm font-bold flex items-center gap-2 text-slate-900 dark:text-slate-100">
                <span className="w-2 h-2 rounded-full bg-gold-metallic" />
                Identidade do Emitente (Cabeçalho)
              </CardTitle>
              <CardDescription className="text-xs">
                Dados cadastrais que identificam a imobiliária, administradora ou proprietário.
              </CardDescription>
            </CardHeader>
            <CardContent className="space-y-3.5 text-xs">
              <div className="space-y-1">
                <Label htmlFor="emitente_nome" className="text-xs">
                  Nome ou Razão Social
                </Label>
                <Input
                  id="emitente_nome"
                  value={form.emitente_nome || ''}
                  onChange={(e) => setForm({ ...form, emitente_nome: e.target.value })}
                  placeholder="Ex: Gestor Imobiliário 360 ou Imobiliária Silva Ltda"
                  className="text-xs"
                />
              </div>

              <div className="grid grid-cols-1 sm:grid-cols-2 gap-3">
                <div className="space-y-1">
                  <Label htmlFor="emitente_cpf_cnpj" className="text-xs">
                    CPF ou CNPJ
                  </Label>
                  <Input
                    id="emitente_cpf_cnpj"
                    value={form.emitente_cpf_cnpj || ''}
                    onChange={(e) => setForm({ ...form, emitente_cpf_cnpj: e.target.value })}
                    placeholder="Ex: 12.345.678/0001-90"
                    className="text-xs"
                  />
                </div>
                <div className="space-y-1">
                  <Label htmlFor="emitente_contato" className="text-xs">
                    Contato / Telefone / E-mail
                  </Label>
                  <Input
                    id="emitente_contato"
                    value={form.emitente_contato || ''}
                    onChange={(e) => setForm({ ...form, emitente_contato: e.target.value })}
                    placeholder="Ex: (11) 3000-0000 · contato@gestor360.com"
                    className="text-xs"
                  />
                </div>
              </div>

              <div className="space-y-1">
                <Label htmlFor="emitente_endereco" className="text-xs">
                  Endereço Comercial (Opcional)
                </Label>
                <Input
                  id="emitente_endereco"
                  value={form.emitente_endereco || ''}
                  onChange={(e) => setForm({ ...form, emitente_endereco: e.target.value })}
                  placeholder="Ex: Av. Paulista, 1000 - Sala 401 - São Paulo/SP"
                  className="text-xs"
                />
              </div>

              {/* LOGOTIPO */}
              <div className="pt-2 border-t border-slate-100 dark:border-slate-800 space-y-2">
                <Label className="text-xs font-semibold flex items-center gap-1.5">
                  <ImageIcon className="w-3.5 h-3.5 text-slate-500" />
                  Logotipo do Recibo
                </Label>
                <div className="flex items-center gap-3">
                  {form.logo_url ? (
                    <div className="relative w-16 h-16 rounded border border-slate-200 dark:border-slate-700 p-1 bg-white flex items-center justify-center overflow-hidden">
                      <img
                        src={form.logo_url}
                        alt="Logotipo"
                        className="max-w-full max-h-full object-contain"
                      />
                    </div>
                  ) : (
                    <div className="w-16 h-16 rounded border border-dashed border-slate-300 dark:border-slate-700 bg-slate-50 dark:bg-slate-900 flex items-center justify-center text-slate-400">
                      <ImageIcon className="w-6 h-6" />
                    </div>
                  )}

                  <div className="space-y-1.5">
                    <input
                      ref={fileInputRef}
                      type="file"
                      accept="image/*"
                      className="hidden"
                      onChange={handleUploadLogo}
                    />
                    <div className="flex gap-2">
                      <Button
                        type="button"
                        variant="outline"
                        size="sm"
                        disabled={uploadingLogo}
                        onClick={() => fileInputRef.current?.click()}
                        className="text-xs gap-1.5"
                      >
                        {uploadingLogo ? (
                          <Loader2 className="w-3.5 h-3.5 animate-spin" />
                        ) : (
                          <Upload className="w-3.5 h-3.5" />
                        )}
                        {form.logo_url ? 'Trocar Logo' : 'Enviar Imagem'}
                      </Button>
                      {form.logo_url && (
                        <Button
                          type="button"
                          variant="ghost"
                          size="sm"
                          onClick={handleRemoverLogo}
                          className="text-xs text-rose-600 hover:text-rose-700 hover:bg-rose-50 dark:hover:bg-rose-950/30 gap-1"
                        >
                          <Trash2 className="w-3.5 h-3.5" />
                          Remover
                        </Button>
                      )}
                    </div>
                    <p className="text-[10px] text-slate-400">
                      PNG, JPG ou WEBP. Imagem otimizada para cabeçalho do recibo.
                    </p>
                  </div>
                </div>
              </div>
            </CardContent>
          </Card>

          {/* ESTILO E PALETA DO RECIBO */}
          <Card className="border-slate-200 dark:border-slate-800">
            <CardHeader className="pb-3">
              <CardTitle className="text-sm font-bold flex items-center gap-2 text-slate-900 dark:text-slate-100">
                <span className="w-2 h-2 rounded-full bg-primary" />
                Cor de Destaque da Identidade Visual
              </CardTitle>
              <CardDescription className="text-xs">
                Selecione o tom da paleta institucional oficial para a moldura, faixas e títulos.
              </CardDescription>
            </CardHeader>
            <CardContent className="space-y-3">
              <RadioGroup
                value={form.cor_destaque || 'navy'}
                onValueChange={(v) => setForm({ ...form, cor_destaque: v as CorDestaqueRecibo })}
                className="grid grid-cols-1 sm:grid-cols-3 gap-3"
              >
                {/* AZUL-MARINHO */}
                <label
                  htmlFor="cor-navy"
                  className={cn(
                    'flex items-center gap-3 p-3 rounded-lg border cursor-pointer transition-all',
                    (form.cor_destaque || 'navy') === 'navy'
                      ? 'border-[#06182B] bg-[#06182B]/5 dark:bg-[#06182B]/30 ring-1 ring-[#06182B]'
                      : 'border-slate-200 dark:border-slate-800 hover:bg-slate-50 dark:hover:bg-slate-900',
                  )}
                >
                  <RadioGroupItem value="navy" id="cor-navy" />
                  <div className="flex items-center gap-2">
                    <span className="w-5 h-5 rounded-full bg-[#06182B] border border-white/20 shadow-xs" />
                    <div>
                      <div className="text-xs font-bold text-slate-900 dark:text-slate-100">
                        Azul-marinho
                      </div>
                      <div className="text-[10px] text-slate-500">#06182B Oficial</div>
                    </div>
                  </div>
                </label>

                {/* DOURADO */}
                <label
                  htmlFor="cor-gold"
                  className={cn(
                    'flex items-center gap-3 p-3 rounded-lg border cursor-pointer transition-all',
                    form.cor_destaque === 'gold'
                      ? 'border-[#D4A347] bg-[#FFF0B2]/30 dark:bg-[#86521D]/20 ring-1 ring-[#D4A347]'
                      : 'border-slate-200 dark:border-slate-800 hover:bg-slate-50 dark:hover:bg-slate-900',
                  )}
                >
                  <RadioGroupItem value="gold" id="cor-gold" />
                  <div className="flex items-center gap-2">
                    <span className="w-5 h-5 rounded-full bg-[#D4A347] border border-white/20 shadow-xs" />
                    <div>
                      <div className="text-xs font-bold text-slate-900 dark:text-slate-100">
                        Dourado
                      </div>
                      <div className="text-[10px] text-slate-500">#D4A347 Bronze</div>
                    </div>
                  </div>
                </label>

                {/* LARANJA */}
                <label
                  htmlFor="cor-orange"
                  className={cn(
                    'flex items-center gap-3 p-3 rounded-lg border cursor-pointer transition-all',
                    form.cor_destaque === 'orange'
                      ? 'border-[#F15A24] bg-[#F15A24]/5 dark:bg-[#F15A24]/20 ring-1 ring-[#F15A24]'
                      : 'border-slate-200 dark:border-slate-800 hover:bg-slate-50 dark:hover:bg-slate-900',
                  )}
                >
                  <RadioGroupItem value="orange" id="cor-orange" />
                  <div className="flex items-center gap-2">
                    <span className="w-5 h-5 rounded-full bg-[#F15A24] border border-white/20 shadow-xs" />
                    <div>
                      <div className="text-xs font-bold text-slate-900 dark:text-slate-100">
                        Laranja
                      </div>
                      <div className="text-[10px] text-slate-500">#F15A24 Ação</div>
                    </div>
                  </div>
                </label>
              </RadioGroup>
            </CardContent>
          </Card>

          {/* TEXTOS E MODELO DE QUITAÇÃO */}
          <Card className="border-slate-200 dark:border-slate-800">
            <CardHeader className="pb-3">
              <CardTitle className="text-sm font-bold flex items-center gap-2 text-slate-900 dark:text-slate-100">
                <span className="w-2 h-2 rounded-full bg-emerald-600" />
                Textos do Documento e Cláusula de Quitação
              </CardTitle>
              <CardDescription className="text-xs">
                Personalize o título, o texto jurídico de quitação e observações padrão.
              </CardDescription>
            </CardHeader>
            <CardContent className="space-y-3.5 text-xs">
              <div className="space-y-1">
                <Label htmlFor="titulo_documento" className="text-xs">
                  Título Principal do Documento
                </Label>
                <Input
                  id="titulo_documento"
                  value={form.titulo_documento || ''}
                  onChange={(e) => setForm({ ...form, titulo_documento: e.target.value })}
                  placeholder="Ex: RECIBO DE ALUGUEL"
                  className="text-xs font-semibold"
                />
              </div>

              <div className="space-y-1">
                <div className="flex items-center justify-between">
                  <Label htmlFor="texto_quitacao" className="text-xs">
                    Texto de Quitação (Corpo Principal)
                  </Label>
                  <span className="text-[10px] text-slate-400">Variáveis disponíveis</span>
                </div>
                <Textarea
                  id="texto_quitacao"
                  rows={4}
                  value={form.texto_quitacao || ''}
                  onChange={(e) => setForm({ ...form, texto_quitacao: e.target.value })}
                  placeholder="Recebemos de {inquilino_nome}..."
                  className="text-xs font-mono"
                />
                <div className="flex flex-wrap gap-1 pt-1">
                  {[
                    '{inquilino_nome}',
                    '{inquilino_documento}',
                    '{valor_pago}',
                    '{valor_pago_extenso}',
                    '{competencia}',
                    '{imovel_rotulo}',
                    '{locador_nome}',
                    '{numero_recibo}',
                  ].map((v) => (
                    <button
                      key={v}
                      type="button"
                      onClick={() =>
                        setForm((prev) => ({
                          ...prev,
                          texto_quitacao: (prev.texto_quitacao || '') + ' ' + v,
                        }))
                      }
                      className="px-1.5 py-0.5 rounded bg-slate-100 dark:bg-slate-800 text-[10px] text-slate-600 dark:text-slate-400 hover:text-primary transition-colors"
                    >
                      {v}
                    </button>
                  ))}
                </div>
              </div>

              <div className="space-y-1">
                <Label htmlFor="observacoes" className="text-xs">
                  Observações Padrão / Instruções Adicionais
                </Label>
                <Textarea
                  id="observacoes"
                  rows={2}
                  value={form.observacoes || ''}
                  onChange={(e) => setForm({ ...form, observacoes: e.target.value })}
                  placeholder="Ex: Este recibo quita exclusivamente as rubricas acima especificadas..."
                  className="text-xs"
                />
              </div>

              <div className="space-y-1">
                <Label htmlFor="rodape" className="text-xs">
                  Rodapé / Mensagem Final
                </Label>
                <Input
                  id="rodape"
                  value={form.rodape || ''}
                  onChange={(e) => setForm({ ...form, rodape: e.target.value })}
                  placeholder="Ex: Gestor Imobiliário 360 · Chave PIX: contato@gestor360.com.br"
                  className="text-xs"
                />
              </div>
            </CardContent>
          </Card>
        </div>

        {/* PRÉVIA VISUAL EM TEMPO REAL */}
        <div className="lg:col-span-5 space-y-3 sticky top-4">
          <div className="flex items-center justify-between">
            <span className="text-xs font-bold text-slate-700 dark:text-slate-300 flex items-center gap-1.5">
              <Eye className="w-3.5 h-3.5 text-gold-dark dark:text-gold-luminous" />
              Prévia Visual do Recibo
            </span>
            <span className="text-[10px] text-slate-400">Atualização em tempo real</span>
          </div>

          <PreviaRecibo dados={form} />
        </div>
      </div>
    </div>
  )
}
export default SecaoReciboConfig
