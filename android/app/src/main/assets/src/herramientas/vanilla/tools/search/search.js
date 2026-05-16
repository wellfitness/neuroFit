class SearchTool {
  constructor() {
    this.searchPairs = [
      { target: 'O', distractor: 'Q' },
      { target: 'Q', distractor: 'O' },
      { target: 'b', distractor: 'd' },
      { target: 'E', distractor: 'F' },
      { target: 'I', distractor: 'l' },
      { target: 'M', distractor: 'N' }
    ];
    this.scheduler = null;
    this.isPlaying = false;
    this.currentSpeed = 4500;
    this.hits = 0;
    this.misses = 0;
    this.totalTrials = 0;
    this.responded = false;
    this.trialStart = 0;
    this.reactionTimes = [];
    this.targetIndex = -1;
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
      this.scheduler = new CadenceScheduler(() => this.evaluateAndNext(), this.currentSpeed);
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

  resetStats() {
    this.hits = 0;
    this.misses = 0;
    this.totalTrials = 0;
    this.reactionTimes = [];
    this.updateStats();
  }

  showTrial() {
    const pair = this.searchPairs[Math.floor(Math.random() * this.searchPairs.length)];
    document.getElementById('searchTargetText').innerHTML =
      'Busca la <span style="color:var(--turquesa-400); font-size:1.3em; font-weight:bold;">' + pair.target + '</span> entre las ' + pair.distractor;

    const grid = document.getElementById('searchGrid');
    grid.innerHTML = '';
    const totalItems = window.innerWidth < 768 ? 24 : 36;
    this.targetIndex = Math.floor(Math.random() * totalItems);
    this.responded = false;
    this.trialStart = performance.now();
    this.totalTrials++;

    for (let i = 0; i < totalItems; i++) {
      const div = document.createElement('div');
      div.className = 'search-item';
      div.dataset.index = i;
      if (i === this.targetIndex) {
        div.textContent = pair.target;
        div.classList.add('target');
      } else {
        div.textContent = pair.distractor;
      }
      div.addEventListener('click', () => this.handleItemTap(i));
      grid.appendChild(div);
    }

    this.updateStats();
  }

  evaluateAndNext() {
    if (!this.isPlaying) return;
    if (!this.responded) this.misses++;
    this.showTrial();
    this.updateStats();
  }

  handleItemTap(index) {
    if (!this.isPlaying || this.responded) return;
    this.responded = true;

    const rt = performance.now() - this.trialStart;
    const item = document.querySelector(`.search-item[data-index="${index}"]`);

    if (index === this.targetIndex) {
      this.hits++;
      this.reactionTimes.push(rt);
      this.beep(880, 80);
      if (item) item.style.background = 'rgba(0, 190, 200, 0.4)';
    } else {
      this.misses++;
      this.beep(220, 200);
      if (item) item.style.background = 'rgba(225, 29, 72, 0.4)';
      const target = document.querySelector(`.search-item[data-index="${this.targetIndex}"]`);
      if (target) target.style.background = 'rgba(0, 190, 200, 0.4)';
    }
    this.updateStats();
  }

  updateStats() {
    document.getElementById('statHits').textContent = this.hits;
    document.getElementById('statMisses').textContent = this.misses;
    document.getElementById('statTotal').textContent = this.totalTrials;
    const avgRT = this.reactionTimes.length > 0
      ? Math.round(this.reactionTimes.reduce((a, b) => a + b, 0) / this.reactionTimes.length)
      : '--';
    document.getElementById('statRT').textContent = avgRT + (avgRT !== '--' ? ' ms' : '');
  }
}

const tool = new SearchTool();
