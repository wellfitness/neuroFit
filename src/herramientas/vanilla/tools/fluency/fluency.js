class FluencyTool {
  constructor() {
    this.fluencyCategories = [
      "Animales", "Comida", "Colores", "Ciudades",
      "Nombres propios", "Transporte", "Herramientas",
      "Deportes", "Profesiones", "Partes del cuerpo",
      "Empieza por A", "Empieza por C", "Empieza por M",
      "Empieza por S", "Empieza por P"
    ];
    this.scheduler = null;
    this.isPlaying = false;
    this.sessionActive = false;
    this.currentSpeed = 6000;
    this.totalTrials = 0;     // nº de categorías mostradas
    this.totalWords = 0;       // nº total de palabras tapeadas
    this.currentCategoryWords = 0;
    this.lastCategory = null;
    this.lastTapTime = 0;
    this.categoryStartTime = 0;
    // Tracking de interval times para clusters/switches
    this.intraCategoryIntervals = []; // dentro de misma categoría
    this.switchIntervals = [];        // primer tap tras cambio de categoría
    this.audioCtx = null;
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
        SessionStats.session.start('fluency', { cadence: this.currentSpeed });
      }
      this.isPlaying = true;
      document.getElementById('playIcon').textContent = 'pause';
      document.getElementById('playText').textContent = 'PAUSA';
      this.startEngine();
      ScreenWakeLock.request();
    } else if (this.isPlaying) {
      this.isPlaying = false;
      document.getElementById('playIcon').textContent = 'play_arrow';
      document.getElementById('playText').textContent = 'REANUDAR';
      this.stopEngine();
      ScreenWakeLock.release();
    } else {
      this.isPlaying = true;
      document.getElementById('playIcon').textContent = 'pause';
      document.getElementById('playText').textContent = 'PAUSA';
      this.startEngine();
      ScreenWakeLock.request();
    }
  }

  finalize() {
    if (!this.sessionActive) return;
    this.isPlaying = false;
    this.sessionActive = false;
    this.stopEngine();
    ScreenWakeLock.release();
    this.setFinalizeVisible(false);

    let result = null;
    let customFeedback = null;
    if (window.SessionStats) {
      result = SessionStats.session.end();
      if (result && result.summary) {
        const intra = this.intraCategoryIntervals;
        const sw = this.switchIntervals;
        const avgIntra = intra.length > 0 ? Math.round(intra.reduce((a, b) => a + b, 0) / intra.length) : null;
        const avgSwitch = sw.length > 0 ? Math.round(sw.reduce((a, b) => a + b, 0) / sw.length) : null;
        const wordsPerCat = this.totalTrials > 0 ? (this.totalWords / this.totalTrials).toFixed(1) : 0;
        if (avgIntra != null && avgSwitch != null) {
          const switchCost = avgSwitch - avgIntra;
          customFeedback = `${this.totalWords} palabras (${wordsPerCat}/categoría) · coste de cambio: +${switchCost} ms`;
          result.summary.config = result.summary.config || {};
          result.summary.config.totalWords = this.totalWords;
          result.summary.config.wordsPerCategory = wordsPerCat;
          result.summary.config.switchCost = switchCost;
          result.summary.config.avgIntraInterval = avgIntra;
          result.summary.config.avgSwitchInterval = avgSwitch;
        } else if (this.totalWords > 0) {
          customFeedback = `${this.totalWords} palabras en ${this.totalTrials} categorías`;
        }
      }
    }

    document.getElementById('playIcon').textContent = 'play_arrow';
    document.getElementById('playText').textContent = 'INICIAR';

    if (result && result.summary && result.summary.total >= 3 && window.SessionStatsUI) {
      SessionStatsUI.showResults(result.summary, result.comparison, customFeedback ? { customFeedback } : {});
    }
  }

  setFinalizeVisible(visible) {
    const btn = document.getElementById('btnFinalize');
    if (btn) btn.classList.toggle('visible', visible);
  }

  startEngine() {
    this.runFluency();
    if (!this.scheduler) {
      this.scheduler = new CadenceScheduler(() => this.runFluency(), this.currentSpeed);
    } else {
      this.scheduler.changeInterval(this.currentSpeed);
    }
    this.scheduler.start();
  }

  stopEngine() {
    if (this.scheduler) this.scheduler.stop();
  }

  changeSpeed(ms) {
    this.currentSpeed = parseInt(ms, 10);
    if (this.scheduler) this.scheduler.changeInterval(this.currentSpeed);
  }

  resetStats() {
    this.totalTrials = 0;
    this.totalWords = 0;
    this.currentCategoryWords = 0;
    this.lastTapTime = 0;
    this.categoryStartTime = 0;
    this.intraCategoryIntervals = [];
    this.switchIntervals = [];
    this.lastCategory = null;
    this.updateStats();
  }

  runFluency() {
    let cat;
    do {
      cat = this.fluencyCategories[Math.floor(Math.random() * this.fluencyCategories.length)];
    } while (cat === this.lastCategory && this.fluencyCategories.length > 1);
    this.lastCategory = cat;
    this.categoryStartTime = performance.now();
    this.currentCategoryWords = 0;
    document.getElementById('fluencyText').textContent = cat;
    document.getElementById('fluencyCounter').textContent = '0 palabras';

    this.beep(600, 60);
    if (navigator.vibrate) navigator.vibrate(30);

    this.totalTrials++;
    // El "lastTapTime" se resetea para que el primer tap se contabilice como switch interval.
    this.lastTapTime = 0;
    this.updateStats();
  }

  handleTap() {
    if (!this.isPlaying) return;
    const now = performance.now();
    this.currentCategoryWords++;
    this.totalWords++;

    // Si es el primer tap de esta categoría → es un "switch interval" (desde que apareció la categoría)
    if (this.lastTapTime === 0) {
      const switchInterval = Math.round(now - this.categoryStartTime);
      this.switchIntervals.push(switchInterval);
      if (this.sessionActive && window.SessionStats) {
        SessionStats.session.recordTrial({
          stimulus: 'first_word',
          category: this.lastCategory,
          rt: switchInterval,
          correct: true
        });
      }
    } else {
      const intra = Math.round(now - this.lastTapTime);
      this.intraCategoryIntervals.push(intra);
      if (this.sessionActive && window.SessionStats) {
        SessionStats.session.recordTrial({
          stimulus: 'word',
          category: this.lastCategory,
          rt: intra,
          correct: true
        });
      }
    }
    this.lastTapTime = now;

    // Feedback visual
    const area = document.getElementById('fluencyTapArea');
    area.classList.add('tap-flash');
    setTimeout(() => area.classList.remove('tap-flash'), 80);

    document.getElementById('fluencyCounter').textContent = this.currentCategoryWords + (this.currentCategoryWords === 1 ? ' palabra' : ' palabras');
    this.updateStats();
  }

  updateStats() {
    document.getElementById('statRounds').textContent = this.totalTrials;
    document.getElementById('statWords').textContent = this.totalWords;
    document.getElementById('statCurrent').textContent = this.currentCategoryWords;
  }
}

const tool = new FluencyTool();

if (window.SessionStatsUI) {
  SessionStatsUI.init({
    toolId: 'fluency',
    toolName: 'Fluencia Verbal',
    primaryMetric: 'rtMedian',
    onRepeat: () => tool.togglePlay(),
    onClose: () => {}
  });
}
