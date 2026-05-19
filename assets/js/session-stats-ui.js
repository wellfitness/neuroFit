/**
 * KinesisLab — session-stats-ui.js
 * Capa de UI para session-stats: badge, selector usuario, panel post-sesión.
 *
 * Requiere session-stats.js cargado antes.
 *
 * Uso por tool:
 *   SessionStatsUI.init({
 *     toolId: 'go-nogo',
 *     toolName: 'Go / No-Go',
 *     primaryMetric: 'rtMedian',   // 'rtMedian' (menor=mejor) | 'accuracy' (mayor=mejor)
 *     onRepeat: () => tool.togglePlay(),
 *     onClose: () => tool.resetVisual()
 *   });
 *
 *   // tras pulsar Finalizar en la tool:
 *   const result = SessionStats.session.end();
 *   if (result && result.summary) {
 *     SessionStatsUI.showResults(result.summary, result.comparison);
 *   }
 */
(function (global) {
  'use strict';

  let config = null;
  let initialized = false;

  function init(opts) {
    config = Object.assign({
      toolId: '',
      toolName: '',
      primaryMetric: 'rtMedian',
      onRepeat: null,
      onClose: null
    }, opts || {});

    if (initialized) return;
    initialized = true;

    injectBadge();
    injectRankingButton();
    injectUserSelector();
    injectResultsPanel();
    refreshBadge();
  }

  // ---------- Badge en .exec-header-actions ----------
  function injectBadge() {
    const headerActions = document.querySelector('.exec-header-actions');
    if (!headerActions) return;
    const btn = document.createElement('button');
    btn.type = 'button';
    btn.className = 'user-badge';
    btn.id = 'kineslabUserBadge';
    btn.setAttribute('aria-label', 'Cambiar usuario');
    btn.innerHTML = '<span class="material-symbols-sharp">person</span><span class="user-badge-text"></span>';
    btn.addEventListener('click', openUserSelector);
    headerActions.insertBefore(btn, headerActions.firstChild);
  }

  // ---------- Botón ranking junto al badge ----------
  function injectRankingButton() {
    const headerActions = document.querySelector('.exec-header-actions');
    if (!headerActions) return;
    const badge = document.getElementById('kineslabUserBadge');
    const btn = document.createElement('button');
    btn.type = 'button';
    btn.className = 'btn-info';
    btn.id = 'kineslabRankingBtn';
    btn.setAttribute('aria-label', 'Ver ranking del centro');
    btn.setAttribute('title', 'Ranking del centro');
    btn.innerHTML = '<span class="material-symbols-sharp">leaderboard</span>';
    btn.addEventListener('click', () => {
      const rankingUrl = (config && config.rankingUrl) || '../../ranking.html';
      window.location.href = rankingUrl;
    });
    // insertar justo después del badge si existe, si no al principio
    if (badge && badge.nextSibling) {
      headerActions.insertBefore(btn, badge.nextSibling);
    } else if (badge) {
      headerActions.appendChild(btn);
    } else {
      headerActions.insertBefore(btn, headerActions.firstChild);
    }
  }

  function refreshBadge() {
    const text = document.querySelector('#kineslabUserBadge .user-badge-text');
    if (!text) return;
    const u = SessionStats.users.active();
    text.textContent = u || 'Invitado';
  }

  // ---------- User selector modal ----------
  function injectUserSelector() {
    const div = document.createElement('div');
    div.className = 'user-selector-overlay';
    div.id = 'userSelectorOverlay';
    div.innerHTML = `
      <div class="user-selector-modal">
        <h2>¿Quién entrena?</h2>

        <h3>Usuarios guardados</h3>
        <ul class="user-list" id="userList"></ul>

        <h3>Nuevo usuario</h3>
        <div class="user-selector-new">
          <input type="text" id="newUserName" placeholder="Tu nombre" maxlength="30" autocomplete="off">
          <button type="button" id="btnAddUser">Crear</button>
        </div>

        <h3>Datos</h3>
        <div class="user-selector-actions">
          <button type="button" id="btnExportBackup">
            <span class="material-symbols-sharp">download</span>
            <span>Descargar copia de seguridad</span>
          </button>
          <button type="button" id="btnShareBackup" style="display:none">
            <span class="material-symbols-sharp">share</span>
            <span>Compartir copia (WhatsApp, Drive...)</span>
          </button>
          <button type="button" id="btnImportBackup">
            <span class="material-symbols-sharp">upload</span>
            <span>Importar copia de seguridad</span>
          </button>
          <input type="file" id="fileImportBackup" accept="application/json,.json" style="display:none">
        </div>

        <div id="userSelectorMsg" class="user-selector-msg" style="display:none"></div>

        <button type="button" class="user-selector-close" id="btnCloseSelector">Hecho</button>
      </div>
    `;
    document.body.appendChild(div);

    div.addEventListener('click', (e) => {
      if (e.target === div) closeUserSelector();
    });
    document.getElementById('btnCloseSelector').addEventListener('click', closeUserSelector);
    document.getElementById('btnAddUser').addEventListener('click', addUser);
    document.getElementById('newUserName').addEventListener('keypress', (e) => {
      if (e.key === 'Enter') { e.preventDefault(); addUser(); }
    });
    document.getElementById('btnExportBackup').addEventListener('click', exportBackup);
    document.getElementById('btnImportBackup').addEventListener('click', () => {
      document.getElementById('fileImportBackup').click();
    });
    document.getElementById('fileImportBackup').addEventListener('change', handleImport);

    // Mostrar botón Compartir solo si el navegador soporta Web Share API con
    // archivos (móviles modernos sí, escritorio normalmente no). En PC el
    // usuario tiene el botón Descargar y desde ahí comparte manualmente.
    const shareBtn = document.getElementById('btnShareBackup');
    if (shareBtn && canShareFiles()) {
      shareBtn.style.display = '';
      shareBtn.addEventListener('click', shareBackup);
    }
  }

  // ---------- Compartir vía Web Share API (móvil) ----------
  function canShareFiles() {
    if (typeof navigator === 'undefined') return false;
    if (typeof navigator.share !== 'function') return false;
    if (typeof navigator.canShare !== 'function') return false;
    try {
      const probe = new File(['{}'], 'probe.json', { type: 'application/json' });
      return navigator.canShare({ files: [probe] });
    } catch (e) {
      return false;
    }
  }

  async function shareBackup() {
    if (!SessionStats || !SessionStats.backup) {
      showMsg('err', 'SessionStats no disponible');
      return;
    }
    const data = SessionStats.backup.build();
    const summary = SessionStats.backup.summary(data);
    const ts = new Date().toISOString().slice(0, 10);
    const filename = `kineslab-backup-${ts}.json`;
    const json = JSON.stringify(data, null, 2);

    let file;
    try {
      file = new File([json], filename, { type: 'application/json' });
    } catch (e) {
      showMsg('err', 'Tu navegador no permite compartir archivos. Usa "Descargar copia".');
      return;
    }

    try {
      const nUsers = summary.ok ? summary.users.length : 0;
      const nSes = summary.ok ? summary.sessionsTotal : 0;
      const usersTxt = nUsers === 1 ? '1 usuario' : `${nUsers} usuarios`;
      const sesTxt = nSes === 1 ? '1 sesión' : `${nSes} sesiones`;
      await navigator.share({
        files: [file],
        title: 'Copia de seguridad KinesisLab',
        text: `Copia de KinesisLab — ${summary.ok ? usersTxt + ', ' + sesTxt : 'datos de entrenamiento'}.`
      });
      showMsg('ok', 'Copia compartida');
    } catch (err) {
      // AbortError = el usuario canceló el menú — silencioso, no es error.
      if (err && err.name === 'AbortError') return;
      showMsg('err', 'No se pudo compartir: ' + (err && err.message ? err.message : 'error desconocido'));
    }
  }

  function openUserSelector() {
    renderUserList();
    showMsg(null);
    document.getElementById('newUserName').value = '';
    document.getElementById('userSelectorOverlay').classList.add('active');
  }

  function closeUserSelector() {
    document.getElementById('userSelectorOverlay').classList.remove('active');
  }

  function renderUserList() {
    const ul = document.getElementById('userList');
    if (!ul) return;
    const users = SessionStats.users.list();
    const active = SessionStats.users.active();
    if (!users.length) {
      ul.innerHTML = '<li><div style="color:var(--gris-500);font-style:italic;padding:8px">No hay usuarios guardados. Crea uno abajo o sigue como Invitado.</div></li>';
      return;
    }
    ul.innerHTML = users.map(name => {
      const isActive = name === active;
      const safeName = escapeHtml(name);
      return `
        <li>
          <button type="button" class="user-pick ${isActive ? 'active' : ''}" data-name="${safeName}">
            <span class="material-symbols-sharp">${isActive ? 'check_circle' : 'account_circle'}</span>
            <span>${safeName}</span>
          </button>
          <button type="button" class="btn-remove-user" data-remove="${safeName}" aria-label="Eliminar ${safeName}">
            <span class="material-symbols-sharp">delete</span>
          </button>
        </li>
      `;
    }).join('');

    ul.querySelectorAll('.user-pick').forEach(btn => {
      btn.addEventListener('click', () => {
        SessionStats.users.setActive(btn.dataset.name);
        refreshBadge();
        closeUserSelector();
      });
    });
    ul.querySelectorAll('.btn-remove-user').forEach(btn => {
      btn.addEventListener('click', () => {
        const name = btn.dataset.remove;
        if (confirm(`¿Eliminar a "${name}" y todas sus sesiones? Esta acción no se puede deshacer.`)) {
          SessionStats.users.remove(name);
          renderUserList();
          refreshBadge();
        }
      });
    });
  }

  function addUser() {
    const input = document.getElementById('newUserName');
    const name = input.value.trim();
    if (!name) return;
    SessionStats.users.setActive(name);
    input.value = '';
    refreshBadge();
    closeUserSelector();
  }

  function exportBackup() {
    const result = SessionStats.backup.download();
    if (result.ok) {
      showMsg('ok', `Copia descargada: ${result.filename}`);
    } else {
      showMsg('err', result.error || 'No se pudo exportar');
    }
  }

  function handleImport(e) {
    const file = e.target.files && e.target.files[0];
    if (!file) return;
    const reader = new FileReader();
    reader.onload = (ev) => {
      try {
        const data = JSON.parse(ev.target.result);
        const preview = SessionStats.backup.summary(data);
        if (!preview.ok) {
          showMsg('err', preview.error);
          e.target.value = '';
          return;
        }
        const merge = confirm(
          `Vas a importar:\n` +
          `• ${preview.users.length} usuarios\n` +
          `• ${preview.sessionsTotal} sesiones\n` +
          `• Exportado: ${preview.exportedAt ? preview.exportedAt.slice(0, 10) : 'fecha desconocida'}\n\n` +
          `Aceptar → FUSIONAR con los datos actuales (recomendado, ignora duplicados).\n` +
          `Cancelar → opción "reemplazar todo" (borra los datos actuales).`
        );
        if (merge) {
          const result = SessionStats.backup.restore(data, { mode: 'merge' });
          if (result.ok) {
            showMsg('ok', `Importado: +${result.imported.users} usuarios, +${result.imported.sessions} sesiones (${result.imported.skipped} duplicados omitidos)`);
            renderUserList();
            refreshBadge();
          } else {
            showMsg('err', result.error);
          }
        } else {
          const confirmReplace = confirm(
            `⚠ MODO REEMPLAZAR\n\n` +
            `Esto BORRA todos los datos actuales y los sustituye por los del archivo.\n\n` +
            `¿Seguro?`
          );
          if (!confirmReplace) { e.target.value = ''; return; }
          const result = SessionStats.backup.restore(data, { mode: 'replace' });
          if (result.ok) {
            showMsg('ok', `Datos reemplazados: ${result.imported.users} usuarios, ${result.imported.sessions} sesiones`);
            renderUserList();
            refreshBadge();
          } else {
            showMsg('err', result.error);
          }
        }
      } catch (err) {
        showMsg('err', 'Archivo no válido: ' + err.message);
      }
      e.target.value = '';
    };
    reader.onerror = () => showMsg('err', 'No se pudo leer el archivo');
    reader.readAsText(file);
  }

  function showMsg(type, text) {
    const el = document.getElementById('userSelectorMsg');
    if (!el) return;
    if (!type) { el.style.display = 'none'; return; }
    el.className = 'user-selector-msg ' + type;
    el.textContent = text;
    el.style.display = 'block';
  }

  // ---------- Results modal ----------
  function injectResultsPanel() {
    const div = document.createElement('div');
    div.className = 'results-overlay';
    div.id = 'resultsOverlay';
    div.innerHTML = `
      <div class="results-modal">
        <h2 id="resultsTitle">Sesión completada</h2>
        <div class="results-user-line" id="resultsUserLine"></div>
        <div class="results-feedback" id="resultsFeedback"></div>
        <div class="results-kpis" id="resultsKpis"></div>
        <h3>Cómo has evolucionado en la sesión</h3>
        <div class="evolution-block" id="resultsEvolution"></div>
        <h3>Tu evolución</h3>
        <div class="history-block" id="resultsHistory"></div>
        <div class="results-actions">
          <button type="button" class="btn-secondary" id="btnResultsRepeat">Repetir</button>
          <button type="button" class="btn-primary" id="btnResultsClose">Cerrar</button>
        </div>
      </div>
    `;
    document.body.appendChild(div);

    document.getElementById('btnResultsClose').addEventListener('click', () => {
      hideResults();
      if (config && config.onClose) config.onClose();
    });
    document.getElementById('btnResultsRepeat').addEventListener('click', () => {
      hideResults();
      if (config && config.onRepeat) config.onRepeat();
    });
  }

  function showResults(summary, comparison, opts) {
    if (!summary) return;
    const overlay = document.getElementById('resultsOverlay');
    if (!overlay) return;
    opts = opts || {};

    document.getElementById('resultsTitle').textContent = 'Sesión completada';
    const u = SessionStats.users.active();
    document.getElementById('resultsUserLine').textContent = (u ? `${u} · ` : '') + (config.toolName || '');

    // Sesiones "pasivas" = sin RT ni accuracy (tools de estimulación pura
    // o modo voz de go-nogo). Panel adaptado: Rondas / Duración / Modo.
    const isPassive = summary.rtMedian == null && summary.accuracy == null;
    const isVoice = summary.config && summary.config.mode === 'voice';

    const defaultFeedback = isPassive
      ? `Sesión completada: ${summary.total} rondas en ${formatDuration(summary.durationSec)}`
      : SessionStats.feedbackPhrase(summary);
    document.getElementById('resultsFeedback').textContent = opts.customFeedback || defaultFeedback;

    const kpisEl = document.getElementById('resultsKpis');
    kpisEl.innerHTML = isPassive ? buildKpisPassive(summary, isVoice) : buildKpis(summary);
    kpisEl.classList.toggle('results-kpis--3col', isPassive);

    // Métricas derivadas opcionales (IES + d'). Solo se muestran cuando aplican.
    const derivedEl = ensureDerivedBlock();
    if (derivedEl) {
      const parts = [];
      if (summary.ies != null) parts.push(`<span><strong>${summary.ies}</strong> ms·IES</span>`);
      if (summary.dPrime != null) parts.push(`<span><strong>${summary.dPrime}</strong> d′</span>`);
      if (parts.length) {
        derivedEl.innerHTML = parts.join(' · ');
        derivedEl.style.display = '';
      } else {
        derivedEl.style.display = 'none';
      }
    }

    // Sin RT no tiene sentido la gráfica por tercios
    const evoTitle = document.getElementById('resultsEvolution').previousElementSibling;
    const evoBlock = document.getElementById('resultsEvolution');
    if (isPassive) {
      if (evoTitle && evoTitle.tagName === 'H3') evoTitle.style.display = 'none';
      evoBlock.style.display = 'none';
    } else {
      if (evoTitle && evoTitle.tagName === 'H3') evoTitle.style.display = '';
      evoBlock.style.display = '';
      evoBlock.innerHTML = buildEvolution(summary);
    }

    document.getElementById('resultsHistory').innerHTML = isPassive
      ? buildHistoryPassive(summary, isVoice)
      : buildHistory(summary, comparison);

    overlay.classList.add('active');
  }

  function formatDuration(sec) {
    if (!sec || sec < 0) sec = 0;
    const m = Math.floor(sec / 60);
    const s = sec % 60;
    return m + ':' + String(s).padStart(2, '0');
  }

  function buildKpisPassive(s, isVoice) {
    const modeLabel = isVoice ? 'Voz' : 'Estímulo';
    return `
      <div class="results-kpi"><strong>${s.total}</strong><span>Rondas</span></div>
      <div class="results-kpi"><strong>${formatDuration(s.durationSec)}</strong><span>Duración</span></div>
      <div class="results-kpi"><strong style="font-size:1.2rem">${modeLabel}</strong><span>Modo</span></div>
    `;
  }

  function ensureDerivedBlock() {
    let el = document.getElementById('resultsDerived');
    if (el) return el;
    const kpisEl = document.getElementById('resultsKpis');
    if (!kpisEl) return null;
    el = document.createElement('div');
    el.id = 'resultsDerived';
    el.className = 'results-derived';
    kpisEl.parentNode.insertBefore(el, kpisEl.nextSibling);
    return el;
  }

  function buildHistoryPassive(s, isVoice) {
    const user = SessionStats.users.active();
    if (!user) return '<p class="history-empty">Inicia sesión con tu nombre para guardar tu progreso.</p>';
    const all = SessionStats.history.getRecent(s.toolId, 50);
    // Si es modo voz, filtramos por modo voz; si es estímulo puro, filtramos por passive (sin rt/acc)
    const peers = all.filter(x => {
      const passive = x.rtMedian == null && x.accuracy == null;
      if (!passive) return false;
      if (isVoice) return x.config && x.config.mode === 'voice';
      return !(x.config && x.config.mode === 'voice');
    });
    if (peers.length <= 1) {
      return '<p class="history-empty">Esta es tu primera sesión de este tipo. ¡Sigue así!</p>';
    }
    const maxTrials = Math.max.apply(null, peers.map(x => x.total));
    const totalSec = peers.reduce((a, x) => a + (x.durationSec || 0), 0);
    const totalMin = Math.round(totalSec / 60);
    return `
      <p>Llevas <strong>${peers.length}</strong> sesiones similares</p>
      <p>Tu mejor sesión: <strong>${maxTrials}</strong> rondas</p>
      <p>Tiempo acumulado: <strong>${totalMin}</strong> minutos</p>
    `;
  }

  function hideResults() {
    const overlay = document.getElementById('resultsOverlay');
    if (overlay) overlay.classList.remove('active');
  }

  function buildKpis(s) {
    const accPct = s.accuracy != null ? Math.round(s.accuracy * 100) + '%' : '--';
    const rt = s.rtMedian != null ? s.rtMedian + ' ms' : '--';
    const errs = (s.errors.commission || 0) + (s.errors.omission || 0) + (s.errors.other || 0);
    return `
      <div class="results-kpi"><strong>${s.total}</strong><span>Rondas</span></div>
      <div class="results-kpi"><strong>${accPct}</strong><span>Aciertos</span></div>
      <div class="results-kpi"><strong>${rt}</strong><span>T. respuesta</span></div>
      <div class="results-kpi"><strong>${errs}</strong><span>Errores</span></div>
    `;
  }

  function buildEvolution(s) {
    if (!s.segments || s.segments.length < 3) {
      return '<p class="history-empty">No hay datos suficientes</p>';
    }
    const labels = ['Inicio', 'Medio', 'Final'];
    const useRT = config.primaryMetric === 'rtMedian';
    const values = s.segments.map(seg =>
      useRT ? seg.rtMedian : (seg.accuracy != null ? Math.round(seg.accuracy * 100) : null)
    );
    const unit = useRT ? ' ms' : '%';
    const valid = values.filter(v => v != null);
    if (!valid.length) return '<p class="history-empty">No hay datos suficientes</p>';
    const maxVal = useRT ? Math.max.apply(null, valid) * 1.15 : 100;

    return s.segments.map((seg, i) => {
      const v = values[i];
      const pct = v != null ? Math.max(4, Math.min(100, (v / maxVal) * 100)) : 0;
      const display = v != null ? (v + unit) : '--';
      return `
        <div class="evolution-row">
          <span class="lbl">${labels[i]}</span>
          <div class="bar"><div class="bar-fill ${i === 2 ? 'final' : ''}" style="width:${pct}%"></div></div>
          <span class="val">${display}</span>
        </div>
      `;
    }).join('');
  }

  function buildHistory(s, c) {
    if (!c || (!c.personalBest && c.personalAvg == null)) {
      return '<p class="history-empty">Esta es tu primera sesión guardada. ¡Sigue así!</p>';
    }
    const useRT = config.primaryMetric === 'rtMedian';
    const cur = useRT ? s.rtMedian : (s.accuracy != null ? Math.round(s.accuracy * 100) : null);
    const best = useRT && c.personalBest ? c.personalBest.rtMedian : null;
    const avg = useRT ? c.personalAvg : null;
    const unit = useRT ? ' ms' : '%';
    const lines = [];
    if (best != null) {
      const bestDate = new Date(c.personalBest.date);
      const bestDateStr = bestDate.toLocaleDateString('es', { day: 'numeric', month: 'short' });
      lines.push(`Tu mejor sesión: <strong>${best}${unit}</strong> (${bestDateStr})`);
    }
    if (avg != null && cur != null) {
      const better = c.improvedVsAvg;
      lines.push(`Promedio: <strong>${avg}${unit}</strong> · Hoy: <strong>${cur}${unit}</strong>${better ? ' ✓ mejor que tu media' : ''}`);
    }
    if (c.improvedVsBest) {
      lines.push(`<strong style="color:var(--tulip-tree-400)">¡Nuevo récord personal!</strong>`);
    }
    return lines.map(l => `<p>${l}</p>`).join('') || '<p class="history-empty">Primera sesión guardada</p>';
  }

  // ---------- Utils ----------
  function escapeHtml(s) {
    return String(s).replace(/[&<>"']/g, c => ({
      '&': '&amp;', '<': '&lt;', '>': '&gt;', '"': '&quot;', "'": '&#39;'
    })[c]);
  }

  // ---------- API pública ----------
  global.SessionStatsUI = {
    init,
    showResults,
    openUserSelector,
    refreshBadge
  };

})(window);
