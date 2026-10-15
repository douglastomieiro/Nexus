// Ponto de entrada (node start.js ou um gerenciador como PM2): instala as dependências na 1ª execução neste PC
// e sobe o servidor.
import { existsSync } from 'node:fs';
import { execSync } from 'node:child_process';
import path from 'node:path';
import { fileURLToPath } from 'node:url';

const dir = path.dirname(fileURLToPath(import.meta.url));
const major = Number(process.versions.node.split('.')[0]);
if (major < 22) {
  console.error(`[ml-dashboard] Node ${process.versions.node} é antigo demais: o ML Dashboard exige Node 22 ou superior (better-sqlite3 13).`);
  process.exit(1);
}
if (!existsSync(path.join(dir, 'node_modules', 'better-sqlite3'))) {
  console.log('[ml-dashboard] primeira execução: npm install...');
  // --ignore-scripts: usa o binário pré-compilado que vem no pacote (evita exigir Visual Studio/node-gyp)
  execSync('npm install --ignore-scripts --no-audit --no-fund', { cwd: dir, stdio: 'inherit', shell: true });
}
await import('./server/index.js');
