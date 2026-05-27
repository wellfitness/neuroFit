class ClockTool {
  constructor() {
    this.hourNames = ['Doce', 'Una', 'Dos', 'Tres', 'Cuatro', 'Cinco', 'Seis', 'Siete', 'Ocho', 'Nueve', 'Diez', 'Once'];
    this.mode = 'lr';
    this.format = 'text';
    this.scheduler = null;
    this.pendingRestart = null;
    this.isPlaying = false;
    this.sessionActive = false;
    this.currentSpeed = 4000;
    this.currentAnswer = null;
    this.currentDeltaAngle = 0;
    this.responded = false;
    this.hits = 0;
    this.misses = 0;
    this.totalTrials = 0;
    this.reactionTimes = [];
    // Tracking para slope por ángulo
    this.rtByAngleBin = {}; // bin (0-30, 30-60, 60-90, 90-120, 120-180) -> array de RTs
    this.trialStart = 0;
    this.audioCtx = null;
  }

  minuteAngle(min) { return min * 6; }
  hourAngle(hour, min) { return ((hour % 12) * 30) + (min * 0.5); }

  getSide(angle) {
    if (this.mode === 'lr') {
      if (angle === 0 || angle === 180) return null;
      return angle < 180 ? 'r' : 'l';
    }
    if (angle === 90 || angle === 270) return null;
    return (angle < 90 || angle > 270) ? 't' : 'b';
  }

  // Distancia angular más corta entre dos ángulos (0-180).
  angularDistance(a, b) {
    const d = Math.abs(a - b) % 360;
    return d > 180 ? 360 - d : d;
  }

  // Bin de 30° (0-30, 30-60, ..., 150-180)
  binForAngle(delta) {
    if (delta < 30) return '0-30';
    if (delta < 60) return '30-60';
    if (delta < 90) return '60-90';
    if (delta < 120) return '90-120';
    if (delta < 150) return '120-150';
    return '150-180';
  }

  formatTime(hour, min) {
    if (min === 0) return this.hourNames[hour % 12] + ' en punto';
    if (min <= 30) {
      const suffix = { 5: 'y cinco', 10: 'y diez', 15: 'y cuarto', 20: 'y veinte', 25: 'y veinticinco', 30: 'y media' };
      return this.hourNames[hour % 12] + ' ' + suffix[min];
    }
    const nextHour = (hour % 12) + 1;
    const suffix = { 35: 'menos veinticinco', 40: 'menos veinte', 45: 'menos cuarto', 50: 'menos diez', 55: 'menos cinco' };
    return this.hourNames[nextHour % 12] + ' ' + suffix[min];
  }

  formatDisplay(hour, min) {
    if (this.format === 'text') return this.formatTime(hour, min);
    const h24 = (hour % 12) + (Math.random() < 0.5 ? 0 : 12);
    return h24 + ':' + String(min).padStart(2, '0');
  }

  generateTrial() {
    let hour, min, hAngle, mAngle;
    do {
      hour = Math.floor(Math.random() * 12) + 1;
      min = Math.floor(Math.random() * 12) * 5;
      hAngle = this.hourAngle(hour, min);
      mAngle = this.minuteAngle(min);
    } while (this.getSide(hAngle) === null || this.getSide(mAngle) === null);

    const hSide = this.getSide(hAngle);
    const mSide = this.getSide(mAngle);
    return {
      text: this.formatDisplay(hour, min),
      answer: hSide === mSide ? 'mismo' : 'opuesto',
      hAngle,
      mAngle,
      deltaAngle: this.angularDistance(hAngle, mAngle)
    };
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

  changeVariant(value) {
    const [mode, format] = value.split('-');
    this.mode = mode;
    this.format = format;
    if (mode === 'lr') {
      document.getElementById('instructionText').innerHTML =
        'Imagina el reloj<br>¿Las dos agujas están en el mismo lado o en lados opuestos?';
      document.getElementById('iconSame1').textContent = 'arrow_forward';
      document.getElementById('iconSame2').textContent = 'arrow_forward';
      document.getElementById('labelSame').textContent = 'Mismo lado';
      document.getElementById('iconOpp1').textContent = 'arrow_back';
      document.getElementById('iconOpp2').textContent = 'arrow_forward';
      document.getElementById('labelOpp').textContent = 'Lados opuestos';
    } else {
      document.getElementById('instructionText').innerHTML =
        'Imagina el reloj<br>¿Las dos agujas están en la misma mitad o en mitades opuestas?';
      document.getElementById('iconSame1').textContent = 'arrow_upward';
      document.getElementById('iconSame2').textContent = 'arrow_upward';
      document.getElementById('labelSame').textContent = 'Misma mitad';
      document.getElementById('iconOpp1').textContent = 'arrow_upward';
      document.getElementById('iconOpp2').textContent = 'arrow_downward';
      document.getElementById('labelOpp').textContent = 'Mitades opuestas';
    }
    this.abortSessionIfRunning();
  }

  togglePlay() {
    if (!this.sessionActive) {
      this.sessionActive = true;
      this.setFinalizeVisible(true);
      this.resetStats();
      if (window.SessionStats) {
        SessionStats.session.start('clock', {
          mode: this.mode,
          format: this.format,
          cadence: this.currentSpeed
        });
      }
      KinesisTTS.warmup();
      this.isPlaying = true;
      document.getElementById('playIcon').textContent = 'pause';
      document.getElementById('playText').textContent = 'PAUSA';
      this.startEngine();
      this.setButtonsEnabled(true);
    } else if (this.isPlaying) {
      this.isPlaying = false;
      document.getElementById('playIcon').textContent = 'play_arrow';
      document.getElementById('playText').textContent = 'REANUDAR';
      this.stopEngine();
      this.setButtonsEnabled(false);
    } else {
      this.isPlaying = true;
      document.getElementById('playIcon').textContent = 'pause';
      document.getElementById('playText').textContent = 'PAUSA';
      this.startEngine();
      this.setButtonsEnabled(true);
    }
  }

  finalize() {
    if (!this.sessionActive) return;
    this.isPlaying = false;
    this.sessionActive = false;
    this.stopEngine();
    this.setButtonsEnabled(false);

    let result = null;
    let customFeedback = null;
    if (window.SessionStats) {
      result = SessionStats.session.end();
      if (result && result.summary) {
        const slope = this.computeSlope();
        if (slope !== null) {
          result.summary.config = result.summary.config || {};
          result.summary.config.angleSlope = slope;
          customFeedback = `Rotación mental: +${slope} ms por cada 30° extra entre las agujas`;
        }
      }
    }

    document.getElementById('playIcon').textContent = 'play_arrow';
    document.getElementById('playText').textContent = 'INICIAR';
    this.setFinalizeVisible(false);

    if (result && result.summary && result.summary.total >= 5 && window.SessionStatsUI) {
      SessionStatsUI.showResults(result.summary, result.comparison, customFeedback ? { customFeedback } : {});
    }
  }

  setFinalizeVisible(visible) {
    const btn = document.getElementById('btnFinalize');
    if (btn) btn.classList.toggle('visible', visible);
  }

  abortSessionIfRunning() {
    if (this.isPlaying || this.sessionActive) {
      this.stopEngine();
      if (window.SessionStats) SessionStats.session.abort();
      this.isPlaying = false;
      this.sessionActive = false;
      this.setFinalizeVisible(false);
      document.getElementById('playIcon').textContent = 'play_arrow';
      document.getElementById('playText').textContent = 'INICIAR';
      this.setButtonsEnabled(false);
      this.resetStats();
    }
  }

  // Regresión lineal: RT vs midpoint del bin de ángulo (en grados).
  // Devuelve pendiente normalizada a "ms por cada 30°" (más legible).
  computeSlope() {
    const binCenters = { '0-30': 15, '30-60': 45, '60-90': 75, '90-120': 105, '120-150': 135, '150-180': 165 };
    const xs = [];
    const ys = [];
    Object.keys(this.rtByAngleBin).forEach(bin => {
      const arr = this.rtByAngleBin[bin];
      if (arr && arr.length >= 2) {
        xs.push(binCenters[bin]);
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
    const slopePerDegree = (n * sumXY - sumX * sumY) / denom;
    return Math.round(slopePerDegree * 30);
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
    if (this.pendingRestart) clearTimeout(this.pendingRestart);
    this.pendingRestart = null;
    KinesisTTS.cancel();
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
    this.rtByAngleBin = {};
    this.updateStats();
  }

  showTrial() {
    const trial = this.generateTrial();
    this.currentAnswer = trial.answer;
    this.currentDeltaAngle = trial.deltaAngle;
    this.responded = false;
    this.trialStart = performance.now();
    this.totalTrials++;

    document.getElementById('clockText').textContent = '“' + trial.text + '”';
    document.querySelectorAll('.clock-answer-btn').forEach(btn => btn.classList.remove('correct', 'wrong'));

    this.beep(600, 60);

    KinesisTTS.cancel();
    KinesisTTS.speak(trial.text, 1.1);

    this.updateStats();
  }

  evaluateAndNext() {
    if (!this.isPlaying) return;
    if (!this.responded) {
      this.misses++;
      const correctBtn = document.querySelector(`.clock-answer-btn[data-answer="${this.currentAnswer}"]`);
      if (correctBtn) correctBtn.classList.add('correct');
      this.recordTrial({ stimulus: this.currentAnswer, deltaAngle: this.currentDeltaAngle, correct: false, errorType: 'omission' });
      this.updateStats();
      this.stopEngine();
      this.isPlaying = true;
      ScreenWakeLock.request();
      this.pendingRestart = setTimeout(() => {
        this.pendingRestart = null;
        if (!this.isPlaying) return;
        this.showTrial();
        this.scheduler.start();
      }, 800);
      return;
    }
    this.showTrial();
    this.updateStats();
  }

  handleAnswer(answer) {
    if (!this.isPlaying || this.responded) return;
    this.responded = true;

    const rt = Math.round(performance.now() - this.trialStart);
    const correct = this.currentAnswer === answer;
    const btn = document.querySelector(`.clock-answer-btn[data-answer="${answer}"]`);

    if (correct) {
      this.hits++;
      this.reactionTimes.push(rt);
      // Tracking del slope por ángulo
      const bin = this.binForAngle(this.currentDeltaAngle);
      if (!this.rtByAngleBin[bin]) this.rtByAngleBin[bin] = [];
      this.rtByAngleBin[bin].push(rt);
      this.beep(880, 80);
      if (btn) btn.classList.add('correct');
      this.recordTrial({ stimulus: this.currentAnswer, deltaAngle: this.currentDeltaAngle, rt, correct: true });
    } else {
      this.misses++;
      this.beep(220, 200);
      if (btn) btn.classList.add('wrong');
      if (navigator.vibrate) navigator.vibrate(100);
      const correctBtn = document.querySelector(`.clock-answer-btn[data-answer="${this.currentAnswer}"]`);
      if (correctBtn) correctBtn.classList.add('correct');
      this.recordTrial({ stimulus: this.currentAnswer, deltaAngle: this.currentDeltaAngle, rt, correct: false, errorType: 'commission' });
    }
    this.updateStats();
  }

  recordTrial(trial) {
    if (window.SessionStats && this.sessionActive) {
      SessionStats.session.recordTrial(trial);
    }
  }

  setButtonsEnabled(enabled) {
    document.querySelectorAll('.clock-answer-btn').forEach(btn => { btn.disabled = !enabled; });
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

const tool = new ClockTool();

if (window.SessionStatsUI) {
  SessionStatsUI.init({
    toolId: 'clock',
    toolName: 'Reloj Auditivo',
    primaryMetric: 'rtMedian',
    onRepeat: () => tool.togglePlay(),
    onClose: () => {}
  });
}
