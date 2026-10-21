// Telas no estilo Jodda: Dashboard, Análise de Pedidos, Devoluções, Tabela de Produtos (curva ABC), Análise por SKU, Calculadora,
// Gestão Mercado Livre (Ads, Campanhas, Anúncios Patrocinados, Anúncios Gerais, Promoções, Full/Estoque) e Indicadores.
// Carregado depois de extra.js: reaproveita $, api, getJ, brl, num, pct, esc, mk, ch, COR, LOJAS, svgIco, GRUPOS, SUB, ICO, VIEWS, tbl, lv, mlUrl, mesNome, stTag.

// ───────── estrutura do menu (mesma organização da Jodda) ─────────
Object.assign(ICO, {
  abc: '<path d="M3 3v18h18"/><path d="M7 16v-5M12 16V8M17 16v-8"/>', campanhas: '<circle cx="12" cy="12" r="10"/><circle cx="12" cy="12" r="6"/><circle cx="12" cy="12" r="2"/>',
  anunciosads: '<path d="m3 11 18-5v12L3 13z"/><path d="M11.6 16.8a3 3 0 1 1-5.8-1.6"/>', indicadores: '<path d="M22 12h-4l-3 9L9 3l-3 9H2"/>',
  consulta: '<path d="M14 2H6a2 2 0 0 0-2 2v16a2 2 0 0 0 2 2h12a2 2 0 0 0 2-2V8z"/><path d="M14 2v6h6M16 13H8M16 17H8M10 9H8"/>',
  sku: '<circle cx="11" cy="11" r="8"/><path d="m21 21-4.3-4.3"/><path d="M8 11h6M11 8v6"/>', catalogo: '<rect x="3" y="3" width="7" height="7" rx="1"/><rect x="14" y="3" width="7" height="7" rx="1"/><rect x="3" y="14" width="7" height="7" rx="1"/><rect x="14" y="14" width="7" height="7" rx="1"/>',
  estoque: '<path d="M22 8.35V20a2 2 0 0 1-2 2H4a2 2 0 0 1-2-2V8.35A2 2 0 0 1 3.26 6.5l8-3.2a2 2 0 0 1 1.48 0l8 3.2A2 2 0 0 1 22 8.35z"/><path d="M6 18h12M6 14h12"/>',
  calculadora: '<rect x="4" y="2" width="16" height="20" rx="2"/><path d="M8 6h8M8 10h.01M12 10h.01M16 10h.01M8 14h.01M12 14h.01M16 14h.01M8 18h.01M12 18h.01M16 18h.01"/>',
  cancel: '<circle cx="12" cy="12" r="10"/><path d="m15 9-6 6M9 9l6 6"/>', cal: '<rect x="3" y="4" width="18" height="18" rx="2"/><path d="M16 2v4M8 2v4M3 10h18"/>',
  rocket: '<path d="M4.5 16.5c-1.5 1.3-2 5-2 5s3.7-.5 5-2c.7-.8.7-2.1-.1-2.9a2.2 2.2 0 0 0-2.9-.1z"/><path d="m12 15-3-3a22 22 0 0 1 2-3.9A12.9 12.9 0 0 1 22 2c0 2.7-.8 7.5-6 11a22.4 22.4 0 0 1-4 2z"/>',
  down: '<path d="M21 15v4a2 2 0 0 1-2 2H5a2 2 0 0 1-2-2v-4M7 10l5 5 5-5M12 15V3"/>', chev: '<path d="m6 9 6 6 6-6"/>', img: '<rect x="3" y="3" width="18" height="18" rx="2"/><circle cx="8.5" cy="8.5" r="1.5"/><path d="m21 15-5-5L5 21"/>',
  refresh: '<path d="M21 12a9 9 0 1 1-3-6.7L21 8"/><path d="M21 3v5h-5"/>', copy: '<rect x="9" y="9" width="13" height="13" rx="2"/><path d="M5 15H4a2 2 0 0 1-2-2V4a2 2 0 0 1 2-2h9a2 2 0 0 1 2 2v1"/>', search: '<circle cx="11" cy="11" r="8"/><path d="m21 21-4.3-4.3"/>',
  ext: '<path d="M15 3h6v6M10 14 21 3M18 13v6a2 2 0 0 1-2 2H5a2 2 0 0 1-2-2V8a2 2 0 0 1 2-2h6"/>', trophy: '<path d="M6 9H4.5a2.5 2.5 0 0 1 0-5H6M18 9h1.5a2.5 2.5 0 0 0 0-5H18M4 22h16M10 14.66V17c0 .55-.47.98-.97 1.21C7.85 18.75 7 20.24 7 22M14 14.66V17c0 .55.47.98.97 1.21C16.15 18.75 17 20.24 17 22M18 2H6v7a6 6 0 0 0 12 0V2z"/>',
  bulb: '<path d="M9 18h6M10 22h4M12 2a7 7 0 0 0-4 12.7V17h8v-2.3A7 7 0 0 0 12 2z"/>', info: '<circle cx="12" cy="12" r="10"/><path d="M12 16v-4M12 8h.01"/>',
});
GRUPOS.length = 0;
GRUPOS.push(
  { n: 'Dashboard', ico: 'visao', tabs: [['lucro', 'Dashboard'], ['visao', 'Visão geral'], ['alertas', 'Alertas']] },
  { n: 'Finanças', ico: 'dre', tabs: [['dre', 'DRE'], ['indicadores', 'Indicadores']] },
  { n: 'Análise de Pedidos', ico: 'pedidos', tabs: [['pedidos', 'Análise de Pedidos'], ['consulta', 'Consulta (API)'], ['devolucoes', 'Devoluções'], ['envios', 'Envios'], ['atendimento', 'Atendimento']] },
  { n: 'Gestão de Produtos', ico: 'itens', tabs: [['abc', 'Tabela de Produtos'], ['sku', 'Análise por SKU'], ['custos', 'Custos'], ['itens', 'Cadastros'], ['calculadora', 'Calculadora']] },
  { n: 'Gestão Mercado Livre', ico: 'ads', tabs: [['ads', 'Dashboard'], ['campanhas', 'Campanhas'], ['anunciosads', 'Anúncios Patrocinados'], ['catalogo', 'Anúncios Gerais'], ['promocoes', 'Promoções'], ['estoque', 'Full / Estoque'], ['reputacao', 'Reputação']] },
  { n: 'Configurações', ico: 'config', tabs: [['config', 'Configurações'], ['cobertura', 'Cobertura'], ['raw', 'Explorador de API']] },
);
Object.assign(SUB, {
  lucro: 'Visão geral da sua operação no Mercado Livre', abc: 'Curva ABC com métricas de margem, lucro e Ads', sku: 'Drill-down completo por produto', pedidos: 'Receitas, custos e margem pedido a pedido',
  indicadores: 'Rentabilidade, custos e eficiência mês a mês', ads: 'Visão geral da sua operação de Ads no Mercado Livre', campanhas: 'Saúde e distribuição do investimento por campanha',
  anunciosads: 'Performance de seus investimentos em Ads — otimize suas campanhas', catalogo: 'Visão completa do seu catálogo: rentabilidade, Ads e oportunidades', estoque: 'Cobertura de estoque, rupturas e reposição',
  calculadora: 'Simule preço, custos e margem de um anúncio', consulta: 'Busca por comprador, título ou número · todos os status, inclusive cancelados', devolucoes: 'Taxa de devolução, perdas e produtos mais devolvidos', promocoes: 'Crie, edite e acompanhe as campanhas de promoção', custos: 'Custo unitário por SKU (base de todo o cálculo de lucro)', itens: 'Catálogo, estoque e saúde dos anúncios',
});

// ───────── helpers ─────────
const ic = (k, s = 14) => `<svg width="${s}" height="${s}" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2" stroke-linecap="round" stroke-linejoin="round">${ICO[k] || ''}</svg>`;
const pc = (n, d = 1) => n == null || !isFinite(n) ? '—' : (n * 100).toFixed(d).replace('.', ',') + '%';
const dlt = v => v == null || !isFinite(v) ? '' : `<span class="dl ${v >= 0 ? 'up' : 'dn'}">${v >= 0 ? '+' : ''}${(v * 100).toFixed(1).replace('.', ',')}%</span>`;
const dpp = (a, b) => a == null || b == null || !isFinite(a - b) ? '' : `<span class="dl ${a - b >= 0 ? 'up' : 'dn'}">${a - b >= 0 ? '+' : ''}${((a - b) * 100).toFixed(1).replace('.', ',')} p.p.</span>`;
const dv = (a, b) => b ? (a - b) / Math.abs(b) : null;
const kpi = (l, v, s, ico, c = 'blue', cls = '') => `<div class="kc c-${c}"><div class="kh"><span>${l}</span><i>${svgIco(ico)}</i></div><div class="kv ${cls}">${v}</div><div class="ks">${s || ''}</div></div>`;
const sect = (t, s = '') => `<div class="sect">${t} ${s ? `<small>${s}</small>` : ''}</div>`;
const mgPill = (m, semCusto) => semCusto ? '<span class="mg x" title="Sem custo cadastrado: a margem não é confiável">s/ custo</span>' : `<span class="mg ${m >= 0.25 ? 'g' : m >= 0.15 ? 'o' : 'r'}">${pc(m, 2)}</span>`;
const thumb = t => t ? `<img class="th" loading="lazy" src="${esc(t)}" alt="">` : `<span class="th">${svgIco('img')}</span>`;
const LOGCOR = { Full: '#22c55e', Flex: '#f97316', 'Padrão': '#94a3b8', 'Sem dado': '#e2e8f0' };
const lojaTxt = l => LOJAS[l] || l;
const lojaChip = l => `<span class="mp"><i style="background:${COR[l] || '#94a3b8'}">ML</i>${esc(lojaTxt(l))}</span>`;
const SIGCLS = { 'Campeão A': 'b', 'Alta Receita Saudável': 'g', 'Em Queda, mas Rentável': 'b', 'ATENÇÃO': 'r', 'Giro com Margem Baixa': 'a', 'Neutro / Monitorar': 'n', 'Sem custo': 'a' };
const SAUDE = { 'Excelente': 'g', 'Atenção': 'a', 'Crítico': 'r', 'Sem gasto': 'n' };
const PAL = ['#3b82f6', '#22c55e', '#f59e0b', '#ef4444', '#8b5cf6', '#14b8a6', '#ec4899', '#64748b', '#0ea5e9', '#84cc16', '#f97316', '#a855f7'];
const donut = (legend = 'right') => ({ responsive: true, maintainAspectRatio: false, cutout: '64%', plugins: { legend: { position: legend, labels: { color: '#475569', usePointStyle: true, boxWidth: 8, font: { size: 11 } } }, tooltip: { callbacks: { label: c => ` ${c.label}: ${c.dataset.fmt === 'num' ? num(c.raw) : brl(c.raw)}` } } } });
// type depois do ...ch.scales: outros gráficos acabam gravando type no `ch` compartilhado, e o eixo horizontal sairia vazio
const hbarCfg = (labels, data, cor, fmt = brl) => ({ type: 'bar', data: { labels, datasets: [{ data, backgroundColor: cor, borderRadius: 4 }] }, options: { ...ch, indexAxis: 'y', plugins: { legend: { display: false }, tooltip: { callbacks: { label: c => ' ' + fmt(c.raw) } } }, scales: { x: { ...ch.scales.x, type: 'linear', beginAtZero: true, ticks: { ...ch.scales.x.ticks, callback: v => fmt === pc ? pc(v, 0) : num(v) } }, y: { ...ch.scales.y, type: 'category', grid: { display: false }, ticks: { ...ch.scales.y.ticks, font: { size: 10.5 }, callback(v) { const t = this.getLabelForValue(v); return t.length > 22 ? t.slice(0, 21) + '…' : t; } } } } } });
const csv = (nome, cols, rows) => { const q = v => `"${String(v ?? '').replace(/"/g, '""')}"`; const t = '﻿' + [cols.map(c => q(c[0])).join(';'), ...rows.map(r => cols.map(c => q(c[1](r))).join(';'))].join('\r\n');
  const a = document.createElement('a'); a.href = URL.createObjectURL(new Blob([t], { type: 'text/csv;charset=utf-8' })); a.download = nome; a.click(); setTimeout(() => URL.revokeObjectURL(a.href), 3000); };
const num2 = n => (n ?? 0).toLocaleString('pt-BR', { minimumFractionDigits: 2, maximumFractionDigits: 2 });
const parseNum = v => { const s = String(v ?? '').trim().replace(/[R$\s%]/g, ''); if (!s) return NaN; return parseFloat(s.includes(',') ? s.replace(/\./g, '').replace(',', '.') : s); };
const store = { get: k => { try { return JSON.parse(localStorage.getItem(k)); } catch { return null; } }, set: (k, v) => { try { v == null ? localStorage.removeItem(k) : localStorage.setItem(k, JSON.stringify(v)); } catch { /* navegador sem armazenamento */ } } };
const ddmm = d => d.slice(5).split('-').reverse().join('/');
const debounce = (fn, ms = 300) => { let t; return () => { clearTimeout(t); t = setTimeout(fn, ms); }; };
const skuLink = (sku, txt) => sku ? `<a class="lk" href="#sku:${encodeURIComponent(sku)}" title="Abrir a análise deste SKU">${txt}</a>` : txt;
// cabeçalho ordenável: clique alterna crescente/decrescente; `st` = { k, d }
const thS = (t, k, st, cls = '') => `<th class="s ${cls}" data-k="${k}">${t} <span style="opacity:${st.k === k ? 1 : .35}">${st.k === k ? (st.d > 0 ? '▲' : '▼') : '⇅'}</span></th>`;
const ordena = (rows, st) => rows.slice().sort((a, b) => { const x = a[st.k], y = b[st.k]; return ((x ?? -Infinity) > (y ?? -Infinity) ? 1 : (x ?? -Infinity) < (y ?? -Infinity) ? -1 : 0) * st.d; });
const ligaSort = (sel, st, draw) => document.querySelectorAll(sel + ' th.s').forEach(th => th.onclick = () => { st.d = st.k === th.dataset.k ? -st.d : -1; st.k = th.dataset.k; draw(); });
const pager = (el, total, pg, por, go2) => { const n = Math.max(Math.ceil(total / por), 1), b = []; for (let p = 1; p <= n; p++) if (p === 1 || p === n || Math.abs(p - pg) <= 2) b.push(p); else if (b.at(-1) !== '…') b.push('…');
  el.innerHTML = n > 1 ? `<span>Página ${pg} de ${n}</span>` + b.map(p => p === '…' ? '<span>…</span>' : `<button class="${p === pg ? 'on' : ''}" data-p="${p}">${p}</button>`).join('') : '';
  el.querySelectorAll('button').forEach(bt => bt.onclick = () => go2(+bt.dataset.p)); };

