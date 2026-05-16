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
    this.currentSpeed = 4000;
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
    this.isPlaying = !this.isPlaying;
    if (this.isPlaying) {
      document.getElementById('playIcon').textContent = 'stop';
      document.getElementById('playText').textContent = 'DETENER';
      ScreenWakeLock.request();
      this.resetStats();
      this.nextRound();
    } else {
      document.getElementById('playIcon').textContent = 'play_arrow';
      document.getElementById('playText').textContent = 'INICIAR';
      ScreenWakeLock.release();
      this.phase = 'idle';
      this.setInstruction('Pulsa INICIAR para comenzar');
      this.setButtonsClickable(false);
    }
  }

  changeSpeed(ms) {
    this.currentSpeed = parseInt(ms, 10);
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
    this.setInstruction('Observa la secuencia...');
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
    this.setInstruction('Tu turno — replica la secuencia');
    this.setButtonsClickable(true);
  }

  handleTap(id) {
    if (this.phase !== 'input' || !this.isPlaying) return;

    this.flashButton(id, 200);
    this.playTone(this.colors[id].freq, 200);

    if (this.sequence[this.playerIndex] === id) {
      this.playerIndex++;
      if (this.playerIndex === this.sequence.length) {
        this.hits++;
        if (this.sequence.length > this.bestStreak) this.bestStreak = this.sequence.length;
        this.updateStats();
        this.setInstruction('Correcto');
        this.setButtonsClickable(false);
        setTimeout(() => this.nextRound(), 1000);
      }
    } else {
      this.misses++;
      this.updateStats();
      if (navigator.vibrate) navigator.vibrate(200);
      this.setInstruction('Error — secuencia reiniciada');
      this.setButtonsClickable(false);
      this.flashError(id);
      const correctId = this.sequence[this.playerIndex];
      this.sequence = [];
      setTimeout(() => this.highlightCorrect(correctId), 400);
      setTimeout(() => this.nextRound(), 1800);
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
