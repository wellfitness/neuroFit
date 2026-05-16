class SonidosTool {
  constructor() {
    this.sonidosData = [
      { name: 'GRAVE', frequency: 200, icon: 'volume_down', action: 'SENTADILLA' },
      { name: 'AGUDO', frequency: 800, icon: 'volume_up', action: 'SALTO' },
      { name: 'MEDIO', frequency: 440, icon: 'volume_mute', action: 'GIRO' }
    ];
    this.scheduler = null;
    this.isPlaying = false;
    this.sessionActive = false;
    this.currentSpeed = 3000;
    this.jitter = 0;
    this.totalTrials = 0;
    this.minPerSound = 2;
    this.soundCounts = [0, 0, 0];
    this.learningDone = false;
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
    osc.type = 'sine';
    gain.gain.setValueAtTime(0.25, ctx.currentTime);
    gain.gain.exponentialRampToValueAtTime(0.001, ctx.currentTime + dur / 1000);
    osc.start(ctx.currentTime);
    osc.stop(ctx.currentTime + dur / 1000);
  }

  togglePlay() {
    if (!this.sessionActive) {
      this.sessionActive = true;
      this.setFinalizeVisible(true);
      this.totalTrials = 0;
      this.soundCounts = [0, 0, 0];
      this.learningDone = false;
      this.updateStats();
      this.renderLegend();
      if (window.SessionStats) {
        SessionStats.session.start('sonidos', {
          cadence: this.currentSpeed,
          jitter: this.jitter,
          actions: this.sonidosData.map(s => s.action)
        });
      }
      this.isPlaying = true;
      this.setPlayButton('pause', 'PAUSA');
      this.startEngine();
      ScreenWakeLock.request();
    } else if (this.isPlaying) {
      this.isPlaying = false;
      this.setPlayButton('play_arrow', 'REANUDAR');
      this.stopEngine();
      ScreenWakeLock.release();
    } else {
      this.isPlaying = true;
      this.setPlayButton('pause', 'PAUSA');
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
    let result = null;
    if (window.SessionStats) result = SessionStats.session.end();
    this.setPlayButton('play_arrow', 'INICIAR');
    this.setFinalizeVisible(false);
    this.totalTrials = 0;
    this.soundCounts = [0, 0, 0];
    this.learningDone = false;
    this.updateStats();
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

  startEngine() {
    this.runSonidos();
    if (!this.scheduler) {
      this.scheduler = new CadenceScheduler(() => this.runSonidos(), this.currentSpeed, this.jitter);
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
  }

  changeSpeed(ms) {
    this.currentSpeed = parseInt(ms, 10);
    if (this.scheduler) this.scheduler.changeInterval(this.currentSpeed);
  }

  updateAction(index, value) {
    this.sonidosData[index].action = value.toUpperCase().trim();
    this.renderLegend();
  }

  escapeAttr(str) {
    return str.replace(/&/g, '&amp;').replace(/"/g, '&quot;').replace(/</g, '&lt;').replace(/>/g, '&gt;');
  }

  renderLegend() {
    const el = document.getElementById('sonidosLegend');
    el.innerHTML = this.sonidosData.map((s, i) =>
      '<div class="legend-item">' +
        '<span class="legend-sound">' + s.name + '</span>' +
        '<span class="legend-arrow">→</span>' +
        '<input name="action-' + i + '" class="legend-action" value="' + this.escapeAttr(s.action) + '" ' +
          'onchange="tool.updateAction(' + i + ', this.value)" ' +
          'maxlength="20">' +
      '</div>'
    ).join('');
  }

  runSonidos() {
    const sndIndex = Math.floor(Math.random() * this.sonidosData.length);
    const snd = this.sonidosData[sndIndex];
    const icon = document.getElementById('sonidosIcon');
    const actionEl = document.getElementById('sonidosAction');

    this.totalTrials++;
    this.soundCounts[sndIndex]++;

    if (window.SessionStats && this.sessionActive) {
      SessionStats.session.recordTrial({ stimulus: snd.name });
    }

    icon.style.transform = 'scale(1.5)';
    setTimeout(() => { icon.style.transform = 'scale(1)'; }, 200);

    if (!this.learningDone) {
      icon.textContent = snd.icon;
      document.getElementById('sonidosText').textContent = snd.name;
      actionEl.textContent = snd.action;
      actionEl.style.opacity = '1';
    } else {
      icon.textContent = 'graphic_eq';
      document.getElementById('sonidosText').textContent = '';
      actionEl.style.opacity = '0';
    }

    if (!this.learningDone) {
      this.learningDone = this.soundCounts.every(c => c >= this.minPerSound);
    }

    this.beep(snd.frequency, 500);

    this.updateStats();
  }

  updateStats() {
    document.getElementById('statRounds').textContent = this.totalTrials;
    const phase = !this.learningDone ? 'APRENDIZAJE' : 'MEMORIA';
    document.getElementById('statPhase').textContent = phase;
  }
}

const tool = new SonidosTool();

if (window.SessionStatsUI) {
  SessionStatsUI.init({
    toolId: 'sonidos',
    toolName: 'Sonidos Audiomotores',
    primaryMetric: 'rtMedian',
    onRepeat: () => tool.togglePlay(),
    onClose: () => {}
  });
}
