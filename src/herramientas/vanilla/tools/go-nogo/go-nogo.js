class GoNoGoTool {
  constructor() {
    this.levels = {
      basic: {
        goColor: { bg: '#10b981', label: 'TOCA', icon: 'touch_app', areaClass: 'stimulus-area--go' },
        nogoColors: [{ bg: '#e11d48', label: 'NO TOQUES', icon: 'block', areaClass: 'stimulus-area--nogo' }],
        instructions: ['Verde = toca la pantalla', 'Rojo = no toques'],
        goRatio: 0.6
      },
      distractors: {
        goColor: { bg: '#10b981', label: 'TOCA', icon: 'touch_app', areaClass: 'stimulus-area--go' },
        nogoColors: [
          { bg: '#e11d48', label: 'NO TOQUES', icon: 'block', areaClass: 'stimulus-area--nogo' },
          { bg: '#eab308', label: 'NO TOQUES', icon: 'block', areaClass: 'stimulus-area--nogo-yellow' },
          { bg: '#3b82f6', label: 'NO TOQUES', icon: 'block', areaClass: 'stimulus-area--nogo-blue' }
        ],
        instructions: ['Solo verde = toca', 'Cualquier otro color = no toques'],
        goRatio: 0.6
      },
      inverted: {
        goColor: { bg: '#e11d48', label: 'TOCA', icon: 'touch_app', areaClass: 'stimulus-area--nogo' },
        nogoColors: [
          { bg: '#10b981', label: 'NO TOQUES', icon: 'block', areaClass: 'stimulus-area--go' },
          { bg: '#eab308', label: 'NO TOQUES', icon: 'block', areaClass: 'stimulus-area--nogo-yellow' },
          { bg: '#3b82f6', label: 'NO TOQUES', icon: 'block', areaClass: 'stimulus-area--nogo-blue' }
        ],
        instructions: ['Solo rojo = toca', 'Cualquier otro color = no toques'],
        goRatio: 0.6
      },
      sart: {
        goColor: { bg: '#10b981', label: 'TOCA', icon: 'touch_app', areaClass: 'stimulus-area--go' },
        nogoColors: [{ bg: '#e11d48', label: 'NO TOQUES', icon: 'block', areaClass: 'stimulus-area--nogo' }],
        instructions: ['SART · 80% verde (toca)', '20% rojo (frena el impulso)'],
        goRatio: 0.8,
        sart: true
      }
    };
    this.currentLevel = 'basic';
    this.currentMode = 'touch';
    this.scheduler = null;
    this.isPlaying = false;
    this.sessionActive = false;
    this.currentSpeed = 2000;
    this.jitter = 0;
    this.hits = 0;
    this.misses = 0;
    this.falseAlarms = 0;
    this.rounds = 0;
    this.reactionTimes = [];
    // Post-error slowing tracking
    this.lastTrialWasError = false;
    this.postErrorRTs = [];
    this.normalRTs = [];
    this.currentTrial = null;
    this.trialStart = 0;
    this.responded = false;
    this.audioCtx = null;
    this.feedbackTimeout = null;
  }

  getAudioCtx() {
    if (!this.audioCtx) this.audioCtx = new (window.AudioContext || window.webkitAudioContext)();
    if (this.audioCtx.state === 'suspended') this.audioCtx.resume();
    return this.audioCtx;
  }

  beep(freq, duration) {
    const ctx = this.getAudioCtx();
    const osc = ctx.createOscillator();
    const gain = ctx.createGain();
    osc.connect(gain);
    gain.connect(ctx.destination);
    osc.frequency.value = freq;
    gain.gain.value = 0.25;
    osc.start();
    gain.gain.exponentialRampToValueAtTime(0.001, ctx.currentTime + duration / 1000);
    osc.stop(ctx.currentTime + duration / 1000);
  }

  tick() {
    const ctx = this.getAudioCtx();
    const osc = ctx.createOscillator();
    const gain = ctx.createGain();
    osc.connect(gain);
    gain.connect(ctx.destination);
    osc.type = 'triangle';
    osc.frequency.value = 600;
    gain.gain.value = 0.15;
    osc.start();
    gain.gain.exponentialRampToValueAtTime(0.001, ctx.currentTime + 0.03);
    osc.stop(ctx.currentTime + 0.03);
  }

  speak(text) {
    if (window.KinesisTTS && KinesisTTS.isAvailable()) {
      KinesisTTS.cancel();
      KinesisTTS.speak(text, 1.3);
    }
  }

  togglePlay() {
    if (!this.sessionActive) {
      // Primera puesta en marcha: nueva sesión
      this.resetStats();
      this.sessionActive = true;
      this.setFinalizeVisible(true);
      if (this.currentMode === 'voice' && window.KinesisTTS) KinesisTTS.warmup();
      if (window.SessionStats) {
        SessionStats.session.start('go-nogo', {
          level: this.currentLevel,
          cadence: this.currentSpeed,
          mode: this.currentMode,
          jitter: this.jitter
        });
      }
      this.isPlaying = true;
      this.setPlayButton('pause', 'PAUSA');
      this.startEngine();
    } else if (this.isPlaying) {
      // Pausar
      this.isPlaying = false;
      this.setPlayButton('play_arrow', 'REANUDAR');
      this.stopEngine();
    } else {
      // Reanudar
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
    let customFeedback = null;
    if (window.SessionStats) {
      result = SessionStats.session.end();
      // En SART, calcular y mostrar post-error slowing
      if (this.currentLevel === 'sart' && result && result.summary) {
        const avgPost = this.postErrorRTs.length
          ? Math.round(this.postErrorRTs.reduce((a, b) => a + b, 0) / this.postErrorRTs.length) : null;
        const avgNormal = this.normalRTs.length
          ? Math.round(this.normalRTs.reduce((a, b) => a + b, 0) / this.normalRTs.length) : null;
        if (avgPost != null && avgNormal != null) {
          const slowing = avgPost - avgNormal;
          result.summary.config = result.summary.config || {};
          result.summary.config.postErrorSlowing = slowing;
          if (slowing > 20) {
            customFeedback = `Post-error slowing: +${slowing} ms · te has vuelto más prudente tras los errores`;
          } else if (slowing < -20) {
            customFeedback = `Post-error slowing: ${slowing} ms · respondes incluso más rápido tras los errores`;
          } else {
            customFeedback = `Post-error slowing: ${slowing > 0 ? '+' : ''}${slowing} ms · ritmo estable tras los errores`;
          }
        }
      }
    }

    this.setPlayButton('play_arrow', 'INICIAR');
    this.setFinalizeVisible(false);
    this.resetVisual();
    this.resetStats();

    if (result && result.summary && result.summary.total >= 5 && window.SessionStatsUI) {
      SessionStatsUI.showResults(result.summary, result.comparison, customFeedback ? { customFeedback } : {});
    }
  }

  setPlayButton(icon, text) {
    const iconEl = document.getElementById('playIcon');
    const textEl = document.getElementById('playText');
    if (iconEl) iconEl.textContent = icon;
    if (textEl) textEl.textContent = text;
  }

  setFinalizeVisible(visible) {
    const btn = document.getElementById('btnFinalize');
    if (!btn) return;
    if (visible) btn.classList.add('visible');
    else btn.classList.remove('visible');
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

  toggleJitter() {
    this.jitter = this.jitter > 0 ? 0 : 0.3;
    if (this.scheduler) this.scheduler.setJitter(this.jitter);
    const btn = document.getElementById('btnJitter');
    if (btn) btn.classList.toggle('active', this.jitter > 0);
  }

  stopEngine() {
    ScreenWakeLock.release();
    if (this.scheduler) this.scheduler.stop();
  }

  changeSpeed(ms) {
    this.currentSpeed = parseInt(ms, 10);
    if (this.scheduler) this.scheduler.changeInterval(this.currentSpeed);
  }

  changeLevel(level) {
    this.currentLevel = level;
    const config = this.levels[level];
    this.applyInstructionText(config);
    if (this.isPlaying || this.sessionActive) {
      this.stopEngine();
      if (window.SessionStats) SessionStats.session.abort();
      this.isPlaying = false;
      this.sessionActive = false;
      this.setFinalizeVisible(false);
      this.resetStats();
      this.setPlayButton('play_arrow', 'INICIAR');
      this.resetVisual();
    }
  }

  changeMode(mode) {
    this.currentMode = mode;
    const config = this.levels[this.currentLevel];
    this.applyInstructionText(config);
    this.applyModeUI();
    document.body.classList.toggle('mode-voice', mode === 'voice');
    if (this.isPlaying || this.sessionActive) {
      this.stopEngine();
      if (window.SessionStats) SessionStats.session.abort();
      this.isPlaying = false;
      this.sessionActive = false;
      this.setFinalizeVisible(false);
      this.resetStats();
      this.setPlayButton('play_arrow', 'INICIAR');
      this.resetVisual();
    }
  }

  applyInstructionText(config) {
    const el = document.getElementById('goInstruction');
    if (!el) return;
    if (this.currentMode === 'voice') {
      el.innerHTML = 'Modo voz — escucha el color y haz la acci&oacute;n que haya pactado el entrenador.<br>El cliente <strong>no toca la pantalla</strong>.';
    } else {
      el.innerHTML = config.instructions.join('<br>');
    }
  }

  resetVisual() {
    const circle = document.getElementById('goCircle');
    const container = document.getElementById('stimulusContainer');
    circle.style.background = 'var(--gris-700)';
    circle.querySelector('.material-symbols-sharp').textContent = 'touch_app';
    document.getElementById('goLabel').textContent = 'Preparado';
    document.getElementById('goLabel').style.color = 'var(--gris-500)';
    container.className = 'stimulus-area';
    this.clearFeedback();
  }

  resetStats() {
    this.hits = 0;
    this.misses = 0;
    this.falseAlarms = 0;
    this.rounds = 0;
    this.reactionTimes = [];
    this.lastTrialWasError = false;
    this.postErrorRTs = [];
    this.normalRTs = [];
    this.updateStats();
  }

  showTrial() {
    const config = this.levels[this.currentLevel];
    const goRatio = config.goRatio != null ? config.goRatio : 0.6;
    const isGo = Math.random() < goRatio;
    const container = document.getElementById('stimulusContainer');
    const circle = document.getElementById('goCircle');
    const label = document.getElementById('goLabel');

    this.responded = false;
    this.trialStart = performance.now();
    this.clearFeedback();

    container.className = 'stimulus-area';

    circle.classList.remove('flash');
    void circle.offsetWidth;
    circle.classList.add('flash');

    this.tick();

    let color;
    if (isGo) {
      this.currentTrial = 'go';
      color = config.goColor;
    } else {
      this.currentTrial = 'nogo';
      color = config.nogoColors[Math.floor(Math.random() * config.nogoColors.length)];
    }

    circle.style.background = color.bg;
    circle.querySelector('.material-symbols-sharp').textContent = color.icon;
    label.textContent = color.label;
    label.style.color = color.bg;
    container.classList.add(color.areaClass);

    container.classList.add('stimulus-area--flash');
    setTimeout(() => container.classList.remove('stimulus-area--flash'), 200);

    // Modo voz: anunciar por voz y registrar el trial al instante (sin tap esperado)
    if (this.currentMode === 'voice') {
      this.rounds++;
      const word = (this.currentTrial === 'go') ? this.voiceWordGo() : this.voiceWordNoGo();
      this.speak(word);
      this.recordTrial({ stimulus: this.currentTrial });
    }
  }

  voiceWordGo() {
    // El nivel "invertido" usa rojo como go; aún así decimos el color real
    return this.currentLevel === 'inverted' ? 'rojo' : 'verde';
  }
  voiceWordNoGo() {
    return 'alto';
  }

  evaluateAndNext() {
    if (!this.isPlaying) return;

    // En modo táctil cerramos el trial anterior antes del siguiente
    if (this.currentMode === 'touch') {
      if (this.currentTrial === 'go' && !this.responded) {
        this.misses++;
        this.lastTrialWasError = true;
        this.showFeedback('miss');
        this.recordTrial({ stimulus: 'go', correct: false, errorType: 'omission' });
      } else if (this.currentTrial === 'nogo' && !this.responded) {
        this.lastTrialWasError = false;
        this.recordTrial({ stimulus: 'nogo', correct: true });
      }
    }

    this.showTrial();
    this.updateStats();
  }

  handleTap() {
    if (!this.isPlaying || this.responded) return;
    if (this.currentMode === 'voice') return;  // modo voz: tap deshabilitado
    this.responded = true;

    if (this.currentTrial === 'go') {
      const rt = Math.round(performance.now() - this.trialStart);
      this.hits++;
      this.reactionTimes.push(rt);
      if (this.lastTrialWasError) this.postErrorRTs.push(rt); else this.normalRTs.push(rt);
      this.lastTrialWasError = false;
      this.beep(880, 80);
      this.showFeedback('hit');
      this.recordTrial({ stimulus: 'go', rt, correct: true });
    } else {
      this.falseAlarms++;
      this.lastTrialWasError = true;
      this.beep(220, 200);
      this.showFeedback('false');
      this.recordTrial({ stimulus: 'nogo', correct: false, errorType: 'commission' });
    }

    this.updateStats();
  }

  recordTrial(trial) {
    if (window.SessionStats && this.sessionActive) {
      SessionStats.session.recordTrial(trial);
    }
  }

  showFeedback(type) {
    this.clearFeedback();
    const touchZone = document.getElementById('touchZone');
    touchZone.classList.add('feedback-' + type);
    this.feedbackTimeout = setTimeout(() => this.clearFeedback(), 300);
  }

  clearFeedback() {
    if (this.feedbackTimeout) {
      clearTimeout(this.feedbackTimeout);
      this.feedbackTimeout = null;
    }
    const touchZone = document.getElementById('touchZone');
    touchZone.classList.remove('feedback-hit', 'feedback-false', 'feedback-miss');
  }

  updateStats() {
    if (this.currentMode === 'voice') {
      document.getElementById('statHits').textContent = this.rounds;
    } else {
      document.getElementById('statHits').textContent = this.hits;
      document.getElementById('statMisses').textContent = this.misses;
      document.getElementById('statFalse').textContent = this.falseAlarms;

      if (this.reactionTimes.length > 0) {
        const avg = Math.round(this.reactionTimes.reduce((a, b) => a + b, 0) / this.reactionTimes.length);
        document.getElementById('statRT').textContent = avg + ' ms';
      } else {
        document.getElementById('statRT').textContent = '-- ms';
      }
    }
  }

  applyModeUI() {
    const items = document.querySelectorAll('.stats-bar .stat-item');
    const firstLabel = items[0] ? items[0].querySelector('.stat-label') : null;
    if (this.currentMode === 'voice') {
      if (firstLabel) firstLabel.textContent = 'Rondas';
      for (let i = 1; i < items.length; i++) items[i].style.display = 'none';
    } else {
      if (firstLabel) firstLabel.textContent = 'Aciertos';
      for (let i = 1; i < items.length; i++) items[i].style.display = '';
    }
  }
}

const tool = new GoNoGoTool();

// Inicializar capa de stats UI (badge + selector + panel post-sesión)
if (window.SessionStatsUI) {
  SessionStatsUI.init({
    toolId: 'go-nogo',
    toolName: 'Go / No-Go',
    primaryMetric: 'rtMedian',
    onRepeat: () => tool.togglePlay(),
    onClose: () => tool.resetVisual()
  });
}
