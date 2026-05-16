class TrackingTool {
  constructor() {
    this.scheduler = null;
    this.isPlaying = false;
    this.currentSpeed = 1000;
    this.totalTrials = 0;
  }

  togglePlay() {
    this.isPlaying = !this.isPlaying;
    if (this.isPlaying) {
      document.getElementById('playIcon').textContent = 'pause';
      document.getElementById('playText').textContent = 'PAUSA';
      this.totalTrials = 0;
      this.updateStats();
      this.startEngine();
      ScreenWakeLock.request();
    } else {
      document.getElementById('playIcon').textContent = 'play_arrow';
      document.getElementById('playText').textContent = 'REANUDAR';
      this.stopEngine();
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
    dot.style.transition = 'all ' + (this.currentSpeed / 1000) + 's ease-in-out';
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
    this.updateStats();
  }

  updateStats() {
    document.getElementById('statRounds').textContent = this.totalTrials;
  }
}

const tool = new TrackingTool();
