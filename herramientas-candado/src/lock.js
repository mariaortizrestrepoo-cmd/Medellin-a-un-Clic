// ===== Candado de acceso — Mokea Digital LLC =====
(function(){
  const ACCESS_API = '__ACCESS_API__';      // URL de la función de Supabase
  const SUPPORT_WA = '16893236560';          // WhatsApp de soporte (María)
  const BUY_URL = '__BUY_URL__';             // página de venta / pago

  const LS = {
    get(k){ try { return localStorage.getItem(k); } catch(e) { return null; } },
    set(k,v){ try { localStorage.setItem(k,v); } catch(e) {} },
    del(k){ try { localStorage.removeItem(k); } catch(e) {} }
  };
  const $ = id => document.getElementById(id);
  const lock = $('lock');
  let lang = LS.get('mde-lang') || ((navigator.language||'').toLowerCase().startsWith('es') ? 'es' : 'en');

  function setLkLang(l){
    lang = l; LS.set('mde-lang', l);
    document.body.classList.toggle('lang-en', l === 'en');
    document.body.classList.toggle('lang-es', l === 'es');
    document.documentElement.lang = l;
    lock.querySelectorAll('[data-lklang]').forEach(b => b.classList.toggle('on', b.dataset.lklang === l));
  }
  lock.querySelectorAll('[data-lklang]').forEach(b => b.onclick = () => setLkLang(b.dataset.lklang));
  setLkLang(lang);

  const helpMsg = encodeURIComponent('Hi! I bought Medellín a un clic and I need help with my access. / ¡Hola! Compré Medellín a un clic y necesito ayuda con mi acceso.');
  lock.querySelectorAll('.lk-help').forEach(a => a.href = 'https://wa.me/' + SUPPORT_WA + '?text=' + helpMsg);
  lock.querySelectorAll('.lk-buy').forEach(a => a.href = BUY_URL);

  function step(name){
    lock.querySelectorAll('.lk-step').forEach(s => s.classList.toggle('on', s.dataset.step === name));
    lock.hidden = false;
    document.body.classList.add('locked');
    lock.scrollTop = 0;
  }
  lock.querySelectorAll('[data-goto]').forEach(b => b.onclick = () => step(b.dataset.goto));

  const TXT = {
    not_buyer: ['We couldn\'t find a purchase with that email. Check the spelling, or use the email you paid with.', 'No encontramos una compra con ese correo. Revise cómo lo escribió o use el correo con el que pagó.'],
    bad_email: ['Please enter a valid email.', 'Escriba un correo válido.'],
    wait: ['We just sent you a code. Please wait a minute before asking for another one.', 'Le acabamos de enviar un código. Espere un minuto para pedir otro.'],
    bad_code: ['That code isn\'t right. Please check it and try again.', 'Ese código no es correcto. Revíselo e inténtelo otra vez.'],
    expired: ['That code expired. Tap "send it again" to get a new one.', 'Ese código venció. Toque "envíelo otra vez" para recibir uno nuevo.'],
    sent: ['New code sent! Check your email.', '¡Le enviamos un código nuevo! Revise su correo.'],
    net: ['We couldn\'t connect. Check your internet and try again.', 'No pudimos conectarnos. Revise su internet e inténtelo otra vez.']
  };
  function msg(where, key, ok){
    const el = $('lk-msg-' + where);
    if (!key) { el.className = 'lk-msg'; el.textContent = ''; return; }
    el.className = 'lk-msg ' + (ok ? 'ok' : 'err');
    el.textContent = TXT[key][lang === 'es' ? 1 : 0];
  }

  function deviceId(){
    let d = LS.get('mde-device');
    if (!d) {
      d = (crypto.randomUUID ? crypto.randomUUID() : Date.now().toString(36) + Math.random().toString(36).slice(2));
      LS.set('mde-device', d);
    }
    return d;
  }

  async function api(path, body){
    const r = await fetch(ACCESS_API + '/' + path, {
      method: 'POST', headers: { 'Content-Type': 'application/json' }, body: JSON.stringify(body)
    });
    let j = {};
    try { j = await r.json(); } catch(e) {}
    j.status = r.status;
    return j;
  }

  const b64 = s => Uint8Array.from(atob(s), c => c.charCodeAt(0));
  async function openVault(keyB64){
    const raw = b64($('vault').textContent.trim());
    const key = await crypto.subtle.importKey('raw', b64(keyB64), 'AES-GCM', false, ['decrypt']);
    const plain = await crypto.subtle.decrypt({ name: 'AES-GCM', iv: raw.slice(0, 12) }, key, raw.slice(12));
    const v = JSON.parse(new TextDecoder().decode(plain));
    $('vault-slot').outerHTML = v.html;
    const sc = document.createElement('script');
    sc.textContent = v.js;
    document.body.appendChild(sc);
  }

  let started = false;
  async function unlockWith(key){
    await openVault(key);
    lock.hidden = true;
    document.body.classList.remove('locked');
    if (!started) { started = true; startApp(); }
  }

  // --- 1. pedir código
  let email = '';
  async function sendCode(isResend){
    const v = ($('lk-email').value || '').trim().toLowerCase();
    if (!isResend) {
      if (!/^[^\s@]+@[^\s@]+\.[^\s@]+$/.test(v)) { msg('email', 'bad_email'); return; }
      email = v;
    }
    const btn = isResend ? $('lk-resend') : $('lk-send');
    btn.disabled = true;
    try {
      const j = await api('request-code', { email });
      if (j.ok) {
        LS.set('mde-email', email);
        $('lk-email-show').textContent = email;
        $('lk-code').value = '';
        msg('email'); msg('code', isResend ? 'sent' : null, true);
        step('code');
        setTimeout(() => $('lk-code').focus(), 100);
      } else {
        const k = j.error === 'not_buyer' ? 'not_buyer' : j.error === 'wait' ? 'wait' : 'net';
        msg(isResend ? 'code' : 'email', k);
      }
    } catch(e) { msg(isResend ? 'code' : 'email', 'net'); }
    btn.disabled = false;
  }
  $('lk-send').onclick = () => sendCode(false);
  $('lk-email').addEventListener('keydown', e => { if (e.key === 'Enter') sendCode(false); });
  $('lk-resend').onclick = () => sendCode(true);
  $('lk-back').onclick = () => { msg('code'); step('email'); };

  // --- 2. verificar código
  async function verify(){
    const code = ($('lk-code').value || '').replace(/\D/g, '');
    if (code.length !== 6) { msg('code', 'bad_code'); return; }
    $('lk-verify').disabled = true;
    try {
      const j = await api('verify', { email, code, device: deviceId() });
      if (j.ok && j.key) {
        LS.set('mde-key', j.key); LS.set('mde-token', j.token); LS.set('mde-email', email);
        await unlockWith(j.key);
      } else if (j.error === 'limit') { step('limit'); }
      else if (j.error === 'expired') { msg('code', 'expired'); }
      else if (j.error === 'bad_code') { msg('code', 'bad_code'); }
      else { msg('code', 'net'); }
    } catch(e) { msg('code', 'net'); }
    $('lk-verify').disabled = false;
  }
  $('lk-verify').onclick = verify;
  $('lk-code').addEventListener('input', e => { e.target.value = e.target.value.replace(/\D/g, '').slice(0, 6); if (e.target.value.length === 6) verify(); });

  // --- arranque
  (async function boot(){
    const saved = LS.get('mde-email');
    if (saved) $('lk-email').value = saved;
    email = saved || '';
    if (LS.get('mde-moved')) { LS.del('mde-moved'); step('moved'); return; }
    const key = LS.get('mde-key');
    if (!key) { step('email'); return; }
    try { await unlockWith(key); }
    catch(e) { LS.del('mde-key'); step('email'); return; }
    // revisión en segundo plano: ¿sigue siendo este el celular activo?
    const tok = LS.get('mde-token');
    if (navigator.onLine && saved && tok) {
      api('check', { email: saved, device: deviceId(), token: tok }).then(j => {
        if (j.ok === false) {
          LS.del('mde-key'); LS.del('mde-token'); LS.set('mde-moved', '1');
          location.reload();
        }
      }).catch(() => {});
    }
  })();
})();
