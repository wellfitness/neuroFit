/**
 * CadenceScheduler — scheduler de cadencia con auto-corrección de drift.
 *
 * Reemplaza a setInterval para herramientas rítmicas (estímulos a intervalo fijo).
 * Cada disparo se ancla al tiempo absoluto previsto (performance.now()), no al
 * momento de ejecución del callback anterior. Esto elimina el drift acumulativo
 * de setInterval y absorbe pequeños bloqueos del hilo principal sin desfasar.
 *
 * Política ante atrasos largos (background tab, throttling del WebView): si el
 * sistema se retrasó más de un ciclo entero, resincroniza la base de tiempo
 * en vez de disparar una ráfaga de estímulos para "ponerse al día".
 *
 * Uso:
 *   const scheduler = new CadenceScheduler(() => doTick(), 3000);
 *   scheduler.start();
 *   scheduler.changeInterval(2000);
 *   scheduler.stop();
 */
class CadenceScheduler {
  constructor(callback, intervalMs) {
    this.callback = callback;
    this.intervalMs = intervalMs;
    this.timeoutId = null;
    this.nextTickAt = 0;
    this.running = false;
  }

  start() {
    if (this.running) return;
    this.running = true;
    this.nextTickAt = performance.now() + this.intervalMs;
    this._scheduleNext();
  }

  stop() {
    this.running = false;
    if (this.timeoutId !== null) {
      clearTimeout(this.timeoutId);
      this.timeoutId = null;
    }
  }

  changeInterval(intervalMs) {
    this.intervalMs = intervalMs;
    if (this.running) {
      this.stop();
      this.start();
    }
  }

  _scheduleNext() {
    const now = performance.now();
    let delay = this.nextTickAt - now;
    if (delay < -this.intervalMs) {
      this.nextTickAt = now + this.intervalMs;
      delay = this.intervalMs;
    } else if (delay < 0) {
      delay = 0;
    }
    this.timeoutId = setTimeout(() => {
      if (!this.running) return;
      this.nextTickAt += this.intervalMs;
      this.callback();
      if (this.running) this._scheduleNext();
    }, delay);
  }
}
