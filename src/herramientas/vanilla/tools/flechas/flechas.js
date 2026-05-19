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
    let customFeedback = null;
    if (window.SessionStats) {
      result = SessionStats.session.end();
      // Si nivel mezcla, mostrar distribución real de condiciones
      if (this.level === 'mezcla' && result && result.summary) {
        const trials = (result.summary && result.summary.config) ? null : null;
        // No tenemos acceso directo a trials desde aquí, pero podemos usar this.totalTrials
        // y suponer la distribución teórica 60/20/20.
        customFeedback = `Mezcla 60/20/20 · ${result.summary.total} estímulos repartidos entre congruente / incongruente / neutral`;
      }
    }
    this.setPlayButton('play_arrow', 'INICIAR');
    this.setFinalizeVisible(false);
    this.totalTrials = 0;
    document.getElementById('arrowIcon').textContent = 'directions';
    document.getElementById('arrowIcon').style.color = this.getSpeedColor();
    document.getElementById('conflictText').textContent = '';
    if (result && result.summary && result.summary.total >= 5 && window.SessionStatsUI) {
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
    } else if (val === 'mezcla') {
      conflictEl.style.display = 'none';
      instructionEl.innerHTML = 'Si aparece palabra: sigue la <strong style="color: var(--rosa-400)">PALABRA</strong>. Si no: sigue la flecha';
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

  // En nivel "mezcla", selecciona condición según ratio 60/20/20.
  pickMixedCondition() {
    const r = Math.random();
    if (r < 0.6) return 'congruent';   // 60% — flecha + palabra coinciden
    if (r < 0.8) return 'incongruent'; // 20% — flecha + palabra opuestas
    return 'neutral';                  // 20% — solo flecha (sin palabra)
  }

  showArrow() {
    const el = document.getElementById('arrowIcon');
    const conflictEl = document.getElementById('conflictText');

    el.classList.remove('flash');
    void el.offsetWidth;
    el.classList.add('flash');

    let targetLabel = null;  // qué decir en voz si modo voz
    let condition = null;    // para logging en mezcla

    if (this.level === 'conflicto') {
      const arrow = this.cardinalDirections[Math.floor(Math.random() * this.cardinalDirections.length)];
      const conflict = this.getConflictDirection(arrow.arrow);
      el.textContent = arrow.arrow;
      conflictEl.style.display = '';
      conflictEl.textContent = conflict.label;
      // En conflicto se sigue la palabra → la voz dice la palabra
      targetLabel = conflict.label.toLowerCase();
      condition = 'incongruent';
    } else if (this.level === 'mezcla') {
      condition = this.pickMixedCondition();
      const arrow = this.cardinalDirections[Math.floor(Math.random() * this.cardinalDirections.length)];
      el.textContent = arrow.arrow;
      if (condition === 'neutral') {
        conflictEl.style.display = 'none';
        conflictEl.textContent = '';
        targetLabel = arrow.label.toLowerCase();
      } else if (condition === 'congruent') {
        conflictEl.style.display = '';
        conflictEl.textContent = arrow.label;
        targetLabel = arrow.label.toLowerCase();
      } else {
        // incongruent: palabra distinta a flecha. Cliente sigue la palabra.
        const conflict = this.getConflictDirection(arrow.arrow);
        conflictEl.style.display = '';
        conflictEl.textContent = conflict.label;
        targetLabel = conflict.label.toLowerCase();
      }
    } else {
      const arrow = this.arrows[Math.floor(Math.random() * this.arrows.length)];
      el.textContent = arrow;
      conflictEl.style.display = 'none';
      conflictEl.textContent = '';
      targetLabel = this.directionVoiceLabels[arrow] || arrow;
      condition = 'normal';
    }

    el.style.color = this.getSpeedColor();
    this.beep();

    if (this.currentMode === 'voice' && window.KinesisTTS && targetLabel) {
      KinesisTTS.cancel();
      KinesisTTS.speak(targetLabel, 1.3);
    }

    this.totalTrials++;
    if (window.SessionStats && this.sessionActive) {
      SessionStats.session.recordTrial({ stimulus: targetLabel, condition });
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
