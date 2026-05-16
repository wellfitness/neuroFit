/**
 * CadenceScheduler — scheduler de cadencia con auto-corrección de drift.
 *
 * Reemplaza a setInterval para herramientas rítmicas (estímulos a intervalo fijo).
 * Cada disparo se ancla al tiempo absoluto previsto (performance.now()), no al
 * momento de ejecución del callback anterior. Esto elimina el drift acumulativo
 * de setInterval y absorbe pequeños bloqueos del hilo principal sin desfasar.
 *
 * Soporta jitter opcional: cada intervalo se varía aleatoriamente dentro de un
 * porcentaje configurable (jitter=0.3 → cada tick entre 0.7× y 1.3× del intervalo).
 * El default es jitter=0 (cadencia constante = comportamiento original).
 *
 * Política ante atrasos largos (background tab, throttling del WebView): si el
 * sistema se retrasó más de 2 ciclos enteros, resincroniza la base de tiempo
 * en vez de disparar una ráfaga de estímulos para "ponerse al día".
 *
 * Uso:
 *   const scheduler = new CadenceScheduler(() => doTick(), 3000);
 *   scheduler.start();
 *   scheduler.changeInterval(2000);
 *   scheduler.setJitter(0.3);      // ±30% → cadencia variable
 *   scheduler.setJitter(0);        // vuelve a constante
 *   scheduler.stop();
 */
class CadenceScheduler {
  constructor(callback, intervalMs, jitter) {
    this.callback = callback;
    this.intervalMs = intervalMs;
    this.jitter = (typeof jitter === 'number' && jitter > 0) ? Math.min(1, jitter) : 0;
    this.timeoutId = null;
    this.nextTickAt = 0;
    this.running = false;
  }

  start() {
    if (this.running) return;
    this.running = true;
    this.nextTickAt = performance.now() + this._nextInterval();
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

  setJitter(jitter) {
    this.jitter = (typeof jitter === 'number' && jitter > 0) ? Math.min(1, jitter) : 0;
  }

  _nextInterval() {
    if (this.jitter <= 0) return this.intervalMs;
    // Distribución uniforme entre (1 - jitter)·intervalMs y (1 + jitter)·intervalMs.
    const factor = 1 + (Math.random() * 2 - 1) * this.jitter;
    return Math.max(150, this.intervalMs * factor);
  }

  _scheduleNext() {
    const now = performance.now();
    let delay = this.nextTickAt - now;
    if (delay < -this.intervalMs * 2) {
      // Atraso largo: resincronizar.
      this.nextTickAt = now + this._nextInterval();
      delay = this.nextTickAt - now;
    } else if (delay < 0) {
      delay = 0;
    }
    this.timeoutId = setTimeout(() => {
      if (!this.running) return;
      this.nextTickAt += this._nextInterval();
      this.callback();
      if (this.running) this._scheduleNext();
    }, delay);
  }
}
