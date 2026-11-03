/**
 * Alertas + e-mails — canal de e-mail das notificações do Gestor Imobiliário 360.
 *
 *  • cron diário "alertas_email_verificar" (10h UTC): varre os dados reais
 *    (cobranças vencidas sem pagamento integral, contratos vencendo nas janelas
 *    120/90/60/30/15/7, reajustes aguardando aprovação com data-base no próximo
 *    mês, pendências com prazo vencido/próximo), registra cada alerta em
 *    `alertas_email` com deduplicação por chave (evento + referência) e envia o
 *    e-mail diário consolidado (agrupado por severidade) só quando existe
 *    alerta novo ainda não enviado.
 *  • cron semanal "alertas_email_resumo" (segunda-feira, 10h UTC): resumo
 *    gerencial — total recebido, total pendente, contratos próximos do
 *    vencimento, reajustes futuros, pendências urgentes e providências —
 *    enviado mesmo sem alertas novos.
 *  • POST /backend/v1/alertas-email/verificar — varredura imediata (mesma lógica do cron).
 *  • POST /backend/v1/alertas-email/teste — envio de e-mail de teste real.
 *  • POST /backend/v1/alertas-email/resumo — dispara o resumo semanal na hora.
 *  • GET  /backend/v1/alertas-email/config — lê a configuração salva.
 *
 * IMPORTANTE (JSVM do PocketBase): callbacks de rota/cron rodam em pools de VM
 * separados — nada de escopo top-level pode ser referenciado dentro deles.
 * Por isso cada callback define suas próprias constantes e funções (inline).
 * Toda a interface/texto em português.
 */

