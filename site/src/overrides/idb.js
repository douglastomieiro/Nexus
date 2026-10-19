// Guardador mínimo de chave→valor no IndexedDB (contas, tokens cifrados, cópia dos custos). Funciona dentro do Worker.
const abrir = () => new Promise((ok, erro) => {
  const r = indexedDB.open('nexus', 1);
  r.onupgradeneeded = () => r.result.createObjectStore('kv');
  r.onsuccess = () => ok(r.result);
  r.onerror = () => erro(r.error);
});
let bd;
const loja = modo => (bd ||= abrir()).then(d => d.transaction('kv', modo).objectStore('kv'));
const pede = req => new Promise((ok, erro) => { req.onsuccess = () => ok(req.result); req.onerror = () => erro(req.error); });

export const kvGet = async k => pede((await loja('readonly')).get(k));
export const kvSet = async (k, v) => pede((await loja('readwrite')).put(v, k));
export const kvDel = async k => pede((await loja('readwrite')).delete(k));
export const kvChaves = async () => pede((await loja('readonly')).getAllKeys());
