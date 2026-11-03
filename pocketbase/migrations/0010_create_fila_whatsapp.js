// Migração 0010 — coleções da fila de WhatsApp (cobranças e alertas de inadimplência).
//
// Duas coleções, criadas na ORDEM de dependência:
//   1) fila_whatsapp_config — preferências (categorias, dias antes, teste) — sem relações.
//   2) fila_whatsapp        — um item por mensagem, com relações a cobranças,
//                              contratos, imóveis e inquilinos (referenciadas PELO NOME,
//                              nunca por id interno pbc_*).
//
// Cada item é uma mensagem a ser revisada, aprovada e enviada pelo WhatsApp do
// proprietário (número fixo, conta conectada via conectores, modo owner). A geração
// automática é deduplicada pela chave `evento|cobranca_id|estagio` — a mesma cobrança
// nunca entra na fila duas vezes; o reenvio é sempre manual.
//
// Idempotente: em banco vazio é no-op; em banco existente só só cria o que falta.
migrate(
  (app) => {
    // A API de schema do PocketBase resolve a relação PELO NOME da coleção aqui:
    // procuramos a coleção pelo nome (nunca por id interno pbc_*) e usamos o id
    // resolvido no campo relation — portátil entre instâncias.
    const idPorNome = (nome) => app.findCollectionByNameOrId(nome).id
    // ---------- 1) fila_whatsapp_config (sem relações — primeiro) ----------
    if (!app.hasTable('fila_whatsapp_config')) {
      const cfg = new Collection({
        name: 'fila_whatsapp_config',
        listRule: '',
        viewRule: '',
        createRule: null,
        updateRule: '',
        deleteRule: '',
        fields: [
          { name: 'chave', type: 'text', required: true, min: 2, max: 100 },
          { name: 'valor_json', type: 'json', required: true, maxSize: 200000 },
          { name: 'descricao', type: 'text', max: 250 },
          { name: 'is_demo', type: 'bool' },
          { name: 'created', type: 'autodate', onCreate: true, onUpdate: false },
          { name: 'updated', type: 'autodate', onCreate: true, onUpdate: true },
        ],
        indexes: ['CREATE UNIQUE INDEX idx_fila_wa_cfg_chave ON fila_whatsapp_config (chave)'],
      })
      app.save(cfg)
      console.log('[0010] coleção fila_whatsapp_config criada')
    } else {
      console.log('[0010] fila_whatsapp_config já existe — nada a fazer')
    }

    // ---------- 2) fila_whatsapp (relações por NOME de coleção) ----------
    if (!app.hasTable('fila_whatsapp')) {
      const collection = new Collection({
        name: 'fila_whatsapp',
        listRule: '',
        viewRule: '',
        createRule: null,
        updateRule: '',
        deleteRule: '',
        fields: [
          // Deduplicação: tipo do evento | cobrança | estágio
          { name: 'chave', type: 'text', required: true, min: 8, max: 300 },
          {
            name: 'tipo',
            type: 'select',
            required: true,
            values: ['cobranca_antecipada', 'alerta_inadimplencia'],
            maxSelect: 1,
          },
          {
            name: 'status',
            type: 'select',
            required: true,
            values: ['pendente', 'aprovado', 'enviado', 'falhado', 'descartado'],
            maxSelect: 1,
          },
          {
            name: 'cobranca',
            type: 'relation',
            required: true,
            collectionId: idPorNome('cobrancas'),
            maxSelect: 1,
          },
          {
            name: 'contrato',
            type: 'relation',
            required: true,
            collectionId: idPorNome('contratos'),
            maxSelect: 1,
          },
          {
            name: 'imovel',
            type: 'relation',
            required: true,
            collectionId: idPorNome('imoveis'),
            maxSelect: 1,
          },
          {
            name: 'inquilino',
            type: 'relation',
            required: true,
            collectionId: idPorNome('inquilinos'),
            maxSelect: 1,
          },
          { name: 'competencia', type: 'text', max: 10 },
          { name: 'vencimento', type: 'text', max: 40 },
          { name: 'valor_devido', type: 'number' },
          { name: 'dias_atraso', type: 'number' },
          { name: 'dias_antes_vencimento', type: 'number' },
          { name: 'destinatario', type: 'text', max: 60 },
          // Telefone vindo do cadastro do inquilino, antes da edição na fila
          { name: 'destinatario_cadastro', type: 'text', max: 60 },
          { name: 'telefone_ok', type: 'bool' },
          { name: 'mensagem', type: 'text', required: true, max: 1000 },
          // Estágio da deduplicação (ex.: "3d_antes", "vencido")
          { name: 'estagio', type: 'text', max: 40 },
          { name: 'enviado_em', type: 'autodate', onCreate: false, onUpdate: true },
          { name: 'resultado_envio', type: 'text', max: 600 },
          { name: 'enviado_via', type: 'text', max: 60 },
          { name: 'is_demo', type: 'bool' },
          { name: 'created', type: 'autodate', onCreate: true, onUpdate: false },
          { name: 'updated', type: 'autodate', onCreate: true, onUpdate: true },
        ],
        indexes: [
          'CREATE UNIQUE INDEX idx_fila_wa_chave ON fila_whatsapp (chave)',
          'CREATE INDEX idx_fila_wa_status ON fila_whatsapp (status)',
          'CREATE INDEX idx_fila_wa_cobranca ON fila_whatsapp (cobranca)',
        ],
      })
      app.save(collection)
      console.log('[0010] coleção fila_whatsapp criada (relações por nome)')
    } else {
      console.log('[0010] fila_whatsapp já existe — nada a fazer')
    }
  },
  (app) => {
    // Ordem reversa: primeiro a que relaciona, depois a independente.
    for (const nome of ['fila_whatsapp', 'fila_whatsapp_config']) {
      if (app.hasTable(nome)) {
        app.delete(app.findCollectionByNameOrId(nome))
      }
    }
  },
)