// modal simples (meta de faturamento)
document.body.insertAdjacentHTML('beforeend', '<div id="mm"><div class="md"><h4 id="mmt"></h4><input id="mmi" inputmode="decimal" placeholder="ex.: 150.000,00"><div class="ac"><button class="btn3" id="mmx">Cancelar</button><button class="btn3 p" id="mmo">Salvar</button></div></div></div>');
const modal = (titulo, valor, ok) => { $('#mmt').textContent = titulo; $('#mmi').value = valor ? num2(valor) : ''; $('#mm').classList.add('on'); $('#mmi').focus();
  const fecha2 = () => $('#mm').classList.remove('on'); $('#mmx').onclick = fecha2; $('#mmo').onclick = () => { ok($('#mmi').value); fecha2(); }; $('#mmi').onkeydown = e => { if (e.key === 'Enter') $('#mmo').click(); if (e.key === 'Escape') fecha2(); }; };

// mapa de estados em "tiles" (cartograma): [uf, linha, coluna]
const TILES = [['RR', 0, 2], ['AP', 0, 3], ['AM', 1, 1], ['PA', 1, 2], ['MA', 1, 3], ['CE', 1, 4], ['RN', 1, 5], ['AC', 2, 0], ['RO', 2, 1], ['MT', 2, 2], ['TO', 2, 3], ['PI', 2, 4], ['PB', 2, 5],
  ['MS', 3, 1], ['DF', 3, 2], ['GO', 3, 3], ['BA', 3, 4], ['PE', 3, 5], ['AL', 3, 6], ['PR', 4, 2], ['SP', 4, 3], ['MG', 4, 4], ['SE', 4, 5], ['SC', 5, 2], ['RJ', 5, 3], ['ES', 5, 4], ['RS', 6, 2]];
const tileMap = (dados, campo = 'receita', fmt = brl) => {
  const m = Object.fromEntries(dados.map(x => [x.uf, x])), max = Math.max(...dados.map(x => x[campo]), 1);
  return `<div class="tm">${Array.from({ length: 7 * 8 }, (_, i) => { const r = Math.floor(i / 8), c = i % 8, t = TILES.find(x => x[1] === r && x[2] === c); if (!t) return '<span></span>'; const d = m[t[0]];
    if (!d) return `<div class="z" title="${t[0]}: sem vendas">${t[0]}</div>`; const a = 0.22 + 0.78 * (d[campo] / max);
    return `<div style="background:rgba(37,99,235,${a.toFixed(2)})" title="${t[0]}: ${fmt(d[campo])} · ${num(d.pedidos ?? d.n)} pedido(s)">${t[0]}</div>`; }).join('')}</div>`;
};
const hbars = (lista, key, fmt, cor = () => '#3b82f6') => { const max = Math.max(...lista.map(x => x[key]), 1); return lista.map((x, i) => `<div class="hb"><span title="${esc(x.nome)}">${esc(x.nome)}</span><div class="tr"><i style="width:${(100 * Math.max(x[key], 0) / max).toFixed(1)}%;background:${cor(i, x)}"></i></div><b>${fmt(x[key])}</b></div>`).join(''); };

// ═════════ DASHBOARD ═════════
const lucroOrig = VIEWS.lucro;
VIEWS.lucro = async function () {
  const pD = api('dash'); pD.catch(() => {}); // pede o painel junto com o lucro (antes era em sequência)
  await lucroOrig();
  const D = await pD, A = D.atual, P = D.anterior, mes = D.mes, mk0 = 'ml_meta_' + mes.inicio.slice(0, 7), meta = store.get(mk0);
  const ticket = A.pedidos ? A.receita / A.pedidos : 0, ticketP = P.pedidos ? P.receita / P.pedidos : 0;
  const mPre = A.receita ? (D.lucroBruto + D.ads.total) / A.receita : 0, mPos = A.receita ? D.lucroBruto / A.receita : 0;
  const mPreP = P.receita ? (D.lucroBrutoPrev + P.ads) / P.receita : null, mPosP = P.receita ? D.lucroBrutoPrev / P.receita : null;
  const prog = meta ? mes.receita / meta : 0, ritmo = meta ? mes.previsao / meta : 0;
  const metaHtml = `<div class="box" style="margin-bottom:14px"><div class="meta"><div class="mt"><span style="color:var(--ac)">${ic('campanhas', 16)}</span> Meta de Faturamento <small>${mesNome(mes.inicio.slice(0, 7))}</small></div>
    ${meta ? `<div class="mb"><div class="bar2"><i style="width:${Math.min(prog * 100, 100).toFixed(1)}%;${prog >= 1 ? 'background:linear-gradient(90deg,#16a34a,#22c55e)' : ''}"></i></div><div class="mi"><span><b style="color:#0f172a">${brl(mes.receita)}</b> de ${brl(meta)} · ${pc(prog, 0)}</span><span>${prog >= 1 ? '🎉 meta batida' : `faltam ${brl(meta - mes.receita)}`} · previsão ${brl(mes.previsao)} <b style="color:${ritmo >= 1 ? 'var(--ok)' : 'var(--warn)'}">(${pc(ritmo, 0)})</b></span></div></div>`
      : `<div class="empty mb"><b>Nenhuma meta definida</b>Defina metas para acompanhar seu progresso de faturamento</div>`}
    <div style="display:flex;gap:8px"><button class="btn3 p" id="jm1">${meta ? '✎ Alterar meta' : '+ Criar Meta'}</button>${meta ? '<button class="btn3" id="jm2">Remover</button>' : ''}</div></div></div>`;
  const kpis1 = `<div class="kgrid">${kpi('Faturamento total', brl(A.receita), `vs período anterior ${dlt(dv(A.receita, P.receita))}`, 'lucro', 'blue')}${kpi('Total de pedidos', num(A.pedidos), `anterior ${num(P.pedidos)} ${dlt(dv(A.pedidos, P.pedidos))}`, 'pedidos', 'green')}${kpi('Ticket médio', brl(ticket), `anterior ${brl(ticketP)} ${dlt(dv(ticket, ticketP))}`, 'dre', 'amber')}${kpi('Total de produtos', num(A.unidades), `unidades vendidas ${dlt(dv(A.unidades, P.unidades))}`, 'itens', 'purple')}${kpi('Previsão do mês', brl(mes.previsao), `ritmo de ${mes.dia} de ${mes.diasMes} dias de ${mesNome(mes.inicio.slice(0, 7))}`, 'cal', 'teal')}</div>`;
  const kpis2 = `<div class="kgrid">${kpi('Gasto com Ads', brl(A.ads), `${pc(A.receita ? A.ads / A.receita : 0)} do faturamento (TACOS)`, 'ads', 'pink')}${kpi('Total de impostos', brl(A.imposto), 'Simples Nacional (DAS)', 'dre', 'slate')}${kpi('Lucro bruto', brl(D.lucroBruto), 'faturamento − custos − impostos − fretes − comissões − Ads', 'lucro', 'green', D.lucroBruto < 0 ? 'bad' : '')}${kpi('Margem de lucro', pc(mPre, 2), `antes do Ads ${dpp(mPre, mPreP)}`, 'promocoes', 'amber')}${kpi('Margem pós Ads', pc(mPos, 2), `lucro bruto ÷ faturamento ${dpp(mPos, mPosP)}`, 'promocoes', 'blue')}${kpi('Lucro real', brl(A.lucro), 'já descontadas devoluções e perdas', 'lucro', 'green', A.lucro < 0 ? 'bad' : 'ok')}</div>`;
  // recomendações
  const potencial = D.ads.organicoSemAds * 0.5;
  const colsP = [{ t: 'Produto', f: x => `<div class="pr">${thumb(x.thumb)}<div><b>${skuLink(x.sku, esc(x.titulo))}</b><small>${esc(x.sku)}</small></div></div>` }, { t: 'Faturamento', n: 1, f: x => brl(x.receita) }, { t: 'Lucro', n: 1, f: x => brl(x.lucro) }, { t: 'Margem', n: 1, f: x => mgPill(x.margem, x.semCusto) }];
  const recBan = `<div class="ban"><h4><i>${svgIco('rocket')}</i><span>Potencial de Crescimento com ADS<small>Produtos vendendo sem investimento em publicidade</small></span></h4>
    <div class="bs"><div><span>Faturamento orgânico sem Ads</span><b>${brl(D.ads.organicoSemAds)}</b></div><div><span>Potencial de aumento (+50%)</span><b>+${brl(potencial)}</b></div><div><span>Faturamento potencial total</span><b>${brl(D.ads.organicoSemAds + potencial)}</b></div></div>
    <p>${ic('info', 13)} <b>Por que investir?</b> Produtos que já vendem organicamente têm demanda comprovada. Ao investir em Ads, você aumenta a visibilidade e pode capturar mais vendas — a estimativa considera um aumento de até 50%.</p><a href="#catalogo">${ic('ads', 14)} Ver oportunidades de Ads</a></div>
    ${D.oportunidadesAds.length ? `<div style="margin-top:12px">${tbl(colsP, D.oportunidadesAds.slice(0, 15))}</div>` : ''}`;
  const recs = { ads: recBan, baixa: D.baixaMargem.length ? `${tbl(colsP, D.baixaMargem.slice(0, 40))}<p class="dica">Produtos com margem abaixo de 20% — vale revisar preço, frete ou custo. <a class="lk" href="#abc">Abrir Tabela de Produtos →</a></p>` : '<div class="empty"><b>Nenhum produto com margem baixa</b>(considerando só os SKUs com custo cadastrado)</div>',
    custo: `${tbl(colsP.slice(0, 2), D.semCusto.slice(0, 40))}<p class="dica">Sem custo cadastrado o lucro fica superestimado. <a class="lk" href="#custos">Cadastrar custos →</a></p>` };
  const recHtml = `<div class="box" style="margin-bottom:14px"><div class="boxh"><h3><span style="color:#f59e0b">${ic('bulb', 15)}</span> Recomendações</h3><div class="rtabs" style="margin:0"><span class="rtab on" data-r="ads">${ic('ads', 13)} Ads Mercado Livre ${D.ads.oportunidades ? `<em>${D.ads.oportunidades}</em>` : ''}</span><span class="rtab red" data-r="baixa">${ic('dre', 13)} Baixa Margem <em>${D.nBaixaMargem}</em></span><span class="rtab red" data-r="custo">$ Sem Custo <em>${D.nSemCusto}</em></span></div></div><div id="jr">${recs.ads}</div></div>`;
  const topUF = D.estados.slice(0, 6).map(e => ({ nome: e.uf, v: e.receita }));
  const charts = `<div class="box" style="margin-bottom:14px"><div class="boxh"><h3>${ic('dre', 15)} Vendas diárias</h3><small>faturamento e quantidade de pedidos por dia</small></div><div style="height:260px"><canvas id="jd1"></canvas></div></div>
    <div class="two"><div class="box"><div class="boxh"><h3>Comparação de faturamento</h3><small>por conta · atual × período anterior</small></div><div style="height:230px"><canvas id="jd2"></canvas></div></div><div class="box"><h3>Divisão do faturamento</h3><div style="height:230px"><canvas id="jd3"></canvas></div></div></div>
    <div class="two"><div class="box"><div class="boxh"><h3>Vendas por logística</h3>${D.semLogistica ? `<small title="Pedidos cujo envio ainda não foi coletado">${num(D.semLogistica)} pedido(s) sem dado de envio</small>` : ''}</div>${D.logistica.length ? '<div style="height:210px"><canvas id="jlg"></canvas></div>' + hbars(D.logistica.map(l => ({ nome: l.lg, v: l.pedidos })), 'v', v => num(v) + ' ped.', (i, x) => LOGCOR[x.nome]) : '<div class="empty">Sem dados de envio coletados neste período.</div>'}</div>
      <div class="box"><div class="boxh"><h3>Vendas por estado</h3><small>faturamento por UF de destino</small></div>${D.estados.length ? tileMap(D.estados) + `<div style="margin-top:12px">${hbars(topUF, 'v', brl, () => '#2563eb')}</div>` : '<div class="empty">Sem dados de destino coletados.</div>'}</div></div>`;
  const topHtml = `<div class="boxh" style="margin-top:6px"><h3><span style="color:#f59e0b">${ic('trophy', 15)}</span> Top 10 produtos — curva A</h3><small>por faturamento no período · <a class="lk" href="#abc">ver tabela completa</a></small></div><div class="prod" style="margin-bottom:14px">${D.top10.map((x, i) => `<a class="pc" href="#sku:${encodeURIComponent(x.sku)}" title="${esc(x.titulo)}"><span class="rk">${i + 1}º</span>${x.thumb ? `<img loading="lazy" src="${esc(x.thumb)}" alt="">` : `<div class="ph0"></div>`}<b>${esc(x.titulo)}</b><div class="pm"><strong>${brl(x.receita)}</strong>${mgPill(x.margem, x.semCusto)}</div><div class="ks">${num(x.unidades)} un. ${dlt(x.cresc)}</div></a>`).join('')}</div>`;
  const cab = sect('Detalhamento do lucro', 'clique em um card para ver de onde vem cada valor');
  $('#view').insertAdjacentHTML('afterbegin', metaHtml + kpis1 + kpis2 + recHtml + charts + topHtml + cab);

  $('#jm1').onclick = () => modal(`Meta de faturamento de ${mesNome(mes.inicio.slice(0, 7))} (R$)`, meta, v => { const n = parseNum(v); if (n > 0) { store.set(mk0, n); go(); } });
  $('#jm2')?.addEventListener('click', () => { store.set(mk0, null); go(); });
  document.querySelectorAll('.rtab').forEach(t => t.onclick = () => { document.querySelectorAll('.rtab').forEach(x => x.classList.toggle('on', x === t)); $('#jr').innerHTML = recs[t.dataset.r]; });
  const dd = D.diario;
  mk('#jd1', { type: 'line', data: { labels: dd.map(x => ddmm(x.dia)), datasets: [{ label: 'Faturamento', data: dd.map(x => x.receita), borderColor: '#3b82f6', backgroundColor: '#3b82f61f', fill: true, tension: .35, pointRadius: 0, pointHoverRadius: 4, borderWidth: 2, yAxisID: 'y' }, { label: 'Pedidos', data: dd.map(x => x.pedidos), borderColor: '#f59e0b', tension: .35, pointRadius: 0, pointHoverRadius: 4, borderWidth: 2, yAxisID: 'y2' }] },
    options: { ...ch, interaction: { mode: 'index', intersect: false }, plugins: { ...ch.plugins, tooltip: { callbacks: { label: c => c.datasetIndex ? ` Pedidos: ${num(c.raw)}` : ` Faturamento: ${brl(c.raw)}` } } }, scales: { x: { ...ch.scales.x, grid: { display: false } }, y: ch.scales.y, y2: { position: 'right', ticks: { color: '#d97706' }, grid: { display: false } } } } });
  const pl = D.porLoja;
  mk('#jd2', { type: 'bar', data: { labels: pl.map(l => lojaTxt(l.loja)), datasets: [{ label: 'Período anterior', backgroundColor: '#c7d2fe', data: pl.map(l => l.prevReceita) }, { label: 'Período atual', backgroundColor: '#3b82f6', data: pl.map(l => l.receita) }] }, options: { ...ch, plugins: { ...ch.plugins, tooltip: { callbacks: { label: c => ` ${c.dataset.label}: ${brl(c.raw)}` } } } } });
  mk('#jd3', { type: 'doughnut', data: { labels: pl.map(l => lojaTxt(l.loja)), datasets: [{ data: pl.map(l => l.receita), backgroundColor: pl.map(l => COR[l.loja] || '#94a3b8'), borderWidth: 2, borderColor: '#fff' }] }, options: donut() });
  if (D.logistica.length) mk('#jlg', { type: 'doughnut', data: { labels: D.logistica.map(l => l.lg), datasets: [{ data: D.logistica.map(l => l.receita), backgroundColor: D.logistica.map(l => LOGCOR[l.lg]), borderWidth: 2, borderColor: '#fff' }] }, options: donut() });
};

