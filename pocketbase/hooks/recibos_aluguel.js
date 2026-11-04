// 🧾 Recibo de aluguel — dados, registro do PDF e item na fila de WhatsApp.
//
// Rotas (consumidas por src/services/recibos.ts):
//  GET  /backend/v1/recibos/dados?cobranca_id=  — monta os dados do recibo
//      (cobrança + contrato + imóvel + inquilino + locador). NUNCA emite dados
//      de quitação para cobrança em aberto: retorna erro explicando a baixa.
//  POST /backend/v1/recibos/registrar           — grava número + URL do PDF na
//      cobrança (recibo_gerado / recibo_url). Idempotente.
//  POST /backend/v1/recibos/fila                — cria o item na fila de
//      WhatsApp com a mensagem do recibo + link do PDF. Regras do projeto:
//      nada dispara sozinho (status 'pendente', sai do número fixo do
//      proprietário no modo owner, exige aprovação na 📱 WhatsApp) e dedupe
//      por chave 'recibo:<cobranca_id>' — a mesma cobrança não gera dois itens
//      pendentes idênticos. Inquilino sem WhatsApp válido NÃO cria item
//      inválido: a rota devolve aviso "precisa de atenção".
//
// O PDF em si é gerado no cliente (src/features/recibos/pdf.ts) e sobe como
// arquivo da coleção `documentos` (tipo 'recibo') — o backend recebe a URL
// pública já resolvida pelo SDK (mesmo padrão da ficha de contrato).
routerAdd('GET', '/backend/v1/recibos/dados', (e) => {
  const app = e.app
  const q = e.requestInfo().query || {}
  const id = String(q.cobranca_id || '')

  function dataBR(iso) {
    if (!iso) return '—'
    const p = String(iso).split('T')[0].split('-')
    return p.length === 3 ? p[2] + '/' + p[1] + '/' + p[0] : String(iso)
  }

  let cob = null
  try {
    cob = app.findRecordById('cobrancas', id)
  } catch (_) {
    return e.json(404, { erro: 'Cobrança não encontrada.' })
  }

  const status = cob.getString('status')
  const valorPago = cob.getFloat('valor_pago') || 0
  if (status !== 'pago' && status !== 'pago_parcialmente') {
    return e.json(400, {
      erro: 'O recibo de quitação exige baixa: registre o pagamento (total ou parcial) antes de emitir o recibo.',
    })
  }
  if (valorPago <= 0) {
    return e.json(400, {
      erro: 'Nenhum valor recebido registrado nesta cobrança — o recibo de quitação exige baixa.',
    })
  }

  function rel(colecao, campo) {
    try {
      return app.findRecordById(colecao, cob.getString(campo))
    } catch (_) {
      return null
    }
  }
  const inq = rel('inquilinos', 'inquilino')
  const im = rel('imoveis', 'imovel')
  const ct = rel('contratos', 'contrato')

  // Locador = proprietário com maior percentual do imóvel; fallback: locador_nome do contrato.
  let locNome = ''
  let locDoc = ''
  try {
    const bruto = im ? im.getString('proprietarios_json') : ''
    const arr = JSON.parse(bruto || '[]')
    if (Array.isArray(arr) && arr.length) {
      const ordenado = arr.slice().sort(function (a, b) {
        return (Number(b.percentual) || 0) - (Number(a.percentual) || 0)
      })
      locNome = String(ordenado[0].nome || '')
      try {
        const prop = app.findRecordById('proprietarios', String(ordenado[0].proprietario_id || ''))
        locNome = prop.getString('nome') || locNome
        locDoc = prop.getString('cpf_cnpj') || ''
      } catch (_) {
        /* proprietário não resolvido — segue com o nome do JSON */
      }
    }
  } catch (_) {
    /* JSON inválido — segue */
  }
  if (!locNome && ct) locNome = ct.getString('locador_nome') || ''

  function rotuloIm(imRec) {
    if (!imRec) return ''
    const end = imRec.getString('endereco')
    const num = imRec.getString('numero')
    const comp = imRec.getString('complemento')
    const bairro = imRec.getString('bairro')
    const cid = imRec.getString('cidade')
    const uf = imRec.getString('estado')
    let txt = (end ? end + (num ? ', ' + num : '') : '') + (comp ? ' — ' + comp : '')
    if (bairro) txt += ' — ' + bairro
    if (cid || uf) txt += ' — ' + cid + (uf ? '/' + uf : '')
    return txt
  }

  // Número sequencial: REC-<AAAAMM>-<seq> por competência (idempotente).
  let numero = String(cob.getString('recibo_gerado') || '').trim()
  let numeroDefinido = !!numero
  if (!numero) {
    const prefixo = 'REC-' + String(cob.getString('competencia') || '').replace('-', '') + '-'
    let qtd = 0
    try {
      const existentes = app.findRecordsByFilter(
        'cobrancas',
        "recibo_gerado ~ '" + prefixo + "'",
        '-created',
        500,
        0,
      )
      qtd = existentes.length
    } catch (_) {
      /* filtro indisponível — sequência recomeça */
    }
    numero = prefixo + String(qtd + 1).padStart(3, '0')
  }

  return e.json(200, {
    ok: true,
    numero: numero,
    numero_definido: numeroDefinido,
    url: String(cob.getString('recibo_url') || ''),
    status: status,
    saldo: Math.max(0, (cob.getFloat('valor_total') || 0) - valorPago),
    data_pagamento_br: dataBR(cob.getString('data_pagamento')),
    cobranca: {
      id: cob.id,
      competencia: cob.getString('competencia'),
      vencimento: cob.getString('vencimento'),
      valor_aluguel: cob.getFloat('valor_aluguel') || 0,
      valor_desconto: cob.getFloat('valor_desconto') || 0,
      valor_acrescimo: cob.getFloat('valor_acrescimo') || 0,
      valor_multa: cob.getFloat('valor_multa') || 0,
      valor_juros: cob.getFloat('valor_juros') || 0,
      valor_iptu: cob.getFloat('valor_iptu') || 0,
      valor_condominio: cob.getFloat('valor_condominio') || 0,
      outras_cobrancas: cob.getFloat('outras_cobrancas') || 0,
      valor_total: cob.getFloat('valor_total') || 0,
      valor_pago: valorPago,
      data_pagamento: cob.getString('data_pagamento'),
      forma_pagamento: cob.getString('forma_pagamento'),
      conta_bancaria: cob.getString('conta_bancaria'),
    },
    inquilino: inq
      ? { id: inq.id, nome: inq.getString('nome'), cpf_cnpj: inq.getString('cpf_cnpj') }
      : { id: '', nome: '', cpf_cnpj: '' },
    locador: { nome: locNome, cpf_cnpj: locDoc },
    imovel: im
      ? { id: im.id, rotulo: rotuloIm(im), endereco: im.getString('endereco') }
      : { id: '', rotulo: '', endereco: '' },
    contrato: ct ? { id: ct.id, numero: ct.getString('numero') } : { id: '', numero: '' },
  })
})

