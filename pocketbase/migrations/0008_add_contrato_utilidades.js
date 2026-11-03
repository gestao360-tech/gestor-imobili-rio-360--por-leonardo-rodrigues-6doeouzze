// Adiciona aos contratos os campos de utilidades usados pela importação de planilha
// (matrícula Copasa e instalação Cemig informadas por contrato na planilha do usuário).
migrate(
  (app) => {
    const col = app.findCollectionByNameOrId('contratos')
    if (!col.fields.getByName('matricula_copasa')) {
      col.fields.add(new TextField({ name: 'matricula_copasa', max: 80 }))
    }
    if (!col.fields.getByName('instalacao_cemig')) {
      col.fields.add(new TextField({ name: 'instalacao_cemig', max: 80 }))
    }
    app.save(col)
  },
  (app) => {
    const col = app.findCollectionByNameOrId('contratos')
    try {
      col.fields.removeByName('matricula_copasa')
    } catch (_) {
      /* campo já ausente */
    }
    try {
      col.fields.removeByName('instalacao_cemig')
    } catch (_) {
      /* campo já ausente */
    }
    app.save(col)
  },
)
