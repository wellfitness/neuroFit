class MatrixTool {
  constructor() {
    this.levels = {
      '3': { size: 3, count: 3 },
      '4': { size: 4, count: 4 },
      '5': { size: 5, count: 5 }
    };
    this.currentLevel = '3';
    this.orderedMode = false;
    this.direction = 'forward';  // 'forward' | 'reverse'
    this.scheduler = null;
    this.pendingRestart = null;
    this.isPlaying = false;
    this.sessionActive = false;
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
    this.abortSessionIfRunning();
    this.buildGrid();
    this.resetStats();
    document.getElementById('matrixInstruction').textContent = this.baseInstruction();
    document.getElementById('matrixInstruction').style.color = '';
  }

  baseInstruction() {
    if (!this.orderedMode) return 'Memoriza el patrón';
    return this.direction === 'reverse'
      ? 'Memoriza · responderás AL REVÉS'
      : 'Memoriza el patrón Y el orden';
  }

  toggleOrdered(checked) {
    this.orderedMode = checked;
    // Sólo permitir backward cuando ordered esté activo
    const dirSel = document.getElementById('directionSelect');
    if (dirSel) {
      dirSel.disabled = !checked;
      if (!checked) {
        dirSel.value = 'forward';
        this.direction = 'forward';
      }
    }
    this.abortSessionIfRunning();
    this.resetStats();
    this.clearMatrix();
    document.getElementById('matrixInstruction').textContent = this.baseInstruction();
    document.getElementById('matrixInstruction').style.color = '';
  }

  changeDirection(val) {
    this.direction = val;
    this.abortSessionIfRunning();
    this.resetStats();
    this.clearMatrix();
    document.getElementById('matrixInstruction').textContent = this.baseInstruction();
    document.getElementById('matrixInstruction').style.color = '';
  }

  abortSessionIfRunning() {
    if (this.isPlaying || this.sessionActive) {
      this.stopEngine();
      if (window.SessionStats) SessionStats.session.abort();
      this.isPlaying = false;
      this.sessionActive = false;
      this.setFinalizeVisible(false);
      this.setPlayButton('play_arrow', 'INICIAR');
    }
  }

  togglePlay() {
    if (!this.sessionActive) {
      this.sessionActive = true;
      this.setFinalizeVisible(true);
      this.isPlaying = true;
      this.setPlayButton('pause', 'PAUSA');
      this.resetStats();
      if (window.SessionStats) {
        SessionStats.session.start('matrix', {
          gridSize: this.gridSize,
          cellCount: this.cellCount,
          ordered: this.orderedMode,
          direction: this.direction,
          cadence: this.currentSpeed
        });
      }
      this.startEngine();
    } else if (this.isPlaying) {
      this.isPlaying = false;
      this.setPlayButton('play_arrow', 'REANUDAR');
      this.stopEngine();
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

    let result = null;
    let customFeedback = null;
    if (window.SessionStats) {
      result = SessionStats.session.end();
      if (result && result.summary) {
        const dirLabel = this.orderedMode ? (this.direction === 'reverse' ? 'orden inverso' : 'orden directo') : 'sin orden';
        customFeedback = `${this.gridSize}×${this.gridSize} · ${this.cellCount} celdas · ${dirLabel}`;
        result.summary.config = result.summary.config || {};
        result.summary.config.gridSize = this.gridSize;
      }
    }

    this.setPlayButton('play_arrow', 'INICIAR');
    this.setFinalizeVisible(false);
    this.resetStats();
    this.clearMatrix();
    document.getElementById('matrixInstruction').textContent = this.baseInstruction();
    document.getElementById('matrixInstruction').style.color = '';

    if (result && result.summary && result.summary.total >= 3 && window.SessionStatsUI) {
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
      this.recordTrial({ span: this.cellCount, correct: false, errorType: 'omission' });
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

  recordTrial(trial) {
    if (window.SessionStats && this.sessionActive) {
      SessionStats.session.recordTrial(trial);
    }
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
      if (this.orderedMode) {
        instruction.textContent = this.direction === 'reverse'
          ? 'Toca AL REVÉS (' + this.cellCount + ' celdas)'
          : 'Toca en ORDEN (' + this.cellCount + ' celdas)';
      } else {
        instruction.textContent = 'Toca las ' + this.cellCount + ' celdas';
      }
      instruction.style.color = 'var(--turquesa-400)';
      this.setCellsClickable(true);
    }, this.currentSpeed * 0.25);

    this.updateStats();
  }

  expectedActiveAt(index) {
    if (this.direction === 'reverse') {
      return this.activeCells[this.activeCells.length - 1 - index];
    }
    return this.activeCells[index];
  }

  handleCellTap(idx) {
    if (this.phase !== 'respond' || !this.isPlaying) return;

    const cell = document.getElementById('cell-' + idx);
    if (cell.classList.contains('selected') || cell.classList.contains('wrong')) return;

    if (navigator.vibrate) navigator.vibrate(30);

    if (this.orderedMode) {
      const expectedIdx = this.expectedActiveAt(this.playerSelection.length);
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
    if (correct) this.evaluateSuccess();
    else this.evaluateFail();
  }

  evaluateSuccess() {
    this.hits++;
    this.beep(880, 80);
    this.revealAnswer();
    document.getElementById('matrixInstruction').textContent = 'Correcto';
    document.getElementById('matrixInstruction').style.color = '#10b981';
    this.phase = 'feedback';
    this.recordTrial({ span: this.cellCount, correct: true });
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
    this.recordTrial({ span: this.cellCount, correct: false, errorType: 'commission' });
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

if (window.SessionStatsUI) {
  SessionStatsUI.init({
    toolId: 'matrix',
    toolName: 'Matriz Visoespacial',
    primaryMetric: 'accuracy',
    onRepeat: () => tool.togglePlay(),
    onClose: () => tool.clearMatrix()
  });
}