// ═════════ ANÁLISE DE PEDIDOS ═════════
// a consulta original (busca por comprador, filtro por status incl. cancelados, envio e retorno bruto da API) continua como aba própria
VIEWS.consulta = VIEWS.pedidos;
VIEWS.pedidos = async function () {
  const R = await api('pedidos-analise'), all = R.pedidos;
  const f = { lg: '', q: '', met: 'margem', cond: 'ge', val: '', page: 1 }, st = { k: 'data', d: -1 }, PG = 50;
  $('#view').innerHTML = `<div class="flt" style="margin-top:0"><h4>${ic('search', 13)} Filtros</h4><div class="fgrid">
      <label>Logística<select id="pl"><option value="">Todas</option><option>Full</option><option>Flex</option><option>Padrão</option></select></label>
      <label>Métrica<select id="pm"><option value="margem">Margem %</option><option value="lucro">Resultado R$</option><option value="receita">Total R$</option><option value="frete">Frete R$</option></select></label>
      <label>Condição<select id="pc"><option value="ge">≥ Maior ou igual</option><option value="le">≤ Menor ou igual</option></select></label>
      <label>Valor<input id="pv" placeholder="ex.: 10 ou 10,5"></label>
      <label style="min-width:240px;flex:1">Buscar<input id="pq" placeholder="Número do pedido, SKU ou produto…"></label>
      <button id="pa" class="btn-ref">${ic('refresh', 13)}Atualizar</button><button id="pcsv" class="btn2">${ic('down', 13)}CSV</button></div></div>
    <div class="chips" id="pch"><span class="chip on" data-l=""><i style="background:#3b82f6"></i>Todas</span><span class="chip" data-l="Full"><i style="background:${LOGCOR.Full}"></i>Full</span><span class="chip" data-l="Flex"><i style="background:${LOGCOR.Flex}"></i>Flex</span><span class="chip" data-l="Padrão"><i style="background:${LOGCOR['Padrão']}"></i>Padrão</span></div>
    <div class="kgrid" id="pk"></div><div class="box"><div class="boxh"><h3>Lista de Pedidos</h3><small id="pn"></small></div><div class="tw" style="max-height:none"><table class="rt" id="ptb"><thead></thead><tbody id="pb"></tbody></table></div><div class="pg" id="pp"></div></div>`;
  const filtrar = () => all.filter(x => (!f.lg || x.lg === f.lg) && (!f.q || (x.itens.join(' ') + ' ' + x.id + ' ' + x.itemId + ' ' + (x.sku || '')).toLowerCase().includes(f.q))
    && (f.val === '' || isNaN(f.val) || (() => { const v = f.met === 'margem' ? x.margem * 100 : x[f.met]; return f.cond === 'ge' ? v >= f.val : v <= f.val; })()));
  // explicação de cada valor (ao passar o mouse): o que é e a conta feita com os números deste pedido
  const tt = s => ` title="${esc(s)}"`, porItem = (x, f) => (x.det || []).map(f).join('\n');
  const EXPL = {
    qtd: x => `Unidades vendidas neste pedido${x.det?.length > 1 ? ` (${x.det.length} produtos diferentes)` : ''}.`,
    receita: x => `Total da venda: preço × quantidade de cada item.\n${porItem(x, d => `${d.qtd} × ${brl(d.preco)} = ${brl(d.qtd * d.preco)}`)}\nTotal = ${brl(x.receita)}`,
    custo: x => (x.flags.includes('sem custo') ? 'Custo dos produtos: algum item está sem custo cadastrado e conta como R$ 0 (o resultado aparece maior do que o real). Cadastre em Gestão de Produtos › Custos.\n' : 'Custo dos produtos: custo unitário cadastrado (o que valia na data do pedido) × unidades.\n')
      + porItem(x, d => `${d.qtd} × ${brl(d.qtd ? d.custo / d.qtd : 0)} = ${brl(d.custo)}`) + `\nCusto = ${brl(x.custo)}` + (x.reembolso ? '\n(unidades devolvidas que voltaram ao estoque não contam)' : ''),
    comissao: x => `Comissão: tarifa de venda que o Mercado Livre cobra por item${x.reembolso ? ' (menos a parte estornada na devolução)' : ''}.\n`
      + porItem(x, d => `${brl(d.comissao)} = ${pc(d.qtd * d.preco ? d.comissao / (d.qtd * d.preco) : 0)} do item`) + `\nComissão = ${brl(x.comissao)} (${pc(x.receita ? x.comissao / x.receita : 0)} do total)`,
    frete: x => `Frete pago por você: a parte do envio que o Mercado Livre desconta do repasse${x.lg ? ` (envio ${x.lg})` : ''}.`
      + (x.flags.includes('frete estimado') ? '\nEstimado pela média dos envios deste anúncio (o custo real deste envio ainda não foi coletado).' : '') + `\nFrete = ${brl(x.frete)}`,
    reembolso: x => (x.reembolso ? `Reembolso: valor devolvido ao comprador (devolução ou cancelamento com estorno). Sai do total e da base do imposto.\nReembolso = ${brl(x.reembolso)}` : 'Reembolso: valor devolvido ao comprador. Este pedido não teve reembolso.'),
    imposto: x => { const base = x.receita - x.reembolso + (x.freteNF || 0), al = base ? x.imposto / base : 0;
      return `Imposto (Simples Nacional): base × alíquota do mês do pedido.\nBase = total ${brl(x.receita)} − reembolso ${brl(x.reembolso)}${x.freteNF ? ` + frete na NF ${brl(x.freteNF)}` : ''} = ${brl(base)}\n${brl(base)} × ${pc(al, 2)} = ${brl(x.imposto)}`; },
    repasse: x => `Repasse: o que o Mercado Livre deposita para você por este pedido.\nTotal ${brl(x.receita)} − reembolso ${brl(x.reembolso)} − comissão ${brl(x.comissao)} − frete ${brl(x.frete)} = ${brl(x.repasse)}`,
    lucro: x => { const outros = Math.round((x.repasse - x.custo - x.imposto - (x.ads || 0) - x.lucro) * 100) / 100;
      return `Resultado: o que sobra do pedido depois de todos os custos.\nRepasse ${brl(x.repasse)} − custo ${brl(x.custo)} − imposto ${brl(x.imposto)}${x.ads ? ` − Ads ${brl(x.ads)}` : ''}${Math.abs(outros) >= 0.05 ? ` ${outros > 0 ? '−' : '+'} outros ${brl(Math.abs(outros))}` : ''} = ${brl(x.lucro)}`
        + (x.ads ? '\nAds: gasto do anúncio no dia, dividido entre as vendas do dia.' : '\nSem gasto de Ads ligado a este pedido.') + (Math.abs(outros) >= 0.05 ? '\nOutros: perdas e ajustes da devolução (frete de volta, tarifas não estornadas, venda mantida pelo ML).' : ''); },
    margem: x => `Margem: resultado ÷ total.\n${brl(x.lucro)} ÷ ${brl(x.receita)} = ${pc(x.margem, 2)}${x.flags.includes('sem custo') ? '\nAtenção: item sem custo cadastrado, margem maior do que a real.' : ''}`,
  };
  const TIT = { Produto: 'Produto vendido (o primeiro, se o pedido tem mais de um), tipo de envio e estado do comprador', Pedido: 'Número da venda no Mercado Livre e data/hora da compra', Canal: 'Conta que fez a venda',
    Qtd: 'Unidades vendidas', Total: 'Valor total da venda (preço × quantidade)', Custo: 'Custo dos produtos (custo cadastrado × unidades)', 'Comissão': 'Tarifa de venda do Mercado Livre',
    Frete: 'Parte do frete paga por você', Reembolso: 'Valor devolvido ao comprador', Imposto: 'Simples Nacional sobre a venda', Repasse: 'O que o Mercado Livre deposita (total − reembolso − comissão − frete)',
    Resultado: 'O que sobra: repasse − custo − imposto − Ads', Margem: 'Resultado ÷ total' };
  let cur = [];
  const draw = () => {
    cur = ordena(filtrar(), st); const fat = cur.reduce((t, x) => t + x.receita, 0), luc = cur.reduce((t, x) => t + x.lucro, 0), filtrado = f.lg || f.q || f.val !== '';
    $('#pk').innerHTML = kpi('Total pedidos', num(cur.length), filtrado ? 'com os filtros aplicados' : 'no período selecionado', 'pedidos', 'blue') + kpi('Faturamento', brl(fat), 'valor total vendido', 'lucro', 'green') + kpi('Margem média', pc(fat ? luc / fat : 0, 2), 'média ponderada pelo faturamento', 'promocoes', 'amber') + kpi('Cancelados', num(R.cancelados), 'pedidos cancelados no período', 'cancel', 'red');
    $('#pn').textContent = `${num(cur.length)} registros${R.total > all.length ? ` · mostrando os ${num(all.length)} mais recentes de ${num(R.total)}` : ''}`;
    $('#ptb thead').innerHTML = `<tr><th>Produto</th>${thS('Pedido', 'data', st)}<th>Canal</th>${thS('Qtd', 'qtd', st, 'c')}${thS('Total', 'receita', st, 'n')}<th class="n">Custo</th><th class="n">Comissão</th>${thS('Frete', 'frete', st, 'n')}<th class="n">Reembolso</th><th class="n">Imposto</th><th class="n">Repasse</th>${thS('Resultado', 'lucro', st, 'n')}${thS('Margem', 'margem', st, 'c')}</tr>`;
    for (const th of $('#ptb thead').rows[0].cells) { const k = th.textContent.replace(/[▲▼⇅]/g, '').trim(); if (TIT[k]) th.title = TIT[k] + ' · passe o mouse nos valores para ver a conta'; }
    ligaSort('#ptb', st, () => { f.page = 1; draw(); });
    const pgs = Math.max(Math.ceil(cur.length / PG), 1); f.page = Math.min(f.page, pgs);
    $('#pb').innerHTML = cur.slice((f.page - 1) * PG, f.page * PG).map(x => `<tr><td><div class="pr">${thumb(x.thumb)}<div><b title="${esc(x.itens.join(' | '))}">${skuLink(x.sku, esc(x.itens[0] || ''))}${x.itens.length > 1 ? ` <small>+${x.itens.length - 1} item(ns)</small>` : ''}</b>${x.lg ? `<span class="lgt ${x.lg}" style="margin:0 4px 0 0">${x.lg}</span>` : ''}${x.uf ? `<small>${x.uf}</small>` : ''}${x.flags.map(g => `<small style="color:var(--warn)"> · ${esc(g)}</small>`).join('')}</div></div></td>
      <td><a class="oid" target="_blank" rel="noopener" href="${mlUrl('order', x.id)}" title="Abrir a venda no Mercado Livre">${x.id}</a> <a class="lk lv" href="#" data-t="order" data-i="${x.id}" data-l="${x.loja}" title="Ver retorno da API" style="color:var(--mut);font-size:11px">{ }</a><small>${new Date(x.data).toLocaleString('pt-BR', { day: '2-digit', month: '2-digit', year: 'numeric', hour: '2-digit', minute: '2-digit' })}</small></td><td>${lojaChip(x.loja)}</td><td class="c"${tt(EXPL.qtd(x))}>${x.qtd}</td><td class="n"${tt(EXPL.receita(x))}><b>${brl(x.receita)}</b></td>
      <td class="n mt"${tt(EXPL.custo(x))}>${brl(x.custo)}</td><td class="n mt"${tt(EXPL.comissao(x))}>${brl(x.comissao)}</td><td class="n mt"${tt(EXPL.frete(x))}>${brl(x.frete)}</td><td class="n mt"${tt(EXPL.reembolso(x))}>${x.reembolso ? `<span class="bad">${brl(x.reembolso)}</span>` : brl(0)}</td><td class="n mt"${tt(EXPL.imposto(x))}>${brl(x.imposto)}${x.freteNF ? `<br><small class="warn" title="Frete pago pelo comprador que consta na NF-e: não é receita nem custo seu, mas entra na base do imposto">NF frete ${brl(x.freteNF)} · imp. ${brl(x.impostoFrete)}</small>` : ''}</td>
      <td class="n"${tt(EXPL.repasse(x))}><b>${brl(x.repasse)}</b></td><td class="n"${tt(EXPL.lucro(x))}><b class="${x.lucro < 0 ? 'bad' : 'ok'}">${brl(x.lucro)}</b></td><td class="c"${tt(EXPL.margem(x))}>${mgPill(x.margem, x.flags.includes('sem custo'))}</td></tr>`).join('') || '<tr><td colspan="13" class="empty">Nenhum pedido encontrado com esses filtros.</td></tr>';
    pager($('#pp'), cur.length, f.page, PG, p => { f.page = p; draw(); $('#ptb').scrollIntoView({ block: 'start' }); });
  };
  const ler = () => { f.lg = $('#pl').value; f.met = $('#pm').value; f.cond = $('#pc').value; f.val = $('#pv').value.trim() === '' ? '' : parseNum($('#pv').value); f.q = $('#pq').value.toLowerCase().trim(); f.page = 1; document.querySelectorAll('#pch .chip').forEach(c => c.classList.toggle('on', c.dataset.l === f.lg)); draw(); };
  ['#pl', '#pm', '#pc'].forEach(i => $(i).onchange = ler); $('#pq').oninput = $('#pv').oninput = debounce(ler); $('#pa').onclick = () => go();
  document.querySelectorAll('#pch .chip').forEach(c => c.onclick = () => { $('#pl').value = c.dataset.l; ler(); });
  $('#pcsv').onclick = () => csv('pedidos.csv', [['Pedido', x => x.id], ['Data', x => x.data.slice(0, 10)], ['Conta', x => lojaTxt(x.loja)], ['SKU', x => x.sku || ''], ['Produto', x => x.itens.join(' | ')], ['Qtd', x => x.qtd], ['Logística', x => x.lg || ''], ['UF', x => x.uf || ''], ['Total', x => num2(x.receita)], ['Custo', x => num2(x.custo)], ['Comissão', x => num2(x.comissao)], ['Frete', x => num2(x.frete)], ['Reembolso', x => num2(x.reembolso)], ['Imposto', x => num2(x.imposto)], ['Frete na NF (base do imposto)', x => num2(x.freteNF)], ['Imposto sobre o frete da NF', x => num2(x.impostoFrete)], ['Ads', x => num2(x.ads)], ['Repasse', x => num2(x.repasse)], ['Resultado', x => num2(x.lucro)], ['Margem %', x => num2(x.margem * 100)]], cur);
  draw();
};

