/**
 * KinesisLab — session-stats.js
 * Estadísticas multi-usuario por sesión + ranking local.
 * Sin backend: todo en localStorage. Si localStorage falla, degrada a memoria.
 *
 * API pública (window.SessionStats):
 *   .users.list()                       → array de nombres
 *   .users.active()                     → nombre activo o null
 *   .users.setActive(name)              → activa (crea si no existe)
 *   .users.remove(name)                 → borra usuario + sus sesiones
 *
 *   .session.start(toolId, config)      → arranca tracking en memoria
 *   .session.recordTrial(trial)         → {stimulus, rt, correct, errorType}
 *   .session.end()                      → guarda + devuelve {summary, comparison}
 *   .session.abort()                    → descarta sin guardar
 *   .session.inProgress()               → bool
 *
 *   .history.getRecent(toolId, n=10)    → últimas N del usuario activo
 *   .history.getBest(toolId, metric)    → mejor sesión por métrica
 *   .history.getAverage(toolId, metric) → promedio numérico
 *
 *   .ranking.getTop(toolId, metric, n=5)→ top N entre todos los usuarios
 *
 *   .feedbackPhrase(summary)            → frase positiva basada en evolución
 *
 *   .backup.build()                     → objeto JSON con todos los datos
 *   .backup.download(filename?)         → descarga archivo .json
 *   .backup.restore(data, {mode})       → 'merge' (default, dedup) | 'replace'
 *   .backup.summary()                   → {users, sessionsTotal} para preview
 */
