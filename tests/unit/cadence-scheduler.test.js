import { describe, it, expect, vi, beforeEach, afterEach } from 'vitest';

describe('CadenceScheduler — propiedades', () => {
  it('arranca no-running con jitter=0 si no se especifica', () => {
    const s = new window.CadenceScheduler(() => {}, 1000);
    expect(s.jitter).toBe(0);
    expect(s.running).toBe(false);
    expect(s.intervalMs).toBe(1000);
  });

  it('jitter>1 se satura a 1', () => {
    const s = new window.CadenceScheduler(() => {}, 1000, 2.5);
    expect(s.jitter).toBe(1);
  });

  it('jitter negativo o no-numerico = 0', () => {
    expect(new window.CadenceScheduler(() => {}, 1000, -0.5).jitter).toBe(0);
    expect(new window.CadenceScheduler(() => {}, 1000, 'foo').jitter).toBe(0);
    expect(new window.CadenceScheduler(() => {}, 1000, NaN).jitter).toBe(0);
  });

  it('setJitter aplica las mismas reglas', () => {
    const s = new window.CadenceScheduler(() => {}, 1000, 0.3);
    s.setJitter(-1);
    expect(s.jitter).toBe(0);
    s.setJitter(0.5);
    expect(s.jitter).toBe(0.5);
    s.setJitter(99);
    expect(s.jitter).toBe(1);
  });

  it('_nextInterval devuelve intervalMs exacto cuando jitter=0', () => {
    const s = new window.CadenceScheduler(() => {}, 1000);
    expect(s._nextInterval()).toBe(1000);
  });

  it('_nextInterval con jitter cae dentro del rango esperado', () => {
    const s = new window.CadenceScheduler(() => {}, 1000, 0.3);
    for (let i = 0; i < 50; i++) {
      const v = s._nextInterval();
      expect(v).toBeGreaterThanOrEqual(700);
      expect(v).toBeLessThanOrEqual(1300);
    }
  });

  it('_nextInterval respeta el minimo de 150ms aunque jitter genere valor menor', () => {
    const s = new window.CadenceScheduler(() => {}, 100, 1);
    for (let i = 0; i < 50; i++) {
      expect(s._nextInterval()).toBeGreaterThanOrEqual(150);
    }
  });
});

describe('CadenceScheduler — ciclo de vida', () => {
  beforeEach(() => {
    // Mockear tambien performance.now() — el scheduler la usa para anclar la cadencia
    vi.useFakeTimers({ toFake: ['setTimeout', 'clearTimeout', 'setInterval', 'clearInterval', 'performance', 'Date'] });
  });
  afterEach(() => {
    vi.useRealTimers();
  });

  it('start dispara callback aprox cada intervalMs', () => {
    const cb = vi.fn();
    const s = new window.CadenceScheduler(cb, 100);
    s.start();
    expect(s.running).toBe(true);
    vi.advanceTimersByTime(350);
    s.stop();
    expect(cb).toHaveBeenCalledTimes(3);
  });

  it('stop detiene los disparos', () => {
    const cb = vi.fn();
    const s = new window.CadenceScheduler(cb, 100);
    s.start();
    vi.advanceTimersByTime(150);
    s.stop();
    expect(s.running).toBe(false);
    vi.advanceTimersByTime(1000);
    expect(cb).toHaveBeenCalledTimes(1);
  });

  it('start es idempotente (segundo start sin stop = no-op)', () => {
    const cb = vi.fn();
    const s = new window.CadenceScheduler(cb, 100);
    s.start();
    s.start();
    vi.advanceTimersByTime(250);
    s.stop();
    expect(cb).toHaveBeenCalledTimes(2);
  });

  it('changeInterval reinicia si esta corriendo', () => {
    const cb = vi.fn();
    const s = new window.CadenceScheduler(cb, 100);
    s.start();
    vi.advanceTimersByTime(50);
    s.changeInterval(200);
    expect(s.intervalMs).toBe(200);
    expect(s.running).toBe(true);
    vi.advanceTimersByTime(250);
    s.stop();
    expect(cb).toHaveBeenCalled();
  });
});
