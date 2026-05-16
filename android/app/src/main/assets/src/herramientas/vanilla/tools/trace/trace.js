class TraceTool {
  constructor() {
    this.scheduler = null;
    this.isPlaying = false;
    this.currentSpeed = 8000;
  }
  togglePlay() {
    this.isPlaying = !this.isPlaying;
    const btn = document.getElementById('btnPlayPause');
    if (this.isPlaying) {
      btn.classList.add('active');
      document.getElementById('playIcon').textContent = 'pause';
      document.getElementById('playText').textContent = 'PAUSA';
      this.startEngine();
    } else {
      btn.classList.remove('active');
      document.getElementById('playIcon').textContent = 'play_arrow';
      document.getElementById('playText').textContent = 'REANUDAR';
      this.stopEngine();
    }
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
    const chars = "ABCDEFGHIJKLMNOPQRSTUVWXYZ0123456789!?&@";
    const char = chars.charAt(Math.floor(Math.random() * chars.length));
    document.getElementById('traceText').textContent = char;
  }
}
const tool = new TraceTool();