// ═════════ TABELA DE PRODUTOS (curva ABC) ═════════
VIEWS.abc = async function () {
  const met = store.get('ml_abc_met') || 'receita';
  const R = await api('abc', `&metrica=${met}`), rs = R.resumo, all = R.linhas.map(x => ({ ...x, classeN: { A: 3, B: 2, C: 1 }[x.classe] }));
  const f = { q: '', tend: '', sinal: '', classe: '', loja: '', max: 100 }, st = { k: met, d: -1 };
  $('#view').innerHTML = `<div class="kgrid">${kpi('Faturamento', brl(rs.faturamento), `${dlt(rs.dFat)} vs período anterior`, 'lucro', 'blue')}${kpi('Quantidade', num(rs.unidades), `${dlt(dv(rs.unidades, rs.unidadesPrev))} unidades`, 'itens', 'purple')}${kpi('Margem média', pc(rs.margem, 2), `${dpp(rs.margem, rs.margemPrev)} vs anterior`, 'promocoes', 'amber')}${kpi('Lucro R$', brl(rs.lucro), `${dlt(dv(rs.lucro, rs.lucroPrev))} vs anterior`, 'lucro', 'green')}${kpi('Cancelados', num(rs.cancelados), `anterior ${num(rs.canceladosPrev)}`, 'cancel', 'red')}</div>
    <div class="flt" style="margin-top:0"><div class="boxh" style="margin-bottom:8px"><h4 style="margin:0">${ic('abc', 13)} Tabela de Produtos <small style="font-weight:400">· ${num(all.length)} produtos desde ${R.desde.split('-').reverse().join('/')}</small></h4><button class="btn2" id="ax">${ic('down', 13)}Excel</button></div><div class="fgrid">
      <label>Métrica ABC<select id="am"><option value="unidades">Unidades</option><option value="receita">Faturamento (R$)</option><option value="lucro">Lucro (R$)</option></select></label>
      <label style="min-width:220px;flex:1">SKU / Nome<input id="aq" placeholder="Ex.: 789… ou nome do produto"></label>
      <label>Tendência<select id="at"><option value="">Todas</option><option>Alta</option><option>Estável</option><option>Queda</option><option>Novo</option></select></label>
      <label>Sinal<select id="as"><option value="">Todos</option>${[...new Set(all.map(x => x.sinal))].sort().map(s => `<option>${esc(s)}</option>`).join('')}</select></label>
      <label>Classe<select id="ac"><option value="">Todas</option><option>A</option><option>B</option><option>C</option></select></label>
      <label>Conta<select id="al"><option value="">Todas</option>${Object.entries(LOJAS).map(([k, n]) => `<option value="${k}">${esc(n)}</option>`).join('')}</select></label></div></div>
    <div class="box"><div class="boxh"><h3>Curva ABC de Produtos <small id="an"></small></h3><small>Clique em qualquer linha para ver detalhes, variações e dados de Ads</small></div><div class="tw" style="max-height:none"><table class="rt" id="atb"><thead></thead><tbody id="ab"></tbody></table></div><div class="pg"><button id="am2">Mostrar mais</button></div></div>`;
  $('#am').value = met;
  const filtra = () => all.filter(x => (!f.q || (x.titulo + ' ' + x.sku).toLowerCase().includes(f.q)) && (!f.tend || x.tendencia === f.tend) && (!f.sinal || x.sinal === f.sinal) && (!f.classe || x.classe === f.classe) && (!f.loja || x.lojas.includes(f.loja)));
  let cur = [];
  const draw = () => {
    cur = ordena(filtra(), st); $('#an').textContent = `(${num(cur.length)})`;
    $('#atb thead').innerHTML = `<tr><th>Produto</th>${thS('Faturamento', 'receita', st, 'n')}${thS('Unid.', 'unidades', st, 'n')}${thS('Lucro R$', 'lucro', st, 'n')}${thS('Margem', 'margem', st, 'c')}${thS('Classe', 'classeN', st, 'c')}<th>Sinal</th><th></th></tr>`;
    ligaSort('#atb', st, draw);
    $('#ab').innerHTML = cur.slice(0, f.max).map((x, i) => `<tr class="lin" data-i="${i}" style="cursor:pointer"><td><div class="pr">${thumb(x.thumb)}<div><b title="${esc(x.titulo)}">${esc(x.titulo)}</b><small>${esc(x.sku)}${x.anuncios > 1 ? ` · ${x.anuncios} anúncios` : ''} · ${x.lojas.map(lojaTxt).join(' + ')}</small></div></div></td>
      <td class="n"><b>${brl(x.receita)}</b><br>${x.cresc == null ? '<small style="color:var(--mut)">novo</small>' : dlt(x.cresc)}</td><td class="n">${num(x.unidades)}</td><td class="n"><b class="${x.lucro < 0 ? 'bad' : 'ok'}">${brl(x.lucro)}</b></td><td class="c">${mgPill(x.margem, x.semCusto)}</td>
      <td class="c"><span class="cls" title="classe no período anterior → atual"><b class="${x.classePrev}">${x.classePrev}</b>→<b class="${x.classe}">${x.classe}</b></span></td><td><span class="sg ${SIGCLS[x.sinal] || 'n'}">${esc(x.sinal)}</span></td><td class="chev">${ic('chev', 16)}</td></tr>`).join('') || '<tr><td colspan="8" class="empty">Nenhum produto com esses filtros.</td></tr>';
    $('#am2').style.display = cur.length > f.max ? '' : 'none';
    document.querySelectorAll('#ab tr.lin').forEach(tr => tr.onclick = () => {
      const nx = tr.nextElementSibling; if (nx?.classList.contains('xp')) { nx.remove(); tr.classList.remove('aberto'); return; }
      const x = cur[+tr.dataset.i], pAds = x.receita ? x.ads / x.receita : 0; tr.classList.add('aberto');
      tr.insertAdjacentHTML('afterend', `<tr class="xp"><td colspan="8"><div class="xg">
        <div class="xb"><h5>Vendas e comportamento</h5><div class="xl"><span>Unidades vendidas</span><b>${num(x.unidades)}</b></div><div class="xl"><span>Var. unidades</span><b>${x.prevUnidades ? dlt(dv(x.unidades, x.prevUnidades)) : '—'}</b></div><div class="xl"><span>Margem</span><b>${x.semCusto ? '—' : pc(x.margem, 2)}</b></div><div class="xl"><span>Var. margem</span><b>${x.semCusto || x.prevMargem == null ? '—' : dpp(x.margem, x.prevMargem)}</b></div><div class="xl"><span>Preço médio</span><b>${brl(x.unidades ? x.receita / x.unidades : 0)}</b></div><div class="xl"><span>% acumulado ABC</span><b>${pc(x.pctAcum)}</b></div></div>
        <div class="xb"><h5>Publicidade (Ads)</h5><div class="xl"><span>Gasto com Ads</span><b>${brl(x.ads)}</b></div><div class="xl"><span>% do faturamento</span><b>${pc(pAds)}</b></div><div class="xl"><span>Lucro pós Ads</span><b>${brl(x.lucro)}</b></div><div class="xl"><span>Custo unitário</span><b>${x.custoUnit == null ? '<span class="warn">sem custo</span>' : brl(x.custoUnit)}</b></div></div>
        <div class="xa"><a class="btn-ref" href="#sku:${encodeURIComponent(x.sku)}" style="text-decoration:none;justify-content:center;border-radius:8px;padding:8px 12px;background:var(--ac);color:#fff;font-weight:600;font-size:12.5px">${ic('sku', 13)} Analisar SKU</a><button class="btn2" data-a="sku">${ic('copy', 13)}Copiar SKU</button><a class="btn2" href="#custos" style="text-decoration:none">${ic('custos', 13)}Editar custo</a><a class="btn2" target="_blank" rel="noopener" href="${mlUrl('item', x.item)}" style="text-decoration:none">${ic('ext', 13)}Abrir no ML</a></div></div></td></tr>`);
      tr.nextElementSibling.querySelector('[data-a=sku]').onclick = e => { navigator.clipboard?.writeText(x.sku); e.currentTarget.innerHTML = ic('copy', 13) + 'Copiado ✓'; };
    });
  };
  const ler = () => { f.q = $('#aq').value.toLowerCase().trim(); f.tend = $('#at').value; f.sinal = $('#as').value; f.classe = $('#ac').value; f.loja = $('#al').value; f.max = 100; draw(); };
  ['#at', '#as', '#ac', '#al'].forEach(i => $(i).onchange = ler); $('#aq').oninput = debounce(ler, 250);
  $('#am').onchange = () => { store.set('ml_abc_met', $('#am').value); go(); }; $('#am2').onclick = () => { f.max += 100; draw(); };
  $('#ax').onclick = () => csv('tabela-de-produtos.csv', [['SKU', x => x.sku], ['Produto', x => x.titulo], ['Faturamento', x => num2(x.receita)], ['Var. %', x => x.cresc == null ? '' : num2(x.cresc * 100)], ['Unidades', x => x.unidades], ['Lucro', x => num2(x.lucro)], ['Margem %', x => x.semCusto ? '' : num2(x.margem * 100)], ['Classe', x => x.classe], ['Classe anterior', x => x.classePrev], ['Sinal', x => x.sinal], ['Ads', x => num2(x.ads)], ['Custo unitário', x => x.custoUnit == null ? '' : num2(x.custoUnit)]], cur);
  draw();
};

