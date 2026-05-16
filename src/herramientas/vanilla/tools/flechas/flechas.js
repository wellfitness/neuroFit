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
    this.directionVoiceLabels = {
      'north': 'arriba',
      'south': 'abajo',
      'west': 'izquierda',
      'east': 'derecha',
      'north_east': 'arriba derecha',
      'north_west': 'arriba izquierda',
      'south_east': 'abajo derecha',
      'south_west': 'abajo izquierda'
    };
    this.scheduler = null;
    this.isPlaying = false;
    this.sessionActive = false;
    this.currentSpeed = 2000;
    this.jitter = 0;
    this.level = 'normal';
    this.currentMode = 'visual';
    this.audioCtx = null;
    this.isFullscreen = false;
    this.totalTrials = 0;

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
    if (!this.sessionActive) {
      this.sessionActive = true;
      this.setFinalizeVisible(true);
      this.totalTrials = 0;
      if (window.SessionStats) {
        SessionStats.session.start('flechas', {
          level: this.level,
          cadence: this.currentSpeed,
          mode: this.currentMode === 'voice' ? 'voice' : 'visual',
          jitter: this.jitter
        });
      }
      if (this.currentMode === 'voice' && window.KinesisTTS) KinesisTTS.warmup();
      this.isPlaying = true;
      this.setPlayButton('stop', 'DETENER');
      this.startEngine();
    } else if (this.isPlaying) {
      this.isPlaying = false;
      this.setPlayButton('play_arrow', 'REANUDAR');
      this.stopEngine();
    } else {
      this.isPlaying = true;
      this.setPlayButton('stop', 'DETENER');
      this.startEngine();
    }
  }

  finalize() {
    if (!this.sessionActive) return;
    this.isPlaying = false;
    this.sessionActive = false;
    this.stopEngine();
    let result = null;
    if (window.SessionStats) result = SessionStats.session.end();
    this.setPlayButton('play_arrow', 'INICIAR');
    this.setFinalizeVisible(false);
    this.totalTrials = 0;
    document.getElementById('arrowIcon').textContent = 'directions';
    document.getElementById('arrowIcon').style.color = this.getSpeedColor();
    document.getElementById('conflictText').textContent = '';
    if (result && result.summary && result.summary.total >= 5 && window.SessionStatsUI) {
      SessionStatsUI.showResults(result.summary, result.comparison);
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

  startEngine() {
    this.showArrow();
    ScreenWakeLock.request();
    if (!this.scheduler) {
      this.scheduler = new CadenceScheduler(() => this.showArrow(), this.currentSpeed, this.jitter);
    } else {
      this.scheduler.changeInterval(this.currentSpeed);
      this.scheduler.setJitter(this.jitter);
    }
    this.scheduler.start();
  }

  toggleJitter() {
    this.jitter = this.jitter > 0 ? 0 : 0.3;
    if (this.scheduler) this.scheduler.setJitter(this.jitter);
    const btn = document.getElementById('btnJitter');
    if (btn) btn.classList.toggle('active', this.jitter > 0);
  }

  stopEngine() {
    if (this.scheduler) this.scheduler.stop();
    if (window.KinesisTTS) KinesisTTS.cancel();
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

    this.abortSessionIfRunning();
  }

  changeMode(val) {
    this.currentMode = val;
    this.abortSessionIfRunning();
  }

  abortSessionIfRunning() {
    if (this.isPlaying || this.sessionActive) {
      this.stopEngine();
      if (window.SessionStats) SessionStats.session.abort();
      this.isPlaying = false;
      this.sessionActive = false;
      this.setFinalizeVisible(false);
      this.setPlayButton('play_arrow', 'INICIAR');
      document.getElementById('arrowIcon').textContent = 'directions';
      document.getElementById('arrowIcon').style.color = this.getSpeedColor();
      document.getElementById('conflictText').textContent = '';
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

    let targetLabel = null;  // qué decir en voz si modo voz

    if (this.level === 'conflicto') {
      const arrow = this.cardinalDirections[Math.floor(Math.random() * this.cardinalDirections.length)];
      const conflict = this.getConflictDirection(arrow.arrow);
      el.textContent = arrow.arrow;
      conflictEl.textContent = conflict.label;
      // En conflicto se sigue la palabra → la voz dice la palabra
      targetLabel = conflict.label.toLowerCase();
    } else {
      const arrow = this.arrows[Math.floor(Math.random() * this.arrows.length)];
      el.textContent = arrow;
      conflictEl.textContent = '';
      targetLabel = this.directionVoiceLabels[arrow] || arrow;
    }

    el.style.color = this.getSpeedColor();
    this.beep();

    if (this.currentMode === 'voice' && window.KinesisTTS && targetLabel) {
      KinesisTTS.cancel();
      KinesisTTS.speak(targetLabel, 1.3);
    }

    this.totalTrials++;
    if (window.SessionStats && this.sessionActive) {
      SessionStats.session.recordTrial({ stimulus: targetLabel });
    }
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

if (window.SessionStatsUI) {
  SessionStatsUI.init({
    toolId: 'flechas',
    toolName: 'Flechas Reactivas',
    primaryMetric: 'rtMedian',
    onRepeat: () => tool.togglePlay(),
    onClose: () => {}
  });
}
