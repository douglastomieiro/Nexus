// Ajuda do sistema: o botão "?" no topo de cada tela (abre a explicação na gaveta lateral), a tela Configurações › Manual
// (todas as explicações, na ordem do menu, com busca) e os "Primeiros passos" no Resumo (o que falta para o lucro sair certo).
// Os textos ficam em AJUDA, um por tela: o = o que é a tela, n = [número, de onde vem], a = o que dá para fazer, d = dica.
// Tela nova precisa de texto aqui: o teste de regressão confere que toda tela tem ajuda.
(() => {
  const AJUDA = {
    // ───── Dashboard ─────
    central: { o: 'A tela inicial: o que precisa de você hoje, como foi a semana e como está a reputação de cada conta.',
      n: [['Pendências', 'Perguntas, mensagens e reclamações esperando resposta, etiquetas para imprimir, envios atrasados, NF-e para anexar, anúncios sem estoque ou com qualidade baixa, SKUs sem custo e Ads com prejuízo. Cada linha abre a tela onde se resolve.'],
        ['Semana', 'Faturamento, lucro, pedidos e visitas dos últimos 7 dias contra os 7 anteriores. O lucro é o mesmo cálculo do resto do sistema (comissão, frete, imposto, custo e Ads).'],
        ['Reputação', 'A cor de cada conta e as métricas dos últimos 60 dias (reclamações, atrasos e cancelamentos), com as reclamações e os envios atrasados que pesaram. Os limites de referência ficam em Personalizar › Minhas regras.'],
        ['Fatura do Mercado Livre', 'O período mais recente da fatura de cada conta e quanto está em aberto.']],
      a: ['Clicar numa pendência para ir direto resolver.', 'Escolher os blocos, a ordem e o que é urgente em Personalizar › Resumo.'],
      d: 'Pendência marcada como urgente sobe para o topo em vermelho quando tem algo.' },
    lucro: { o: 'O painel do lucro real do período: quanto entrou, para onde foi cada real e quanto sobrou de verdade.',
      n: [['Faturamento total', 'Soma do valor dos produtos vendidos no período (sem os cancelados).'],
        ['Lucro real', 'Faturamento − comissão − frete pago por você − imposto − custo dos produtos − Ads − perdas com devoluções.'],
        ['Margem pós Ads', 'Lucro depois do Ads dividido pelo faturamento.'],
        ['Previsão do mês', 'Faturamento do mês projetado pelo ritmo dos dias já passados.'],
        ['Para onde vai a receita', 'Quanto de cada R$ 100 vendidos vai para comissão, frete, imposto, custo, Ads e lucro.']],
      a: ['Trocar o período e a conta no filtro do topo.', 'Clicar num pedido da lista de pior resultado para ver a conta completa.'],
      d: 'O lucro só é tão certo quanto os custos cadastrados: venda de SKU sem custo aparece marcada e conta custo zero.' },
    visao: { o: 'Um resumo simples das vendas do período: faturamento por dia, os anúncios que mais faturaram e as formas de pagamento.',
      n: [['Faturamento por dia', 'Valor dos pedidos pagos em cada dia (horário de Brasília).'], ['Top 15 anúncios', 'Os anúncios com mais faturamento no período.']],
      a: ['Trocar o período e a conta no filtro do topo.'] },
    alertas: { o: 'O que precisa de atenção agora, do mais grave para o mais leve: coleta parada, anúncios com prejuízo, estoque acabando, promoções que não compensam e outros avisos.',
      n: [['Nível', 'Alta (resolver logo), média (olhar hoje) ou informativo.']],
      a: ['Seguir o link de cada alerta até a tela onde se resolve.'] },
    consolidado: { o: 'Mercado Livre e Shopee somados: faturamento, pedidos, lucro e margem de cada canal lado a lado.',
      n: [['Participação da Shopee', 'Quanto do faturamento total veio da Shopee.']], a: ['Trocar o período no filtro do topo.'] },
    // ───── Finanças ─────
    dre: { o: 'O demonstrativo de resultados mês a mês: da receita bruta até o lucro líquido, com as faturas do Mercado Livre e os custos fixos do negócio.',
      n: [['Receita e deduções', 'Vendas do mês menos devoluções, comissão, frete, imposto e custo dos produtos.'],
        ['Ads', 'Nos meses cobertos pela API de Ads, o gasto real por dia; antes disso, o valor da fatura.'],
        ['Faturas do ML', 'Cobranças por tipo (comissão, frete, Full, parcelamento, outros), já líquidas das bonificações.'],
        ['Custos fixos', 'Aluguel, salários e o que mais você cadastrar, por mês e por conta.']],
      a: ['Escolher o período na própria tela (últimos meses, ano, um mês ou intervalo).', 'Cadastrar custos fixos e fechar o mês (o fechamento guarda os números daquele mês).'],
      d: 'Mês que começou no meio (primeiro mês coletado) aparece avisado: os números dele são parciais.' },
    indicadores: { o: 'Rentabilidade, custos e eficiência mês a mês, em forma de indicadores financeiros.',
      n: [['Margem de contribuição', 'O que sobra das vendas depois dos custos variáveis (comissão, frete, imposto, custo e Ads).'], ['Margem líquida', 'Lucro líquido do mês dividido pela receita bruta.']],
      d: 'Período fixo: os últimos 6 meses.' },
    devolucoes: { o: 'Quanto as devoluções e cancelamentos com reembolso custaram: a perda real de cada uma, os motivos e os produtos mais devolvidos.',
      n: [['Perda', 'Frete de ida e de volta, tarifas e comissão que o ML não estornou e, se você marcou em Configurações, o custo do produto que não volta.'],
        ['Taxa de devolução', 'Unidades devolvidas sobre unidades vendidas.'],
        ['Fonte', 'Fatura do ML + Mercado Pago quando há extrato da venda; senão, estimada pelo custo do envio.']],
      a: ['Clicar num pedido para ver a conta completa.', 'Ver os produtos mais devolvidos para decidir o que corrigir no anúncio.'] },
    custos: { o: 'O custo unitário de cada SKU, a base de todo o cálculo de lucro.',
      n: [['Custo', 'Quanto você paga por uma unidade do produto. Vale para todos os anúncios e contas com o mesmo SKU.'],
        ['Vigência', 'Quando o custo muda, o novo vale a partir do dia escolhido; as vendas antigas continuam com o custo da época.']],
      a: ['Digitar o custo (salva ao sair do campo).', 'Colar em lote: uma linha por SKU no formato SKU;custo, direto de uma planilha.'],
      d: 'Os custos têm cópia de segurança automática a cada alteração.' },
    // ───── Pedidos e vendas ─────
    aovivo: { o: 'As vendas de hoje chegando, comparadas com ontem até a mesma hora. Atualiza sozinho a cada 30 segundos.',
      n: [['Resultado estimado', 'Lucro das vendas de hoje. O Ads de hoje só entra depois da coleta de Ads (de 3 em 3 horas).'],
        ['Margem média hoje', 'Resultado ÷ faturamento das vendas de hoje com custo cadastrado; as sem custo ficam fora para não inflar a margem.'],
        ['No ritmo de ontem', 'Quanto o dia fecharia se seguir a mesma curva de ontem.']],
      a: ['Clicar numa venda para abrir a ficha completa.'],
      d: 'O Ads de cada venda é o gasto do anúncio no dia dividido pelas unidades vendidas dele no dia.' },
    vendas: { o: 'A lista de despacho, como a do Mercado Livre: vendas para enviar hoje, nos próximos dias, no Full, em trânsito e finalizadas, com o resultado de cada uma.',
      n: [['Para imprimir', 'Vendas de hoje com etiqueta liberada e ainda não impressa.'], ['Atrasadas', 'Passaram do horário limite de despacho.'],
        ['Horário limite de hoje', 'Até quando despachar as vendas de hoje sem atrasar.'], ['Resultado e margem', 'O lucro de cada venda, o mesmo cálculo do resto do sistema.']],
      a: ['Imprimir etiquetas em PDF ou térmica (ZPL), uma ou várias.', 'Anotar uma nota interna na venda (só você vê).', 'Anexar a NF-e (XML ou PDF).', 'Iniciar conversa com o comprador.', 'Salvar filtros e exportar CSV.'],
      d: 'As ações vão direto para o Mercado Livre e ficam no Histórico de ações.' },
    pedidos: { o: 'Receitas, custos e margem pedido a pedido, com filtros e busca.',
      n: [['Repasse', 'O que o ML deposita: venda − comissão − frete.'], ['Margem', 'Resultado do pedido ÷ valor da venda.']],
      a: ['Buscar por comprador, produto ou número.', 'Clicar num pedido para ver a ficha completa.'] },
    consulta: { o: 'Busca de pedidos direto na API do Mercado Livre, em todos os status (inclusive cancelados), para quando a venda ainda não apareceu nas outras telas.',
      a: ['Buscar por comprador, título ou número do pedido.'] },
    envios: { o: 'Situação e custos de frete dos envios coletados, por logística.', n: [['Custo do vendedor', 'O que você pagou de frete em cada envio.']] },
    atendimento: { o: 'Perguntas, mensagens pós-venda e reclamações respondidas aqui, sem entrar no Mercado Livre.',
      n: [['A responder', 'Perguntas sem resposta. Tempo de resposta pelos horários do ML: comercial, fora do horário e fim de semana.'],
        ['Mensagens', 'Conversas pós-venda, com a ficha da venda ao lado.'],
        ['Reclamações', 'Abertas, com prazo vencendo, em mediação e encerradas, com a perda real de cada uma e o ranking dos produtos mais reclamados.']],
      a: ['Responder, apagar pergunta e bloquear comprador.', 'Mandar mensagem (com anexo).', 'Agir na reclamação: mensagem, reembolso, aceitar devolução, mediação e revisar o produto devolvido.', 'Usar e cadastrar respostas prontas.'],
      d: 'Cada ação mostra antes o que vai acontecer e fica no Histórico de ações.' },
    // ───── Produtos ─────
    abc: { o: 'A curva ABC dos produtos: quem traz o faturamento e o lucro, com sinais do que manter, reajustar ou parar.',
      n: [['A, B, C', 'A = os que somam 80% do faturamento; B = os próximos 15%; C = o resto.'], ['Sinal', 'Recomendação pela margem, pelo Ads e pela tendência de venda.']],
      a: ['Abrir a linha para ver os detalhes, copiar o SKU ou analisar o SKU.'] },
    sku: { o: 'Tudo de um produto (SKU): resultado, composição do preço, evolução, canais e anúncios.',
      n: [['Decomposição do resultado', 'Do faturamento ao lucro, linha por linha.'], ['Composição do preço', 'Em cada R$ 100 vendidos, quanto vai para cada custo.']],
      a: ['Buscar outro produto.', 'Copiar o SKU.'] },
    itens: { o: 'O cadastro dos anúncios: estoque, preço, vendas e saúde de cada um.', a: ['Ordenar e filtrar a lista.'], d: 'Para mudar preço, estoque e outros dados, use Gestão de anúncios.' },
    calculadora: { o: 'Simula preço, custos e margem de um anúncio antes de mudar o preço.',
      n: [['Preço mínimo', 'O menor preço que ainda dá a margem que você quer.'], ['Markup', 'Preço ÷ custo do produto.']] },
    // ───── Mercado Livre ─────
    anuncios: { o: 'Seus anúncios do Mercado Livre com custo, margem e preço mínimo, e as ações para mudar tudo sem entrar no ML.',
      n: [['Margem (30 dias)', 'Resultado dos últimos 30 dias do anúncio ÷ faturamento.'], ['Preço mínimo', 'O menor preço que dá a sua margem mínima (Minhas regras), com comissão, frete, imposto e Ads do anúncio.'],
        ['Cobertura', 'Quantos dias o estoque dura no ritmo de venda atual; no Full, a sugestão de reposição usa a cobertura de Minhas regras.']],
      a: ['Pausar, reativar e finalizar.', 'Mudar preço, estoque (por variação e por depósito), título, descrição, fotos, ficha técnica e tipo de anúncio.', 'Fazer em lote, ou por planilha (exportar, editar e importar o CSV).'],
      d: 'O título só pode mudar enquanto o anúncio não vendeu: regra do Mercado Livre.' },
    ads: { o: 'A visão geral do Product Ads nos últimos 90 dias: quanto investiu, quanto vendeu pelo Ads e o lucro depois dele.',
      n: [['ACOS', 'Gasto com Ads ÷ vendas atribuídas ao Ads. Abaixo da sua margem antes do Ads, a campanha dá lucro.'], ['TACOS', 'Gasto com Ads ÷ faturamento total (Ads + orgânico).'],
        ['Lucro pós Ads', 'Lucro das vendas depois de descontar o gasto com Ads.']] },
    publicidade: { o: 'Gerenciar Ads: campanhas e anúncios patrocinados com o lucro depois do Ads, e as ações.',
      n: [['Ads com prejuízo', 'Anúncio ativo cujo ACOS passa da margem dele antes do Ads, ou do ACOS máximo de Minhas regras.'], ['Sugeridos pelo ML', 'Anúncios que o ML recomenda e estão fora de campanha.']],
      a: ['Pausar e ativar campanha, mudar orçamento, ROAS alvo e estratégia.', 'Pausar, incluir, mover e tirar anúncios de campanha.'] },
    campanhas: { o: 'A saúde de cada campanha de Ads e como o investimento se divide entre elas.', n: [['ROAS', 'Vendas ÷ gasto com Ads (o inverso do ACOS).'], ['Saudáveis × críticas', 'Pelo ACOS comparado com a margem.']] },
    anunciosads: { o: 'O desempenho de cada anúncio patrocinado: investimento, vendas por Ads e orgânicas, ROAS e ACOS.', n: [['Share Ads', 'Parte das vendas do anúncio que veio do Ads.']] },
    catalogo: { o: 'O catálogo inteiro pela rentabilidade: lucro, Ads e oportunidades por produto e por categoria.', n: [['Segmento', 'Grupo do produto pela margem e pelo volume.']] },
    promocoes: { o: 'As promoções do Mercado Livre: as ativas, as disponíveis e quanto sobra em cada preço se você participar.',
      n: [['Quanto sobra se eu participar', 'O resultado de cada item no preço da promoção, com comissão, frete, imposto, custo e Ads.'], ['Itens com prejuízo', 'Itens em promoção que dão resultado negativo no preço promocional.']] },
    descontos: { o: 'Aplicar, ajustar e desativar descontos nos anúncios, em lote ou um a um, vendo a margem de cada preço antes.',
      a: ['Escolher os anúncios e o desconto, conferir a margem e aplicar.', 'Desativar descontos.'], d: 'Os descontos vão direto para o Mercado Livre.' },
    estoque: { o: 'Cobertura de estoque, rupturas e reposição, inclusive do Full.', n: [['Cobertura', 'Dias de estoque no ritmo de venda dos últimos 90 dias.']] },
    reputacao: { o: 'O nível e as métricas de reputação de cada conta, como o ML calcula (últimos 60 dias).', n: [['Reclamações, atrasos e cancelamentos', 'Porcentagem das vendas; passar dos limites derruba a cor.']] },
    // ───── Shopee (versão pessoal) ─────
    shopee: { o: 'A visão geral da Shopee com o lucro pelo repasse real (escrow) de cada pedido.', n: [['Repasse', 'O que a Shopee deposita depois de comissão, taxas, frete e cupons.']] },
    shopeepedidos: { o: 'Repasse, taxas, frete e resultado pedido a pedido na Shopee.' },
    shopeeprodutos: { o: 'O resultado por SKU e variação na Shopee.', n: [['Receita sem custo', 'Vendas de SKUs sem custo cadastrado (o custo é o mesmo da tela Custos).']] },
    shopeedev: { o: 'Devoluções e reembolsos da Shopee: valor, motivos e produtos.' },
    shopeeads: { o: 'Gasto, vendas (GMV), ROAS e saldo dos anúncios patrocinados da Shopee.' },
    shopeeanuncios: { o: 'Preço, estoque e cobertura por variação na Shopee.', n: [['Estoque para < 15 dias', 'Variações que acabam em menos de 15 dias no ritmo atual.']] },
    shopeepromo: { o: 'Descontos, cupons e combos da loja na Shopee.' },
    // ───── Nexus Metrics ─────
    nmbuscas: { o: 'O que mais se busca no Mercado Livre e nas suas categorias, e se você tem anúncio para cada busca.', n: [['Sem anúncio seu', 'Buscas do ranking em que você não aparece: oportunidades.']] },
    nmmaisvendidos: { o: 'Os 20 mais vendidos de cada categoria em que você vende, e onde você está.' },
    nmconcorrencia: { o: 'Quem está ganhando de você no catálogo e nos anúncios patrocinados, segundo o próprio Mercado Livre.',
      n: [['Perdendo para você mesmo', 'O vencedor do catálogo é outro anúncio seu.'], ['Perdidas por orçamento', 'Impressões que a campanha perdeu porque o orçamento acabou.']] },
    nmdia: { o: 'Como estão as vendas de hoje comparadas com o seu ritmo normal.' },
    nmprojecao: { o: 'Para onde o mês está indo e de onde vem o faturamento: categorias, tipo de anúncio, envio e estados.', n: [['Regra 80/20', 'Quantos produtos fazem 80% das vendas.']] },
    nmcategorias: { o: 'O seu desempenho e o peso de cada categoria em que você vende.' },
    nmanuncios: { o: 'Os anúncios que movem o faturamento e os ativos que não vendem.' },
    nmclientes: { o: 'Quem compra de você, quanto e com que frequência: clientes novos e recorrentes.' },
    nmotimiza: { o: 'A qualidade dos anúncios segundo o ML, priorizada pelo peso de cada um nas vendas.', n: [['O que melhorar', 'As pendências que o ML aponta no anúncio.']] },
    nmcrescimento: { o: 'A evolução do negócio mês a mês: vendas, categorias e clientes.' },
    // ───── Configurações ─────
    contas: { o: 'Conectar as contas do Mercado Livre pelo login oficial: basta autorizar na página do ML.',
      a: ['Conectar uma conta nova (com mais de uma loja, autorize no navegador de cada conta).', 'Renomear e desconectar.'], d: 'Desconectar apaga o acesso deste computador; os dados já coletados ficam.' },
    config: { o: 'O imposto e as regras de cálculo do lucro.',
      n: [['Alíquota do Simples', 'A porcentagem de imposto de cada conta, aplicada sobre a venda e o frete cobrado do comprador na nota.'], ['Custo perdido nas devoluções', 'Ligado, o custo do produto entra como perda quando ele não volta.']],
      a: ['Informar a alíquota de cada conta.', 'Baixar e restaurar o backup dos custos.'] },
    personalizar: { o: 'Deixar o sistema do seu jeito: o que aparece, o que é importante e quem pode fazer o quê.',
      a: ['Ligar e desligar módulos (some do menu, do Resumo, do sino e da coleta).', 'Definir Minhas regras: margem mínima, cobertura, ACOS máximo, qualidade, prazo de resposta e limites de reputação.',
        'Escolher os blocos do Resumo, os avisos do sino, o menu (favoritos e abas escondidas), colunas e filtros.', 'Criar perfis com senha (dono, atendimento, expedição…).'],
      d: 'Se a senha do dono for esquecida, iniciar o servidor com SEM_LOGIN=1 abre sem pedir senha.' },
    acoes: { o: 'Tudo o que o sistema fez no Mercado Livre por você: quando, em que conta, o que foi pedido e o que o ML respondeu.', a: ['Filtrar por tipo e ver a resposta completa de cada ação.'] },
    manual: { o: 'Todas as explicações do sistema num lugar só, na ordem do menu.', a: ['Buscar uma palavra (ex.: ACOS, etiqueta, custo).', 'Abrir a tela de cada explicação.'] },
    cobertura: { o: 'O que foi coletado de cada recurso da API e as últimas execuções do coletor: serve para conferir se a coleta está em dia.' },
    raw: { o: 'O retorno bruto da API do Mercado Livre guardado no banco, para conferir um dado na fonte.' },
  };
  window.AJUDA = AJUDA;

  const lista = (t, xs, f) => xs?.length ? `<h4 class="aj-h">${t}</h4><ul class="aj-l">${xs.map(f).join('')}</ul>` : '';
  const corpo = h => `<p class="aj-o">${esc(h.o)}</p>${lista('Os números', h.n, ([k, v]) => `<li><b>${esc(k)}:</b> ${esc(v)}</li>`)}${lista('O que dá para fazer', h.a, x => `<li>${esc(x)}</li>`)}${h.d ? `<p class="aj-d">💡 ${esc(h.d)}</p>` : ''}`;
  const nomeAba = v => { for (const g of GRUPOS) { const t = g.tabs.find(x => x[0] === v); if (t) return [g.n, t[1]]; } return ['', v]; };
  const vista = () => (location.hash.slice(1) || 'central').split(':')[0];

  // ───── botão "?" e a gaveta ─────
  document.head.insertAdjacentHTML('beforeend', `<style>
    .ajb{flex:none;width:30px;height:30px;border-radius:50%;border:1px solid var(--bd);background:var(--panel);color:var(--mut);font-weight:700;font-size:15px;cursor:pointer}
    .ajb:hover{color:var(--ac);border-color:var(--ac)} .aj-o{font-size:14px;line-height:1.5;margin:0 0 10px} .aj-h{margin:14px 0 6px;font-size:12px;text-transform:uppercase;letter-spacing:.04em;color:var(--mut)}
    .aj-l{margin:0;padding-left:18px;line-height:1.5;font-size:13.5px} .aj-l li{margin-bottom:5px} .aj-d{background:color-mix(in srgb,var(--ac) 8%,transparent);border-radius:10px;padding:9px 12px;font-size:13px;margin-top:12px}
    .aj-m{margin-bottom:12px} .aj-m h3{display:flex;justify-content:space-between;gap:10px;align-items:baseline} .aj-g{margin:22px 0 10px;font-size:15px}
    .pp{border:1px solid var(--ac);background:color-mix(in srgb,var(--ac) 6%,var(--panel));border-radius:14px;padding:14px 16px;margin-bottom:14px}
    .pp header{display:flex;justify-content:space-between;align-items:center;gap:10px;margin-bottom:8px} .pp .bar{height:8px;border-radius:99px;background:var(--bd);overflow:hidden;margin:6px 0 10px}
    .pp .bar i{display:block;height:100%;background:var(--ac)} .pp ol{margin:0;padding-left:0;list-style:none;display:grid;gap:6px}
    .pp li{display:flex;gap:10px;align-items:flex-start;font-size:13.5px} .pp li .ck{flex:none;width:20px;height:20px;border-radius:50%;border:2px solid var(--bd);display:grid;place-items:center;font-size:12px}
    .pp li.ok .ck{background:var(--ok);border-color:var(--ok);color:#fff} .pp li.ok .t{color:var(--mut);text-decoration:line-through} .pp small{color:var(--mut)}
  </style>`);
  const ph = document.querySelector('.ph');
  ph?.querySelector('.tx')?.insertAdjacentHTML('afterend', '<button type="button" class="ajb" id="ajb" title="Como funciona esta tela" aria-label="Como funciona esta tela">?</button>');
  const ajb = document.getElementById('ajb');
  const atualizaBotao = () => { if (ajb) ajb.style.display = AJUDA[vista()] ? '' : 'none'; };
  window.addEventListener('hashchange', atualizaBotao); atualizaBotao();
  window.abreAjuda = v => {
    const h = AJUDA[v]; if (!h) return; const [g, t] = nomeAba(v);
    $('#dt').textContent = `Como funciona: ${t}`; $('#db').innerHTML = `${g ? `<small style="color:var(--mut)">${esc(g)} › ${esc(t)}</small>` : ''}${corpo(h)}
      <p style="margin-top:16px"><a class="lk" href="#manual" onclick="fecha()">Ver o manual completo →</a></p>`;
    $('#dw').classList.add('on');
  };
  if (ajb) ajb.onclick = () => window.abreAjuda(vista());

  // ───── Configurações › Manual ─────
  const cfg = GRUPOS.find(g => g.n === 'Configurações'); if (cfg && !cfg.tabs.some(t => t[0] === 'manual')) cfg.tabs.push(['manual', 'Manual']);
  SUB.manual = 'Como funciona cada tela do sistema'; SEM_FILTRO.manual = 1; ICO.manual = '<path d="M4 19.5A2.5 2.5 0 0 1 6.5 17H20V3H6.5A2.5 2.5 0 0 0 4 5.5z"/><path d="M8 7h8M8 11h6"/>';
  VIEWS.manual = async function (alvo) {
    const visto = new Set(), blocos = [];
    for (const g of GRUPOS) { const ts = g.tabs.filter(([v]) => AJUDA[v] && VIEWS[v] && !visto.has(v)); ts.forEach(([v]) => visto.add(v)); if (ts.length) blocos.push([g.n, ts]); }
    $('#view').innerHTML = `<div class="box" style="margin-bottom:14px"><input id="ajq" type="search" placeholder="Buscar no manual (ex.: ACOS, etiqueta, custo, margem)" style="width:100%;padding:10px 12px;border:1px solid var(--bd);border-radius:10px;background:var(--panel);color:var(--tx1);font-size:14px"></div>
      <div id="ajm">${blocos.map(([g, ts]) => `<h2 class="aj-g" data-g>${esc(g)}</h2>${ts.map(([v, t]) => `<div class="box aj-m" id="aj-${v}" data-txt="${esc((t + ' ' + JSON.stringify(AJUDA[v])).toLowerCase())}">
        <div class="boxh"><h3>${esc(t)} <a class="lk" href="#${v}" style="font-size:12.5px;font-weight:500">abrir a tela →</a></h3></div>${corpo(AJUDA[v])}</div>`).join('')}`).join('')}</div>`;
    $('#ajq').oninput = e => { const q = e.target.value.trim().toLowerCase();
      document.querySelectorAll('#ajm .aj-m').forEach(b => (b.style.display = !q || b.dataset.txt.includes(q) ? '' : 'none'));
      document.querySelectorAll('#ajm [data-g]').forEach(h => { let n = h.nextElementSibling, vis = false; while (n && !n.hasAttribute('data-g')) { if (n.style.display !== 'none') vis = true; n = n.nextElementSibling; } h.style.display = vis ? '' : 'none'; }); };
    if (alvo) document.getElementById('aj-' + alvo)?.scrollIntoView();
  };

  // ───── Primeiros passos (no Resumo) ─────
  const PASSO_LINK = { contas: '#contas', coleta: '#cobertura', aliquota: '#config', custos: '#custos', regras: '#personalizar' };
  async function primeirosPassos() {
    const eu = window.PREFS?.perfis?.eu; if (eu && !eu.dono) return; // só o dono configura
    let P; try { P = await fetch('api/primeiros-passos').then(r => r.ok ? r.json() : null); } catch { return; }
    if (!P || P.oculto || P.feitos === P.total || !document.getElementById('view')) return;
    $('#view').insertAdjacentHTML('afterbegin', `<div class="pp" id="pp"><header><div><b>Primeiros passos</b> <small>· ${P.feitos} de ${P.total} feitos</small></div>
      <a class="lk" href="#" id="ppx" style="font-size:12.5px">esconder</a></header><div class="bar"><i style="width:${Math.round(P.feitos / P.total * 100)}%"></i></div>
      <ol>${P.passos.map(p => `<li class="${p.feito ? 'ok' : ''}"><span class="ck">${p.feito ? '✓' : ''}</span><div><span class="t">${p.feito || !PASSO_LINK[p.id] || (p.id === 'contas' && !VIEWS.contas) ? esc(p.titulo) : `<a class="lk" href="${PASSO_LINK[p.id]}">${esc(p.titulo)}</a>`}</span><br><small>${esc(p.detalhe)}</small></div></li>`).join('')}</ol>
      <p style="margin:10px 0 0;font-size:12.5px;color:var(--mut)">Dúvida em alguma tela? Use o botão <b>?</b> no topo dela, ou veja o <a class="lk" href="#manual">Manual</a>.</p></div>`);
    $('#ppx').onclick = async e => { e.preventDefault(); await fetch('api/primeiros-passos', { method: 'POST', headers: { 'content-type': 'application/json' }, body: JSON.stringify({ oculto: true }) }).catch(() => {}); $('#pp')?.remove(); };
  }
  const resumoOriginal = VIEWS.central;
  if (resumoOriginal) VIEWS.central = async function (...a) { await resumoOriginal.apply(this, a); await primeirosPassos(); };
})();
