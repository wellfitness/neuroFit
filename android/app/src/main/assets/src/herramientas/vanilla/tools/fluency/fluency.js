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
    this.currentSpeed = 6000;
    this.totalTrials = 0;
    this.lastCategory = null;
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
    this.isPlaying = !this.isPlaying;
    if (this.isPlaying) {
      document.getElementById('playIcon').textContent = 'pause';
      document.getElementById('playText').textContent = 'PAUSA';
      this.totalTrials = 0;
      this.updateStats();
      this.startEngine();
      ScreenWakeLock.request();
    } else {
      document.getElementById('playIcon').textContent = 'play_arrow';
      document.getElementById('playText').textContent = 'REANUDAR';
      this.stopEngine();
      ScreenWakeLock.release();
    }
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

  runFluency() {
    let cat;
    do {
      cat = this.fluencyCategories[Math.floor(Math.random() * this.fluencyCategories.length)];
    } while (cat === this.lastCategory && this.fluencyCategories.length > 1);
    this.lastCategory = cat;
    document.getElementById('fluencyText').textContent = cat;

    this.beep(600, 60);
    if (navigator.vibrate) navigator.vibrate(30);

    this.totalTrials++;
    this.updateStats();
  }

  updateStats() {
    document.getElementById('statRounds').textContent = this.totalTrials;
  }
}

const tool = new FluencyTool();
