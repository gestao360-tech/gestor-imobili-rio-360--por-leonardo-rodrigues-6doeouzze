migrate(
  (app) => {
    // 1. proprietarios
    const proprietarios = new Collection({
      name: 'proprietarios',
      type: 'base',
      listRule: '',
      viewRule: '',
      createRule: '',
      updateRule: '',
      deleteRule: '',
      fields: [
        { name: 'tipo_pessoa', type: 'select', values: ['PF', 'PJ'], maxSelect: 1, required: true },
        { name: 'nome', type: 'text', required: true },
        { name: 'cpf_cnpj', type: 'text', required: true },
        { name: 'rg_ie', type: 'text' },
        { name: 'email', type: 'email' },
        { name: 'telefone', type: 'text' },
        { name: 'whatsapp', type: 'text' },
        { name: 'endereco', type: 'text' },
        { name: 'banco_nome', type: 'text' },
        { name: 'banco_agencia', type: 'text' },
        { name: 'banco_conta', type: 'text' },
        { name: 'banco_pix', type: 'text' },
        { name: 'observacoes', type: 'text' },
        { name: 'is_demo', type: 'bool' },
        { name: 'created', type: 'autodate', onCreate: true, onUpdate: false },
        { name: 'updated', type: 'autodate', onCreate: true, onUpdate: true },
      ],
      indexes: [
        'CREATE INDEX idx_prop_nome ON proprietarios (nome)',
        'CREATE INDEX idx_prop_cpf ON proprietarios (cpf_cnpj)',
      ],
    })
    app.save(proprietarios)

    // 2. inquilinos
    const inquilinos = new Collection({
      name: 'inquilinos',
      type: 'base',
      listRule: '',
      viewRule: '',
      createRule: '',
      updateRule: '',
      deleteRule: '',
      fields: [
        { name: 'tipo_pessoa', type: 'select', values: ['PF', 'PJ'], maxSelect: 1, required: true },
        { name: 'nome', type: 'text', required: true },
        { name: 'cpf_cnpj', type: 'text', required: true },
        { name: 'rg_ie', type: 'text' },
        { name: 'data_nasc_const', type: 'text' },
        { name: 'email', type: 'email' },
        { name: 'telefone', type: 'text' },
        { name: 'whatsapp', type: 'text' },
        { name: 'endereco', type: 'text' },
        { name: 'representante_legal', type: 'text' },
        { name: 'contato_financeiro', type: 'text' },
        { name: 'observacoes', type: 'text' },
        { name: 'is_demo', type: 'bool' },
        { name: 'created', type: 'autodate', onCreate: true, onUpdate: false },
        { name: 'updated', type: 'autodate', onCreate: true, onUpdate: true },
      ],
      indexes: [
        'CREATE INDEX idx_inq_nome ON inquilinos (nome)',
        'CREATE INDEX idx_inq_cpf ON inquilinos (cpf_cnpj)',
      ],
    })
    app.save(inquilinos)

    // 3. imoveis
    const imoveis = new Collection({
      name: 'imoveis',
      type: 'base',
      listRule: '',
      viewRule: '',
      createRule: '',
      updateRule: '',
      deleteRule: '',
      fields: [
        { name: 'codigo', type: 'text', required: true },
        { name: 'nome', type: 'text', required: true },
        {
          name: 'tipo',
          type: 'select',
          values: ['residencial', 'comercial', 'sala', 'loja', 'galpao', 'lote', 'outros'],
          maxSelect: 1,
          required: true,
        },
        {
          name: 'situacao',
          type: 'select',
          values: ['alugado', 'disponivel', 'reservado', 'em_reforma', 'inativo'],
          maxSelect: 1,
          required: true,
        },
        { name: 'endereco', type: 'text', required: true },
        { name: 'numero', type: 'text' },
        { name: 'complemento', type: 'text' },
        { name: 'bairro', type: 'text', required: true },
        { name: 'cidade', type: 'text', required: true },
        { name: 'estado', type: 'text', required: true },
        { name: 'cep', type: 'text' },
        { name: 'matricula', type: 'text' },
        { name: 'inscricao_municipal', type: 'text' },
        { name: 'area_total', type: 'number' },
        { name: 'area_construida', type: 'number' },
        { name: 'valor_estimado', type: 'number' },
        { name: 'valor_aquisicao', type: 'number' },
        { name: 'data_aquisicao', type: 'text' },
        { name: 'valor_iptu_mensal', type: 'number' },
        { name: 'valor_condominio_mensal', type: 'number' },
        { name: 'valor_seguro_mensal', type: 'number' },
        { name: 'proprietarios_json', type: 'json' }, // [{ proprietario_id, nome, percentual }]
        { name: 'fotos', type: 'file', maxSelect: 10, maxSize: 10485760 },
        { name: 'observacoes', type: 'text' },
        { name: 'is_demo', type: 'bool' },
        { name: 'created', type: 'autodate', onCreate: true, onUpdate: false },
        { name: 'updated', type: 'autodate', onCreate: true, onUpdate: true },
      ],
      indexes: [
        'CREATE UNIQUE INDEX idx_imoveis_codigo ON imoveis (codigo)',
        'CREATE INDEX idx_imoveis_situacao ON imoveis (situacao)',
        'CREATE INDEX idx_imoveis_tipo ON imoveis (tipo)',
      ],
    })
    app.save(imoveis)
  },
  (app) => {
    try {
      app.delete(app.findCollectionByNameOrId('imoveis'))
    } catch (_) {}
    try {
      app.delete(app.findCollectionByNameOrId('inquilinos'))
    } catch (_) {}
    try {
      app.delete(app.findCollectionByNameOrId('proprietarios'))
    } catch (_) {}
  },
)
