class GoNoGoTool {
  constructor() {
    this.levels = {
      basic: {
        goColor: { bg: '#10b981', label: 'TOCA', icon: 'touch_app', areaClass: 'stimulus-area--go' },
        nogoColors: [{ bg: '#e11d48', label: 'NO TOQUES', icon: 'block', areaClass: 'stimulus-area--nogo' }],
        instructions: ['Verde = toca la pantalla', 'Rojo = no toques']
      },
      distractors: {
        goColor: { bg: '#10b981', label: 'TOCA', icon: 'touch_app', areaClass: 'stimulus-area--go' },
        nogoColors: [
          { bg: '#e11d48', label: 'NO TOQUES', icon: 'block', areaClass: 'stimulus-area--nogo' },
          { bg: '#eab308', label: 'NO TOQUES', icon: 'block', areaClass: 'stimulus-area--nogo-yellow' },
          { bg: '#3b82f6', label: 'NO TOQUES', icon: 'block', areaClass: 'stimulus-area--nogo-blue' }
        ],
        instructions: ['Solo verde = toca', 'Cualquier otro color = no toques']
      },
      inverted: {
        goColor: { bg: '#e11d48', label: 'TOCA', icon: 'touch_app', areaClass: 'stimulus-area--nogo' },
        nogoColors: [
          { bg: '#10b981', label: 'NO TOQUES', icon: 'block', areaClass: 'stimulus-area--go' },
          { bg: '#eab308', label: 'NO TOQUES', icon: 'block', areaClass: 'stimulus-area--nogo-yellow' },
          { bg: '#3b82f6', label: 'NO TOQUES', icon: 'block', areaClass: 'stimulus-area--nogo-blue' }
        ],
        instructions: ['Solo rojo = toca', 'Cualquier otro color = no toques']
      }
    };
    this.currentLevel = 'basic';
    this.scheduler = null;
    this.isPlaying = false;
    this.currentSpeed = 2000;
    this.goRatio = 0.6;
    this.hits = 0;
    this.misses = 0;
    this.falseAlarms = 0;
    this.reactionTimes = [];
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

  togglePlay() {
    this.isPlaying = !this.isPlaying;
    if (this.isPlaying) {
      document.getElementById('playIcon').textContent = 'pause';
      document.getElementById('playText').textContent = 'PAUSA';
      this.resetStats();
      this.startEngine();
    } else {
      document.getElementById('playIcon').textContent = 'play_arrow';
      document.getElementById('playText').textContent = 'REANUDAR';
      this.stopEngine();
    }
  }

  startEngine() {
    ScreenWakeLock.request();
    this.showTrial();
    if (!this.scheduler) {
      this.scheduler = new CadenceScheduler(() => this.evaluateAndNext(), this.currentSpeed);
    } else {
      this.scheduler.changeInterval(this.currentSpeed);
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

  changeLevel(level) {
    this.currentLevel = level;
    const config = this.levels[level];
    document.getElementById('goInstruction').innerHTML = config.instructions.join('<br>');
    if (this.isPlaying) {
      this.stopEngine();
      this.isPlaying = false;
      this.resetStats();
      document.getElementById('playIcon').textContent = 'play_arrow';
      document.getElementById('playText').textContent = 'INICIAR';
      this.resetVisual();
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
    this.reactionTimes = [];
    this.updateStats();
  }

  showTrial() {
    const config = this.levels[this.currentLevel];
    const isGo = Math.random() < this.goRatio;
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
  }

  evaluateAndNext() {
    if (!this.isPlaying) return;

    if (this.currentTrial === 'go' && !this.responded) {
      this.misses++;
      this.showFeedback('miss');
    }

    this.showTrial();
    this.updateStats();
  }

  handleTap() {
    if (!this.isPlaying || this.responded) return;
    this.responded = true;

    if (this.currentTrial === 'go') {
      const rt = Math.round(performance.now() - this.trialStart);
      this.hits++;
      this.reactionTimes.push(rt);
      this.beep(880, 80);
      this.showFeedback('hit');
    } else {
      this.falseAlarms++;
      this.beep(220, 200);
      this.showFeedback('false');
    }

    this.updateStats();
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

const tool = new GoNoGoTool();
