class FlechasTool {
  constructor() {
    this.arrows = [
      'north', 'south', 'west', 'east',
      'north_east', 'north_west', 'south_east', 'south_west'
    ];
    this.cardinalDirections = [
      { arrow: 'north', label: 'ARRIBA' },
      { arrow: 'south', label: 'ABAJO' },
      { arrow: 'west', label: 'IZQUIERDA' },
      { arrow: 'east', label: 'DERECHA' }
    ];
    this.scheduler = null;
    this.isPlaying = false;
    this.currentSpeed = 2000;
    this.level = 'normal';
    this.audioCtx = null;
    this.isFullscreen = false;

    document.addEventListener('fullscreenchange', () => {
      this.isFullscreen = !!document.fullscreenElement;
      document.getElementById('fullscreenIcon').textContent =
        this.isFullscreen ? 'fullscreen_exit' : 'fullscreen';
    });
  }

  getAudioCtx() {
    if (!this.audioCtx) this.audioCtx = new (window.AudioContext || window.webkitAudioContext)();
    if (this.audioCtx.state === 'suspended') this.audioCtx.resume();
    return this.audioCtx;
  }

  beep() {
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
      document.getElementById('playIcon').textContent = 'stop';
      document.getElementById('playText').textContent = 'DETENER';
      this.startEngine();
    } else {
      document.getElementById('playIcon').textContent = 'play_arrow';
      document.getElementById('playText').textContent = 'INICIAR';
      this.stopEngine();
    }
  }

  startEngine() {
    this.showArrow();
    ScreenWakeLock.request();
    if (!this.scheduler) {
      this.scheduler = new CadenceScheduler(() => this.showArrow(), this.currentSpeed);
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
    this.updateArrowColor();
    if (this.scheduler) this.scheduler.changeInterval(this.currentSpeed);
  }

  changeLevel(val) {
    this.level = val;
    const conflictEl = document.getElementById('conflictText');
    const instructionEl = document.getElementById('flechasInstruction');

    if (val === 'conflicto') {
      conflictEl.style.display = '';
      instructionEl.textContent = 'Sigue la PALABRA, ignora la flecha';
    } else {
      conflictEl.style.display = 'none';
      instructionEl.textContent = 'Mueve tu cuerpo en la dirección de la flecha';
    }

    if (this.isPlaying) {
      this.stopEngine();
      this.isPlaying = false;
      document.getElementById('playIcon').textContent = 'play_arrow';
      document.getElementById('playText').textContent = 'INICIAR';
      document.getElementById('arrowIcon').textContent = 'directions';
      document.getElementById('arrowIcon').style.color = this.getSpeedColor();
      conflictEl.textContent = '';
    }
  }

  getSpeedColor() {
    if (this.currentSpeed >= 3000) return 'var(--turquesa-400)';
    if (this.currentSpeed >= 2000) return 'var(--tulip-tree-400)';
    return 'var(--rosa-400)';
  }

  updateArrowColor() {
    document.getElementById('arrowIcon').style.color = this.getSpeedColor();
  }

  getConflictDirection(excludeArrow) {
    const candidates = this.cardinalDirections.filter(d => d.arrow !== excludeArrow);
    return candidates[Math.floor(Math.random() * candidates.length)];
  }

  showArrow() {
    const el = document.getElementById('arrowIcon');
    const conflictEl = document.getElementById('conflictText');

    el.classList.remove('flash');
    void el.offsetWidth;
    el.classList.add('flash');

    if (this.level === 'conflicto') {
      const arrow = this.cardinalDirections[Math.floor(Math.random() * this.cardinalDirections.length)];
      const conflict = this.getConflictDirection(arrow.arrow);
      el.textContent = arrow.arrow;
      conflictEl.textContent = conflict.label;
    } else {
      const arrow = this.arrows[Math.floor(Math.random() * this.arrows.length)];
      el.textContent = arrow;
      conflictEl.textContent = '';
    }

    el.style.color = this.getSpeedColor();
    this.beep();
  }

  toggleFullscreen() {
    if (!document.fullscreenElement) {
      document.documentElement.requestFullscreen?.();
    } else {
      document.exitFullscreen?.();
    }
  }
}

const tool = new FlechasTool();
