class ClockTool {
  constructor() {
    this.hourNames = ['Doce', 'Una', 'Dos', 'Tres', 'Cuatro', 'Cinco', 'Seis', 'Siete', 'Ocho', 'Nueve', 'Diez', 'Once'];
    this.mode = 'lr';
    this.format = 'text';
    this.scheduler = null;
    this.pendingRestart = null;
    this.isPlaying = false;
    this.currentSpeed = 4000;
    this.currentAnswer = null;
    this.responded = false;
    this.hits = 0;
    this.misses = 0;
    this.totalTrials = 0;
    this.reactionTimes = [];
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
      answer: hSide === mSide ? 'mismo' : 'opuesto'
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
        'Imagina el reloj<br>\u00bfLas dos agujas est\u00e1n en el mismo lado o en lados opuestos?';
      document.getElementById('iconSame1').textContent = 'arrow_forward';
      document.getElementById('iconSame2').textContent = 'arrow_forward';
      document.getElementById('labelSame').textContent = 'Mismo lado';
      document.getElementById('iconOpp1').textContent = 'arrow_back';
      document.getElementById('iconOpp2').textContent = 'arrow_forward';
      document.getElementById('labelOpp').textContent = 'Lados opuestos';
    } else {
      document.getElementById('instructionText').innerHTML =
        'Imagina el reloj<br>\u00bfLas dos agujas est\u00e1n en la misma mitad o en mitades opuestas?';
      document.getElementById('iconSame1').textContent = 'arrow_upward';
      document.getElementById('iconSame2').textContent = 'arrow_upward';
      document.getElementById('labelSame').textContent = 'Misma mitad';
      document.getElementById('iconOpp1').textContent = 'arrow_upward';
      document.getElementById('iconOpp2').textContent = 'arrow_downward';
      document.getElementById('labelOpp').textContent = 'Mitades opuestas';
    }
    if (this.isPlaying) {
      this.stopEngine();
      this.resetStats();
      this.startEngine();
    }
  }

  togglePlay() {
    this.isPlaying = !this.isPlaying;
    if (this.isPlaying) {
      document.getElementById('playIcon').textContent = 'pause';
      document.getElementById('playText').textContent = 'PAUSA';
      KinesisTTS.warmup();
      this.resetStats();
      this.startEngine();
      this.setButtonsEnabled(true);
    } else {
      document.getElementById('playIcon').textContent = 'play_arrow';
      document.getElementById('playText').textContent = 'REANUDAR';
      this.stopEngine();
      this.setButtonsEnabled(false);
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
    this.updateStats();
  }

  showTrial() {
    const trial = this.generateTrial();
    this.currentAnswer = trial.answer;
    this.responded = false;
    this.trialStart = performance.now();
    this.totalTrials++;

    document.getElementById('clockText').textContent = '\u201C' + trial.text + '\u201D';
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

    const rt = performance.now() - this.trialStart;
    const correct = this.currentAnswer === answer;
    const btn = document.querySelector(`.clock-answer-btn[data-answer="${answer}"]`);

    if (correct) {
      this.hits++;
      this.reactionTimes.push(rt);
      this.beep(880, 80);
      if (btn) btn.classList.add('correct');
    } else {
      this.misses++;
      this.beep(220, 200);
      if (btn) btn.classList.add('wrong');
      if (navigator.vibrate) navigator.vibrate(100);
      const correctBtn = document.querySelector(`.clock-answer-btn[data-answer="${this.currentAnswer}"]`);
      if (correctBtn) correctBtn.classList.add('correct');
    }
    this.updateStats();
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
