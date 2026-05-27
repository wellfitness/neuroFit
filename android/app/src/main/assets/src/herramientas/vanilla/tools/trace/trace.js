class TraceTool {
  constructor() {
    this.scheduler = null;
    this.isPlaying = false;
    this.sessionActive = false;
    this.currentSpeed = 8000;
    this.mode = 'random';  // 'random' | 'tmtA' | 'tmtB'
    this.tmtIndex = 0;  // posición actual en la secuencia TMT
    this.numbers = ['1','2','3','4','5','6','7','8','9','10','11','12','13'];
    this.letters = ['A','B','C','D','E','F','G','H','I','J','K','L','M'];
  }

  togglePlay() {
    if (!this.sessionActive) {
      this.sessionActive = true;
      this.setFinalizeVisible(true);
      this.tmtIndex = 0;
      if (window.SessionStats) {
        SessionStats.session.start('trace', { mode: this.mode, cadence: this.currentSpeed });
      }
      this.isPlaying = true;
      this.setPlayButton('pause', 'PAUSA');
      const btn = document.getElementById('btnPlayPause');
      if (btn) btn.classList.add('active');
      this.startEngine();
    } else if (this.isPlaying) {
      this.isPlaying = false;
      this.setPlayButton('play_arrow', 'REANUDAR');
      const btn = document.getElementById('btnPlayPause');
      if (btn) btn.classList.remove('active');
      this.stopEngine();
    } else {
      this.isPlaying = true;
      this.setPlayButton('pause', 'PAUSA');
      const btn = document.getElementById('btnPlayPause');
      if (btn) btn.classList.add('active');
      this.startEngine();
    }
  }

  finalize() {
    if (!this.sessionActive) return;
    this.isPlaying = false;
    this.sessionActive = false;
    this.stopEngine();
    const btn = document.getElementById('btnPlayPause');
    if (btn) btn.classList.remove('active');

    let result = null;
    let customFeedback = null;
    if (window.SessionStats) {
      result = SessionStats.session.end();
      if (result && result.summary) {
        const modeLabel = this.mode === 'tmtB' ? 'Alterna nº/letra' : this.mode === 'tmtA' ? 'Números' : 'Libre';
        customFeedback = `${result.summary.total} trazos · modo ${modeLabel}`;
      }
    }

    this.setPlayButton('play_arrow', 'INICIAR');
    this.setFinalizeVisible(false);
    document.getElementById('traceText').textContent = '·';

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

  changeMode(val) {
    this.mode = val;
    this.tmtIndex = 0;
    if (this.isPlaying || this.sessionActive) {
      this.stopEngine();
      if (window.SessionStats) SessionStats.session.abort();
      this.isPlaying = false;
      this.sessionActive = false;
      this.setFinalizeVisible(false);
      this.setPlayButton('play_arrow', 'INICIAR');
      const btn = document.getElementById('btnPlayPause');
      if (btn) btn.classList.remove('active');
    }
    document.getElementById('traceText').textContent = '·';
  }

  startEngine() {
    ScreenWakeLock.request();
    this.runTrace();
    if (!this.scheduler) {
      this.scheduler = new CadenceScheduler(() => this.runTrace(), this.currentSpeed);
    } else {
      this.scheduler.changeInterval(this.currentSpeed);
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

  runTrace() {
    let char;
    if (this.mode === 'tmtA') {
      // 1, 2, 3, ..., 13, 1, 2, ...
      char = this.numbers[this.tmtIndex % this.numbers.length];
      this.tmtIndex++;
    } else if (this.mode === 'tmtB') {
      // 1, A, 2, B, 3, C, ... alternando
      const pos = Math.floor(this.tmtIndex / 2);
      char = this.tmtIndex % 2 === 0
        ? this.numbers[pos % this.numbers.length]
        : this.letters[pos % this.letters.length];
      this.tmtIndex++;
    } else {
      // Libre: random alfanumérico (comportamiento original)
      const chars = "ABCDEFGHIJKLMNOPQRSTUVWXYZ0123456789!?&@";
      char = chars.charAt(Math.floor(Math.random() * chars.length));
    }
    document.getElementById('traceText').textContent = char;

    if (window.SessionStats && this.sessionActive) {
      SessionStats.session.recordTrial({ stimulus: char, mode: this.mode });
    }
  }
}

const tool = new TraceTool();

if (window.SessionStatsUI) {
  SessionStatsUI.init({
    toolId: 'trace',
    toolName: 'Trazado Alfanumérico',
    primaryMetric: 'rtMedian',
    onRepeat: () => tool.togglePlay(),
    onClose: () => { document.getElementById('traceText').textContent = '·'; }
  });
}