routerAdd('POST', '/backend/v1/recibos/registrar', (e) => {
  const app = e.app
  const corpo = e.requestInfo().body || {}
  const id = String(corpo.cobranca_id || '')
  const url = String(corpo.url || '').trim()
  const docId = String(corpo.documento_id || '').trim()

  let cob = null
  try {
    cob = app.findRecordById('cobrancas', id)
  } catch (_) {
    return e.json(404, { erro: 'Cobrança não encontrada.' })
  }
  const status = cob.getString('status')
  if (status !== 'pago' && status !== 'pago_parcialmente') {
    return e.json(400, { erro: 'O recibo de quitação exige baixa da cobrança.' })
  }

  if (!String(cob.getString('recibo_gerado') || '').trim()) {
    const prefixo = 'REC-' + String(cob.getString('competencia') || '').replace('-', '') + '-'
    let qtd = 0
    try {
      const existentes = app.findRecordsByFilter(
        'cobrancas',
        "recibo_gerado ~ '" + prefixo + "'",
        '-created',
        500,
        0,
      )
      qtd = existentes.length
    } catch (_) {
      /* sequência recomeça */
    }
    cob.set('recibo_gerado', prefixo + String(qtd + 1).padStart(3, '0'))
  }
  if (url) cob.set('recibo_url', url)
  app.save(cob)

  if (docId) {
    try {
      const doc = app.findRecordById('documentos', docId)
      const obs = String(doc.getString('observacoes') || '')
      const marca = 'recibo_cobranca:' + cob.id
      if (obs.indexOf(marca) === -1) {
        doc.set('observacoes', obs ? obs + ' | ' + marca : marca)
        app.save(doc)
      }
    } catch (_) {
      /* documento opcional */
    }
  }

  return e.json(200, {
    ok: true,
    numero: cob.getString('recibo_gerado'),
    url: cob.getString('recibo_url'),
  })
})

