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
    this.sessionActive = false;
    this.currentSpeed = 3000;
    this.jitter = 0;
    this.rounds = 0;
    this.minPerColor = 2;
    this.colorCounts = [0, 0, 0, 0];
    this.learningDone = false;
    this.level = 2;
    this.currentMode = 'visual';
    this.audioCtx = null;
    // Modo Bérubé: bloques alternantes baseline (level 2) / ejecutivo (level 3) cada 60s
    this.berubeBlockMs = 60000;
    this.berubeBlockLevel = 2;
    this.berubeBlockStartedAt = 0;
    this.berubeBlockCount = 0;
    this.berubeBaselineRounds = 0;
    this.berubeExecutiveRounds = 0;
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
    const btn = document.getElementById('btnPlayPause');
    if (!this.sessionActive) {
      this.sessionActive = true;
      this.setFinalizeVisible(true);
      this.rounds = 0;
      this.colorCounts = [0, 0, 0, 0];
      this.learningDone = false;
      document.getElementById('statRounds').textContent = '0';
      this.berubeBlockStartedAt = 0;
      this.berubeBlockLevel = 2;
      this.berubeBlockCount = 0;
      this.berubeBaselineRounds = 0;
      this.berubeExecutiveRounds = 0;
      if (window.SessionStats) {
        SessionStats.session.start('colores', {
          level: this.level,
          cadence: this.currentSpeed,
          mode: this.currentMode === 'voice' ? 'voice' : 'visual',
          jitter: this.jitter,
          berube: this.level === 4,
          actions: this.coloresData.map(c => c.action)
        });
      }
      if (this.currentMode === 'voice' && window.KinesisTTS) KinesisTTS.warmup();
      this.isPlaying = true;
      btn.classList.add('active');
      this.setPlayButton('pause', 'PAUSA');
      this.updateIntro();
      this.startEngine();
    } else if (this.isPlaying) {
      this.isPlaying = false;
      btn.classList.remove('active');
      this.setPlayButton('play_arrow', 'REANUDAR');
      this.stopEngine();
      this.updateIntro();
    } else {
      this.isPlaying = true;
      btn.classList.add('active');
      this.setPlayButton('pause', 'PAUSA');
      this.updateIntro();
      this.startEngine();
    }
  }

  finalize() {
    if (!this.sessionActive) return;
    const btn = document.getElementById('btnPlayPause');
    this.isPlaying = false;
    this.sessionActive = false;
    this.stopEngine();
    btn.classList.remove('active');
    let result = null;
    let customFeedback = null;
    if (window.SessionStats) {
      result = SessionStats.session.end();
      if (this.level === 4 && result && result.summary) {
        const base = this.berubeBaselineRounds;
        const exec = this.berubeExecutiveRounds;
        const diff = base - exec;  // diferencia rondas baseline - ejecutivo (proxy del coste de interferencia)
        result.summary.config = result.summary.config || {};
        result.summary.config.baselineRounds = base;
        result.summary.config.executiveRounds = exec;
        result.summary.config.interferenceCost = diff;
        if (base > 0 && exec > 0) {
          customFeedback = `Baseline: ${base} rondas · Ejecutivo: ${exec} rondas · El Stroop te ralentizó ${diff} estímulos por minuto`;
        } else {
          customFeedback = `Sesión corta — completa al menos un ciclo (2 min) para ver coste de interferencia`;
        }
      }
    }
    this.setPlayButton('play_arrow', 'INICIAR');
    this.setFinalizeVisible(false);
    this.rounds = 0;
    this.colorCounts = [0, 0, 0, 0];
    this.learningDone = false;
    this.berubeBlockStartedAt = 0;
    this.berubeBlockLevel = 2;
    this.berubeBlockCount = 0;
    this.berubeBaselineRounds = 0;
    this.berubeExecutiveRounds = 0;
    document.getElementById('statRounds').textContent = '0';
    this.updateIntro();
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

  abortSessionIfRunning() {
    if (this.isPlaying || this.sessionActive) {
      this.stopEngine();
      if (window.SessionStats) SessionStats.session.abort();
      this.isPlaying = false;
      this.sessionActive = false;
      this.setFinalizeVisible(false);
      this.setPlayButton('play_arrow', 'INICIAR');
      document.getElementById('btnPlayPause').classList.remove('active');
      this.updateIntro();
    }
  }

  changeMode(val) {
    this.currentMode = val;
    this.abortSessionIfRunning();
  }

  startEngine() {
    this.runColores();
    ScreenWakeLock.request();
    if (!this.scheduler) {
      this.scheduler = new CadenceScheduler(() => this.runColores(), this.currentSpeed, this.jitter);
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
    ScreenWakeLock.release();
  }

  changeSpeed(ms) {
    this.currentSpeed = parseInt(ms, 10);
    if (this.scheduler) this.scheduler.changeInterval(this.currentSpeed);
  }

  changeLevel(val) {
    this.level = parseInt(val, 10);
    const legend = document.getElementById('coloresLegend');
    // Leyenda visible cuando hay acciones (levels 2, 3, 4). Niveles 1 y 5 son Stroop puro
    if (legend) legend.style.display = (this.level === 1 || this.level === 5) ? 'none' : '';
    const textEl = document.getElementById('coloresText');
    // El level 2 oculta texto; level 4 (Bérubé) lo gestiona por bloque (no fijar aquí)
    if (textEl) textEl.style.display = this.level === 2 ? 'none' : '';
    this.updateIntro();
    this.abortSessionIfRunning();
  }

  effectiveLevel() {
    return this.level === 4 ? this.berubeBlockLevel : this.level;
  }

  maybeRotateBerubeBlock() {
    if (this.level !== 4) return;
    const now = Date.now();
    if (!this.berubeBlockStartedAt) {
      this.berubeBlockStartedAt = now;
      this.berubeBlockLevel = 2;  // empieza en baseline
      this.berubeBlockCount = 1;
      this.showBerubeBanner('Bloque BASELINE · solo color + acción', 'var(--turquesa-400)');
      return;
    }
    if (now - this.berubeBlockStartedAt >= this.berubeBlockMs) {
      this.berubeBlockLevel = this.berubeBlockLevel === 2 ? 3 : 2;
      this.berubeBlockStartedAt = now;
      this.berubeBlockCount++;
      if (this.berubeBlockLevel === 3) {
        this.showBerubeBanner('Bloque EJECUTIVO · ignora la palabra · sigue el color', 'var(--tulip-tree-400)');
      } else {
        this.showBerubeBanner('Bloque BASELINE · solo color + acción', 'var(--turquesa-400)');
      }
    }
  }

  showBerubeBanner(text, color) {
    const intro = document.getElementById('coloresIntro');
    if (!intro) return;
    intro.innerHTML = text;
    intro.style.color = color || 'white';
    intro.style.display = '';
    intro.style.zIndex = '10';
    intro.style.position = 'relative';
    setTimeout(() => {
      if (this.isPlaying && this.level === 4) intro.style.display = 'none';
    }, 1800);
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
    } else if (this.level === 5) {
      intro.innerHTML = 'Ignora el fondo<br>Di la PALABRA escrita';
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
    // Rotar bloque Bérubé si toca
    this.maybeRotateBerubeBlock();
    const effLevel = this.effectiveLevel();

    const colorIndex = Math.floor(Math.random() * this.coloresData.length);
    this.tick();
    const col = this.coloresData[colorIndex];
    const bg = document.getElementById('stimulus-colores');
    const textEl = document.getElementById('coloresText');
    const actionEl = document.getElementById('coloresAction');

    bg.style.backgroundColor = col.hex;

    // En levels 1 y 3 (Stroop normal/inversa visualmente), texto es distractor (color distinto al fondo).
    // En level 5 (Stroop inverso), texto distractor sigue siendo distinto al fondo PERO ese texto ES el target.
    let distractorIndex = null;
    if (effLevel === 1 || effLevel === 3 || effLevel === 5) {
      distractorIndex = this.pickDistractorIndex(colorIndex);
      textEl.textContent = this.coloresData[distractorIndex].name;
      textEl.style.display = '';
    } else {
      textEl.style.display = 'none';
    }

    this.rounds++;
    this.colorCounts[colorIndex]++;
    document.getElementById('statRounds').textContent = this.rounds;

    // Tracking por bloque Bérubé
    if (this.level === 4) {
      if (this.berubeBlockLevel === 2) this.berubeBaselineRounds++;
      else this.berubeExecutiveRounds++;
    }

    if (effLevel === 1 || effLevel === 5) {
      // Niveles Stroop puros (sin acción asignada al color)
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

    // Modo voz: en niveles 1-4 anuncia el COLOR DE FONDO (lo que se sigue).
    // En level 5 (Stroop inverso) anuncia la PALABRA escrita (lo que se sigue ahí).
    if (this.currentMode === 'voice' && window.KinesisTTS) {
      KinesisTTS.cancel();
      const spoken = (effLevel === 5 && distractorIndex != null)
        ? this.coloresData[distractorIndex].name.toLowerCase()
        : col.name.toLowerCase();
      KinesisTTS.speak(spoken, 1.3);
    }

    if (window.SessionStats && this.sessionActive) {
      SessionStats.session.recordTrial({
        stimulus: effLevel === 5 && distractorIndex != null
          ? this.coloresData[distractorIndex].name
          : col.name,
        bgColor: col.name,
        block: this.level === 4 ? (this.berubeBlockLevel === 2 ? 'baseline' : 'ejecutivo') : null
      });
    }
  }

  pickDistractorIndex(excludeIndex) {
    let idx;
    do { idx = Math.floor(Math.random() * this.coloresData.length); }
    while (idx === excludeIndex);
    return idx;
  }
}

const tool = new ColoresTool();

if (window.SessionStatsUI) {
  SessionStatsUI.init({
    toolId: 'colores',
    toolName: 'Colores Reactivos',
    primaryMetric: 'rtMedian',
    onRepeat: () => tool.togglePlay(),
    onClose: () => {}
  });
}
