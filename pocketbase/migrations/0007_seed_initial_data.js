migrate(
  (app) => {
    // 1. Seed admin user
    const users = app.findCollectionByNameOrId('_pb_users_auth_')
    let adminId = ''
    try {
      const existing = app.findAuthRecordByEmail('_pb_users_auth_', 'advmg.rodrigues@gmail.com')
      adminId = existing.id
    } catch (_) {
      const admin = new Record(users)
      admin.setEmail('advmg.rodrigues@gmail.com')
      admin.setPassword('Skip@Pass')
      admin.setVerified(true)
      admin.set('name', 'Administrador Geral')
      admin.set('role', 'admin')
      admin.set('phone', '(11) 98765-4321')
      app.save(admin)
      adminId = admin.id
    }

    // 2. Default Configurações
    const configCol = app.findCollectionByNameOrId('configuracoes')
    const defaultConfigs = [
      {
        chave: 'alertas_prazos',
        valor_json: JSON.stringify({
          renovacao_dias: [120, 90, 60, 30, 15, 7],
          reajuste_antecedencia_dias: 60,
          inadimplencia_tolerancia_dias: 1,
          vencimento_fim_de_semana: 'proximo_dia_util',
        }),
        descricao: 'Prazos de alerta e regras de vencimento',
      },
      {
        chave: 'indices_reajuste',
        valor_json: JSON.stringify({
          IPCA_atual: 4.5,
          IGPM_atual: 5.2,
          INPC_atual: 4.1,
          fonte_padrao: 'IBGE / FGV',
          atualizacao: '2026-11',
        }),
        descricao: 'Índices oficiais de referência para reajuste de aluguel',
      },
      {
        chave: 'empresa_dados',
        valor_json: JSON.stringify({
          nome_fantasia: 'Gestor Imobiliário 360',
          razao_social: 'Gestão Patrimonial Inteligente Ltda',
          cnpj: '12.345.678/0001-90',
          endereco: 'Av. Paulista, 1000 - Bela Vista, São Paulo - SP',
          telefone: '(11) 3000-0000',
          email: 'contato@gestor360.com.br',
        }),
        descricao: 'Dados cadastrais da administradora para cabeçalho de recibos e relatórios',
      },
    ]

    for (const cfg of defaultConfigs) {
      try {
        app.findFirstRecordByFilter('configuracoes', `chave = '${cfg.chave}'`)
      } catch (_) {
        const rec = new Record(configCol)
        rec.set('chave', cfg.chave)
        rec.set('valor_json', cfg.valor_json)
        rec.set('descricao', cfg.descricao)
        app.save(rec)
      }
    }

    // 3. Proprietários (PF e PJ)
    const propCol = app.findCollectionByNameOrId('proprietarios')
    let prop1Id = ''
    let prop2Id = ''

    try {
      const existing = app.findFirstRecordByFilter('proprietarios', "cpf_cnpj = '123.456.789-00'")
      prop1Id = existing.id
    } catch (_) {
      const p1 = new Record(propCol)
      p1.set('tipo_pessoa', 'PF')
      p1.set('nome', 'Dr. Roberto Carlos da Silva')
      p1.set('cpf_cnpj', '123.456.789-00')
      p1.set('rg_ie', '12.345.678-9 SSP/SP')
      p1.set('email', 'roberto.silva@patrimonio.com')
      p1.set('telefone', '(11) 99876-1111')
      p1.set('whatsapp', '(11) 99876-1111')
      p1.set('endereco', 'Rua dos Pinheiros, 450 - São Paulo/SP')
      p1.set('banco_nome', 'Itaú')
      p1.set('banco_agencia', '1234')
      p1.set('banco_conta', '56789-0')
      p1.set('banco_pix', 'roberto.silva@patrimonio.com')
      p1.set('observacoes', 'Proprietário de 4 imóveis comerciais e residenciais')
      p1.set('is_demo', true)
      app.save(p1)
      prop1Id = p1.id
    }

    try {
      const existing = app.findFirstRecordByFilter(
        'proprietarios',
        "cpf_cnpj = '98.765.432/0001-10'",
      )
      prop2Id = existing.id
    } catch (_) {
      const p2 = new Record(propCol)
      p2.set('tipo_pessoa', 'PJ')
      p2.set('nome', 'Horizonte Participações e Empreendimentos S/A')
      p2.set('cpf_cnpj', '98.765.432/0001-10')
      p2.set('rg_ie', '110.220.330.440')
      p2.set('email', 'financeiro@horizontepart.com.br')
      p2.set('telefone', '(11) 3222-8888')
      p2.set('whatsapp', '(11) 98888-2222')
      p2.set('endereco', 'Av. Faria Lima, 2500 - Itaim Bibi, São Paulo/SP')
      p2.set('banco_nome', 'Bradesco')
      p2.set('banco_agencia', '0543')
      p2.set('banco_conta', '99120-1')
      p2.set('banco_pix', '98765432000110')
      p2.set('observacoes', 'Holding patrimonial familiar')
      p2.set('is_demo', true)
      app.save(p2)
      prop2Id = p2.id
    }

    // 4. Inquilinos (PF e PJ)
    const inqCol = app.findCollectionByNameOrId('inquilinos')
    let inq1Id = ''
    let inq2Id = ''
    let inq3Id = ''

    try {
      const existing = app.findFirstRecordByFilter('inquilinos', "cpf_cnpj = '11.222.333/0001-44'")
      inq1Id = existing.id
    } catch (_) {
      const i1 = new Record(inqCol)
      i1.set('tipo_pessoa', 'PJ')
      i1.set('nome', 'Empresa ABC Soluções Tecnológicas Ltda')
      i1.set('cpf_cnpj', '11.222.333/0001-44')
      i1.set('rg_ie', '145.890.123')
      i1.set('data_nasc_const', '2018-05-10')
      i1.set('email', 'contato@empresaabc.com.br')
      i1.set('telefone', '(11) 4004-1234')
      i1.set('whatsapp', '(11) 97777-1234')
      i1.set('endereco', 'Av. Paulista, 1000 - Sala 501')
      i1.set('representante_legal', 'Carlos Eduardo Ribeiro')
      i1.set('contato_financeiro', 'Mariana Souza (mariana@empresaabc.com.br)')
      i1.set('observacoes', 'Inquilino exemplar, pontual')
      i1.set('is_demo', true)
      app.save(i1)
      inq1Id = i1.id
    }

    try {
      const existing = app.findFirstRecordByFilter('inquilinos', "cpf_cnpj = '22.333.444/0001-55'")
      inq2Id = existing.id
    } catch (_) {
      const i2 = new Record(inqCol)
      i2.set('tipo_pessoa', 'PJ')
      i2.set('nome', 'Boutique & Café Aromas do Brasil ME')
      i2.set('cpf_cnpj', '22.333.444/0001-55')
      i2.set('rg_ie', '200.300.400')
      i2.set('data_nasc_const', '2020-09-15')
      i2.set('email', 'aromas@brasilcafe.com.br')
      i2.set('telefone', '(11) 3456-7890')
      i2.set('whatsapp', '(11) 96666-3333')
      i2.set('endereco', 'Rua Oscar Freire, 800 - Loja 02')
      i2.set('representante_legal', 'Fernanda Lima')
      i2.set('contato_financeiro', 'Fernanda Lima')
      i2.set('observacoes', 'Contrato com reajuste previsto para o próximo mês')
      i2.set('is_demo', true)
      app.save(i2)
      inq2Id = i2.id
    }

    try {
      const existing = app.findFirstRecordByFilter('inquilinos', "cpf_cnpj = '333.444.555-66'")
      inq3Id = existing.id
    } catch (_) {
      const i3 = new Record(inqCol)
      i3.set('tipo_pessoa', 'PF')
      i3.set('nome', 'Dra. Juliana Mendes')
      i3.set('cpf_cnpj', '333.444.555-66')
      i3.set('rg_ie', '25.678.910-1 SSP/SP')
      i3.set('data_nasc_const', '1988-03-22')
      i3.set('email', 'juliana.mendes@consultorio.med.br')
      i3.set('telefone', '(11) 95555-4444')
      i3.set('whatsapp', '(11) 95555-4444')
      i3.set('endereco', 'Rua Bela Cintra, 1200 - Apto 82')
      i3.set('representante_legal', 'A própria')
      i3.set('contato_financeiro', 'Dra. Juliana')
      i3.set('observacoes', 'Aluguel com atraso de 12 dias no mês atual')
      i3.set('is_demo', true)
      app.save(i3)
      inq3Id = i3.id
    }

    // 5. Imóveis
    const imovCol = app.findCollectionByNameOrId('imoveis')
    let imov1Id = ''
    let imov2Id = ''
    let imov3Id = ''
    let imov4Id = ''

    try {
      const existing = app.findFirstRecordByFilter('imoveis', "codigo = 'SALA-01'")
      imov1Id = existing.id
    } catch (_) {
      const m1 = new Record(imovCol)
      m1.set('codigo', 'SALA-01')
      m1.set('nome', 'Sala Comercial 01 — Edifício Corporate Paulista')
      m1.set('tipo', 'sala')
      m1.set('situacao', 'alugado')
      m1.set('endereco', 'Avenida Paulista')
      m1.set('numero', '1000')
      m1.set('complemento', 'Sala 501')
      m1.set('bairro', 'Bela Vista')
      m1.set('cidade', 'São Paulo')
      m1.set('estado', 'SP')
      m1.set('cep', '01310-100')
      m1.set('matricula', '142.890')
      m1.set('inscricao_municipal', '034.120.0091-2')
      m1.set('area_total', 110)
      m1.set('area_construida', 85)
      m1.set('valor_estimado', 850000)
      m1.set('valor_aquisicao', 620000)
      m1.set('data_aquisicao', '2021-03-15')
      m1.set('valor_iptu_mensal', 420)
      m1.set('valor_condominio_mensal', 980)
      m1.set('valor_seguro_mensal', 95)
      m1.set(
        'proprietarios_json',
        JSON.stringify([
          { proprietario_id: prop1Id, nome: 'Dr. Roberto Carlos da Silva', percentual: 100 },
        ]),
      )
      m1.set('observacoes', 'Sala reformada, piso elevado, ar-condicionado central')
      m1.set('is_demo', true)
      app.save(m1)
      imov1Id = m1.id
    }

    try {
      const existing = app.findFirstRecordByFilter('imoveis', "codigo = 'LOJA-02'")
      imov2Id = existing.id
    } catch (_) {
      const m2 = new Record(imovCol)
      m2.set('codigo', 'LOJA-02')
      m2.set('nome', 'Loja Comercial 02 — Galeria Jardins')
      m2.set('tipo', 'loja')
      m2.set('situacao', 'alugado')
      m2.set('endereco', 'Rua Oscar Freire')
      m2.set('numero', '800')
      m2.set('complemento', 'Loja 2')
      m2.set('bairro', 'Cerqueira César')
      m2.set('cidade', 'São Paulo')
      m2.set('estado', 'SP')
      m2.set('cep', '01426-000')
      m2.set('matricula', '98.441')
      m2.set('inscricao_municipal', '012.345.0089-1')
      m2.set('area_total', 140)
      m2.set('area_construida', 120)
      m2.set('valor_estimado', 1500000)
      m2.set('valor_aquisicao', 1100000)
      m2.set('data_aquisicao', '2019-08-20')
      m2.set('valor_iptu_mensal', 750)
      m2.set('valor_condominio_mensal', 1400)
      m2.set('valor_seguro_mensal', 180)
      m2.set(
        'proprietarios_json',
        JSON.stringify([
          { proprietario_id: prop2Id, nome: 'Horizonte Participações S/A', percentual: 100 },
        ]),
      )
      m2.set('observacoes', 'Frente envidraçada, mezanino estruturado')
      m2.set('is_demo', true)
      app.save(m2)
      imov2Id = m2.id
    }

    try {
      const existing = app.findFirstRecordByFilter('imoveis', "codigo = 'LOJA-03'")
      imov3Id = existing.id
    } catch (_) {
      const m3 = new Record(imovCol)
      m3.set('codigo', 'LOJA-03')
      m3.set('nome', 'Loja Comercial 03 — Centro Empresarial Moema')
      m3.set('tipo', 'loja')
      m3.set('situacao', 'alugado')
      m3.set('endereco', 'Avenida Ibirapuera')
      m3.set('numero', '2100')
      m3.set('complemento', 'Loja Térreo')
      m3.set('bairro', 'Moema')
      m3.set('cidade', 'São Paulo')
      m3.set('estado', 'SP')
      m3.set('cep', '04028-001')
      m3.set('matricula', '115.302')
      m3.set('inscricao_municipal', '078.432.0011-9')
      m3.set('area_total', 95)
      m3.set('area_construida', 90)
      m3.set('valor_estimado', 920000)
      m3.set('valor_aquisicao', 730000)
      m3.set('data_aquisicao', '2022-01-10')
      m3.set('valor_iptu_mensal', 510)
      m3.set('valor_condominio_mensal', 850)
      m3.set('valor_seguro_mensal', 110)
      m3.set(
        'proprietarios_json',
        JSON.stringify([
          { proprietario_id: prop1Id, nome: 'Dr. Roberto Carlos da Silva', percentual: 60 },
          { proprietario_id: prop2Id, nome: 'Horizonte Participações S/A', percentual: 40 },
        ]),
      )
      m3.set('observacoes', 'Coproprietários: Roberto Silva (60%) e Horizonte (40%)')
      m3.set('is_demo', true)
      app.save(m3)
      imov3Id = m3.id
    }

    try {
      const existing = app.findFirstRecordByFilter('imoveis', "codigo = 'SALA-05'")
      imov4Id = existing.id
    } catch (_) {
      const m4 = new Record(imovCol)
      m4.set('codigo', 'SALA-05')
      m4.set('nome', 'Conjunto Comercial Sala 05 — Faria Lima Tower')
      m4.set('tipo', 'sala')
      m4.set('situacao', 'disponivel')
      m4.set('endereco', 'Av. Brigadeiro Faria Lima')
      m4.set('numero', '3200')
      m4.set('complemento', 'Conjunto 142')
      m4.set('bairro', 'Itaim Bibi')
      m4.set('cidade', 'São Paulo')
      m4.set('estado', 'SP')
      m4.set('cep', '04538-132')
      m4.set('matricula', '180.992')
      m4.set('inscricao_municipal', '099.112.0044-8')
      m4.set('area_total', 160)
      m4.set('area_construida', 135)
      m4.set('valor_estimado', 1850000)
      m4.set('valor_aquisicao', 1400000)
      m4.set('data_aquisicao', '2023-05-18')
      m4.set('valor_iptu_mensal', 890)
      m4.set('valor_condominio_mensal', 1650)
      m4.set('valor_seguro_mensal', 210)
      m4.set(
        'proprietarios_json',
        JSON.stringify([
          { proprietario_id: prop2Id, nome: 'Horizonte Participações S/A', percentual: 100 },
        ]),
      )
      m4.set('observacoes', 'Conjunto desocupado recentemente, pronto para locação imediata')
      m4.set('is_demo', true)
      app.save(m4)
      imov4Id = m4.id
    }

    // 6. Contratos
    const contCol = app.findCollectionByNameOrId('contratos')
    let cont1Id = ''
    let cont2Id = ''
    let cont3Id = ''

    // Contrato 1: Sala Comercial 01 -> Empresa ABC (vencendo em 45 dias para testar alerta)
    try {
      const existing = app.findFirstRecordByFilter('contratos', "numero = 'CTR-2025-001'")
      cont1Id = existing.id
    } catch (_) {
      const c1 = new Record(contCol)
      c1.set('numero', 'CTR-2025-001')
      c1.set('imovel', imov1Id)
      c1.set('inquilino', inq1Id)
      c1.set('locador_nome', 'Dr. Roberto Carlos da Silva')
      c1.set('data_assinatura', '2025-02-15')
      c1.set('data_inicio', '2025-03-01')
      c1.set('data_fim', '2027-02-28') // término
      c1.set('prazo_meses', 24)
      c1.set('valor_inicial', 3500)
      c1.set('valor_atual', 3500)
      c1.set('dia_vencimento', 10)
      c1.set('periodicidade_reajuste', 'anual')
      c1.set('indice_reajuste', 'IPCA')
      c1.set('data_base_reajuste', '2027-03-01')
      c1.set('garantia_tipo', 'caucao')
      c1.set('garantia_detalhes', 'Caução de 3 meses de aluguel depositada em caderneta vinculada')
      c1.set('garantia_valor', 10500)
      c1.set('multa_rescisoria_pct', 10)
      c1.set('multa_atraso_pct', 10)
      c1.set('juros_mora_mensal_pct', 1)
      c1.set('desconto_pontualidade', 100)
      c1.set('carencia_meses', 0)
      c1.set('responsavel_iptu', 'inquilino')
      c1.set('responsavel_condominio', 'inquilino')
      c1.set('responsavel_seguro', 'inquilino')
      c1.set('clausulas_especiais', 'Uso estritamente corporativo/tecnologia')
      c1.set('observacoes_juridicas', 'Contrato regular com firma reconhecida')
      c1.set('status', 'ativo')
      c1.set('is_demo', true)
      app.save(c1)
      cont1Id = c1.id
    }

    // Contrato 2: Loja Comercial 02 -> Boutique & Café (Reajuste previsto IPCA 4.5% aluguel R$ 5.000)
    try {
      const existing = app.findFirstRecordByFilter('contratos', "numero = 'CTR-2024-002'")
      cont2Id = existing.id
    } catch (_) {
      const c2 = new Record(contCol)
      c2.set('numero', 'CTR-2024-002')
      c2.set('imovel', imov2Id)
      c2.set('inquilino', inq2Id)
      c2.set('locador_nome', 'Horizonte Participações S/A')
      c2.set('data_assinatura', '2024-02-20')
      c2.set('data_inicio', '2024-03-01')
      c2.set('data_fim', '2028-02-28')
      c2.set('prazo_meses', 48)
      c2.set('valor_inicial', 5000)
      c2.set('valor_atual', 5000)
      c2.set('dia_vencimento', 5)
      c2.set('periodicidade_reajuste', 'anual')
      c2.set('indice_reajuste', 'IPCA')
      c2.set('data_base_reajuste', '2027-03-01')
      c2.set('garantia_tipo', 'seguro_fianca')
      c2.set('garantia_detalhes', 'Porto Seguro Aluguel - Apólice 99881122')
      c2.set('garantia_valor', 60000)
      c2.set('multa_rescisoria_pct', 10)
      c2.set('multa_atraso_pct', 10)
      c2.set('juros_mora_mensal_pct', 1)
      c2.set('desconto_pontualidade', 0)
      c2.set('carencia_meses', 1)
      c2.set('responsavel_iptu', 'inquilino')
      c2.set('responsavel_condominio', 'inquilino')
      c2.set('responsavel_seguro', 'inquilino')
      c2.set('clausulas_especiais', 'Atividade gastronômica permitida')
      c2.set('observacoes_juridicas', 'Aguardando aprovação de reajuste programado')
      c2.set('status', 'ativo')
      c2.set('is_demo', true)
      app.save(c2)
      cont2Id = c2.id
    }

    // Contrato 3: Loja Comercial 03 -> Dra. Juliana Mendes (Aluguel atrasado há 12 dias)
    try {
      const existing = app.findFirstRecordByFilter('contratos', "numero = 'CTR-2025-003'")
      cont3Id = existing.id
    } catch (_) {
      const c3 = new Record(contCol)
      c3.set('numero', 'CTR-2025-003')
      c3.set('imovel', imov3Id)
      c3.set('inquilino', inq3Id)
      c3.set('locador_nome', 'Dr. Roberto Carlos da Silva (60%) e Horizonte Part. (40%)')
      c3.set('data_assinatura', '2025-01-10')
      c3.set('data_inicio', '2025-02-01')
      c3.set('data_fim', '2027-01-31')
      c3.set('prazo_meses', 24)
      c3.set('valor_inicial', 4200)
      c3.set('valor_atual', 4200)
      c3.set('dia_vencimento', 10)
      c3.set('periodicidade_reajuste', 'anual')
      c3.set('indice_reajuste', 'IGP-M')
      c3.set('data_base_reajuste', '2027-02-01')
      c3.set('garantia_tipo', 'fiador')
      c3.set('garantia_detalhes', 'Fiador: Sr. Marcos Mendes (imóvel matricula 45.101)')
      c3.set('garantia_valor', 50400)
      c3.set('multa_rescisoria_pct', 10)
      c3.set('multa_atraso_pct', 10)
      c3.set('juros_mora_mensal_pct', 1)
      c3.set('desconto_pontualidade', 0)
      c3.set('carencia_meses', 0)
      c3.set('responsavel_iptu', 'inquilino')
      c3.set('responsavel_condominio', 'inquilino')
      c3.set('responsavel_seguro', 'inquilino')
      c3.set('clausulas_especiais', 'Consultório médico/estético')
      c3.set('observacoes_juridicas', 'Contrato com fiador proprietário de imóvel quitado')
      c3.set('status', 'ativo')
      c3.set('is_demo', true)
      app.save(c3)
      cont3Id = c3.id
    }

    // 7. Reajuste Programado (Exemplo do briefing: Loja Comercial 02, R$ 5.000 -> R$ 5.225, IPCA 4.5%)
    const reajCol = app.findCollectionByNameOrId('reajustes')
    try {
      app.findFirstRecordByFilter('reajustes', `contrato = '${cont2Id}'`)
    } catch (_) {
      const r1 = new Record(reajCol)
      r1.set('contrato', cont2Id)
      r1.set('data_base', '2027-03-01')
      r1.set('periodo_apuracao', 'Mar/2026 a Fev/2027')
      r1.set('indice', 'IPCA')
      r1.set('percentual_aplicavel', 4.5)
      r1.set('tipo_indice', 'estimado')
      r1.set('aluguel_anterior', 5000)
      r1.set('aluguel_novo_projetado', 5225)
      r1.set('diferenca_mensal', 225)
      r1.set('diferenca_anual', 2700)
      r1.set('data_aplicacao', '2027-03-01')
      r1.set('status', 'aguardando_aprovacao')
      r1.set(
        'observacao_negociacao',
        'Aguardando fechamento do índice oficial definitivo pelo IBGE',
      )
      r1.set('is_demo', true)
      app.save(r1)
    }

    // 8. Renovação Pendente (Exemplo do briefing: Sala Comercial 01, Empresa ABC, 45 dias restantes)
    const renCol = app.findCollectionByNameOrId('renovacoes')
    try {
      app.findFirstRecordByFilter('renovacoes', `contrato = '${cont1Id}'`)
    } catch (_) {
      const ren1 = new Record(renCol)
      ren1.set('contrato', cont1Id)
      ren1.set('dias_restantes', 45)
      ren1.set('alerta_faixa', '60_dias')
      ren1.set('status', 'pendente')
      ren1.set('proposta_novo_valor', 3800)
      ren1.set('proposta_novo_prazo_meses', 24)
      ren1.set(
        'historico_negociacao',
        'Inquilino manifestou interesse verbal em renovar por mais 2 anos.',
      )
      ren1.set('is_demo', true)
      app.save(ren1)
    }

    // 9. Cobranças Reais (Mês atual e anteriores)
    const cobCol = app.findCollectionByNameOrId('cobrancas')

    // Cobrança 1: Contrato 1 - Paga no mês atual
    try {
      app.findFirstRecordByFilter('cobrancas', `contrato = '${cont1Id}' && competencia = '2026-11'`)
    } catch (_) {
      const cb1 = new Record(cobCol)
      cb1.set('contrato', cont1Id)
      cb1.set('imovel', imov1Id)
      cb1.set('inquilino', inq1Id)
      cb1.set('competencia', '2026-11')
      cb1.set('vencimento', '2026-11-10')
      cb1.set('valor_aluguel', 3500)
      cb1.set('valor_desconto', 100)
      cb1.set('valor_acrescimo', 0)
      cb1.set('valor_multa', 0)
      cb1.set('valor_juros', 0)
      cb1.set('valor_iptu', 420)
      cb1.set('valor_condominio', 980)
      cb1.set('outras_cobrancas', 0)
      cb1.set('valor_total', 4800)
      cb1.set('valor_pago', 4800)
      cb1.set('data_pagamento', '2026-11-09')
      cb1.set('forma_pagamento', 'pix')
      cb1.set('conta_bancaria', 'Itaú Ag 1234 CC 56789-0')
      cb1.set('status', 'pago')
      cb1.set('observacoes', 'Pago pontualmente com desconto de pontualidade')
      cb1.set('recibo_gerado', 'REC-202611-001')
      cb1.set('is_demo', true)
      app.save(cb1)
    }

    // Cobrança 2: Contrato 2 - Paga parcialmente no mês atual
    let cob2Id = ''
    try {
      const existing = app.findFirstRecordByFilter(
        'cobrancas',
        `contrato = '${cont2Id}' && competencia = '2026-11'`,
      )
      cob2Id = existing.id
    } catch (_) {
      const cb2 = new Record(cobCol)
      cb2.set('contrato', cont2Id)
      cb2.set('imovel', imov2Id)
      cb2.set('inquilino', inq2Id)
      cb2.set('competencia', '2026-11')
      cb2.set('vencimento', '2026-11-05')
      cb2.set('valor_aluguel', 5000)
      cb2.set('valor_desconto', 0)
      cb2.set('valor_acrescimo', 0)
      cb2.set('valor_multa', 0)
      cb2.set('valor_juros', 0)
      cb2.set('valor_iptu', 750)
      cb2.set('valor_condominio', 1400)
      cb2.set('outras_cobrancas', 0)
      cb2.set('valor_total', 7150)
      cb2.set('valor_pago', 4000)
      cb2.set('data_pagamento', '2026-11-05')
      cb2.set('forma_pagamento', 'ted_doc')
      cb2.set('conta_bancaria', 'Bradesco Ag 0543 CC 99120-1')
      cb2.set('status', 'pago_parcialmente')
      cb2.set(
        'observacoes',
        'Pago R$ 4.000,00 de entrada; saldo de R$ 3.150,00 combinado para dia 20',
      )
      cb2.set('recibo_gerado', 'REC-202611-002')
      cb2.set('is_demo', true)
      app.save(cb2)
      cob2Id = cb2.id
    }

    // Cobrança 3: Contrato 3 - Em atraso há 12 dias (Inadimplente - Loja 03)
    try {
      app.findFirstRecordByFilter('cobrancas', `contrato = '${cont3Id}' && competencia = '2026-11'`)
    } catch (_) {
      const cb3 = new Record(cobCol)
      cb3.set('contrato', cont3Id)
      cb3.set('imovel', imov3Id)
      cb3.set('inquilino', inq3Id)
      cb3.set('competencia', '2026-11')
      cb3.set('vencimento', '2026-11-10')
      cb3.set('valor_aluguel', 4200)
      cb3.set('valor_desconto', 0)
      cb3.set('valor_acrescimo', 0)
      cb3.set('valor_multa', 420)
      cb3.set('valor_juros', 16.8)
      cb3.set('valor_iptu', 510)
      cb3.set('valor_condominio', 850)
      cb3.set('outras_cobrancas', 0)
      cb3.set('valor_total', 5996.8)
      cb3.set('valor_pago', 0)
      cb3.set('status', 'vencido')
      cb3.set(
        'observacoes',
        'Aluguel da Loja 03 está atrasado há 12 dias. Notificação enviada por WhatsApp.',
      )
      cb3.set('is_demo', true)
      app.save(cb3)
    }

    // 10. Despesas dos Imóveis
    const despCol = app.findCollectionByNameOrId('despesas')
    try {
      app.findFirstRecordByFilter('despesas', `imovel = '${imov1Id}'`)
    } catch (_) {
      const d1 = new Record(despCol)
      d1.set('imovel', imov1Id)
      d1.set('categoria', 'manutencao')
      d1.set('descricao', 'Revisão semestral do sistema de climatização')
      d1.set('valor', 450)
      d1.set('data_vencimento', '2026-11-20')
      d1.set('status', 'pago')
      d1.set('data_pagamento', '2026-11-15')
      d1.set('recorrente', false)
      d1.set('observacoes', 'Nota Fiscal 1244 prestador ClimaTop')
      d1.set('is_demo', true)
      app.save(d1)
    }

    // 11. Caução / Garantia
    const caucCol = app.findCollectionByNameOrId('caucoes_garantias')
    try {
      app.findFirstRecordByFilter('caucoes_garantias', `contrato = '${cont1Id}'`)
    } catch (_) {
      const cg1 = new Record(caucCol)
      cg1.set('contrato', cont1Id)
      cg1.set('tipo', 'caucao_dinheiro')
      cg1.set('valor', 10500)
      cg1.set('data_deposito_emissao', '2025-02-20')
      cg1.set('instituicao_seguradora', 'Caixa Econômica Federal')
      cg1.set('conta_rendimento', 'Poupança vinculada Ag 0244 CP 12345-6')
      cg1.set('status', 'ativa')
      cg1.set('observacoes', '3 meses de aluguel caucionados')
      cg1.set('is_demo', true)
      app.save(cg1)
    }

    // Caução pendente de comprovante (para o painel de atenção do briefing)
    try {
      app.findFirstRecordByFilter('caucoes_garantias', `status = 'pendente_comprovante'`)
    } catch (_) {
      const cg2 = new Record(caucCol)
      cg2.set('contrato', cont3Id)
      cg2.set('tipo', 'titulo_capitalizacao')
      cg2.set('valor', 12600)
      cg2.set('instituicao_seguradora', 'Icatu Seguros')
      cg2.set('status', 'pendente_comprovante')
      cg2.set('observacoes', 'Comprovante de caução / título pendente de entrega pelo inquilino')
      cg2.set('is_demo', true)
      app.save(cg2)
    }

    // 12. Pendências (Central de Providências — Cobrindo exatamente os exemplos do briefing)
    const pendCol = app.findCollectionByNameOrId('pendencias')
    const demoPendencias = [
      {
        titulo: 'Cobrança: Aluguel da Loja 03 atrasado há 12 dias',
        categoria: 'financeira',
        prioridade: 'urgente',
        status: 'pendente',
        prazo: '2026-11-25',
        responsavel: 'Equipe Financeira',
        imovel: imov3Id,
        inquilino: inq3Id,
        contrato: cont3Id,
        descricao:
          'Realizar cobrança ativa por telefone e formalizar notificação extrajudicial do aluguel de Nov/2026.',
        is_demo: true,
      },
      {
        titulo: 'Contrato da Sala 05 vence em 15 dias',
        categoria: 'contratual',
        prioridade: 'urgente',
        status: 'pendente',
        prazo: '2026-12-05',
        responsavel: 'Gestor Imobiliário',
        imovel: imov4Id,
        descricao:
          'Providenciar vistoria final e agendar devolução de chaves ou proposta de prorrogação.',
        is_demo: true,
      },
      {
        titulo: 'Reajuste da Loja 02 previsto para o próximo mês',
        categoria: 'financeira',
        prioridade: 'alta',
        status: 'pendente',
        prazo: '2026-12-10',
        responsavel: 'Gestor Imobiliário',
        imovel: imov2Id,
        inquilino: inq2Id,
        contrato: cont2Id,
        descricao:
          'Reajuste programado de 4,50% pelo IPCA. Diferença mensal de R$ 225,00 aguarda aprovação da diretoria.',
        is_demo: true,
      },
      {
        titulo: 'Renovação do contrato da Sala 01 pendente',
        categoria: 'contratual',
        prioridade: 'alta',
        status: 'pendente',
        prazo: '2026-12-15',
        responsavel: 'Dr. Roberto / Gestão',
        imovel: imov1Id,
        inquilino: inq1Id,
        contrato: cont1Id,
        descricao:
          'Contrato da Empresa ABC com término em 45 dias. Enviar minuta de renovação de 24 meses.',
        is_demo: true,
      },
      {
        titulo: 'Aditivo contratual aguardando assinatura',
        categoria: 'contratual',
        prioridade: 'media',
        status: 'em_andamento',
        prazo: '2026-12-01',
        responsavel: 'Depto Jurídico',
        imovel: imov2Id,
        inquilino: inq2Id,
        contrato: cont2Id,
        descricao:
          'Aditivo para inclusão de atividade secundária no contrato da Loja 02 aguardando assinatura digital.',
        is_demo: true,
      },
      {
        titulo: 'Comprovante de caução pendente',
        categoria: 'documental',
        prioridade: 'media',
        status: 'pendente',
        prazo: '2026-11-28',
        responsavel: 'Assistente Administrativo',
        imovel: imov3Id,
        inquilino: inq3Id,
        contrato: cont3Id,
        descricao:
          'Inquilino não anexou o comprovante da caução em título de capitalização acordada.',
        is_demo: true,
      },
    ]

    for (const p of demoPendencias) {
      try {
        app.findFirstRecordByFilter('pendencias', `titulo = '${p.titulo}'`)
      } catch (_) {
        const rec = new Record(pendCol)
        rec.set('titulo', p.titulo)
        rec.set('categoria', p.categoria)
        rec.set('prioridade', p.prioridade)
        rec.set('status', p.status)
        rec.set('prazo', p.prazo)
        rec.set('responsavel', p.responsavel)
        if (p.imovel) rec.set('imovel', p.imovel)
        if (p.inquilino) rec.set('inquilino', p.inquilino)
        if (p.contrato) rec.set('contrato', p.contrato)
        rec.set('descricao', p.descricao)
        rec.set('is_demo', true)
        app.save(rec)
      }
    }

    // 13. Notificações do sistema
    const notifCol = app.findCollectionByNameOrId('notificacoes')
    const demoNotifs = [
      {
        titulo: '🔴 Aluguel vencido',
        mensagem: 'Aluguel da Loja 03 está atrasado há 12 dias. Valor total pendente: R$ 5.996,80.',
        tipo: 'aluguel_vencido',
        severidade: 'urgente',
        link_destino: '/financeiro',
        lida: false,
        is_demo: true,
      },
      {
        titulo: '🟠 Contrato próximo do vencimento',
        mensagem: 'Contrato da Sala Comercial 01 (Empresa ABC) vencerá em 45 dias.',
        tipo: 'contrato_vencendo',
        severidade: 'alerta',
        link_destino: '/renovacoes',
        lida: false,
        is_demo: true,
      },
      {
        titulo: '🟡 Reajuste programado no próximo mês',
        mensagem:
          'Loja Comercial 02 terá reajuste previsto de 4,50% pelo IPCA. Aprovação pendente.',
        tipo: 'reajuste_previsto',
        severidade: 'alerta',
        link_destino: '/reajustes',
        lida: false,
        is_demo: true,
      },
      {
        titulo: '🟢 Recebimento registrado',
        mensagem: 'Recebimento de R$ 4.800,00 registrado com sucesso da Empresa ABC via PIX.',
        tipo: 'recebimento_confirmado',
        severidade: 'sucesso',
        link_destino: '/financeiro',
        lida: true,
        is_demo: true,
      },
    ]

    for (const n of demoNotifs) {
      try {
        app.findFirstRecordByFilter('notificacoes', `titulo = '${n.titulo}'`)
      } catch (_) {
        const rec = new Record(notifCol)
        rec.set('titulo', n.titulo)
        rec.set('mensagem', n.mensagem)
        rec.set('tipo', n.tipo)
        rec.set('severidade', n.severidade)
        rec.set('link_destino', n.link_destino)
        rec.set('lida', n.lida)
        rec.set('is_demo', true)
        app.save(rec)
      }
    }
  },
  (app) => {
    // down migration
  },
)
