// `fs` do Node não existe no navegador: o que o código do servidor usa para pastas/arquivos vira "nada a fazer".
const enoent = () => { throw Object.assign(new Error('ENOENT'), { code: 'ENOENT' }); };
const fs = { mkdirSync() {}, existsSync: () => false, readFileSync: enoent, writeFileSync() {}, renameSync() {}, readdirSync: () => [], unlinkSync() {}, rmSync() {} };
export default fs;
export const { mkdirSync, existsSync, readFileSync, writeFileSync, renameSync, readdirSync, unlinkSync, rmSync } = fs;
