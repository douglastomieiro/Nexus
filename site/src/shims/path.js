const norm = p => { const o = []; for (const s of p.split('/')) { if (!s || s === '.') continue; if (s === '..') o.pop(); else o.push(s); } return '/' + o.join('/'); };
export const join = (...a) => norm(a.filter(Boolean).join('/'));
export const resolve = (...a) => join(...a);
export const dirname = p => norm(p.split('/').slice(0, -1).join('/'));
export const basename = p => p.split('/').pop();
export default { join, resolve, dirname, basename };
