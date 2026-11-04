/**
 * Fila de WhatsApp — cobranças e alertas de inadimplência (Gestor Imobiliário 360).
 *
 * Fluxo "Fila com confirmação": o sistema MONTA a fila (cron diário + rota de
 * varredura), o usuário revisa, edita e aprova na tela 📱 WhatsApp / Cobranças
 * e SÓ ENTÃO a mensagem sai — nada é enviado sozinho.
 *
 *  • cron diário "fila_whatsapp_gerar" (10h05 UTC): monta a fila a partir dos
 *    dados reais — (a) cobrança de aluguel X dias antes do vencimento (X da
 *    configuração, padrão 3) e (b) alerta de inadimplência (cobrança vencida
 *    sem pagamento integral), com dedupe por chave evento|cobranca_id|estagio.
 *  • GET  /backend/v1/whatsapp/config — lê configuração (categorias, dias).
 *  • POST /backend/v1/whatsapp/config — salva categorias e dias.
 *  • POST /backend/v1/whatsapp/varrer — roda a geração da fila na hora.
 *  • POST /backend/v1/whatsapp/enviar  — envia itens APROVADOS de verdade via
 *    $connectors.executeAsOwner (toolkit "whatsapp", conta do proprietário).
 *    Antes do disparo, injeta {link_pagamento} (URL da cobrança, do Stripe da
 *    conta do PROPRIETÁRIO, mesmo fluxo da rota /backend/v1/pagamentos/link):
 *    reusa o link existente ou tenta criar na confirmação — falha do Stripe
 *    NÃO bloqueia o envio (a mensagem sai sem o link e o resultado traz o
 *    aviso; fila_whatsapp.link_incluido registra se a mensagem levou o link).
 *  • POST /backend/v1/whatsapp/teste   — envio de teste para um número informado.
 *  • GET  /backend/v1/whatsapp/templates            — lista os templates.
 *  • POST /backend/v1/whatsapp/templates            — cria um template novo.
 *  • POST /backend/v1/whatsapp/templates/aplicar    — aplica um template a itens da fila.
 *  • POST /backend/v1/whatsapp/templates/restaurar  — volta o texto padrão do sistema.
 *
 * Placeholders suportados (substituídos pelos dados reais de cada item):
 *   {inquilino} {primeiro_nome} {imovel} {contrato} {competencia} {vencimento}
 *   {valor} {dias_atraso} {dias_antes_vencimento} {link_pagamento}
 * A substituição acontece SEMPRE no backend, na hora da aplicação e de novo no
 * momento do envio — o texto final (sem placeholders) é o que sai.
 *
 * O envio acontece no backend, com a conta do PROPRIETÁRIO conectada no app
 * (Conectores) — nunca OAuth manual, nunca $http para a API do WhatsApp.
 *
 * IMPORTANTE (JSVM do PocketBase): callbacks de rota/cron rodam em pools de VM
 * separados — nada de escopo top-level pode ser referenciado dentro deles.
 * Por isso TODA a lógica (helpers, normalização de telefone, geração, envio)
 * fica INLINE dentro de cada callback, sem chamadas entre callbacks.
 */

// ================= GET /backend/v1/whatsapp/config =================
routerAdd('GET', '/backend/v1/whatsapp/config', (e) => {
  const app = e.app
  const PADRAO_CATEGORIAS = { cobranca_antecipada: true, alerta_inadimplencia: true }
  const PADRAO_DIAS = { dias: 3 }

  function cfgJson(chave, padrao) {
    try {
      const bruto = app
        .findFirstRecordByData('configuracoes', 'chave', chave)
        .getString('valor_json')
      if (!bruto) return padrao
      const parsed = JSON.parse(bruto)
      if (parsed && typeof parsed === 'object' && !Array.isArray(parsed)) {
        return Object.assign({}, padrao, parsed)
      }
      return parsed === null || parsed === undefined ? padrao : parsed
    } catch (_) {
      return padrao
    }
  }

  const categorias = cfgJson('whatsapp_categorias', PADRAO_CATEGORIAS)
  const dias = cfgJson('whatsapp_dias_antes', PADRAO_DIAS)
  return e.json(200, {
    ok: true,
    categorias: {
      cobranca_antecipada: categorias.cobranca_antecipada !== false,
      alerta_inadimplencia: categorias.alerta_inadimplencia !== false,
    },
    dias_antes_vencimento: Number(dias.dias) || 3,
  })
})

// ================= POST /backend/v1/whatsapp/config (salvar) =================
routerAdd('POST', '/backend/v1/whatsapp/config', (e) => {
  const app = e.app

  function cfgSalvar(chave, valor, descricao) {
    try {
      const rec = app.findFirstRecordByData('configuracoes', 'chave', chave)
      rec.set('valor_json', JSON.stringify(valor))
      app.save(rec)
    } catch (_) {
      const rec = new Record(app.findCollectionByNameOrId('configuracoes'))
      rec.set('chave', chave)
      rec.set('valor_json', JSON.stringify(valor))
      rec.set('descricao', descricao)
      app.save(rec)
    }
  }

  const corpo = e.requestInfo().body || {}
  if (corpo.categorias && typeof corpo.categorias === 'object') {
    cfgSalvar(
      'whatsapp_categorias',
      {
        cobranca_antecipada: corpo.categorias.cobranca_antecipada !== false,
        alerta_inadimplencia: corpo.categorias.alerta_inadimplencia !== false,
      },
      'Interruptores por categoria da fila de WhatsApp',
    )
  }
  if (corpo.dias_antes_vencimento !== undefined) {
    let n = Number(corpo.dias_antes_vencimento)
    if (!isFinite(n)) n = 3
    n = Math.max(1, Math.min(30, Math.round(n)))
    cfgSalvar(
      'whatsapp_dias_antes',
      { dias: n },
      'Dias antes do vencimento para enfileirar cobrança no WhatsApp',
    )
  }
  return e.json(200, { ok: true })
})

