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
 *  • POST /backend/v1/whatsapp/teste   — envio de teste para um número informado.
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
    const texto = item.getString('mensagem')
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
        item.set('resultado_envio', erro)
        app.save(item)
        falhas++
        detalhes.push({ id: item.id, ok: false, erro: erro })
      } else {
        item.set('status', 'enviado')
        item.set('enviado_em', new Date().toISOString().replace('T', ' '))
        item.set('resultado_envio', 'Mensagem enviada em ' + dataHoraBR() + '.')
        item.set('enviado_via', 'WhatsApp (conector)')
        app.save(item)
        enviados++
        detalhes.push({ id: item.id, ok: true })
      }
    } catch (err) {
      const msgErro = String((err && err.message) || err)
      item.set('status', 'falhado')
      item.set('resultado_envio', msgErro)
      app.save(item)
      falhas++
      detalhes.push({ id: item.id, ok: false, erro: msgErro })
    }
  }

  return e.json(200, { ok: falhas === 0, enviados: enviados, falhas: falhas, detalhes: detalhes })
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
