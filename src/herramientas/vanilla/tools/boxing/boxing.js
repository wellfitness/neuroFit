const PUNCHES = [
  'Directo', 'Cruzado',
  'Gancho bajo izquierdo', 'Gancho bajo derecho',
  'Gancho alto izquierdo', 'Gancho alto derecho',
  'Crochet izquierdo', 'Crochet derecho'
];

const DEFENSIVE = [
  'Esquiva', 'Bloqueo', 'Paso atrás', 'Agacharse', 'Paso lateral'
];

class BoxingGeneratorVanilla {
  constructor() {
    this.settings = {
      punchCount: 4,
      includeDefensive: false,
      speechRate: 1.0
    };

    // State internals
    this.isRunning = false;
    this.currentCombo = [];
    this.currentIndex = -1;
    this.comboCount = 0;

    this.audioCtx = null;

    this.initDOM();
  }

  ensureAudioCtx() {
    if (this.audioCtx) {
      if (this.audioCtx.state === 'suspended') this.audioCtx.resume();
      return this.audioCtx;
    }
    const Ctx = window.AudioContext || window.webkitAudioContext;
    if (!Ctx) return null;
    this.audioCtx = new Ctx();
    return this.audioCtx;
  }

  playReadyBeep() {
    const ctx = this.ensureAudioCtx();
    if (!ctx) return;
    const tone = (freq, offset, dur) => {
      const osc = ctx.createOscillator();
      const gain = ctx.createGain();
      osc.type = 'sine';
      osc.frequency.value = freq;
      osc.connect(gain);
      gain.connect(ctx.destination);
      const t = ctx.currentTime + offset;
      gain.gain.setValueAtTime(0.0001, t);
      gain.gain.exponentialRampToValueAtTime(0.35, t + 0.015);
      gain.gain.exponentialRampToValueAtTime(0.0001, t + dur);
      osc.start(t);
      osc.stop(t + dur + 0.02);
    };
    tone(880, 0, 0.16);
    tone(1320, 0.18, 0.22);
  }

  initDOM() {
    // Bind UI inputs
    document.getElementById('punchCount').addEventListener('input', (e) => {
      this.settings.punchCount = parseInt(e.target.value);
      document.getElementById('lblPunch').textContent = this.settings.punchCount;
    });

    document.getElementById('speechRate').addEventListener('input', (e) => {
      this.settings.speechRate = parseFloat(e.target.value);
      document.getElementById('lblSpeech').textContent = this.settings.speechRate.toFixed(1) + 'x';
    });

    document.getElementById('includeDefensive').addEventListener('change', (e) => {
      this.settings.includeDefensive = e.target.checked;
    });
  }

  handleStartStop() {
    if(this.isRunning) {
      this.stopEngine();
    } else {
      this.startEngine();
    }
  }

  startEngine() {
    this.isRunning = true;
    ScreenWakeLock.request();
    this.comboCount = 0;
    KinesisTTS.warmup();
    this.ensureAudioCtx();

    // UI Button Update
    const btn = document.getElementById('btnPlayPause');
    btn.style.backgroundColor = 'var(--gris-700)';
    document.getElementById('playIcon').textContent = 'stop';
    document.getElementById('playText').textContent = 'DETENER';
    
    // Deshabilitar config
    ['punchCount', 'speechRate', 'includeDefensive'].forEach(id => document.getElementById(id).disabled = true);

    document.getElementById('stateIdle').style.display = 'none';

    this.runCombosLoop();
  }

  stopEngine() {
    this.isRunning = false;
    ScreenWakeLock.release();

    document.getElementById('stateIdle').style.display = 'flex';
    document.getElementById('stateCombos').style.display = 'none';
    document.getElementById('statePreparing').style.display = 'none';

    KinesisTTS.cancel();
    
    const btn = document.getElementById('btnPlayPause');
    btn.style.backgroundColor = 'var(--rosa-600)';
    document.getElementById('playIcon').textContent = 'play_arrow';
    document.getElementById('playText').textContent = 'EMPEZAR';

    // Habilitar config
    ['punchCount', 'speechRate', 'includeDefensive'].forEach(id => document.getElementById(id).disabled = false);
  }

  sleep(ms) {
    return new Promise(resolve => {
      if(!this.isRunning) return resolve();
      setTimeout(resolve, ms);
    });
  }

