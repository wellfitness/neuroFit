// KinesisTTS — bridge unificado de Text-To-Speech.
// Prioriza el bridge nativo Android (window.AndroidTTS, expuesto desde MainActivity)
// y cae al Web Speech API estándar cuando se ejecuta en navegador / PWA.
//
// API pública:
//   KinesisTTS.warmup()                     -> precalienta motor (llamar tras gesto del usuario)
//   KinesisTTS.speak(text, rate)            -> fire-and-forget
//   KinesisTTS.speakAndWait(text, rate)     -> Promise<void> que resuelve al terminar
//   KinesisTTS.cancel()                     -> detiene cola actual
//   KinesisTTS.isAvailable()                -> bool
//   KinesisTTS.isAndroid()                  -> bool (true cuando hay bridge nativo)
(function () {
  const hasAndroidBridge = !!(
    window.AndroidTTS &&
    typeof window.AndroidTTS.speak === 'function'
  );
  const hasWebSpeech = 'speechSynthesis' in window;

  let webVoice = null;
  function loadWebVoice() {
    if (!hasWebSpeech) return;
    const voices = window.speechSynthesis.getVoices();
    webVoice = voices.find(v => v.lang && v.lang.toLowerCase().startsWith('es'))
            || voices.find(v => v.default)
            || voices[0]
            || null;
  }
  if (hasWebSpeech) {
    loadWebVoice();
    window.speechSynthesis.onvoiceschanged = loadWebVoice;
  }

  const pendingCallbacks = new Map();
  let callbackCounter = 0;

  // Llamado desde Java vía evaluateJavascript cuando una utterance termina (o falla).
  window.__androidTTSDone = function (id) {
    const resolver = pendingCallbacks.get(id);
    if (resolver) {
      pendingCallbacks.delete(id);
      resolver();
    }
  };

  function normRate(rate) {
    return (typeof rate === 'number' && rate > 0) ? rate : 1.0;
  }

  function speakWeb(text, rate) {
    if (!hasWebSpeech) return;
    try {
      const u = new SpeechSynthesisUtterance(text);
      u.lang = 'es-ES';
      u.rate = normRate(rate);
      u.volume = 1;
      if (webVoice) u.voice = webVoice;
      window.speechSynthesis.speak(u);
    } catch (e) { /* noop */ }
  }

  function speakWebAndWait(text, rate) {
    return new Promise((resolve) => {
      if (!hasWebSpeech) return resolve();
      try {
        const u = new SpeechSynthesisUtterance(text);
        u.lang = 'es-ES';
        u.rate = normRate(rate);
        u.volume = 1;
        if (webVoice) u.voice = webVoice;
        u.onend = () => resolve();
        u.onerror = () => resolve();
        window.speechSynthesis.speak(u);
      } catch (e) { resolve(); }
    });
  }

  window.KinesisTTS = {
    isAvailable() { return hasAndroidBridge || hasWebSpeech; },
    isAndroid() { return hasAndroidBridge; },

    warmup() {
      if (hasAndroidBridge) {
        try { window.AndroidTTS.speak('', 1.0); } catch (e) { /* noop */ }
        return;
      }
      if (!hasWebSpeech) return;
      try {
        window.speechSynthesis.cancel();
        const u = new SpeechSynthesisUtterance('');
        u.volume = 0;
        u.lang = 'es-ES';
        if (webVoice) u.voice = webVoice;
        window.speechSynthesis.speak(u);
      } catch (e) { /* noop */ }
    },

    speak(text, rate) {
      if (!text) return;
      if (hasAndroidBridge) {
        try { window.AndroidTTS.speak(String(text), normRate(rate)); } catch (e) { /* noop */ }
        return;
      }
      speakWeb(text, rate);
    },

    speakAndWait(text, rate) {
      if (!text) return Promise.resolve();
      if (hasAndroidBridge) {
        return new Promise((resolve) => {
          const id = 'klw_' + (++callbackCounter) + '_' + Date.now();
          pendingCallbacks.set(id, resolve);
          // Safety net: si el callback nunca llega (raro), liberamos la promesa
          // para no colgar la herramienta. Estimamos 120ms por carácter, mín 2s.
          const safetyMs = Math.max(2000, String(text).length * 120);
          setTimeout(() => {
            if (pendingCallbacks.has(id)) {
              pendingCallbacks.delete(id);
              resolve();
            }
          }, safetyMs);
          try {
            window.AndroidTTS.speakWithCallback(String(text), normRate(rate), id);
          } catch (e) {
            pendingCallbacks.delete(id);
            resolve();
          }
        });
      }
      return speakWebAndWait(text, rate);
    },

    cancel() {
      if (hasAndroidBridge) {
        try { window.AndroidTTS.cancel(); } catch (e) { /* noop */ }
        return;
      }
      if (hasWebSpeech) {
        try { window.speechSynthesis.cancel(); } catch (e) { /* noop */ }
      }
    }
  };
})();
