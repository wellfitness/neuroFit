import { readFileSync } from 'node:fs';
import { resolve, dirname } from 'node:path';
import { fileURLToPath } from 'node:url';
import { beforeEach } from 'vitest';

const __dirname = dirname(fileURLToPath(import.meta.url));
const ROOT = resolve(__dirname, '..');

const sessionStatsCode = readFileSync(resolve(ROOT, 'assets/js/session-stats.js'), 'utf-8');
const cadenceCode = readFileSync(resolve(ROOT, 'assets/js/cadence-scheduler.js'), 'utf-8');

beforeEach(() => {
  try { localStorage.clear(); } catch (_) {}
  delete window.SessionStats;
  delete window.CadenceScheduler;

  // session-stats.js es IIFE: (function(global){...})(window) → asigna a global.SessionStats
  new Function('window', sessionStatsCode)(window);

  // cadence-scheduler.js declara `class CadenceScheduler` top-level → la expongo en window
  new Function('window', cadenceCode + '\nwindow.CadenceScheduler = CadenceScheduler;')(window);
});
