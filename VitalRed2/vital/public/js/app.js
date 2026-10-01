import { get, set, reset, currentUser, HOME, ROLES } from './store.js';
import { screens } from './screens.js';
import { DEFAULT_TRIP, getTrip, getHistory } from './screens-transport.js';
import { passwordIssues, go, toast, confirmModal, icon } from './ui.js';

const NAV = {
  donor: [['d/home', 'Inicio', 'home'], ['d/alert', 'Donar', 'drop'], ['d/qr', 'Citas', 'calendar'], ['d/profile', 'Perfil', 'user']],
  medical: [['m/dashboard', 'Guardia', 'clipboard'], ['m/new', 'Nueva solicitud', 'plus'], ['m/radar', 'Seguimiento', 'radar'], ['m/profile', 'Perfil', 'user']],
  transport: [['t/home', 'Inicio', 'home'], ['t/history', 'Últimos recorridos', 'route'], ['t/profile', 'Perfil', 'user']],
  bank: [['b/dash', 'Dashboard', 'chart'], ['b/appts', 'Donantes (Citas)', 'users'], ['b/fleet', 'Radar Ambulancias', 'truck'], ['b/reports', 'Reportes', 'file'], ['b/profile', 'Perfil', 'user']]
};

const NAV_PARENT = {
  't/check': 't/home', 't/manual': 't/home', 't/transit': 't/home', 't/delivery': 't/home', 't/logbook': 't/home',
  'd/triage': 'd/alert', 'd/review': 'd/alert', 'd/schedule': 'd/alert', 'd/rejected': 'd/alert', 'd/done': 'd/profile', 'd/pdf': 'd/profile',
  'm/reception': 'm/radar', 'm/none': 'm/radar'
};

const app = document.getElementById('app');
let cleanup = null;

function parseHash() {
  const [path, qs] = (location.hash.slice(2) || 'login').split('?');
  return { path, q: Object.fromEntries(new URLSearchParams(qs)) };
}

function route() {
  cleanup?.(); cleanup = null;
  let { path, q } = parseHash();
  const user = currentUser(), screen = screens[path];
  if (!screen) return go(user ? HOME[user.role] : 'login');
  if (screen.role && (!user || user.role !== screen.role)) { toast('Inicia sesión con el rol correspondiente', 'err'); return go(user ? HOME[user.role] : 'login'); }
  if (!screen.role && user && ['login', 'register'].includes(path)) return go(HOME[user.role]);
  document.documentElement.dataset.theme = get().theme;
  document.body.dataset.role = user?.role || 'guest';

  const showBack = !!NAV_PARENT[path];

  const draw = () => {
    app.innerHTML = `<div class="page"><header class="hdr"><div class="row" style="flex:none">${showBack ? `<button class="btn ghost sm" data-act="back">${icon('x', 16)} ← Volver</button>` : ''}<div class="logo" data-go="${user ? HOME[user.role] : 'splash'}"><i>${icon('drop', 18)}</i>VitalRed</div></div><div class="row" style="flex:none">${user ? `<div class="who"><b>${user.name}</b><small>${ROLES[user.role]}</small></div><button class="btn ghost sm" data-act="logout">Salir</button>` : ''}<button class="btn ghost sm" data-act="theme" aria-label="Cambiar tema">${icon(get().theme === 'dark' ? 'moon' : 'sun', 18)}</button></div></header>${user ? `<nav class="tabs">${NAV[user.role].map(([r, l, i]) => `<a href="#/${r}" class="${r === path || NAV_PARENT[path] === r ? 'on' : ''}">${icon(i, 18)}<span>${l}</span></a>`).join('')}</nav>` : ''}<main class="${screen.wide ? 'wide' : ''}">${screen.render({ q })}</main><footer>VitalRed v3.0 • Prototipo simulado • <a data-act="resetDemo">Reiniciar demo</a></footer></div>`;
    cleanup?.();
    cleanup = screen.mount?.(app.querySelector('main'), draw) || null;
  };
  draw();
}