  speakAndWait(text) {
    if (!this.isRunning) return Promise.resolve();
    return KinesisTTS.speakAndWait(text, this.settings.speechRate);
  }

  generateCombo() {
    const total = this.settings.punchCount;

    if(!this.settings.includeDefensive) {
      return this.pickMoves(PUNCHES, total);
    }

    const maxDef = Math.floor(total * 0.3);
    const defCount = 1 + Math.floor(Math.random() * maxDef);
    const offCount = total - defCount;

    const offMoves = this.pickMoves(PUNCHES, offCount);
    const defMoves = this.pickMoves(DEFENSIVE, defCount);

    const combo = [...offMoves];
    for(const d of defMoves) {
      const pos = 1 + Math.floor(Math.random() * (combo.length - 1));
      combo.splice(pos, 0, d);
    }
    return combo;
  }

  punchType(move) {
    if (move.startsWith('Gancho bajo')) return 'gancho-bajo';
    if (move.startsWith('Gancho alto')) return 'gancho-alto';
    if (move.startsWith('Crochet')) return 'crochet';
    return move.toLowerCase();
  }

  pickMoves(pool, count) {
    const result = [];
    let lastType = null;
    const isShortCombo = count <= 4;
    let ganchoUsed = false;

    for (let i = 0; i < count; i++) {
      let available = pool.filter(m => this.punchType(m) !== lastType);
      if (isShortCombo && ganchoUsed) {
        available = available.filter(m => {
          const t = this.punchType(m);
          return t !== 'gancho-bajo' && t !== 'gancho-alto';
        });
      }
      if (available.length === 0) available = pool.filter(m => this.punchType(m) !== lastType);
      if (available.length === 0) break;
      const pick = available[Math.floor(Math.random() * available.length)];
      result.push(pick);
      lastType = this.punchType(pick);
      if (lastType === 'gancho-bajo' || lastType === 'gancho-alto') ganchoUsed = true;
    }
    return result;
  }

  renderComboUI() {
    const total = this.currentCombo.length;
    const current = this.currentCombo[this.currentIndex] || '—';
    const next = this.currentCombo[this.currentIndex + 1];

    document.getElementById('currentPunch').textContent = current;

    const nextEl = document.getElementById('nextPunch');
    if (next) {
      nextEl.innerHTML = `<span class="next-label">SIGUIENTE →</span> <span class="next-value">${next}</span>`;
    } else {
      nextEl.innerHTML = '<span class="next-label">ÚLTIMO GOLPE</span>';
    }

    document.getElementById('lblProgress').innerHTML =
      `Combinación <strong>#${this.comboCount}</strong> · <strong>${this.currentIndex + 1} / ${total}</strong>`;

    // Re-trigger pulse animation en cada golpe
    const cur = document.getElementById('currentPunch');
    cur.style.animation = 'none';
    void cur.offsetWidth;
    cur.style.animation = '';
  }

  showPreparing(comboNum) {
    document.getElementById('stateCombos').style.display = 'none';
    document.getElementById('statePreparing').style.display = 'flex';
    document.getElementById('lblPrepCombo').textContent = `Combinación #${comboNum}`;
  }

  showCombos() {
    document.getElementById('statePreparing').style.display = 'none';
    document.getElementById('stateCombos').style.display = 'flex';
  }

  async runCombosLoop() {
    this.showPreparing(1);
    await this.speakAndWait('Prepárate');
    if(!this.isRunning) return;
    await this.sleep(400);
    if(!this.isRunning) return;

    while(this.isRunning) {
      this.currentCombo = this.generateCombo();
      this.comboCount++;

      this.showPreparing(this.comboCount);
      this.playReadyBeep();
      await this.sleep(900);
      if(!this.isRunning) break;

      this.showCombos();

      for(let i = 0; i < this.currentCombo.length; i++) {
        if(!this.isRunning) break;

        this.currentIndex = i;
        this.renderComboUI();

        const t0 = performance.now();
        await this.speakAndWait(this.currentCombo[i]);
        if(!this.isRunning) break;

        const minPerPunch = 2000 / this.settings.speechRate;
        const elapsed = performance.now() - t0;
        const extra = Math.max(300, minPerPunch - elapsed);
        await this.sleep(extra);
      }

      if(!this.isRunning) break;
    }
  }
}

const tool = new BoxingGeneratorVanilla();
