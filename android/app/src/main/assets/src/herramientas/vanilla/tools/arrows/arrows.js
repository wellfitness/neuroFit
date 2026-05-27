class ArrowsTool {
  constructor() {
    this.scheduler = null;
    this.isPlaying = false;
    this.sessionActive = false;
    this.currentSpeed = 3000;
    this.jitter = 0;
    this.congruentRatio = 0.5;  // proporción de trials congruentes (audio == visual)
  }

  changeRatio(val) {
    this.congruentRatio = parseFloat(val);
  }

  toggleJitter() {
    this.jitter = this.jitter > 0 ? 0 : 0.3;
    if (this.scheduler) this.scheduler.setJitter(this.jitter);
    const btn = document.getElementById('btnJitter');
    if (btn) btn.classList.toggle('active', this.jitter > 0);
  }

  togglePlay() {
    if (!this.sessionActive) {
      this.sessionActive = true;
      this.setFinalizeVisible(true);
      if (window.SessionStats) {
        SessionStats.session.start('arrows', { cadence: this.currentSpeed, mode: 'voice', jitter: this.jitter });
      }
      this.isPlaying = true;
      this.setPlayButton('pause', 'PAUSA');
      KinesisTTS.warmup();
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
    if (window.SessionStats) result = SessionStats.session.end();
    this.setPlayButton('play_arrow', 'INICIAR');
    this.setFinalizeVisible(false);
    document.getElementById('arrowVisual').textContent = 'lens';
    if (result && result.summary && result.summary.total >= 5 && window.SessionStatsUI) {
      SessionStatsUI.showResults(result.summary, result.comparison);
    }
  }

  setPlayButton(icon, text) {
    document.getElementById('playIcon').textContent = icon;
    document.getElementById('playText').textContent = text;
    const btn = document.getElementById('btnPlayPause');
    if (this.isPlaying) btn.classList.add('active'); else btn.classList.remove('active');
  }

  setFinalizeVisible(visible) {
    const btn = document.getElementById('btnFinalize');
    if (!btn) return;
    btn.classList.toggle('visible', visible);
  }

  startEngine() {
    this.runArrows();
    ScreenWakeLock.request();
    if (!this.scheduler) {
      this.scheduler = new CadenceScheduler(() => this.runArrows(), this.currentSpeed, this.jitter);
    } else {
      this.scheduler.changeInterval(this.currentSpeed);
      this.scheduler.setJitter(this.jitter);
    }
    this.scheduler.start();
  }

  stopEngine() {
    if (this.scheduler) this.scheduler.stop();
    KinesisTTS.cancel();
    ScreenWakeLock.release();
  }

  changeSpeed(ms) {
    this.currentSpeed = parseInt(ms, 10);
    if (this.scheduler) this.scheduler.changeInterval(this.currentSpeed);
  }

  runArrows() {
    const dirs = ['IZQUIERDA', 'DERECHA'];
    const visDir = dirs[Math.floor(Math.random() * dirs.length)];
    document.getElementById('arrowVisual').textContent = visDir === 'IZQUIERDA' ? 'arrow_back' : 'arrow_forward';

    // Audio congruente con ratio configurable. Por defecto 50/50.
    const isCongruent = Math.random() < this.congruentRatio;
    const audioDir = isCongruent ? visDir : (visDir === 'IZQUIERDA' ? 'DERECHA' : 'IZQUIERDA');

    KinesisTTS.cancel();
    KinesisTTS.speak(audioDir, 1.3);

    if (window.SessionStats && this.sessionActive) {
      SessionStats.session.recordTrial({
        stimulus: audioDir,
        visual: visDir,
        congruent: isCongruent,
        condition: isCongruent ? 'congruent' : 'incongruent'
      });
    }
  }
}

const tool = new ArrowsTool();

if (window.SessionStatsUI) {
  SessionStatsUI.init({
    toolId: 'arrows',
    toolName: 'Conflicto Audiovisual',
    primaryMetric: 'rtMedian',
    onRepeat: () => tool.togglePlay(),
    onClose: () => { document.getElementById('arrowVisual').textContent = 'lens'; }
  });
}