const val = (id) => document.getElementById(id)?.value.trim() ?? '';
const sel = (name) => document.querySelector(`input[name="${name}"]:checked`)?.value;
const fail = (id, msg) => {
  const i = document.getElementById(id);
  i?.classList.add('bad');
  const e = document.getElementById(id + '-err');
  if (e) e.textContent = msg;
  return false;
};
const clearErrs = () => {
  document.querySelectorAll('input.bad').forEach((i) => i.classList.remove('bad'));
  document.querySelectorAll('.err').forEach((e) => (e.textContent = ''));
};
const enter = (user) => {
  set({ session: user.email });
  toast(`Bienvenido, ${user.name.split(' ')[0]}`);
  go(HOME[user.role]);
};
const setTrip = (status) => set({ trip: { ...getTrip(), status } });
const patchReq = (p) => set({ req: { ...get().req, ...p } });

const sampleSvgPhoto = (title, color) => `data:image/svg+xml;utf8,<svg xmlns="http://www.w3.org/2000/svg" width="300" height="180" viewBox="0 0 300 180"><rect width="300" height="180" fill="${color}"/><text x="50%" y="45%" dominant-baseline="middle" text-anchor="middle" fill="%23ffffff" font-size="16" font-family="sans-serif">${title}</text><text x="50%" y="65%" dominant-baseline="middle" text-anchor="middle" fill="%23ffffff" font-size="12" font-family="sans-serif">VitalRed Evidence</text></svg>`;

const forms = {
  reg() { actions.regNext(); },
  login() {
    clearErrs();
    const email = val('email').toLowerCase(), password = val('password');
    let ok = true;
    if (!email) ok = fail('email', 'Ingresa tu correo o cédula');
    if (!password) ok = fail('password', 'Ingresa tu contraseña');
    if (!ok) return;
    const user = get().users.find((u) => u.email.toLowerCase() === email && u.password === password);
    if (!user) { fail('password', 'Credenciales incorrectas'); return toast('Correo o contraseña incorrectos', 'err'); }
    enter(user);
  },
  register(form) {
    clearErrs();
    const inst = form.dataset.role === 'inst', FOLIO = { MED: 'medical', TRA: 'transport', BAN: 'bank' };
    const role = inst ? FOLIO[val('folio').toUpperCase().slice(0, 3)] : 'donor', donor = role === 'donor';
    const name = val('name'), email = val('email').toLowerCase(), password = val('password');
    let ok = true;
    if (name.length < 3) ok = fail('name', 'Ingresa tu nombre completo');
    if (!email) ok = fail('email', 'Campo obligatorio');
    else if (!inst && !/^\S+@\S+\.\S+$/.test(email)) ok = fail('email', 'Correo con formato inválido');
    if (inst && !role) ok = fail('folio', 'Folio inválido (ej. MED-1024, TRA-2001, BAN-3005)');
    else if (get().users.some((u) => u.email === email)) ok = fail('email', 'Ya existe una cuenta con este dato');
    if (passwordIssues(password).length) ok = fail('password', 'La contraseña no cumple los requisitos');
    if (password !== val('password2')) ok = fail('password2', 'Las contraseñas no coinciden');
    if (donor && !(sel('gender') && sel('age') && sel('weight'))) { ok = false; toast('Completa género, edad y peso', 'err'); }
    if (!donor && !val('hospital')) ok = fail('hospital', 'Indica tu institución');
    if (!ok) return;
    const user = { name, email, password, role };
    if (donor) {
      const risky = [0, 1, 2].some((i) => sel('risk' + i) === 'yes') || sel('fem') === 'yes';
      const eligible = sel('age') === 'adult' && sel('weight') === 'ok' && !risky;
      Object.assign(user, { blood: val('blood'), status: eligible ? 'Apto para donar' : 'Diferido temporalmente', donations: 0 });
    } else user.hospital = val('hospital');
    set({ users: [...get().users, user] });
    toast('Cuenta creada con éxito');
    enter(user);
  }
};

const missing = (names, d) => {
  const m = names.filter((n) => !d[n]);
  m.forEach((n) => document.querySelector(`[data-grp="${n}"]`)?.classList.add('grp-bad'));
  if (m.length) toast('Responde todas las preguntas para continuar', 'err');
  return !m.length;
};

