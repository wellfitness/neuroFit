class D50Tool {
  constructor() {
    this.scheduler = null;
    this.pendingRestart = null;
    this.isPlaying = false;
    this.sessionActive = false;
    this.currentSpeed = 3000;
    this.mode = 'suma';
    this.hits = 0;
    this.misses = 0;
    this.totalTrials = 0;
    this.currentAnswer = null;
    this.currentDistance = 0;
    this.responded = false;
    this.trialStart = 0;
    this.reactionTimes = [];
    // Slope por distancia numérica (|result - 50|)
    this.rtByDistanceBin = {}; // bin -> array de RTs
    this.audioCtx = null;
  }

  changeMode(val) {
    this.mode = val;
    this.abortSessionIfRunning();
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

  // Bin de distancia numérica al 50: cerca (1-5), media (6-15), lejos (16+)
  binForDistance(d) {
    if (d <= 5) return 'cerca';
    if (d <= 15) return 'media';
    return 'lejos';
  }

  togglePlay() {
    if (!this.sessionActive) {
      this.sessionActive = true;
      this.setFinalizeVisible(true);
      this.resetStats();
      if (window.SessionStats) {
        SessionStats.session.start('d50', {
          mode: this.mode,
          cadence: this.currentSpeed
        });
      }
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
        const bins = ['cerca', 'media', 'lejos'];
        const avgs = bins.map(b => {
          const arr = this.rtByDistanceBin[b] || [];
          if (arr.length < 2) return null;
          return Math.round(arr.reduce((a, c) => a + c, 0) / arr.length);
        });
        const validCount = avgs.filter(v => v != null).length;
        if (validCount >= 2) {
          const parts = [];
          bins.forEach((b, i) => {
            if (avgs[i] != null) parts.push(`${b}: ${avgs[i]} ms`);
          });
          customFeedback = `Distancia numérica al 50 → ${parts.join(' · ')}`;
          result.summary.config = result.summary.config || {};
          result.summary.config.rtByDistance = { cerca: avgs[0], media: avgs[1], lejos: avgs[2] };
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
    this.rtByDistanceBin = {};
    this.updateStats();
  }

  showTrial() {
    const chosenOp = this.mode === 'mixto'
      ? (Math.random() < 0.5 ? 'suma' : 'resta')
      : this.mode;

    let num1, num2, result, opSymbol;
    if (chosenOp === 'suma') {
      do {
        num1 = Math.floor(Math.random() * 40) + 5;
        num2 = Math.floor(Math.random() * 40) + 5;
      } while (num1 + num2 === 50);
      result = num1 + num2;
      opSymbol = '+';
    } else {
      do {
        num1 = Math.floor(Math.random() * 85) + 15;
        num2 = Math.floor(Math.random() * (num1 - 5)) + 5;
      } while (num1 - num2 === 50);
      result = num1 - num2;
      opSymbol = '−';
    }

    this.currentAnswer = result > 50 ? 'mayor' : 'menor';
    this.currentDistance = Math.abs(result - 50);
    this.responded = false;
    this.trialStart = performance.now();
    this.totalTrials++;

    document.getElementById('d50Text').textContent = num1 + ' ' + opSymbol + ' ' + num2;
    document.querySelectorAll('.d50-answer-btn').forEach(btn => {
      btn.classList.remove('correct', 'wrong');
    });

    this.updateStats();
  }

  evaluateAndNext() {
    if (!this.isPlaying) return;
    if (!this.responded) {
      this.misses++;
      const correctBtn = document.querySelector(`.d50-answer-btn[data-answer="${this.currentAnswer}"]`);
      if (correctBtn) correctBtn.classList.add('correct');
      this.recordTrial({ stimulus: this.currentAnswer, distance: this.currentDistance, correct: false, errorType: 'omission' });
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
    const btn = document.querySelector(`.d50-answer-btn[data-answer="${answer}"]`);

    if (correct) {
      this.hits++;
      this.reactionTimes.push(rt);
      const bin = this.binForDistance(this.currentDistance);
      if (!this.rtByDistanceBin[bin]) this.rtByDistanceBin[bin] = [];
      this.rtByDistanceBin[bin].push(rt);
      this.beep(880, 80);
      if (btn) btn.classList.add('correct');
      this.recordTrial({ stimulus: this.currentAnswer, distance: this.currentDistance, rt, correct: true });
    } else {
      this.misses++;
      this.beep(220, 200);
      if (btn) btn.classList.add('wrong');
      if (navigator.vibrate) navigator.vibrate(100);
      this.recordTrial({ stimulus: this.currentAnswer, distance: this.currentDistance, rt, correct: false, errorType: 'commission' });
    }
    this.updateStats();
  }

  recordTrial(trial) {
    if (window.SessionStats && this.sessionActive) {
      SessionStats.session.recordTrial(trial);
    }
  }

  setButtonsEnabled(enabled) {
    document.querySelectorAll('.d50-answer-btn').forEach(btn => {
      btn.disabled = !enabled;
    });
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

const tool = new D50Tool();

if (window.SessionStatsUI) {
  SessionStatsUI.init({
    toolId: 'd50',
    toolName: 'Decisión D50',
    primaryMetric: 'rtMedian',
    onRepeat: () => tool.togglePlay(),
    onClose: () => {}
  });
}