// ================= POST /backend/v1/whatsapp/varrer (gerar fila) =================
routerAdd('POST', '/backend/v1/whatsapp/varrer', (e) => {
  const app = e.app
  const hoje = new Date()
  const p2 = (n) => String(n).padStart(2, '0')
  const hojeStr = hoje.getFullYear() + '-' + p2(hoje.getMonth() + 1) + '-' + p2(hoje.getDate())

  function cfgJson(chave, padrao) {
    try {
      const bruto = app
        .findFirstRecordByData('configuracoes', 'chave', chave)
        .getString('valor_json')
      if (!bruto) return padrao
      const parsed = JSON.parse(bruto)
      if (parsed && typeof parsed === 'object' && !Array.isArray(parsed)) {
        return Object.assign({}, padrao, parsed)
      }
      return parsed === null || parsed === undefined ? padrao : parsed
    } catch (_) {
      return padrao
    }
  }

  const categorias = cfgJson('whatsapp_categorias', {
    cobranca_antecipada: true,
    alerta_inadimplencia: true,
  })
  const cfgDias = cfgJson('whatsapp_dias_antes', { dias: 3 })
  const diasAntes = Math.max(1, Math.min(30, Number(cfgDias.dias) || 3))

  function diffDias(isoA, isoB) {
    const a = String(isoA).split('-').map(Number)
    const b = String(isoB).split('-').map(Number)
    return Math.round((Date.UTC(a[0], a[1] - 1, a[2]) - Date.UTC(b[0], b[1] - 1, b[2])) / 86400000)
  }
  function ehData(iso) {
    return /^\d{4}-\d{2}-\d{2}$/.test(String(iso || ''))
  }
  function brl(v) {
    const n = Number(v) || 0
    const s = Math.abs(n).toFixed(2)
    const partes = s.split('.')
    const inteiro = partes[0].replace(/\B(?=(\d{3})+(?!\d))/g, '.')
    return (n < 0 ? '-R$ ' : 'R$ ') + inteiro + ',' + partes[1]
  }
  function dataBR(iso) {
    if (!iso) return '—'
    const p = String(iso).split('T')[0].split('-')
    return p.length === 3 ? p[2] + '/' + p[1] + '/' + p[0] : String(iso)
  }

  // Normaliza telefone para o formato internacional (sem o "+"):
  // "(11) 97777-1234" → "5511977771234"
  function normalizarTelefone(bruto) {
    let digitos = ''
    const texto = String(bruto || '')
    for (const c of texto) if (c >= '0' && c <= '9') digitos += c
    if (!digitos) return { ok: false, motivo: 'sem número cadastrado', numero: '' }
    if (digitos.startsWith('00')) digitos = digitos.slice(2)
    if (digitos.startsWith('0') && digitos.length >= 11 && digitos.length <= 12) {
      digitos = digitos.slice(1) // "011..." → "11..."
    }
    if (digitos.length === 10 || digitos.length === 11) digitos = '55' + digitos
    if (digitos.length < 12 || digitos.length > 13) {
      return { ok: false, motivo: 'número inválido', numero: digitos }
    }
    if (digitos.length === 13 && !digitos.startsWith('55')) {
      return { ok: false, motivo: 'DDI inesperado (' + digitos.slice(0, 2) + ')', numero: digitos }
    }
    if (digitos.startsWith('55') && digitos.length === 12) {
      return {
        ok: false,
        motivo: 'faltam 9 dígitos no celular (DDD + número)',
        numero: digitos,
      }
    }
    return { ok: true, motivo: '', numero: digitos }
  }

  function nomeInquilino(id) {
    try {
      return app.findRecordById('inquilinos', id).getString('nome')
    } catch (_) {
      return ''
    }
  }
  function primeiroNome(nome) {
    return (
      String(nome || '')
        .trim()
        .split(/\s+/)[0] || 'cliente'
    )
  }
  function rotuloImovel(imovelId) {
    try {
      const im = app.findRecordById('imoveis', imovelId)
      const end = im.getString('endereco')
      const num = im.getString('numero')
      const comp = im.getString('complemento')
      const bairro = im.getString('bairro')
      let txt = (end ? end + (num ? ', ' + num : '') : '') + (comp ? ' — ' + comp : '')
      if (bairro) txt += ' (' + bairro + ')'
      return txt
    } catch (_) {
      return ''
    }
  }
  function numeroContrato(id) {
    try {
      return app.findRecordById('contratos', id).getString('numero')
    } catch (_) {
      return ''
    }
  }
  function whatsappDe(id) {
    try {
      const inq = app.findRecordById('inquilinos', id)
      const w = String(inq.getString('whatsapp') || '').trim()
      if (w) return w
      return String(inq.getString('telefone') || '').trim()
    } catch (_) {
      return ''
    }
  }
  function contatoAcordo(id) {
    try {
      const inq = app.findRecordById('inquilinos', id)
      const email = String(inq.getString('email') || '').trim()
      if (email) return 'e-mail ' + email
      return 'este canal'
    } catch (_) {
      return 'este canal'
    }
  }

  function buscar(colecao, filtro, sort) {
    try {
      return app.findRecordsByFilter(colecao, filtro, sort, 500, 0)
    } catch (err) {
      console.log('[whatsapp] erro ao consultar ' + colecao + ': ' + ((err && err.message) || err))
      return []
    }
  }

  function jaExiste(chave) {
    try {
      app.findFirstRecordByFilter('fila_whatsapp', "chave = '" + chave + "'")
      return true
    } catch (_) {
      return false
    }
  }

  function criarItem(dados) {
    const col = app.findCollectionByNameOrId('fila_whatsapp')
    const rec = new Record(col)
    rec.set('chave', dados.chave)
    rec.set('tipo', dados.tipo)
    rec.set('status', 'pendente')
    rec.set('cobranca', dados.cobranca)
    rec.set('contrato', dados.contrato)
    rec.set('imovel', dados.imovel)
    rec.set('inquilino', dados.inquilino)
    rec.set('competencia', dados.competencia)
    rec.set('vencimento', dados.vencimento)
    rec.set('valor_devido', dados.valor_devido)
    rec.set('dias_atraso', dados.dias_atraso)
    rec.set('dias_antes_vencimento', dados.dias_antes_vencimento)
    rec.set('destinatario', dados.destinatario)
    rec.set('destinatario_cadastro', dados.destinatario_cadastro)
    rec.set('telefone_ok', dados.telefone_ok)
    rec.set('mensagem', dados.mensagem)
    rec.set('estagio', dados.estagio)
    app.save(rec)
  }

  let novos = 0
  let ignorados = 0

  // (a) COBRANÇA DE ALUGUEL — X dias antes do vencimento
  if (categorias.cobranca_antecipada !== false) {
    for (const cob of buscar('cobrancas', "status = 'a_vencer'", 'vencimento')) {
      const venc = cob.getString('vencimento')
      if (!ehData(venc)) continue
      const dif = diffDias(venc, hojeStr)
      if (dif < 0 || dif > diasAntes) continue
      const total = cob.getFloat('valor_total') || 0
      const pago = cob.getFloat('valor_pago') || 0
      const saldo = total - pago
      if (saldo <= 0.005) continue
      const chave = 'cobranca_antecipada|' + cob.id + '|' + diasAntes + 'd_antes'
      if (jaExiste(chave)) {
        ignorados++
        continue
      }
      const imovelId = cob.getString('imovel')
      const inqId = cob.getString('inquilino')
      const contratoId = cob.getString('contrato')
      const nome = nomeInquilino(inqId)
      const imovelTxt = rotuloImovel(imovelId) || 'imóvel'
      const telBruto = whatsappDe(inqId)
      const tel = normalizarTelefone(telBruto)
      const mensagem =
        'Olá, ' +
        primeiroNome(nome) +
        '! Tudo bem?\n\n' +
        'Passando para lembrar que o aluguel da competência ' +
        cob.getString('competencia') +
        ' vence em ' +
        dataBR(venc) +
        '.\n\n' +
        '📍 Imóvel: ' +
        imovelTxt +
        '\n' +
        '📄 Contrato: ' +
        (numeroContrato(contratoId) || '—') +
        '\n' +
        '💰 Valor: ' +
        brl(saldo) +
        '\n\n' +
        'Qualquer dúvida sobre o valor ou condições, fale com a gente por ' +
        contatoAcordo(inqId) +
        ' — estamos à disposição para ajudar.\n\n' +
        'Atenciosamente,\nGestão Imobiliária'
      try {
        criarItem({
          chave: chave,
          tipo: 'cobranca_antecipada',
          cobranca: cob.id,
          contrato: contratoId,
          imovel: imovelId,
          inquilino: inqId,
          competencia: cob.getString('competencia'),
          vencimento: venc,
          valor_devido: saldo,
          dias_atraso: 0,
          dias_antes_vencimento: dif,
          destinatario: tel.ok ? tel.numero : telBruto,
          destinatario_cadastro: telBruto,
          telefone_ok: tel.ok,
          mensagem: mensagem,
          estagio: diasAntes + 'd_antes',
        })
        novos++
      } catch (errCriar) {
        console.log(
          '[whatsapp] falha ao criar item ' +
            chave +
            ': ' +
            ((errCriar && errCriar.message) || errCriar),
        )
      }
    }
  }

  // (b) ALERTA DE INADIMPLÊNCIA — cobrança vencida sem pagamento integral
  if (categorias.alerta_inadimplencia !== false) {
    for (const cob of buscar(
      'cobrancas',
      "status = 'vencido' || status = 'pago_parcialmente'",
      '-vencimento',
    )) {
      if (cob.getString('data_pagamento')) continue
      const total = cob.getFloat('valor_total') || 0
      const pago = cob.getFloat('valor_pago') || 0
      const saldo = total - pago
      if (saldo <= 0.005) continue
      const venc = cob.getString('vencimento')
      if (!ehData(venc) || venc > hojeStr) continue
      const dias = diffDias(hojeStr, venc)
      const estagio = dias >= 30 ? '30d_vencido' : dias >= 7 ? '7d_vencido' : 'vencido'
      const chave = 'alerta_inadimplencia|' + cob.id + '|' + estagio
      if (jaExiste(chave)) {
        ignorados++
        continue
      }
      const imovelId = cob.getString('imovel')
      const inqId = cob.getString('inquilino')
      const contratoId = cob.getString('contrato')
      const nome = nomeInquilino(inqId)
      const imovelTxt = rotuloImovel(imovelId) || 'imóvel'
      const telBruto = whatsappDe(inqId)
      const tel = normalizarTelefone(telBruto)
      const mensagem =
        'Olá, ' +
        primeiroNome(nome) +
        '! Tudo bem?\n\n' +
        'Notamos que o aluguel da competência ' +
        cob.getString('competencia') +
        ', que venceu em ' +
        dataBR(venc) +
        ', segue em aberto.\n\n' +
        '📍 Imóvel: ' +
        imovelTxt +
        '\n' +
        '📄 Contrato: ' +
        (numeroContrato(contratoId) || '—') +
        '\n' +
        '💰 Valor em aberto: ' +
        brl(saldo) +
        '\n' +
        '⏰ Em atraso há ' +
        dias +
        ' dia(s)\n\n' +
        'Se o pagamento já foi feito, por favor desconsidere esta mensagem. Caso contrário, ' +
        'gostaríamos de entender o ocorrido e combinar uma forma de regularização — fale com ' +
        'a gente por ' +
        contatoAcordo(inqId) +
        '.\n\n' +
        'Atenciosamente,\nGestão Imobiliária'
      try {
        criarItem({
          chave: chave,
          tipo: 'alerta_inadimplencia',
          cobranca: cob.id,
          contrato: contratoId,
          imovel: imovelId,
          inquilino: inqId,
          competencia: cob.getString('competencia'),
          vencimento: venc,
          valor_devido: saldo,
          dias_atraso: dias,
          dias_antes_vencimento: 0,
          destinatario: tel.ok ? tel.numero : telBruto,
          destinatario_cadastro: telBruto,
          telefone_ok: tel.ok,
          mensagem: mensagem,
          estagio: estagio,
        })
        novos++
      } catch (errCriar) {
        console.log(
          '[whatsapp] falha ao criar item ' +
            chave +
            ': ' +
            ((errCriar && errCriar.message) || errCriar),
        )
      }
    }
  }

  return e.json(200, {
    ok: true,
    novos_itens: novos,
    ja_existentes: ignorados,
    dias_antes_vencimento: diasAntes,
  })
})

