class ArrowsTool {
  constructor() {
    this.scheduler = null;
    this.isPlaying = false;
    this.currentSpeed = 3000;
  }

  togglePlay() {
    this.isPlaying = !this.isPlaying;
    const btn = document.getElementById('btnPlayPause');
    if (this.isPlaying) {
      btn.classList.add('active');
      document.getElementById('playIcon').textContent = 'pause';
      document.getElementById('playText').textContent = 'PAUSA';
      KinesisTTS.warmup();
      this.startEngine();
    } else {
      btn.classList.remove('active');
      document.getElementById('playIcon').textContent = 'play_arrow';
      document.getElementById('playText').textContent = 'REANUDAR';
      this.stopEngine();
    }
  }
  startEngine() {
    this.runArrows();
    ScreenWakeLock.request();
    if (!this.scheduler) {
      this.scheduler = new CadenceScheduler(() => this.runArrows(), this.currentSpeed);
    } else {
      this.scheduler.changeInterval(this.currentSpeed);
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

    let audioDir = visDir;
    if (Math.random() > 0.5) audioDir = visDir === 'IZQUIERDA' ? 'DERECHA' : 'IZQUIERDA';

    KinesisTTS.cancel();
    KinesisTTS.speak(audioDir, 1.3);
  }
}
const tool = new ArrowsTool();
