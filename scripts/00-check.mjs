import { LOJAS, readToken, mlGet } from '../server/ml.js';
for (const l of Object.keys(LOJAS)) {
  if (LOJAS[l].conta) console.log(l, LOJAS[l].nome, 'conta conectada pelo app (renovação automática)');
  else console.log(l, LOJAS[l].nome, 'expira em (min):', Math.round(readToken(l).expiraEm / 60000));
  const r = await mlGet(l, '/users/me');
  console.log(' ->', r.status, r.body?.id, r.body?.nickname, r.body?.error || '');
}
