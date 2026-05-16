class SearchTool {
  constructor() {
    this.searchPairs = [
      { target: 'O', distractor: 'Q' },
      { target: 'Q', distractor: 'O' },
      { target: 'b', distractor: 'd' },
      { target: 'E', distractor: 'F' },
      { target: 'I', distractor: 'l' },
      { target: 'M', distractor: 'N' }
    ];
    this.scheduler = null;
    this.isPlaying = false;
    this.sessionActive = false;
    this.currentSpeed = 4500;
    this.jitter = 0;
    this.slopeMode = false;
    this.hits = 0;
    this.misses = 0;
    this.totalTrials = 0;
    this.responded = false;
    this.trialStart = 0;
    this.reactionTimes = [];
    this.targetIndex = -1;
    this.audioCtx = null;

    // Slope mode state
    this.setSizes = [12, 24, 48];
    this.setSizeCycle = [];
    this.cycleIndex = 0;
    this.currentSetSize = 0;
    this.rtBySetSize = { 12: [], 24: [], 48: [] };
  }

  getAudioCtx() {
    if (!this.audioCtx) this.audioCtx = new (window.AudioContext || window.webkitAudioContext)();
    if (this.audioCtx.state === 'suspended') this.audioCtx.resume();
    return this.audioCtx;
  }

  beep(freq, dur) {
    const ctx = this.getAudioCtx();
    const osc = ctx.createOscillator();
    const gain = ctx.createGain();
    osc.connect(gain);
    gain.connect(ctx.destination);
    osc.frequency.value = freq;
    gain.gain.value = 0.25;
    osc.start();
    gain.gain.exponentialRampToValueAtTime(0.001, ctx.currentTime + dur / 1000);
    osc.stop(ctx.currentTime + dur / 1000);
  }

  togglePlay() {
    if (!this.sessionActive) {
      this.sessionActive = true;
      this.setFinalizeVisible(true);
      this.resetStats();
      if (window.SessionStats) {
        SessionStats.session.start('search', {
          cadence: this.currentSpeed,
          jitter: this.jitter,
          slopeMode: this.slopeMode
        });
      }
      this.isPlaying = true;
      this.setPlayButton('pause', 'PAUSA');
      this.startEngine();
    } else if (this.isPlaying) {
      this.isPlaying = false;
      this.setPlayButton('play_arrow', 'REANUDAR');
      this.stopEngine();
    } else {
      this.isPlaying = true;
      this.setPlayButton('pause', 'PAUSA');
      this.startEngine();
    }
  }

  finalize() {
    if (!this.sessionActive) return;
    this.isPlaying = false;
    this.sessionActive = false;
    this.stopEngine();

    let result = null;
    if (window.SessionStats) result = SessionStats.session.end();

    // En modo pendiente, calcular y mostrar slope como custom feedback
    let customFeedback = null;
    if (this.slopeMode && result && result.summary) {
      const slope = this.computeSlope();
      if (slope !== null) {
        result.summary.config = result.summary.config || {};
        result.summary.config.slope = slope;
        customFeedback = `Eficiencia de búsqueda: ${slope} ms por estímulo extra`;
      } else {
        customFeedback = 'Pocos datos para calcular la pendiente — completa más rondas';
      }
    }

    this.setPlayButton('play_arrow', 'INICIAR');
    this.setFinalizeVisible(false);
    this.resetStats();
    document.getElementById('searchGrid').innerHTML = '';
    document.getElementById('searchTargetText').textContent = 'Busca la letra distinta';

    if (result && result.summary && result.summary.total >= 5 && window.SessionStatsUI) {
      SessionStatsUI.showResults(result.summary, result.comparison, customFeedback ? { customFeedback } : {});
    }
  }

  setPlayButton(icon, text) {
    document.getElementById('playIcon').textContent = icon;
    document.getElementById('playText').textContent = text;
  }

  setFinalizeVisible(visible) {
    const btn = document.getElementById('btnFinalize');
    if (btn) btn.classList.toggle('visible', visible);
  }

  toggleJitter() {
    this.jitter = this.jitter > 0 ? 0 : 0.3;
    if (this.scheduler) this.scheduler.setJitter(this.jitter);
    const btn = document.getElementById('btnJitter');
    if (btn) btn.classList.toggle('active', this.jitter > 0);
  }

  toggleSlope() {
    this.slopeMode = !this.slopeMode;
    const btn = document.getElementById('btnSlope');
    if (btn) btn.classList.toggle('active', this.slopeMode);
    // Si hay sesión en curso, abortar (la métrica de pendiente requiere consistencia)
    if (this.isPlaying || this.sessionActive) {
      this.stopEngine();
      if (window.SessionStats) SessionStats.session.abort();
      this.isPlaying = false;
      this.sessionActive = false;
      this.setFinalizeVisible(false);
      this.setPlayButton('play_arrow', 'INICIAR');
      this.resetStats();
    }
  }

  shuffle(arr) {
    const a = arr.slice();
    for (let i = a.length - 1; i > 0; i--) {
      const j = Math.floor(Math.random() * (i + 1));
      [a[i], a[j]] = [a[j], a[i]];
    }
    return a;
  }

  pickSetSize() {
    if (!this.slopeMode) {
      return window.innerWidth < 768 ? 24 : 36;
    }
    if (this.cycleIndex >= this.setSizeCycle.length) {
      this.setSizeCycle = this.shuffle(this.setSizes);
      this.cycleIndex = 0;
    }
    const s = this.setSizeCycle[this.cycleIndex];
    this.cycleIndex++;
    return s;
  }

  startEngine() {
    ScreenWakeLock.request();
    this.showTrial();
    if (!this.scheduler) {
      this.scheduler = new CadenceScheduler(() => this.evaluateAndNext(), this.currentSpeed, this.jitter);
    } else {
      this.scheduler.changeInterval(this.currentSpeed);
      this.scheduler.setJitter(this.jitter);
    }
    this.scheduler.start();
  }

  stopEngine() {
    ScreenWakeLock.release();
    if (this.scheduler) this.scheduler.stop();
  }

  changeSpeed(ms) {
    this.currentSpeed = parseInt(ms, 10);
    if (this.scheduler) this.scheduler.changeInterval(this.currentSpeed);
  }

  resetStats() {
    this.hits = 0;
    this.misses = 0;
    this.totalTrials = 0;
    this.reactionTimes = [];
    this.cycleIndex = 0;
    this.setSizeCycle = [];
    this.rtBySetSize = { 12: [], 24: [], 48: [] };
    this.updateStats();
  }

  showTrial() {
    const pair = this.searchPairs[Math.floor(Math.random() * this.searchPairs.length)];
    document.getElementById('searchTargetText').innerHTML =
      'Busca la <span style="color:var(--turquesa-400); font-size:1.3em; font-weight:bold;">' + pair.target + '</span> entre las ' + pair.distractor +
      (this.slopeMode ? ' <span style="color:var(--gris-500);font-size:0.7em">(' + this.currentSetSize + ' items)</span>' : '');

    const grid = document.getElementById('searchGrid');
    grid.innerHTML = '';
    const totalItems = this.pickSetSize();
    this.currentSetSize = totalItems;
    this.targetIndex = Math.floor(Math.random() * totalItems);
    this.responded = false;
    this.trialStart = performance.now();
    this.totalTrials++;

    // Re-actualizar instrucción con set-size actual (en modo slope)
    if (this.slopeMode) {
      document.getElementById('searchTargetText').innerHTML =
        'Busca la <span style="color:var(--turquesa-400); font-size:1.3em; font-weight:bold;">' + pair.target + '</span> entre las ' + pair.distractor +
        ' <span style="color:var(--gris-500);font-size:0.7em">(' + totalItems + ' items)</span>';
    }

    for (let i = 0; i < totalItems; i++) {
      const div = document.createElement('div');
      div.className = 'search-item';
      div.dataset.index = i;
      if (i === this.targetIndex) {
        div.textContent = pair.target;
        div.classList.add('target');
      } else {
        div.textContent = pair.distractor;
      }
      div.addEventListener('click', () => this.handleItemTap(i));
      grid.appendChild(div);
    }

    this.updateStats();
  }

  evaluateAndNext() {
    if (!this.isPlaying) return;
    if (!this.responded) {
      this.misses++;
      this.recordTrial({ stimulus: 'target', setSize: this.currentSetSize, correct: false, errorType: 'omission' });
    }
    this.showTrial();
    this.updateStats();
  }

  handleItemTap(index) {
    if (!this.isPlaying || this.responded) return;
    this.responded = true;

    const rt = Math.round(performance.now() - this.trialStart);
    const item = document.querySelector(`.search-item[data-index="${index}"]`);

    if (index === this.targetIndex) {
      this.hits++;
      this.reactionTimes.push(rt);
      if (this.slopeMode && this.rtBySetSize[this.currentSetSize]) {
        this.rtBySetSize[this.currentSetSize].push(rt);
      }
      this.beep(880, 80);
      if (item) item.style.background = 'rgba(0, 190, 200, 0.4)';
      this.recordTrial({ stimulus: 'target', setSize: this.currentSetSize, rt, correct: true });
    } else {
      this.misses++;
      this.beep(220, 200);
      if (item) item.style.background = 'rgba(225, 29, 72, 0.4)';
      const target = document.querySelector(`.search-item[data-index="${this.targetIndex}"]`);
      if (target) target.style.background = 'rgba(0, 190, 200, 0.4)';
      this.recordTrial({ stimulus: 'distractor', setSize: this.currentSetSize, correct: false, errorType: 'commission' });
    }
    this.updateStats();
  }

  recordTrial(trial) {
    if (window.SessionStats && this.sessionActive) {
      SessionStats.session.recordTrial(trial);
    }
  }

  // Regresión lineal simple sobre los set-sizes con datos suficientes.
  // Devuelve pendiente en ms/item o null si no hay datos.
  computeSlope() {
    const xs = [];
    const ys = [];
    this.setSizes.forEach(s => {
      const arr = this.rtBySetSize[s];
      if (arr && arr.length >= 2) {
        xs.push(s);
        ys.push(arr.reduce((a, b) => a + b, 0) / arr.length);
      }
    });
    if (xs.length < 2) return null;
    const n = xs.length;
    const sumX = xs.reduce((a, b) => a + b, 0);
    const sumY = ys.reduce((a, b) => a + b, 0);
    const sumXY = xs.reduce((s, x, i) => s + x * ys[i], 0);
    const sumXX = xs.reduce((s, x) => s + x * x, 0);
    const denom = n * sumXX - sumX * sumX;
    if (denom === 0) return null;
    return Math.round((n * sumXY - sumX * sumY) / denom);
  }

  updateStats() {
    document.getElementById('statHits').textContent = this.hits;
    document.getElementById('statMisses').textContent = this.misses;
    document.getElementById('statTotal').textContent = this.totalTrials;
    const avgRT = this.reactionTimes.length > 0
      ? Math.round(this.reactionTimes.reduce((a, b) => a + b, 0) / this.reactionTimes.length)
      : '--';
    document.getElementById('statRT').textContent = avgRT + (avgRT !== '--' ? ' ms' : '');
  }
}

const tool = new SearchTool();

if (window.SessionStatsUI) {
  SessionStatsUI.init({
    toolId: 'search',
    toolName: 'Búsqueda Visual',
    primaryMetric: 'rtMedian',
    onRepeat: () => tool.togglePlay(),
    onClose: () => {
      document.getElementById('searchGrid').innerHTML = '';
      document.getElementById('searchTargetText').textContent = 'Busca la letra distinta';
    }
  });
}
