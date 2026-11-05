import React from 'react'
import type { CorDestaqueRecibo, ReciboPersonalizacao } from '@/features/recibos/tipos'
import { valorPorExtenso } from '@/features/recibos/pdf'

interface PreviaReciboProps {
  dados: ReciboPersonalizacao
  amostra?: {
    numero?: string
    competencia?: string
    inquilinoNome?: string
    inquilinoDoc?: string
    imovelRotulo?: string
    valorAluguel?: number
    valorCondominio?: number
    valorIptu?: number
    valorTotal?: number
    valorPago?: number
    dataPagamento?: string
    formaPagamento?: string
  }
}

const AMOSTRA_PADRAO = {
  numero: '0001/2026',
  competencia: '11/2026',
  inquilinoNome: 'Carlos Eduardo Oliveira',
  inquilinoDoc: '123.456.789-00',
  imovelRotulo: 'Apto 402 — Edifício Solar das Palmeiras',
  valorAluguel: 2500,
  valorCondominio: 450,
  valorIptu: 120,
  valorTotal: 3070,
  valorPago: 3070,
  dataPagamento: '05/11/2026',
  formaPagamento: 'PIX',
}

function brl(v: number) {
  return v.toLocaleString('pt-BR', { style: 'currency', currency: 'BRL' })
}

const ESTILOS_TEMA: Record<
  CorDestaqueRecibo,
  {
    faixaSuperior: string
    textoTitulo: string
    bordaFundo: string
    badge: string
    boxTotal: string
    boxObservacoes: string
    rotuloObservacoes: string
  }
> = {
  navy: {
    faixaSuperior: 'bg-[#06182B]',
    textoTitulo: 'text-[#06182B] dark:text-[#FFF0B2]',
    bordaFundo: 'border-[#102B46]/30',
    badge: 'bg-[#06182B] text-white',
    boxTotal: 'bg-[#102B46]/5 dark:bg-[#102B46]/20 border-[#102B46]/20',
    boxObservacoes: 'bg-[#06182B]/[0.03] dark:bg-[#102B46]/20 border-[#102B46]/20',
    rotuloObservacoes: 'text-[#06182B] dark:text-[#FFF0B2]',
  },
  gold: {
    faixaSuperior: 'bg-[#D4A347]',
    textoTitulo: 'text-[#86521D] dark:text-[#FFD477]',
    bordaFundo: 'border-[#D4A347]/40',
    badge: 'bg-[#86521D] text-white',
    boxTotal: 'bg-[#FFF0B2]/30 dark:bg-[#86521D]/20 border-[#D4A347]/30',
    boxObservacoes: 'bg-[#FFF0B2]/20 dark:bg-[#86521D]/15 border-[#D4A347]/30',
    rotuloObservacoes: 'text-[#86521D] dark:text-[#FFD477]',
  },
  orange: {
    faixaSuperior: 'bg-[#F15A24]',
    textoTitulo: 'text-[#D94916] dark:text-[#FF7A47]',
    bordaFundo: 'border-[#F15A24]/40',
    badge: 'bg-[#F15A24] text-white',
    boxTotal: 'bg-[#F15A24]/5 dark:bg-[#F15A24]/20 border-[#F15A24]/20',
    boxObservacoes: 'bg-[#F15A24]/[0.04] dark:bg-[#F15A24]/15 border-[#F15A24]/25',
    rotuloObservacoes: 'text-[#D94916] dark:text-[#FF7A47]',
  },
}

