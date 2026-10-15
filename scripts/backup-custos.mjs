// Uso:
//   node scripts/backup-custos.mjs                     → faz um backup agora
//   node scripts/backup-custos.mjs --restaurar         → restaura de backup-custos/custos-atual.json (só se a tabela estiver vazia)
//   node scripts/backup-custos.mjs --restaurar arquivo.json --forcar   → restaura de um instantâneo (sobrescreve os custos existentes)
import { fazerBackup, restaurar, BACKUP_DIR } from '../server/backup.js';
const a = process.argv.slice(2);
if (a.includes('--restaurar')) {
  const arq = a.find(x => x.endsWith('.json'));
  console.log(restaurar({ ...(arq ? { arquivo: arq } : {}), forcar: a.includes('--forcar') }));
} else console.log(fazerBackup('manual') ? `backup feito em ${BACKUP_DIR}` : 'backup não realizado (veja o aviso acima)');