// ================= cron diário: geração da fila =================
cronAdd('fila_whatsapp_gerar', '5 10 * * *', () => {
  const app = $app
  const hoje = new Date()
  const p2 = (n) => String(n).padStart(2, '0')
  const hojeStr = hoje.getFullYear() + '-' + p2(hoje.getMonth() + 1) + '-' + p2(hoje.getDate())

  function cfgJson(chave, padrao) {
    try {
      const bruto = app
        .findFirstRecordByData('configuracoes', 'chave', chave)
        .getString('valor_json')
      if (!bruto) return padrao
      const parsed = JSON.parse(bruto)
      if (parsed && typeof parsed === 'object' && !Array.isArray(parsed)) {
        return Object.assign({}, padrao, parsed)
      }
      return parsed === null || parsed === undefined ? padrao : parsed
    } catch (_) {
      return padrao
    }
  }

  const categorias = cfgJson('whatsapp_categorias', {
    cobranca_antecipada: true,
    alerta_inadimplencia: true,
  })
  const cfgDias = cfgJson('whatsapp_dias_antes', { dias: 3 })
  const diasAntes = Math.max(1, Math.min(30, Number(cfgDias.dias) || 3))

  function diffDias(isoA, isoB) {
    const a = String(isoA).split('-').map(Number)
    const b = String(isoB).split('-').map(Number)
    return Math.round((Date.UTC(a[0], a[1] - 1, a[2]) - Date.UTC(b[0], b[1] - 1, b[2])) / 86400000)
  }
  function ehData(iso) {
    return /^\d{4}-\d{2}-\d{2}$/.test(String(iso || ''))
  }
  function brl(v) {
    const n = Number(v) || 0
    const s = Math.abs(n).toFixed(2)
    const partes = s.split('.')
    const inteiro = partes[0].replace(/\B(?=(\d{3})+(?!\d))/g, '.')
    return (n < 0 ? '-R$ ' : 'R$ ') + inteiro + ',' + partes[1]
  }
  function dataBR(iso) {
    if (!iso) return '—'
    const p = String(iso).split('T')[0].split('-')
    return p.length === 3 ? p[2] + '/' + p[1] + '/' + p[0] : String(iso)
  }

  function normalizarTelefone(bruto) {
    let digitos = ''
    const texto = String(bruto || '')
    for (const c of texto) if (c >= '0' && c <= '9') digitos += c
    if (!digitos) return { ok: false, motivo: 'sem número cadastrado', numero: '' }
    if (digitos.startsWith('00')) digitos = digitos.slice(2)
    if (digitos.startsWith('0') && digitos.length >= 11 && digitos.length <= 12) {
      digitos = digitos.slice(1)
    }
    if (digitos.length === 10 || digitos.length === 11) digitos = '55' + digitos
    if (digitos.length < 12 || digitos.length > 13) {
      return { ok: false, motivo: 'número inválido', numero: digitos }
    }
    if (digitos.length === 13 && !digitos.startsWith('55')) {
      return { ok: false, motivo: 'DDI inesperado (' + digitos.slice(0, 2) + ')', numero: digitos }
    }
    if (digitos.startsWith('55') && digitos.length === 12) {
      return { ok: false, motivo: 'faltam 9 dígitos no celular (DDD + número)', numero: digitos }
    }
    return { ok: true, motivo: '', numero: digitos }
  }

  function nomeInquilino(id) {
    try {
      return app.findRecordById('inquilinos', id).getString('nome')
    } catch (_) {
      return ''
    }
  }
  function primeiroNome(nome) {
    return (
      String(nome || '')
        .trim()
        .split(/\s+/)[0] || 'cliente'
    )
  }
  function rotuloImovel(imovelId) {
    try {
      const im = app.findRecordById('imoveis', imovelId)
      const end = im.getString('endereco')
      const num = im.getString('numero')
      const comp = im.getString('complemento')
      const bairro = im.getString('bairro')
      let txt = (end ? end + (num ? ', ' + num : '') : '') + (comp ? ' — ' + comp : '')
      if (bairro) txt += ' (' + bairro + ')'
      return txt
    } catch (_) {
      return ''
    }
  }
  function numeroContrato(id) {
    try {
      return app.findRecordById('contratos', id).getString('numero')
    } catch (_) {
      return ''
    }
  }
  function whatsappDe(id) {
    try {
      const inq = app.findRecordById('inquilinos', id)
      const w = String(inq.getString('whatsapp') || '').trim()
      if (w) return w
      return String(inq.getString('telefone') || '').trim()
    } catch (_) {
      return ''
    }
  }
  function contatoAcordo(id) {
    try {
      const inq = app.findRecordById('inquilinos', id)
      const email = String(inq.getString('email') || '').trim()
      if (email) return 'e-mail ' + email
      return 'este canal'
    } catch (_) {
      return 'este canal'
    }
  }

  function buscar(colecao, filtro, sort) {
    try {
      return app.findRecordsByFilter(colecao, filtro, sort, 500, 0)
    } catch (err) {
      console.log('[whatsapp] erro ao consultar ' + colecao + ': ' + ((err && err.message) || err))
      return []
    }
  }

  function jaExiste(chave) {
    try {
      app.findFirstRecordByFilter('fila_whatsapp', "chave = '" + chave + "'")
      return true
    } catch (_) {
      return false
    }
  }

  function criarItem(dados) {
    const col = app.findCollectionByNameOrId('fila_whatsapp')
    const rec = new Record(col)
    rec.set('chave', dados.chave)
    rec.set('tipo', dados.tipo)
    rec.set('status', 'pendente')
    rec.set('cobranca', dados.cobranca)
    rec.set('contrato', dados.contrato)
    rec.set('imovel', dados.imovel)
    rec.set('inquilino', dados.inquilino)
    rec.set('competencia', dados.competencia)
    rec.set('vencimento', dados.vencimento)
    rec.set('valor_devido', dados.valor_devido)
    rec.set('dias_atraso', dados.dias_atraso)
    rec.set('dias_antes_vencimento', dados.dias_antes_vencimento)
    rec.set('destinatario', dados.destinatario)
    rec.set('destinatario_cadastro', dados.destinatario_cadastro)
    rec.set('telefone_ok', dados.telefone_ok)
    rec.set('mensagem', dados.mensagem)
    rec.set('estagio', dados.estagio)
    app.save(rec)
  }

  let novos = 0
  let ignorados = 0

  if (categorias.cobranca_antecipada !== false) {
    for (const cob of buscar('cobrancas', "status = 'a_vencer'", 'vencimento')) {
      const venc = cob.getString('vencimento')
      if (!ehData(venc)) continue
      const dif = diffDias(venc, hojeStr)
      if (dif < 0 || dif > diasAntes) continue
      const total = cob.getFloat('valor_total') || 0
      const pago = cob.getFloat('valor_pago') || 0
      const saldo = total - pago
      if (saldo <= 0.005) continue
      const chave = 'cobranca_antecipada|' + cob.id + '|' + diasAntes + 'd_antes'
      if (jaExiste(chave)) {
        ignorados++
        continue
      }
      const imovelId = cob.getString('imovel')
      const inqId = cob.getString('inquilino')
      const contratoId = cob.getString('contrato')
      const nome = nomeInquilino(inqId)
      const imovelTxt = rotuloImovel(imovelId) || 'imóvel'
      const telBruto = whatsappDe(inqId)
      const tel = normalizarTelefone(telBruto)
      const mensagem =
        'Olá, ' +
        primeiroNome(nome) +
        '! Tudo bem?\n\n' +
        'Passando para lembrar que o aluguel da competência ' +
        cob.getString('competencia') +
        ' vence em ' +
        dataBR(venc) +
        '.\n\n' +
        '📍 Imóvel: ' +
        imovelTxt +
        '\n' +
        '📄 Contrato: ' +
        (numeroContrato(contratoId) || '—') +
        '\n' +
        '💰 Valor: ' +
        brl(saldo) +
        '\n\n' +
        'Qualquer dúvida sobre o valor ou condições, fale com a gente por ' +
        contatoAcordo(inqId) +
        ' — estamos à disposição para ajudar.\n\n' +
        'Atenciosamente,\nGestão Imobiliária'
      try {
        criarItem({
          chave: chave,
          tipo: 'cobranca_antecipada',
          cobranca: cob.id,
          contrato: contratoId,
          imovel: imovelId,
          inquilino: inqId,
          competencia: cob.getString('competencia'),
          vencimento: venc,
          valor_devido: saldo,
          dias_atraso: 0,
          dias_antes_vencimento: dif,
          destinatario: tel.ok ? tel.numero : telBruto,
          destinatario_cadastro: telBruto,
          telefone_ok: tel.ok,
          mensagem: mensagem,
          estagio: diasAntes + 'd_antes',
        })
        novos++
      } catch (errCriar) {
        console.log(
          '[whatsapp] falha ao criar item ' +
            chave +
            ': ' +
            ((errCriar && errCriar.message) || errCriar),
        )
      }
    }
  }

  if (categorias.alerta_inadimplencia !== false) {
    for (const cob of buscar(
      'cobrancas',
      "status = 'vencido' || status = 'pago_parcialmente'",
      '-vencimento',
    )) {
      if (cob.getString('data_pagamento')) continue
      const total = cob.getFloat('valor_total') || 0
      const pago = cob.getFloat('valor_pago') || 0
      const saldo = total - pago
      if (saldo <= 0.005) continue
      const venc = cob.getString('vencimento')
      if (!ehData(venc) || venc > hojeStr) continue
      const dias = diffDias(hojeStr, venc)
      const estagio = dias >= 30 ? '30d_vencido' : dias >= 7 ? '7d_vencido' : 'vencido'
      const chave = 'alerta_inadimplencia|' + cob.id + '|' + estagio
      if (jaExiste(chave)) {
        ignorados++
        continue
      }
      const imovelId = cob.getString('imovel')
      const inqId = cob.getString('inquilino')
      const contratoId = cob.getString('contrato')
      const nome = nomeInquilino(inqId)
      const imovelTxt = rotuloImovel(imovelId) || 'imóvel'
      const telBruto = whatsappDe(inqId)
      const tel = normalizarTelefone(telBruto)
      const mensagem =
        'Olá, ' +
        primeiroNome(nome) +
        '! Tudo bem?\n\n' +
        'Notamos que o aluguel da competência ' +
        cob.getString('competencia') +
        ', que venceu em ' +
        dataBR(venc) +
        ', segue em aberto.\n\n' +
        '📍 Imóvel: ' +
        imovelTxt +
        '\n' +
        '📄 Contrato: ' +
        (numeroContrato(contratoId) || '—') +
        '\n' +
        '💰 Valor em aberto: ' +
        brl(saldo) +
        '\n' +
        '⏰ Em atraso há ' +
        dias +
        ' dia(s)\n\n' +
        'Se o pagamento já foi feito, por favor desconsidere esta mensagem. Caso contrário, ' +
        'gostaríamos de entender o ocorrido e combinar uma forma de regularização — fale com ' +
        'a gente por ' +
        contatoAcordo(inqId) +
        '.\n\n' +
        'Atenciosamente,\nGestão Imobiliária'
      try {
        criarItem({
          chave: chave,
          tipo: 'alerta_inadimplencia',
          cobranca: cob.id,
          contrato: contratoId,
          imovel: imovelId,
          inquilino: inqId,
          competencia: cob.getString('competencia'),
          vencimento: venc,
          valor_devido: saldo,
          dias_atraso: dias,
          dias_antes_vencimento: 0,
          destinatario: tel.ok ? tel.numero : telBruto,
          destinatario_cadastro: telBruto,
          telefone_ok: tel.ok,
          mensagem: mensagem,
          estagio: estagio,
        })
        novos++
      } catch (errCriar) {
        console.log(
          '[whatsapp] falha ao criar item ' +
            chave +
            ': ' +
            ((errCriar && errCriar.message) || errCriar),
        )
      }
    }
  }

  console.log(
    '[whatsapp] fila gerada: ' +
      novos +
      ' novo(s), ' +
      ignorados +
      ' já existente(s) (dias antes: ' +
      diasAntes +
      ')',
  )
})

