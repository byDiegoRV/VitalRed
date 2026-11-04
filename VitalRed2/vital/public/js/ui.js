const ICONS = {
  drop: '<path d="M12 3c3.5 4 6 7 6 10a6 6 0 0 1-12 0c0-3 2.5-6 6-10z"/>',
  home: '<path d="M3 11l9-8 9 8"/><path d="M5 10v10h14V10"/>',
  calendar: '<rect x="3" y="5" width="18" height="16" rx="2"/><path d="M3 10h18M8 3v4M16 3v4"/>',
  user: '<circle cx="12" cy="8" r="4"/><path d="M4 21c0-4 4-6 8-6s8 2 8 6"/>',
  alert: '<path d="M12 3l10 18H2L12 3z"/><path d="M12 10v5M12 18v.01"/>',
  bell: '<path d="M6 16v-5a6 6 0 0 1 12 0v5l2 2H4l2-2z"/><path d="M10 21h4"/>',
  truck: '<path d="M2 6h11v10H2zM13 9h5l4 4v3h-9"/><circle cx="7" cy="18" r="2"/><circle cx="17" cy="18" r="2"/>',
  check: '<path d="M4 12l5 5L20 6"/>',
  clipboard: '<rect x="5" y="4" width="14" height="17" rx="2"/><path d="M9 4h6v3H9zM9 13l2 2 4-4"/>',
  route: '<circle cx="6" cy="18" r="2"/><circle cx="18" cy="6" r="2"/><path d="M8 18h7a3 3 0 0 0 0-6H9a3 3 0 0 1 0-6h7"/>',
  file: '<path d="M6 3h8l4 4v14H6z"/><path d="M14 3v4h4M9 13h6M9 17h6"/>',
  chart: '<path d="M4 20V10M10 20V4M16 20v-8M22 20H2"/>',
  users: '<circle cx="9" cy="8" r="3.5"/><path d="M2 20c0-3.5 3-5.5 7-5.5s7 2 7 5.5M17 5a3.5 3.5 0 0 1 0 6M22 20c0-2.5-1.5-4.2-4-5"/>',
  sun: '<circle cx="12" cy="12" r="4"/><path d="M12 2v2M12 20v2M2 12h2M20 12h2M5 5l1.5 1.5M17.5 17.5L19 19M5 19l1.5-1.5M17.5 6.5L19 5"/>',
  moon: '<path d="M20 14A8 8 0 0 1 10 4a8 8 0 1 0 10 10z"/>',
  eye: '<path d="M2 12s4-7 10-7 10 7 10 7-4 7-10 7S2 12 2 12z"/><circle cx="12" cy="12" r="3"/>',
  eyeoff: '<path d="M3 3l18 18M10.5 6.2A9 9 0 0 1 12 5c6 0 10 7 10 7a17 17 0 0 1-3 3.7M6.5 7A17 17 0 0 0 2 12s4 7 10 7c1.5 0 2.8-.4 4-1M9.9 10A3 3 0 0 0 14 14"/>',
  hospital: '<rect x="4" y="3" width="16" height="18" rx="1"/><path d="M12 8v6M9 11h6M10 21v-4h4v4"/>',
  radar: '<circle cx="12" cy="12" r="9"/><circle cx="12" cy="12" r="4"/><path d="M12 12l6-6"/>',
  x: '<circle cx="12" cy="12" r="9"/><path d="M9 9l6 6M15 9l-6 6"/>',
  shield: '<path d="M12 3l8 3v6c0 5-3.5 8-8 9-4.5-1-8-4-8-9V6l8-3z"/>',
  bolt: '<path d="M13 2L4 14h7l-1 8 9-12h-7l1-8z"/>',
  thermo: '<path d="M10 14V5a2 2 0 0 1 4 0v9a4 4 0 1 1-4 0z"/>',
  plus: '<path d="M12 5v14M5 12h14"/>',
  heart: '<path d="M12 21s-8-5.5-8-11a4.5 4.5 0 0 1 8-2.5A4.5 4.5 0 0 1 20 10c0 5.5-8 11-8 11z"/>',
};
export const icon = (name, size = 20) => `<svg class="ic" width="${size}" height="${size}" viewBox="0 0 24 24" aria-hidden="true">${ICONS[name] || ''}</svg>`;
// Navega a una ruta; si ya estás en ella, vuelve a dibujarla (así los cambios de estado se reflejan).
export const go = (route, replace = false) => {
  const target = '#/' + route;
  if (location.hash === target) return dispatchEvent(new Event('hashchange'));
  if (replace) location.replace(target); else location.hash = target;
};
export const esc = (v) => String(v ?? '').replace(/[<>&"']/g, (c) => ({ '<': '&lt;', '>': '&gt;', '&': '&amp;', '"': '&quot;', "'": '&#39;' }[c]));
// Descarga un archivo generado en el navegador (CSV, etc.)
export function download(name, content, type = 'text/csv;charset=utf-8') {
  const url = URL.createObjectURL(new Blob(['\ufeff' + content], { type }));
  const a = document.createElement('a');
  a.href = url; a.download = name; document.body.append(a); a.click(); a.remove();
  setTimeout(() => URL.revokeObjectURL(url), 1000);
}
const attrs = (o) => `${o.go ? `data-go="${o.go}"` : ''} ${o.act ? `data-act="${o.act}"` : ''} ${o.id ? `id="${o.id}"` : ''} ${o.dis ? 'disabled' : ''} ${o.type ? `type="${o.type}"` : ''}`;
export const btn = (label, o = {}) => `<button class="btn ${o.v || 'primary'} ${o.cls || ''}" ${attrs(o)}>${label}</button>`;
export const card = (inner, cls = '') => `<section class="card ${cls}">${inner}</section>`;
export const badge = (text, color = '') => `<span class="badge ${color}">${text}</span>`;
export const field = (id, label, type = 'text', ph = '', val = '') => {
  const input = `<input id="${id}" name="${id}" type="${type}" placeholder="${ph}" value="${val}" autocomplete="off">`;
  const control = type === 'password' ? `<span class="pw">${input}<button type="button" class="eye" data-act="eye" aria-label="Mostrar contraseña" aria-pressed="false">${icon('eye', 18)}</button></span>` : input;
  return `<label class="field"><span>${label}</span>${control}<small class="err" id="${id}-err"></small></label>`;
};
export const toggle = (name, options, cur, cls = '') =>
  `<div class="tog ${cls}" role="radiogroup" data-grp="${name}">${options.map(([v, l, sub]) => `<label class="tbtn"><input type="radio" name="${name}" value="${v}" ${String(cur) === String(v) ? 'checked' : ''}><span>${l}${sub ? `<small>${sub}</small>` : ''}</span></label>`).join('')}</div>`;
export const flow = (n, label) => `<div class="flow"><div class="flowbar">${[1, 2, 3, 4].map((i) => `<i class="${i <= n ? 'on' : ''}"></i>`).join('')}</div><small class="lbl">PASO ${n} DE 4 · ${label}</small></div>`;
export const stepper = (steps, index) =>
  `<ol class="stepper">${steps.map((s, i) => `<li class="${i < index ? 'done' : i === index ? 'on' : ''}">${s}</li>`).join('')}</ol>`;
export const statusScreen = (glyph, title, text, actions) =>
  card(`<div class="center stack"><div class="big">${glyph}</div><h2>${title}</h2><p class="mut">${text}</p>${actions}</div>`);

export function toast(message, type = 'ok', action) {
  const el = document.createElement('div');
  el.className = `toast ${type}`;
  el.innerHTML = `<span>${message}</span>${action ? `<button>${action.label}</button>` : ''}`;
  if (action) el.querySelector('button').onclick = () => { action.run(); el.remove(); };
  document.getElementById('toasts').append(el);
  setTimeout(() => el.remove(), action ? 5000 : 3200);
}
// Confirmación accesible: foco atrapado, Esc cierra y, si se pasa opts.ack, exige marcar la casilla "estoy consciente".
export function confirmModal(title, text, onOk, okLabel = 'Confirmar', opts = {}) {
  const prev = document.activeElement;
  const m = document.createElement('div');
  m.className = 'modal';
  m.setAttribute('role', 'alertdialog'); m.setAttribute('aria-modal', 'true');
  m.setAttribute('aria-labelledby', 'modalTitle'); m.setAttribute('aria-describedby', 'modalText');
  const ack = opts.ack ? `<label class="ack"><input type="checkbox" id="modalAck"><span>${opts.ack}</span></label>` : '';
  m.innerHTML = card(`<h2 id="modalTitle">${title}</h2><p class="mut" id="modalText" style="margin:8px 0 16px">${text}</p>${ack}<div class="row"><button class="btn ghost" data-x>${opts.cancel || 'Volver'}</button><button class="btn primary" data-ok${opts.ack ? ' disabled' : ''}>${okLabel}</button></div>`);
  const ok = m.querySelector('[data-ok]'), box = m.querySelector('#modalAck');
  const onKey = (e) => {
    if (e.key === 'Escape') { e.stopPropagation(); close(); return; }
    if (e.key !== 'Tab') return;
    const f = [...m.querySelectorAll('input,button:not([disabled])')];
    if (!f.length) return;
    const first = f[0], last = f[f.length - 1];
    if (e.shiftKey && document.activeElement === first) { e.preventDefault(); last.focus(); }
    else if (!e.shiftKey && document.activeElement === last) { e.preventDefault(); first.focus(); }
  };
  function close() { document.removeEventListener('keydown', onKey, true); m.remove(); if (prev && prev.isConnected) prev.focus(); }
  box?.addEventListener('change', () => { ok.disabled = !box.checked; });
  m.onclick = (e) => {
    if (e.target === m || e.target.dataset.x !== undefined) close();
    if (e.target.dataset.ok !== undefined && !ok.disabled) { close(); onOk(); }
  };
  document.addEventListener('keydown', onKey, true);
  document.body.append(m);
  (box || m.querySelector('[data-x]')).focus();
}
export const qrPattern = (seed) => Array.from({ length: 121 }, (_, i) => `<i class="${((i * 7 + seed.length * (i % 5) + i * i) % 3) ? 'w' : ''}"></i>`).join('');

export const PW_RULES = [['8 o más caracteres', (p) => p.length >= 8], ['Una letra mayúscula', (p) => /[A-Z]/.test(p)], ['Una letra minúscula', (p) => /[a-z]/.test(p)], ['Un número', (p) => /\d/.test(p)], ['Un carácter especial (!@#$%…)', (p) => /[^A-Za-z0-9]/.test(p)]];
export const passwordIssues = (p) => PW_RULES.filter(([, ok]) => !ok(p)).map(([label]) => label);
export const pwRules = () => `<ul class="rules" id="pwRules">${PW_RULES.map(([l]) => `<li>${icon('check', 14)}${l}</li>`).join('')}</ul>`;
export function bindPwRules(root) {
  const input = root.querySelector('#password'), list = root.querySelector('#pwRules');
  if (!input || !list) return;
  const update = () => PW_RULES.forEach(([, ok], i) => list.children[i].classList.toggle('met', ok(input.value)));
  input.addEventListener('input', update); update();
  return () => input.removeEventListener('input', update);
}