// ═════════ ANÁLISE POR SKU ═════════
VIEWS.sku = async function (arg) {
  const busca = `<div class="flt" style="margin-top:0"><div class="fgrid"><label style="flex:1;min-width:260px">SKU<input id="sq" list="sql" placeholder="Digite o SKU ou parte do nome e escolha na lista" value="${esc(arg || '')}"></label><datalist id="sql"></datalist><button class="btn-ref" id="sa">${ic('search', 13)}Analisar</button></div></div>`;
  const ir = () => { const v = $('#sq').value.trim(); if (v) location.hash = 'sku:' + encodeURIComponent(v.split(' — ')[0]); };
  if (!arg) {
    const R = await api('abc', '&metrica=receita');
    $('#view').innerHTML = busca + `<div class="box"><div class="boxh"><h3>Escolha um produto</h3><small>os 30 que mais faturaram no período</small></div>${tbl([{ t: 'Produto', f: x => `<div class="pr">${thumb(x.thumb)}<div><b>${skuLink(x.sku, esc(x.titulo))}</b><small>${esc(x.sku)}</small></div></div>` }, { t: 'Faturamento', n: 1, f: x => brl(x.receita) }, { t: 'Unidades', n: 1, f: x => num(x.unidades) }, { t: 'Margem', n: 1, f: x => mgPill(x.margem, x.semCusto) }], R.linhas.slice(0, 30))}</div>`;
    $('#sql').innerHTML = R.linhas.map(x => `<option value="${esc(x.sku)} — ${esc(x.titulo)}">`).join('');
    $('#sa').onclick = ir; $('#sq').onkeydown = e => { if (e.key === 'Enter') ir(); }; return;
  }
  let S; try { S = await api('sku', `&sku=${encodeURIComponent(arg)}`); } catch (e) { if (e === STALE) throw e; $('#view').innerHTML = busca + `<div class="box empty"><b>${esc(e.message)}</b>Confira o SKU ou aumente o período no filtro acima.</div>`; $('#sa').onclick = ir; $('#sq').onkeydown = ev => { if (ev.key === 'Enter') ir(); }; return; }
  const T = S.total, A = S.anterior;
  const L = [['Faturamento', T.receita, 'pos'], ['(−) Reembolsos parciais', -T.devolucao], ['(−) Custo da mercadoria', -T.custo], ['(−) Comissão marketplace', -T.comissao], ['(−) Frete', -T.frete], ['(−) Imposto', -T.imposto],
    ['(=) Lucro antes do Ads', T.lucro + T.ads, 'sub'], ['(−) Gasto com Ads', -T.ads], ['(=) Lucro líquido', T.lucro, 'tot']];
  $('#view').innerHTML = busca + `<div class="box skuh" style="margin-bottom:14px">${S.thumb ? `<img src="${esc(S.thumb)}" alt="">` : `<span class="th">${svgIco('img')}</span>`}<div style="flex:1;min-width:0"><b>${esc(S.titulo || S.sku)}</b><div class="ks" style="margin-top:4px"><span class="sg n">SKU ${esc(S.sku)}</span><span class="sg ${S.semCusto ? 'a' : 'g'}">${S.semCusto ? 'sem custo cadastrado' : 'custo unitário ' + brl(S.custoUnit)}</span><span class="sg b">${num(T.pedidos)} pedido(s) desde ${S.desde.split('-').reverse().join('/')}</span></div></div><div style="display:flex;gap:8px;flex-wrap:wrap"><button class="btn2" id="scp">${ic('copy', 13)}Copiar SKU</button><a class="btn2" href="#custos" style="text-decoration:none">${ic('custos', 13)}Editar custo</a></div></div>
    <div class="kgrid">${kpi('Faturamento', brl(T.receita), `${dlt(dv(T.receita, A.receita))} vs anterior`, 'lucro', 'blue')}${kpi('Unidades', num(T.unidades), `${dlt(dv(T.unidades, A.unidades))} vs anterior`, 'itens', 'purple')}${kpi('Margem média', S.semCusto ? '—' : pc(T.margem, 2), S.semCusto ? 'cadastre o custo para ver a margem' : `${dpp(T.margem, A.receita ? A.margem : null)} vs anterior`, 'promocoes', 'amber')}${kpi('Preço médio unit.', brl(T.precoMedio), `${dlt(dv(T.precoMedio, A.precoMedio))} vs anterior`, 'custos', 'teal')}${kpi('Lucro R$', brl(T.lucro), `${dlt(dv(T.lucro, A.lucro))} vs anterior`, 'lucro', 'green', T.lucro < 0 ? 'bad' : '')}${kpi('Devoluções', num(S.devolucoes), S.devolucoes ? `${brl(S.devolvido)} devolvido` : 'nenhuma no período', 'devolucoes', 'red')}${kpi('Gasto Ads', brl(T.ads), `${pc(T.receita ? T.ads / T.receita : 0)} do faturamento`, 'ads', 'pink')}</div>
    <div class="two"><div class="box"><h3>Decomposição do resultado</h3><div class="tw dre"><table id="tdre" style="min-width:0"><thead><tr><th>Linha</th><th class="n">Valor</th><th class="n">% fat.</th></tr></thead><tbody>${L.map(([n, v, c]) => `<tr class="${c === 'sub' ? 'sub' : c === 'tot' ? 'tot' : ''}"><td class="lb">${n}</td><td class="n ${v < 0 && !c ? 'bad' : ''}">${brl(v)}</td><td class="n">${pc(T.receita ? Math.abs(v) / T.receita : 0)}</td></tr>`).join('')}</tbody></table></div>${S.semCusto ? '<p class="dica warn">Sem custo cadastrado: o custo da mercadoria entra como R$ 0 e o lucro fica superestimado.</p>' : ''}</div>
      <div class="box"><h3>Composição do preço (por R$ 100 vendidos)</h3>${extratoBar([['Custo', T.custo, '#8b5cf6'], ['Comissão', T.comissao, '#f59e0b'], ['Frete', T.frete, '#3b82f6'], ['Imposto', T.imposto, '#ef4444'], ['Ads', T.ads, '#ec4899'], ['Reembolso', T.devolucao, '#94a3b8'], ['Lucro', Math.max(T.lucro, 0), '#22c55e']], T.receita)}<div style="height:180px;margin-top:12px"><canvas id="sk3"></canvas></div></div></div>
    <div class="box" style="margin-bottom:14px"><div class="boxh"><h3>Evolução diária</h3><small>faturamento e unidades</small></div><div style="height:240px"><canvas id="sk1"></canvas></div></div>
    <div class="two"><div class="box"><h3>Canais de venda (contas)</h3><div style="height:200px"><canvas id="sk2"></canvas></div></div><div class="box"><h3>Anúncios deste SKU</h3>${tbl([{ t: 'Anúncio', f: a => `<div class="pr">${thumb(a.thumb)}<div><b>${esc(a.titulo)}</b><small><a class="lk" target="_blank" rel="noopener" href="${mlUrl('item', a.item)}">${esc(a.item)}</a> · ${esc(lojaTxt(a.loja))}${a.ads ? ' · <span class="ok">em Ads</span>' : ''}</small></div></div>` }, { t: 'Unid.', n: 1, f: a => num(a.unidades) }, { t: 'Faturamento', n: 1, f: a => brl(a.receita) }], S.anuncios)}</div></div>
    <div class="box"><div class="boxh"><h3>Pedidos do SKU</h3><small>${num(S.pedidos.length)} mais recentes</small></div>${tbl([{ t: 'Data', f: r => new Date(r.data).toLocaleDateString('pt-BR') }, { t: 'Canal', f: r => lojaChip(r.loja) }, { t: 'Logística', f: r => r.lg ? `<span class="lgt ${r.lg}" style="margin:0">${r.lg}</span>` : '—' }, { t: 'Qtd', n: 1, f: r => r.qtd }, { t: 'Preço unit.', n: 1, f: r => brl(r.preco) }, { t: 'Faturamento', n: 1, f: r => `<b>${brl(r.receita)}</b>` }, { t: 'Lucro', n: 1, f: r => `<b class="${r.lucro < 0 ? 'bad' : 'ok'}">${brl(r.lucro)}</b>` }, { t: 'Margem', n: 1, f: r => mgPill(r.margem, S.semCusto) }, { t: 'Nº pedido', f: r => `<a class="oid" target="_blank" rel="noopener" href="${mlUrl('order', r.pedido)}">${r.pedido}</a>` }], S.pedidos)}</div>`;
  $('#sa').onclick = ir; $('#sq').onkeydown = e => { if (e.key === 'Enter') ir(); };
  $('#scp').onclick = e => { navigator.clipboard?.writeText(S.sku); e.currentTarget.innerHTML = ic('copy', 13) + 'Copiado ✓'; };
  const dd = S.diario;
  mk('#sk1', { type: 'bar', data: { labels: dd.map(x => ddmm(x.dia)), datasets: [{ type: 'line', label: 'Unidades', data: dd.map(x => x.unidades), borderColor: '#22c55e', backgroundColor: '#22c55e', yAxisID: 'y2', tension: .3, pointRadius: 2, borderWidth: 2 }, { label: 'Faturamento', data: dd.map(x => x.receita), backgroundColor: '#3b82f6', yAxisID: 'y' }] },
    options: { ...ch, interaction: { mode: 'index', intersect: false }, scales: { x: { ...ch.scales.x, grid: { display: false } }, y: ch.scales.y, y2: { position: 'right', ticks: { color: '#16a34a' }, grid: { display: false } } } } });
  mk('#sk2', { type: 'bar', data: { labels: S.porLoja.map(l => lojaTxt(l.loja)), datasets: [{ label: 'Faturamento', data: S.porLoja.map(l => l.receita), backgroundColor: S.porLoja.map(l => COR[l.loja] || '#94a3b8') }] }, options: { ...ch, plugins: { legend: { display: false } } } });
  mk('#sk3', { type: 'doughnut', data: { labels: S.logistica.map(l => l.lg), datasets: [{ data: S.logistica.map(l => l.receita), backgroundColor: S.logistica.map(l => LOGCOR[l.lg] || '#94a3b8'), borderWidth: 2, borderColor: '#fff' }] }, options: donut() });
};
// barra empilhada "para onde vai cada R$ 100" (extrato do preço, como na Jodda)
function extratoBar(partes, base) {
  if (!base) return '<div class="empty">Sem vendas.</div>';
  const P = partes.filter(p => p[1] > 0.004);
  return `<div class="ext">${P.map(([n, v, c]) => `<i style="width:${(100 * v / base).toFixed(2)}%;background:${c}" title="${n}: ${brl(v)} (${pc(v / base)})"></i>`).join('')}</div><div class="extl">${P.map(([n, v, c]) => `<span><i style="background:${c}"></i>${n} <b>${pc(v / base)}</b></span>`).join('')}</div>`;
}

// ═════════ CALCULADORA DE PREÇO ═════════
VIEWS.calculadora = async function () {
  // valores de partida: médias reais da sua operação nos últimos 30 dias (cada campo pode ser alterado)
  let base = { com: 16, frete: 0, imp: 0 };
  try { const l = await getJ(`api/lucro?loja=${$('#loja').value}&dias=30`), t = l.total, un = l.skus.reduce((s, x) => s + x.unidades, 0);
    base = { com: t.receita ? 100 * t.comissao / t.receita : 16, frete: un ? t.frete / un : 0, imp: t.receita ? 100 * t.imposto / (t.receita - t.devolucao + t.freteNF) : 0 }; } catch (e) { if (e === STALE) throw e; }
  const salvo = store.get('ml_calc') || {};
  const v0 = { preco: salvo.preco ?? 99.9, custo: salvo.custo ?? 40, com: salvo.com ?? +base.com.toFixed(1), fixa: salvo.fixa ?? 0, frete: salvo.frete ?? +base.frete.toFixed(2), fretenf: salvo.fretenf ?? 0, imp: salvo.imp ?? +base.imp.toFixed(2), ads: salvo.ads ?? 0, alvo: salvo.alvo ?? 20 };
  const campo = (k, l, suf, dica) => `<label>${l}<div class="inp"><input id="k_${k}" inputmode="decimal" value="${num2(v0[k]).replace(/\.(?=\d{3})/g, '')}"><span>${suf}</span></div>${dica ? `<small>${dica}</small>` : ''}</label>`;
  $('#view').innerHTML = `<div class="two"><div class="box"><h3>${ic('calculadora', 15)} Dados do anúncio</h3><div class="calc">
      ${campo('preco', 'Preço de venda', 'R$')}${campo('custo', 'Custo do produto', 'R$', 'o que você paga pelo produto')}
      ${campo('com', 'Comissão do ML', '%', `média da sua loja: ${pc(base.com / 100)}`)}${campo('fixa', 'Tarifa fixa por unidade', 'R$', 'produtos baratos podem ter tarifa fixa — confira no anúncio')}
      ${campo('frete', 'Frete pago por você', 'R$', `média por unidade: ${brl(base.frete)}`)}${campo('fretenf', 'Frete pago pelo comprador (na NF)', 'R$', 'não é receita nem custo, mas entra na base do imposto')}${campo('imp', 'Imposto', '%', `alíquota efetiva recente: ${pc(base.imp / 100)}`)}
      ${campo('ads', 'Ads (ACOS)', '%', 'gasto com Ads ÷ preço')}${campo('alvo', 'Margem desejada', '%', 'para calcular o preço sugerido')}</div></div>
    <div class="box"><h3>Resultado por unidade</h3><div id="cres"></div></div></div>`;
  const calc = () => {
    const g = k => { const n = parseNum($('#k_' + k).value); return isNaN(n) ? 0 : n; }, v = Object.fromEntries(Object.keys(v0).map(k => [k, g(k)])); store.set('ml_calc', v);
    const com = v.preco * v.com / 100 + v.fixa, impFrete = v.fretenf * v.imp / 100, imp = v.preco * v.imp / 100 + impFrete, ads = v.preco * v.ads / 100, custos = v.custo + com + v.frete + imp + ads, lucro = v.preco - custos, mg = v.preco ? lucro / v.preco : 0;
    const varp = (v.com + v.imp + v.ads) / 100, fixo = v.custo + v.frete + v.fixa + impFrete;
    const pMin = varp < 1 ? fixo / (1 - varp) : NaN, pAlvo = varp + v.alvo / 100 < 1 ? fixo / (1 - varp - v.alvo / 100) : NaN;
    $('#cres').innerHTML = `<div class="kgrid" style="grid-template-columns:repeat(auto-fit,minmax(150px,1fr))">${kpi('Lucro por unidade', brl(lucro), `${pc(mg, 2)} de margem`, 'lucro', lucro < 0 ? 'red' : 'green', lucro < 0 ? 'bad' : 'ok')}${kpi('Markup', v.custo ? (v.preco / v.custo).toFixed(2).replace('.', ',') + 'x' : '—', 'preço ÷ custo', 'dre', 'purple')}</div>
      ${extratoBar([['Custo', v.custo, '#8b5cf6'], ['Comissão', com, '#f59e0b'], ['Frete', v.frete, '#3b82f6'], ['Imposto', imp, '#ef4444'], ['Ads', ads, '#ec4899'], ['Lucro', Math.max(lucro, 0), '#22c55e']], v.preco)}
      <div class="tw" style="margin-top:12px"><table><tbody>${[['Preço de venda', v.preco], ['(−) Custo do produto', -v.custo], ['(−) Comissão + tarifa fixa', -com], ['(−) Frete', -v.frete], ['(−) Imposto' + (impFrete ? ` (inclui ${brl(impFrete)} do frete na NF)` : ''), -imp], ['(−) Ads', -ads]].map(([n, x]) => `<tr><td>${n}</td><td class="n">${brl(x)}</td></tr>`).join('')}<tr><td><b>(=) Lucro</b></td><td class="n"><b class="${lucro < 0 ? 'bad' : 'ok'}">${brl(lucro)}</b></td></tr></tbody></table></div>
      <div class="kgrid" style="margin-top:12px;grid-template-columns:repeat(auto-fit,minmax(150px,1fr))">${kpi('Preço mínimo', isNaN(pMin) ? '—' : brl(pMin), 'lucro zero (empate)', 'alertas', 'amber')}${kpi(`Preço p/ ${num2(v.alvo)}% de margem`, isNaN(pAlvo) ? 'impossível' : brl(pAlvo), isNaN(pAlvo) ? 'custos percentuais altos demais' : 'preço sugerido', 'campanhas', 'blue')}</div>`;
  };
  document.querySelectorAll('.calc input').forEach(i => i.oninput = calc); calc();
};

// ═════════ DEVOLUÇÕES ═════════
const devOrig = VIEWS.devolucoes;
VIEWS.devolucoes = async function () {
  const pG = api('devolucoes-graficos'); pG.catch(() => {});
  await devOrig();
  const G = await pG;
  const topo = `<div class="note">${ic('info', 13)} <b>Como funciona:</b> os dados são baseados na data do pedido. A taxa de devolução é calculada sobre o total de pedidos do período; o motivo vem das reclamações do Mercado Livre.</div>
    <div class="kgrid">${kpi('Total devoluções', num(G.total), 'pedidos reembolsados', 'cancel', 'red')}${kpi('Faturamento período', brl(G.faturamento), 'receita líquida do período', 'lucro', 'amber')}${kpi('Lucro período', brl(G.lucro), 'margem ' + pc(G.faturamento ? G.lucro / G.faturamento : 0), 'dre', 'purple')}${kpi('Unidades devolvidas', num(G.unidades), 'itens reembolsados', 'itens', 'blue')}${kpi('Taxa de devolução', pc(G.taxa), 'devoluções ÷ pedidos', 'promocoes', 'amber')}</div>
    <div class="two"><div class="box"><h3>Devoluções por conta</h3><div style="padding-top:6px">${G.porLoja.length ? hbars(G.porLoja.map(l => ({ nome: lojaTxt(l.loja), n: l.n })), 'n', num, (i, x) => PAL[i % PAL.length]) : '<div class="empty">Nenhuma devolução no período.</div>'}</div><p class="dica">Pedidos devolvidos por conta de venda no período.</p></div>
      <div class="box"><h3>Evolução diária de devoluções</h3><div style="height:200px"><canvas id="gv1"></canvas></div><p class="dica">A data é a do pedido, não a da devolução.</p></div></div>
    <div class="two"><div class="box"><h3>Por tipo de logística</h3>${G.logistica.length ? tbl([{ t: 'Logística', f: r => `<span class="lgt ${r.lg}" style="margin:0">${r.lg}</span>` }, { t: 'Devoluções', n: 1, f: r => num(r.n) }, { t: 'Taxa', n: 1, f: r => { const tx = r.vendas + r.n ? r.n / (r.vendas + r.n) : 0; return `<span class="${tx > 0.05 ? 'bad' : ''}">${pc(tx)}</span>`; } }, { t: 'Valor devolvido', n: 1, f: r => brl(r.valor) }], G.logistica) : '<div class="empty">Sem dados de envio.</div>'}<p class="dica">Full = Fulfillment · Padrão = coleta/agência.</p></div>
      <div class="box"><h3>Top estados (UF)</h3>${G.estados.length ? tbl([{ t: 'Estado', k: 'uf' }, { t: 'Devoluções', n: 1, f: r => num(r.n) }, { t: 'Taxa', n: 1, f: r => pc(r.vendas + r.n ? r.n / (r.vendas + r.n) : 0) }, { t: 'Valor', n: 1, f: r => brl(r.valor) }], G.estados.slice(0, 10)) : '<div class="empty">Sem dados de destino.</div>'}</div></div>
    ${sect('Impacto financeiro e detalhamento', 'perda real, produtos mais devolvidos e lista de pedidos')}`;
  $('#view').insertAdjacentHTML('afterbegin', topo);
  mk('#gv1', { type: 'line', data: { labels: G.evolucao.map(x => ddmm(x.dia)), datasets: [{ label: 'Devoluções', data: G.evolucao.map(x => x.n), borderColor: '#f97316', backgroundColor: '#f9731626', fill: true, tension: .35, pointRadius: 0, pointHoverRadius: 4, borderWidth: 2 }] }, options: { ...ch, plugins: { ...ch.plugins, legend: { display: false } } } });
};

