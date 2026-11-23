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

  // 9) Favoritos guardados en la memoria propia del celular (no se borran aunque el sistema limpie datos de la vista web)
  var GUARDAR = ['mde-favs', 'mde-idioma', 'mde-bienvenida'];
  if (P.Preferences) {
    try {
      var setOriginal = Storage.prototype.setItem;
      Storage.prototype.setItem = function (k, v) {
        setOriginal.apply(this, arguments);
        if (this === window.localStorage && GUARDAR.indexOf(k) >= 0) P.Preferences.set({ key: k, value: String(v) }).catch(function () {});
      };
      // Si la vista web perdió los datos pero el celular los tiene guardados, se recuperan (una sola vez)
      Promise.all(GUARDAR.map(function (k) { return P.Preferences.get({ key: k }).then(function (r) { return [k, r.value]; }); })).then(function (pares) {
        var faltaba = false;
        pares.forEach(function (kv) { if (kv[1] != null && localStorage.getItem(kv[0]) == null) { setOriginal.call(localStorage, kv[0], kv[1]); faltaba = true; } });
        if (faltaba && !sessionStorage.getItem('mde-recuperado')) { sessionStorage.setItem('mde-recuperado', '1'); location.reload(); }
      }).catch(function () {});
    } catch (e) {}
  }

  // 10) Ubicación con el permiso del celular ("Cerca de mí" y "Enviar mi ubicación" en SOS)
  if (P.Geolocation && navigator.geolocation) {
    navigator.geolocation.getCurrentPosition = function (ok, mal, opc) {
      P.Geolocation.checkPermissions().then(function (s) {
        return (s.location === 'granted' || s.coarseLocation === 'granted') ? s : P.Geolocation.requestPermissions({ permissions: ['location', 'coarseLocation'] });
      }).then(function () {
        return P.Geolocation.getCurrentPosition({ enableHighAccuracy: !!(opc && opc.enableHighAccuracy), timeout: (opc && opc.timeout) || 15000 });
      }).then(function (pos) { ok(pos); }).catch(function (e) { if (mal) mal({ code: 1, message: String(e && e.message || e) }); });
    };
  }

  // 11) Compartir (hoja de compartir del celular) desde cualquier lugar que se puede guardar en favoritos
  var fav = $('fav');
  if (fav && (P.Share || navigator.share || plataforma !== 'web')) {
    var comp = document.createElement('button');
    comp.id = 'compartir'; comp.type = 'button'; comp.setAttribute('aria-label', 'Share / Compartir');
    comp.innerHTML = '<svg viewBox="0 0 24 24" width="21" height="21" fill="none" stroke="currentColor" stroke-width="2" stroke-linecap="round" stroke-linejoin="round" aria-hidden="true"><path d="M12 3v12"/><path d="M7.5 7.5 12 3l4.5 4.5"/><path d="M5 12v7a2 2 0 0 0 2 2h10a2 2 0 0 0 2-2v-7"/></svg>';
    fav.parentNode.insertBefore(comp, fav);
    var verComp = function () { comp.hidden = fav.hidden; };
    new MutationObserver(verComp).observe(fav, { attributes: true, attributeFilter: ['hidden'] }); verComp();
    comp.addEventListener('click', function () {
      vibrar();
      var es = document.body.classList.contains('lang-es');
      var titulo = ($('toptitle') && $('toptitle').textContent) || 'Medellín';
      var datos = {
        title: titulo + ' · Medellín a un clic',
        text: es ? 'Mira «' + titulo + '» en Medellín a un clic, la guía de Medellín en tu celular.'
                 : 'Check out "' + titulo + '" in Medellín a un clic, your Medellín guide on your phone.',
        url: 'https://medellin.mokeadigital.com',
        dialogTitle: es ? 'Compartir' : 'Share'
      };
      if (P.Share) P.Share.share(datos).catch(function () {});
      else if (navigator.share) navigator.share(datos).catch(function () {});
    });
  }

  // 12) "Cerca de mí": cada lugar se puede abrir en el mapa del celular
  var lista = $('cerca-list');
  if (lista && window.MDE_LUGARES) {
    var ponerMapas = function () {
      lista.querySelectorAll('.cerca-it').forEach(function (it) {
        if (it.querySelector('.cerca-mapa')) return;
        var c = window.MDE_LUGARES[it.getAttribute('data-go')]; if (!c) return;
        var m = document.createElement('span');
        m.className = 'cerca-mapa'; m.setAttribute('role', 'button'); m.setAttribute('aria-label', 'Map / Mapa');
        m.innerHTML = '<svg viewBox="0 0 24 24" width="20" height="20" fill="none" stroke="currentColor" stroke-width="2" stroke-linecap="round" stroke-linejoin="round" aria-hidden="true"><path d="M9 4 3 6v14l6-2 6 2 6-2V4l-6 2-6-2z"/><path d="M9 4v14M15 6v14"/></svg>';
        m.addEventListener('click', function (e) {
          e.preventDefault(); e.stopPropagation(); vibrar();
          var es = document.body.classList.contains('lang-es'), n = it.querySelector(es ? 'b .es' : 'b .en') || it.querySelector('b') || it;
          var nombre = encodeURIComponent(n.textContent.trim());
          abrirApp(plataforma === 'ios' ? 'https://maps.apple.com/?ll=' + c[0] + ',' + c[1] + '&q=' + nombre
                                         : 'https://www.google.com/maps/search/?api=1&query=' + c[0] + ',' + c[1]);
        }, true);
        it.appendChild(m);
      });
    };
    new MutationObserver(ponerMapas).observe(lista, { childList: true }); ponerMapas();
  }

  // 8) Barra de estado oscura y pantalla de arranque: se quita cuando la app ya está lista
  try { if (P.StatusBar) { P.StatusBar.setStyle({ style: 'DARK' }); if (plataforma === 'android') P.StatusBar.setBackgroundColor({ color: '#0B1626' }); } } catch (e) {}
  var quitarArranque = function () { try { if (P.SplashScreen) P.SplashScreen.hide({ fadeOutDuration: 250 }); } catch (e) {} };
  if (document.readyState === 'complete') setTimeout(quitarArranque, 60); else addEventListener('load', function () { setTimeout(quitarArranque, 60); });
})();