const REG_RULES = {
  1: (d) => {
    let ok = true;
    if ((d.name || '').trim().length < 3) ok = fail('name', 'Ingresa tu nombre completo');
    if (!/^\S+@\S+\.\S+$/.test(d.email || '')) ok = fail('email', 'Correo con formato inválido');
    else if (get().users.some((u) => u.email === d.email.toLowerCase())) ok = fail('email', 'Ya existe una cuenta con este correo');
    if (passwordIssues(d.password || '').length) ok = fail('password', 'La contraseña no cumple los requisitos');
    if (d.password !== d.password2) ok = fail('password2', 'Las contraseñas no coinciden');
    return ok;
  },
  2: (d) => missing(['gender', 'age', 'weight'], d),
  3: (d) => missing([0, 1, 2].map((i) => 'risk' + i).concat(d.gender === 'f' ? ['fem'] : []), d),
  4: (d) => d.terms || (toast('Acepta el aviso de privacidad', 'err'), false)
};

const actions = {
  back() {
    const { path } = parseHash();
    const parent = NAV_PARENT[path];
    if (parent) go(parent);
    else window.history.back();
  },
  toggleCheck(el) {
    const idx = el.dataset.idx;
    const t = getTrip();
    if (idx !== undefined && t) {
      t['check' + idx] = el.checked;
      set({ trip: t });
      route();
    }
  },
  toggleDeliveryScan() {
    const t = getTrip();
    if (t) {
      t.scanOk = !t.scanOk;
      set({ trip: t });
      toast(t.scanOk ? 'Código verificado' : 'Verificación removida');
      route();
    }
  },
  toggleDeliverySign() {
    const t = getTrip();
    if (t) {
      t.signOk = !t.signOk;
      set({ trip: t });
      toast(t.signOk ? 'Firma capturada' : 'Firma removida');
      route();
    }
  },
  simNormal() {
    set({ temp: 4.2, simMode: 'normal' });
    toast('Modo Normal (2 - 5.5 °C)');
    route();
  },
  simElevated() {
    set({ temp: 7.2, simMode: 'heat' });
    toast('Elevación Térmica (>6 °C) inyectada');
    route();
  },
  simOffline() {
    set({ simMode: 'offline' });
    toast('Simulación Sensor Offline');
    route();
  },
  openSimModal() {
    confirmModal('Simulador de Telemetría Térmica IoT', `<div class="stack" style="text-align:left"><p class="mut"><small>Inyección de estados para pruebas de resistencia</small></p><div class="row"><button class="btn ok sm" data-act="simNormal">🟢 Rango Normal (2-5.5 °C)</button><button class="btn warn sm" data-act="simElevated">🔴 Elevación Térmica (>6 °C)</button></div><div class="row" style="margin-top:8px"><button class="btn ghost sm" data-act="simOffline">⚠️ Sensor Offline (Pérdida)</button></div></div>`, () => {}, 'Cerrar');
  },
  eye(el) {
    const i = el.previousElementSibling, show = i.type === 'password';
    i.type = show ? 'text' : 'password';
    el.innerHTML = icon(show ? 'eyeoff' : 'eye', 18);
    el.setAttribute('aria-pressed', show);
    el.setAttribute('aria-label', show ? 'Ocultar contraseña' : 'Mostrar contraseña');
  },
  accept() { set({ inFlow: true }); },
  endFlow() { set({ inFlow: false }); toast('Cita cancelada'); },
  theme() { set({ theme: get().theme === 'dark' ? 'light' : 'dark' }); route(); },
  logout() { confirmModal('Cerrar sesión', '¿Deseas salir de VitalRed?', () => { set({ session: null }); toast('Sesión cerrada'); go('login'); }); },
  resetDemo() { confirmModal('Reiniciar demo', 'Se borrarán usuarios y datos creados.', () => { reset(); go('login'); route(); }); },
  demoAlert() { set({ req: { id: 'ST-2048', blood: 'O-', units: 2, priority: 'CRÍTICA', status: 'buscando', notified: 0, hospital: 'Hospital General' } }); go('d/alert'); },
  snooze() { set({ inFlow: false }); toast('Alerta pospuesta por 15 min', 'ok', { label: 'DESHACER (5s)', run: () => toast('Alerta reactivada') }); },
  filter(el) { set({ filter: el.dataset.v }); route(); },
  unit(el) { const u = document.getElementById('units'); u.textContent = Math.min(9, Math.max(1, +u.textContent + +el.dataset.d)); },
  pick(el) { set({ selAppt: el.dataset.id }); route(); },
  tab(el) { set({ apptTab: el.dataset.v }); route(); },
  authorize() { const id = get().selAppt || get().appts[0].id; set({ appts: get().appts.map((a) => (a.id === id ? { ...a, state: 'Extracción' } : a)) }); toast('Ingreso autorizado'); route(); },
  reject() { toast('Acceso rechazado', 'err'); },
  say(el) { toast(el.dataset.msg); },
  submitTriage() { set({ triageAns: [0, 1, 2, 3, 4].map((i) => sel('t' + i)) }); go('d/review'); },
  confirmTriage() { const pass = get().triageAns.every((v, i) => v === ['no', 'no', 'no', 'yes', 'yes'][i]); set({ triage: pass, inFlow: pass ? get().inFlow : false }); go(pass ? 'd/schedule' : 'd/rejected'); },
  regBack() { const r = get().reg || { step: 1, data: {} }; r.data = { ...r.data, ...Object.fromEntries(new FormData(document.getElementById('regForm'))) }; r.step = Math.max(1, r.step - 1); set({ reg: r }); route(); },
  regNext() {
    const r = get().reg || { step: 1, data: {} }, fd = Object.fromEntries(new FormData(document.getElementById('regForm')));
    r.data = { ...r.data, ...fd }; if (r.step === 4) r.data.terms = fd.terms;
    clearErrs(); document.querySelectorAll('.grp-bad').forEach((g) => g.classList.remove('grp-bad'));
    set({ reg: r }); if (!REG_RULES[r.step](r.data)) return;
    if (r.step < 4) { r.step++; set({ reg: r }); return route(); }
    const d = r.data, risky = [0, 1, 2].some((i) => d['risk' + i] === 'yes') || d.fem === 'yes', eligible = d.age === 'adult' && d.weight === 'ok' && !risky;
    const user = { name: d.name, email: d.email.toLowerCase(), password: d.password, role: 'donor', blood: d.blood || 'O+', status: eligible ? 'Apto para donar' : 'Diferido temporalmente', donations: 0 };
    set({ users: [...get().users, user], reg: null }); toast('¡Registro completado!'); enter(user);
  },
  confirmSlot() {
    const time = sel('slot'); if (!time) return toast('Elige un horario', 'err');
    const u = currentUser(), myAppt = { id: 'VR-2026-8891', name: u.name, time, state: 'Pre-Triaje' };
    set({ myAppt, appts: [myAppt, ...get().appts.filter((a) => a.id !== myAppt.id)] }); go('d/qr');
  },
  finishDonation() { set({ inFlow: false });
    const u = currentUser(); set({ users: get().users.map((x) => (x.email === u.email ? { ...x, donations: (x.donations || 0) + 1 } : x)), appts: get().appts.map((a) => (a.id === get().myAppt.id ? { ...a, state: 'Completada' } : a)) });
    go('d/done');
  },
  pdf() { go('d/pdf'); },
  print() { window.print(); },
  launch() {
    set({ req: { id: 'ST-' + (2049 + Math.floor(Math.random() * 50)), blood: sel('blood'), units: document.getElementById('units').textContent, priority: sel('priority'), status: 'buscando', notified: 0, hospital: currentUser().hospital || 'Hospital General' } });
    toast('Código Rojo lanzado'); go('m/radar');
  },
  cancelReq() {
    confirmModal('¿Deseas cancelar la búsqueda?', 'Afectará la atención del paciente.', () => {
      const prev = get().req; patchReq({ status: 'cancelada' }); go('m/none');
      toast('Solicitud cancelada', 'ok', { label: 'Deshacer (5s)', run: () => { set({ req: prev }); toast('Cancelación revertida'); go('m/radar'); } });
    }, 'Sí, cancelar');
  },
  noResp() { patchReq({ status: 'sinrespuesta' }); },
  retry() { patchReq({ status: 'buscando', notified: 0 }); toast('Ampliando radio a 15 km'); go('m/radar'); },
  external() { toast('Solicitud enviada a banco externo'); go('m/dashboard'); },
  saveManual() { const t = parseFloat(val('manualTemp')); if (isNaN(t)) return fail('manualTemp', 'Ingresa una temperatura válida'); set({ temp: t }); setTrip('transito'); toast('Registro manual guardado'); go('t/transit'); },
  heat() { set({ temp: 7.1, simMode: 'heat' }); route(); },
  recal() { set({ temp: 4.6, simMode: 'normal' }); toast('Sensor recalibrado, banco notificado'); route(); },
  dummyPhotoOrigin() {
    const t = getTrip();
    const dataUrl = sampleSvgPhoto(`ORIGEN: ${t.id}`, '%231570ef');
    const meta = { timestamp: new Date().toISOString(), location: t.origin, id: t.id };
    set({ trip: { ...t, photoOrigin: dataUrl, photoOriginMeta: meta } });
    toast('Fotografía de prueba agregada en origen');
    route();
  },
  dummyPhotoDelivery() {
    const t = getTrip();
    const dataUrl = sampleSvgPhoto(`ENTREGA: ${t.id}`, '%2312b76a');
    const meta = { timestamp: new Date().toISOString(), location: t.dest, id: t.id };
    set({ trip: { ...t, photoDelivery: dataUrl, photoDeliveryMeta: meta } });
    toast('Fotografía de prueba agregada en recepción');
    route();
  },
  uploadPhotoOrigin(el) {
    const file = el.files?.[0];
    if (!file) return;
    const reader = new FileReader();
    reader.onload = (e) => {
      const t = getTrip();
      const meta = { timestamp: new Date().toISOString(), location: t.origin, id: t.id };
      set({ trip: { ...t, photoOrigin: e.target.result, photoOriginMeta: meta } });
      toast('Evidencia fotográfica pre-despacho cargada');
      route();
    };
    reader.readAsDataURL(file);
  },
  uploadPhotoDelivery(el) {
    const file = el.files?.[0];
    if (!file) return;
    const reader = new FileReader();
    reader.onload = (e) => {
      const t = getTrip();
      const meta = { timestamp: new Date().toISOString(), location: t.dest, id: t.id };
      set({ trip: { ...t, photoDelivery: e.target.result, photoDeliveryMeta: meta } });
      toast('Evidencia fotográfica de recepción cargada');
      route();
    };
    reader.readAsDataURL(file);
  },
  deliver() {
    const t = getTrip(), temp = get().temp;
    const finalTrip = { ...t, status: 'entregada', temp: temp.toFixed(1) + ' °C', ok: temp <= 6 };
    set({ activeLogbook: finalTrip, tripHistory: [{ id: t.id, date: 'Hoy', origin: t.origin, dest: t.dest, dur: '22 min', temp: temp.toFixed(1) + ' °C', ok: temp <= 6, photoOrigin: t.photoOrigin, photoDelivery: t.photoDelivery, thermalLogs: t.thermalLogs }, ...getHistory()], trip: null, temp: 4.2 });
    toast('Entrega finalizada y bitácora auditada generada');
    go('t/logbook');
  },
  viewLogbook(el) {
    const id = el.id || el.dataset?.id;
    const found = getHistory().find((h) => h.id === id);
    if (found) set({ activeLogbook: found });
    go('t/logbook');
  },
  printLogbook() { window.print(); },
  tripCustody() { setTrip('custodia'); },
  tripRoute() { setTrip('transito'); },
  newTrip() { set({ trip: { ...DEFAULT_TRIP } }); route(); },
  scanAppt() {
    const next = get().appts.find((a) => !['Completada', 'No asistió'].includes(a.state));
    if (!next) return toast('No hay citas pendientes');
    const state = next.state !== 'Extracción' ? 'Extracción' : 'Completada';
    set({ appts: get().appts.map((a) => (a === next ? { ...a, state } : a)) }); toast(`${next.name}: ${state}`); route();
  },
  export() { toast('Reporte NOM-253 exportado (simulado)'); }
};

document.addEventListener('click', (e) => {
  const t = e.target.closest('[data-act],[data-go]'); if (!t || t.disabled) return;
  if (t.dataset.act) actions[t.dataset.act]?.(t, e);
  if (t.dataset.go && t.dataset.act !== 'cancelReq') go(t.dataset.go);
  t.dispatchEvent(new Event('selchange', { bubbles: true }));
});

document.addEventListener('change', (e) => {
  if (e.target.dataset.act && actions[e.target.dataset.act]) {
    actions[e.target.dataset.act](e.target, e);
  }
  e.target.dispatchEvent(new Event('selchange', { bubbles: true }));
});

document.addEventListener('submit', (e) => {
  e.preventDefault(); const f = e.target, b = f.querySelector('[type=submit]');
  if (!b) return forms[f.dataset.form]?.(f);
  b.classList.add('loading'); b.disabled = true;
  setTimeout(() => { b.classList.remove('loading'); b.disabled = false; forms[f.dataset.form]?.(f); }, 650);
});

addEventListener('hashchange', route);
route();