// ═════════ GESTÃO MERCADO LIVRE: Ads ═════════
const adsDados = async () => {
  const [a, l] = await Promise.all([getJ(`api/ads?loja=${$('#loja').value}`), getJ(`api/lucro?loja=${$('#loja').value}&dias=90`)]);
  const m = x => x.metrics || x, S = (arr, f) => arr.reduce((s, x) => s + (f(x) || 0), 0), c = a.campanhas;
  const t = { cost: S(c, x => m(x).cost), amount: S(c, x => m(x).total_amount), direct: S(c, x => m(x).direct_amount), indirect: S(c, x => m(x).indirect_amount), units: S(c, x => m(x).units_quantity), orgU: S(c, x => m(x).organic_units_quantity), orgA: S(c, x => m(x).organic_units_amount), clicks: S(c, x => m(x).clicks), prints: S(c, x => m(x).prints) };
  return { a, l, m, c, t };
};
const tier = x => { const mm = x.metrics || x, ac = mm.acos, alvo = x.acos_target; if (!mm.cost) return ['n', 'Sem gasto']; if (!mm.total_amount) return ['r', 'Crítico']; const r = alvo ? ac / alvo : (ac < 8 ? 0.8 : ac < 15 ? 1.1 : ac < 25 ? 1.4 : 2); return r <= 1 ? ['', 'Excelente'] : r <= 1.25 ? ['b', 'Bom'] : r <= 1.6 ? ['a', 'Atenção'] : ['r', 'Crítico']; };
VIEWS.ads = async function () {
  const { a, l, t } = await adsDados(), L = l.total, rec90 = L.receita;
  const dias = {}; a.diario.forEach(x => x.dias.forEach(y => { const o = dias[y.date] ||= { cost: 0, rec: 0 }; o.cost += y.cost || 0; o.rec += y.total_amount || 0; })); const ks = Object.keys(dias).sort();
  const acos = t.amount ? t.cost / t.amount : 0, tacos = rec90 ? t.cost / rec90 : 0, cancel = (L.pedidos + L.canceladas) ? L.canceladas / (L.pedidos + L.canceladas) : 0;
  const orgSem = Math.max(rec90 - t.amount - t.orgA, 0), adsTotal = L.ads + L.adsSemVenda;
  $('#view').innerHTML = `<div class="note">${ic('info', 13)} <b>Aviso sobre atualização de Ads:</b> os dados de Product Ads são dos últimos 90 dias e o ML os entrega com cerca de 1 dia de atraso. Faturamento total e lucro abaixo usam a mesma janela de 90 dias.</div>
    <div class="kgrid">${kpi('Faturamento Ads', brl(t.amount), `direto ${brl(t.direct)} · indireto ${brl(t.indirect)}`, 'ads', 'blue')}${kpi('Fat. orgânico (itens com Ads)', brl(t.orgA), 'vendas orgânicas dos anúncios em Ads', 'lucro', 'green')}${kpi('Fat. orgânico sem Ads', brl(orgSem), 'restante do faturamento da conta', 'lucro', 'teal')}${kpi('Gasto com Ads', brl(t.cost), `${num(t.clicks)} cliques · ${num(t.prints)} impressões`, 'ads', 'pink')}${kpi('Unidades Ads', num(t.units), 'vendidas via publicidade', 'itens', 'purple')}</div>
    <div class="kgrid">${kpi('Unidades orgânicas', num(t.orgU), 'dos itens anunciados', 'itens', 'amber')}${kpi('ACOS', pc(acos, 2), 'gasto ÷ vendas por Ads', 'promocoes', 'blue')}${kpi('TACOS', pc(tacos, 2), 'gasto ÷ faturamento total', 'promocoes', 'red')}${kpi('Lucro pós Ads', brl(L.lucroFinal), `Ads total no lucro: ${brl(adsTotal)}`, 'lucro', 'green', L.lucroFinal < 0 ? 'bad' : '')}${kpi('Margem pós Ads', pc(L.margem, 2), `${pc(cancel, 2)} dos pedidos cancelados`, 'dre', 'amber')}</div>
    <div class="box" style="margin-bottom:14px"><div class="boxh"><h3>Comparativo diário: faturamento × investimento</h3><small>vendas atribuídas ao Ads e gasto por dia</small></div><div style="height:250px"><canvas id="ad1"></canvas></div></div>
    <div class="two"><div class="box"><h3>Vendas por tipo</h3><div style="height:230px"><canvas id="ad2"></canvas></div></div><div class="box"><h3>Distribuição do investimento</h3><div style="height:230px"><canvas id="ad3"></canvas></div></div></div>`;
  mk('#ad1', { type: 'line', data: { labels: ks.map(ddmm), datasets: [{ label: 'Vendas por Ads', data: ks.map(k => dias[k].rec), borderColor: '#22c55e', backgroundColor: '#22c55e22', fill: true, tension: .3, pointRadius: 0, pointHoverRadius: 4, borderWidth: 2 }, { label: 'Investimento', data: ks.map(k => dias[k].cost), borderColor: '#ef4444', tension: .3, pointRadius: 0, pointHoverRadius: 4, borderWidth: 2 }] }, options: { ...ch, interaction: { mode: 'index', intersect: false }, plugins: { ...ch.plugins, tooltip: { callbacks: { label: c => ` ${c.dataset.label}: ${brl(c.raw)}` } } } } });
  mk('#ad2', { type: 'doughnut', data: { labels: ['Orgânico sem Ads', 'Vendas por Ads', 'Orgânico em itens com Ads'], datasets: [{ data: [orgSem, t.amount, t.orgA], backgroundColor: ['#94a3b8', '#3b82f6', '#22c55e'], borderWidth: 2, borderColor: '#fff' }] }, options: donut() });
  const cs = a.campanhas.filter(x => (x.metrics || x).cost > 0);
  mk('#ad3', { type: 'doughnut', data: { labels: cs.map(x => x.name), datasets: [{ data: cs.map(x => (x.metrics || x).cost), backgroundColor: PAL, borderWidth: 2, borderColor: '#fff' }] }, options: donut() });
};
VIEWS.campanhas = async function () {
  const { c, t } = await adsDados(), mm = x => x.metrics || x, ativas = c.filter(x => x.status === 'active');
  const tiers = { Excelente: 0, Bom: 0, 'Atenção': 0, 'Crítico': 0, 'Sem gasto': 0 }; c.forEach(x => { tiers[tier(x)[1]]++; });
  const roas = t.cost ? t.amount / t.cost : 0, tcol = { Excelente: '#22c55e', Bom: '#3b82f6', 'Atenção': '#f59e0b', 'Crítico': '#ef4444', 'Sem gasto': '#cbd5e1' };
  $('#view').innerHTML = `<div class="kgrid">${kpi('Campanhas', num(c.length), `${num(ativas.length)} ativas`, 'campanhas', 'blue')}${kpi('Investimento', brl(t.cost), 'últimos 90 dias', 'ads', 'red')}${kpi('ROAS médio', roas.toFixed(2).replace('.', ',') + 'x', 'vendas por Ads ÷ gasto', 'dre', 'green')}${kpi('ACOS médio', pc(t.amount ? t.cost / t.amount : 0, 2), 'gasto ÷ vendas por Ads', 'promocoes', 'amber')}${kpi('Saudáveis', num(tiers.Excelente + tiers.Bom), 'excelentes e boas', 'reputacao', 'green')}${kpi('Críticas', num(tiers['Crítico']), 'ACOS muito acima do alvo ou sem venda', 'alertas', 'red')}</div>
    <div class="two"><div class="box"><h3>Distribuição do investimento</h3><div style="height:230px"><canvas id="cp1"></canvas></div></div><div class="box"><h3>Saúde das campanhas</h3><div style="padding-top:10px">${Object.entries(tiers).map(([n, v]) => `<div class="hs"><span>${n}</span><div class="tr"><i style="width:${c.length ? 100 * v / c.length : 0}%;background:${tcol[n]}"></i></div><b>${v}</b></div>`).join('')}</div><p class="dica">Classificação pelo ACOS em relação ao ACOS alvo de cada campanha (Excelente ≤ alvo · Bom ≤ 1,25× · Atenção ≤ 1,6× · Crítico acima).</p></div></div>
    ${sect('Campanhas', `${c.length} no total · ordenadas por investimento`)}<div class="cg">${c.slice().sort((a, b) => mm(b).cost - mm(a).cost).map(x => { const [cl, nm] = tier(x), k = mm(x); return `<div class="cp ${cl}"><h4><span>${esc(x.name)}</span><span class="ct">${nm}</span></h4><small style="color:var(--mut)">${esc(lojaTxt(x.loja))} · ${x.status === 'active' ? '<span class="ok">● ativa</span>' : x.status === 'paused' ? '⏸ pausada' : esc(x.status)} · orçamento/dia ${brl(x.daily_budget || x.budget)}${x.strategy ? ` · ${esc({ PROFITABILITY: 'rentabilidade', INCREASE: 'crescimento', VISIBILITY: 'visibilidade' }[x.strategy] || x.strategy)}` : ''}</small>
      <div class="cs"><div><span>ACOS atual</span><b>${k.total_amount ? num2(k.acos) + '%' : '—'}</b></div><div><span>ACOS alvo</span><b>${x.acos_target ? num2(x.acos_target) + '%' : '—'}</b></div><div><span>ROAS</span><b>${k.cost ? (k.total_amount / k.cost).toFixed(2).replace('.', ',') + 'x' : '—'}</b></div><div><span>Gasto</span><b>${brl(k.cost)}</b></div><div><span>Vendas Ads</span><b>${brl(k.total_amount)}</b></div><div><span>Unidades</span><b>${num(k.units_quantity)}</b></div></div></div>`; }).join('')}</div>`;
  const cs = c.filter(x => mm(x).cost > 0);
  mk('#cp1', { type: 'doughnut', data: { labels: cs.map(x => x.name), datasets: [{ data: cs.map(x => mm(x).cost), backgroundColor: PAL, borderWidth: 2, borderColor: '#fff' }] }, options: donut() });
};

// ═════════ ANÚNCIOS PATROCINADOS ═════════
VIEWS.anunciosads = async function () {
  const R = await getJ(`api/ads-anuncios?loja=${$('#loja').value}`), all = R.lista;
  const S = (f, L = all) => L.reduce((s, x) => s + (f(x) || 0), 0), cost = S(x => x.cost), venda = S(x => x.venda), un = S(x => x.unidades), orgV = S(x => x.orgVenda);
  const grupos = { 'Crítico': all.filter(x => x.saude === 'Crítico'), 'Atenção': all.filter(x => x.saude === 'Atenção'), 'Excelente': all.filter(x => x.saude === 'Excelente') };
  const f = { q: '', saude: '', status: '', camp: '', page: 1 }, st = { k: 'cost', d: -1 }, PG = 40;
  const top5 = all.filter(x => x.cost > 0).slice(0, 5);
  $('#view').innerHTML = `<div class="kgrid">${kpi('Investido', brl(cost), 'últimos 90 dias', 'ads', 'red')}${kpi('Receita Ads', brl(venda), 'vendas atribuídas', 'lucro', 'green')}${kpi('ROAS', cost ? (venda / cost).toFixed(1).replace('.', ',') + 'x' : '—', 'receita ÷ investimento', 'dre', 'blue')}${kpi('ACOS', pc(venda ? cost / venda : 0), 'investimento ÷ receita', 'promocoes', 'amber')}${kpi('Share Ads', pc(R.receitaTotal90 ? venda / R.receitaTotal90 : 0), 'do faturamento total', 'abc', 'purple')}${kpi('Unidades Ads', num(un), 'vendidas via Ads', 'itens', 'teal')}</div>
    <div class="kgrid">${[['Crítico', 'Produtos críticos', 'ACOS acima da margem ou gasto sem venda', 'red', 'alertas'], ['Atenção', 'Produtos em atenção', 'ACOS consumindo mais de 60% da margem', 'amber', 'info'], ['Excelente', 'Top performers', 'Ads com margem de sobra', 'green', 'trophy']].map(([k, t, s, c, i]) => `<div class="kc c-${c} seg" data-s="${k}"><div class="kh"><span>${t}</span><i>${svgIco(i)}</i></div><div class="kv">${num(grupos[k].length)}</div><div class="ks">${s}</div><button class="btn2" style="margin-top:8px;padding:4px 10px">Ver produtos</button></div>`).join('')}</div>
    <div class="two"><div class="box"><h3>Vendas Ads vs orgânicas</h3><div style="height:220px"><canvas id="aa1"></canvas></div></div><div class="box"><h3>Top 5 por investimento</h3><div class="prod" style="grid-template-columns:repeat(auto-fill,minmax(120px,1fr))">${top5.map(x => `<a class="pc" target="_blank" rel="noopener" href="${mlUrl('item', x.item)}" title="${esc(x.titulo)}">${x.thumb ? `<img loading="lazy" src="${esc(x.thumb)}" alt="">` : '<div class="ph0"></div>'}<b>${esc(x.titulo)}</b><div class="pm"><strong>${brl(x.cost)}</strong></div><div class="ks">ACOS ${pc(x.acos)} · <span class="sg ${SAUDE[x.saude]}" style="padding:1px 6px">${x.saude}</span></div></a>`).join('') || '<div class="empty">Nenhum gasto no período.</div>'}</div></div></div>
    <div class="box"><div class="boxh"><h3>Anúncios em Ads <small id="an2"></small></h3><div class="fgrid"><label style="min-width:200px">Buscar<input id="aq2" placeholder="Título ou MLB…"></label><label>Saúde<select id="as2"><option value="">Todas</option><option>Crítico</option><option>Atenção</option><option>Excelente</option><option>Sem gasto</option></select></label><label>Status<select id="ast"><option value="">Todos</option>${[...new Set(all.map(x => x.status))].sort().map(s => `<option>${esc(s)}</option>`).join('')}</select></label><label>Campanha<select id="acp"><option value="">Todas</option>${[...new Set(all.map(x => x.campanha).filter(Boolean))].sort().map(s => `<option>${esc(s)}</option>`).join('')}</select></label><button class="btn2" id="acsv">${ic('down', 13)}CSV</button></div></div>
      <div class="tw" style="max-height:none"><table class="rt" id="aat"><thead></thead><tbody></tbody></table></div><div class="pg" id="app"></div><p class="dica">Saúde: compara o ACOS do anúncio com a margem do produto antes do Ads (se o ACOS passa da margem, o Ads dá prejuízo). Sem custo cadastrado, usa só o ACOS (≤ 10% excelente, ≤ 20% atenção).</p></div>`;
  let cur = [];
  const draw = () => {
    cur = ordena(all.filter(x => (!f.q || (x.titulo + ' ' + x.item).toLowerCase().includes(f.q)) && (!f.saude || x.saude === f.saude) && (!f.status || x.status === f.status) && (!f.camp || x.campanha === f.camp)), st);
    $('#an2').textContent = `(${num(cur.length)})`;
    $('#aat thead').innerHTML = `<tr><th>Produto</th><th>Saúde</th>${thS('Gasto', 'cost', st, 'n')}${thS('ACOS', 'acos', st, 'n')}${thS('ROAS', 'roas', st, 'n')}${thS('Margem pós Ads', 'margemPos', st, 'n')}${thS('Vendas Ads', 'venda', st, 'n')}${thS('Vendas org.', 'orgVenda', st, 'n')}${thS('Unid.', 'unidades', st, 'n')}${thS('Cliques', 'clicks', st, 'n')}${thS('Impr.', 'prints', st, 'n')}${thS('CTR', 'ctr', st, 'n')}</tr>`;
    ligaSort('#aat', st, () => { f.page = 1; draw(); });
    const pgs = Math.max(Math.ceil(cur.length / PG), 1); f.page = Math.min(f.page, pgs);
    $('#aat tbody').innerHTML = cur.slice((f.page - 1) * PG, f.page * PG).map(x => `<tr><td><div class="pr">${thumb(x.thumb)}<div><b title="${esc(x.titulo)}">${esc(x.titulo)}</b><small>${lv('item', x.item, x.loja)} · ${esc(lojaTxt(x.loja))}${x.campanha ? ' · ' + esc(x.campanha) : ''} · ${esc(x.status)}</small></div></div></td>
      <td><span class="sg ${SAUDE[x.saude]}">${x.saude === 'Crítico' ? '▲ ' : x.saude === 'Excelente' ? '● ' : ''}${x.saude}</span></td><td class="n"><b>${brl(x.cost)}</b></td><td class="n">${x.acos == null ? '—' : pc(x.acos)}</td><td class="n">${x.roas == null ? '—' : x.roas.toFixed(2).replace('.', ',') + 'x'}</td>
      <td class="n">${x.margemPos == null ? '<small style="color:var(--mut)">s/ custo</small>' : `<span class="${x.margemPos < 0 ? 'bad' : 'ok'}">${pc(x.margemPos)}</span>`}</td><td class="n">${brl(x.venda)}</td><td class="n mt">${brl(x.orgVenda)}</td><td class="n">${num(x.unidades)}</td><td class="n mt">${num(x.clicks)}</td><td class="n mt">${num(x.prints)}</td><td class="n mt">${x.ctr == null ? '—' : pc(x.ctr, 2)}</td></tr>`).join('') || '<tr><td colspan="12" class="empty">Nenhum anúncio com esses filtros.</td></tr>';
    pager($('#app'), cur.length, f.page, PG, p => { f.page = p; draw(); });
  };
  const ler = () => { f.q = $('#aq2').value.toLowerCase().trim(); f.saude = $('#as2').value; f.status = $('#ast').value; f.camp = $('#acp').value; f.page = 1; draw(); };
  ['#as2', '#ast', '#acp'].forEach(i => $(i).onchange = ler); $('#aq2').oninput = debounce(ler);
  document.querySelectorAll('.seg').forEach(c => c.onclick = () => { $('#as2').value = c.dataset.s; ler(); $('#aat').scrollIntoView({ block: 'start' }); });
  $('#acsv').onclick = () => csv('anuncios-patrocinados.csv', [['MLB', x => x.item], ['Produto', x => x.titulo], ['Conta', x => lojaTxt(x.loja)], ['Campanha', x => x.campanha || ''], ['Status', x => x.status], ['Saúde', x => x.saude], ['Gasto', x => num2(x.cost)], ['Vendas Ads', x => num2(x.venda)], ['ACOS %', x => x.acos == null ? '' : num2(x.acos * 100)], ['ROAS', x => x.roas == null ? '' : num2(x.roas)], ['Margem pós Ads %', x => x.margemPos == null ? '' : num2(x.margemPos * 100)], ['Vendas orgânicas', x => num2(x.orgVenda)], ['Unidades Ads', x => x.unidades], ['Cliques', x => x.clicks], ['Impressões', x => x.prints]], cur);
  draw();
  mk('#aa1', { type: 'doughnut', data: { labels: ['Vendas por Ads', 'Orgânicas (itens com Ads)'], datasets: [{ data: [venda, orgV], backgroundColor: ['#3b82f6', '#22c55e'], borderWidth: 2, borderColor: '#fff' }] }, options: donut() });
};

