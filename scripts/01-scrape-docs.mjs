// Fase 0a — Lê TODA a documentação do ML (menu lateral) e extrai endpoints.
// Saída: data/docs/pages/<slug>.txt (texto integral), data/endpoints.json, data/pages.json
import * as cheerio from 'cheerio';
import fs from 'node:fs';
import path from 'node:path';

const BASE = 'https://developers.mercadolivre.com.br/pt_br/';
const OUT = path.resolve('data');
fs.mkdirSync(path.join(OUT, 'docs/pages'), { recursive: true });

const get = async (url, tries = 3) => {
  for (let i = 0; i < tries; i++) {
    try {
      const r = await fetch(url, { headers: { 'user-agent': 'Mozilla/5.0 ml-dashboard-docs-reader' } });
      if (r.ok) return await r.text();
    } catch {}
    await new Promise(r => setTimeout(r, 800 * (i + 1)));
  }
  return null;
};

const home = await get(BASE + 'guia-para-produtos');
const $h = cheerio.load(home);
const slugs = new Map();
$h('a[href]').each((_, a) => {
  const h = $h(a).attr('href');
  if (!h || /^(https?:|\/|#|mailto)/.test(h)) return;
  const s = h.split('#')[0].split('?')[0];
  if (s && !slugs.has(s)) slugs.set(s, $h(a).text().trim());
});
console.log('páginas no menu:', slugs.size);

const METHODS = 'GET|POST|PUT|DELETE|PATCH';
const URLRE = /https?:\/\/api\.mercadolibre\.com(\/[^\s'"\\<>`)]*)?/g;
const endpoints = new Map();
const pages = [];

const add = (method, p, slug, extra = {}) => {
  p = p.replace(/[.,;]+$/, '');
  const key = method + ' ' + p.split('?')[0];
  const e = endpoints.get(key) || { method, path: p.split('?')[0], queries: [], pages: [], examples: [] };
  const q = p.includes('?') ? p.split('?')[1] : null;
  if (q && !e.queries.includes(q)) e.queries.push(q);
  if (!e.pages.includes(slug)) e.pages.push(slug);
  if (extra.example && e.examples.length < 2) e.examples.push(extra.example.slice(0, 4000));
  endpoints.set(key, e);
};

const list = [...slugs.entries()];
let idx = 0;
await Promise.all(Array.from({ length: 6 }, async () => {
  while (idx < list.length) {
    const [slug, title] = list[idx++];
    const html = await get(BASE + slug);
    if (!html) { console.log('FALHOU', slug); pages.push({ slug, title, error: true }); continue; }
    const $ = cheerio.load(html);
    const main = $('main').length ? $('main') : $('body');
    main.find('script,style').remove();
    // texto integral (preserva blocos de código)
    main.find('pre').each((_, el) => { $(el).text('\n```\n' + $(el).text() + '\n```\n'); });
    const text = main.text().replace(/\n{3,}/g, '\n\n');
    fs.writeFileSync(path.join(OUT, 'docs/pages', slug + '.txt'), `# ${title}\n${BASE}${slug}\n\n${text}`);

    // endpoints: blocos de código (curl) + linhas "GET /algo"
    const pres = main.find('pre').toArray().map(el => $(el).text().replace(/\\\s*\n\s*/g, ' '));
    pres.forEach((code, i) => {
      for (const part of code.split(/(?=curl\s)/)) {
        const m = part.match(new RegExp(`-X\\s*(${METHODS})`, 'i'));
        const urls = [...part.matchAll(URLRE)];
        if (!urls.length) continue;
        const method = (m ? m[1] : /--data|-d\s/.test(part) ? 'POST' : 'GET').toUpperCase();
        const next = pres.slice(i + 1, i + 3).find(c => /^\s*[\[{]/.test(c));
        add(method, urls[0][1] || '/', slug, { example: next });
      }
    });
    for (const m of text.matchAll(new RegExp(`\\b(${METHODS})\\s+(\\/[A-Za-z0-9_\\-\\/\\{\\}\\$:\\.?=&,]+)`, 'g'))) {
      if (m[2].length > 2) add(m[1], m[2], slug);
    }
    pages.push({ slug, title, chars: text.length });
  }
}));

const eps = [...endpoints.values()].sort((a, b) => a.path.localeCompare(b.path));
fs.writeFileSync(path.join(OUT, 'endpoints.json'), JSON.stringify(eps, null, 1));
fs.writeFileSync(path.join(OUT, 'pages.json'), JSON.stringify(pages, null, 1));
const byM = eps.reduce((a, e) => ((a[e.method] = (a[e.method] || 0) + 1), a), {});
console.log('páginas lidas:', pages.filter(p => !p.error).length, '| endpoints únicos:', eps.length, byM);
