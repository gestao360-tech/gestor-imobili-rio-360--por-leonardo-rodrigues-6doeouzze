/**
 * Integração de pagamentos (Stripe) — Gestor Imobiliário 360.
 *
 * O pagamento dos aluguéis sai pela conta Stripe CONECTADA do PROPRIETÁRIO
 * (Conectores, modo owner) — $connectors.executeAsOwner("stripe", …). Nunca
 * OAuth manual, nunca chave em código, nunca $http direto para a API do Stripe.
 *
 *  • POST /backend/v1/pagamentos/link    — cria (ou REUSA) o Payment Link do
 *    Stripe para uma cobrança em aberto, com o valor exato do saldo, e grava a
 *    URL em cobrancas.link_pagamento. Cobrança que já tem link não gera outro.
 *  • POST /backend/v1/pagamentos/webhook — recebe a confirmação do Stripe
 *    (checkout.session.completed / payment_intent.succeeded), marca a cobrança
 *    como paga/parcialmente paga e grava um registro real em `pagamentos`
 *    (alimenta o Fluxo de Caixa). Idempotente pelo id do evento.
 *
 * Nada automático sem o usuário: o link só nasce quando alguém clica em
 * "Gerar link" no Financeiro OU no momento do envio de um item já APROVADO na
 * fila do WhatsApp (a fila continua exigindo revisão e confirmação).
 *
 * LIMITAÇÃO CONHECIDA: o toolkit Stripe do conector não expõe o segredo de
 * webhook para validar a assinatura (Stripe-Signature). A rota valida o que a
 * plataforma oferece: exige evento conhecido, cobranca_id nos metadados e
 * id de evento nunca antes processado. O endpoint é público por natureza
 * (webhook), mas só age em cobranças válidas e nunca duplica pagamento.
 *
 * JSVM do PocketBase: cada callback roda em pool próprio — toda a lógica é
 * INLINE, sem escopo top-level compartilhado.
 */

// ================= POST /backend/v1/pagamentos/link =================
routerAdd('POST', '/backend/v1/pagamentos/link', (e) => {
  const app = e.app
  const corpo = e.requestInfo().body || {}
  const id = String(corpo.cobranca_id || '')

  if (!id) {
    return e.json(400, { ok: false, erro: 'Cobrança não informada.' })
  }

  let cob = null
  try {
    cob = app.findRecordById('cobrancas', id)
  } catch (_) {
    return e.json(404, { ok: false, erro: 'Cobrança não encontrada.' })
  }

  // Reuso: cobrança que já tem link não gera outro (sem duplicar produto/preço).
  const existente = String(cob.getString('link_pagamento') || '').trim()
  if (existente) {
    return e.json(200, { ok: true, url: existente, criado: false })
  }

  const status = cob.getString('status')
  if (status === 'pago' || status === 'cancelado' || status === 'renegociado') {
    return e.json(400, {
      ok: false,
      erro: 'Esta cobrança não está em aberto (status: ' + status + ') — não há o que cobrar.',
    })
  }

  const total = cob.getFloat('valor_total') || 0
  const pago = cob.getFloat('valor_pago') || 0
  const saldoCentavos = Math.round((total - pago) * 100)
  if (saldoCentavos <= 0) {
    return e.json(400, { ok: false, erro: 'A cobrança não tem saldo em aberto.' })
  }

  function nomeInq(idq) {
    try {
      return app.findRecordById('inquilinos', idq).getString('nome')
    } catch (_) {
      return ''
    }
  }
  function rotuloIm(idq) {
    try {
      const im = app.findRecordById('imoveis', idq)
      const end = im.getString('endereco')
      const num = im.getString('numero')
      const comp = im.getString('complemento')
      let txt = end ? end + (num ? ', ' + num : '') : ''
      if (comp) txt += ' — ' + comp
      return txt
    } catch (_) {
      return ''
    }
  }
  function numContrato(idq) {
    try {
      return app.findRecordById('contratos', idq).getString('numero')
    } catch (_) {
      return ''
    }
  }

  const competencia = cob.getString('competencia') || '—'
  const descricao =
    'Aluguel competência ' +
    competencia +
    ' — ' +
    (rotuloIm(cob.getString('imovel')) || 'imóvel') +
    ' — ' +
    (nomeInq(cob.getString('inquilino')) || 'inquilino')

  function erroDo(resp) {
    try {
      if (resp && resp.error) {
        return String(
          resp.error.message ||
            resp.error.description ||
            (typeof resp.error === 'string' ? resp.error : JSON.stringify(resp.error)),
        )
      }
      if (resp && resp.successful === false) return 'a operação não foi confirmada pelo Stripe.'
    } catch (_) {
      /* segue com genérico */
    }
    return ''
  }

  try {
    // 1) Produto — um por cobrança (nome = descrição completa).
    const prod = $connectors.executeAsOwner('stripe', {
      name: 'STRIPE_CREATE_PRODUCT',
      params: {
        name: descricao,
        metadata: {
          cobranca_id: cob.id,
          competencia: competencia,
          inquilino: cob.getString('inquilino'),
          imovel: cob.getString('imovel'),
          contrato: cob.getString('contrato'),
        },
      },
    })
    let erro = erroDo(prod)
    if (!erro) {
      const dProd = (prod && (prod.data || prod)) || {}
      const productId = String(dProd.id || '')
      if (!productId) {
        erro = 'o Stripe não retornou o id do produto.'
      } else {
        // 2) Preço — valor exato do saldo, em centavos, BRL.
        const preco = $connectors.executeAsOwner('stripe', {
          name: 'STRIPE_CREATE_PRICE',
          params: { currency: 'brl', unit_amount: saldoCentavos, product: productId },
        })
        erro = erroDo(preco)
        if (!erro) {
          const dPreco = (preco && (preco.data || preco)) || {}
          const priceId = String(dPreco.id || '')
          if (!priceId) {
            erro = 'o Stripe não retornou o id do preço.'
          } else {
            // 3) Payment Link — a URL que o inquilino abre para pagar.
            const plink = $connectors.executeAsOwner('stripe', {
              name: 'STRIPE_CREATE_PAYMENT_LINK',
              params: {
                line_items: [{ price: priceId, quantity: 1 }],
                metadata: { cobranca_id: cob.id, competencia: competencia },
              },
            })
            erro = erroDo(plink)
            if (!erro) {
              const dLink = (plink && (plink.data || plink)) || {}
              const url = String(dLink.url || '')
              if (!url) {
                erro = 'o Stripe não retornou a URL do link de pagamento.'
              } else {
                cob.set('link_pagamento', url)
                app.save(cob)
                console.log(
                  '[pagamentos] link criado para cobrança ' +
                    cob.id +
                    ' (saldo ' +
                    saldoCentavos / 100 +
                    ')',
                )
                return e.json(200, { ok: true, url: url, criado: true })
              }
            }
          }
        }
      }
    }
    return e.json(502, {
      ok: false,
      erro: 'Não foi possível criar o link de pagamento no Stripe: ' + erro,
    })
  } catch (errStripe) {
    // Falha típica quando a conta Stripe do PROPRIETÁRIO não está conectada ou
    // o modo owner não está liberado — mensagem clara, nunca sucesso falso.
    return e.json(502, {
      ok: false,
      erro:
        'Erro no Stripe: ' +
        String((errStripe && errStripe.message) || errStripe) +
        ' — conecte/autorize o Stripe nas configurações (Conectores) e tente de novo.',
    })
  }
})

