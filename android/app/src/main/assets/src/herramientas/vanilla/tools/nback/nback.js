class NBackTool {
  constructor() {
    this.levels = {
      easy:   { n: 1, matchProb: 0.50, label: '1-Back' },
      medium: { n: 1, matchProb: 0.35, label: '1-Back' },
      hard:   { n: 2, matchProb: 0.45, label: '2-Back' }
    };
    this.currentLevel = 'easy';
    this.scheduler = null;
    this.isPlaying = false;
    this.currentSpeed = 3000;
    this.stimuli = [
      { shape: 'circle', color: '#18f8f6' },
      { shape: 'square', color: '#e11d48' },
      { shape: 'triangle', color: '#eab308' },
      { shape: 'diamond', color: '#3b82f6' },
    ];
    this.shapes = ['circle', 'square', 'triangle', 'diamond'];
    this.colors = ['#18f8f6', '#e11d48', '#eab308', '#3b82f6'];
    this.history = [];
    this.hits = 0;
    this.misses = 0;
    this.falseAlarms = 0;
    this.totalTrials = 0;
    this.responded = false;
    this.isMatch = false;
    this.audioCtx = null;
  }

  get n() { return this.levels[this.currentLevel].n; }
  get matchProbability() { return this.levels[this.currentLevel].matchProb; }

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
      document.getElementById('matchBtn').disabled = true;
    }
  }

  startEngine() {
    ScreenWakeLock.request();
    this.showStimulus();
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
    document.getElementById('nLabel').textContent = config.n;
    const instrEl = document.getElementById('nbackInstruction');
    if (level === 'hard') {
      instrEl.innerHTML = 'Si la forma <strong>O</strong> el color coinciden con hace <span class="n-indicator" id="nLabel">' + config.n + '</span> turnos, pulsa COINCIDE';
    } else {
      instrEl.innerHTML = 'Si la forma y color son IGUALES a la de hace <span class="n-indicator" id="nLabel">' + config.n + '</span> turnos, pulsa COINCIDE';
    }
    if (this.isPlaying) {
      this.stopEngine();
      this.isPlaying = false;
      document.getElementById('playIcon').textContent = 'play_arrow';
      document.getElementById('playText').textContent = 'INICIAR';
      document.getElementById('matchBtn').disabled = true;
    }
    this.resetStats();
    this.renderHistory();
    document.getElementById('shapeDisplay').innerHTML = '';
    document.getElementById('nbackStimulus').style.border = '3px solid var(--gris-600)';
  }

  resetStats() {
    this.history = [];
    this.hits = 0;
    this.misses = 0;
    this.falseAlarms = 0;
    this.totalTrials = 0;
    this.updateStats();
    this.renderHistory();
  }

  pickStimulus() {
    const target = this.history.length >= this.n ? this.history[this.history.length - this.n] : null;

    if (this.currentLevel === 'hard') {
      if (target && Math.random() < this.matchProbability) {
        const matchShape = Math.random() < 0.5;
        if (matchShape) {
          const otherColors = this.colors.filter(c => c !== target.color);
          return { shape: target.shape, color: otherColors[Math.floor(Math.random() * otherColors.length)] };
        } else {
          const otherShapes = this.shapes.filter(s => s !== target.shape);
          return { shape: otherShapes[Math.floor(Math.random() * otherShapes.length)], color: target.color };
        }
      }
      let stim;
      let attempts = 0;
      do {
        stim = {
          shape: this.shapes[Math.floor(Math.random() * this.shapes.length)],
          color: this.colors[Math.floor(Math.random() * this.colors.length)]
        };
        attempts++;
      } while (target && (stim.shape === target.shape || stim.color === target.color) && attempts < 20);
      return stim;
    }

    if (target && Math.random() < this.matchProbability) {
      return target;
    }
    return this.stimuli[Math.floor(Math.random() * this.stimuli.length)];
  }

  showStimulus() {
    const stim = this.pickStimulus();
    this.history.push(stim);
    this.totalTrials++;
    this.responded = false;

    const curr = this.history[this.history.length - 1];
    const prev = this.history.length > this.n ? this.history[this.history.length - 1 - this.n] : null;
    if (this.currentLevel === 'hard') {
      this.isMatch = prev !== null && (curr.shape === prev.shape || curr.color === prev.color);
    } else {
      this.isMatch = prev !== null && curr.shape === prev.shape && curr.color === prev.color;
    }

    this.renderShape(stim);
    this.renderHistory();

    document.getElementById('matchBtn').disabled = false;
    document.getElementById('matchBtn').classList.remove('pressed');

    this.updateStats();
  }

  evaluateAndNext() {
    if (!this.isPlaying) return;

    if (this.isMatch && !this.responded) {
      this.misses++;
      this.showFeedback('miss');
    }

    this.showStimulus();
    this.updateStats();
  }

  handleMatch() {
    if (!this.isPlaying || this.responded) return;
    this.responded = true;

    document.getElementById('matchBtn').classList.add('pressed');

    if (this.isMatch) {
      this.hits++;
      this.beep(880, 80);
      this.showFeedback('hit');
    } else {
      this.falseAlarms++;
      this.beep(220, 200);
      this.showFeedback('false');
      if (navigator.vibrate) navigator.vibrate(100);
    }

    this.updateStats();
  }

  renderShape(stim) {
    const display = document.getElementById('shapeDisplay');
    const container = document.getElementById('nbackStimulus');

    container.style.background = 'var(--gris-800)';
    container.style.border = '3px solid ' + stim.color;

    let svg = '';
    switch (stim.shape) {
      case 'circle':
        svg = '<svg viewBox="0 0 100 100"><circle cx="50" cy="50" r="40" fill="' + stim.color + '"/></svg>';
        break;
      case 'square':
        svg = '<svg viewBox="0 0 100 100"><rect x="15" y="15" width="70" height="70" rx="8" fill="' + stim.color + '"/></svg>';
        break;
      case 'triangle':
        svg = '<svg viewBox="0 0 100 100"><polygon points="50,10 90,85 10,85" fill="' + stim.color + '"/></svg>';
        break;
      case 'diamond':
        svg = '<svg viewBox="0 0 100 100"><polygon points="50,5 95,50 50,95 5,50" fill="' + stim.color + '"/></svg>';
        break;
    }
    display.innerHTML = svg;
  }

  renderHistory() {
    const bar = document.getElementById('historyBar');
    const visible = this.history.slice(-(this.n + 3));
    bar.innerHTML = '';
    visible.forEach((stim, i) => {
      const dot = document.createElement('div');
      dot.className = 'history-dot';
      if (i === visible.length - 1) dot.classList.add('current');
      dot.innerHTML = this.miniSvg(stim);
      bar.appendChild(dot);
    });
  }

  miniSvg(stim) {
    const c = stim.color;
    switch (stim.shape) {
      case 'circle':
        return '<svg viewBox="0 0 40 40"><circle cx="20" cy="20" r="15" fill="' + c + '"/></svg>';
      case 'square':
        return '<svg viewBox="0 0 40 40"><rect x="6" y="6" width="28" height="28" rx="4" fill="' + c + '"/></svg>';
      case 'triangle':
        return '<svg viewBox="0 0 40 40"><polygon points="20,4 36,34 4,34" fill="' + c + '"/></svg>';
      case 'diamond':
        return '<svg viewBox="0 0 40 40"><polygon points="20,2 38,20 20,38 2,20" fill="' + c + '"/></svg>';
      default:
        return '';
    }
  }

  showFeedback(type) {
    const el = document.getElementById('feedbackFlash');
    const stim = document.getElementById('nbackStimulus');

    if (type === 'hit') {
      el.textContent = '';
      stim.style.boxShadow = '0 0 50px rgba(16, 185, 129, 0.6)';
    } else if (type === 'false') {
      el.textContent = '';
      stim.style.boxShadow = '0 0 50px rgba(225, 29, 72, 0.6)';
    } else {
      el.textContent = '';
      stim.style.boxShadow = '0 0 50px rgba(234, 179, 8, 0.6)';
    }

    el.classList.add('show');
    setTimeout(() => {
      el.classList.remove('show');
      stim.style.boxShadow = '0 8px 32px rgba(0,0,0,0.4)';
    }, 400);
  }

  updateStats() {
    document.getElementById('statHits').textContent = this.hits;
    document.getElementById('statMisses').textContent = this.misses;
    document.getElementById('statFalse').textContent = this.falseAlarms;
    document.getElementById('statTotal').textContent = this.totalTrials;
  }
}

const tool = new NBackTool();
