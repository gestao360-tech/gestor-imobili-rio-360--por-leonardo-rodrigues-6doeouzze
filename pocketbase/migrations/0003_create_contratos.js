migrate(
  (app) => {
    const imoveisCol = app.findCollectionByNameOrId('imoveis')
    const inquilinosCol = app.findCollectionByNameOrId('inquilinos')

    // 4. contratos
    const contratos = new Collection({
      name: 'contratos',
      type: 'base',
      listRule: '',
      viewRule: '',
      createRule: '',
      updateRule: '',
      deleteRule: '',
      fields: [
        { name: 'numero', type: 'text', required: true },
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
        { name: 'locador_nome', type: 'text' },
        { name: 'data_assinatura', type: 'text' },
        { name: 'data_inicio', type: 'text', required: true },
        { name: 'data_fim', type: 'text', required: true },
        { name: 'prazo_meses', type: 'number' },
        { name: 'valor_inicial', type: 'number', required: true },
        { name: 'valor_atual', type: 'number', required: true },
        { name: 'dia_vencimento', type: 'number', required: true },
        {
          name: 'periodicidade_reajuste',
          type: 'select',
          values: ['anual', 'semestral', 'bienal'],
          maxSelect: 1,
          required: true,
        },
        {
          name: 'indice_reajuste',
          type: 'select',
          values: ['IPCA', 'IGP-M', 'INPC', 'outro'],
          maxSelect: 1,
          required: true,
        },
        { name: 'data_base_reajuste', type: 'text', required: true },
        {
          name: 'garantia_tipo',
          type: 'select',
          values: ['caucao', 'fiador', 'seguro_fianca', 'titulo_capitalizacao', 'sem_garantia'],
          maxSelect: 1,
          required: true,
        },
        { name: 'garantia_detalhes', type: 'text' },
        { name: 'garantia_valor', type: 'number' },
        { name: 'multa_rescisoria_pct', type: 'number' },
        { name: 'multa_atraso_pct', type: 'number' },
        { name: 'juros_mora_mensal_pct', type: 'number' },
        { name: 'desconto_pontualidade', type: 'number' },
        { name: 'carencia_meses', type: 'number' },
        {
          name: 'responsavel_iptu',
          type: 'select',
          values: ['inquilino', 'proprietario', 'isento'],
          maxSelect: 1,
        },
        {
          name: 'responsavel_condominio',
          type: 'select',
          values: ['inquilino', 'proprietario', 'isento'],
          maxSelect: 1,
        },
        {
          name: 'responsavel_seguro',
          type: 'select',
          values: ['inquilino', 'proprietario', 'isento'],
          maxSelect: 1,
        },
        { name: 'clausulas_especiais', type: 'text' },
        { name: 'observacoes_juridicas', type: 'text' },
        { name: 'arquivo_contrato', type: 'file', maxSelect: 5, maxSize: 20971520 },
        {
          name: 'status',
          type: 'select',
          values: [
            'ativo',
            'vencendo',
            'prorrogado_legal',
            'renovado',
            'em_negociacao',
            'encerrado',
            'distratado',
          ],
          maxSelect: 1,
          required: true,
        },
        { name: 'is_demo', type: 'bool' },
        { name: 'created', type: 'autodate', onCreate: true, onUpdate: false },
        { name: 'updated', type: 'autodate', onCreate: true, onUpdate: true },
      ],
      indexes: [
        'CREATE UNIQUE INDEX idx_contratos_num ON contratos (numero)',
        'CREATE INDEX idx_contratos_imovel ON contratos (imovel)',
        'CREATE INDEX idx_contratos_inquilino ON contratos (inquilino)',
        'CREATE INDEX idx_contratos_status ON contratos (status)',
      ],
    })
    app.save(contratos)
  },
  (app) => {
    try {
      app.delete(app.findCollectionByNameOrId('contratos'))
    } catch (_) {}
  },
)
