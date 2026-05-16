(function () {
  'use strict';

  if (!('serviceWorker' in navigator)) return;

  function getScriptSrc() {
    if (document.currentScript && document.currentScript.src) {
      return document.currentScript.src;
    }
    var scripts = document.getElementsByTagName('script');
    for (var i = scripts.length - 1; i >= 0; i--) {
      if (scripts[i].src && scripts[i].src.indexOf('sw-updater.js') !== -1) {
        return scripts[i].src;
      }
    }
    return location.origin + '/assets/js/sw-updater.js';
  }

  var SW_PATH = new URL('../../sw.js', getScriptSrc()).pathname;
  var UPDATE_CHECK_INTERVAL_MS = 30 * 60 * 1000;

  var bannerEl = null;
  var reloading = false;
  var hadController = !!navigator.serviceWorker.controller;

  function injectStyles() {
    if (document.getElementById('sw-updater-styles')) return;
    var style = document.createElement('style');
    style.id = 'sw-updater-styles';
    style.textContent = [
      '.sw-updater-banner {',
      '  position: fixed;',
      '  left: 50%;',
      '  bottom: 16px;',
      '  transform: translateX(-50%) translateY(calc(100% + 32px));',
      '  display: flex;',
      '  align-items: center;',
      '  gap: 12px;',
      '  padding: 12px 16px;',
      '  background: #00bec8;',
      '  color: #000806;',
      '  border-radius: 12px;',
      '  box-shadow: 0 10px 30px rgba(0,0,0,0.35);',
      '  font-family: "ABeeZee", system-ui, sans-serif;',
      '  font-size: 15px;',
      '  line-height: 1.3;',
      '  z-index: 9999;',
      '  max-width: calc(100vw - 32px);',
      '  transition: transform 0.35s ease-out;',
      '}',
      '.sw-updater-banner.is-visible {',
      '  transform: translateX(-50%) translateY(0);',
      '}',
      '.sw-updater-banner__icon {',
      '  font-family: "Material Symbols Sharp";',
      '  font-size: 22px;',
      '  flex-shrink: 0;',
      '}',
      '.sw-updater-banner__text {',
      '  flex: 1;',
      '  font-weight: 600;',
      '}',
      '.sw-updater-banner__btn {',
      '  background: #000806;',
      '  color: #00bec8;',
      '  border: none;',
      '  border-radius: 8px;',
      '  padding: 8px 14px;',
      '  font: inherit;',
      '  font-weight: 700;',
      '  cursor: pointer;',
      '  min-height: 44px;',
      '  min-width: 44px;',
      '}',
      '.sw-updater-banner__btn:hover,',
      '.sw-updater-banner__btn:focus-visible {',
      '  background: #1a1a1a;',
      '  outline: none;',
      '}',
      '.sw-updater-banner__dismiss {',
      '  background: transparent;',
      '  color: #000806;',
      '  border: none;',
      '  font: inherit;',
      '  font-size: 22px;',
      '  cursor: pointer;',
      '  padding: 4px 8px;',
      '  line-height: 1;',
      '  min-height: 44px;',
      '  min-width: 44px;',
      '}',
      '@media (max-width: 480px) {',
      '  .sw-updater-banner {',
      '    left: 12px;',
      '    right: 12px;',
      '    bottom: 12px;',
      '    transform: translateY(calc(100% + 32px));',
      '    max-width: none;',
      '  }',
      '  .sw-updater-banner.is-visible {',
      '    transform: translateY(0);',
      '  }',
      '}'
    ].join('\n');
    document.head.appendChild(style);
  }

  function showBanner(onUpdate) {
    if (bannerEl) return;
    injectStyles();

    bannerEl = document.createElement('div');
    bannerEl.className = 'sw-updater-banner';
    bannerEl.setAttribute('role', 'status');
    bannerEl.setAttribute('aria-live', 'polite');
    bannerEl.innerHTML =
      '<span class="sw-updater-banner__icon" aria-hidden="true">download</span>' +
      '<span class="sw-updater-banner__text">Nueva versi&oacute;n disponible</span>' +
      '<button type="button" class="sw-updater-banner__btn">Actualizar</button>' +
      '<button type="button" class="sw-updater-banner__dismiss" aria-label="Cerrar">&times;</button>';

    document.body.appendChild(bannerEl);
    requestAnimationFrame(function () {
      bannerEl.classList.add('is-visible');
    });

    bannerEl.querySelector('.sw-updater-banner__btn').addEventListener('click', onUpdate);
    bannerEl.querySelector('.sw-updater-banner__dismiss').addEventListener('click', function () {
      bannerEl.classList.remove('is-visible');
      setTimeout(function () {
        if (bannerEl && bannerEl.parentNode) bannerEl.parentNode.removeChild(bannerEl);
        bannerEl = null;
      }, 400);
    });
  }

  function applyUpdate(waitingWorker) {
    if (!waitingWorker) return;
    waitingWorker.postMessage({ type: 'SKIP_WAITING' });
  }

  function watchForWaiting(registration) {
    if (registration.waiting && navigator.serviceWorker.controller) {
      showBanner(function () {
        applyUpdate(registration.waiting);
      });
    }

    registration.addEventListener('updatefound', function () {
      var installing = registration.installing;
      if (!installing) return;
      installing.addEventListener('statechange', function () {
        if (installing.state === 'installed' && navigator.serviceWorker.controller) {
          showBanner(function () {
            applyUpdate(registration.waiting || installing);
          });
        }
      });
    });
  }

  navigator.serviceWorker.addEventListener('controllerchange', function () {
    if (!hadController) {
      hadController = true;
      return;
    }
    if (reloading) return;
    reloading = true;
    window.location.reload();
  });

  window.addEventListener('load', function () {
    navigator.serviceWorker.register(SW_PATH).then(function (registration) {
      watchForWaiting(registration);

      setInterval(function () {
        registration.update().catch(function () {});
      }, UPDATE_CHECK_INTERVAL_MS);

      document.addEventListener('visibilitychange', function () {
        if (document.visibilityState === 'visible') {
          registration.update().catch(function () {});
        }
      });
    });
  });
})();
