// Migração 0017 — Recibo de aluguel padrão.
//
// 1) cobrancas ganha `recibo_url` (text) — URL pública do PDF do recibo
//    (arquivo gravado na coleção `documentos`, tipo 'recibo'). O número
//    sequencial continua no campo `recibo_gerado` (já existente desde a 0004).
// 2) fila_whatsapp ganha `link_recibo` (text) e o novo tipo 'recibo_aluguel'
//    (valor adicionado ao select) — item da fila com a mensagem de recibo e o
//    link do PDF, enviado (após aprovação) do número fixo do proprietário.
// 3) fila_whatsapp_templates.categoria ganha 'recibo_aluguel' e o template
//    padrão "Recibo — aluguel pago" é semeado de forma idempotente, com as
//    variáveis {inquilino}, {imovel}, {valor}, {competencia}, {data_pagamento},
//    {valor_pago} e {link_recibo}.
//
// Campos criados POR NOME, sem ids internos pbc_* (padrão das migrações 0010+).
// Nenhum dado real do usuário é embutido aqui.
migrate(
  (app) => {
    // ---------- 1) cobrancas.recibo_url ----------
    const cob = app.findCollectionByNameOrId('cobrancas')
    if (!cob.fields.getByName('recibo_url')) {
      cob.fields.add(new TextField({ name: 'recibo_url', max: 1000 }))
    }
    app.save(cob)
    console.log('[0017] cobrancas.recibo_url garantido')

    // ---------- 2) fila_whatsapp: link_recibo + tipo 'recibo_aluguel' ----------
    const fila = app.findCollectionByNameOrId('fila_whatsapp')
    if (!fila.fields.getByName('link_recibo')) {
      fila.fields.add(new TextField({ name: 'link_recibo', max: 1000 }))
    }
    const campoTipo = fila.fields.getByName('tipo')
    if (
      campoTipo &&
      Array.isArray(campoTipo.values) &&
      campoTipo.values.indexOf('recibo_aluguel') === -1
    ) {
      campoTipo.values = campoTipo.values.concat(['recibo_aluguel'])
    }
    app.save(fila)
    console.log('[0017] fila_whatsapp: link_recibo + tipo recibo_aluguel garantidos')

    // ---------- 3) templates: categoria 'recibo_aluguel' + template padrão ----------
    const tplCol = app.findCollectionByNameOrId('fila_whatsapp_templates')
    const campoCat = tplCol.fields.getByName('categoria')
    if (
      campoCat &&
      Array.isArray(campoCat.values) &&
      campoCat.values.indexOf('recibo_aluguel') === -1
    ) {
      campoCat.values = campoCat.values.concat(['recibo_aluguel'])
    }
    app.save(tplCol)

    const PADRAO_RECIBO = [
      'Olá, {inquilino}! Tudo bem?',
      '',
      'Segue o recibo de quitação do aluguel da competência {competencia}.',
      '',
      '📍 Imóvel: {imovel}',
      '💰 Valor pago: {valor_pago} (cobrança total: {valor})',
      '📅 Data do pagamento: {data_pagamento}',
      '',
      '🧾 Recibo em PDF: {link_recibo}',
      '',
      'Obrigado pela pontualidade! Qualquer dúvida, estamos à disposição.',
      '',
      'Atenciosamente,',
      'Gestão Imobiliária',
    ].join('\n')

    try {
      app.findFirstRecordByFilter('fila_whatsapp_templates', "nome = 'Recibo — aluguel pago'")
      console.log('[0017] template padrão de recibo já semeado')
    } catch (_) {
      const rec = new Record(tplCol)
      rec.set('nome', 'Recibo — aluguel pago')
      rec.set('categoria', 'recibo_aluguel')
      rec.set('texto', PADRAO_RECIBO)
      rec.set('padrao', true)
      rec.set('ativo', true)
      app.save(rec)
      console.log('[0017] template padrão semeado: Recibo — aluguel pago')
    }
  },
  (app) => {
    // Ordem reversa: template, depois valores do select, depois campos.
    try {
      const tpl = app.findFirstRecordByFilter(
        'fila_whatsapp_templates',
        "nome = 'Recibo — aluguel pago' && padrao = true",
      )
      app.delete(tpl)
    } catch (_) {
      /* template não existe */
    }
    if (app.hasTable('fila_whatsapp_templates')) {
      const tplCol = app.findCollectionByNameOrId('fila_whatsapp_templates')
      const campoCat = tplCol.fields.getByName('categoria')
      if (campoCat && Array.isArray(campoCat.values)) {
        campoCat.values = campoCat.values.filter((v) => v !== 'recibo_aluguel')
        app.save(tplCol)
      }
    }
    if (app.hasTable('fila_whatsapp')) {
      const fila = app.findCollectionByNameOrId('fila_whatsapp')
      try {
        fila.fields.removeByName('link_recibo')
      } catch (_) {
        /* campo já ausente */
      }
      const campoTipo = fila.fields.getByName('tipo')
      if (campoTipo && Array.isArray(campoTipo.values)) {
        campoTipo.values = campoTipo.values.filter((v) => v !== 'recibo_aluguel')
      }
      app.save(fila)
    }
    if (app.hasTable('cobrancas')) {
      const cob = app.findCollectionByNameOrId('cobrancas')
      try {
        cob.fields.removeByName('recibo_url')
      } catch (_) {
        /* campo já ausente */
      }
      app.save(cob)
    }
  },
)
