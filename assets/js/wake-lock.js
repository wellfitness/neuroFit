/**
 * ScreenWakeLock — módulo compartido para prevenir suspensión de pantalla.
 * Uso: ScreenWakeLock.request() al iniciar sesión activa,
 *      ScreenWakeLock.release() al detener.
 * Re-adquiere automáticamente al volver de cambio de pestaña.
 */
const ScreenWakeLock = (() => {
  let _lock = null;
  let _active = false;

  async function _acquire() {
    if (!('wakeLock' in navigator)) return;
    try {
      _lock = await navigator.wakeLock.request('screen');
      _lock.addEventListener('release', () => { _lock = null; });
    } catch (_) { /* no es crítico */ }
  }

  document.addEventListener('visibilitychange', () => {
    if (_active && document.visibilityState === 'visible' && !_lock) {
      _acquire();
    }
  });

  return {
    async request() {
      _active = true;
      await _acquire();
    },
    async release() {
      _active = false;
      if (_lock) {
        try { await _lock.release(); } catch (_) {}
        _lock = null;
      }
    }
  };
})();
