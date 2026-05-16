class ReactiveTool {
  constructor() {
    this.stimuli = [
      { type: 'beep', freq: 900, color: null, hex: '#ffffff', name: 'AGUDO', action: 'SALTO' },
      { type: 'beep', freq: 250, color: null, hex: '#ffffff', name: 'GRAVE', action: 'ABAJO' },
      { type: 'color', freq: null, color: 'var(--turquesa-400)', hex: '#18f8f6', name: 'AZUL', action: 'DERECHA' },
      { type: 'color', freq: null, color: 'var(--rosa-600)', hex: '#e11d48', name: 'ROJO', action: 'IZQUIERDA' }
    ];
    this.scheduler = null;
    this.pendingTimeout = null;
    this.clearTimeout = null;
    this.isPlaying = false;
    this.currentSpeed = 3000;
    this.totalTrials = 0;
    this.minPerStimulus = 2;
    this.stimulusCounts = [0, 0, 0, 0];
    this.learningDone = false;
    this.audioCtx = null;
    this.lastStimIndex = null;
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
      this.totalTrials = 0;
      this.stimulusCounts = [0, 0, 0, 0];
      this.learningDone = false;
      this.lastStimIndex = null;
      this.updateStats();
      this.renderLegend();
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
    this.runReactive();
    if (!this.scheduler) {
      this.scheduler = new CadenceScheduler(() => this.runReactive(), this.currentSpeed);
    } else {
      this.scheduler.changeInterval(this.currentSpeed);
    }
    this.scheduler.start();
  }

  stopEngine() {
    if (this.scheduler) this.scheduler.stop();
    if (this.pendingTimeout) clearTimeout(this.pendingTimeout);
    if (this.clearTimeout) clearTimeout(this.clearTimeout);
    this.pendingTimeout = null;
    this.clearTimeout = null;
  }

  changeSpeed(ms) {
    this.currentSpeed = parseInt(ms, 10);
    if (this.scheduler) this.scheduler.changeInterval(this.currentSpeed);
  }

  updateAction(index, value) {
    this.stimuli[index].action = value.toUpperCase().trim();
    this.renderLegend();
  }

  escapeAttr(str) {
    return str.replace(/&/g, '&amp;').replace(/"/g, '&quot;').replace(/</g, '&lt;').replace(/>/g, '&gt;');
  }

  renderLegend() {
    const el = document.getElementById('reactiveLegend');
    el.innerHTML = this.stimuli.map((s, i) =>
      '<div class="legend-item">' +
        '<span class="legend-signal" style="color:' + s.hex + ';">' +
          s.name +
        '</span>' +
        '<span class="legend-arrow">&rarr;</span>' +
        '<input name="action-' + i + '" class="legend-action" value="' + this.escapeAttr(s.action) + '" ' +
          'onchange="tool.updateAction(' + i + ', this.value)" ' +
          'maxlength="20">' +
      '</div>'
    ).join('');
  }

  runReactive() {
    const bg = document.getElementById('reactiveBg');
    const actionEl = document.getElementById('reactiveAction');
    const signalEl = document.getElementById('reactiveSignal');
    document.getElementById('reactiveIntro').style.display = 'none';

    actionEl.style.opacity = '0';
    signalEl.style.display = 'none';
    bg.style.background = 'var(--gris-900)';

    const delay = Math.floor(Math.random() * (this.currentSpeed * 0.4)) + (this.currentSpeed * 0.2);

    this.pendingTimeout = setTimeout(() => {
      if (!this.isPlaying) return;

      const stimIndex = Math.floor(Math.random() * this.stimuli.length);
      const stim = this.stimuli[stimIndex];
      this.totalTrials++;
      this.stimulusCounts[stimIndex]++;

      this.updateStats();

      if (stim.type === 'color' && stimIndex === this.lastStimIndex) {
        this.tick();
      }

      if (stim.type === 'beep') {
        const icon = stim.freq >= 500 ? 'volume_up' : 'volume_down';
        signalEl.innerHTML = '<span class="material-symbols-sharp" style="font-size: clamp(4rem, 12vw, 7rem); color: white;">' + icon + '</span>';
        signalEl.style.display = 'flex';
        this.beep(stim.freq, 200);
      } else {
        bg.style.background = stim.color;
      }

      this.lastStimIndex = stimIndex;

      if (!this.learningDone) {
        actionEl.textContent = stim.action;
        actionEl.style.opacity = '1';
      }

      if (!this.learningDone) {
        this.learningDone = this.stimulusCounts.every(c => c >= this.minPerStimulus);
      }

      const flashDuration = Math.min(600, this.currentSpeed * 0.2);
      this.clearTimeout = setTimeout(() => {
        if (this.isPlaying) {
          actionEl.style.opacity = '0';
          signalEl.style.display = 'none';
          bg.style.background = 'var(--gris-900)';
        }
      }, flashDuration);
    }, delay);
  }

  updateStats() {
    document.getElementById('statRounds').textContent = this.totalTrials;
    const isMobile = window.innerWidth < 480;
    const phase = !this.learningDone
      ? (isMobile ? 'APRENDE' : 'APRENDIZAJE')
      : 'MEMORIA';
    document.getElementById('statPhase').textContent = phase;
  }
}

const tool = new ReactiveTool();
