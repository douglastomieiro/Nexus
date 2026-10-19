// Só o que o servidor usa (ids aleatórios curtos). Quem precisa de criptografia de verdade usa WebCrypto direto (overrides/contas.js).
export const randomBytes = n => {
  const a = crypto.getRandomValues(new Uint8Array(n));
  return { toString: enc => (enc === 'hex' ? [...a].map(b => b.toString(16).padStart(2, '0')).join('')
    : btoa(String.fromCharCode(...a)).replace(/\+/g, '-').replace(/\//g, '_').replace(/=+$/, '')) };
};
export default { randomBytes };