// ═════════ ANÚNCIOS GERAIS (catálogo) ═════════
VIEWS.catalogo = async function () {
  const R = await api('catalogo'), all = R.linhas, T = R.total;
  const com = all.filter(x => x.segmento === 'Com ADS'), sem = all.filter(x => x.segmento === 'Sem ADS'), op = all.filter(x => x.oportunidade);
  const f = { q: '', seg: '', cat: '', page: 1 }, st = { k: 'receita', d: -1 }, PG = 40, cats = R.categorias, cTop = cats.slice(0, 10);
  const top5 = all.slice().sort((a, b) => b.lucro - a.lucro).slice(0, 5);
  $('#view').innerHTML = `<div class="kgrid">${kpi('Produtos vendidos', num(T.unidades), `${num(T.anuncios)} anúncios com venda`, 'itens', 'blue')}${kpi('Faturamento', brl(T.receita), 'no período', 'lucro', 'green')}${kpi('Lucro total', brl(T.lucro), 'antes de devoluções e Ads sem venda', 'dre', 'purple')}${kpi('Margem média', pc(T.margem), 'ponderada pelo faturamento', 'promocoes', 'amber')}</div>
    <div class="kgrid">${[['Com ADS', com, 'anúncios com publicidade ativa', 'blue', 'ads'], ['Sem ADS', sem, 'vendendo só no orgânico', 'slate', 'itens'], ['Oportunidades', op, 'sem Ads · vendendo · margem ≥ 25%', 'green', 'rocket']].map(([k, L, s, c, i]) => `<div class="kc c-${c} seg" data-s="${k}"><div class="kh"><span>${k}</span><i>${svgIco(i)}</i></div><div class="kv">${num(L.length)}</div><div class="ks">${s} · ${brl(L.reduce((t, x) => t + x.receita, 0))}</div><button class="btn2" style="margin-top:8px;padding:4px 10px">Filtrar</button></div>`).join('')}</div>
    <div class="two"><div class="box"><h3>Distribuição por segmento</h3><div style="height:220px"><canvas id="ct1"></canvas></div></div><div class="box"><h3>Top 5 por lucro</h3><div class="prod" style="grid-template-columns:repeat(auto-fill,minmax(120px,1fr))">${top5.map(x => `<a class="pc" href="#sku:${encodeURIComponent(x.sku)}" title="${esc(x.titulo)}">${x.thumb ? `<img loading="lazy" src="${esc(x.thumb)}" alt="">` : '<div class="ph0"></div>'}<b>${esc(x.titulo)}</b><div class="pm"><strong>${brl(x.lucro)}</strong></div><div class="ks">margem ${x.semCusto ? '—' : pc(x.margem)}</div></a>`).join('')}</div></div></div>
    <div class="two"><div class="box"><h3>Vendas por categoria</h3><div style="height:250px"><canvas id="ct2"></canvas></div></div><div class="box"><h3>Margem por categoria</h3><div style="height:250px"><canvas id="ct3"></canvas></div></div></div>
    <div class="two"><div class="box"><h3>Gasto em Ads por categoria</h3><div style="height:250px"><canvas id="ct4"></canvas></div></div><div class="box"><h3>Faturamento por categoria</h3><div style="height:250px"><canvas id="ct5"></canvas></div></div></div>
    <div class="box"><div class="boxh"><h3>Detalhamento por produto <small id="cn"></small></h3><div class="fgrid"><label style="min-width:200px">Buscar<input id="cq" placeholder="Título, SKU ou MLB…"></label><label>Segmento<select id="cs"><option value="">Todos</option><option>Com ADS</option><option>Sem ADS</option><option value="op">Oportunidades</option></select></label><label>Categoria<select id="cc"><option value="">Todas</option>${cats.map(c => `<option>${esc(c.categoria)}</option>`).join('')}</select></label><button class="btn2" id="ccsv">${ic('down', 13)}Exportar</button></div></div>
      <div class="tw" style="max-height:none"><table class="rt" id="ctb"><thead></thead><tbody></tbody></table></div><div class="pg" id="cpg"></div></div>`;
  let cur = [];
  const draw = () => {
    cur = ordena(all.filter(x => (!f.q || (x.titulo + ' ' + x.sku + ' ' + x.item).toLowerCase().includes(f.q)) && (!f.seg || (f.seg === 'op' ? x.oportunidade : x.segmento === f.seg)) && (!f.cat || x.categoria === f.cat)), st);
    $('#cn').textContent = `(${num(cur.length)})`;
    $('#ctb thead').innerHTML = `<tr><th>Produto</th><th>Categoria</th><th>Segmento</th>${thS('Faturamento', 'receita', st, 'n')}${thS('Lucro', 'lucro', st, 'n')}${thS('Margem', 'margem', st, 'c')}${thS('Unid.', 'unidades', st, 'n')}${thS('Gasto Ads', 'ads', st, 'n')}<th></th></tr>`;
    ligaSort('#ctb', st, () => { f.page = 1; draw(); });
    const pgs = Math.max(Math.ceil(cur.length / PG), 1); f.page = Math.min(f.page, pgs);
    $('#ctb tbody').innerHTML = cur.slice((f.page - 1) * PG, f.page * PG).map(x => `<tr><td><div class="pr">${thumb(x.thumb)}<div><b title="${esc(x.titulo)}">${skuLink(x.sku, esc(x.titulo))}</b><small><a class="lk" target="_blank" rel="noopener" href="${mlUrl('item', x.item)}">${esc(x.item)}</a> · ${esc(lojaTxt(x.loja))}${x.lg ? ` · ${x.lg}` : ''}</small></div></div></td><td><small>${esc(x.categoria)}</small></td>
      <td><span class="sg ${x.segmento === 'Com ADS' ? 'b' : 'n'}">${x.segmento}</span>${x.oportunidade ? ' <span class="sg g" title="Sem Ads, vendendo e com margem ≥ 25%">oportunidade</span>' : ''}</td><td class="n"><b>${brl(x.receita)}</b></td><td class="n"><b class="${x.lucro < 0 ? 'bad' : 'ok'}">${brl(x.lucro)}</b></td><td class="c">${mgPill(x.margem, x.semCusto)}</td><td class="n">${num(x.unidades)}</td><td class="n mt">${brl(x.ads)}</td>
      <td>${x.segmento === 'Com ADS' ? `<a class="btn2" style="padding:4px 9px;text-decoration:none" href="#anunciosads">Ver Ads</a>` : ''}</td></tr>`).join('') || '<tr><td colspan="9" class="empty">Nenhum anúncio com esses filtros.</td></tr>';
    pager($('#cpg'), cur.length, f.page, PG, p => { f.page = p; draw(); });
  };
  const ler = () => { f.q = $('#cq').value.toLowerCase().trim(); f.seg = $('#cs').value; f.cat = $('#cc').value; f.page = 1; draw(); };
  ['#cs', '#cc'].forEach(i => $(i).onchange = ler); $('#cq').oninput = debounce(ler);
  document.querySelectorAll('.seg').forEach(c => c.onclick = () => { $('#cs').value = c.dataset.s === 'Oportunidades' ? 'op' : c.dataset.s; ler(); $('#ctb').scrollIntoView({ block: 'start' }); });
  $('#ccsv').onclick = () => csv('anuncios-gerais.csv', [['MLB', x => x.item], ['SKU', x => x.sku], ['Produto', x => x.titulo], ['Conta', x => lojaTxt(x.loja)], ['Categoria', x => x.categoria], ['Segmento', x => x.segmento], ['Oportunidade', x => x.oportunidade ? 'sim' : ''], ['Faturamento', x => num2(x.receita)], ['Lucro', x => num2(x.lucro)], ['Margem %', x => x.semCusto ? '' : num2(x.margem * 100)], ['Unidades', x => x.unidades], ['Gasto Ads', x => num2(x.ads)]], cur);
  draw();
  const segRec = [com, sem].map(L => L.reduce((t, x) => t + x.receita, 0));
  mk('#ct1', { type: 'doughnut', data: { labels: ['Com ADS', 'Sem ADS'], datasets: [{ data: segRec, backgroundColor: ['#3b82f6', '#94a3b8'], borderWidth: 2, borderColor: '#fff' }] }, options: donut() });
  mk('#ct2', { type: 'doughnut', data: { labels: cTop.map(c => c.categoria), datasets: [{ data: cTop.map(c => c.receita), backgroundColor: PAL, borderWidth: 2, borderColor: '#fff' }] }, options: donut() });
  mk('#ct3', hbarCfg(cTop.map(c => c.categoria), cTop.map(c => +(c.margem).toFixed(4)), cTop.map(c => c.margem >= 0.25 ? '#22c55e' : c.margem >= 0.15 ? '#f59e0b' : '#ef4444'), pc));
  const cAds = cats.filter(c => c.ads > 0).sort((a, b) => b.ads - a.ads).slice(0, 10);
  mk('#ct4', hbarCfg(cAds.map(c => c.categoria), cAds.map(c => c.ads), '#8b5cf6'));
  mk('#ct5', hbarCfg(cTop.map(c => c.categoria), cTop.map(c => c.receita), '#3b82f6'));
};

