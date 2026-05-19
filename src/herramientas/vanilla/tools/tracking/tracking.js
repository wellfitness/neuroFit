class TrackingTool {
  constructor() {
    this.scheduler = null;
    this.isPlaying = false;
    this.sessionActive = false;
    this.currentSpeed = 1000;
    this.mode = 'standard';  // 'standard' (ocular) | 'headshake' (cabeza)
    this.totalTrials = 0;
  }

  togglePlay() {
    if (!this.sessionActive) {
      this.sessionActive = true;
      this.setFinalizeVisible(true);
      this.totalTrials = 0;
      if (window.SessionStats) {
        SessionStats.session.start('tracking', {
          mode: this.mode,
          cadence: this.currentSpeed
        });
      }
      this.isPlaying = true;
      document.getElementById('playIcon').textContent = 'pause';
      document.getElementById('playText').textContent = 'PAUSA';
      this.updateStats();
      this.startEngine();
      ScreenWakeLock.request();
    } else if (this.isPlaying) {
      this.isPlaying = false;
      document.getElementById('playIcon').textContent = 'play_arrow';
      document.getElementById('playText').textContent = 'REANUDAR';
      this.stopEngine();
      ScreenWakeLock.release();
    } else {
      this.isPlaying = true;
      document.getElementById('playIcon').textContent = 'pause';
      document.getElementById('playText').textContent = 'PAUSA';
      this.startEngine();
      ScreenWakeLock.request();
    }
  }

  finalize() {
    if (!this.sessionActive) return;
    this.isPlaying = false;
    this.sessionActive = false;
    this.stopEngine();
    ScreenWakeLock.release();
    this.setFinalizeVisible(false);

    let result = null;
    let customFeedback = null;
    if (window.SessionStats) {
      result = SessionStats.session.end();
      if (result && result.summary) {
        const modeLabel = this.mode === 'headshake' ? 'Cabeza (vestibular)' : 'Ocular (smooth pursuit)';
        customFeedback = `${this.totalTrials} movimientos · modo ${modeLabel}`;
        result.summary.config = result.summary.config || {};
        result.summary.config.mode = this.mode;
      }
    }

    document.getElementById('playIcon').textContent = 'play_arrow';
    document.getElementById('playText').textContent = 'INICIAR';
    this.totalTrials = 0;
    this.updateStats();

    if (result && result.summary && result.summary.total >= 5 && window.SessionStatsUI) {
      SessionStatsUI.showResults(result.summary, result.comparison, customFeedback ? { customFeedback } : {});
    }
  }

  setFinalizeVisible(visible) {
    const btn = document.getElementById('btnFinalize');
    if (btn) btn.classList.toggle('visible', visible);
  }

  changeMode(val) {
    this.mode = val;
    const instr = document.getElementById('trackingInstruction');
    if (instr) {
      instr.textContent = this.mode === 'headshake'
        ? 'Mira al centro · gira la CABEZA siguiendo el punto'
        : 'Sigue el punto con la VISTA · cabeza fija';
    }
    this.abortSessionIfRunning();
  }

  abortSessionIfRunning() {
    if (this.isPlaying || this.sessionActive) {
      this.stopEngine();
      if (window.SessionStats) SessionStats.session.abort();
      this.isPlaying = false;
      this.sessionActive = false;
      this.setFinalizeVisible(false);
      document.getElementById('playIcon').textContent = 'play_arrow';
      document.getElementById('playText').textContent = 'INICIAR';
      this.totalTrials = 0;
      this.updateStats();
      ScreenWakeLock.release();
    }
  }

  startEngine() {
    this.runTrackingTick();
    if (!this.scheduler) {
      this.scheduler = new CadenceScheduler(() => this.runTrackingTick(), this.currentSpeed);
    } else {
      this.scheduler.changeInterval(this.currentSpeed);
    }
    this.scheduler.start();
  }

  stopEngine() {
    if (this.scheduler) this.scheduler.stop();
  }

  changeSpeed(ms) {
    this.currentSpeed = parseInt(ms, 10);
    const dot = document.getElementById('tracking-dot');
    if (dot) dot.style.transition = 'all ' + (this.currentSpeed / 1000) + 's ease-in-out';
    if (this.scheduler) this.scheduler.changeInterval(this.currentSpeed);
  }

  runTrackingTick() {
    const dot = document.getElementById('tracking-dot');
    const container = document.getElementById('stimulusContainer');
    const padding = 80;
    const maxX = container.clientWidth - padding;
    const maxY = container.clientHeight - padding;
    if (maxX <= 0 || maxY <= 0) return;
    const randomX = Math.floor(Math.random() * maxX) + (padding / 2);
    const randomY = Math.floor(Math.random() * maxY) + (padding / 2);
    dot.style.left = randomX + 'px';
    dot.style.top = randomY + 'px';

    this.totalTrials++;
    if (this.sessionActive && window.SessionStats) {
      SessionStats.session.recordTrial({ stimulus: 'move', mode: this.mode });
    }
    this.updateStats();
  }

  updateStats() {
    document.getElementById('statRounds').textContent = this.totalTrials;
  }
}

const tool = new TrackingTool();

if (window.SessionStatsUI) {
  SessionStatsUI.init({
    toolId: 'tracking',
    toolName: 'Seguimiento Continuo',
    primaryMetric: 'rtMedian',
    onRepeat: () => tool.togglePlay(),
    onClose: () => {}
  });
}
