// Migração 0011 — templates de mensagem da fila de WhatsApp.
//
// 1) Coleção fila_whatsapp_templates — textos pré-definidos com placeholders
//    ({inquilino}, {imovel}, {valor}, {vencimento}, {dias_atraso}, {competencia}…),
//    substituídos pelos dados reais de cada item no momento da renderização/envio.
//    Os padrões do sistema (cobrança a vencer e alerta de inadimplência) são SEMEADOS
//    aqui de forma idempotente, sem nenhum dado real do usuário.
// 2) fila_whatsapp ganha: `template` (qual template foi usado) e
//    `mensagem_enviada` (cópia exata do texto efetivamente despachado — histórico).
//
// Relações por NOME de coleção (nunca id interno pbc_*). Down em ordem reversa.
migrate(
  (app) => {
    const idPorNome = (nome) => app.findCollectionByNameOrId(nome).id

    // ---------- 1) fila_whatsapp_templates (sem relações — primeiro) ----------
    if (!app.hasTable('fila_whatsapp_templates')) {
      const templates = new Collection({
        name: 'fila_whatsapp_templates',
        listRule: '',
        viewRule: '',
        createRule: null,
        updateRule: '',
        deleteRule: '',
        fields: [
          { name: 'nome', type: 'text', required: true, min: 2, max: 120 },
          {
            name: 'categoria',
            type: 'select',
            required: true,
            values: ['cobranca_antecipada', 'alerta_inadimplencia'],
            maxSelect: 1,
          },
          { name: 'texto', type: 'text', required: true, max: 4000 },
          // Marca os templates padrão do sistema (permite "restaurar o padrão").
          { name: 'padrao', type: 'bool' },
          { name: 'ativo', type: 'bool' },
          { name: 'is_demo', type: 'bool' },
          { name: 'created', type: 'autodate', onCreate: true, onUpdate: false },
          { name: 'updated', type: 'autodate', onCreate: true, onUpdate: true },
        ],
        indexes: [
          'CREATE UNIQUE INDEX idx_fila_wa_tpl_nome ON fila_whatsapp_templates (nome)',
          'CREATE INDEX idx_fila_wa_tpl_categoria ON fila_whatsapp_templates (categoria)',
        ],
      })
      app.save(templates)
      console.log('[0011] coleção fila_whatsapp_templates criada')
    } else {
      console.log('[0011] fila_whatsapp_templates já existe — nada a criar')
    }

    // ---------- 2) fila_whatsapp: campos template + mensagem_enviada ----------
    const fila = app.findCollectionByNameOrId('fila_whatsapp')
    if (!fila.fields.getByName('template')) {
      fila.fields.add(
        new RelationField({
          name: 'template',
          collectionId: idPorNome('fila_whatsapp_templates'),
          maxSelect: 1,
        }),
      )
      fila.addIndex('idx_fila_wa_template', false, 'template', '')
    }
    if (!fila.fields.getByName('mensagem_enviada')) {
      fila.fields.add(new TextField({ name: 'mensagem_enviada', max: 4000 }))
    }
    app.save(fila)
    console.log('[0011] fila_whatsapp: campos template + mensagem_enviada garantidos')

    // ---------- 3) Seed idempotente dos templates padrão ----------
    const PADRAO_COBRANCA = [
      'Olá, {inquilino}! Tudo bem?',
      '',
      'Passando para lembrar que o aluguel da competência {competencia} vence em {vencimento}.',
      '',
      '📍 Imóvel: {imovel}',
      '💰 Valor: {valor}',
      '',
      'Qualquer dúvida sobre o valor ou condições, estamos à disposição para ajudar.',
      '',
      'Atenciosamente,',
      'Gestão Imobiliária',
    ].join('\n')

    const PADRAO_INADIMPLENCIA = [
      'Olá, {inquilino}! Tudo bem?',
      '',
      'Notamos que o aluguel da competência {competencia}, que venceu em {vencimento}, segue em aberto.',
      '',
      '📍 Imóvel: {imovel}',
      '💰 Valor em aberto: {valor}',
      '⏰ Em atraso há {dias_atraso} dia(s)',
      '',
      'Se o pagamento já foi feito, por favor desconsidere esta mensagem. Caso contrário,',
      'gostaríamos de entender o ocorrido e combinar uma forma de regularização.',
      '',
      'Atenciosamente,',
      'Gestão Imobiliária',
    ].join('\n')

    const padroes = [
      {
        nome: 'Cobrança — aluguel a vencer',
        categoria: 'cobranca_antecipada',
        texto: PADRAO_COBRANCA,
      },
      {
        nome: 'Inadimplência — aluguel em atraso',
        categoria: 'alerta_inadimplencia',
        texto: PADRAO_INADIMPLENCIA,
      },
    ]

    for (const p of padroes) {
      try {
        app.findFirstRecordByFilter(
          'fila_whatsapp_templates',
          "nome = '" + p.nome.replace(/'/g, "\\'") + "'",
        )
        console.log('[0011] template padrão já semeado: ' + p.nome)
      } catch (_) {
        const col = app.findCollectionByNameOrId('fila_whatsapp_templates')
        const rec = new Record(col)
        rec.set('nome', p.nome)
        rec.set('categoria', p.categoria)
        rec.set('texto', p.texto)
        rec.set('padrao', true)
        rec.set('ativo', true)
        app.save(rec)
        console.log('[0011] template padrão semeado: ' + p.nome)
      }
    }
  },
  (app) => {
    // Ordem reversa: primeiro os campos adicionados em fila_whatsapp, depois a coleção.
    if (app.hasTable('fila_whatsapp')) {
      const fila = app.findCollectionByNameOrId('fila_whatsapp')
      if (fila.fields.getByName('mensagem_enviada')) {
        fila.fields.removeByName('mensagem_enviada')
      }
      if (fila.fields.getByName('template')) {
        fila.fields.removeByName('template')
      }
      app.save(fila)
    }
    if (app.hasTable('fila_whatsapp_templates')) {
      app.delete(app.findCollectionByNameOrId('fila_whatsapp_templates'))
    }
  },
)
