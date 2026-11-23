// Medellín a un clic — comportamiento de app real, SOLO en la app de Google Play y App Store.
// Usa los complementos de Capacitor (atrás de Android, vibración, barra de estado, pantalla de arranque,
// navegador interno, abrir otras apps, voz). En el navegador se puede probar con ?nativa=ios o ?nativa=android.
(function () {
  'use strict';
  var C = window.Capacitor;
  var nativo = !!(C && C.isNativePlatform && C.isNativePlatform());
  var prueba = (new URLSearchParams(location.search).get('nativa') || '').toLowerCase();
  var plataforma = nativo ? C.getPlatform() : (prueba === 'ios' || prueba === 'android' ? prueba : 'web');
  var P = (C && C.Plugins) || {};
  var raiz = document.documentElement;
  raiz.classList.add('plat-' + plataforma);
  var $ = function (id) { return document.getElementById(id); };
  var actual = function () { try { return current; } catch (e) { return 'menu'; } };   // variable de la app
  var vibrar = function (fuerte) { try { if (P.Haptics) P.Haptics.impact({ style: fuerte ? 'MEDIUM' : 'LIGHT' }); } catch (e) {} };

  // 1) Bienvenida solo la primera vez. Después, la app abre directo en el inicio (como cualquier app).
  try {
    if (localStorage.getItem('mde-bienvenida') === '1' && (!location.hash || location.hash === '#inicio')) location.replace('#menu');
    document.addEventListener('click', function (e) { if (e.target.closest('.btn-cover')) localStorage.setItem('mde-bienvenida', '1'); }, true);
  } catch (e) {}

  // 2) Cambio de pantalla con movimiento (adelante / atrás)
  if (typeof window.show === 'function') {
    var mostrar = window.show;
    window.show = function (id) {
      var antes = actual(), volviendo = false;
      try { volviendo = historial.length > 1 && historial[historial.length - 2] === id; } catch (e) {}
      mostrar(id);
      var pg = document.querySelector('.page.on');
      if (pg && antes !== actual()) {
        pg.classList.remove('mde-adelante', 'mde-atras'); void pg.offsetWidth;
        pg.classList.add(volviendo ? 'mde-atras' : 'mde-adelante');
      }
    };
  }
  document.addEventListener('animationend', function (e) { if (e.target.classList) e.target.classList.remove('mde-adelante', 'mde-atras'); });

  // 3) Atrás: botón/gesto de Android y deslizar desde el borde izquierdo en iPhone
  function atras() {
    var modal = document.querySelector('.rsv-sim');
    if (modal) { modal.remove(); return true; }
    var a = actual();
    if (a === 'menu' || a === 'inicio') return false;
    vibrar(); $('back').click(); return true;
  }
  if (P.App) P.App.addListener('backButton', function () {
    if (!atras()) { if (P.App.minimizeApp) P.App.minimizeApp(); else P.App.exitApp(); }
  });
  if (plataforma === 'ios') {
    var x0 = null, y0 = 0, t0 = 0;
    addEventListener('touchstart', function (e) {
      var t = e.touches[0];
      if (t.clientX < 24) { x0 = t.clientX; y0 = t.clientY; t0 = Date.now(); } else x0 = null;
    }, { passive: true });
    addEventListener('touchend', function (e) {
      if (x0 === null) return;
      var t = e.changedTouches[0], dx = t.clientX - x0, dy = Math.abs(t.clientY - y0); x0 = null;
      if (dx > 70 && dy < 60 && Date.now() - t0 < 800) atras();
    }, { passive: true });
  }

  // 4) Enlaces: las páginas de afuera se abren en el navegador interno de la app; WhatsApp, mapas y llamadas
  //    abren su propia app. En iPhone, los mapas abren en Apple Maps.
  function abrirApp(url) {
    if (P.AppLauncher) P.AppLauncher.openUrl({ url: url }).catch(function () { window.open(url, '_system'); });
    else window.open(url, '_blank');
  }
  document.addEventListener('click', function (e) {
    var a = e.target.closest && e.target.closest('a[href]'); if (!a || e.defaultPrevented) return;
    var u; try { u = new URL(a.href); } catch (_) { return; }
    if (!/^https?:$/.test(u.protocol) || u.origin === location.origin) return;   // tel:, mailto: y páginas propias: normal
    e.preventDefault(); vibrar();
    if (/(^|\.)google\.[a-z.]+$/.test(u.hostname) && /^\/maps/.test(u.pathname)) {
      var q = u.searchParams.get('query') || u.searchParams.get('q');
      abrirApp(plataforma === 'ios' && q ? 'https://maps.apple.com/?q=' + encodeURIComponent(q) : u.href);
      return;
    }
    if (/^(wa\.me|api\.whatsapp\.com|chat\.whatsapp\.com)$/.test(u.hostname)) { abrirApp(u.href); return; }
    if (P.Browser) P.Browser.open({ url: u.href, toolbarColor: '#0B1626', presentationStyle: 'popover' });
    else window.open(u.href, '_blank', 'noopener');
  }, true);

  // 5) Vibración suave al tocar la barra de abajo, las tarjetas y los favoritos
  document.addEventListener('click', function (e) {
    if (e.target.closest('.bar button, [data-go], .fav, .hx-chips button, .sos-btn, .tel-l')) vibrar();
  }, true);

  // 6) Frases con audio: voz del celular (en Android la ventana de la app no trae voz propia)
  if (P.TextToSpeech) document.addEventListener('click', function (e) {
    var b = e.target.closest('.fr'); if (!b || !b.dataset.say) return;
    e.stopImmediatePropagation(); e.preventDefault(); vibrar();
    var hablar = function (lang) { return P.TextToSpeech.speak({ text: b.dataset.say, lang: lang, rate: 0.9 }); };
    P.TextToSpeech.stop().catch(function () {}).then(function () { return hablar('es-CO'); }).catch(function () { return hablar('es-ES'); }).catch(function () {});
  }, true);

  // 7) Fotos que todavía se están cargando: aparecen suave
  document.querySelectorAll('img').forEach(function (img) {
    if (img.complete) return;
    img.classList.add('mde-cargando');
    var listo = function () { img.classList.remove('mde-cargando'); };
    img.addEventListener('load', listo, { once: true }); img.addEventListener('error', listo, { once: true });
  });

  // 8) Barra de estado oscura y pantalla de arranque: se quita cuando la app ya está lista
  try { if (P.StatusBar) { P.StatusBar.setStyle({ style: 'DARK' }); if (plataforma === 'android') P.StatusBar.setBackgroundColor({ color: '#0B1626' }); } } catch (e) {}
  var quitarArranque = function () { try { if (P.SplashScreen) P.SplashScreen.hide({ fadeOutDuration: 250 }); } catch (e) {} };
  if (document.readyState === 'complete') setTimeout(quitarArranque, 60); else addEventListener('load', function () { setTimeout(quitarArranque, 60); });
})();
