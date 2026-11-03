routerAdd('POST', '/backend/v1/ask', (e) => {
  try {
    const body = e.requestInfo().body || {}
    const message = body.message ? body.message.trim() : ''
    if (!message) {
      return e.json(400, { error: 'A mensagem é obrigatória' })
    }

    // Resolve an authenticated user or the seeded admin
    let userId = e.auth?.id
    if (!userId) {
      try {
        const admin = e.app.findAuthRecordByEmail('_pb_users_auth_', 'advmg.rodrigues@gmail.com')
        userId = admin.id
      } catch (_) {
        const firstUser = e.app.findRecordsByFilter('_pb_users_auth_', '', '-created', 1, 0)
        if (firstUser && firstUser.length > 0) {
          userId = firstUser[0].id
        }
      }
    }

    if (!userId) {
      return e.json(401, { error: 'Usuário autenticado obrigatório para o assistente IA' })
    }

    const result = $ai.agent('gestor-imobiliario-ai').chat({
      user_id: userId,
      conversation_id: body.conversation_id || null,
      message: message,
    })

    return e.json(200, {
      conversation_id: result.conversation_id,
      content: result.content,
      citations: result.citations,
      message_id: result.message_id,
      tool_calls: result.tool_calls,
    })
  } catch (err) {
    if (err instanceof SkipAiConfigError) {
      return e.json(503, {
        error: 'Inteligência Artificial temporariamente indisponível no ambiente',
      })
    }
    if (err instanceof SkipAiAgentsError) {
      const status = err.status || 500
      return e.json(status, {
        error: status >= 500 ? 'Falha na execução do agente IA' : err.message,
      })
    }
    if (err instanceof SkipAiError) {
      const status = err.status || 502
      return e.json(status, { error: status >= 500 ? 'Serviço de IA indisponível' : err.message })
    }
    return e.json(500, { error: err.message || 'Erro interno ao processar pergunta' })
  }
})

routerAdd('GET', '/backend/v1/chats', (e) => {
  try {
    let userId = e.auth?.id
    if (!userId) {
      try {
        const admin = e.app.findAuthRecordByEmail('_pb_users_auth_', 'advmg.rodrigues@gmail.com')
        userId = admin.id
      } catch (_) {}
    }
    if (!userId) return e.json(200, [])
    const limit = parseInt(e.requestInfo().query?.limit || '20', 10) || 20
    const list = $ai.agent('gestor-imobiliario-ai').listConversations({ user_id: userId, limit })
    return e.json(200, list)
  } catch (err) {
    return e.json(500, { error: err.message })
  }
})

routerAdd('GET', '/backend/v1/chats/{conversationId}/messages', (e) => {
  try {
    let userId = e.auth?.id
    if (!userId) {
      try {
        const admin = e.app.findAuthRecordByEmail('_pb_users_auth_', 'advmg.rodrigues@gmail.com')
        userId = admin.id
      } catch (_) {}
    }
    if (!userId) return e.json(401, { error: 'auth required' })

    const conversationId = e.request.pathValue('conversationId')
    const list = $ai.agent('gestor-imobiliario-ai').listMessages({
      conversation_id: conversationId,
      user_id: userId,
    })
    return e.json(200, list)
  } catch (err) {
    return e.json(500, { error: err.message })
  }
})
