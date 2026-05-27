class SimonTool {
  constructor() {
    this.colors = [
      { id: 0, freq: 329.6 },
      { id: 1, freq: 440 },
      { id: 2, freq: 554.4 },
      { id: 3, freq: 659.3 }
    ];
    this.sequence = [];
    this.playerIndex = 0;
    this.phase = 'idle';
    this.isPlaying = false;
    this.sessionActive = false;
    this.currentSpeed = 4000;
    this.direction = 'forward';
    this.hits = 0;
    this.misses = 0;
    this.bestStreak = 0;
    this.round = 0;
    this.audioCtx = null;
  }

  getAudioCtx() {
    if (!this.audioCtx) this.audioCtx = new (window.AudioContext || window.webkitAudioContext)();
    if (this.audioCtx.state === 'suspended') this.audioCtx.resume();
    return this.audioCtx;
  }

  playTone(freq, dur) {
    const ctx = this.getAudioCtx();
    const osc = ctx.createOscillator();
    const gain = ctx.createGain();
    osc.connect(gain);
    gain.connect(ctx.destination);
    osc.frequency.value = freq;
    gain.gain.value = 0.2;
    osc.start();
    gain.gain.exponentialRampToValueAtTime(0.001, ctx.currentTime + dur / 1000);
    osc.stop(ctx.currentTime + dur / 1000);
  }

  togglePlay() {
    if (!this.sessionActive) {
      this.sessionActive = true;
      this.setFinalizeVisible(true);
      this.isPlaying = true;
      ScreenWakeLock.request();
      this.resetStats();
      if (window.SessionStats) {
        SessionStats.session.start('simon', { direction: this.direction });
      }
      this.setPlayButton('pause', 'PAUSA');
      this.nextRound();
    } else if (this.isPlaying) {
      this.isPlaying = false;
      this.setPlayButton('play_arrow', 'REANUDAR');
      ScreenWakeLock.release();
      this.phase = 'idle';
      this.setInstruction('Pausado — pulsa REANUDAR');
      this.setButtonsClickable(false);
    } else {
      this.isPlaying = true;
      ScreenWakeLock.request();
      this.setPlayButton('pause', 'PAUSA');
      // Si estaba esperando input, continúa; si no, sigue con la siguiente ronda
      if (this.sequence.length === 0) {
        this.nextRound();
      } else if (this.phase === 'idle' || this.phase === 'showing') {
        this.playSequence();
      }
    }
  }

  finalize() {
    if (!this.sessionActive) return;
    this.isPlaying = false;
    this.sessionActive = false;
    this.phase = 'idle';
    ScreenWakeLock.release();
    this.setButtonsClickable(false);

    let result = null;
    let customFeedback = null;
    if (window.SessionStats) {
      result = SessionStats.session.end();
      if (result && result.summary) {
        result.summary.config = result.summary.config || {};
        result.summary.config.maxStreak = this.bestStreak;
        customFeedback = `Has alcanzado ${this.bestStreak} colores seguidos · ${this.direction === 'reverse' ? 'modo atrás' : 'modo adelante'}`;
      }
    }

    this.setPlayButton('play_arrow', 'INICIAR');
    this.setFinalizeVisible(false);
    this.setInstruction('Pulsa INICIAR para comenzar');
    this.resetStats();

    if (result && result.summary && result.summary.total >= 3 && window.SessionStatsUI) {
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

  changeDirection(val) {
    this.direction = val;
    if (this.isPlaying || this.sessionActive) {
      this.isPlaying = false;
      this.sessionActive = false;
      this.phase = 'idle';
      ScreenWakeLock.release();
      this.setButtonsClickable(false);
      if (window.SessionStats) SessionStats.session.abort();
      this.setPlayButton('play_arrow', 'INICIAR');
      this.setFinalizeVisible(false);
      this.setInstruction('Pulsa INICIAR para comenzar');
      this.resetStats();
    }
  }

  resetStats() {
    this.sequence = [];
    this.hits = 0;
    this.misses = 0;
    this.bestStreak = 0;
    this.round = 0;
    this.updateStats();
  }

  nextRound() {
    if (!this.isPlaying) return;
    this.round++;
    this.sequence.push(Math.floor(Math.random() * 4));
    this.updateStats();
    this.playSequence();
  }

  async playSequence() {
    this.phase = 'showing';
    this.setInstruction(this.direction === 'reverse'
      ? 'Observa — luego replícala AL REVÉS'
      : 'Observa la secuencia...');
    this.setButtonsClickable(false);

    const flashDuration = Math.max(200, 600 - this.sequence.length * 30);
    const gap = Math.max(150, 400 - this.sequence.length * 20);

    await this.sleep(500);

    for (let i = 0; i < this.sequence.length; i++) {
      if (!this.isPlaying) return;
      const id = this.sequence[i];
      this.flashButton(id, flashDuration);
      this.playTone(this.colors[id].freq, flashDuration);
      await this.sleep(flashDuration + gap);
    }

    if (!this.isPlaying) return;
    this.phase = 'input';
    this.playerIndex = 0;
    this.setInstruction(this.direction === 'reverse'
      ? 'Tu turno — replica AL REVÉS'
      : 'Tu turno — replica la secuencia');
    this.setButtonsClickable(true);
  }

  expectedIdAt(index) {
    if (this.direction === 'reverse') {
      return this.sequence[this.sequence.length - 1 - index];
    }
    return this.sequence[index];
  }

  handleTap(id) {
    if (this.phase !== 'input' || !this.isPlaying) return;

    this.flashButton(id, 200);
    this.playTone(this.colors[id].freq, 200);

    const expected = this.expectedIdAt(this.playerIndex);
    if (expected === id) {
      this.playerIndex++;
      if (this.playerIndex === this.sequence.length) {
        this.hits++;
        if (this.sequence.length > this.bestStreak) this.bestStreak = this.sequence.length;
        this.updateStats();
        this.recordTrial({ span: this.sequence.length, correct: true });
        this.setInstruction('Correcto');
        this.setButtonsClickable(false);
        setTimeout(() => this.nextRound(), 1000);
      }
    } else {
      this.misses++;
      this.updateStats();
      this.recordTrial({ span: this.sequence.length, correct: false });
      if (navigator.vibrate) navigator.vibrate(200);
      this.setInstruction('Error — secuencia reiniciada');
      this.setButtonsClickable(false);
      this.flashError(id);
      const correctId = expected;
      this.sequence = [];
      setTimeout(() => this.highlightCorrect(correctId), 400);
      setTimeout(() => this.nextRound(), 1800);
    }
  }

  recordTrial(trial) {
    if (window.SessionStats && this.sessionActive) {
      SessionStats.session.recordTrial(trial);
    }
  }

  flashButton(id, duration) {
    const btn = document.getElementById('simon-' + id);
    btn.classList.add('lit');
    setTimeout(() => btn.classList.remove('lit'), duration);
  }

  flashError(id) {
    const btn = document.getElementById('simon-' + id);
    btn.classList.add('error');
    setTimeout(() => btn.classList.remove('error'), 400);
  }

  highlightCorrect(id) {
    const btn = document.getElementById('simon-' + id);
    btn.classList.add('lit');
    setTimeout(() => btn.classList.remove('lit'), 800);
  }

  setInstruction(text) {
    document.getElementById('simonInstruction').textContent = text;
  }

  setButtonsClickable(clickable) {
    for (let i = 0; i < 4; i++) {
      document.getElementById('simon-' + i).style.pointerEvents = clickable ? 'auto' : 'none';
    }
  }

  sleep(ms) {
    return new Promise(resolve => setTimeout(resolve, ms));
  }

  updateStats() {
    document.getElementById('statRound').textContent = this.round;
    document.getElementById('statHits').textContent = this.hits;
    document.getElementById('statMisses').textContent = this.misses;
    document.getElementById('statBest').textContent = this.bestStreak;
  }
}

const tool = new SimonTool();

if (window.SessionStatsUI) {
  SessionStatsUI.init({
    toolId: 'simon',
    toolName: 'Simon Dice',
    primaryMetric: 'accuracy',
    onRepeat: () => tool.togglePlay(),
    onClose: () => {}
  });
}
