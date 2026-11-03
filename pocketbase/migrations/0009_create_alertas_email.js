// Migração 0009 — coleção de alertas para o canal de e-mail.
// Gera a coleção `alertas_email` que registra cada alerta gerado pela varredura
// diária (cobranças vencidas, contratos vencendo, reajustes e pendências),
// com chave única para deduplicação: o mesmo alerta nunca é recriado/reenviado.
//
// Idempotente: em banco vazio é no-op; em banco existente só cria o que falta.
migrate(
  (app) => {
    if (!app.hasTable('alertas_email')) {
      const collection = new Collection({
        name: 'alertas_email',
        listRule: '',
        viewRule: '',
        createRule: null,
        updateRule: '',
        deleteRule: '',
        fields: [
          { name: 'chave', type: 'text', required: true, min: 8, max: 300 },
          { name: 'evento', type: 'text', required: true, max: 40 },
          {
            name: 'categoria',
            type: 'select',
            required: true,
            values: ['inadimplencia', 'contratos', 'reajustes', 'pendencias', 'geral'],
            maxSelect: 1,
          },
          {
            name: 'severidade',
            type: 'select',
            required: true,
            values: ['urgente', 'alta', 'media', 'info'],
            maxSelect: 1,
          },
          { name: 'titulo', type: 'text', required: true, max: 250 },
          { name: 'mensagem', type: 'text', max: 600 },
          { name: 'ref_id', type: 'text', max: 40 },
          { name: 'ref_rotulo', type: 'text', max: 250 },
          { name: 'ref_valor', type: 'number' },
          { name: 'ref_data', type: 'text', max: 40 },
          { name: 'ref_data_fim', type: 'text', max: 40 },
          { name: 'ref_status', type: 'text', max: 60 },
          { name: 'acao', type: 'text', max: 200 },
          { name: 'email_enviado', type: 'bool' },
          { name: 'ativo', type: 'bool' },
          { name: 'is_demo', type: 'bool' },
          { name: 'created', type: 'autodate', onCreate: true, onUpdate: false },
          { name: 'updated', type: 'autodate', onCreate: true, onUpdate: true },
        ],
        indexes: [
          'CREATE UNIQUE INDEX idx_alerta_chave ON alertas_email (chave)',
          'CREATE INDEX idx_alerta_categoria ON alertas_email (categoria)',
          'CREATE INDEX idx_alerta_ativo ON alertas_email (ativo)',
        ],
      })
      app.save(collection)
      console.log('[0009] coleção alertas_email criada')
    } else {
      console.log('[0009] alertas_email já existe — nada a fazer')
    }
  },
  (app) => {
    if (app.hasTable('alertas_email')) {
      const col = app.findCollectionByNameOrId('alertas_email')
      app.delete(col)
    }
  },
)
