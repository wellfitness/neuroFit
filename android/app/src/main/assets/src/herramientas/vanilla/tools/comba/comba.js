const BASIC_EXERCISES = [
  'Salto básico', 'Salto alterno', 'Rodillas altas', 
  'Talones atrás', 'Salto lateral', 'Tijeras'
];

const ADVANCED_EXERCISES = [
  'Cruce de brazos', 'Doble salto', 'Salto a una pierna'
];

class CombaTrainerVanilla {
  constructor() {
    this.settings = {
      exerciseCount: 4,
      exerciseDuration: 10,
      includeAdvanced: false
    };

    // State internals
    this.isRunning = false;
    this.trainerState = 'idle'; // idle | preparing | exercising | resting | completed
    this.currentSequence = [];
    this.currentExerciseIndex = 0;
    this.timeRemaining = 0;
    this.sequenceCount = 0;

    // Anti-repetición: últimos ejercicios usados
    this.recentHistory = [];

    // Control promises
    this.activeTimer = null;
    this.abortController = null;

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

  playTone(freq, offset, dur, peakGain = 0.35) {
    const ctx = this.ensureAudioCtx();
    if (!ctx) return;
    const osc = ctx.createOscillator();
    const gain = ctx.createGain();
    osc.type = 'sine';
    osc.frequency.value = freq;
    osc.connect(gain);
    gain.connect(ctx.destination);
    const t = ctx.currentTime + offset;
    gain.gain.setValueAtTime(0.0001, t);
    gain.gain.exponentialRampToValueAtTime(peakGain, t + 0.015);
    gain.gain.exponentialRampToValueAtTime(0.0001, t + dur);
    osc.start(t);
    osc.stop(t + dur + 0.02);
  }

  playCountdownBeep(level) {
    const freqs = { low: 440, mid: 660, high: 880 };
    this.playTone(freqs[level] || 440, 0, 0.18, 0.32);
  }

  playLaunchBeep() {
    this.playTone(880, 0, 0.16);
    this.playTone(1320, 0.18, 0.22);
  }

  playNewSequenceBeep() {
    this.playTone(660, 0, 0.13, 0.32);
    this.playTone(880, 0.14, 0.13, 0.32);
    this.playTone(1100, 0.28, 0.20, 0.32);
  }

  playEndBeep() {
    this.playTone(1320, 0, 0.15, 0.3);
    this.playTone(880, 0.17, 0.18, 0.3);
    this.playTone(660, 0.36, 0.26, 0.3);
  }

  initDOM() {
    // Bind UI inputs
    document.getElementById('exerciseCount').addEventListener('input', (e) => {
      this.settings.exerciseCount = parseInt(e.target.value);
      document.getElementById('lblExCount').textContent = this.settings.exerciseCount;
    });

    document.getElementById('exerciseDuration').addEventListener('input', (e) => {
      this.settings.exerciseDuration = parseInt(e.target.value);
      document.getElementById('lblExDur').textContent = this.settings.exerciseDuration + 's';
    });

    document.getElementById('includeAdvanced').addEventListener('change', (e) => {
      this.settings.includeAdvanced = e.target.checked;
    });
  }

  updateUIState(newState) {
    this.trainerState = newState;
    ['stateIdle', 'statePreparing', 'stateExercising', 'stateResting', 'stateCompleted'].forEach(id => {
      document.getElementById(id).style.display = 'none';
    });
    
    if(newState === 'idle') document.getElementById('stateIdle').style.display = 'flex';
    if(newState === 'preparing') document.getElementById('statePreparing').style.display = 'flex';
    if(newState === 'exercising') document.getElementById('stateExercising').style.display = 'flex';
    if(newState === 'resting') document.getElementById('stateResting').style.display = 'flex';
    if(newState === 'completed') document.getElementById('stateCompleted').style.display = 'flex';
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
    this.sequenceCount = 0;
    KinesisTTS.warmup();
    this.ensureAudioCtx();

    // UI Button Update
    const btn = document.getElementById('btnPlayPause');
    btn.style.backgroundColor = 'var(--gris-700)';
    document.getElementById('playIcon').textContent = 'stop';
    document.getElementById('playText').textContent = 'DETENER';

    // Deshabilitar config
    ['exerciseCount', 'exerciseDuration', 'includeAdvanced'].forEach(id => document.getElementById(id).disabled = true);

    this.runSequenceLoop();
  }

  stopEngine() {
    this.isRunning = false;
    ScreenWakeLock.release();
    this.updateUIState('idle');
    if(this.activeTimer) clearInterval(this.activeTimer);
    KinesisTTS.cancel();
    
    const btn = document.getElementById('btnPlayPause');
    btn.style.backgroundColor = 'var(--turquesa-600)';
    document.getElementById('playIcon').textContent = 'play_arrow';
    document.getElementById('playText').textContent = 'EMPEZAR';

    // Habilitar config
    ['exerciseCount', 'exerciseDuration', 'includeAdvanced'].forEach(id => document.getElementById(id).disabled = false);
  }

  sleep(ms) {
    return new Promise(resolve => {
      if(!this.isRunning) return resolve();
      let timer = setTimeout(() => resolve(), ms);
    });
  }

  speakAndWait(text) {
    if (!this.isRunning) return Promise.resolve();
    return KinesisTTS.speakAndWait(text);
  }

  generateSequence() {
    let pool = [...BASIC_EXERCISES];
    if(this.settings.includeAdvanced) pool = pool.concat(ADVANCED_EXERCISES);

    const count = Math.min(this.settings.exerciseCount, pool.length);
    const result = [];
    for (let i = 0; i < count; i++) {
      let available = pool.filter(e => !this.recentHistory.includes(e) && !result.includes(e));
      if (available.length === 0) {
        available = pool.filter(e => !result.includes(e));
      }
      if (available.length === 0) break;
      const pick = available[Math.floor(Math.random() * available.length)];
      result.push(pick);
    }
    this.recentHistory.push(...result);
    const minGap = 4;
    if (this.recentHistory.length > pool.length - minGap) {
      this.recentHistory = this.recentHistory.slice(-minGap);
    }
    return result;
  }

  runExerciseTimer(duration) {
    return new Promise((resolve) => {
      const endAt = performance.now() + duration * 1000;
      let lastBeepedSecond = duration + 1;
      this.timeRemaining = duration;
      this.updateTimerUI();

      this.activeTimer = setInterval(() => {
        if (!this.isRunning) {
          clearInterval(this.activeTimer);
          return resolve();
        }
        const remaining = Math.max(0, Math.ceil((endAt - performance.now()) / 1000));
        this.timeRemaining = remaining;
        this.updateTimerUI();
        if (remaining < lastBeepedSecond && remaining >= 1 && remaining <= 3) {
          const level = remaining === 3 ? 'low' : remaining === 2 ? 'mid' : 'high';
          this.playCountdownBeep(level);
          lastBeepedSecond = remaining;
        }
        if (remaining <= 0) {
          clearInterval(this.activeTimer);
          resolve();
        }
      }, 1000);
    });
  }

  updateTimerUI() {
    const lbl = document.getElementById('lblCountdown');
    const circle = document.getElementById('countdownCircle');
    lbl.textContent = this.timeRemaining;

    if(this.timeRemaining <= 3 && this.timeRemaining > 0) {
      circle.classList.add('pulsing');
      lbl.style.color = 'var(--rosa-600)';
    } else {
      circle.classList.remove('pulsing');
      lbl.style.color = 'white';
    }
  }

  renderSequenceUI() {
    const container = document.getElementById('sequenceList');
    container.innerHTML = '';
    this.currentSequence.forEach((ex, i) => {
      let activeClass = '';
      if(i === this.currentExerciseIndex) activeClass = 'active';
      container.innerHTML += `<span class="seq-badge ${activeClass}">${ex}</span>`;
    });
  }

  async runSequenceLoop() {
    // Inicio único de la sesión
    this.updateUIState('preparing');
    document.getElementById('lblSequenceCount').textContent = `Secuencia #1`;
    await this.speakAndWait('Prepárate');
    if(!this.isRunning) return;
    await this.sleep(800);
    if(!this.isRunning) return;

    while(this.isRunning) {
      this.currentSequence = this.generateSequence();
      this.sequenceCount++;

      // Pantalla preparing + sonido distintivo a partir de la 2ª secuencia
      if (this.sequenceCount > 1) {
        this.updateUIState('preparing');
        document.getElementById('lblSequenceCount').textContent = `Secuencia #${this.sequenceCount}`;
        this.playNewSequenceBeep();
        await this.sleep(900);
        if(!this.isRunning) break;
      } else {
        this.playLaunchBeep();
        await this.sleep(500);
        if(!this.isRunning) break;
      }

      for(let i = 0; i < this.currentSequence.length; i++) {
        if(!this.isRunning) break;

        this.currentExerciseIndex = i;
        this.updateUIState('exercising');
        
        document.getElementById('lblExerciseIndex').textContent = `Ejercicio ${i+1} de ${this.currentSequence.length}`;
        document.getElementById('lblCurrentExercise').textContent = this.currentSequence[i];
        this.renderSequenceUI();

        await this.speakAndWait(this.currentSequence[i]);
        if(!this.isRunning) break;

        await this.runExerciseTimer(this.settings.exerciseDuration);
        if(!this.isRunning) break;

        if(i < this.currentSequence.length - 1) {
          this.updateUIState('resting');
          this.playLaunchBeep();
          if(!this.isRunning) break;
          await this.sleep(1500);
        }
      }

      if(!this.isRunning) break;

      // Completed
      this.updateUIState('completed');
      this.playEndBeep();
      if(!this.isRunning) break;

      await this.sleep(5000); // Descanso de bloque
    }
  }
}

const tool = new CombaTrainerVanilla();