// ================= POST /backend/v1/pagamentos/webhook =================
routerAdd('POST', '/backend/v1/pagamentos/webhook', (e) => {
  const app = e.app
  const corpo = e.requestInfo().body || {}
  const tipo = String(corpo.type || '')
  const eventoId = String(corpo.id || '')
  const obj = (corpo.data && corpo.data.object) || {}

  let cobId = ''
  let centavos = 0
  if (tipo === 'checkout.session.completed') {
    centavos = Number(obj.amount_total) || 0
    cobId = String((obj.metadata && obj.metadata.cobranca_id) || '')
  } else if (tipo === 'payment_intent.succeeded') {
    centavos = Number(obj.amount_received) || 0
    cobId = String((obj.metadata && obj.metadata.cobranca_id) || '')
  } else {
    return e.json(200, { ok: true, ignorado: true, motivo: 'evento não tratado' })
  }
  if (!cobId || centavos <= 0) {
    return e.json(200, {
      ok: true,
      ignorado: true,
      motivo: 'evento sem cobranca_id/valor nos metadados',
    })
  }

  // Idempotência: um mesmo evento nunca gera dois pagamentos.
  const marca = 'stripe_event:' + eventoId
  try {
    app.findFirstRecordByFilter('pagamentos', "observacoes ~ '" + marca + "'")
    return e.json(200, { ok: true, duplicado: true })
  } catch (_) {
    /* evento novo — segue */
  }

  let cob = null
  try {
    cob = app.findRecordById('cobrancas', cobId)
  } catch (_) {
    return e.json(404, { ok: false, erro: 'Cobrança não encontrada para o evento.' })
  }

  const agora = new Date()
  const p2 = (n) => String(n).padStart(2, '0')
  const hojeStr = agora.getFullYear() + '-' + p2(agora.getMonth() + 1) + '-' + p2(agora.getDate())

  const valorPago = Math.round(centavos) / 100
  const novoPago = (cob.getFloat('valor_pago') || 0) + valorPago
  const total = cob.getFloat('valor_total') || 0

  cob.set('valor_pago', novoPago)
  cob.set('data_pagamento', hojeStr)
  cob.set('forma_pagamento', 'outra')
  cob.set('status', novoPago >= total - 0.005 ? 'pago' : 'pago_parcialmente')
  app.save(cob)

  // Registro real em pagamentos — é isto que alimenta o Fluxo de Caixa.
  const col = app.findCollectionByNameOrId('pagamentos')
  const rec = new Record(col)
  rec.set('cobranca', cob.id)
  rec.set('data_pagamento', hojeStr)
  rec.set('valor_pago', valorPago)
  rec.set('forma_pagamento', 'outra')
  rec.set('registrado_por', 'Stripe (webhook)')
  rec.set('observacoes', marca)
  app.save(rec)

  console.log(
    '[pagamentos] webhook ' +
      tipo +
      ': R$ ' +
      valorPago.toFixed(2) +
      ' creditado na cobrança ' +
      cob.id +
      ' (status: ' +
      cob.getString('status') +
      ')',
  )
  return e.json(200, { ok: true, cobranca: cob.id, status: cob.getString('status') })
})
