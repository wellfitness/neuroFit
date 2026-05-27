class NBackTool {
  constructor() {
    this.levels = {
      easy:     { n: 1, matchProb: 0.50, label: '1-Back' },
      medium:   { n: 1, matchProb: 0.35, label: '1-Back+color' },
      hard:     { n: 2, matchProb: 0.45, label: '2-Back', dualFeature: true },
      adaptive: { n: 1, matchProb: 0.28, label: 'Adaptativo', adaptive: true, lures: true, lureProb: 0.28 }
    };
    this.currentLevel = 'easy';
    this.scheduler = null;
    this.isPlaying = false;
    this.sessionActive = false;
    this.currentSpeed = 3000;
    this.jitter = 0;
    this.stimuli = [
      { shape: 'circle', color: '#18f8f6' },
      { shape: 'square', color: '#e11d48' },
      { shape: 'triangle', color: '#eab308' },
      { shape: 'diamond', color: '#3b82f6' },
    ];
    this.shapes = ['circle', 'square', 'triangle', 'diamond'];
    this.colors = ['#18f8f6', '#e11d48', '#eab308', '#3b82f6'];
    this.history = [];
    this.hits = 0;
    this.misses = 0;
    this.falseAlarms = 0;
    this.totalTrials = 0;
    this.responded = false;
    this.isMatch = false;
    this.audioCtx = null;

    // Adaptive Jaeggi state
    this.adaptiveN = 1;
    this.adaptiveMaxN = 1;
    this.blockSize = 20;
    this.blockHits = 0;
    this.blockMisses = 0;
    this.blockFalseAlarms = 0;
    this.blockCorrectInhibitions = 0;
    this.blockTargets = 0;
    this.blockNonTargets = 0;
    this.blockTrialCount = 0;
  }

  get n() {
    if (this.isAdaptive) return this.adaptiveN;
    return this.levels[this.currentLevel].n;
  }
  get matchProbability() { return this.levels[this.currentLevel].matchProb; }
  get lureProbability() { return this.levels[this.currentLevel].lureProb || 0; }
  get hasLures() { return !!this.levels[this.currentLevel].lures; }
  get isAdaptive() { return !!this.levels[this.currentLevel].adaptive; }
  get isDualFeature() { return !!this.levels[this.currentLevel].dualFeature; }

  getAudioCtx() {
    if (!this.audioCtx) this.audioCtx = new (window.AudioContext || window.webkitAudioContext)();
    if (this.audioCtx.state === 'suspended') this.audioCtx.resume();
    return this.audioCtx;
  }

  beep(freq, duration) {
    const ctx = this.getAudioCtx();
    const osc = ctx.createOscillator();
    const gain = ctx.createGain();
    osc.connect(gain);
    gain.connect(ctx.destination);
    osc.frequency.value = freq;
    gain.gain.value = 0.25;
    osc.start();
    gain.gain.exponentialRampToValueAtTime(0.001, ctx.currentTime + duration / 1000);
    osc.stop(ctx.currentTime + duration / 1000);
  }

  togglePlay() {
    if (!this.sessionActive) {
      this.sessionActive = true;
      this.setFinalizeVisible(true);
      this.resetStats();
      this.adaptiveN = 1;
      this.adaptiveMaxN = 1;
      this.resetBlock();
      if (window.SessionStats) {
        SessionStats.session.start('nback', {
          level: this.currentLevel,
          cadence: this.currentSpeed,
          jitter: this.jitter,
          lures: this.hasLures
        });
      }
      this.isPlaying = true;
      this.setPlayButton('pause', 'PAUSA');
      this.applyInstructionText();
      this.startEngine();
    } else if (this.isPlaying) {
      this.isPlaying = false;
      this.setPlayButton('play_arrow', 'REANUDAR');
      this.stopEngine();
      document.getElementById('matchBtn').disabled = true;
    } else {
      this.isPlaying = true;
      this.setPlayButton('pause', 'PAUSA');
      this.startEngine();
    }
  }

  finalize() {
    if (!this.sessionActive) return;
    this.isPlaying = false;
    this.sessionActive = false;
    this.stopEngine();
    document.getElementById('matchBtn').disabled = true;

    let result = null;
    if (window.SessionStats) {
      // En adaptive guardamos también el N máximo alcanzado
      if (this.isAdaptive) {
        // override config con el N máximo y guardar
        result = SessionStats.session.end();
        if (result && result.summary) {
          result.summary.config = result.summary.config || {};
          result.summary.config.maxN = this.adaptiveMaxN;
        }
      } else {
        result = SessionStats.session.end();
      }
    }

    this.setPlayButton('play_arrow', 'INICIAR');
    this.setFinalizeVisible(false);
    this.resetStats();
    this.resetVisual();

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

  toggleJitter() {
    this.jitter = this.jitter > 0 ? 0 : 0.3;
    if (this.scheduler) this.scheduler.setJitter(this.jitter);
    const btn = document.getElementById('btnJitter');
    if (btn) btn.classList.toggle('active', this.jitter > 0);
  }

  startEngine() {
    ScreenWakeLock.request();
    this.showStimulus();
    if (!this.scheduler) {
      this.scheduler = new CadenceScheduler(() => this.evaluateAndNext(), this.currentSpeed, this.jitter);
    } else {
      this.scheduler.changeInterval(this.currentSpeed);
      this.scheduler.setJitter(this.jitter);
    }
    this.scheduler.start();
  }

  stopEngine() {
    ScreenWakeLock.release();
    if (this.scheduler) this.scheduler.stop();
  }

  changeSpeed(ms) {
    this.currentSpeed = parseInt(ms, 10);
    if (this.scheduler) this.scheduler.changeInterval(this.currentSpeed);
  }

  changeLevel(level) {
    this.currentLevel = level;
    this.adaptiveN = 1;
    this.adaptiveMaxN = 1;
    this.applyInstructionText();
    if (this.isPlaying || this.sessionActive) {
      this.stopEngine();
      if (window.SessionStats) SessionStats.session.abort();
      this.isPlaying = false;
      this.sessionActive = false;
      this.setFinalizeVisible(false);
      this.setPlayButton('play_arrow', 'INICIAR');
      document.getElementById('matchBtn').disabled = true;
    }
    this.resetStats();
    this.resetBlock();
    this.renderHistory();
    this.resetVisual();
  }

  applyInstructionText() {
    const instrEl = document.getElementById('nbackInstruction');
    if (!instrEl) return;
    const nStr = String(this.n);
    if (this.isAdaptive) {
      instrEl.innerHTML = '<strong style="color:var(--turquesa-400)">Adaptativo</strong>: forma+color iguales a hace <span class="n-indicator" id="nLabel">' + nStr + '</span> turnos &rarr; COINCIDE';
    } else if (this.isDualFeature) {
      instrEl.innerHTML = 'Si la forma <strong>O</strong> el color coinciden con hace <span class="n-indicator" id="nLabel">' + nStr + '</span> turnos, pulsa COINCIDE';
    } else {
      instrEl.innerHTML = 'Si la forma y color son IGUALES a la de hace <span class="n-indicator" id="nLabel">' + nStr + '</span> turnos, pulsa COINCIDE';
    }
  }

  updateNLabel() {
    const el = document.getElementById('nLabel');
    if (el) el.textContent = String(this.n);
  }

  resetVisual() {
    document.getElementById('shapeDisplay').innerHTML = '';
    document.getElementById('nbackStimulus').style.border = '3px solid var(--gris-600)';
  }

  resetStats() {
    this.history = [];
    this.hits = 0;
    this.misses = 0;
    this.falseAlarms = 0;
    this.totalTrials = 0;
    this.updateStats();
    this.renderHistory();
  }

  resetBlock() {
    this.blockHits = 0;
    this.blockMisses = 0;
    this.blockFalseAlarms = 0;
    this.blockCorrectInhibitions = 0;
    this.blockTargets = 0;
    this.blockNonTargets = 0;
    this.blockTrialCount = 0;
  }

  pickStimulus() {
    const n = this.n;
    const target = this.history.length >= n ? this.history[this.history.length - n] : null;

    if (this.isDualFeature) {
      if (target && Math.random() < this.matchProbability) {
        const matchShape = Math.random() < 0.5;
        if (matchShape) {
          const otherColors = this.colors.filter(c => c !== target.color);
          return { shape: target.shape, color: otherColors[Math.floor(Math.random() * otherColors.length)] };
        } else {
          const otherShapes = this.shapes.filter(s => s !== target.shape);
          return { shape: otherShapes[Math.floor(Math.random() * otherShapes.length)], color: target.color };
        }
      }
      let stim;
      let attempts = 0;
      do {
        stim = {
          shape: this.shapes[Math.floor(Math.random() * this.shapes.length)],
          color: this.colors[Math.floor(Math.random() * this.colors.length)]
        };
        attempts++;
      } while (target && (stim.shape === target.shape || stim.color === target.color) && attempts < 20);
      return stim;
    }

    // 1. Target (coincidencia real en posición N)
    if (target && Math.random() < this.matchProbability) {
      return target;
    }

    // 2. Lure (estímulo familiar — apareció en n±1 — pero NO en posición N).
    //    Test crítico de la WM real vs. respuesta por familiaridad (Weigard 2024).
    if (this.hasLures && target && Math.random() < this.lureProbability) {
      const candidates = [];
      if (n >= 2 && this.history.length >= n - 1) {
        candidates.push(this.history[this.history.length - (n - 1)]);
      }
      if (this.history.length >= n + 1) {
        candidates.push(this.history[this.history.length - (n + 1)]);
      }
      // Sólo válido si el lure NO es igual al target (sino sería target accidental)
      const validLures = candidates.filter(c => c.shape !== target.shape || c.color !== target.color);
      if (validLures.length > 0) {
        return validLures[Math.floor(Math.random() * validLures.length)];
      }
    }

    // 3. Novel (random sin restricciones)
    return this.stimuli[Math.floor(Math.random() * this.stimuli.length)];
  }

  showStimulus() {
    const stim = this.pickStimulus();
    this.history.push(stim);
    this.totalTrials++;
    this.responded = false;

    const curr = this.history[this.history.length - 1];
    const prev = this.history.length > this.n ? this.history[this.history.length - 1 - this.n] : null;
    if (this.isDualFeature) {
      this.isMatch = prev !== null && (curr.shape === prev.shape || curr.color === prev.color);
    } else {
      this.isMatch = prev !== null && curr.shape === prev.shape && curr.color === prev.color;
    }

    this.renderShape(stim);
    this.renderHistory();

    document.getElementById('matchBtn').disabled = false;
    document.getElementById('matchBtn').classList.remove('pressed');

    this.updateStats();
  }

  evaluateAndNext() {
    if (!this.isPlaying) return;

    // Solo contamos para el bloque adaptativo si hay suficiente historia
    // (los primeros N estímulos no pueden ser targets por definición).
    const wasBlockTrial = this.history.length > this.n;

    if (this.isMatch && !this.responded) {
      this.misses++;
      this.showFeedback('miss');
      if (wasBlockTrial) {
        this.blockMisses++;
        this.blockTargets++;
        this.blockTrialCount++;
      }
      this.recordTrial({ stimulus: 'target', correct: false, errorType: 'omission' });
    } else if (!this.isMatch && !this.responded) {
      // Correct inhibition: non-target, no press
      if (wasBlockTrial) {
        this.blockCorrectInhibitions++;
        this.blockNonTargets++;
        this.blockTrialCount++;
      }
      this.recordTrial({ stimulus: 'nontarget', correct: true });
    }

    // Aplicar regla Jaeggi al final de cada bloque
    if (this.isAdaptive && this.blockTrialCount >= this.blockSize) {
      this.applyJaeggiRule();
    }

    this.showStimulus();
    this.updateStats();
  }

  recordTrial(trial) {
    if (window.SessionStats && this.sessionActive) {
      SessionStats.session.recordTrial(trial);
    }
  }

  handleMatch() {
    if (!this.isPlaying || this.responded) return;
    this.responded = true;
    document.getElementById('matchBtn').classList.add('pressed');

    const wasBlockTrial = this.history.length > this.n;

    if (this.isMatch) {
      this.hits++;
      this.beep(880, 80);
      this.showFeedback('hit');
      if (wasBlockTrial) {
        this.blockHits++;
        this.blockTargets++;
        this.blockTrialCount++;
      }
      this.recordTrial({ stimulus: 'target', correct: true });
    } else {
      this.falseAlarms++;
      this.beep(220, 200);
      this.showFeedback('false');
      if (navigator.vibrate) navigator.vibrate(100);
      if (wasBlockTrial) {
        this.blockFalseAlarms++;
        this.blockNonTargets++;
        this.blockTrialCount++;
      }
      this.recordTrial({ stimulus: 'nontarget', correct: false, errorType: 'commission' });
    }

    this.updateStats();
  }

  applyJaeggiRule() {
    // Accuracy = (hits + correct_inhibitions) / total. Umbrales Jaeggi: ≥0.90 sube, ≤0.70 baja.
    const correct = this.blockHits + this.blockCorrectInhibitions;
    const accuracy = this.blockTrialCount > 0 ? correct / this.blockTrialCount : 0;

    let newN = this.adaptiveN;
    let msg = '';
    if (accuracy >= 0.90) {
      newN = this.adaptiveN + 1;
      msg = '¡Subes a ' + newN + '-back!';
    } else if (accuracy <= 0.70) {
      newN = Math.max(1, this.adaptiveN - 1);
      msg = newN === this.adaptiveN ? 'Te mantienes en ' + newN + '-back' : 'Bajas a ' + newN + '-back';
    } else {
      msg = 'Mantienes ' + this.adaptiveN + '-back';
    }

    if (newN !== this.adaptiveN) {
      this.adaptiveN = newN;
      if (newN > this.adaptiveMaxN) this.adaptiveMaxN = newN;
      this.updateNLabel();
      // Recortar historia si el nuevo N es mayor que la historia disponible
      // (no hace falta — pickStimulus maneja el caso target=null)
    }

    this.showBlockTransition(msg, accuracy);
    this.resetBlock();
  }

  showBlockTransition(msg, accuracy) {
    const el = document.getElementById('feedbackFlash');
    if (!el) return;
    el.style.color = 'var(--turquesa-400)';
    el.style.fontSize = '1.4rem';
    el.style.textAlign = 'center';
    el.textContent = msg + ' (' + Math.round(accuracy * 100) + '%)';
    el.classList.add('show');
    setTimeout(() => {
      el.classList.remove('show');
      el.style.fontSize = '';
      el.style.color = '';
      el.style.textAlign = '';
    }, 1500);
  }

  renderShape(stim) {
    const display = document.getElementById('shapeDisplay');
    const container = document.getElementById('nbackStimulus');

    container.style.background = 'var(--gris-800)';
    container.style.border = '3px solid ' + stim.color;

    let svg = '';
    switch (stim.shape) {
      case 'circle':
        svg = '<svg viewBox="0 0 100 100"><circle cx="50" cy="50" r="40" fill="' + stim.color + '"/></svg>';
        break;
      case 'square':
        svg = '<svg viewBox="0 0 100 100"><rect x="15" y="15" width="70" height="70" rx="8" fill="' + stim.color + '"/></svg>';
        break;
      case 'triangle':
        svg = '<svg viewBox="0 0 100 100"><polygon points="50,10 90,85 10,85" fill="' + stim.color + '"/></svg>';
        break;
      case 'diamond':
        svg = '<svg viewBox="0 0 100 100"><polygon points="50,5 95,50 50,95 5,50" fill="' + stim.color + '"/></svg>';
        break;
    }
    display.innerHTML = svg;
  }

  renderHistory() {
    const bar = document.getElementById('historyBar');
    const visible = this.history.slice(-(this.n + 3));
    bar.innerHTML = '';
    visible.forEach((stim, i) => {
      const dot = document.createElement('div');
      dot.className = 'history-dot';
      if (i === visible.length - 1) dot.classList.add('current');
      dot.innerHTML = this.miniSvg(stim);
      bar.appendChild(dot);
    });
  }

  miniSvg(stim) {
    const c = stim.color;
    switch (stim.shape) {
      case 'circle':
        return '<svg viewBox="0 0 40 40"><circle cx="20" cy="20" r="15" fill="' + c + '"/></svg>';
      case 'square':
        return '<svg viewBox="0 0 40 40"><rect x="6" y="6" width="28" height="28" rx="4" fill="' + c + '"/></svg>';
      case 'triangle':
        return '<svg viewBox="0 0 40 40"><polygon points="20,4 36,34 4,34" fill="' + c + '"/></svg>';
      case 'diamond':
        return '<svg viewBox="0 0 40 40"><polygon points="20,2 38,20 20,38 2,20" fill="' + c + '"/></svg>';
      default:
        return '';
    }
  }

  showFeedback(type) {
    const stim = document.getElementById('nbackStimulus');
    if (type === 'hit') {
      stim.style.boxShadow = '0 0 50px rgba(16, 185, 129, 0.6)';
    } else if (type === 'false') {
      stim.style.boxShadow = '0 0 50px rgba(225, 29, 72, 0.6)';
    } else {
      stim.style.boxShadow = '0 0 50px rgba(234, 179, 8, 0.6)';
    }
    setTimeout(() => {
      stim.style.boxShadow = '0 8px 32px rgba(0,0,0,0.4)';
    }, 400);
  }

  updateStats() {
    document.getElementById('statHits').textContent = this.hits;
    document.getElementById('statMisses').textContent = this.misses;
    document.getElementById('statFalse').textContent = this.falseAlarms;
    document.getElementById('statTotal').textContent = this.totalTrials;
  }
}

const tool = new NBackTool();

if (window.SessionStatsUI) {
  SessionStatsUI.init({
    toolId: 'nback',
    toolName: 'N-Back Visual',
    primaryMetric: 'accuracy',
    onRepeat: () => tool.togglePlay(),
    onClose: () => tool.resetVisual()
  });
}
