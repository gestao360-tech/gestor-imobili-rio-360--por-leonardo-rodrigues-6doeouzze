migrate(
  (app) => {
    const imoveisCol = app.findCollectionByNameOrId('imoveis')
    const inquilinosCol = app.findCollectionByNameOrId('inquilinos')
    const contratosCol = app.findCollectionByNameOrId('contratos')
    const cobrancasCol = app.findCollectionByNameOrId('cobrancas')

    // 9. pagamentos (histórico de baixas e parcelas)
    const pagamentos = new Collection({
      name: 'pagamentos',
      type: 'base',
      listRule: '',
      viewRule: '',
      createRule: '',
      updateRule: '',
      deleteRule: '',
      fields: [
        {
          name: 'cobranca',
          type: 'relation',
          collectionId: cobrancasCol.id,
          maxSelect: 1,
          required: true,
        },
        { name: 'data_pagamento', type: 'text', required: true },
        { name: 'valor_pago', type: 'number', required: true },
        {
          name: 'forma_pagamento',
          type: 'select',
          values: ['pix', 'boleto', 'ted_doc', 'dinheiro', 'cartao', 'outra'],
          maxSelect: 1,
          required: true,
        },
        { name: 'conta_bancaria', type: 'text' },
        { name: 'comprovante', type: 'file', maxSelect: 3, maxSize: 10485760 },
        { name: 'observacoes', type: 'text' },
        { name: 'registrado_por', type: 'text' },
        { name: 'is_demo', type: 'bool' },
        { name: 'created', type: 'autodate', onCreate: true, onUpdate: false },
        { name: 'updated', type: 'autodate', onCreate: true, onUpdate: true },
      ],
      indexes: [
        'CREATE INDEX idx_pag_cob ON pagamentos (cobranca)',
        'CREATE INDEX idx_pag_data ON pagamentos (data_pagamento)',
      ],
    })
    app.save(pagamentos)

    // 10. despesas
    const despesas = new Collection({
      name: 'despesas',
      type: 'base',
      listRule: '',
      viewRule: '',
      createRule: '',
      updateRule: '',
      deleteRule: '',
      fields: [
        {
          name: 'imovel',
          type: 'relation',
          collectionId: imoveisCol.id,
          maxSelect: 1,
          required: true,
        },
        {
          name: 'categoria',
          type: 'select',
          values: [
            'manutencao',
            'iptu',
            'condominio',
            'seguro',
            'taxa_administracao',
            'juridico',
            'reforma',
            'outras',
          ],
          maxSelect: 1,
          required: true,
        },
        { name: 'descricao', type: 'text', required: true },
        { name: 'valor', type: 'number', required: true },
        { name: 'data_vencimento', type: 'text', required: true },
        { name: 'data_pagamento', type: 'text' },
        {
          name: 'status',
          type: 'select',
          values: ['pendente', 'pago', 'cancelado'],
          maxSelect: 1,
          required: true,
        },
        { name: 'recorrente', type: 'bool' },
        { name: 'comprovante', type: 'file', maxSelect: 3, maxSize: 10485760 },
        { name: 'observacoes', type: 'text' },
        { name: 'is_demo', type: 'bool' },
        { name: 'created', type: 'autodate', onCreate: true, onUpdate: false },
        { name: 'updated', type: 'autodate', onCreate: true, onUpdate: true },
      ],
      indexes: [
        'CREATE INDEX idx_desp_imovel ON despesas (imovel)',
        'CREATE INDEX idx_desp_status ON despesas (status)',
      ],
    })
    app.save(despesas)

    // 11. caucoes_garantias
    const caucoes = new Collection({
      name: 'caucoes_garantias',
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
          name: 'tipo',
          type: 'select',
          values: [
            'caucao_dinheiro',
            'caucao_imovel',
            'fiador',
            'seguro_fianca',
            'titulo_capitalizacao',
            'outra',
          ],
          maxSelect: 1,
          required: true,
        },
        { name: 'valor', type: 'number', required: true },
        { name: 'data_deposito_emissao', type: 'text' },
        { name: 'data_validade', type: 'text' },
        { name: 'instituicao_seguradora', type: 'text' },
        { name: 'apolice_numero', type: 'text' },
        { name: 'conta_rendimento', type: 'text' },
        {
          name: 'status',
          type: 'select',
          values: ['ativa', 'devolvida', 'executada', 'vencida', 'pendente_comprovante'],
          maxSelect: 1,
          required: true,
        },
        { name: 'documento', type: 'file', maxSelect: 3, maxSize: 10485760 },
        { name: 'observacoes', type: 'text' },
        { name: 'is_demo', type: 'bool' },
        { name: 'created', type: 'autodate', onCreate: true, onUpdate: false },
        { name: 'updated', type: 'autodate', onCreate: true, onUpdate: true },
      ],
      indexes: [
        'CREATE INDEX idx_cauc_contrato ON caucoes_garantias (contrato)',
        'CREATE INDEX idx_cauc_status ON caucoes_garantias (status)',
      ],
    })
    app.save(caucoes)

    // 12. documentos
    const documentos = new Collection({
      name: 'documentos',
      type: 'base',
      listRule: '',
      viewRule: '',
      createRule: '',
      updateRule: '',
      deleteRule: '',
      fields: [
        { name: 'titulo', type: 'text', required: true },
        {
          name: 'tipo',
          type: 'select',
          values: [
            'contrato',
            'aditivo',
            'distrato',
            'recibo',
            'matricula',
            'escritura',
            'documento_pessoal',
            'comprovante_pagamento',
            'laudo_vistoria',
            'fotografia',
            'apolice',
            'notificacao',
            'outros',
          ],
          maxSelect: 1,
          required: true,
        },
        { name: 'imovel', type: 'relation', collectionId: imoveisCol.id, maxSelect: 1 },
        { name: 'inquilino', type: 'relation', collectionId: inquilinosCol.id, maxSelect: 1 },
        { name: 'contrato', type: 'relation', collectionId: contratosCol.id, maxSelect: 1 },
        { name: 'arquivo', type: 'file', maxSelect: 1, maxSize: 25165824, required: true },
        { name: 'data_documento', type: 'text' },
        { name: 'observacoes', type: 'text' },
        { name: 'is_demo', type: 'bool' },
        { name: 'created', type: 'autodate', onCreate: true, onUpdate: false },
        { name: 'updated', type: 'autodate', onCreate: true, onUpdate: true },
      ],
      indexes: [
        'CREATE INDEX idx_doc_tipo ON documentos (tipo)',
        'CREATE INDEX idx_doc_imovel ON documentos (imovel)',
      ],
    })
    app.save(documentos)

    // 13. pendencias (Central de Providências)
    const pendencias = new Collection({
      name: 'pendencias',
      type: 'base',
      listRule: '',
      viewRule: '',
      createRule: '',
      updateRule: '',
      deleteRule: '',
      fields: [
        { name: 'titulo', type: 'text', required: true },
        {
          name: 'categoria',
          type: 'select',
          values: ['contratual', 'financeira', 'documental', 'operacional'],
          maxSelect: 1,
          required: true,
        },
        {
          name: 'prioridade',
          type: 'select',
          values: ['urgente', 'alta', 'media', 'baixa'],
          maxSelect: 1,
          required: true,
        },
        {
          name: 'status',
          type: 'select',
          values: ['pendente', 'em_andamento', 'resolvida', 'cancelada'],
          maxSelect: 1,
          required: true,
        },
        { name: 'prazo', type: 'text', required: true },
        { name: 'responsavel', type: 'text', required: true },
        { name: 'imovel', type: 'relation', collectionId: imoveisCol.id, maxSelect: 1 },
        { name: 'inquilino', type: 'relation', collectionId: inquilinosCol.id, maxSelect: 1 },
        { name: 'contrato', type: 'relation', collectionId: contratosCol.id, maxSelect: 1 },
        { name: 'descricao', type: 'text', required: true },
        { name: 'solucao_registro', type: 'text' },
        { name: 'data_resolucao', type: 'text' },
        { name: 'anexos', type: 'file', maxSelect: 5, maxSize: 10485760 },
        { name: 'is_demo', type: 'bool' },
        { name: 'created', type: 'autodate', onCreate: true, onUpdate: false },
        { name: 'updated', type: 'autodate', onCreate: true, onUpdate: true },
      ],
      indexes: [
        'CREATE INDEX idx_pend_status ON pendencias (status)',
        'CREATE INDEX idx_pend_prioridade ON pendencias (prioridade)',
        'CREATE INDEX idx_pend_categoria ON pendencias (categoria)',
      ],
    })
    app.save(pendencias)

    // 14. notificacoes
    const notificacoes = new Collection({
      name: 'notificacoes',
      type: 'base',
      listRule: '',
      viewRule: '',
      createRule: '',
      updateRule: '',
      deleteRule: '',
      fields: [
        { name: 'titulo', type: 'text', required: true },
        { name: 'mensagem', type: 'text', required: true },
        {
          name: 'tipo',
          type: 'select',
          values: [
            'aluguel_vencido',
            'contrato_vencendo',
            'reajuste_previsto',
            'pendencia_documental',
            'recebimento_confirmado',
            'aviso_geral',
          ],
          maxSelect: 1,
          required: true,
        },
        {
          name: 'severidade',
          type: 'select',
          values: ['urgente', 'alerta', 'info', 'sucesso'],
          maxSelect: 1,
          required: true,
        },
        { name: 'link_destino', type: 'text' },
        { name: 'lida', type: 'bool' },
        { name: 'is_demo', type: 'bool' },
        { name: 'created', type: 'autodate', onCreate: true, onUpdate: false },
        { name: 'updated', type: 'autodate', onCreate: true, onUpdate: true },
      ],
      indexes: ['CREATE INDEX idx_notif_lida ON notificacoes (lida)'],
    })
    app.save(notificacoes)

    // 15. historico_alteracoes
    const historico = new Collection({
      name: 'historico_alteracoes',
      type: 'base',
      listRule: '',
      viewRule: '',
      createRule: '',
      updateRule: '',
      deleteRule: '',
      fields: [
        { name: 'entidade', type: 'text', required: true }, // 'contrato', 'imovel', 'cobranca', etc.
        { name: 'registro_id', type: 'text', required: true },
        {
          name: 'acao',
          type: 'select',
          values: [
            'criacao',
            'edicao',
            'exclusao',
            'baixa_pagamento',
            'reajuste',
            'renovacao',
            'aditivo',
          ],
          maxSelect: 1,
          required: true,
        },
        { name: 'usuario_nome', type: 'text' },
        { name: 'detalhes', type: 'text', required: true },
        { name: 'dados_anteriores_json', type: 'json' },
        { name: 'dados_novos_json', type: 'json' },
        { name: 'is_demo', type: 'bool' },
        { name: 'created', type: 'autodate', onCreate: true, onUpdate: false },
        { name: 'updated', type: 'autodate', onCreate: true, onUpdate: true },
      ],
      indexes: ['CREATE INDEX idx_hist_ent ON historico_alteracoes (entidade, registro_id)'],
    })
    app.save(historico)

    // 16. configuracoes
    const configuracoes = new Collection({
      name: 'configuracoes',
      type: 'base',
      listRule: '',
      viewRule: '',
      createRule: '',
      updateRule: '',
      deleteRule: '',
      fields: [
        { name: 'chave', type: 'text', required: true },
        { name: 'valor_json', type: 'json', required: true },
        { name: 'descricao', type: 'text' },
        { name: 'created', type: 'autodate', onCreate: true, onUpdate: false },
        { name: 'updated', type: 'autodate', onCreate: true, onUpdate: true },
      ],
      indexes: ['CREATE UNIQUE INDEX idx_cfg_chave ON configuracoes (chave)'],
    })
    app.save(configuracoes)
  },
  (app) => {
    try {
      app.delete(app.findCollectionByNameOrId('configuracoes'))
    } catch (_) {}
    try {
      app.delete(app.findCollectionByNameOrId('historico_alteracoes'))
    } catch (_) {}
    try {
      app.delete(app.findCollectionByNameOrId('notificacoes'))
    } catch (_) {}
    try {
      app.delete(app.findCollectionByNameOrId('pendencias'))
    } catch (_) {}
    try {
      app.delete(app.findCollectionByNameOrId('documentos'))
    } catch (_) {}
    try {
      app.delete(app.findCollectionByNameOrId('caucoes_garantias'))
    } catch (_) {}
    try {
      app.delete(app.findCollectionByNameOrId('despesas'))
    } catch (_) {}
    try {
      app.delete(app.findCollectionByNameOrId('pagamentos'))
    } catch (_) {}
  },
)