// ================= Envio real via conector (conta do proprietário) =================
// $connectors.executeAsOwner("whatsapp", { name, params }) chama a ação do
// toolkit com a CONTA DO PROPRIETÁRIO conectada no app (número fixo dedicado).

// ================= POST /backend/v1/whatsapp/enviar =================
routerAdd('POST', '/backend/v1/whatsapp/enviar', (e) => {
  const app = e.app
  const corpo = e.requestInfo().body || {}
  const ids = Array.isArray(corpo.ids) ? corpo.ids : []

  function dataHoraBR() {
    const d = new Date()
    const p2 = (n) => String(n).padStart(2, '0')
    return (
      p2(d.getDate()) +
      '/' +
      p2(d.getMonth() + 1) +
      '/' +
      d.getFullYear() +
      ' ' +
      p2(d.getHours()) +
      ':' +
      p2(d.getMinutes())
    )
  }

  // ---- Link de pagamento (Stripe, modo owner) ----
  // Reusa cobrancas.link_pagamento quando já existe; sem link, tenta criar
  // AGORA (o item já foi aprovado pelo usuário). A MESMA lógica da rota
  // /backend/v1/pagamentos/link — falha do Stripe NÃO bloqueia o envio: a
  // mensagem sai sem o link e o resultado registra o aviso.
  function obterLink(it) {
    let cob = null
    try {
      cob = app.findRecordById('cobrancas', it.getString('cobranca'))
    } catch (_) {
      return { url: '', erro: '' }
    }
    const existente = String(cob.getString('link_pagamento') || '').trim()
    if (existente) return { url: existente, erro: '' }
    const status = cob.getString('status')
    if (status === 'pago' || status === 'cancelado' || status === 'renegociado') {
      return { url: '', erro: '' }
    }
    const total = cob.getFloat('valor_total') || 0
    const pago = cob.getFloat('valor_pago') || 0
    const saldoCentavos = Math.round((total - pago) * 100)
    if (saldoCentavos <= 0) return { url: '', erro: '' }

    function nomeInq(id) {
      try {
        return app.findRecordById('inquilinos', id).getString('nome')
      } catch (_) {
        return ''
      }
    }
    function rotuloIm(id) {
      try {
        const im = app.findRecordById('imoveis', id)
        const end = im.getString('endereco')
        const num = im.getString('numero')
        const comp = im.getString('complemento')
        let txt = end ? end + (num ? ', ' + num : '') : ''
        if (comp) txt += ' — ' + comp
        return txt
      } catch (_) {
        return ''
      }
    }
    function numContrato(id) {
      try {
        return app.findRecordById('contratos', id).getString('numero')
      } catch (_) {
        return ''
      }
    }
    function erroDo(resp) {
      try {
        if (resp && resp.error) {
          return String(
            resp.error.message ||
              resp.error.description ||
              (typeof resp.error === 'string' ? resp.error : JSON.stringify(resp.error)),
          )
        }
        if (resp && resp.successful === false) return 'a operação não foi confirmada pelo Stripe.'
      } catch (_) {
        /* segue com genérico */
      }
      return ''
    }

    const competencia = cob.getString('competencia') || '—'
    const descricao =
      'Aluguel competência ' +
      competencia +
      ' — ' +
      (rotuloIm(cob.getString('imovel')) || 'imóvel') +
      ' — ' +
      (nomeInq(cob.getString('inquilino')) || 'inquilino')
    try {
      const prod = $connectors.executeAsOwner('stripe', {
        name: 'STRIPE_CREATE_PRODUCT',
        params: {
          name: descricao,
          metadata: {
            cobranca_id: cob.id,
            competencia: competencia,
            inquilino: cob.getString('inquilino'),
            imovel: cob.getString('imovel'),
            contrato: cob.getString('contrato'),
          },
        },
      })
      let erro = erroDo(prod)
      if (erro) return { url: '', erro: erro }
      const dProd = (prod && (prod.data || prod)) || {}
      const productId = String(dProd.id || '')
      if (!productId) return { url: '', erro: 'o Stripe não retornou o id do produto.' }
      const preco = $connectors.executeAsOwner('stripe', {
        name: 'STRIPE_CREATE_PRICE',
        params: { currency: 'brl', unit_amount: saldoCentavos, product: productId },
      })
      erro = erroDo(preco)
      if (erro) return { url: '', erro: erro }
      const dPreco = (preco && (preco.data || preco)) || {}
      const priceId = String(dPreco.id || '')
      if (!priceId) return { url: '', erro: 'o Stripe não retornou o id do preço.' }
      const plink = $connectors.executeAsOwner('stripe', {
        name: 'STRIPE_CREATE_PAYMENT_LINK',
        params: {
          line_items: [{ price: priceId, quantity: 1 }],
          metadata: { cobranca_id: cob.id, competencia: competencia },
        },
      })
      erro = erroDo(plink)
      if (erro) return { url: '', erro: erro }
      const dLink = (plink && (plink.data || plink)) || {}
      const url = String(dLink.url || '')
      if (!url) return { url: '', erro: 'o Stripe não retornou a URL do link de pagamento.' }
      cob.set('link_pagamento', url)
      app.save(cob)
      console.log('[pagamentos] link criado na confirmação da fila: cobrança ' + cob.id)
      return { url: url, erro: '' }
    } catch (errStripe) {
      return { url: '', erro: String((errStripe && errStripe.message) || errStripe) }
    }
  }

  let enviados = 0
  let falhas = 0
  const detalhes = []

  for (const id of ids) {
    let item = null
    try {
      item = app.findRecordById('fila_whatsapp', String(id))
    } catch (_) {
      continue
    }
    const status = item.getString('status')
    if (status === 'enviado' || status === 'descartado') continue

    const numero = item.getString('destinatario')
    if (!numero || item.getBool('telefone_ok') === false) {
      item.set('status', 'falhado')
      item.set(
        'resultado_envio',
        'WhatsApp do inquilino inválido ou não cadastrado — preencha o número no cadastro.',
      )
      app.save(item)
      falhas++
      detalhes.push({ id: item.id, ok: false, erro: item.getString('resultado_envio') })
      continue
    }

    // ---- Link de pagamento: obtém (reusa) ou tenta criar na confirmação ----
    // Item APROVADO — o usuário já autorizou o disparo; tentar criar o link
    // agora é permitido. Falha do Stripe não bloqueia o envio.
    let avisoLink = ''
    let incluiuLink = false
    let linkUrl = ''
    let erroLink = ''
    // Itens de RECIBO (tipo recibo_aluguel) já carregam o link do PDF
    // (fila_whatsapp.link_recibo) na própria mensagem — nunca tentam criar
    // link de pagamento no Stripe no momento do disparo.
    if (item.getString('cobranca') && item.getString('tipo') !== 'recibo_aluguel') {
      const resLink = obterLink(item)
      linkUrl = resLink.url
      erroLink = resLink.erro
      if (linkUrl) incluiuLink = true
      if (erroLink) {
        avisoLink = 'Link de pagamento não incluído (' + erroLink + ')'
        console.log('[whatsapp] envio ' + item.id + ' sem link: ' + erroLink)
      }
    }

    // Substituição de placeholders no momento do disparo: se o texto ainda tem
    // {placeholder} e o item tem template, renderiza AQUI com os dados reais —
    // nunca sai um "{inquilino}" para o destinatário. Texto editado manualmente
    // (sem placeholders) é enviado como está — a edição manual é a que vale.
    // {link_pagamento} é substituído SEMPRE, com template ou sem; mensagens
    // antigas sem o placeholder ganham a linha "Pague online" no fim quando há
    // link; sem link, a linha "Pague online" vazia é removida do texto.
    const textoOriginal = item.getString('mensagem')
    let texto = textoOriginal.split('{link_pagamento}').join(linkUrl || '')
    if (linkUrl && texto.indexOf('💳 Pague online:') === -1) {
      texto = texto + '\n\n💳 Pague online: ' + linkUrl
    }
    if (textoOriginal.indexOf('{link_pagamento}') !== -1 && !linkUrl) {
      texto = texto.replace(/💳 Pague online:\s*(?=\n|$)/g, '')
    }
    texto = texto.replace(/\n{3,}/g, '\n\n')
    if (/\{[a-zA-Z_]+\}/.test(texto)) {
      const tplId = item.getString('template')
      if (tplId) {
        try {
          const tpl = app.findRecordById('fila_whatsapp_templates', tplId)
          texto = (function (tplTexto, it) {
            function brl(v) {
              const n = Number(v) || 0
              const s = Math.abs(n).toFixed(2)
              const partes = s.split('.')
              const inteiro = partes[0].replace(/\B(?=(\d{3})+(?!\d))/g, '.')
              return (n < 0 ? '-R$ ' : 'R$ ') + inteiro + ',' + partes[1]
            }
            function dataBR(iso) {
              if (!iso) return '—'
              const p = String(iso).split('T')[0].split('-')
              return p.length === 3 ? p[2] + '/' + p[1] + '/' + p[0] : String(iso)
            }
            function nomeInq(id) {
              try {
                return app.findRecordById('inquilinos', id).getString('nome')
              } catch (_) {
                return ''
              }
            }
            function rotuloIm(id) {
              try {
                const im = app.findRecordById('imoveis', id)
                const end = im.getString('endereco')
                const num = im.getString('numero')
                const comp = im.getString('complemento')
                const bairro = im.getString('bairro')
                let txt = (end ? end + (num ? ', ' + num : '') : '') + (comp ? ' — ' + comp : '')
                if (bairro) txt += ' (' + bairro + ')'
                return txt
              } catch (_) {
                return ''
              }
            }
            function numContrato(id) {
              try {
                return app.findRecordById('contratos', id).getString('numero')
              } catch (_) {
                return ''
              }
            }
            const nome = nomeInq(it.getString('inquilino'))
            const vars = {
              '{inquilino}': nome || 'cliente',
              '{primeiro_nome}': String(nome || 'cliente')
                .trim()
                .split(/\s+/)[0],
              '{imovel}': rotuloIm(it.getString('imovel')) || 'imóvel',
              '{contrato}': numContrato(it.getString('contrato')) || '—',
              '{competencia}': it.getString('competencia') || '—',
              '{vencimento}': dataBR(it.getString('vencimento')),
              '{valor}': brl(it.getFloat('valor_devido') || 0),
              '{dias_atraso}': String(Math.max(0, it.getInt('dias_atraso') || 0)),
              '{dias_antes_vencimento}': String(
                Math.max(0, it.getInt('dias_antes_vencimento') || 0),
              ),
              '{link_pagamento}': linkUrl || '',
            }
            let t = String(tplTexto || '')
            for (const k in vars) t = t.split(k).join(vars[k])
            // Mensagens antigas sem o placeholder ganham a linha do link no fim;
            // sem link, a linha "Pague online" vazia é removida.
            if (linkUrl && t.indexOf('💳 Pague online:') === -1) {
              t = t + '\n\n💳 Pague online: ' + linkUrl
            }
            t = t.replace(/💳 Pague online:\s*(?=\n|$)/g, '')
            t = t.replace(/\n{3,}/g, '\n\n')
            return t
          })(tpl.getString('texto'), item)
          item.set('mensagem', texto)
        } catch (_) {
          // sem template resolvível — envia o texto como está
        }
      }
    }

    try {
      const resp = $connectors.executeAsOwner('whatsapp', {
        name: 'WHATSAPP_SEND_MESSAGE',
        params: {
          text: texto,
          to_number: numero,
          phone_number_id: '',
        },
      })
      let erro = ''
      try {
        if (resp && resp.error) {
          erro = String(
            resp.error.message ||
              resp.error.description ||
              (typeof resp.error === 'string' ? resp.error : JSON.stringify(resp.error)),
          )
        }
        if (!erro && resp && resp.successful === false) {
          erro = 'O conector WhatsApp não confirmou o envio.'
        }
      } catch (errParse) {
        erro = 'Resposta inesperada do conector: ' + ((errParse && errParse.message) || errParse)
      }
      if (erro) {
        item.set('status', 'falhado')
        item.set('link_incluido', incluiuLink)
        item.set('resultado_envio', avisoLink ? erro + ' — ' + avisoLink : erro)
        app.save(item)
        falhas++
        detalhes.push({ id: item.id, ok: false, erro: erro, aviso: avisoLink })
      } else {
        item.set('status', 'enviado')
        item.set('enviado_em', new Date().toISOString().replace('T', ' '))
        item.set('mensagem_enviada', texto) // cópia exata do que saiu (histórico)
        item.set('link_incluido', incluiuLink)
        item.set(
          'resultado_envio',
          avisoLink
            ? 'Mensagem enviada em ' + dataHoraBR() + ' — ' + avisoLink + '.'
            : 'Mensagem enviada em ' + dataHoraBR() + '.',
        )
        item.set('enviado_via', 'WhatsApp (conector)')
        app.save(item)
        enviados++
        detalhes.push({
          id: item.id,
          ok: true,
          aviso: avisoLink,
          com_link: incluiuLink,
        })
      }
    } catch (err) {
      const msgErro = String((err && err.message) || err)
      item.set('status', 'falhado')
      item.set('link_incluido', incluiuLink)
      item.set('resultado_envio', msgErro)
      app.save(item)
      falhas++
      detalhes.push({ id: item.id, ok: false, erro: msgErro })
    }
  }

  return e.json(200, { ok: falhas === 0, enviados: enviados, falhas: falhas, detalhes: detalhes })
})