(function (global) {
  'use strict';

  const KEY = {
    users: 'kineslab:users',
    activeUser: 'kineslab:activeUser',
    userSessions: (user, tool) => `kineslab:user:${user}:sessions:${tool}`
  };

  const MAX_SESSIONS_PER_TOOL = 50;

  // ---------- Storage helpers (tolerantes a fallos) ----------
  const memFallback = {};
  function safeGet(key, fallback) {
    try {
      const v = localStorage.getItem(key);
      if (v === null) return memFallback[key] !== undefined ? memFallback[key] : fallback;
      return JSON.parse(v);
    } catch (e) {
      return memFallback[key] !== undefined ? memFallback[key] : fallback;
    }
  }
  function safeSet(key, value) {
    memFallback[key] = value;
    try { localStorage.setItem(key, JSON.stringify(value)); } catch (e) {}
  }
  function safeRemove(key) {
    delete memFallback[key];
    try { localStorage.removeItem(key); } catch (e) {}
  }

  // ---------- Users ----------
  const users = {
    list() {
      const list = safeGet(KEY.users, []);
      return Array.isArray(list) ? list : [];
    },
    active() {
      return safeGet(KEY.activeUser, null);
    },
    setActive(name) {
      if (!name || typeof name !== 'string') return;
      name = name.trim();
      if (!name) return;
      const list = users.list();
      if (!list.includes(name)) {
        list.push(name);
        safeSet(KEY.users, list);
      }
      safeSet(KEY.activeUser, name);
    },
    remove(name) {
      const list = users.list().filter(u => u !== name);
      safeSet(KEY.users, list);
      if (users.active() === name) {
        safeSet(KEY.activeUser, list[0] || null);
      }
      // borrar sesiones de ese usuario en todas las tools (limpieza)
      try {
        for (let i = localStorage.length - 1; i >= 0; i--) {
          const k = localStorage.key(i);
          if (k && k.startsWith(`kineslab:user:${name}:sessions:`)) {
            safeRemove(k);
          }
        }
      } catch (e) {}
    }
  };

  // ---------- Session en curso ----------
  let current = null;

  const session = {
    start(toolId, config) {
      current = {
        toolId,
        config: config || {},
        startTime: Date.now(),
        trials: []
      };
    },
    recordTrial(trial) {
      if (!current) return;
      current.trials.push(Object.assign({}, trial, { t: Date.now() - current.startTime }));
    },
    end() {
      if (!current) return null;
      const summary = computeSummary(current);
      let comparison = null;
      if (summary && summary.total >= 5) {
        const user = users.active();
        if (user) saveSession(user, current.toolId, summary);
        comparison = buildComparison(user, current.toolId, summary);
      }
      current = null;
      return { summary, comparison };
    },
    abort() { current = null; },
    inProgress() { return current !== null; }
  };

  // ---------- Cálculo de resumen ----------
  function computeSummary(s) {
    const trials = s.trials;
    const total = trials.length;
    if (total === 0) return null;

    // Solo cuentan para accuracy las pruebas con resultado explícito (true/false).
    // En modo voz los trials se registran sin "correct" -> accuracy queda null.
    const evaluated = trials.filter(t => t.correct === true || t.correct === false);
    const correct = trials.filter(t => t.correct === true);
    const incorrect = trials.filter(t => t.correct === false);
    const accuracy = evaluated.length ? correct.length / evaluated.length : null;

    const rts = correct.filter(t => typeof t.rt === 'number').map(t => t.rt);
    const rtMedian = rts.length ? median(rts) : null;

    // tercios
    const third = Math.max(1, Math.floor(total / 3));
    const segments = [
      segmentStats(trials.slice(0, third)),
      segmentStats(trials.slice(third, 2 * third)),
      segmentStats(trials.slice(2 * third))
    ];

    const errors = {
      commission: incorrect.filter(t => t.errorType === 'commission').length,
      omission: incorrect.filter(t => t.errorType === 'omission').length,
      other: incorrect.filter(t => !t.errorType || (t.errorType !== 'commission' && t.errorType !== 'omission')).length
    };

    // Métricas derivadas: IES (Inverse Efficiency Score) y d' (sensibilidad)
    const ies = computeIES(rtMedian, accuracy);
    const dPrime = computeDPrime(trials);

    return {
      toolId: s.toolId,
      date: new Date(s.startTime).toISOString(),
      durationSec: Math.round((Date.now() - s.startTime) / 1000),
      config: s.config,
      total,
      accuracy,
      rtMedian,
      ies,
      dPrime,
      segments,
      errors
    };
  }

  // ---------- Métricas derivadas ----------

  // IES = mediana RT (correctos) / accuracy. Menor = mejor (combina velocidad + precisión).
  // Necesita rtMedian y accuracy > 0.
  function computeIES(rtMedian, accuracy) {
    if (rtMedian == null || accuracy == null || accuracy === 0) return null;
    return Math.round(rtMedian / accuracy);
  }

  // d' (d-prime) = z(hit_rate) − z(false_alarm_rate). Mayor = mejor discriminación.
  // Requiere trials con stimulus categorizado como target/nontarget (o equivalente).
  // Categorías target: 'target', 'go', 'ordered'. Categorías nontarget: 'nontarget', 'nogo', 'unordered', 'distractor'.
  // Aplica corrección de Macmillan 1/(2N) para evitar z(0) o z(1).
  function computeDPrime(trials) {
    if (!Array.isArray(trials) || trials.length === 0) return null;
    const TARGET = new Set(['target', 'go', 'ordered']);
    const NONTARGET = new Set(['nontarget', 'nogo', 'unordered', 'distractor']);
    let targets = 0, nontargets = 0, hits = 0, falseAlarms = 0;
    trials.forEach(t => {
      if (TARGET.has(t.stimulus)) {
        targets++;
        if (t.correct === true) hits++;
      } else if (NONTARGET.has(t.stimulus)) {
        nontargets++;
        if (t.correct === false) falseAlarms++;
      }
    });
    if (targets < 3 || nontargets < 3) return null;
    let hitRate = hits / targets;
    let faRate = falseAlarms / nontargets;
    if (hitRate >= 1) hitRate = 1 - 1 / (2 * targets);
    if (hitRate <= 0) hitRate = 1 / (2 * targets);
    if (faRate >= 1) faRate = 1 - 1 / (2 * nontargets);
    if (faRate <= 0) faRate = 1 / (2 * nontargets);
    const zH = normalInverseCdf(hitRate);
    const zFA = normalInverseCdf(faRate);
    if (zH == null || zFA == null) return null;
    return Math.round((zH - zFA) * 100) / 100;
  }

  // Inversa de la CDF normal estándar (algoritmo de Acklam, error < 1.15e-9).
  function normalInverseCdf(p) {
    if (p <= 0 || p >= 1) return null;
    const a = [-3.969683028665376e+01, 2.209460984245205e+02, -2.759285104469687e+02,
                1.383577518672690e+02, -3.066479806614716e+01, 2.506628277459239e+00];
    const b = [-5.447609879822406e+01, 1.615858368580409e+02, -1.556989798598866e+02,
                6.680131188771972e+01, -1.328068155288572e+01];
    const c = [-7.784894002430293e-03, -3.223964580411365e-01, -2.400758277161838e+00,
               -2.549732539343734e+00,  4.374664141464968e+00, 2.938163982698783e+00];
    const d = [7.784695709041462e-03, 3.224671290700398e-01, 2.445134137142996e+00,
                3.754408661907416e+00];
    const plow = 0.02425, phigh = 1 - plow;
    let q, r;
    if (p < plow) {
      q = Math.sqrt(-2 * Math.log(p));
      return (((((c[0] * q + c[1]) * q + c[2]) * q + c[3]) * q + c[4]) * q + c[5]) /
             ((((d[0] * q + d[1]) * q + d[2]) * q + d[3]) * q + 1);
    } else if (p <= phigh) {
      q = p - 0.5;
      r = q * q;
      return (((((a[0] * r + a[1]) * r + a[2]) * r + a[3]) * r + a[4]) * r + a[5]) * q /
             (((((b[0] * r + b[1]) * r + b[2]) * r + b[3]) * r + b[4]) * r + 1);
    }
    q = Math.sqrt(-2 * Math.log(1 - p));
    return -(((((c[0] * q + c[1]) * q + c[2]) * q + c[3]) * q + c[4]) * q + c[5]) /
            ((((d[0] * q + d[1]) * q + d[2]) * q + d[3]) * q + 1);
  }

  function segmentStats(arr) {
    if (!arr.length) return { count: 0, accuracy: null, rtMedian: null };
    const evaluated = arr.filter(t => t.correct === true || t.correct === false);
    const corr = arr.filter(t => t.correct === true);
    const rts = corr.filter(t => typeof t.rt === 'number').map(t => t.rt);
    return {
      count: arr.length,
      accuracy: evaluated.length ? corr.length / evaluated.length : null,
      rtMedian: rts.length ? median(rts) : null
    };
  }

  function median(arr) {
    if (!arr.length) return null;
    const sorted = arr.slice().sort((a, b) => a - b);
    const n = sorted.length;
    if (n % 2 === 0) return Math.round((sorted[n / 2 - 1] + sorted[n / 2]) / 2);
    return sorted[(n - 1) / 2];
  }

  // ---------- Persistencia de sesión ----------
  function saveSession(user, toolId, summary) {
    const key = KEY.userSessions(user, toolId);
    const list = safeGet(key, []);
    list.push(summary);
    while (list.length > MAX_SESSIONS_PER_TOOL) list.shift();
    safeSet(key, list);
  }

  // ---------- Historial ----------
  const history = {
    getRecent(toolId, n) {
      n = n || 10;
      const user = users.active();
      if (!user) return [];
      const list = safeGet(KEY.userSessions(user, toolId), []);
      return list.slice(-n).reverse();
    },
    getBest(toolId, metric) {
      metric = metric || 'rtMedian';
      const user = users.active();
      if (!user) return null;
      const list = safeGet(KEY.userSessions(user, toolId), []);
      if (!list.length) return null;
      const lowerBetter = (metric === 'rtMedian');
      return list.reduce((best, cur) => {
        if (cur[metric] == null) return best;
        if (!best) return cur;
        const isCurrentBetter = lowerBetter ? cur[metric] < best[metric] : cur[metric] > best[metric];
        return isCurrentBetter ? cur : best;
      }, null);
    },
    getAverage(toolId, metric) {
      metric = metric || 'rtMedian';
      const user = users.active();
      if (!user) return null;
      const list = safeGet(KEY.userSessions(user, toolId), []);
      const values = list.map(s => s[metric]).filter(v => v != null);
      if (!values.length) return null;
      return Math.round(values.reduce((a, b) => a + b, 0) / values.length);
    }
  };

  // ---------- Tools con datos guardados ----------
  const tools = {
    activeTools() {
      const result = new Set();
      try {
        for (let i = 0; i < localStorage.length; i++) {
          const k = localStorage.key(i);
          const parsed = parseUserSessionKey(k);
          if (parsed) result.add(parsed.toolId);
        }
      } catch (e) {}
      Object.keys(memFallback).forEach(k => {
        const parsed = parseUserSessionKey(k);
        if (parsed) result.add(parsed.toolId);
      });
      return Array.from(result).sort();
    }
  };

  // Helper que también necesita backup, lo defino aquí para que esté disponible arriba.
  function parseUserSessionKey(key) {
    if (!key || typeof key !== 'string') return null;
    const m = /^kineslab:user:(.+):sessions:(.+)$/.exec(key);
    if (!m) return null;
    return { user: m[1], toolId: m[2] };
  }

  // ---------- Ranking local entre usuarios ----------
  const ranking = {
    getTop(toolId, metric, n) {
      metric = metric || 'rtMedian';
      n = n || 5;
      const lowerBetter = (metric === 'rtMedian');
      const items = users.list().map(user => {
        const list = safeGet(KEY.userSessions(user, toolId), []);
        const values = list.map(s => s[metric]).filter(v => v != null);
        if (!values.length) return null;
        const best = lowerBetter ? Math.min.apply(null, values) : Math.max.apply(null, values);
        return { user, value: best, sessions: list.length };
      }).filter(Boolean);
      items.sort((a, b) => lowerBetter ? a.value - b.value : b.value - a.value);
      return items.slice(0, n);
    }
  };

  // ---------- Comparación post-sesión ----------
  function buildComparison(user, toolId, current) {
    if (!user) return null;
    const best = history.getBest(toolId, 'rtMedian');
    const avg = history.getAverage(toolId, 'rtMedian');
    const top = ranking.getTop(toolId, 'rtMedian', 5);
    let myRank = null;
    const idx = top.findIndex(t => t.user === user);
    if (idx >= 0) myRank = idx + 1;
    return {
      personalBest: best ? { rtMedian: best.rtMedian, date: best.date } : null,
      personalAvg: avg,
      ranking: top,
      myRank,
      improvedVsAvg: avg != null && current.rtMedian != null && current.rtMedian < avg,
      improvedVsBest: best && current.rtMedian != null && current.rtMedian < best.rtMedian
    };
  }

  // ---------- Frase de feedback (siempre positiva) ----------
  function feedbackPhrase(summary) {
    if (!summary || !summary.segments || summary.segments.length < 3) {
      return 'Sesión completada';
    }
    const first = summary.segments[0];
    const last = summary.segments[2];
    const rtFirst = first.rtMedian, rtLast = last.rtMedian;
    const accFirst = first.accuracy != null ? first.accuracy : 0;
    const accLast = last.accuracy != null ? last.accuracy : 0;
    const rtDelta = (rtFirst != null && rtLast != null) ? (rtFirst - rtLast) : 0;
    const accDelta = accLast - accFirst;

    if (rtDelta >= 30 && accDelta >= 0.05) return '¡Has mejorado mucho durante la sesión!';
    if (rtDelta >= 30) return 'Respondes cada vez más rápido';
    if (accDelta >= 0.05) return 'Cada vez fallas menos';
    if (rtDelta <= -50) return 'Has aguantado bien hasta el final';
    return 'Rendimiento constante toda la sesión';
  }

  // ---------- Backup / Restore ----------
  const BACKUP_VERSION = 1;
  const STORAGE_PREFIX = 'kineslab:';

  function listAllKineslabKeys() {
    const keys = [];
    try {
      for (let i = 0; i < localStorage.length; i++) {
        const k = localStorage.key(i);
        if (k && k.startsWith(STORAGE_PREFIX)) keys.push(k);
      }
    } catch (e) {}
    // añadir las del fallback en memoria
    Object.keys(memFallback).forEach(k => {
      if (k.startsWith(STORAGE_PREFIX) && keys.indexOf(k) === -1) keys.push(k);
    });
    return keys;
  }

  function sessionFingerprint(s) {
    // identifica una sesión inequívocamente para dedup
    return [s.toolId, s.date, s.total, s.rtMedian].join('|');
  }

  const backup = {
    build() {
      const data = {
        kineslabBackup: true,
        version: BACKUP_VERSION,
        exportedAt: new Date().toISOString(),
        users: users.list(),
        activeUser: users.active(),
        sessions: {}
      };
      listAllKineslabKeys().forEach(key => {
        const parsed = parseUserSessionKey(key);
        if (!parsed) return;
        const list = safeGet(key, []);
        if (!Array.isArray(list) || !list.length) return;
        if (!data.sessions[parsed.user]) data.sessions[parsed.user] = {};
        data.sessions[parsed.user][parsed.toolId] = list;
      });
      return data;
    },

    download(filename) {
      const data = backup.build();
      const json = JSON.stringify(data, null, 2);
      const ts = new Date().toISOString().slice(0, 10);
      const name = filename || `kineslab-backup-${ts}.json`;
      try {
        const blob = new Blob([json], { type: 'application/json' });
        const url = URL.createObjectURL(blob);
        const a = document.createElement('a');
        a.href = url;
        a.download = name;
        document.body.appendChild(a);
        a.click();
        document.body.removeChild(a);
        setTimeout(() => URL.revokeObjectURL(url), 1000);
        return { ok: true, filename: name };
      } catch (e) {
        return { ok: false, error: 'No se pudo crear la descarga: ' + e.message };
      }
    },

    summary(data) {
      // resumen rápido para mostrar antes de importar
      if (!data || !data.kineslabBackup) return { ok: false, error: 'Archivo no válido' };
      let sessionsTotal = 0;
      if (data.sessions) {
        Object.keys(data.sessions).forEach(u => {
          Object.keys(data.sessions[u]).forEach(tool => {
            const list = data.sessions[u][tool];
            if (Array.isArray(list)) sessionsTotal += list.length;
          });
        });
      }
      return {
        ok: true,
        version: data.version,
        exportedAt: data.exportedAt,
        users: Array.isArray(data.users) ? data.users : [],
        sessionsTotal
      };
    },

    restore(data, options) {
      options = options || {};
      const mode = options.mode === 'replace' ? 'replace' : 'merge';

      if (!data || !data.kineslabBackup) return { ok: false, error: 'No es un backup de KinesisLab' };
      if (data.version > BACKUP_VERSION) return { ok: false, error: 'Versión de backup más nueva que esta app' };

      const result = { ok: true, imported: { users: 0, sessions: 0, skipped: 0 } };

      if (mode === 'replace') {
        // borrar TODO antes
        listAllKineslabKeys().forEach(k => safeRemove(k));
      }

      // usuarios
      const existingUsers = users.list();
      const incomingUsers = Array.isArray(data.users) ? data.users : [];
      const mergedUsers = mode === 'replace' ? incomingUsers.slice() : existingUsers.slice();
      incomingUsers.forEach(u => {
        if (!mergedUsers.includes(u)) {
          mergedUsers.push(u);
          result.imported.users++;
        }
      });
      safeSet(KEY.users, mergedUsers);

      if (mode === 'replace' && data.activeUser) {
        safeSet(KEY.activeUser, data.activeUser);
      } else if (mode === 'merge' && !users.active() && data.activeUser) {
        safeSet(KEY.activeUser, data.activeUser);
      }

      // sesiones
      if (data.sessions) {
        Object.keys(data.sessions).forEach(user => {
          const userTools = data.sessions[user];
          Object.keys(userTools).forEach(toolId => {
            const incoming = userTools[toolId];
            if (!Array.isArray(incoming)) return;
            const key = KEY.userSessions(user, toolId);
            if (mode === 'replace') {
              const trimmed = incoming.slice(-MAX_SESSIONS_PER_TOOL);
              safeSet(key, trimmed);
              result.imported.sessions += trimmed.length;
            } else {
              const existing = safeGet(key, []);
              const existingFingerprints = new Set(existing.map(sessionFingerprint));
              const merged = existing.slice();
              incoming.forEach(s => {
                const fp = sessionFingerprint(s);
                if (existingFingerprints.has(fp)) {
                  result.imported.skipped++;
                } else {
                  merged.push(s);
                  existingFingerprints.add(fp);
                  result.imported.sessions++;
                }
              });
              merged.sort((a, b) => new Date(a.date) - new Date(b.date));
              while (merged.length > MAX_SESSIONS_PER_TOOL) merged.shift();
              safeSet(key, merged);
            }
          });
        });
      }

      return result;
    }
  };

  // ---------- API pública ----------
  global.SessionStats = {
    users,
    session,
    history,
    ranking,
    tools,
    feedbackPhrase,
    backup,
    // Helpers de métricas derivadas (también precalculadas en summary.ies/summary.dPrime)
    computeIES,
    computeDPrime
  };

})(window);
