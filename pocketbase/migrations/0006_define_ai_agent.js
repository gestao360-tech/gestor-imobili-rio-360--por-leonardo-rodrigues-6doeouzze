migrate(
  (app) => {
    $ai.agents.define(app, {
      slug: 'gestor-imobiliario-ai',
      name: 'Assistente Imobiliário 360',
      description:
        'Assistente executivo com acesso a imóveis, contratos, inquilinos, cobranças, pendências, despesas e reajustes.',
      systemPrompt: `Você é o Assistente Executivo de Inteligência Artificial do "GESTOR IMOBILIÁRIO 360 — Gestão Patrimonial Inteligente".
Sua missão é responder com precisão, rapidez e cortesia às perguntas do administrador, proprietários e gestores sobre a carteira imobiliária.
REGRAS OBRIGATÓRIAS:
1. NUNCA invente dados. Consulte os dados reais do banco através das ferramentas disponíveis (imoveis, contratos, inquilinos, cobrancas, despesas, pendencias, reajustes, renovacoes, caucoes_garantias).
2. Apresente valores sempre formatados em Real brasileiro (ex: R$ 5.250,00) e datas em formato pt-BR (DD/MM/AAAA).
3. Quando perguntado sobre valores a receber, total recebido, atrasados, contratos a vencer, etc., responda diretamente com os números consolidados, detalhe em tabelas Markdown quando couber e informe o nome dos imóveis e inquilinos envolvidos.
4. Inclua links ou identificadores de registros para facilitar a conferência pelo gestor.
5. Se não houver registros para determinado filtro, responda claramente que não foram encontrados registros no período.`,
      tier: 'fast',
      tools: [
        { collection: 'imoveis', perms: { read: true, list: true }, actAs: 'admin' },
        { collection: 'inquilinos', perms: { read: true, list: true }, actAs: 'admin' },
        { collection: 'proprietarios', perms: { read: true, list: true }, actAs: 'admin' },
        { collection: 'contratos', perms: { read: true, list: true }, actAs: 'admin' },
        { collection: 'cobrancas', perms: { read: true, list: true }, actAs: 'admin' },
        { collection: 'pagamentos', perms: { read: true, list: true }, actAs: 'admin' },
        { collection: 'despesas', perms: { read: true, list: true }, actAs: 'admin' },
        { collection: 'reajustes', perms: { read: true, list: true }, actAs: 'admin' },
        { collection: 'renovacoes', perms: { read: true, list: true }, actAs: 'admin' },
        { collection: 'caucoes_garantias', perms: { read: true, list: true }, actAs: 'admin' },
        { collection: 'pendencias', perms: { read: true, list: true }, actAs: 'admin' },
        { collection: 'notificacoes', perms: { read: true, list: true }, actAs: 'admin' },
      ],
    })
  },
  (app) => {
    $ai.agents.delete(app, 'gestor-imobiliario-ai')
  },
)
