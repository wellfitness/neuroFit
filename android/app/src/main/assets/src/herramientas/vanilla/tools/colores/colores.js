class ColoresTool {
  constructor() {
    this.coloresData = [
      { name: 'ROJO', hex: '#e11d48', action: 'SENTADILLA' },
      { name: 'AZUL', hex: '#3b82f6', action: 'SALTO' },
      { name: 'VERDE', hex: '#10b981', action: 'DERECHA' },
      { name: 'AMARILLO', hex: '#eab308', action: 'IZQUIERDA' }
    ];
    this.scheduler = null;
    this.isPlaying = false;
    this.currentSpeed = 3000;
    this.rounds = 0;
    this.minPerColor = 2;
    this.colorCounts = [0, 0, 0, 0];
    this.learningDone = false;
    this.level = 2;
    this.audioCtx = null;
  }

  getAudioCtx() {
    if (!this.audioCtx) this.audioCtx = new (window.AudioContext || window.webkitAudioContext)();
    if (this.audioCtx.state === 'suspended') this.audioCtx.resume();
    return this.audioCtx;
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
    const btn = document.getElementById('btnPlayPause');
    const intro = document.getElementById('coloresIntro');
    if (this.isPlaying) {
      btn.classList.add('active');
      document.getElementById('playIcon').textContent = 'pause';
      document.getElementById('playText').textContent = 'PAUSA';
      this.updateIntro();
      this.rounds = 0;
      this.colorCounts = [0, 0, 0, 0];
      this.learningDone = false;
      document.getElementById('statRounds').textContent = '0';
      this.startEngine();
    } else {
      btn.classList.remove('active');
      document.getElementById('playIcon').textContent = 'play_arrow';
      document.getElementById('playText').textContent = 'REANUDAR';
      this.stopEngine();
      this.updateIntro();
    }
  }

  startEngine() {
    this.runColores();
    ScreenWakeLock.request();
    if (!this.scheduler) {
      this.scheduler = new CadenceScheduler(() => this.runColores(), this.currentSpeed);
    } else {
      this.scheduler.changeInterval(this.currentSpeed);
    }
    this.scheduler.start();
  }

  stopEngine() {
    if (this.scheduler) this.scheduler.stop();
    ScreenWakeLock.release();
  }

  changeSpeed(ms) {
    this.currentSpeed = parseInt(ms, 10);
    if (this.scheduler) this.scheduler.changeInterval(this.currentSpeed);
  }

  changeLevel(val) {
    this.level = parseInt(val, 10);
    const legend = document.getElementById('coloresLegend');
    if (legend) legend.style.display = this.level === 1 ? 'none' : '';
    const textEl = document.getElementById('coloresText');
    if (textEl) textEl.style.display = this.level === 2 ? 'none' : '';
    this.updateIntro();
  }

  updateIntro() {
    const intro = document.getElementById('coloresIntro');
    if (!intro) return;
    if (this.level === 1) {
      intro.innerHTML = 'Ignora la palabra<br>Di en voz alta el color de fondo';
      intro.style.display = '';
    } else if (this.level === 3) {
      intro.innerHTML = 'Ignora la palabra<br>Haz la acción del color de fondo';
      intro.style.display = '';
    } else if (!this.isPlaying) {
      intro.innerHTML = 'Elige nivel y configura acciones<br>Pulsa INICIAR';
      intro.style.display = '';
    } else {
      intro.style.display = 'none';
    }
  }

  updateAction(index, value) {
    this.coloresData[index].action = value.toUpperCase();
  }

  getDistractorName(excludeIndex) {
    let idx;
    do { idx = Math.floor(Math.random() * this.coloresData.length); }
    while (idx === excludeIndex);
    return this.coloresData[idx].name;
  }

  runColores() {
    const colorIndex = Math.floor(Math.random() * this.coloresData.length);
    this.tick();
    const col = this.coloresData[colorIndex];
    const bg = document.getElementById('stimulus-colores');
    const textEl = document.getElementById('coloresText');
    const actionEl = document.getElementById('coloresAction');

    bg.style.backgroundColor = col.hex;

    if (this.level === 1 || this.level === 3) {
      textEl.textContent = this.getDistractorName(colorIndex);
      textEl.style.display = '';
    } else {
      textEl.style.display = 'none';
    }

    this.rounds++;
    this.colorCounts[colorIndex]++;
    document.getElementById('statRounds').textContent = this.rounds;

    if (this.level === 1) {
      actionEl.classList.remove('visible');
    } else if (!this.learningDone) {
      actionEl.textContent = col.action;
      actionEl.classList.add('visible');
    } else {
      actionEl.classList.remove('visible');
    }

    if (!this.learningDone) {
      this.learningDone = this.colorCounts.every(c => c >= this.minPerColor);
    }
  }
}

const tool = new ColoresTool();
