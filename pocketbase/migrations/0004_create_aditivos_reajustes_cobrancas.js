migrate(
  (app) => {
    const imoveisCol = app.findCollectionByNameOrId('imoveis')
    const inquilinosCol = app.findCollectionByNameOrId('inquilinos')
    const contratosCol = app.findCollectionByNameOrId('contratos')

    // 5. aditivos
    const aditivos = new Collection({
      name: 'aditivos',
      type: 'base',
      listRule: '',
      viewRule: '',
      createRule: '',
      updateRule: '',
      deleteRule: '',
      fields: [
        {
          name: 'contrato',
          type: 'relation',
          collectionId: contratosCol.id,
          maxSelect: 1,
          required: true,
        },
        { name: 'numero_sequencial', type: 'number', required: true },
        { name: 'data_aditivo', type: 'text', required: true },
        {
          name: 'tipo_alteracao',
          type: 'select',
          values: ['valor', 'prazo', 'garantia', 'clausula', 'outros'],
          maxSelect: 1,
          required: true,
        },
        { name: 'descricao', type: 'text', required: true },
        { name: 'valor_anterior', type: 'number' },
        { name: 'valor_novo', type: 'number' },
        { name: 'data_fim_anterior', type: 'text' },
        { name: 'data_fim_nova', type: 'text' },
        { name: 'documento', type: 'file', maxSelect: 3, maxSize: 10485760 },
        {
          name: 'status',
          type: 'select',
          values: ['pendente_assinatura', 'assinado', 'cancelado'],
          maxSelect: 1,
          required: true,
        },
        { name: 'is_demo', type: 'bool' },
        { name: 'created', type: 'autodate', onCreate: true, onUpdate: false },
        { name: 'updated', type: 'autodate', onCreate: true, onUpdate: true },
      ],
      indexes: ['CREATE INDEX idx_adit_contrato ON aditivos (contrato)'],
    })
    app.save(aditivos)

    // 6. reajustes
    const reajustes = new Collection({
      name: 'reajustes',
      type: 'base',
      listRule: '',
      viewRule: '',
      createRule: '',
      updateRule: '',
      deleteRule: '',
      fields: [
        {
          name: 'contrato',
          type: 'relation',
          collectionId: contratosCol.id,
          maxSelect: 1,
          required: true,
        },
        { name: 'data_base', type: 'text', required: true },
        { name: 'periodo_apuracao', type: 'text' },
        { name: 'indice', type: 'text', required: true },
        { name: 'percentual_aplicavel', type: 'number', required: true },
        {
          name: 'tipo_indice',
          type: 'select',
          values: ['estimado', 'definitivo'],
          maxSelect: 1,
          required: true,
        },
        { name: 'aluguel_anterior', type: 'number', required: true },
        { name: 'aluguel_novo_projetado', type: 'number', required: true },
        { name: 'aluguel_novo_aprovado', type: 'number' },
        { name: 'diferenca_mensal', type: 'number' },
        { name: 'diferenca_anual', type: 'number' },
        { name: 'data_aplicacao', type: 'text', required: true },
        {
          name: 'status',
          type: 'select',
          values: [
            'aguardando_aprovacao',
            'aprovado',
            'em_negociacao',
            'nao_aplicado',
            'rejeitado',
          ],
          maxSelect: 1,
          required: true,
        },
        { name: 'observacao_negociacao', type: 'text' },
        { name: 'aprovado_por', type: 'text' },
        { name: 'data_aprovacao', type: 'text' },
        { name: 'is_demo', type: 'bool' },
        { name: 'created', type: 'autodate', onCreate: true, onUpdate: false },
        { name: 'updated', type: 'autodate', onCreate: true, onUpdate: true },
      ],
      indexes: [
        'CREATE INDEX idx_reajustes_contrato ON reajustes (contrato)',
        'CREATE INDEX idx_reajustes_status ON reajustes (status)',
      ],
    })
    app.save(reajustes)

    // 7. renovacoes
    const renovacoes = new Collection({
      name: 'renovacoes',
      type: 'base',
      listRule: '',
      viewRule: '',
      createRule: '',
      updateRule: '',
      deleteRule: '',
      fields: [
        {
          name: 'contrato',
          type: 'relation',
          collectionId: contratosCol.id,
          maxSelect: 1,
          required: true,
        },
        { name: 'dias_restantes', type: 'number' },
        {
          name: 'alerta_faixa',
          type: 'select',
          values: ['120_dias', '90_dias', '60_dias', '30_dias', '15_dias', '7_dias', 'vencido'],
          maxSelect: 1,
        },
        {
          name: 'status',
          type: 'select',
          values: [
            'pendente',
            'em_negociacao',
            'renovado',
            'prorrogado_legal',
            'distratado',
            'resolvido',
          ],
          maxSelect: 1,
          required: true,
        },
        { name: 'proposta_novo_valor', type: 'number' },
        { name: 'proposta_novo_prazo_meses', type: 'number' },
        { name: 'historico_negociacao', type: 'text' },
        { name: 'data_resolucao', type: 'text' },
        { name: 'is_demo', type: 'bool' },
        { name: 'created', type: 'autodate', onCreate: true, onUpdate: false },
        { name: 'updated', type: 'autodate', onCreate: true, onUpdate: true },
      ],
      indexes: [
        'CREATE INDEX idx_renovacoes_contrato ON renovacoes (contrato)',
        'CREATE INDEX idx_renovacoes_status ON renovacoes (status)',
      ],
    })
    app.save(renovacoes)

    // 8. cobrancas
    const cobrancas = new Collection({
      name: 'cobrancas',
      type: 'base',
      listRule: '',
      viewRule: '',
      createRule: '',
      updateRule: '',
      deleteRule: '',
      fields: [
        {
          name: 'contrato',
          type: 'relation',
          collectionId: contratosCol.id,
          maxSelect: 1,
          required: true,
        },
        {
          name: 'imovel',
          type: 'relation',
          collectionId: imoveisCol.id,
          maxSelect: 1,
          required: true,
        },
        {
          name: 'inquilino',
          type: 'relation',
          collectionId: inquilinosCol.id,
          maxSelect: 1,
          required: true,
        },
        { name: 'competencia', type: 'text', required: true }, // "YYYY-MM"
        { name: 'vencimento', type: 'text', required: true }, // "YYYY-MM-DD"
        { name: 'valor_aluguel', type: 'number', required: true },
        { name: 'valor_desconto', type: 'number' },
        { name: 'valor_acrescimo', type: 'number' },
        { name: 'valor_multa', type: 'number' },
        { name: 'valor_juros', type: 'number' },
        { name: 'valor_iptu', type: 'number' },
        { name: 'valor_condominio', type: 'number' },
        { name: 'outras_cobrancas', type: 'number' },
        { name: 'valor_total', type: 'number', required: true },
        { name: 'valor_pago', type: 'number' },
        { name: 'data_pagamento', type: 'text' },
        {
          name: 'forma_pagamento',
          type: 'select',
          values: ['pix', 'boleto', 'ted_doc', 'dinheiro', 'cartao', 'outra'],
          maxSelect: 1,
        },
        { name: 'conta_bancaria', type: 'text' },
        {
          name: 'status',
          type: 'select',
          values: [
            'a_vencer',
            'pago',
            'pago_parcialmente',
            'vencido',
            'em_negociacao',
            'renegociado',
            'cancelado',
          ],
          maxSelect: 1,
          required: true,
        },
        { name: 'observacoes', type: 'text' },
        { name: 'recibo_gerado', type: 'text' },
        { name: 'is_demo', type: 'bool' },
        { name: 'created', type: 'autodate', onCreate: true, onUpdate: false },
        { name: 'updated', type: 'autodate', onCreate: true, onUpdate: true },
      ],
      indexes: [
        'CREATE INDEX idx_cob_contrato ON cobrancas (contrato)',
        'CREATE INDEX idx_cob_venc ON cobrancas (vencimento)',
        'CREATE INDEX idx_cob_status ON cobrancas (status)',
        'CREATE INDEX idx_cob_comp ON cobrancas (competencia)',
      ],
    })
    app.save(cobrancas)
  },
  (app) => {
    try {
      app.delete(app.findCollectionByNameOrId('cobrancas'))
    } catch (_) {}
    try {
      app.delete(app.findCollectionByNameOrId('renovacoes'))
    } catch (_) {}
    try {
      app.delete(app.findCollectionByNameOrId('reajustes'))
    } catch (_) {}
    try {
      app.delete(app.findCollectionByNameOrId('aditivos'))
    } catch (_) {}
  },
)