routerAdd('POST', '/backend/v1/recibos/fila', (e) => {
  const app = e.app
  const corpo = e.requestInfo().body || {}
  const id = String(corpo.cobranca_id || '')
  const url = String(corpo.url || '').trim()

  let cob = null
  try {
    cob = app.findRecordById('cobrancas', id)
  } catch (_) {
    return e.json(404, { erro: 'Cobrança não encontrada.' })
  }
  const status = cob.getString('status')
  const valorPago = cob.getFloat('valor_pago') || 0
  if ((status !== 'pago' && status !== 'pago_parcialmente') || valorPago <= 0) {
    return e.json(400, { erro: 'O recibo de quitação exige baixa da cobrança.' })
  }
  if (!url && !String(cob.getString('recibo_url') || '').trim()) {
    return e.json(400, { erro: 'Gere/baixe o PDF do recibo antes de enviar ao WhatsApp.' })
  }
  const linkRecibo = url || cob.getString('recibo_url')

  // ---- Dedupe: a mesma cobrança não gera dois itens de recibo pendentes ----
  try {
    const existente = app.findFirstRecordByFilter(
      'fila_whatsapp',
      "chave = 'recibo:" + cob.id + "' && status != 'descartado'",
    )
    return e.json(200, { ok: true, dedupe: true, item_id: existente.id })
  } catch (_) {
    /* sem item anterior — segue */
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
  function rotuloIm(idIm) {
    try {
      const im = app.findRecordById('imoveis', idIm)
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
  // Normaliza telefone para o formato internacional (sem o "+") — mesma regra da varredura.
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
      return {
        ok: false,
        motivo: 'faltam 9 dígitos no celular (DDD + número)',
        numero: digitos,
      }
    }
    return { ok: true, motivo: '', numero: digitos }
  }

  let inq = null
  try {
    inq = app.findRecordById('inquilinos', cob.getString('inquilino'))
  } catch (_) {
    inq = null
  }
  if (!inq) return e.json(400, { erro: 'Cobrança sem inquilino vinculado.' })

  const bruto = inq.getString('whatsapp') || inq.getString('telefone') || ''
  const tel = normalizarTelefone(bruto)
  if (!tel.ok) {
    return e.json(200, {
      ok: false,
      aviso:
        'Precisa de atenção: ' +
        (inq.getString('nome') || 'o inquilino') +
        ' está com WhatsApp ' +
        tel.motivo +
        ' — preencha o número no cadastro antes de enviar o recibo.',
      motivo: tel.motivo,
    })
  }

  // Mensagem: template padrão da categoria 'recibo_aluguel' com os dados reais
  // — o texto entra na fila JÁ RENDERIZADO (a edição manual do usuário é a que vale).
  const PADRAO_RECIBO = [
    'Olá, {inquilino}! Tudo bem?',
    '',
    'Segue o recibo de quitação do aluguel da competência {competencia}.',
    '',
    '📍 Imóvel: {imovel}',
    '💰 Valor pago: {valor_pago} (cobrança total: {valor})',
    '📅 Data do pagamento: {data_pagamento}',
    '',
    '🧾 Recibo em PDF: {link_recibo}',
    '',
    'Obrigado pela pontualidade! Qualquer dúvida, estamos à disposição.',
    '',
    'Atenciosamente,',
    'Gestão Imobiliária',
  ].join('\n')

  let tplTexto = PADRAO_RECIBO
  let tplId = ''
  try {
    const lista = app.findRecordsByFilter(
      'fila_whatsapp_templates',
      "categoria = 'recibo_aluguel'",
      '-created',
      1,
      0,
    )
    if (lista.length) {
      tplTexto = lista[0].getString('texto') || PADRAO_RECIBO
      tplId = lista[0].id
    }
  } catch (_) {
    /* sem template — usa o texto padrão inline */
  }

  const nomeInq = inq.getString('nome') || 'cliente'
  const vars = {
    '{inquilino}': nomeInq,
    '{imovel}': rotuloIm(cob.getString('imovel')) || 'imóvel',
    '{valor}': brl(cob.getFloat('valor_total') || 0),
    '{valor_pago}': brl(valorPago),
    '{competencia}': cob.getString('competencia') || '—',
    '{data_pagamento}': dataBR(cob.getString('data_pagamento')),
    '{link_recibo}': linkRecibo,
  }
  let msg = String(tplTexto || PADRAO_RECIBO)
  for (const k in vars) msg = msg.split(k).join(vars[k])
  msg = msg.replace(/\n{3,}/g, '\n\n')

  // Garante número + URL na cobrança (idempotente).
  if (!String(cob.getString('recibo_gerado') || '').trim()) {
    const prefixo = 'REC-' + String(cob.getString('competencia') || '').replace('-', '') + '-'
    let qtd = 0
    try {
      const existentes = app.findRecordsByFilter(
        'cobrancas',
        "recibo_gerado ~ '" + prefixo + "'",
        '-created',
        500,
        0,
      )
      qtd = existentes.length
    } catch (_) {
      /* sequência recomeça */
    }
    cob.set('recibo_gerado', prefixo + String(qtd + 1).padStart(3, '0'))
  }
  cob.set('recibo_url', linkRecibo)
  app.save(cob)

  const col = app.findCollectionByNameOrId('fila_whatsapp')
  const item = new Record(col)
  item.set('chave', 'recibo:' + cob.id)
  item.set('tipo', 'recibo_aluguel')
  item.set('status', 'pendente')
  item.set('cobranca', cob.id)
  if (cob.getString('contrato')) item.set('contrato', cob.getString('contrato'))
  if (cob.getString('imovel')) item.set('imovel', cob.getString('imovel'))
  item.set('inquilino', inq.id)
  item.set('competencia', cob.getString('competencia'))
  item.set('vencimento', cob.getString('vencimento'))
  item.set('valor_devido', valorPago)
  item.set('destinatario', tel.numero)
  item.set('destinatario_cadastro', bruto)
  item.set('telefone_ok', true)
  item.set('mensagem', msg)
  item.set('template', tplId)
  item.set('link_recibo', linkRecibo)
  item.set('link_incluido', false)
  app.save(item)

  return e.json(200, {
    ok: true,
    item_id: item.id,
    dedupe: false,
    numero: cob.getString('recibo_gerado'),
  })
})
