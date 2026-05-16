class MatrixTool {
  constructor() {
    this.levels = {
      '3': { size: 3, count: 3 },
      '4': { size: 4, count: 4 },
      '5': { size: 5, count: 5 }
    };
    this.currentLevel = '3';
    this.orderedMode = false;
    this.scheduler = null;
    this.pendingRestart = null;
    this.isPlaying = false;
    this.currentSpeed = 6000;
    this.hideTimeout = null;
    this.activeCells = [];
    this.playerSelection = [];
    this.phase = 'idle';
    this.hits = 0;
    this.misses = 0;
    this.totalTrials = 0;
    this.audioCtx = null;
  }

  get gridSize() { return this.levels[this.currentLevel].size; }
  get cellCount() { return this.levels[this.currentLevel].count; }
  get totalCells() { return this.gridSize * this.gridSize; }

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

  buildGrid() {
    const grid = document.getElementById('matrixGrid');
    grid.style.gridTemplateColumns = 'repeat(' + this.gridSize + ', 1fr)';

    const baseSize = Math.min(window.innerWidth * 0.8, window.innerHeight * 0.55, 600);
    const gapPx = window.innerWidth >= 600 ? 12 : 8;
    const gridPx = baseSize;
    grid.style.width = gridPx + 'px';
    grid.style.height = '';
    grid.style.gap = gapPx + 'px';

    grid.innerHTML = '';
    for (let i = 0; i < this.totalCells; i++) {
      const cell = document.createElement('div');
      cell.className = 'matrix-cell';
      cell.id = 'cell-' + i;
      cell.onclick = () => this.handleCellTap(i);
      grid.appendChild(cell);
    }
  }

  changeLevel(level) {
    this.currentLevel = level;
    if (this.isPlaying) {
      this.stopEngine();
      this.isPlaying = false;
      document.getElementById('playIcon').textContent = 'play_arrow';
      document.getElementById('playText').textContent = 'INICIAR';
    }
    this.buildGrid();
    this.resetStats();
    document.getElementById('matrixInstruction').textContent = 'Memoriza el patrón';
    document.getElementById('matrixInstruction').style.color = '';
  }

  toggleOrdered(checked) {
    this.orderedMode = checked;
    if (this.isPlaying) {
      this.stopEngine();
      this.isPlaying = false;
      document.getElementById('playIcon').textContent = 'play_arrow';
      document.getElementById('playText').textContent = 'INICIAR';
    }
    this.resetStats();
    this.clearMatrix();
    document.getElementById('matrixInstruction').textContent = checked
      ? 'Memoriza el patrón Y el orden'
      : 'Memoriza el patrón';
    document.getElementById('matrixInstruction').style.color = '';
  }

  togglePlay() {
    this.isPlaying = !this.isPlaying;
    if (this.isPlaying) {
      document.getElementById('playIcon').textContent = 'pause';
      document.getElementById('playText').textContent = 'PAUSA';
      this.resetStats();
      this.startEngine();
    } else {
      document.getElementById('playIcon').textContent = 'play_arrow';
      document.getElementById('playText').textContent = 'REANUDAR';
      this.stopEngine();
    }
  }

  startEngine() {
    ScreenWakeLock.request();
    this.showTrial();
    if (!this.scheduler) {
      this.scheduler = new CadenceScheduler(() => this.tick(), this.currentSpeed);
    } else {
      this.scheduler.changeInterval(this.currentSpeed);
    }
    this.scheduler.start();
  }

  tick() {
    if (this.phase === 'respond') {
      this.misses++;
      document.getElementById('matrixInstruction').textContent = 'Tiempo agotado';
      document.getElementById('matrixInstruction').style.color = 'var(--rosa-400)';
      this.revealAnswer();
      this.phase = 'feedback';
      this.updateStats();
      this.beep(220, 200);
      if (navigator.vibrate) navigator.vibrate(100);
      this.stopEngine();
      this.isPlaying = true;
      ScreenWakeLock.request();
      this.pendingRestart = setTimeout(() => {
        this.pendingRestart = null;
        if (!this.isPlaying) return;
        this.showTrial();
        this.scheduler.start();
      }, 800);
      return;
    }
    this.showTrial();
  }

  stopEngine() {
    ScreenWakeLock.release();
    if (this.scheduler) this.scheduler.stop();
    clearTimeout(this.hideTimeout);
    if (this.pendingRestart) clearTimeout(this.pendingRestart);
    this.pendingRestart = null;
  }

  changeSpeed(ms) {
    this.currentSpeed = parseInt(ms, 10);
    if (this.scheduler) this.scheduler.changeInterval(this.currentSpeed);
  }

  resetStats() {
    this.hits = 0;
    this.misses = 0;
    this.totalTrials = 0;
    this.updateStats();
  }

  showTrial() {
    this.clearMatrix();
    this.phase = 'memorize';
    this.totalTrials++;

    const instruction = document.getElementById('matrixInstruction');
    instruction.textContent = 'MEMORIZA...';
    instruction.style.color = 'white';

    this.activeCells = [];
    while (this.activeCells.length < this.cellCount) {
      const r = Math.floor(Math.random() * this.totalCells);
      if (!this.activeCells.includes(r)) this.activeCells.push(r);
    }

    this.activeCells.forEach((idx, order) => {
      const cell = document.getElementById('cell-' + idx);
      cell.classList.add('active');
      if (this.orderedMode) {
        cell.textContent = order + 1;
      }
    });

    this.setCellsClickable(false);

    clearTimeout(this.hideTimeout);
    this.hideTimeout = setTimeout(() => {
      if (!this.isPlaying) return;
      this.clearMatrix();
      this.phase = 'respond';
      this.playerSelection = [];
      instruction.textContent = this.orderedMode
        ? 'Toca en ORDEN (' + this.cellCount + ' celdas)'
        : 'Toca las ' + this.cellCount + ' celdas';
      instruction.style.color = 'var(--turquesa-400)';
      this.setCellsClickable(true);
    }, this.currentSpeed * 0.25);

    this.updateStats();
  }

  handleCellTap(idx) {
    if (this.phase !== 'respond' || !this.isPlaying) return;

    const cell = document.getElementById('cell-' + idx);
    if (cell.classList.contains('selected') || cell.classList.contains('wrong')) return;

    if (navigator.vibrate) navigator.vibrate(30);

    if (this.orderedMode) {
      const expectedIdx = this.activeCells[this.playerSelection.length];
      if (idx === expectedIdx) {
        cell.classList.add('selected');
        cell.textContent = this.playerSelection.length + 1;
        this.playerSelection.push(idx);
        if (this.playerSelection.length === this.cellCount) {
          this.setCellsClickable(false);
          this.evaluateSuccess();
        }
      } else {
        cell.classList.add('wrong');
        this.setCellsClickable(false);
        this.evaluateFail();
      }
    } else {
      cell.classList.add('selected');
      this.playerSelection.push(idx);
      if (this.playerSelection.length === this.cellCount) {
        this.setCellsClickable(false);
        this.evaluate();
      }
    }
  }

  evaluate() {
    const correct = this.playerSelection.every(idx => this.activeCells.includes(idx));
    if (correct) {
      this.evaluateSuccess();
    } else {
      this.evaluateFail();
    }
  }

  evaluateSuccess() {
    this.hits++;
    this.beep(880, 80);
    this.revealAnswer();
    document.getElementById('matrixInstruction').textContent = 'Correcto';
    document.getElementById('matrixInstruction').style.color = '#10b981';
    this.phase = 'feedback';
    this.updateStats();
  }

  evaluateFail() {
    this.misses++;
    this.beep(220, 200);
    if (navigator.vibrate) navigator.vibrate(100);

    this.playerSelection.forEach(idx => {
      if (!this.activeCells.includes(idx)) {
        document.getElementById('cell-' + idx).classList.add('wrong');
      }
    });

    this.revealAnswer();
    document.getElementById('matrixInstruction').textContent = 'Incorrecto';
    document.getElementById('matrixInstruction').style.color = 'var(--rosa-400)';
    this.phase = 'feedback';
    this.updateStats();
  }

  revealAnswer() {
    this.activeCells.forEach((idx, order) => {
      const cell = document.getElementById('cell-' + idx);
      cell.classList.add('active');
      if (this.orderedMode) {
        cell.textContent = order + 1;
      }
    });
  }

  setCellsClickable(clickable) {
    for (let i = 0; i < this.totalCells; i++) {
      const cell = document.getElementById('cell-' + i);
      cell.style.pointerEvents = clickable ? 'auto' : 'none';
      cell.style.cursor = clickable ? 'pointer' : 'default';
    }
  }

  clearMatrix() {
    for (let i = 0; i < this.totalCells; i++) {
      const cell = document.getElementById('cell-' + i);
      cell.classList.remove('active', 'selected', 'wrong');
      cell.textContent = '';
    }
  }

  updateStats() {
    document.getElementById('statHits').textContent = this.hits;
    document.getElementById('statMisses').textContent = this.misses;
    document.getElementById('statTotal').textContent = this.totalTrials;
  }
}

const tool = new MatrixTool();
document.addEventListener('DOMContentLoaded', () => tool.buildGrid());