export function PreviaRecibo({ dados, amostra = AMOSTRA_PADRAO }: PreviaReciboProps) {
  const cor = dados.cor_destaque || 'navy'
  const estilo = ESTILOS_TEMA[cor] || ESTILOS_TEMA.navy

  const emitenteNome = dados.emitente_nome?.trim() || 'GESTOR IMOBILIÁRIO 360'
  const emitenteDoc = dados.emitente_cpf_cnpj?.trim()
  const emitenteContato = dados.emitente_contato?.trim()
  const emitenteEndereco = dados.emitente_endereco?.trim()
  const titulo = dados.titulo_documento?.trim() || 'RECIBO DE ALUGUEL'

  // Interpolação do texto de quitação
  const inquilinoDoc = amostra.inquilinoDoc ? ` (CPF/CNPJ ${amostra.inquilinoDoc})` : ''
  const valorPagoExtenso = valorPorExtenso(amostra.valorPago || 0)
  const valorPagoFormatado = brl(amostra.valorPago || 0)

  let textoQuitacao = dados.texto_quitacao?.trim()
  if (textoQuitacao) {
    textoQuitacao = textoQuitacao
      .replace(/\{inquilino_nome\}/gi, amostra.inquilinoNome || '—')
      .replace(/\{inquilino_documento\}/gi, inquilinoDoc)
      .replace(/\{valor_pago\}/gi, valorPagoFormatado)
      .replace(/\{valor_pago_extenso\}/gi, valorPagoExtenso)
      .replace(/\{competencia\}/gi, amostra.competencia || '—')
      .replace(/\{imovel_rotulo\}/gi, amostra.imovelRotulo || '—')
      .replace(/\{locador_nome\}/gi, emitenteNome)
      .replace(/\{numero_recibo\}/gi, amostra.numero || '—')
  } else {
    textoQuitacao = `Recebemos de ${amostra.inquilinoNome}${inquilinoDoc}, a importância de ${valorPagoFormatado} (${valorPagoExtenso}), referente ao pagamento do aluguel e encargos da competência ${amostra.competencia} do imóvel ${amostra.imovelRotulo}. Damos plena, rasa e geral quitação da quantia discriminada neste documento.`
  }

  return (
    <div className="relative w-full max-w-xl mx-auto bg-white dark:bg-slate-950 text-slate-800 dark:text-slate-100 rounded-lg shadow-elevation border border-slate-200 dark:border-slate-800 overflow-hidden font-sans text-xs">
      {/* Faixa superior de destaque com a cor selecionada */}
      <div className={`h-2.5 w-full ${estilo.faixaSuperior}`} />
      <div className="h-0.5 w-full bg-[#D4A347]" />

      <div className="p-6 space-y-4">
        {/* Cabeçalho do emitente */}
        <div className="flex items-start justify-between gap-4 border-b border-slate-200 dark:border-slate-800 pb-3">
          <div className="space-y-0.5">
            <h4 className={`text-base font-bold tracking-tight ${estilo.textoTitulo}`}>
              {emitenteNome}
            </h4>
            {emitenteDoc && (
              <p className="text-[11px] text-slate-600 dark:text-slate-400 font-medium">
                {emitenteDoc}
              </p>
            )}
            {emitenteContato && (
              <p className="text-[10px] text-slate-500 dark:text-slate-400">{emitenteContato}</p>
            )}
            {emitenteEndereco && (
              <p className="text-[10px] text-slate-500 dark:text-slate-400">{emitenteEndereco}</p>
            )}
          </div>
          {dados.logo_url && (
            <div className="shrink-0 w-16 h-16 rounded border border-slate-200 dark:border-slate-800 bg-white p-1 flex items-center justify-center overflow-hidden">
              <img
                src={dados.logo_url}
                alt="Logotipo"
                className="max-w-full max-h-full object-contain"
              />
            </div>
          )}
        </div>

        {/* Título do documento */}
        <div className="text-center space-y-1">
          <h3 className={`text-lg font-black tracking-wide uppercase ${estilo.textoTitulo}`}>
            {titulo}
          </h3>
          <div className="inline-flex items-center gap-2 text-[11px] font-semibold text-slate-500 dark:text-slate-400">
            <span>Nº {amostra.numero}</span>
            <span>•</span>
            <span>COMPETÊNCIA {amostra.competencia}</span>
          </div>
        </div>

        {/* Texto de quitação */}
        <div className="p-3 bg-slate-50 dark:bg-slate-900/60 rounded border border-slate-200 dark:border-slate-800 text-[11px] leading-relaxed text-justify text-slate-700 dark:text-slate-300">
          {textoQuitacao}
        </div>

        {/* Demonstrativo de valores */}
        <div className="space-y-1.5 border-t border-slate-200 dark:border-slate-800 pt-3">
          <div className="flex justify-between text-[11px] font-bold text-slate-600 dark:text-slate-400 uppercase tracking-wider pb-1">
            <span>Demonstrativo de Valores</span>
            <span>Quantia</span>
          </div>
          <div className="flex justify-between text-[11px] text-slate-600 dark:text-slate-300">
            <span>Aluguel</span>
            <span className="font-mono">{brl(amostra.valorAluguel || 0)}</span>
          </div>
          {amostra.valorCondominio ? (
            <div className="flex justify-between text-[11px] text-slate-600 dark:text-slate-300">
              <span>Condomínio</span>
              <span className="font-mono">{brl(amostra.valorCondominio)}</span>
            </div>
          ) : null}
          {amostra.valorIptu ? (
            <div className="flex justify-between text-[11px] text-slate-600 dark:text-slate-300">
              <span>IPTU</span>
              <span className="font-mono">{brl(amostra.valorIptu)}</span>
            </div>
          ) : null}

          {/* Box de quitação */}
          <div className="mt-2 p-2.5 rounded border border-emerald-300 dark:border-emerald-700/60 bg-emerald-50 dark:bg-emerald-950/30 flex justify-between items-center">
            <span className="font-bold text-emerald-800 dark:text-emerald-300 text-xs">
              Total Quitado
            </span>
            <span className="font-bold font-mono text-emerald-800 dark:text-emerald-300 text-sm">
              {brl(amostra.valorPago || 0)}
            </span>
          </div>
        </div>

        {/* Informações adicionais do pagamento */}
        <div className="text-[10px] text-slate-500 dark:text-slate-400 space-y-0.5 border-t border-slate-100 dark:border-slate-800 pt-2 text-center">
          <div>
            Data do pagamento: <strong>{amostra.dataPagamento}</strong> · Forma:{' '}
            <strong>{amostra.formaPagamento}</strong>
          </div>
          <div>Imóvel: {amostra.imovelRotulo}</div>
        </div>

        {/* Observações personalizadas (bloco visível com alto contraste quando preenchido) */}
        {dados.observacoes?.trim() ? (
          <div
            className={`p-2.5 rounded border text-[10px] leading-relaxed transition-all ${estilo.boxObservacoes}`}
          >
            <div
              className={`font-bold uppercase tracking-wider text-[10px] mb-1 flex items-center gap-1.5 ${estilo.rotuloObservacoes}`}
            >
              <span className="w-1.5 h-1.5 rounded-full bg-current opacity-70" />
              Observações:
            </div>
            <p className="whitespace-pre-line text-slate-700 dark:text-slate-200 font-medium text-justify">
              {dados.observacoes.trim()}
            </p>
          </div>
        ) : null}

        {/* Campo de assinatura (apenas Locador/Emitente centralizado) */}
        {dados.exibir_assinaturas !== false && (
          <div className="pt-5 pb-1 space-y-3 border-t border-slate-100 dark:border-slate-800">
            <div className="flex flex-col items-center text-center">
              <div className="w-full max-w-[240px] border-t border-slate-400 dark:border-slate-600 mb-1.5" />
              <span className="text-[10.5px] font-bold text-slate-800 dark:text-slate-200 line-clamp-1">
                {emitenteNome}
              </span>
              <span className="text-[9px] text-slate-500 dark:text-slate-400 font-medium">
                {dados.rotulo_assinatura_emitente?.trim() || 'Locador / Emitente'}
              </span>
              {emitenteDoc && (
                <span className="text-[8.5px] text-slate-400 dark:text-slate-500">
                  {emitenteDoc}
                </span>
              )}
            </div>

            {/* Data centralizada sob a linha de assinatura */}
            <div className="text-center text-[9px] text-slate-500 dark:text-slate-400 font-medium pt-1">
              Emitido em {amostra.dataPagamento || new Date().toLocaleDateString('pt-BR')}
            </div>
          </div>
        )}

        {/* Rodapé configurável */}
        <div className="border-t border-slate-100 dark:border-slate-800 pt-2 text-center text-[9px] text-slate-400">
          {dados.rodape?.trim() || 'Emitido pelo Gestor Imobiliário 360'}
        </div>
      </div>
    </div>
  )
}