// ================= Templates de mensagem (fila_whatsapp_templates) =================
// Os textos padrão ficam INLINE dentro do callback que os usa (escopo top-level
// não é compartilhado entre os pools de VM da JSVM do PocketBase).

// ---- GET /backend/v1/whatsapp/templates — lista todos os templates ----
routerAdd('GET', '/backend/v1/whatsapp/templates', (e) => {
  const app = e.app
  const registros = app.findRecordsByFilter('fila_whatsapp_templates', '', '-created', 200, 0)
  const templates = registros.map((t) => ({
    id: t.id,
    nome: t.getString('nome'),
    categoria: t.getString('categoria'),
    texto: t.getString('texto'),
    padrao: t.getBool('padrao'),
    ativo: t.getBool('ativo'),
    created: t.getString('created'),
    updated: t.getString('updated'),
  }))
  return e.json(200, { ok: true, templates: templates })
})

// ---- POST /backend/v1/whatsapp/templates — cria um template novo ----
routerAdd('POST', '/backend/v1/whatsapp/templates', (e) => {
  const app = e.app
  const corpo = e.requestInfo().body || {}
  const nome = String(corpo.nome || '').trim()
  const categoria = String(corpo.categoria || '').trim()
  const texto = String(corpo.texto || '')
  if (!nome || nome.length < 2) {
    return e.json(400, { ok: false, erro: 'Informe um nome para o template (mín. 2 letras).' })
  }
  if (categoria !== 'cobranca_antecipada' && categoria !== 'alerta_inadimplencia') {
    return e.json(400, { ok: false, erro: 'Categoria inválida.' })
  }
  if (!texto.trim()) {
    return e.json(400, { ok: false, erro: 'O texto do template não pode ficar vazio.' })
  }
  if (texto.length > 4000) {
    return e.json(400, { ok: false, erro: 'Texto muito longo (máx. 4000 caracteres).' })
  }
  try {
    app.findFirstRecordByFilter(
      'fila_whatsapp_templates',
      "nome ~ '" + nome.replace(/'/g, "\\'") + "'",
    )
    return e.json(400, {
      ok: false,
      erro: 'Já existe um template com esse nome — escolha outro.',
    })
  } catch (_) {
    // nome livre — segue
  }
  const col = app.findCollectionByNameOrId('fila_whatsapp_templates')
  const rec = new Record(col)
  rec.set('nome', nome)
  rec.set('categoria', categoria)
  rec.set('texto', texto)
  rec.set('padrao', false)
  rec.set('ativo', true)
  app.save(rec)
  return e.json(200, { ok: true, id: rec.id })
})

// ---- POST /backend/v1/whatsapp/templates/aplicar — aplica template a itens da fila ----
// Corpo: { itens: [ids], template_id } — cada item recebe o template e a mensagem
// re-renderizada na hora, com os dados reais do item.
routerAdd('POST', '/backend/v1/whatsapp/templates/aplicar', (e) => {
  const app = e.app
  const corpo = e.requestInfo().body || {}
  const ids = Array.isArray(corpo.itens) ? corpo.itens : []
  const templateId = String(corpo.template_id || '')

  function brl(v) {
    const n = Number(v) || 0
    const s = Math.abs(n).toFixed(2)
    const partes = s.split('.')
    const inteiro = partes[0].replace(/\B(?=(\d{3})+(?!\d))/g, '.')
    return (n < 0 ? '-R$ ' : 'R$ ') + inteiro + ',' + partes[1]
  }
  function dataBR(iso) {
    if (!iso) return '—'
    const p = String(iso).split('T')[0].split('-')
    return p.length === 3 ? p[2] + '/' + p[1] + '/' + p[0] : String(iso)
  }
  function nomeInq(id) {
    try {
      return app.findRecordById('inquilinos', id).getString('nome')
    } catch (_) {
      return ''
    }
  }
  function rotuloIm(id) {
    try {
      const im = app.findRecordById('imoveis', id)
      const end = im.getString('endereco')
      const num = im.getString('numero')
      const comp = im.getString('complemento')
      const bairro = im.getString('bairro')
      let txt = (end ? end + (num ? ', ' + num : '') : '') + (comp ? ' — ' + comp : '')
      if (bairro) txt += ' (' + bairro + ')'
      return txt
    } catch (_) {
      return ''
    }
  }
  function numContrato(id) {
    try {
      return app.findRecordById('contratos', id).getString('numero')
    } catch (_) {
      return ''
    }
  }

  let template = null
  try {
    template = app.findRecordById('fila_whatsapp_templates', templateId)
  } catch (_) {
    return e.json(400, { ok: false, erro: 'Template não encontrado.' })
  }
  const textoTpl = template.getString('texto')

  let aplicados = 0
  let ignorados = 0
  const erros = []

  for (const id of ids) {
    let item = null
    try {
      item = app.findRecordById('fila_whatsapp', String(id))
    } catch (_) {
      ignorados++
      continue
    }
    // Só itens que ainda podem ser editados: nunca mexe em enviado/descartado.
    const status = item.getString('status')
    if (status === 'enviado' || status === 'descartado') {
      ignorados++
      continue
    }
    try {
      const nome = nomeInq(item.getString('inquilino'))
      const vars = {
        '{inquilino}': nome || 'cliente',
        '{primeiro_nome}': String(nome || 'cliente')
          .trim()
          .split(/\s+/)[0],
        '{imovel}': rotuloIm(item.getString('imovel')) || 'imóvel',
        '{contrato}': numContrato(item.getString('contrato')) || '—',
        '{competencia}': item.getString('competencia') || '—',
        '{vencimento}': dataBR(item.getString('vencimento')),
        '{valor}': brl(item.getFloat('valor_devido') || 0),
        '{dias_atraso}': String(Math.max(0, item.getInt('dias_atraso') || 0)),
        '{dias_antes_vencimento}': String(Math.max(0, item.getInt('dias_antes_vencimento') || 0)),
      }
      let t = String(textoTpl || '')
      for (const k in vars) t = t.split(k).join(vars[k])
      item.set('template', templateId)
      item.set('mensagem', t)
      app.save(item)
      aplicados++
    } catch (errItem) {
      erros.push(String((errItem && errItem.message) || errItem))
    }
  }

  return e.json(200, {
    ok: erros.length === 0,
    aplicados: aplicados,
    ignorados: ignorados,
    erros: erros,
  })
})

// ---- POST /backend/v1/whatsapp/templates/restaurar — volta ao texto padrão ----
// Corpo: { id } do template. Só vale para templates marcados como padrão do
// sistema (padrao = true); regrava o texto com o padrão da migração 0011.
routerAdd('POST', '/backend/v1/whatsapp/templates/restaurar', (e) => {
  const app = e.app
  const corpo = e.requestInfo().body || {}
  const id = String(corpo.id || '')

  let rec = null
  try {
    rec = app.findRecordById('fila_whatsapp_templates', id)
  } catch (_) {
    return e.json(404, { ok: false, erro: 'Template não encontrado.' })
  }
  if (!rec.getBool('padrao')) {
    return e.json(400, { ok: false, erro: 'Só templates padrão do sistema podem ser restaurados.' })
  }
  const categoria = rec.getString('categoria')
  // Textos padrão INLINE (exatamente os da migração 0011, para o "restaurar padrão").
  const PADRAO_COBRANCA = [
    'Olá, {inquilino}! Tudo bem?',
    '',
    'Passando para lembrar que o aluguel da competência {competencia} vence em {vencimento}.',
    '',
    '📍 Imóvel: {imovel}',
    '💰 Valor: {valor}',
    '',
    'Qualquer dúvida sobre o valor ou condições, estamos à disposição para ajudar.',
    '',
    'Atenciosamente,',
    'Gestão Imobiliária',
  ].join('\n')
  const PADRAO_INADIMPLENCIA = [
    'Olá, {inquilino}! Tudo bem?',
    '',
    'Notamos que o aluguel da competência {competencia}, que venceu em {vencimento}, segue em aberto.',
    '',
    '📍 Imóvel: {imovel}',
    '💰 Valor em aberto: {valor}',
    '⏰ Em atraso há {dias_atraso} dia(s)',
    '',
    'Se o pagamento já foi feito, por favor desconsidere esta mensagem. Caso contrário,',
    'gostaríamos de entender o ocorrido e combinar uma forma de regularização.',
    '',
    'Atenciosamente,',
    'Gestão Imobiliária',
  ].join('\n')
  const padrao = categoria === 'cobranca_antecipada' ? PADRAO_COBRANCA : PADRAO_INADIMPLENCIA
  rec.set('texto', padrao)
  app.save(rec)
  return e.json(200, { ok: true, texto: padrao })
})

// ================= POST /backend/v1/whatsapp/teste =================
routerAdd('POST', '/backend/v1/whatsapp/teste', (e) => {
  const app = e.app
  const corpo = e.requestInfo().body || {}
  const numeroInformado = String(corpo.numero || '').trim()

  // Normaliza o número informado (DDI/DDD) antes de enviar.
  let digitos = ''
  for (const c of numeroInformado) if (c >= '0' && c <= '9') digitos += c
  let motivo = ''
  if (!digitos) motivo = 'sem número'
  if (!motivo && digitos.startsWith('00')) digitos = digitos.slice(2)
  if (!motivo && digitos.startsWith('0') && digitos.length >= 11 && digitos.length <= 12) {
    digitos = digitos.slice(1)
  }
  if (!motivo && (digitos.length === 10 || digitos.length === 11)) digitos = '55' + digitos
  if (!motivo && (digitos.length < 12 || digitos.length > 13)) motivo = 'número inválido'
  if (!motivo && digitos.length === 13 && !digitos.startsWith('55')) {
    motivo = 'DDI inesperado (' + digitos.slice(0, 2) + ')'
  }
  if (!motivo && digitos.startsWith('55') && digitos.length === 12) {
    motivo = 'faltam 9 dígitos no celular (DDD + número)'
  }
  if (motivo) {
    return e.json(400, {
      ok: false,
      erro: 'Número inválido: ' + motivo,
      numero_normalizado: digitos,
    })
  }

  const agora = new Date()
  const p2 = (n) => String(n).padStart(2, '0')
  const quando =
    p2(agora.getDate()) +
    '/' +
    p2(agora.getMonth() + 1) +
    '/' +
    agora.getFullYear() +
    ' ' +
    p2(agora.getHours()) +
    ':' +
    p2(agora.getMinutes())

  const texto =
    'Olá! Esta é uma mensagem de TESTE do Gestor Imobiliário 360, enviada em ' +
    quando +
    '.\n\nSe você recebeu esta mensagem, o envio de cobranças por WhatsApp está funcionando.\n\nAtenciosamente,\nGestão Imobiliária'

  function registrarTeste(registro) {
    try {
      const rec = app.findFirstRecordByData('configuracoes', 'chave', 'whatsapp_teste')
      rec.set('valor_json', JSON.stringify(registro))
      app.save(rec)
    } catch (_) {
      const rec = new Record(app.findCollectionByNameOrId('configuracoes'))
      rec.set('chave', 'whatsapp_teste')
      rec.set('valor_json', JSON.stringify(registro))
      rec.set('descricao', 'Registro do último envio de teste da fila de WhatsApp')
      app.save(rec)
    }
  }

  try {
    const resp = $connectors.executeAsOwner('whatsapp', {
      name: 'WHATSAPP_SEND_MESSAGE',
      params: { text: texto, to_number: digitos, phone_number_id: '' },
    })
    let erro = ''
    try {
      if (resp && resp.error) {
        erro = String(
          resp.error.message ||
            resp.error.description ||
            (typeof resp.error === 'string' ? resp.error : JSON.stringify(resp.error)),
        )
      }
      if (!erro && resp && resp.successful === false) {
        erro = 'O conector WhatsApp não confirmou o envio.'
      }
    } catch (errParse) {
      erro = 'Resposta inesperada do conector: ' + ((errParse && errParse.message) || errParse)
    }
    if (erro) {
      registrarTeste({ executado_em: quando, numero: digitos, sucesso: false, resultado: erro })
      return e.json(502, { ok: false, erro: erro, numero_normalizado: digitos })
    }
    registrarTeste({
      executado_em: quando,
      numero: digitos,
      sucesso: true,
      resultado: 'Mensagem de teste enviada com sucesso.',
    })
    return e.json(200, {
      ok: true,
      numero_normalizado: digitos,
      resultado: 'Mensagem de teste enviada com sucesso.',
    })
  } catch (err) {
    const msgErro = String((err && err.message) || err)
    registrarTeste({ executado_em: quando, numero: digitos, sucesso: false, resultado: msgErro })
    return e.json(502, { ok: false, erro: msgErro, numero_normalizado: digitos })
  }
})