// ---------------------- POST /backend/v1/alertas-email/verificar ----------------------
routerAdd('POST', '/backend/v1/alertas-email/verificar', (e) => {
  const app = e.app
  // Constantes locais do callback (a JSVM não expõe escopo top-level nos callbacks).
  const EMAIL_ADMIN = 'advmg.rodrigues@gmail.com'
  const TODAS_CATEGORIAS = [
    'inadimplencia',
    'contratos',
    'reajustes',
    'pendencias',
    'resumo_semanal',
  ]
  const DIAS_JANELAS = [120, 90, 60, 30, 15, 7]

  function hojeStr() {
    const d = new Date()
    const p = (n) => String(n).padStart(2, '0')
    return d.getFullYear() + '-' + p(d.getMonth() + 1) + '-' + p(d.getDate())
  }
  function diffDias(isoA, isoB) {
    const a = String(isoA).split('-').map(Number)
    const b = String(isoB).split('-').map(Number)
    return Math.round((Date.UTC(a[0], a[1] - 1, a[2]) - Date.UTC(b[0], b[1] - 1, b[2])) / 86400000)
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
  function mesProximoDe(anoMes) {
    const p = String(anoMes).split('-').map(Number)
    let y = p[0]
    let m = p[1] + 1
    if (m > 12) {
      m = 1
      y++
    }
    return y + '-' + String(m).padStart(2, '0')
  }
  function ehData(iso) {
    return /^\d{4}-\d{2}-\d{2}$/.test(String(iso || ''))
  }
  function esc(txt) {
    return String(txt || '')
      .replace(/&/g, '&amp;')
      .replace(/</g, '&lt;')
      .replace(/>/g, '&gt;')
  }
  function cfgJson(chave, padrao) {
    try {
      const rec = app.findFirstRecordByData('configuracoes', 'chave', chave)
      const bruto = rec.getString('valor_json')
      if (!bruto) return padrao
      const parsed = JSON.parse(bruto)
      if (Array.isArray(padrao)) return Array.isArray(parsed) ? parsed : padrao
      if (
        parsed &&
        typeof parsed === 'object' &&
        !Array.isArray(parsed) &&
        padrao &&
        typeof padrao === 'object'
      ) {
        return Object.assign({}, padrao, parsed)
      }
      return parsed === null || parsed === undefined ? padrao : parsed
    } catch (_) {
      return padrao
    }
  }
  function cfgCategorias() {
    const mapa = cfgJson('alertas_email_categorias', {})
    const out = {}
    for (const cat of TODAS_CATEGORIAS) out[cat] = mapa[cat] !== false
    return out
  }
  function cfgRecebedores() {
    const lista = cfgJson('alertas_email_destinatarios', [EMAIL_ADMIN])
    const validos = []
    for (const item of lista) {
      const t = String(item || '')
        .trim()
        .toLowerCase()
      if (/^[^\s@]+@[^\s@]+\.[^\s@]+$/.test(t) && validos.indexOf(t) === -1) validos.push(t)
    }
    return validos.length ? validos : [EMAIL_ADMIN]
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
  function rotuloInquilino(id) {
    try {
      return app.findRecordById('inquilinos', id).getString('nome')
    } catch (_) {
      return ''
    }
  }
  function rotuloContrato(id) {
    try {
      return 'Contrato ' + app.findRecordById('contratos', id).getString('numero')
    } catch (_) {
      return ''
    }
  }
  function inquilinoDeContrato(contratoId) {
    try {
      return app.findRecordById('contratos', contratoId).getString('inquilino')
    } catch (_) {
      return ''
    }
  }
  function buscar(colecao, filtro, sort, limite) {
    try {
      return app.findRecordsByFilter(colecao, filtro, sort, limite || 500, 0)
    } catch (err) {
      console.log('[alertas] erro ao consultar ' + colecao + ': ' + ((err && err.message) || err))
      return []
    }
  }

  function varrerCobrancas(hoje) {
    const alertas = []
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
      if (!ehData(venc) || venc > hoje) continue
      const dias = diffDias(hoje, venc)
      const rotulo = [
        rotuloInquilino(cob.getString('inquilino')),
        rotuloImovel(cob.getString('imovel')),
      ]
        .filter(Boolean)
        .join(' — ')
      alertas.push({
        evento: 'cobranca_vencida',
        categoria: 'inadimplencia',
        severidade: dias > 15 ? 'urgente' : 'alta',
        titulo:
          'Aluguel vencido há ' + dias + ' dia(s) — ' + (rotulo || 'Cobrança de ' + dataBR(venc)),
        mensagem:
          'Cobrança da competência ' +
          cob.getString('competencia') +
          ', vencida em ' +
          dataBR(venc) +
          ' (há ' +
          dias +
          ' dia(s)). Saldo devedor de ' +
          brl(saldo) +
          ' (total ' +
          brl(total) +
          ', pago ' +
          brl(pago) +
          ').',
        ref_id: cob.id,
        ref_rotulo: rotulo,
        ref_valor: saldo,
        ref_data: venc,
        ref_status: 'vencido há ' + dias + ' dias',
        acao: 'Cobrar o inquilino e registrar a baixa em Financeiro.',
      })
    }
    return alertas
  }

  function varrerContratos(hoje) {
    const alertas = []
    for (const c of buscar(
      'contratos',
      "status != 'encerrado' && status != 'distratado'",
      'data_fim',
    )) {
      const fim = c.getString('data_fim')
      if (!ehData(fim)) continue
      const dias = diffDias(hoje, fim)
      if (dias < 0 || dias > DIAS_JANELAS[0]) continue
      let faixa = 0
      for (const j of DIAS_JANELAS) {
        if (dias <= j) {
          faixa = j
          break
        }
      }
      if (!faixa) continue
      const rotulo = [
        rotuloInquilino(c.getString('inquilino')),
        rotuloImovel(c.getString('imovel')),
      ]
        .filter(Boolean)
        .join(' — ')
      alertas.push({
        evento: 'contrato_vencendo',
        categoria: 'contratos',
        severidade: dias <= 15 ? 'alta' : dias <= 30 ? 'media' : 'info',
        titulo:
          'Contrato vence em ' +
          dias +
          ' dia(s) — ' +
          (rotuloImovel(c.getString('imovel')) || c.getString('numero')),
        mensagem:
          'O contrato ' +
          c.getString('numero') +
          ' (' +
          (rotuloInquilino(c.getString('inquilino')) || 'inquilino') +
          ') do imóvel ' +
          (rotuloImovel(c.getString('imovel')) || '—') +
          ' termina em ' +
          dataBR(fim) +
          ' — faltam ' +
          dias +
          ' dia(s).',
        ref_id: c.id,
        ref_rotulo: rotulo,
        ref_valor: c.getFloat('valor_atual') || 0,
        ref_data: fim,
        ref_data_fim: fim,
        ref_status: 'vence em ' + dias + ' dias (faixa ' + faixa + ' dias)',
        acao: 'Negociar renovação/prorrogação e registrar em Renovações.',
      })
    }
    return alertas
  }

  function varrerReajustes(mesSeguinte) {
    const alertas = []
    for (const r of buscar('reajustes', "status = 'aguardando_aprovacao'", 'data_base')) {
      const base = r.getString('data_base')
      if (!ehData(base) || base.slice(0, 7) !== mesSeguinte) continue
      const contratoId = r.getString('contrato')
      const rotulo = [rotuloInquilino(inquilinoDeContrato(contratoId)), rotuloContrato(contratoId)]
        .filter(Boolean)
        .join(' — ')
      const pct = r.getFloat('percentual_aplicavel') || 0
      const antigo = r.getFloat('aluguel_anterior') || 0
      const novo = r.getFloat('aluguel_novo_projetado') || r.getFloat('aluguel_novo_aprovado') || 0
      alertas.push({
        evento: 'reajuste_previsto',
        categoria: 'reajustes',
        severidade: 'media',
        titulo: 'Reajuste previsto para ' + dataBR(base) + (rotulo ? ' — ' + rotulo : ''),
        mensagem:
          'Reajuste com data-base em ' +
          dataBR(base) +
          ' (' +
          r.getString('indice') +
          ' de ' +
          pct +
          '%). Aluguel de ' +
          brl(antigo) +
          ' para ' +
          brl(novo) +
          '. Status: aguardando aprovação.',
        ref_id: r.id,
        ref_rotulo: rotulo,
        ref_valor: novo - antigo,
        ref_data: base,
        ref_status: 'aguardando aprovação',
        acao: 'Aprovar e aplicar o reajuste em Reajustes.',
      })
    }
    return alertas
  }

  function varrerPendencias(hoje) {
    const alertas = []
    for (const p of buscar(
      'pendencias',
      "status = 'pendente' || status = 'em_andamento'",
      'prazo',
    )) {
      const prazo = p.getString('prazo')
      if (!ehData(prazo)) continue
      const dias = diffDias(hoje, prazo)
      if (dias > 7) continue
      const vencida = dias < 0
      const rotulo = [
        p.getString('imovel') ? rotuloImovel(p.getString('imovel')) : '',
        p.getString('inquilino') ? rotuloInquilino(p.getString('inquilino')) : '',
      ]
        .filter(Boolean)
        .join(' — ')
      alertas.push({
        evento: 'pendencia_prazo',
        categoria: 'pendencias',
        severidade: vencida ? 'urgente' : 'alta',
        titulo:
          (vencida ? 'Pendência com prazo vencido' : 'Pendência vence em ' + dias + ' dia(s)') +
          ' — ' +
          p.getString('titulo'),
        mensagem:
          p.getString('titulo') +
          ' (prioridade ' +
          p.getString('prioridade') +
          '). Prazo ' +
          dataBR(prazo) +
          ' — ' +
          (vencida ? 'vencido há ' + Math.abs(dias) + ' dia(s).' : 'vence em ' + dias + ' dia(s).'),
        ref_id: p.id,
        ref_rotulo: rotulo || p.getString('responsavel'),
        ref_data: prazo,
        ref_status: vencida
          ? 'vencida há ' + Math.abs(dias) + ' dias'
          : 'vence em ' + dias + ' dias',
        acao: 'Resolver a pendência em Pendências.',
      })
    }
    return alertas
  }

  function gravarAlertas(candidatos) {
    const novos = []
    for (const a of candidatos) {
      const chave = a.evento + '|' + a.ref_id
      let existente = null
      try {
        const achados = app.findRecordsByFilter(
          'alertas_email',
          "chave = '" + chave + "'",
          '',
          1,
          0,
        )
        if (achados.length > 0) existente = achados[0]
      } catch (_) {
        existente = null
      }
      if (existente) {
        if (!existente.getBool('ativo')) {
          existente.set('ativo', true)
          existente.set('email_enviado', false)
          existente.set('titulo', a.titulo)
          existente.set('mensagem', a.mensagem)
          existente.set('ref_status', a.ref_status)
          app.save(existente)
          novos.push(existente)
        }
        continue // já existe e está ativo: não recria, não reenvia
      }
      const rec = new Record(app.findCollectionByNameOrId('alertas_email'))
      rec.set('chave', chave)
      rec.set('evento', a.evento)
      rec.set('categoria', a.categoria)
      rec.set('severidade', a.severidade)
      rec.set('titulo', a.titulo)
      rec.set('mensagem', a.mensagem)
      rec.set('ref_id', a.ref_id || '')
      rec.set('ref_rotulo', a.ref_rotulo || '')
      rec.set('ref_valor', a.ref_valor || 0)
      rec.set('ref_data', a.ref_data || '')
      rec.set('ref_data_fim', a.ref_data_fim || '')
      rec.set('ref_status', a.ref_status || '')
      rec.set('acao', a.acao || '')
      rec.set('email_enviado', false)
      rec.set('ativo', true)
      rec.set('is_demo', false)
      app.save(rec)
      novos.push(rec)
    }
    return novos
  }

  function desligarAlertasResolvidos(hoje) {
    const grupos = [
      { categoria: 'pendencias', colecao: 'pendencias', fechados: ['resolvida', 'cancelada'] },
      {
        categoria: 'reajustes',
        colecao: 'reajustes',
        fechados: ['aprovado', 'rejeitado', 'nao_aplicado'],
      },
    ]
    for (const g of grupos) {
      for (const rec of buscar(
        'alertas_email',
        "ativo = true && categoria = '" + g.categoria + "'",
        '',
      )) {
        let aberto = true
        try {
          const st = app.findRecordById(g.colecao, rec.getString('ref_id')).getString('status')
          if (g.fechados.indexOf(st) !== -1) aberto = false
        } catch (_) {
          aberto = false
        }
        if (!aberto) {
          rec.set('ativo', false)
          app.save(rec)
        }
      }
    }
    for (const rec of buscar('alertas_email', "ativo = true && categoria = 'contratos'", '')) {
      const fim = rec.getString('ref_data_fim')
      if (!ehData(fim)) continue
      const dias = diffDias(hoje, fim)
      if (dias < 0) {
        rec.set('ativo', false)
        rec.set('ref_status', 'contrato encerrado')
        app.save(rec)
      } else if (dias > DIAS_JANELAS[0]) {
        rec.set('ativo', false)
        app.save(rec)
      }
    }
  }

  function enviarEmail(assunto, html, texto) {
    const destinos = cfgRecebedores()
    try {
      const settings = app.settings()
      app.newMailClient().send(
        new MailerMessage({
          from: { address: settings.meta.senderAddress, name: settings.meta.senderName },
          to: destinos.map((d) => ({ address: d })),
          subject: assunto,
          html: html,
          text: texto || '',
        }),
      )
      return { ok: true, destino: destinos.join(', ') }
    } catch (err) {
      return {
        ok: false,
        destino: destinos.join(', '),
        erro: err && err.message ? err.message : String(err),
      }
    }
  }

  const ROTULO_SEV = { urgente: 'Urgente', alta: 'Alta', media: 'Média', info: 'Informativo' }
  const COR_SEV = { urgente: '#b91c1c', alta: '#b45309', media: '#4d7c0f', info: '#475569' }
  const ORDEM_SEV = { urgente: 0, alta: 1, media: 2, info: 3 }

  try {
    const hoje = hojeStr()
    const mesSeguinte = mesProximoDe(hoje.slice(0, 7))
    const categorias = cfgCategorias()
    const candidatos = varrerCobrancas(hoje)
      .concat(varrerContratos(hoje))
      .concat(varrerReajustes(mesSeguinte))
      .concat(varrerPendencias(hoje))
      .filter((a) => categorias[a.categoria] !== false)
    desligarAlertasResolvidos(hoje)
    const novos = gravarAlertas(candidatos)
    const ativos = buscar('alertas_email', 'ativo = true', '-created')
    const aguardandoEnvio = ativos.filter((r) => !r.getBool('email_enviado'))
    let enviou = false
    let destinoFinal = ''
    if (aguardandoEnvio.length > 0 && ativos.length > 0) {
      const linhas = ativos.map((rec) => {
        const sev = rec.getString('severidade') || 'info'
        return {
          ordem: ORDEM_SEV[sev] !== undefined ? ORDEM_SEV[sev] : 9,
          rotulo: ROTULO_SEV[sev] || sev,
          cor: COR_SEV[sev] || COR_SEV.info,
          texto:
            esc(rec.getString('titulo')) +
            (rec.getString('mensagem')
              ? '<br><span style="color:#475569;font-size:12px">' +
                esc(rec.getString('mensagem')) +
                '</span>'
              : ''),
        }
      })
      linhas.sort((a, b) => a.ordem - b.ordem)
      let itens = ''
      for (const l of linhas) {
        itens +=
          '<li style="margin-bottom:10px"><span style="color:' +
          l.cor +
          ';font-weight:bold">[' +
          l.rotulo +
          ']</span> ' +
          l.texto +
          '</li>'
      }
      const html =
        '<div style="font-family:Arial,Helvetica,sans-serif;font-size:14px;color:#0f172a">' +
        '<h2 style="margin:0 0 4px 0;color:#059669">Gestor Imobiliário 360</h2>' +
        '<p style="margin:0 0 4px 0;color:#475569">Alertas em aberto — ' +
        dataBR(hoje) +
        '</p>' +
        '<p style="margin:0 0 12px 0;color:#94a3b8;font-size:11px">' +
        novos.length +
        ' alerta(s) novo(s) neste envio; ' +
        ativos.length +
        ' em aberto no total.</p>' +
        '<ul style="padding-left:18px;margin:0 0 12px 0">' +
        itens +
        '</ul>' +
        '<p style="margin:12px 0 0 0;color:#94a3b8;font-size:12px">Central de Alertas e Notificações — mensagem gerada automaticamente pelo sistema.</p></div>'
      const texto = ativos
        .map(
          (r) =>
            '[' +
            (ROTULO_SEV[r.getString('severidade')] || '') +
            '] ' +
            r.getString('titulo') +
            '\n' +
            r.getString('mensagem'),
        )
        .join('\n\n')
      const resultado = enviarEmail(
        'Gestor 360 — ' + ativos.length + ' alerta(s) em aberto (' + dataBR(hoje) + ')',
        html,
        texto,
      )
      enviou = resultado.ok
      destinoFinal = resultado.destino || ''
      if (enviou) {
        for (const rec of aguardandoEnvio) {
          rec.set('email_enviado', true)
          app.save(rec)
        }
      } else {
        console.log('[alertas] falha no envio do e-mail diário: ' + (resultado.erro || ''))
      }
    }
    console.log(
      '[alertas] varredura (rota): ' +
        candidatos.length +
        ' candidato(s), ' +
        novos.length +
        ' novo(s), ' +
        ativos.length +
        ' em aberto; e-mail ' +
        (enviou ? 'enviado para ' + destinoFinal : 'não enviado'),
    )
    return e.json(200, {
      ok: true,
      hoje: hoje,
      candidatos: candidatos.length,
      novos_alertas: novos.length,
      alertas_em_aberto: ativos.length,
      email_enviado: enviou,
      destino: destinoFinal,
    })
  } catch (err) {
    console.log('[alertas] ERRO na verificação (rota): ' + ((err && err.message) || err))
    return e.json(500, { ok: false, erro: err && err.message ? err.message : String(err) })
  }
})

// ---------------------- POST /backend/v1/alertas-email/teste ----------------------
routerAdd('POST', '/backend/v1/alertas-email/teste', (e) => {
  const app = e.app
  const EMAIL_ADMIN = 'advmg.rodrigues@gmail.com'

  function hojeStr() {
    const d = new Date()
    const p = (n) => String(n).padStart(2, '0')
    return d.getFullYear() + '-' + p(d.getMonth() + 1) + '-' + p(d.getDate())
  }
  function dataBR(iso) {
    const p = String(iso).split('-')
    return p.length === 3 ? p[2] + '/' + p[1] + '/' + p[0] : String(iso)
  }
  function esc(txt) {
    return String(txt || '')
      .replace(/&/g, '&amp;')
      .replace(/</g, '&lt;')
      .replace(/>/g, '&gt;')
  }
  function cfgJson(chave, padrao) {
    try {
      const bruto = app
        .findFirstRecordByData('configuracoes', 'chave', chave)
        .getString('valor_json')
      if (!bruto) return padrao
      const parsed = JSON.parse(bruto)
      return Array.isArray(padrao)
        ? Array.isArray(parsed)
          ? parsed
          : padrao
        : parsed === null || parsed === undefined
          ? padrao
          : parsed
    } catch (_) {
      return padrao
    }
  }
  function cfgRecebedores() {
    const lista = cfgJson('alertas_email_destinatarios', [EMAIL_ADMIN])
    const validos = []
    for (const item of lista) {
      const t = String(item || '')
        .trim()
        .toLowerCase()
      if (/^[^\s@]+@[^\s@]+\.[^\s@]+$/.test(t) && validos.indexOf(t) === -1) validos.push(t)
    }
    return validos.length ? validos : [EMAIL_ADMIN]
  }
  function cfgSalvar(chave, valor) {
    try {
      const rec = app.findFirstRecordByData('configuracoes', 'chave', chave)
      rec.set('valor_json', JSON.stringify(valor))
      app.save(rec)
    } catch (_) {
      const rec = new Record(app.findCollectionByNameOrId('configuracoes'))
      rec.set('chave', chave)
      rec.set('valor_json', JSON.stringify(valor))
      rec.set('descricao', 'Configuração de notificações por e-mail (Central de Alertas)')
      app.save(rec)
    }
  }

  const destinos = cfgRecebedores()
  const html =
    '<div style="font-family:Arial,Helvetica,sans-serif;font-size:14px;color:#0f172a">' +
    '<h2 style="margin:0 0 4px 0;color:#059669">Gestor Imobiliário 360</h2>' +
    '<p style="margin:0 0 4px 0;color:#475569">E-mail de teste — Central de Alertas e Notificações</p>' +
    '<p style="margin:0 0 12px 0;color:#94a3b8;font-size:11px">Se você recebeu esta mensagem, o envio de e-mails do sistema está funcionando.</p>' +
    '<ul style="padding-left:18px;margin:0 0 12px 0">' +
    '<li>Destinatários configurados: ' +
    esc(destinos.join(', ')) +
    '</li>' +
    '<li>Data/hora do teste (UTC): ' +
    esc(new Date().toISOString().replace('T', ' ').slice(0, 16)) +
    '</li>' +
    '</ul>' +
    '<p style="margin:12px 0 0 0;color:#94a3b8;font-size:12px">Central de Alertas e Notificações — mensagem gerada automaticamente pelo sistema.</p></div>'
  const texto =
    'E-mail de teste da Central de Alertas e Notificações do Gestor Imobiliário 360. Destinatários: ' +
    destinos.join(', ')

  let resultado
  try {
    const settings = app.settings()
    app.newMailClient().send(
      new MailerMessage({
        from: { address: settings.meta.senderAddress, name: settings.meta.senderName },
        to: destinos.map((d) => ({ address: d })),
        subject: 'Gestor 360 — E-mail de teste (' + dataBR(hojeStr()) + ')',
        html: html,
        text: texto,
      }),
    )
    resultado = { ok: true, destino: destinos.join(', ') }
  } catch (err) {
    resultado = {
      ok: false,
      destino: destinos.join(', '),
      erro: err && err.message ? err.message : String(err),
    }
  }

  cfgSalvar('alertas_email_teste', {
    executado_em: new Date().toISOString(),
    resultado: resultado.ok
      ? 'Enviado com sucesso para ' + resultado.destino
      : 'Falhou: ' + (resultado.erro || 'erro desconhecido'),
    sucesso: resultado.ok,
  })
  console.log(
    '[alertas] e-mail de teste: ' +
      (resultado.ok ? 'enviado para ' + resultado.destino : 'FALHOU: ' + (resultado.erro || '')),
  )
  if (!resultado.ok)
    return e.json(500, { ok: false, destino: resultado.destino, erro: resultado.erro })
  return e.json(200, { ok: true, destino: resultado.destino })
})

// ---------------------- POST /backend/v1/alertas-email/resumo ----------------------
routerAdd('POST', '/backend/v1/alertas-email/resumo', (e) => {
  const app = e.app
  const EMAIL_ADMIN = 'advmg.rodrigues@gmail.com'

  function hojeStr() {
    const d = new Date()
    const p = (n) => String(n).padStart(2, '0')
    return d.getFullYear() + '-' + p(d.getMonth() + 1) + '-' + p(d.getDate())
  }
  function diffDias(isoA, isoB) {
    const a = String(isoA).split('-').map(Number)
    const b = String(isoB).split('-').map(Number)
    return Math.round((Date.UTC(a[0], a[1] - 1, a[2]) - Date.UTC(b[0], b[1] - 1, b[2])) / 86400000)
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
  function mesProximoDe(anoMes) {
    const p = String(anoMes).split('-').map(Number)
    let y = p[0]
    let m = p[1] + 1
    if (m > 12) {
      m = 1
      y++
    }
    return y + '-' + String(m).padStart(2, '0')
  }
  function ehData(iso) {
    return /^\d{4}-\d{2}-\d{2}$/.test(String(iso || ''))
  }
  function esc(txt) {
    return String(txt || '')
      .replace(/&/g, '&amp;')
      .replace(/</g, '&lt;')
      .replace(/>/g, '&gt;')
  }
  function cfgJson(chave, padrao) {
    try {
      const bruto = app
        .findFirstRecordByData('configuracoes', 'chave', chave)
        .getString('valor_json')
      if (!bruto) return padrao
      const parsed = JSON.parse(bruto)
      return Array.isArray(padrao)
        ? Array.isArray(parsed)
          ? parsed
          : padrao
        : parsed === null || parsed === undefined
          ? padrao
          : parsed
    } catch (_) {
      return padrao
    }
  }
  function cfgRecebedores() {
    const lista = cfgJson('alertas_email_destinatarios', [EMAIL_ADMIN])
    const validos = []
    for (const item of lista) {
      const t = String(item || '')
        .trim()
        .toLowerCase()
      if (/^[^\s@]+@[^\s@]+\.[^\s@]+$/.test(t) && validos.indexOf(t) === -1) validos.push(t)
    }
    return validos.length ? validos : [EMAIL_ADMIN]
  }
  function rotuloImovel(imovelId) {
    try {
      const im = app.findRecordById('imoveis', imovelId)
      const end = im.getString('endereco')
      const num = im.getString('numero')
      const bairro = im.getString('bairro')
      let txt = end ? end + (num ? ', ' + num : '') : ''
      if (bairro) txt += ' (' + bairro + ')'
      return txt
    } catch (_) {
      return ''
    }
  }
  function rotuloInquilino(id) {
    try {
      return app.findRecordById('inquilinos', id).getString('nome')
    } catch (_) {
      return ''
    }
  }
  function rotuloContrato(id) {
    try {
      return 'Contrato ' + app.findRecordById('contratos', id).getString('numero')
    } catch (_) {
      return ''
    }
  }
  function inquilinoDeContrato(contratoId) {
    try {
      return app.findRecordById('contratos', contratoId).getString('inquilino')
    } catch (_) {
      return ''
    }
  }
  function buscar(colecao, filtro, sort, limite) {
    try {
      return app.findRecordsByFilter(colecao, filtro, sort, limite || 500, 0)
    } catch (err) {
      console.log('[alertas] erro ao consultar ' + colecao + ': ' + ((err && err.message) || err))
      return []
    }
  }

  try {
    const hoje = hojeStr()
    const mesSeguinte = mesProximoDe(hoje.slice(0, 7))
    const bimestreSeguinte = mesProximoDe(mesSeguinte)

    let recebido = 0
    let pendente = 0
    let cobrancasVencidas = 0
    const maioresAtrasos = []
    for (const c of buscar('cobrancas', '', '-vencimento', 1000)) {
      const pago = c.getFloat('valor_pago') || 0
      const total = c.getFloat('valor_total') || 0
      recebido += pago
      const st = c.getString('status')
      const saldo = total - pago
      if (
        (st === 'vencido' || st === 'pago_parcialmente') &&
        saldo > 0.005 &&
        !c.getString('data_pagamento')
      ) {
        pendente += saldo
        cobrancasVencidas++
        maioresAtrasos.push({
          rotulo: [rotuloInquilino(c.getString('inquilino')), rotuloImovel(c.getString('imovel'))]
            .filter(Boolean)
            .join(' — '),
          venc: c.getString('vencimento'),
          saldo: saldo,
        })
      }
    }
    maioresAtrasos.sort((a, b) => String(a.venc).localeCompare(String(b.venc)))

    const contratosProximos = []
    for (const c of buscar(
      'contratos',
      "status != 'encerrado' && status != 'distratado'",
      'data_fim',
    )) {
      const fim = c.getString('data_fim')
      if (!ehData(fim)) continue
      const dias = diffDias(hoje, fim)
      if (dias >= 0 && dias <= 60) {
        contratosProximos.push({
          numero: c.getString('numero'),
          rotulo: [rotuloInquilino(c.getString('inquilino')), rotuloImovel(c.getString('imovel'))]
            .filter(Boolean)
            .join(' — '),
          fim: fim,
          dias: dias,
        })
      }
    }

    const reajustesFuturos = []
    for (const r of buscar('reajustes', "status = 'aguardando_aprovacao'", 'data_base')) {
      const base = r.getString('data_base')
      if (!ehData(base)) continue
      const mes = base.slice(0, 7)
      if (mes === mesSeguinte || mes === bimestreSeguinte) {
        reajustesFuturos.push({
          rotulo: [
            rotuloInquilino(inquilinoDeContrato(r.getString('contrato'))),
            rotuloContrato(r.getString('contrato')),
          ]
            .filter(Boolean)
            .join(' — '),
          base: base,
          pct: r.getFloat('percentual_aplicavel') || 0,
        })
      }
    }

    const pendenciasUrgentes = []
    for (const p of buscar(
      'pendencias',
      "status = 'pendente' || status = 'em_andamento'",
      'prazo',
    )) {
      const prio = p.getString('prioridade')
      if (prio !== 'urgente' && prio !== 'alta') continue
      pendenciasUrgentes.push({
        titulo: p.getString('titulo'),
        prazo: p.getString('prazo'),
        prioridade: prio,
      })
    }
    pendenciasUrgentes.sort((a, b) => String(a.prazo || '').localeCompare(String(b.prazo || '')))

    const providencias = []
    if (cobrancasVencidas > 0)
      providencias.push(
        'Acionar os inquilinos com aluguel em atraso (' +
          cobrancasVencidas +
          ' cobrança(s)) e registrar as baixas em Financeiro.',
      )
    if (contratosProximos.length > 0)
      providencias.push(
        'Iniciar a negociação de renovação dos ' +
          contratosProximos.length +
          ' contrato(s) que vencem em até 60 dias.',
      )
    if (reajustesFuturos.length > 0)
      providencias.push(
        'Aprovar e aplicar os ' +
          reajustesFuturos.length +
          ' reajuste(s) previsto(s) para o próximo bimestre.',
      )
    if (pendenciasUrgentes.length > 0)
      providencias.push(
        'Tratar as ' + pendenciasUrgentes.length + ' pendência(s) de prioridade urgente/alta.',
      )
    if (providencias.length === 0)
      providencias.push('Nenhuma providência crítica no momento — carteira em dia.')

    const lista = (arr, formatter, vazio) => {
      if (!arr || arr.length === 0)
        return '<p style="margin:0 0 10px 0;color:#475569">' + vazio + '</p>'
      let out = '<ul style="padding-left:18px;margin:0 0 12px 0">'
      for (const item of arr) out += '<li style="margin-bottom:4px">' + formatter(item) + '</li>'
      return out + '</ul>'
    }

    let html =
      '<div style="font-family:Arial,Helvetica,sans-serif;font-size:14px;color:#0f172a">' +
      '<h2 style="margin:0 0 4px 0;color:#059669">Gestor Imobiliário 360</h2>' +
      '<p style="margin:0 0 4px 0;color:#475569">Resumo gerencial semanal — ' +
      dataBR(hoje) +
      '</p>' +
      '<p style="margin:0 0 12px 0;color:#94a3b8;font-size:11px">Totais da carteira, vencimentos, reajustes e pendências.</p>'
    html +=
      '<table style="border-collapse:collapse;margin:0 0 14px 0">' +
      '<tr><td style="padding:3px 14px 3px 0;color:#475569">Total recebido (acumulado registrado):</td><td style="font-weight:bold">' +
      brl(recebido) +
      '</td></tr>' +
      '<tr><td style="padding:3px 14px 3px 0;color:#475569">Total pendente (cobranças em atraso):</td><td style="font-weight:bold;color:#b91c1c">' +
      brl(pendente) +
      ' em ' +
      cobrancasVencidas +
      ' cobrança(s)</td></tr></table>'
    html +=
      '<h3 style="margin:0 0 6px 0;font-size:13px">Contratos próximos do vencimento (60 dias)</h3>'
    html += lista(
      contratosProximos,
      (c) =>
        esc(c.numero) +
        ' — ' +
        esc(c.rotulo) +
        ' — término em ' +
        dataBR(c.fim) +
        ' (' +
        c.dias +
        ' dias)',
      'Nenhum contrato vence nos próximos 60 dias.',
    )
    html += '<h3 style="margin:0 0 6px 0;font-size:13px">Reajustes futuros (próximo bimestre)</h3>'
    html += lista(
      reajustesFuturos,
      (r) => esc(r.rotulo) + ' — data-base ' + dataBR(r.base) + ' (' + r.pct + '%)',
      'Nenhum reajuste previsto para o próximo bimestre.',
    )
    html += '<h3 style="margin:0 0 6px 0;font-size:13px">Pendências urgentes</h3>'
    html += lista(
      pendenciasUrgentes,
      (p) => '[' + esc(p.prioridade) + '] ' + esc(p.titulo) + ' — prazo ' + dataBR(p.prazo),
      'Nenhuma pendência urgente em aberto.',
    )
    html += '<h3 style="margin:0 0 6px 0;font-size:13px">Maiores atrasos</h3>'
    html += lista(
      maioresAtrasos.slice(0, 10),
      (c) => esc(c.rotulo) + ' — vencida em ' + dataBR(c.venc) + ' — saldo ' + brl(c.saldo),
      'Nenhuma cobrança em atraso.',
    )
    html += '<h3 style="margin:0 0 6px 0;font-size:13px">Principais providências</h3>'
    html += lista(providencias, (p) => esc(p), '—')
    html +=
      '<p style="margin:12px 0 0 0;color:#94a3b8;font-size:12px">Central de Alertas e Notificações — mensagem gerada automaticamente pelo sistema.</p></div>'

    const texto =
      'Resumo gerencial semanal (' +
      dataBR(hoje) +
      ')\n' +
      'Total recebido: ' +
      brl(recebido) +
      '\n' +
      'Total pendente: ' +
      brl(pendente) +
      ' em ' +
      cobrancasVencidas +
      ' cobrança(s)\n' +
      'Contratos a vencer em 60 dias: ' +
      contratosProximos.length +
      '\n' +
      'Reajustes no próximo bimestre: ' +
      reajustesFuturos.length +
      '\n' +
      'Pendências urgentes: ' +
      pendenciasUrgentes.length +
      '\n' +
      'Providências: ' +
      providencias.join(' ')

    const destinos = cfgRecebedores()
    let resultado
    try {
      const settings = app.settings()
      app.newMailClient().send(
        new MailerMessage({
          from: { address: settings.meta.senderAddress, name: settings.meta.senderName },
          to: destinos.map((d) => ({ address: d })),
          subject: 'Gestor 360 — Resumo gerencial semanal (' + dataBR(hoje) + ')',
          html: html,
          text: texto,
        }),
      )
      resultado = { ok: true, destino: destinos.join(', ') }
    } catch (err) {
      resultado = {
        ok: false,
        destino: destinos.join(', '),
        erro: err && err.message ? err.message : String(err),
      }
    }
    console.log(
      '[alertas] resumo semanal (rota): e-mail ' +
        (resultado.ok ? 'enviado para ' + resultado.destino : 'FALHOU: ' + (resultado.erro || '')),
    )
    return e.json(200, {
      ok: resultado.ok,
      resumo: {
        total_recebido: recebido,
        total_pendente: pendente,
        cobrancas_vencidas: cobrancasVencidas,
        contratos_proximos: contratosProximos.length,
        reajustes_futuros: reajustesFuturos.length,
        pendencias_urgentes: pendenciasUrgentes.length,
      },
      email: resultado,
    })
  } catch (err) {
    console.log('[alertas] ERRO no resumo (rota): ' + ((err && err.message) || err))
    return e.json(500, { ok: false, erro: err && err.message ? err.message : String(err) })
  }
})

// ---------------------- GET /backend/v1/alertas-email/config ----------------------
routerAdd('GET', '/backend/v1/alertas-email/config', (e) => {
  const app = e.app
  const EMAIL_ADMIN = 'advmg.rodrigues@gmail.com'
  const TODAS_CATEGORIAS = [
    'inadimplencia',
    'contratos',
    'reajustes',
    'pendencias',
    'resumo_semanal',
  ]

  function cfgJson(chave, padrao) {
    try {
      const bruto = app
        .findFirstRecordByData('configuracoes', 'chave', chave)
        .getString('valor_json')
      if (!bruto) return padrao
      const parsed = JSON.parse(bruto)
      if (Array.isArray(padrao)) return Array.isArray(parsed) ? parsed : padrao
      if (
        parsed &&
        typeof parsed === 'object' &&
        !Array.isArray(parsed) &&
        padrao &&
        typeof padrao === 'object'
      ) {
        return Object.assign({}, padrao, parsed)
      }
      return parsed === null || parsed === undefined ? padrao : parsed
    } catch (_) {
      return padrao
    }
  }
  function cfgRecebedores() {
    const lista = cfgJson('alertas_email_destinatarios', [EMAIL_ADMIN])
    const validos = []
    for (const item of lista) {
      const t = String(item || '')
        .trim()
        .toLowerCase()
      if (/^[^\s@]+@[^\s@]+\.[^\s@]+$/.test(t) && validos.indexOf(t) === -1) validos.push(t)
    }
    return validos.length ? validos : [EMAIL_ADMIN]
  }

  let adminEmail = EMAIL_ADMIN
  try {
    const admin = app.findAuthRecordByEmail('_pb_users_auth_', EMAIL_ADMIN)
    if (admin && admin.email()) adminEmail = String(admin.email())
  } catch (_) {}
  const teste = cfgJson('alertas_email_teste', {})
  const categorias = cfgJson('alertas_email_categorias', {})
  const saida = {}
  for (const cat of TODAS_CATEGORIAS) saida[cat] = categorias[cat] !== false
  return e.json(200, {
    ok: true,
    admin_email: adminEmail,
    destinatarios: cfgRecebedores(),
    categorias: saida,
    agendamento: cfgJson('alertas_email_agendamento', {
      diaria_hora_utc: 10,
      semanal_dow: 1,
      semanal_hora_utc: 10,
    }),
    ultimo_teste: {
      executado_em: teste.executado_em || '',
      resultado: teste.resultado || '',
      sucesso: teste.sucesso === true,
    },
  })
})

// ---------------------- POST /backend/v1/alertas-email/config (salvar) ----------------------
routerAdd('POST', '/backend/v1/alertas-email/config', (e) => {
  const app = e.app
  const EMAIL_ADMIN = 'advmg.rodrigues@gmail.com'
  const TODAS_CATEGORIAS = [
    'inadimplencia',
    'contratos',
    'reajustes',
    'pendencias',
    'resumo_semanal',
  ]

  function cfgJson(chave, padrao) {
    try {
      const bruto = app
        .findFirstRecordByData('configuracoes', 'chave', chave)
        .getString('valor_json')
      if (!bruto) return padrao
      const parsed = JSON.parse(bruto)
      return Array.isArray(padrao)
        ? Array.isArray(parsed)
          ? parsed
          : padrao
        : parsed === null || parsed === undefined
          ? padrao
          : parsed
    } catch (_) {
      return padrao
    }
  }
  function cfgSalvar(chave, valor) {
    try {
      const rec = app.findFirstRecordByData('configuracoes', 'chave', chave)
      rec.set('valor_json', JSON.stringify(valor))
      app.save(rec)
    } catch (_) {
      const rec = new Record(app.findCollectionByNameOrId('configuracoes'))
      rec.set('chave', chave)
      rec.set('valor_json', JSON.stringify(valor))
      rec.set('descricao', 'Configuração de notificações por e-mail (Central de Alertas)')
      app.save(rec)
    }
  }

  const corpo = e.requestInfo().body || {}
  if (corpo.destinatarios !== undefined) {
    const lista = Array.isArray(corpo.destinatarios) ? corpo.destinatarios : []
    const validos = []
    for (const item of lista) {
      const t = String(item || '')
        .trim()
        .toLowerCase()
      if (/^[^\s@]+@[^\s@]+\.[^\s@]+$/.test(t) && validos.indexOf(t) === -1) validos.push(t)
    }
    if (validos.length === 0)
      return e.json(400, {
        ok: false,
        erro: 'Informe pelo menos um e-mail de destinatário válido.',
      })
    cfgSalvar('alertas_email_destinatarios', validos)
  }
  if (
    corpo.categorias &&
    typeof corpo.categorias === 'object' &&
    !Array.isArray(corpo.categorias)
  ) {
    const atual = cfgJson('alertas_email_categorias', {})
    for (const cat of TODAS_CATEGORIAS) {
      if (corpo.categorias[cat] !== undefined) atual[cat] = corpo.categorias[cat] === true
    }
    cfgSalvar('alertas_email_categorias', atual)
  }
  return e.json(200, { ok: true })
})

// ---------------------- crons ----------------------
// O corpo é igual ao das rotas — a JSVM não permite compartilhar escopo
// top-level entre callbacks, então a lógica fica inline também aqui.

cronAdd('alertas_email_verificar', '0 10 * * *', () => {
  const app = $app
  const EMAIL_ADMIN = 'advmg.rodrigues@gmail.com'
  const TODAS_CATEGORIAS = [
    'inadimplencia',
    'contratos',
    'reajustes',
    'pendencias',
    'resumo_semanal',
  ]
  const DIAS_JANELAS = [120, 90, 60, 30, 15, 7]

  function hojeStr() {
    const d = new Date()
    const p = (n) => String(n).padStart(2, '0')
    return d.getFullYear() + '-' + p(d.getMonth() + 1) + '-' + p(d.getDate())
  }
  function diffDias(isoA, isoB) {
    const a = String(isoA).split('-').map(Number)
    const b = String(isoB).split('-').map(Number)
    return Math.round((Date.UTC(a[0], a[1] - 1, a[2]) - Date.UTC(b[0], b[1] - 1, b[2])) / 86400000)
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
  function mesProximoDe(anoMes) {
    const p = String(anoMes).split('-').map(Number)
    let y = p[0]
    let m = p[1] + 1
    if (m > 12) {
      m = 1
      y++
    }
    return y + '-' + String(m).padStart(2, '0')
  }
  function ehData(iso) {
    return /^\d{4}-\d{2}-\d{2}$/.test(String(iso || ''))
  }
  function esc(txt) {
    return String(txt || '')
      .replace(/&/g, '&amp;')
      .replace(/</g, '&lt;')
      .replace(/>/g, '&gt;')
  }
  function cfgJson(chave, padrao) {
    try {
      const rec = app.findFirstRecordByData('configuracoes', 'chave', chave)
      const bruto = rec.getString('valor_json')
      if (!bruto) return padrao
      const parsed = JSON.parse(bruto)
      if (Array.isArray(padrao)) return Array.isArray(parsed) ? parsed : padrao
      if (
        parsed &&
        typeof parsed === 'object' &&
        !Array.isArray(parsed) &&
        padrao &&
        typeof padrao === 'object'
      ) {
        return Object.assign({}, padrao, parsed)
      }
      return parsed === null || parsed === undefined ? padrao : parsed
    } catch (_) {
      return padrao
    }
  }
  function cfgCategorias() {
    const mapa = cfgJson('alertas_email_categorias', {})
    const out = {}
    for (const cat of TODAS_CATEGORIAS) out[cat] = mapa[cat] !== false
    return out
  }
  function cfgRecebedores() {
    const lista = cfgJson('alertas_email_destinatarios', [EMAIL_ADMIN])
    const validos = []
    for (const item of lista) {
      const t = String(item || '')
        .trim()
        .toLowerCase()
      if (/^[^\s@]+@[^\s@]+\.[^\s@]+$/.test(t) && validos.indexOf(t) === -1) validos.push(t)
    }
    return validos.length ? validos : [EMAIL_ADMIN]
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
  function rotuloInquilino(id) {
    try {
      return app.findRecordById('inquilinos', id).getString('nome')
    } catch (_) {
      return ''
    }
  }
  function inquilinoDeContrato(contratoId) {
    try {
      return app.findRecordById('contratos', contratoId).getString('inquilino')
    } catch (_) {
      return ''
    }
  }
  function rotuloContrato(id) {
    try {
      return 'Contrato ' + app.findRecordById('contratos', id).getString('numero')
    } catch (_) {
      return ''
    }
  }
  function buscar(colecao, filtro, sort, limite) {
    try {
      return app.findRecordsByFilter(colecao, filtro, sort, limite || 500, 0)
    } catch (err) {
      console.log('[alertas] erro ao consultar ' + colecao + ': ' + ((err && err.message) || err))
      return []
    }
  }

  try {
    const hoje = hojeStr()
    const mesSeguinte = mesProximoDe(hoje.slice(0, 7))
    const categorias = cfgCategorias()

    const candidatos = []
    // 1) cobranças vencidas sem pagamento integral
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
      if (!ehData(venc) || venc > hoje) continue
      const dias = diffDias(hoje, venc)
      const rotulo = [
        rotuloInquilino(cob.getString('inquilino')),
        rotuloImovel(cob.getString('imovel')),
      ]
        .filter(Boolean)
        .join(' — ')
      candidatos.push({
        evento: 'cobranca_vencida',
        categoria: 'inadimplencia',
        severidade: dias > 15 ? 'urgente' : 'alta',
        titulo:
          'Aluguel vencido há ' + dias + ' dia(s) — ' + (rotulo || 'Cobrança de ' + dataBR(venc)),
        mensagem:
          'Cobrança da competência ' +
          cob.getString('competencia') +
          ', vencida em ' +
          dataBR(venc) +
          ' (há ' +
          dias +
          ' dia(s)). Saldo devedor de ' +
          brl(saldo) +
          ' (total ' +
          brl(total) +
          ', pago ' +
          brl(pago) +
          ').',
        ref_id: cob.id,
        ref_rotulo: rotulo,
        ref_valor: saldo,
        ref_data: venc,
        ref_data_fim: '',
        ref_status: 'vencido há ' + dias + ' dias',
        acao: 'Cobrar o inquilino e registrar a baixa em Financeiro.',
      })
    }
    // 2) contratos vencendo dentro das janelas 120/90/60/30/15/7
    for (const c of buscar(
      'contratos',
      "status != 'encerrado' && status != 'distratado'",
      'data_fim',
    )) {
      const fim = c.getString('data_fim')
      if (!ehData(fim)) continue
      const dias = diffDias(hoje, fim)
      if (dias < 0 || dias > DIAS_JANELAS[0]) continue
      let faixa = 0
      for (const j of DIAS_JANELAS) {
        if (dias <= j) {
          faixa = j
          break
        }
      }
      if (!faixa) continue
      const rotulo = [
        rotuloInquilino(c.getString('inquilino')),
        rotuloImovel(c.getString('imovel')),
      ]
        .filter(Boolean)
        .join(' — ')
      candidatos.push({
        evento: 'contrato_vencendo',
        categoria: 'contratos',
        severidade: dias <= 15 ? 'alta' : dias <= 30 ? 'media' : 'info',
        titulo:
          'Contrato vence em ' +
          dias +
          ' dia(s) — ' +
          (rotuloImovel(c.getString('imovel')) || c.getString('numero')),
        mensagem:
          'O contrato ' +
          c.getString('numero') +
          ' (' +
          (rotuloInquilino(c.getString('inquilino')) || 'inquilino') +
          ') do imóvel ' +
          (rotuloImovel(c.getString('imovel')) || '—') +
          ' termina em ' +
          dataBR(fim) +
          ' — faltam ' +
          dias +
          ' dia(s).',
        ref_id: c.id,
        ref_rotulo: rotulo,
        ref_valor: c.getFloat('valor_atual') || 0,
        ref_data: fim,
        ref_data_fim: fim,
        ref_status: 'vence em ' + dias + ' dias (faixa ' + faixa + ' dias)',
        acao: 'Negociar renovação/prorrogação e registrar em Renovações.',
      })
    }
    // 3) reajustes com data-base prevista para o próximo mês
    for (const r of buscar('reajustes', "status = 'aguardando_aprovacao'", 'data_base')) {
      const base = r.getString('data_base')
      if (!ehData(base) || base.slice(0, 7) !== mesSeguinte) continue
      const contratoId = r.getString('contrato')
      const rotulo = [rotuloInquilino(inquilinoDeContrato(contratoId)), rotuloContrato(contratoId)]
        .filter(Boolean)
        .join(' — ')
      const pct = r.getFloat('percentual_aplicavel') || 0
      const antigo = r.getFloat('aluguel_anterior') || 0
      const novo = r.getFloat('aluguel_novo_projetado') || r.getFloat('aluguel_novo_aprovado') || 0
      candidatos.push({
        evento: 'reajuste_previsto',
        categoria: 'reajustes',
        severidade: 'media',
        titulo: 'Reajuste previsto para ' + dataBR(base) + (rotulo ? ' — ' + rotulo : ''),
        mensagem:
          'Reajuste com data-base em ' +
          dataBR(base) +
          ' (' +
          r.getString('indice') +
          ' de ' +
          pct +
          '%). Aluguel de ' +
          brl(antigo) +
          ' para ' +
          brl(novo) +
          '. Status: aguardando aprovação.',
        ref_id: r.id,
        ref_rotulo: rotulo,
        ref_valor: novo - antigo,
        ref_data: base,
        ref_data_fim: '',
        ref_status: 'aguardando aprovação',
        acao: 'Aprovar e aplicar o reajuste em Reajustes.',
      })
    }
    // 4) pendências com prazo vencido ou nos próximos dias
    for (const p of buscar(
      'pendencias',
      "status = 'pendente' || status = 'em_andamento'",
      'prazo',
    )) {
      const prazo = p.getString('prazo')
      if (!ehData(prazo)) continue
      const dias = diffDias(hoje, prazo)
      if (dias > 7) continue
      const vencida = dias < 0
      const rotulo = [
        p.getString('imovel') ? rotuloImovel(p.getString('imovel')) : '',
        p.getString('inquilino') ? rotuloInquilino(p.getString('inquilino')) : '',
      ]
        .filter(Boolean)
        .join(' — ')
      candidatos.push({
        evento: 'pendencia_prazo',
        categoria: 'pendencias',
        severidade: vencida ? 'urgente' : 'alta',
        titulo:
          (vencida ? 'Pendência com prazo vencido' : 'Pendência vence em ' + dias + ' dia(s)') +
          ' — ' +
          p.getString('titulo'),
        mensagem:
          p.getString('titulo') +
          ' (prioridade ' +
          p.getString('prioridade') +
          '). Prazo ' +
          dataBR(prazo) +
          ' — ' +
          (vencida ? 'vencido há ' + Math.abs(dias) + ' dia(s).' : 'vence em ' + dias + ' dia(s).'),
        ref_id: p.id,
        ref_rotulo: rotulo || p.getString('responsavel'),
        ref_valor: 0,
        ref_data: prazo,
        ref_data_fim: '',
        ref_status: vencida
          ? 'vencida há ' + Math.abs(dias) + ' dias'
          : 'vence em ' + dias + ' dias',
        acao: 'Resolver a pendência em Pendências.',
      })
    }

    const filtrados = candidatos.filter((a) => categorias[a.categoria] !== false)

    // desliga alertas cujo registro de origem já foi resolvido
    const grupos = [
      { categoria: 'pendencias', colecao: 'pendencias', fechados: ['resolvida', 'cancelada'] },
      {
        categoria: 'reajustes',
        colecao: 'reajustes',
        fechados: ['aprovado', 'rejeitado', 'nao_aplicado'],
      },
    ]
    for (const g of grupos) {
      for (const rec of buscar(
        'alertas_email',
        "ativo = true && categoria = '" + g.categoria + "'",
        '',
      )) {
        let aberto = true
        try {
          const st = app.findRecordById(g.colecao, rec.getString('ref_id')).getString('status')
          if (g.fechados.indexOf(st) !== -1) aberto = false
        } catch (_) {
          aberto = false
        }
        if (!aberto) {
          rec.set('ativo', false)
          app.save(rec)
        }
      }
    }
    for (const rec of buscar('alertas_email', "ativo = true && categoria = 'contratos'", '')) {
      const fim = rec.getString('ref_data_fim')
      if (!ehData(fim)) continue
      const dias = diffDias(hoje, fim)
      if (dias < 0) {
        rec.set('ativo', false)
        rec.set('ref_status', 'contrato encerrado')
        app.save(rec)
      } else if (dias > DIAS_JANELAS[0]) {
        rec.set('ativo', false)
        app.save(rec)
      }
    }

    // deduplicação por chave (evento + referência)
    const novos = []
    for (const a of filtrados) {
      const chave = a.evento + '|' + a.ref_id
      let existente = null
      try {
        const achados = app.findRecordsByFilter(
          'alertas_email',
          "chave = '" + chave + "'",
          '',
          1,
          0,
        )
        if (achados.length > 0) existente = achados[0]
      } catch (_) {
        existente = null
      }
      if (existente) {
        if (!existente.getBool('ativo')) {
          existente.set('ativo', true)
          existente.set('email_enviado', false)
          existente.set('titulo', a.titulo)
          existente.set('mensagem', a.mensagem)
          existente.set('ref_status', a.ref_status)
          app.save(existente)
          novos.push(existente)
        }
        continue // já existe e está ativo: não recria, não reenvia
      }
      const rec = new Record(app.findCollectionByNameOrId('alertas_email'))
      rec.set('chave', chave)
      rec.set('evento', a.evento)
      rec.set('categoria', a.categoria)
      rec.set('severidade', a.severidade)
      rec.set('titulo', a.titulo)
      rec.set('mensagem', a.mensagem)
      rec.set('ref_id', a.ref_id || '')
      rec.set('ref_rotulo', a.ref_rotulo || '')
      rec.set('ref_valor', a.ref_valor || 0)
      rec.set('ref_data', a.ref_data || '')
      rec.set('ref_data_fim', a.ref_data_fim || '')
      rec.set('ref_status', a.ref_status || '')
      rec.set('acao', a.acao || '')
      rec.set('email_enviado', false)
      rec.set('ativo', true)
      rec.set('is_demo', false)
      app.save(rec)
      novos.push(rec)
    }

    const ativos = buscar('alertas_email', 'ativo = true', '-created')
    const aguardandoEnvio = ativos.filter((r) => !r.getBool('email_enviado'))
    let enviou = false
    let destinoFinal = ''
    if (aguardandoEnvio.length > 0 && ativos.length > 0) {
      const ROTULO_SEV = { urgente: 'Urgente', alta: 'Alta', media: 'Média', info: 'Informativo' }
      const COR_SEV = { urgente: '#b91c1c', alta: '#b45309', media: '#4d7c0f', info: '#475569' }
      const ORDEM_SEV = { urgente: 0, alta: 1, media: 2, info: 3 }
      const linhas = ativos.map((rec) => {
        const sev = rec.getString('severidade') || 'info'
        return {
          ordem: ORDEM_SEV[sev] !== undefined ? ORDEM_SEV[sev] : 9,
          rotulo: ROTULO_SEV[sev] || sev,
          cor: COR_SEV[sev] || COR_SEV.info,
          texto:
            esc(rec.getString('titulo')) +
            (rec.getString('mensagem')
              ? '<br><span style="color:#475569;font-size:12px">' +
                esc(rec.getString('mensagem')) +
                '</span>'
              : ''),
        }
      })
      linhas.sort((a, b) => a.ordem - b.ordem)
      let itens = ''
      for (const l of linhas) {
        itens +=
          '<li style="margin-bottom:10px"><span style="color:' +
          l.cor +
          ';font-weight:bold">[' +
          l.rotulo +
          ']</span> ' +
          l.texto +
          '</li>'
      }
      const html =
        '<div style="font-family:Arial,Helvetica,sans-serif;font-size:14px;color:#0f172a">' +
        '<h2 style="margin:0 0 4px 0;color:#059669">Gestor Imobiliário 360</h2>' +
        '<p style="margin:0 0 4px 0;color:#475569">Alertas em aberto — ' +
        dataBR(hoje) +
        '</p>' +
        '<p style="margin:0 0 12px 0;color:#94a3b8;font-size:11px">' +
        novos.length +
        ' alerta(s) novo(s) neste envio; ' +
        ativos.length +
        ' em aberto no total.</p>' +
        '<ul style="padding-left:18px;margin:0 0 12px 0">' +
        itens +
        '</ul>' +
        '<p style="margin:12px 0 0 0;color:#94a3b8;font-size:12px">Central de Alertas e Notificações — mensagem gerada automaticamente pelo sistema.</p></div>'
      const texto = ativos
        .map(
          (r) =>
            '[' +
            (ROTULO_SEV[r.getString('severidade')] || '') +
            '] ' +
            r.getString('titulo') +
            '\n' +
            r.getString('mensagem'),
        )
        .join('\n\n')
      const destinos = cfgRecebedores()
      try {
        const settings = app.settings()
        app.newMailClient().send(
          new MailerMessage({
            from: { address: settings.meta.senderAddress, name: settings.meta.senderName },
            to: destinos.map((d) => ({ address: d })),
            subject:
              'Gestor 360 — ' + ativos.length + ' alerta(s) em aberto (' + dataBR(hoje) + ')',
            html: html,
            text: texto,
          }),
        )
        enviou = true
        destinoFinal = destinos.join(', ')
      } catch (errEnvio) {
        console.log(
          '[alertas] falha no envio do e-mail diário: ' +
            ((errEnvio && errEnvio.message) || errEnvio),
        )
      }
      if (enviou) {
        for (const rec of aguardandoEnvio) {
          rec.set('email_enviado', true)
          app.save(rec)
        }
      }
    }
    console.log(
      '[alertas] varredura (cron_diario): ' +
        filtrados.length +
        ' candidato(s), ' +
        novos.length +
        ' novo(s), ' +
        ativos.length +
        ' em aberto; e-mail ' +
        (enviou ? 'enviado para ' + destinoFinal : 'não enviado'),
    )
  } catch (err) {
    console.log('[alertas] ERRO no cron diário: ' + ((err && err.message) || err))
  }
})

cronAdd('alertas_email_resumo', '0 10 * * 1', () => {
  const app = $app
  const EMAIL_ADMIN = 'advmg.rodrigues@gmail.com'

  function hojeStr() {
    const d = new Date()
    const p = (n) => String(n).padStart(2, '0')
    return d.getFullYear() + '-' + p(d.getMonth() + 1) + '-' + p(d.getDate())
  }
  function diffDias(isoA, isoB) {
    const a = String(isoA).split('-').map(Number)
    const b = String(isoB).split('-').map(Number)
    return Math.round((Date.UTC(a[0], a[1] - 1, a[2]) - Date.UTC(b[0], b[1] - 1, b[2])) / 86400000)
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
  function mesProximoDe(anoMes) {
    const p = String(anoMes).split('-').map(Number)
    let y = p[0]
    let m = p[1] + 1
    if (m > 12) {
      m = 1
      y++
    }
    return y + '-' + String(m).padStart(2, '0')
  }
  function ehData(iso) {
    return /^\d{4}-\d{2}-\d{2}$/.test(String(iso || ''))
  }
  function esc(txt) {
    return String(txt || '')
      .replace(/&/g, '&amp;')
      .replace(/</g, '&lt;')
      .replace(/>/g, '&gt;')
  }
  function cfgJson(chave, padrao) {
    try {
      const bruto = app
        .findFirstRecordByData('configuracoes', 'chave', chave)
        .getString('valor_json')
      if (!bruto) return padrao
      const parsed = JSON.parse(bruto)
      return Array.isArray(padrao)
        ? Array.isArray(parsed)
          ? parsed
          : padrao
        : parsed === null || parsed === undefined
          ? padrao
          : parsed
    } catch (_) {
      return padrao
    }
  }
  function cfgRecebedores() {
    const lista = cfgJson('alertas_email_destinatarios', [EMAIL_ADMIN])
    const validos = []
    for (const item of lista) {
      const t = String(item || '')
        .trim()
        .toLowerCase()
      if (/^[^\s@]+@[^\s@]+\.[^\s@]+$/.test(t) && validos.indexOf(t) === -1) validos.push(t)
    }
    return validos.length ? validos : [EMAIL_ADMIN]
  }
  function rotuloImovel(imovelId) {
    try {
      const im = app.findRecordById('imoveis', imovelId)
      const end = im.getString('endereco')
      const num = im.getString('numero')
      const bairro = im.getString('bairro')
      let txt = end ? end + (num ? ', ' + num : '') : ''
      if (bairro) txt += ' (' + bairro + ')'
      return txt
    } catch (_) {
      return ''
    }
  }
  function rotuloInquilino(id) {
    try {
      return app.findRecordById('inquilinos', id).getString('nome')
    } catch (_) {
      return ''
    }
  }
  function rotuloContrato(id) {
    try {
      return 'Contrato ' + app.findRecordById('contratos', id).getString('numero')
    } catch (_) {
      return ''
    }
  }
  function inquilinoDeContrato(contratoId) {
    try {
      return app.findRecordById('contratos', contratoId).getString('inquilino')
    } catch (_) {
      return ''
    }
  }
  function buscar(colecao, filtro, sort, limite) {
    try {
      return app.findRecordsByFilter(colecao, filtro, sort, limite || 500, 0)
    } catch (err) {
      console.log('[alertas] erro ao consultar ' + colecao + ': ' + ((err && err.message) || err))
      return []
    }
  }

  try {
    const hoje = hojeStr()
    const mesSeguinte = mesProximoDe(hoje.slice(0, 7))
    const bimestreSeguinte = mesProximoDe(mesSeguinte)

    let recebido = 0
    let pendente = 0
    let cobrancasVencidas = 0
    const maioresAtrasos = []
    for (const c of buscar('cobrancas', '', '-vencimento', 1000)) {
      const pago = c.getFloat('valor_pago') || 0
      const total = c.getFloat('valor_total') || 0
      recebido += pago
      const st = c.getString('status')
      const saldo = total - pago
      if (
        (st === 'vencido' || st === 'pago_parcialmente') &&
        saldo > 0.005 &&
        !c.getString('data_pagamento')
      ) {
        pendente += saldo
        cobrancasVencidas++
        maioresAtrasos.push({
          rotulo: [rotuloInquilino(c.getString('inquilino')), rotuloImovel(c.getString('imovel'))]
            .filter(Boolean)
            .join(' — '),
          venc: c.getString('vencimento'),
          saldo: saldo,
        })
      }
    }
    maioresAtrasos.sort((a, b) => String(a.venc).localeCompare(String(b.venc)))

    const contratosProximos = []
    for (const c of buscar(
      'contratos',
      "status != 'encerrado' && status != 'distratado'",
      'data_fim',
    )) {
      const fim = c.getString('data_fim')
      if (!ehData(fim)) continue
      const dias = diffDias(hoje, fim)
      if (dias >= 0 && dias <= 60) {
        contratosProximos.push({
          numero: c.getString('numero'),
          rotulo: [rotuloInquilino(c.getString('inquilino')), rotuloImovel(c.getString('imovel'))]
            .filter(Boolean)
            .join(' — '),
          fim: fim,
          dias: dias,
        })
      }
    }

    const reajustesFuturos = []
    for (const r of buscar('reajustes', "status = 'aguardando_aprovacao'", 'data_base')) {
      const base = r.getString('data_base')
      if (!ehData(base)) continue
      const mes = base.slice(0, 7)
      if (mes === mesSeguinte || mes === bimestreSeguinte) {
        reajustesFuturos.push({
          rotulo: [
            rotuloInquilino(inquilinoDeContrato(r.getString('contrato'))),
            rotuloContrato(r.getString('contrato')),
          ]
            .filter(Boolean)
            .join(' — '),
          base: base,
          pct: r.getFloat('percentual_aplicavel') || 0,
        })
      }
    }

    const pendenciasUrgentes = []
    for (const p of buscar(
      'pendencias',
      "status = 'pendente' || status = 'em_andamento'",
      'prazo',
    )) {
      const prio = p.getString('prioridade')
      if (prio !== 'urgente' && prio !== 'alta') continue
      pendenciasUrgentes.push({
        titulo: p.getString('titulo'),
        prazo: p.getString('prazo'),
        prioridade: prio,
      })
    }
    pendenciasUrgentes.sort((a, b) => String(a.prazo || '').localeCompare(String(b.prazo || '')))

    const providencias = []
    if (cobrancasVencidas > 0)
      providencias.push(
        'Acionar os inquilinos com aluguel em atraso (' +
          cobrancasVencidas +
          ' cobrança(s)) e registrar as baixas em Financeiro.',
      )
    if (contratosProximos.length > 0)
      providencias.push(
        'Iniciar a negociação de renovação dos ' +
          contratosProximos.length +
          ' contrato(s) que vencem em até 60 dias.',
      )
    if (reajustesFuturos.length > 0)
      providencias.push(
        'Aprovar e aplicar os ' +
          reajustesFuturos.length +
          ' reajuste(s) previsto(s) para o próximo bimestre.',
      )
    if (pendenciasUrgentes.length > 0)
      providencias.push(
        'Tratar as ' + pendenciasUrgentes.length + ' pendência(s) de prioridade urgente/alta.',
      )
    if (providencias.length === 0)
      providencias.push('Nenhuma providência crítica no momento — carteira em dia.')

    const lista = (arr, formatter, vazio) => {
      if (!arr || arr.length === 0)
        return '<p style="margin:0 0 10px 0;color:#475569">' + vazio + '</p>'
      let out = '<ul style="padding-left:18px;margin:0 0 12px 0">'
      for (const item of arr) out += '<li style="margin-bottom:4px">' + formatter(item) + '</li>'
      return out + '</ul>'
    }

    let html =
      '<div style="font-family:Arial,Helvetica,sans-serif;font-size:14px;color:#0f172a">' +
      '<h2 style="margin:0 0 4px 0;color:#059669">Gestor Imobiliário 360</h2>' +
      '<p style="margin:0 0 4px 0;color:#475569">Resumo gerencial semanal — ' +
      dataBR(hoje) +
      '</p>' +
      '<p style="margin:0 0 12px 0;color:#94a3b8;font-size:11px">Totais da carteira, vencimentos, reajustes e pendências.</p>'
    html +=
      '<table style="border-collapse:collapse;margin:0 0 14px 0">' +
      '<tr><td style="padding:3px 14px 3px 0;color:#475569">Total recebido (acumulado registrado):</td><td style="font-weight:bold">' +
      brl(recebido) +
      '</td></tr>' +
      '<tr><td style="padding:3px 14px 3px 0;color:#475569">Total pendente (cobranças em atraso):</td><td style="font-weight:bold;color:#b91c1c">' +
      brl(pendente) +
      ' em ' +
      cobrancasVencidas +
      ' cobrança(s)</td></tr></table>'
    html +=
      '<h3 style="margin:0 0 6px 0;font-size:13px">Contratos próximos do vencimento (60 dias)</h3>'
    html += lista(
      contratosProximos,
      (c) =>
        esc(c.numero) +
        ' — ' +
        esc(c.rotulo) +
        ' — término em ' +
        dataBR(c.fim) +
        ' (' +
        c.dias +
        ' dias)',
      'Nenhum contrato vence nos próximos 60 dias.',
    )
    html += '<h3 style="margin:0 0 6px 0;font-size:13px">Reajustes futuros (próximo bimestre)</h3>'
    html += lista(
      reajustesFuturos,
      (r) => esc(r.rotulo) + ' — data-base ' + dataBR(r.base) + ' (' + r.pct + '%)',
      'Nenhum reajuste previsto para o próximo bimestre.',
    )
    html += '<h3 style="margin:0 0 6px 0;font-size:13px">Pendências urgentes</h3>'
    html += lista(
      pendenciasUrgentes,
      (p) => '[' + esc(p.prioridade) + '] ' + esc(p.titulo) + ' — prazo ' + dataBR(p.prazo),
      'Nenhuma pendência urgente em aberto.',
    )
    html += '<h3 style="margin:0 0 6px 0;font-size:13px">Maiores atrasos</h3>'
    html += lista(
      maioresAtrasos.slice(0, 10),
      (c) => esc(c.rotulo) + ' — vencida em ' + dataBR(c.venc) + ' — saldo ' + brl(c.saldo),
      'Nenhuma cobrança em atraso.',
    )
    html += '<h3 style="margin:0 0 6px 0;font-size:13px">Principais providências</h3>'
    html += lista(providencias, (p) => esc(p), '—')
    html +=
      '<p style="margin:12px 0 0 0;color:#94a3b8;font-size:12px">Central de Alertas e Notificações — mensagem gerada automaticamente pelo sistema.</p></div>'

    const texto =
      'Resumo gerencial semanal (' +
      dataBR(hoje) +
      ')\n' +
      'Total recebido: ' +
      brl(recebido) +
      '\n' +
      'Total pendente: ' +
      brl(pendente) +
      ' em ' +
      cobrancasVencidas +
      ' cobrança(s)\n' +
      'Contratos a vencer em 60 dias: ' +
      contratosProximos.length +
      '\n' +
      'Reajustes no próximo bimestre: ' +
      reajustesFuturos.length +
      '\n' +
      'Pendências urgentes: ' +
      pendenciasUrgentes.length +
      '\n' +
      'Providências: ' +
      providencias.join(' ')

    const destinos = cfgRecebedores()
    try {
      const settings = app.settings()
      app.newMailClient().send(
        new MailerMessage({
          from: { address: settings.meta.senderAddress, name: settings.meta.senderName },
          to: destinos.map((d) => ({ address: d })),
          subject: 'Gestor 360 — Resumo gerencial semanal (' + dataBR(hoje) + ')',
          html: html,
          text: texto,
        }),
      )
      console.log(
        '[alertas] resumo semanal (cron_semanal): e-mail enviado para ' + destinos.join(', '),
      )
    } catch (errEnvio) {
      console.log(
        '[alertas] falha no envio do resumo semanal: ' +
          ((errEnvio && errEnvio.message) || errEnvio),
      )
    }
  } catch (err) {
    console.log('[alertas] ERRO no cron semanal: ' + ((err && err.message) || err))
  }
})
