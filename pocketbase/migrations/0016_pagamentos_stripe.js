// Migração 0016 — Integração de pagamentos (Stripe via conector, modo owner).
//
// 1) cobrancas ganha `link_pagamento` (text) — URL do Payment Link do Stripe,
//    criado na conta do PROPRIETÁRIO conectada (nunca outra conta, nunca chave
//    em código). Quando a cobrança já tem link, ele é REUSADO (nada de criar
//    produto/preço duplicado no Stripe).
// 2) fila_whatsapp ganha `link_incluido` (bool) — registra que a mensagem
//    enviada levou o link de pagamento.
// 3) Textos dos templates padrão da fila passam a mencionar o link de pagamento
//    via a nova variável {link_pagamento} (atualização idempotente).
//
// Campos criados POR NOME, sem ids internos pbc_* (padrão das migrações 0010+).
migrate(
  (app) => {
    // ---------- 1) cobrancas.link_pagamento ----------
    const cob = app.findCollectionByNameOrId('cobrancas')
    if (!cob.fields.getByName('link_pagamento')) {
      cob.fields.add(new TextField({ name: 'link_pagamento', max: 1000 }))
      cob.addIndex('idx_cob_link_pagamento', false, 'link_pagamento', '')
    }
    app.save(cob)
    console.log('[0016] cobrancas.link_pagamento garantido')

    // ---------- 2) fila_whatsapp.link_incluido ----------
    const fila = app.findCollectionByNameOrId('fila_whatsapp')
    if (!fila.fields.getByName('link_incluido')) {
      fila.fields.add(new BoolField({ name: 'link_incluido' }))
    }
    app.save(fila)
    console.log('[0016] fila_whatsapp.link_incluido garantido')

    // ---------- 3) templates padrão com {link_pagamento} ----------
    const LINHA_COBRANCA = [
      '📍 Imóvel: {imovel}',
      '💰 Valor: {valor}',
      '',
      '💳 Pague online: {link_pagamento}',
    ].join('\n')
    const LINHA_INADIMPLENCIA = [
      '📍 Imóvel: {imovel}',
      '💰 Valor em aberto: {valor}',
      '💳 Pague online: {link_pagamento}',
    ].join('\n')

    const alvos = [
      {
        nome: 'Cobrança — aluguel a vencer',
        de: '📍 Imóvel: {imovel}\n💰 Valor: {valor}',
        para: LINHA_COBRANCA,
      },
      {
        nome: 'Inadimplência — aluguel em atraso',
        de: '📍 Imóvel: {imovel}\n💰 Valor em aberto: {valor}',
        para: LINHA_INADIMPLENCIA,
      },
    ]
    for (const alvo of alvos) {
      try {
        const rec = app.findFirstRecordByFilter(
          'fila_whatsapp_templates',
          "nome = '" + alvo.nome.replace(/'/g, "\\'") + "'",
        )
        const texto = String(rec.getString('texto') || '')
        if (texto.indexOf('{link_pagamento}') !== -1) {
          console.log('[0016] template já menciona o link: ' + alvo.nome)
          continue
        }
        if (texto.indexOf(alvo.de) !== -1) {
          rec.set('texto', texto.split(alvo.de).join(alvo.para))
        } else {
          rec.set('texto', texto + '\n\n💳 Pague online: {link_pagamento}')
        }
        app.save(rec)
        console.log('[0016] template padrão atualizado com {link_pagamento}: ' + alvo.nome)
      } catch (_) {
        console.log('[0016] template padrão não encontrado (sem dado real afetado): ' + alvo.nome)
      }
    }
  },
  (app) => {
    if (app.hasTable('cobrancas')) {
      const cob = app.findCollectionByNameOrId('cobrancas')
      try {
        cob.fields.removeByName('link_pagamento')
      } catch (_) {
        /* campo já ausente */
      }
      app.save(cob)
    }
    if (app.hasTable('fila_whatsapp')) {
      const fila = app.findCollectionByNameOrId('fila_whatsapp')
      try {
        fila.fields.removeByName('link_incluido')
      } catch (_) {
        /* campo já ausente */
      }
      app.save(fila)
    }
  },
)