// ═════════ FULL / ESTOQUE ═════════
VIEWS.estoque = async function () {
  const itens = await getJ(`api/itens?loja=${$('#loja').value}`);
  const L = itens.filter(x => x.status === 'active' || x.status === 'paused').map(x => {
    const vd = (x.vendidos90 || 0) / 90, est = x.estoque || 0, cob = vd > 0 ? est / vd : null, full = x.logistica === 'fulfillment';
    const st = est <= 0 ? (vd > 0 ? 'Sem estoque' : 'Zerado sem giro') : vd === 0 ? 'Parado' : cob < 7 ? 'Acabando' : cob < 15 ? 'Atenção' : 'OK';
    return { ...x, vd, cob, full, st, perdaDia: est <= 0 && vd > 0 ? vd * (x.preco || 0) : 0, repor: vd > 0 ? Math.max(0, Math.ceil(vd * 30 - est)) : 0, valorEst: est * (x.preco || 0) };
  });
  const cnt = k => L.filter(x => x.st === k).length, perda = L.reduce((t, x) => t + x.perdaDia, 0);
  const f = { lg: '', st: '', q: '', page: 1 }, ord = { k: 'cob', d: 1 }, PG = 50;
  const STC = { 'Sem estoque': 'r', 'Acabando': 'r', 'Atenção': 'a', 'OK': 'g', 'Parado': 'n', 'Zerado sem giro': 'n' };
  $('#view').innerHTML = `<div class="box" style="margin-bottom:14px;border-left:4px solid ${perda ? '#ef4444' : '#22c55e'}"><div class="boxh"><div><span class="sg ${perda ? 'r' : 'g'}" style="font-size:10px;letter-spacing:.05em">OPERAÇÃO FOCADA</span><h3 style="margin:6px 0 0">${ic('estoque', 16)} Gestão de estoque e Full</h3><small>Estoque atual dos anúncios e ritmo de vendas dos últimos 90 dias.</small></div>
      <div style="text-align:right"><small>PERDA ESTIMADA</small><div style="font-size:24px;font-weight:700;color:${perda ? 'var(--bad)' : 'var(--ok)'}">${brl(perda)}<small style="font-size:12px;color:var(--mut);font-weight:500"> /dia</small></div><small>${brl(perda * 30)} em 30 dias se nada for reposto</small></div></div></div>
    <div class="kgrid">${[['Sem estoque', 'red', 'cancel', 'vendia e zerou'], ['Acabando', 'red', 'alertas', 'menos de 7 dias de estoque'], ['Atenção', 'amber', 'info', '7 a 15 dias de estoque'], ['OK', 'green', 'reputacao', 'mais de 15 dias'], ['Parado', 'slate', 'estoque', 'com estoque e sem venda em 90 dias']].map(([k, c, i, s]) => `<div class="kc c-${c} seg" data-s="${k}" style="cursor:pointer"><div class="kh"><span>${k}</span><i>${svgIco(i)}</i></div><div class="kv">${num(cnt(k))}</div><div class="ks">${s}</div></div>`).join('')}</div>
    <div class="chips" id="ech"><span class="chip on" data-l=""><i style="background:#3b82f6"></i>Todos</span><span class="chip" data-l="full"><i style="background:${LOGCOR.Full}"></i>Full</span><span class="chip" data-l="proprio"><i style="background:${LOGCOR['Padrão']}"></i>Estoque próprio</span></div>
    <div class="box"><div class="boxh"><h3>Cobertura de estoque <small id="en"></small></h3><div class="fgrid"><label style="min-width:200px">Buscar<input id="eq" placeholder="Título ou MLB…"></label><label>Situação<select id="es"><option value="">Todas</option>${Object.keys(STC).map(s => `<option>${s}</option>`).join('')}</select></label><button class="btn2" id="ecsv">${ic('down', 13)}CSV</button></div></div>
      <div class="tw" style="max-height:none"><table class="rt" id="etb"><thead></thead><tbody></tbody></table></div><div class="pg" id="epg"></div><p class="dica">Cobertura = estoque ÷ vendas médias por dia (últimos 90 dias). Reposição sugerida = o que falta para 30 dias de venda. Perda estimada = venda média diária × preço dos anúncios sem estoque.</p></div>`;
  let cur = [];
  const draw = () => {
    cur = ordena(L.filter(x => (!f.lg || (f.lg === 'full' ? x.full : !x.full)) && (!f.st || x.st === f.st) && (!f.q || (x.titulo + ' ' + x.id).toLowerCase().includes(f.q))), ord);
    $('#en').textContent = `(${num(cur.length)})`;
    $('#etb thead').innerHTML = `<tr><th>Produto</th><th>Logística</th>${thS('Estoque', 'estoque', ord, 'n')}${thS('Vendas/dia', 'vd', ord, 'n')}${thS('Cobertura', 'cob', ord, 'c')}${thS('Preço', 'preco', ord, 'n')}<th>Situação</th>${thS('Repor (30 d)', 'repor', ord, 'n')}${thS('Perda/dia', 'perdaDia', ord, 'n')}</tr>`;
    ligaSort('#etb', ord, () => { f.page = 1; draw(); });
    const pgs = Math.max(Math.ceil(cur.length / PG), 1); f.page = Math.min(f.page, pgs);
    $('#etb tbody').innerHTML = cur.slice((f.page - 1) * PG, f.page * PG).map(x => `<tr><td><div class="pr">${thumb(x.img)}<div><b title="${esc(x.titulo)}">${esc(x.titulo)}</b><small><a class="lk" target="_blank" rel="noopener" href="${esc(x.link || mlUrl('item', x.id))}">${esc(x.id)}</a> · ${esc(lojaTxt(x.loja))} · ${esc(x.status === 'active' ? 'ativo' : 'pausado')}</small></div></div></td>
      <td>${x.full ? '<span class="lgt Full" style="margin:0">Full</span>' : '<span class="lgt Padrão" style="margin:0">Próprio</span>'}</td><td class="n"><b>${num(x.estoque)}</b></td><td class="n">${x.vd ? x.vd.toFixed(1).replace('.', ',') : '0'}</td>
      <td class="c">${x.cob == null ? '—' : `<span class="mg ${x.cob < 7 ? 'r' : x.cob < 15 ? 'o' : 'g'}">${x.cob > 365 ? '+1 ano' : Math.floor(x.cob) + ' d'}</span>`}</td><td class="n">${brl(x.preco)}</td><td><span class="sg ${STC[x.st]}">${x.st}</span></td><td class="n">${x.repor ? `<b>${num(x.repor)}</b> un.` : '—'}</td><td class="n">${x.perdaDia ? `<span class="bad">${brl(x.perdaDia)}</span>` : '—'}</td></tr>`).join('') || '<tr><td colspan="9" class="empty">Nenhum anúncio com esses filtros.</td></tr>';
    pager($('#epg'), cur.length, f.page, PG, p => { f.page = p; draw(); });
  };
  const ler = () => { f.q = $('#eq').value.toLowerCase().trim(); f.st = $('#es').value; f.page = 1; draw(); };
  $('#es').onchange = ler; $('#eq').oninput = debounce(ler);
  document.querySelectorAll('#ech .chip').forEach(c => c.onclick = () => { f.lg = c.dataset.l; document.querySelectorAll('#ech .chip').forEach(x => x.classList.toggle('on', x === c)); f.page = 1; draw(); });
  document.querySelectorAll('.seg').forEach(c => c.onclick = () => { $('#es').value = c.dataset.s; ler(); $('#etb').scrollIntoView({ block: 'start' }); });
  $('#ecsv').onclick = () => csv('estoque.csv', [['MLB', x => x.id], ['Produto', x => x.titulo], ['Conta', x => lojaTxt(x.loja)], ['Logística', x => x.full ? 'Full' : 'Próprio'], ['Estoque', x => x.estoque], ['Vendas/dia', x => num2(x.vd)], ['Cobertura (dias)', x => x.cob == null ? '' : Math.floor(x.cob)], ['Situação', x => x.st], ['Repor 30d', x => x.repor], ['Perda/dia', x => num2(x.perdaDia)]], cur);
  draw();
};

// ═════════ PROMOÇÕES (gerenciar) ═════════
const promoOrig = VIEWS.promocoes;
VIEWS.promocoes = async function () {
  const pP = Promise.all([api('promocoes-margem'), api('promocoes')]); pP.catch(() => {});
  await promoOrig();
  const [pm, lista] = await pP, camps = lista.lista;
  const ativas = camps.filter(c => /started|active/.test(c.status)), part = pm.filter(x => x.statusItem === 'started'), cand = pm.filter(x => x.statusItem === 'candidate');
  const prej = pm.filter(x => x.margemPromo != null && x.margemPromo < 0), mgs = part.filter(x => x.margemPromoPct != null), mMed = mgs.length ? mgs.reduce((t, x) => t + x.margemPromoPct, 0) / mgs.length : null;
  const dRest = c => c.finish_date ? Math.ceil((Date.parse(c.finish_date) - Date.now()) / 864e5) : null, dTot = c => c.start_date && c.finish_date ? Math.max((Date.parse(c.finish_date) - Date.parse(c.start_date)) / 864e5, 1) : null;
  const card = c => { const r = dRest(c), t = dTot(c), prog = r != null && t ? Math.min(Math.max(1 - r / t, 0), 1) : 0, n = Object.values(c.itens || {}).reduce((s, v) => s + v, 0), on = /started|active/.test(c.status);
    return `<div class="cp ${on ? '' : 'n'}"><h4><span class="ct" style="font-size:9.5px">${on ? '● EM ANDAMENTO' : esc(String(c.status || '').toUpperCase())}</span><small style="color:var(--mut);font-weight:500">${esc(c.id)}</small></h4><b style="font-size:13.5px">${esc(c.name || c.type)}</b><div style="color:var(--mut);font-size:11.5px;margin:6px 0">${esc(lojaTxt(c.loja))} · ${esc(c.type || '')}<br>▸ Início: ${c.start_date ? new Date(c.start_date).toLocaleString('pt-BR', { dateStyle: 'short', timeStyle: 'short' }) : '—'}<br>▸ Fim: ${c.finish_date ? new Date(c.finish_date).toLocaleString('pt-BR', { dateStyle: 'short', timeStyle: 'short' }) : '—'}</div>
      ${r != null ? `<div class="bar2" style="height:16px;position:relative"><i style="width:${(prog * 100).toFixed(0)}%;background:linear-gradient(90deg,#16a34a,#22c55e)"></i><small style="position:absolute;inset:0;display:grid;place-items:center;font-size:10px;font-weight:600;color:#0f172a">${r > 0 ? `${r} dias restantes` : 'encerrada'}</small></div>` : ''}<div class="ks" style="margin-top:8px"><span class="sg b">${num(n)} itens</span>${Object.entries(c.itens || {}).map(([k, v]) => `<span class="sg n">${esc(k)}: ${num(v)}</span>`).join('')}</div></div>`; };
  const topo = `<div class="kgrid">${kpi('Campanhas ativas', num(ativas.length), `${num(camps.length)} disponíveis no total`, 'promocoes', 'amber')}${kpi('Itens em promoção', num(part.length), 'participando agora', 'itens', 'green')}${kpi('Candidatos', num(cand.length), 'podem entrar em alguma campanha', 'campanhas', 'blue')}${kpi('Margem média', mMed == null ? '—' : pc(mMed), 'dos itens participando (com custo)', 'dre', 'purple')}${kpi('Itens com prejuízo', num(prej.length), 'margem negativa no preço da promoção', 'alertas', 'red')}</div>
    ${sect('Campanhas de desconto', 'vigentes e disponíveis')}<div class="cg" style="margin-bottom:14px">${camps.slice().sort((a, b) => (/started|active/.test(b.status) - /started|active/.test(a.status)) || String(a.finish_date).localeCompare(String(b.finish_date))).map(card).join('') || '<div class="empty">Nenhuma campanha coletada.</div>'}</div>
    ${sect('Quanto sobra em cada promoção', 'tabela completa abaixo')}`;
  $('#view').insertAdjacentHTML('afterbegin', topo);
  // a tabela de campanhas original fica redundante com os cards acima
  const dup = [...document.querySelectorAll('#view .box h3')].find(h => h.textContent.trim() === 'Campanhas');
  if (dup) { const bx = dup.closest('.box'), det = document.createElement('details'); det.className = 'box'; det.style.marginBottom = '14px'; det.innerHTML = '<summary style="font-weight:600;color:var(--ac)">Ver campanhas em tabela (ID, tipo, status, datas e anúncios por status)</summary>'; dup.remove(); while (bx.firstChild) det.appendChild(bx.firstChild); bx.replaceWith(det); }
};

// ═════════ FINANÇAS: indicadores ═════════
VIEWS.indicadores = async function () {
  const d = await api('dre', '&meses=12'), g = {};
  d.porMes.forEach(x => { const o = g[x.mes] ||= { mes: x.mes, pedidos: 0, receita: 0, devolucao: 0, comissao: 0, frete: 0, imposto: 0, custo: 0, ads: 0, adsSemVenda: 0, lucro: 0, perdaDevolucao: 0 }; for (const k of Object.keys(o)) if (k !== 'mes') o[k] += x[k] || 0; });
  const L = Object.values(g).sort((a, b) => a.mes.localeCompare(b.mes)).slice(-6).map(m => { const ads = m.ads + m.adsSemVenda, mc = m.receita - m.devolucao - m.comissao - m.frete - m.imposto - m.custo, fin = m.lucro - m.adsSemVenda - m.perdaDevolucao; return { ...m, ads, mc, fin }; });
  if (!L.length) { $('#view').innerHTML = '<div class="box empty"><b>Sem dados</b>Nenhum pedido nos últimos meses.</div>'; return; }
  const sec = t => `<tr class="sec"><td colspan="${L.length + 1}">${t}</td></tr>`, row = (n, f, cls = '') => `<tr class="${cls}"><td class="lb">${n}</td>${L.map(x => `<td class="n">${f(x)}</td>`).join('')}</tr>`, P = x => v => pc(x.receita ? v / x.receita : 0);
  const kp = L.at(-1), kpA = L.at(-2);
  $('#view').innerHTML = `<div class="kgrid">${kpi('Receita bruta (mês)', brl(kp.receita), `${mesNome(kp.mes)} ${kpA ? dlt(dv(kp.receita, kpA.receita)) : ''}`, 'lucro', 'blue')}${kpi('Margem de contribuição', pc(kp.receita ? kp.mc / kp.receita : 0), brl(kp.mc), 'promocoes', 'amber')}${kpi('Lucro líquido (mês)', brl(kp.fin), `após Ads e devoluções ${kpA ? dlt(dv(kp.fin, kpA.fin)) : ''}`, 'dre', 'green', kp.fin < 0 ? 'bad' : '')}${kpi('Margem líquida', pc(kp.receita ? kp.fin / kp.receita : 0), kpA ? `${dpp(kp.receita ? kp.fin / kp.receita : 0, kpA.receita ? kpA.fin / kpA.receita : 0)} vs mês anterior` : 'sobre a receita', 'promocoes', 'purple')}${kpi('Ticket médio', brl(kp.pedidos ? kp.receita / kp.pedidos : 0), `${num(kp.pedidos)} pedidos`, 'pedidos', 'teal')}</div>
    <div class="note">${ic('info', 13)} O mês corrente ainda está em andamento (valores parciais). Os indicadores não incluem as “outras cobranças” da fatura do ML (Full, DIFAL…) — essas aparecem no DRE.</div>
    <div class="box"><h3>Indicadores financeiros <small>últimos ${L.length} meses (fuso de Brasília)</small></h3><div class="tw dre"><table id="tdre" class="ind"><thead><tr><th>Indicador</th>${L.map(x => `<th class="n">${mesNome(x.mes)}</th>`).join('')}</tr></thead><tbody>
    ${sec('RENTABILIDADE')}${row('Receita bruta', x => brl(x.receita))}${row('Margem de contribuição R$', x => brl(x.mc), 'sub')}${row('Margem de contribuição %', x => P(x)(x.mc))}${row('Lucro líquido R$', x => brl(x.fin), 'tot')}${row('Margem líquida %', x => P(x)(x.fin))}
    ${sec('CUSTOS (% DA RECEITA)')}${row('Comissão Mercado Livre', x => P(x)(x.comissao))}${row('Frete pago pelo vendedor', x => P(x)(x.frete))}${row('Imposto (Simples)', x => P(x)(x.imposto))}${row('Custo dos produtos', x => P(x)(x.custo))}${row('Ads', x => P(x)(x.ads))}${row('Perda com devoluções', x => P(x)(x.perdaDevolucao))}
    ${sec('EFICIÊNCIA')}${row('Pedidos', x => num(x.pedidos))}${row('Receita por pedido', x => brl(x.pedidos ? x.receita / x.pedidos : 0))}${row('Lucro por pedido', x => brl(x.pedidos ? x.fin / x.pedidos : 0))}
    </tbody></table></div></div>`;
};
