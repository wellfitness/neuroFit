class SortTool {
  constructor() {
    this.currentLevel = 'easy';
    this.isPlaying = false;
    this.currentSpeed = 3000;
    this.phase = 'idle';
    this.timer = null;
    this.currentItems = [];
    this.displayedAscending = false;
    this.roundStart = 0;
    this.hits = 0;
    this.misses = 0;
    this.rounds = 0;
    this.rtSum = 0;
    this.rtCount = 0;
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

  changeLevel(level) {
    this.currentLevel = level;
    if (this.isPlaying) {
      this.stopEngine();
      this.isPlaying = false;
      document.getElementById('btnPlayPause').classList.remove('active');
      document.getElementById('playIcon').textContent = 'play_arrow';
      document.getElementById('playText').textContent = 'INICIAR';
    }
    this.resetStats();
    this.showIdle();
  }

  changeSpeed(ms) {
    this.currentSpeed = parseInt(ms, 10);
  }

  togglePlay() {
    this.isPlaying = !this.isPlaying;
    const btn = document.getElementById('btnPlayPause');
    if (this.isPlaying) {
      btn.classList.add('active');
      document.getElementById('playIcon').textContent = 'pause';
      document.getElementById('playText').textContent = 'PAUSA';
      ScreenWakeLock.request();
      this.startRound();
    } else {
      btn.classList.remove('active');
      document.getElementById('playIcon').textContent = 'play_arrow';
      document.getElementById('playText').textContent = 'REANUDAR';
      this.stopEngine();
      ScreenWakeLock.release();
    }
  }

  stopEngine() {
    if (this.timer) { clearTimeout(this.timer); this.timer = null; }
  }

  resetStats() {
    this.hits = 0;
    this.misses = 0;
    this.rounds = 0;
    this.rtSum = 0;
    this.rtCount = 0;
    this.updateStats();
  }

  generateEasy() {
    const nums = [];
    while (nums.length < 3) {
      const r = Math.floor(Math.random() * 90) + 10;
      if (!nums.includes(r)) nums.push(r);
    }
    return nums.map(n => ({ display: String(n), value: n }));
  }

  generateMedium() {
    const items = [];
    const usedValues = [];
    while (items.length < 3) {
      const isSum = Math.random() < 0.5;
      let a, b, value;
      if (isSum) {
        a = Math.floor(Math.random() * 25) + 5;
        b = Math.floor(Math.random() * 15) + 1;
        value = a + b;
      } else {
        a = Math.floor(Math.random() * 25) + 15;
        b = Math.floor(Math.random() * 12) + 1;
        value = a - b;
      }
      if (usedValues.includes(value)) continue;
      usedValues.push(value);
      items.push({ display: a + (isSum ? ' + ' : ' - ') + b, value });
    }
    return items;
  }

  generateHard() {
    const items = [];
    const usedValues = [];
    while (items.length < 3) {
      const a = Math.floor(Math.random() * 8) + 2;
      const b = Math.floor(Math.random() * 8) + 2;
      const value = a * b;
      if (usedValues.includes(value)) continue;
      usedValues.push(value);
      items.push({ display: a + ' x ' + b, value });
    }
    return items;
  }

  generateItems() {
    switch (this.currentLevel) {
      case 'medium': return this.generateMedium();
      case 'hard': return this.generateHard();
      default: return this.generateEasy();
    }
  }

  showIdle() {
    this.phase = 'idle';
    document.getElementById('memPhase').style.display = '';
    document.getElementById('questionPhase').style.display = 'none';
    document.getElementById('feedbackPhase').style.display = 'none';
    document.getElementById('feedbackIcon').style.display = 'none';
    const els = document.querySelectorAll('.sort-item');
    els.forEach(el => { el.textContent = '--'; });
    document.getElementById('sortInstruction').textContent =
      this.currentLevel === 'easy'
        ? 'Memoriza los números'
        : 'Calcula y memoriza los resultados';
    this.setBtnState(false);
  }

  startRound() {
    if (!this.isPlaying) return;
    this.phase = 'memorize';
    this.currentItems = this.generateItems();

    // 50% de las veces se muestran en orden ascendente, 50% desordenados
    this.displayedAscending = Math.random() < 0.5;

    let displayed;
    if (this.displayedAscending) {
      displayed = [...this.currentItems].sort((a, b) => a.value - b.value);
    } else {
      // Barajar hasta que NO estén en orden ascendente
      displayed = [...this.currentItems];
      do {
        for (let i = displayed.length - 1; i > 0; i--) {
          const j = Math.floor(Math.random() * (i + 1));
          [displayed[i], displayed[j]] = [displayed[j], displayed[i]];
        }
      } while (this.isAscending(displayed));
    }

    document.getElementById('memPhase').style.display = '';
    document.getElementById('questionPhase').style.display = 'none';
    document.getElementById('feedbackPhase').style.display = 'none';
    document.getElementById('feedbackIcon').style.display = 'none';

    document.getElementById('sort-0').textContent = displayed[0].display;
    document.getElementById('sort-1').textContent = displayed[1].display;
    document.getElementById('sort-2').textContent = displayed[2].display;

    document.getElementById('sortInstruction').textContent =
      this.currentLevel === 'easy' ? 'Memoriza...' : 'Calcula y memoriza...';

    this.beep(600, 60);
    this.setBtnState(false);

    this.timer = setTimeout(() => this.showBlank(), this.currentSpeed);
  }

  isAscending(items) {
    for (let i = 1; i < items.length; i++) {
      if (items[i].value <= items[i - 1].value) return false;
    }
    return true;
  }

  showBlank() {
    if (!this.isPlaying) return;
    this.phase = 'blank';
    document.getElementById('memPhase').style.display = 'none';
    document.getElementById('questionPhase').style.display = 'none';
    document.getElementById('feedbackPhase').style.display = 'none';
    document.getElementById('sortInstruction').textContent = '¡Recuerda!';
    this.timer = setTimeout(() => this.showQuestion(), 1000);
  }

  showQuestion() {
    if (!this.isPlaying) return;
    this.phase = 'decide';

    // Solo mostrar la pregunta y los botones — SIN números
    document.getElementById('memPhase').style.display = 'none';
    document.getElementById('feedbackPhase').style.display = 'none';
    document.getElementById('questionPhase').style.display = '';

    document.getElementById('sortInstruction').textContent = '¿Estaban de menor a mayor?';
    this.setBtnState(true);
    this.roundStart = performance.now();
  }

  handleAnswer(answer) {
    if (this.phase !== 'decide') return;
    this.phase = 'feedback';
    this.setBtnState(false);

    const rt = performance.now() - this.roundStart;
    const correct = (answer === 'true') === this.displayedAscending;

    this.rounds++;
    if (correct) {
      this.hits++;
      this.rtSum += rt;
      this.rtCount++;
    } else {
      this.misses++;
    }

    this.showFeedback(correct);
    this.updateStats();

    this.timer = setTimeout(() => this.startRound(), correct ? 1200 : 2500);
  }

  showFeedback(correct) {
    const icon = document.getElementById('feedbackIcon');
    icon.style.display = '';
    document.getElementById('questionPhase').style.display = 'none';

    if (correct) {
      icon.textContent = 'check_circle';
      icon.style.color = '#10b981';
      document.getElementById('feedbackPhase').style.display = 'none';
    } else {
      icon.textContent = 'cancel';
      icon.style.color = 'var(--rosa-400)';
      this.showCorrectOrder();
    }
    this.beep(correct ? 800 : 300, 120);
  }

  showCorrectOrder() {
    const sorted = [...this.currentItems].sort((a, b) => a.value - b.value);
    document.getElementById('sortInstruction').textContent = 'Orden correcto:';
    document.getElementById('feedbackPhase').style.display = '';
    document.getElementById('fb-0').textContent = sorted[0].value;
    document.getElementById('fb-1').textContent = sorted[1].value;
    document.getElementById('fb-2').textContent = sorted[2].value;
  }

  setBtnState(enabled) {
    document.getElementById('btnTrue').disabled = !enabled;
    document.getElementById('btnFalse').disabled = !enabled;
    document.getElementById('answerBtns').style.display = enabled ? '' : 'none';
  }

  updateStats() {
    document.getElementById('statHits').textContent = this.hits;
    document.getElementById('statMisses').textContent = this.misses;
    document.getElementById('statRounds').textContent = this.rounds;
    const avgRt = this.rtCount > 0 ? Math.round(this.rtSum / this.rtCount) : '--';
    document.getElementById('statRT').textContent = avgRt === '--' ? '--' : avgRt + 'ms';
  }
}

const tool = new SortTool();
