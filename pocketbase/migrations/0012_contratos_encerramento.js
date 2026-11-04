// Campos de gestão de contratos que o módulo usa para encerramento e prorrogação:
// - distrato (data, motivo, entrega de chaves) — registro de encerramento por distrato
// - data_fim_anterior (data_fim original antes de renovação/prorrogação) — histórico cronológico
// Campos do briefing já existentes em contratos/aditivos/documentos não são recriados.
migrate(
  (app) => {
    const col = app.findCollectionByNameOrId('contratos')
    const novos = [
      { name: 'data_distrato', type: 'text' },
      { name: 'motivo_distrato', type: 'text', max: 2000 },
      { name: 'entrega_chaves_data', type: 'text' },
      { name: 'data_fim_anterior', type: 'text' },
    ]
    for (const { name, type, max } of novos) {
      if (col.fields.getByName(name)) continue
      if (type === 'text' && max) col.fields.add(new TextField({ name, max }))
      else col.fields.add(new TextField({ name }))
    }
    app.save(col)
  },
  (app) => {
    const col = app.findCollectionByNameOrId('contratos')
    for (const name of [
      'data_distrato',
      'motivo_distrato',
      'entrega_chaves_data',
      'data_fim_anterior',
    ]) {
      try {
        col.fields.removeByName(name)
      } catch (_) {
        /* campo já ausente */
      }
    }
    app.save(col)
  },
)
