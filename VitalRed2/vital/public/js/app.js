import { get, set, reset, currentUser, HOME, ROLES, normEmail, lockedByOther, holdLock, releaseLock } from './store.js';
import { nextCase, nextReqId, nextApptId, activeReq, compatible, compatibleDonors, completeDonation, dispatchUnit, releaseDonor, historyOf } from './domain.js';
import { screens } from './screens.js';
import { DEFAULT_TRIP, getTrip, getHistory } from './screens-transport.js';
import { passwordIssues, go, toast, confirmModal, icon, esc, download } from './ui.js';
import { guard } from './flow.js';
import { stockNow, RESERVABLE, reportCsv, reportDoc } from './screens-ui.js';

const NAV = {
  donor: [['d/home', 'Inicio', 'home'], ['d/alert', 'Donar', 'drop'], ['d/qr', 'Citas', 'calendar'], ['d/profile', 'Perfil', 'user']],
  medical: [['m/dashboard', 'Guardia', 'clipboard'], ['m/new', 'Nueva solicitud', 'plus'], ['m/radar', 'Seguimiento', 'radar'], ['m/profile', 'Perfil', 'user']],
  transport: [['t/home', 'Inicio', 'home'], ['t/history', 'Últimos recorridos', 'route'], ['t/profile', 'Perfil', 'user']],
  bank: [['b/dash', 'Dashboard', 'chart'], ['b/appts', 'Donantes (Citas)', 'users'], ['b/fleet', 'Radar Ambulancias', 'truck'], ['b/reports', 'Reportes', 'file'], ['b/profile', 'Perfil', 'user']]
};

const NAV_PARENT = {
  't/check': 't/home', 't/manual': 't/home', 't/transit': 't/home', 't/delivery': 't/home', 't/logbook': 't/home',
  'd/triage': 'd/alert', 'd/review': 'd/alert', 'd/schedule': 'd/alert', 'd/rejected': 'd/alert', 'd/done': 'd/profile', 'd/pdf': 'd/profile',
  'm/reception': 'm/radar', 'm/none': 'm/radar', 'd/history': 'd/home', 'd/medical': 'd/home'
};

const app = document.getElementById('app');
let cleanup = null, lastPath = null;

function parseHash() {
  const [path, qs] = (location.hash.slice(2) || 'login').split('?');
  return { path, q: Object.fromEntries(new URLSearchParams(qs)) };
}

function route() {
  cleanup?.(); cleanup = null;
  let { path, q } = parseHash();
  if (path !== lastPath) { if (path === 'register' && lastPath !== 'register' && get().reg) set({ reg: null }); lastPath = path; window.scrollTo(0, 0); }
  const user = currentUser(), screen = screens[path] || (user ? screens.notfound : null);
  if (!screen) return go('login');
  if (screen.role && (!user || user.role !== screen.role)) { toast('Inicia sesión con el rol correspondiente', 'err'); return go(user ? HOME[user.role] : 'login'); }
  if (!screen.role && user && ['login', 'register'].includes(path)) return go(HOME[user.role]);
  const blocked = user && guard(path, get());
  if (blocked) { toast(blocked[1], 'err'); return go(blocked[0], true); }
  document.documentElement.dataset.theme = get().theme;
  document.body.dataset.role = user?.role || 'guest';

  const showBack = !!NAV_PARENT[path];

  const draw = () => {
    app.innerHTML = `<div class="page"><header class="hdr"><div class="row" style="flex:none">${showBack ? `<button class="btn ghost sm" data-act="back">← Volver</button>` : ''}<div class="logo" data-go="${user ? HOME[user.role] : 'splash'}"><i>${icon('drop', 18)}</i>VitalRed</div></div><div class="row" style="flex:none">${user ? `<div class="who"><b>${user.name}</b><small>${ROLES[user.role]}</small></div><button class="btn ghost sm" data-act="logout">Salir</button>` : ''}<button class="btn ghost sm" data-act="theme" aria-label="Cambiar tema">${icon(get().theme === 'dark' ? 'moon' : 'sun', 18)}</button></div></header>${user ? `<nav class="tabs">${NAV[user.role].map(([r, l, i]) => `<a href="#/${r}" class="${r === path || NAV_PARENT[path] === r ? 'on' : ''}">${icon(i, 18)}<span>${l}</span></a>`).join('')}</nav>` : ''}<main class="${screen.wide ? 'wide' : ''}">${screen.render({ q })}</main><footer>VitalRed v3.0 • Prototipo simulado • <a data-act="resetDemo">Reiniciar demo</a></footer></div>`;
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
const busyMsg = (l) => `Ya hay una sesión activa (${l.name} · ${ROLES[l.role]}) en otra pestaña. Ciérrala para iniciar con otro perfil.`;
const enter = (user) => {
  const other = lockedByOther();
  if (other) { toast(busyMsg(other), 'err'); return false; }
  set({ session: user.email }); holdLock(user);
  toast(`Bienvenido, ${user.name.split(' ')[0]}`);
  go(HOME[user.role]);
  return true;
};
const setTrip = (status) => set({ trip: { ...getTrip(), status } });
const patchReq = (p) => set({ req: { ...get().req, ...p } });
const selAppt = () => { const A = get().appts; return A.find((a) => a.id === get().selAppt) || A[0]; };
// Cambia el estado de una cita; al completarse se registra la donación en el historial del donante y avanza su solicitud
const stepAppt = (a, state) => {
  set({ appts: get().appts.map((x) => (x.id === a.id ? { ...x, state } : x)) });
  if (get().myAppt?.id === a.id) set({ myAppt: { ...get().myAppt, state } });
  if (state === 'Completada') completeDonation(a);
};

const sampleSvgPhoto = (title, color) => {
  const fill = decodeURIComponent(color);
  const esc = String(title).replace(/[<>&"']/g, (c) => ({ '<': '&lt;', '>': '&gt;', '&': '&amp;', '"': '&quot;', "'": '&#39;' }[c]));
  const svg = `<svg xmlns="http://www.w3.org/2000/svg" width="300" height="180" viewBox="0 0 300 180"><rect width="300" height="180" fill="${fill}"/><text x="50%" y="45%" dominant-baseline="middle" text-anchor="middle" fill="#ffffff" font-size="16" font-family="sans-serif">${esc}</text><text x="50%" y="65%" dominant-baseline="middle" text-anchor="middle" fill="#ffffff" font-size="12" font-family="sans-serif">VitalRed Evidence</text></svg>`;
  return `data:image/svg+xml;charset=utf-8,${encodeURIComponent(svg)}`;
};

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
    const name = val('name'), email = normEmail(val('email')), password = val('password');
    let ok = true;
    if (name.length < 3) ok = fail('name', 'Ingresa tu nombre completo');
    if (!email) ok = fail('email', 'Campo obligatorio');
    else if (!inst && !/^\S+@\S+\.\S+$/.test(email)) ok = fail('email', 'Correo con formato inválido');
    if (inst && !role) ok = fail('folio', 'Folio inválido (ej. MED-1024, TRA-2001, BAN-3005)');
    if (email && emailTaken(email)) ok = fail('email', 'Ya existe una cuenta con este dato');
    if (passwordIssues(password).length) ok = fail('password', 'La contraseña no cumple los requisitos');
    if (password !== val('password2')) ok = fail('password2', 'Las contraseñas no coinciden');
    if (donor && !(sel('gender') && sel('age') && sel('weight'))) { ok = false; toast('Completa género, edad y peso', 'err'); }
    if (!donor && !val('hospital')) ok = fail('hospital', 'Indica tu institución');
    if (!ok) return;
    const user = { name, email, password, role };
    if (donor) {
      const risky = [0, 1, 2].some((i) => sel('risk' + i) === 'yes') || sel('fem') === 'yes';
      const eligible = sel('age') === 'adult' && sel('weight') === 'ok' && !risky;
      Object.assign(user, { blood: val('blood'), status: eligible ? 'Apto para donar' : 'Diferido temporalmente', donations: 0, medical: { gender: sel('gender'), age: sel('age'), weight: sel('weight'), blood: val('blood'), risk0: sel('risk0'), risk1: sel('risk1'), risk2: sel('risk2'), fem: sel('fem') } });
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

const emailTaken = (e) => get().users.some((u) => normEmail(u.email) === e);
const medicalOf = (d) => ({ gender: d.gender, age: d.age, weight: d.weight, blood: d.blood || 'O+', risk0: d.risk0, risk1: d.risk1, risk2: d.risk2, fem: d.fem });

const REG_RULES = {
  1: (d) => {
    let ok = true;
    if ((d.name || '').trim().length < 3) ok = fail('name', 'Ingresa tu nombre completo');
    const e = normEmail(d.email);
    if (!/^\S+@\S+\.\S+$/.test(e)) ok = fail('email', 'Correo con formato inválido');
    else if (emailTaken(e)) ok = fail('email', 'Ya existe una cuenta con este correo');
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
  accept() {
    const u = currentUser(), r = activeReq();
    if (r && r.status === 'buscando' && compatible(u.blood, r.blood)) patchReq({ status: 'esperando', donor: { name: u.name, email: u.email, blood: u.blood } });
    set({ inFlow: true, flowOwner: u.email, triage: null, triageAns: null, myAppt: null, slot: null });
  },
  endFlow() { releaseDonor(currentUser().email); toast('Cita cancelada'); },
  declineFlow() { releaseDonor(currentUser().email); toast('Gracias por avisar. Seguiremos buscando otro donante'); },
  forceAssign(el) {
    const id = el.dataset.id, req = get().req?.id || 'ST-2048';
    set({ fleet: { ...(get().fleet || {}), [id]: { state: 'Asignada', req } } });
    toast(`${id} asignada a la solicitud ${req}`); route();
  },
  releaseUnit(el) {
    const f = { ...(get().fleet || {}) }; delete f[el.dataset.id];
    set({ fleet: f }); toast(`${el.dataset.id} liberada`); route();
  },
  startCampaign() {
    const groups = stockNow().filter(([, , st]) => st === 'CRÍTICO').map(([g]) => g);
    const blood = groups.length ? groups : ['O-'];
    set({ campaign: { blood, at: new Date().toISOString(), notified: blood.length * 60 + 12 } });
    toast(`Campaña iniciada para ${blood.join(', ')}`); route();
  },
  endCampaign() { set({ campaign: null }); toast('Campaña finalizada'); route(); },
  reserveReq(el) {
    const id = el.dataset.id, r = RESERVABLE.find((x) => x.id === id);
    if (!r) return;
    const cur = stockNow().find(([g]) => g === r.blood)?.[1] ?? 0;
    if (cur < r.units) return toast(`No hay ${r.units} unidades ${r.blood} disponibles`, 'err');
    set({ reserved: [...(get().reserved || []), id] }); toast(`${r.units} unidades ${r.blood} reservadas`); route();
  },
  releaseReq(el) { set({ reserved: (get().reserved || []).filter((x) => x !== el.dataset.id) }); toast('Reserva liberada'); route(); },
  detailReq(el) {
    const r = RESERVABLE.find((x) => x.id === el.dataset.id); if (!r) return;
    const held = (get().reserved || []).includes(r.id);
    confirmModal(`Solicitud ${esc(r.id)}`, `<b>${esc(r.hospital)}</b><br>${esc(r.reason)}<br>Reclama: ${r.units} unidades ${esc(r.blood)}.<br>Estado: ${held ? 'Reservada' : 'Pendiente de preparar'}.`, () => { if (!held) actions.reserveReq(el); }, held ? 'Entendido' : 'Aceptar y preparar', { cancel: 'Cerrar' });
  },
  exportCsv() { download(`reporte-trazabilidad-${new Date().toISOString().slice(0, 10)}.csv`, reportCsv()); toast('Reporte CSV descargado'); },
  exportPdf() {
    const sheet = document.createElement('div'); sheet.className = 'print-sheet'; sheet.innerHTML = reportDoc();
    document.body.append(sheet); document.body.classList.add('printing-sheet');
    const end = () => { sheet.remove(); document.body.classList.remove('printing-sheet'); removeEventListener('afterprint', end); };
    addEventListener('afterprint', end); setTimeout(end, 60000); window.print();
  },
  theme() { set({ theme: get().theme === 'dark' ? 'light' : 'dark' }); route(); },
  logout() { confirmModal('Cerrar sesión', '¿Deseas salir de VitalRed?', () => { releaseLock(); set({ session: null, reg: null }); toast('Sesión cerrada'); go('login'); }); },
  resetDemo() { confirmModal('Reiniciar demo', 'Se borrarán usuarios y datos creados.', () => { releaseLock(); reset(); go('login'); route(); }); },
  demoAlert() {
    if (activeReq()) return toast('Ya hay una solicitud en curso', 'err');
    const u = currentUser(), c = nextCase(u?.blood || 'O+');
    set({ req: { id: nextReqId(), ...c, status: 'buscando', notified: compatibleDonors(c.blood).length, demo: true, createdAt: new Date().toISOString() } });
    go('d/alert');
  },
  snooze() { set({ inFlow: false }); toast('Alerta pospuesta por 15 min', 'ok', { label: 'DESHACER (5s)', run: () => toast('Alerta reactivada') }); },
  filter(el) { set({ filter: el.dataset.v }); route(); },
  unit(el) { const u = document.getElementById('units'); u.textContent = Math.min(9, Math.max(1, +u.textContent + +el.dataset.d)); document.querySelector('main')?.dispatchEvent(new Event('selchange')); },
  pick(el) { set({ selAppt: el.dataset.id }); route(); },
  tab(el) { set({ apptTab: el.dataset.v }); route(); },
  authorize() { const a = selAppt(); if (!a) return; if (!['Programada', 'Pre-Triaje'].includes(a.state)) return toast('Esta cita ya fue procesada', 'err'); stepAppt(a, 'Extracción'); toast(`Ingreso autorizado: ${a.name}`); route(); },
  completeAppt() { const a = selAppt(); if (!a || a.state !== 'Extracción') return toast('Primero autoriza el ingreso', 'err'); stepAppt(a, 'Completada'); toast(`Donación registrada: ${a.name}`); route(); },
  dispatch() { const t = dispatchUnit(DEFAULT_TRIP); if (!t) return toast('La unidad aún no está lista para despacho', 'err'); toast(`Unidad despachada · viaje ${t.id}`); route(); },
  reject() { const a = selAppt(); if (!a || ['Completada', 'No asistió'].includes(a.state)) return toast('Esta cita ya no se puede rechazar', 'err'); stepAppt(a, 'No asistió'); if (a.email) releaseDonor(a.email); toast('Acceso rechazado', 'err'); route(); },
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
    const email = normEmail(d.email);
    if (emailTaken(email)) { r.step = 1; set({ reg: r }); toast('Ya existe una cuenta con este correo', 'err'); return route(); }
    const other = lockedByOther(); if (other) return toast(busyMsg(other), 'err');
    const user = { name: d.name.trim(), email, password: d.password, role: 'donor', blood: d.blood || 'O+', status: eligible ? 'Apto para donar' : 'Diferido temporalmente', donations: 0, medical: medicalOf(d) };
    set({ users: [...get().users, user], reg: null }); toast('¡Registro completado!'); enter(user);
  },
  confirmSlot() {
    const time = sel('slot'); if (!time) return toast('Elige un horario', 'err');
    const u = currentUser(), r = activeReq(), myAppt = { id: nextApptId(), name: u.name, email: u.email, blood: u.blood, time, state: 'Programada' };
    set({ myAppt, appts: [myAppt, ...get().appts] });
    if (r && r.donor?.email === u.email) patchReq({ status: 'programada', appt: { id: myAppt.id, time } });
    go('d/qr');
  },
  pdf() { go('d/pdf'); },
  print() { window.print(); },
  launch() {
    const blood = sel('blood'), u = currentUser();
    set({ req: { id: nextReqId(), blood, units: +document.getElementById('units').textContent, priority: sel('priority'), component: val('component'), area: val('area'), hospital: val('hospital') || u.hospital || 'Hospital General', status: 'buscando', notified: compatibleDonors(blood).length, createdAt: new Date().toISOString(), by: u.email }, inFlow: false, triage: null, triageAns: null });
    toast('Código Rojo lanzado'); go('m/radar');
  },
  cancelReq() {
    confirmModal('¿Deseas cancelar la búsqueda?', 'Afectará la atención del paciente.', () => {
      const prev = get().req, prevAppts = get().appts, prevMy = get().myAppt;
      if (prev.donor) set({ inFlow: false, triage: null, triageAns: null, myAppt: null, appts: get().appts.filter((a) => !prev.appt || a.id !== prev.appt.id) });
      patchReq({ status: 'cancelada' }); go('m/none');
      toast('Solicitud cancelada', 'ok', { label: 'Deshacer (5s)', run: () => { set({ req: prev, appts: prevAppts, myAppt: prevMy }); toast('Cancelación revertida'); go('m/radar'); } });
    }, 'Sí, cancelar');
  },
  noResp() { patchReq({ status: 'sinrespuesta' }); },
  retry() { const { donor, appt, ...rest } = get().req; set({ req: { ...rest, status: 'buscando', notified: compatibleDonors(rest.blood).length } }); toast('Ampliando radio a 15 km'); go('m/radar'); },
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
    if (t.reqId && get().req?.id === t.reqId) patchReq({ delivery: 'entregada', deliveredAt: new Date().toISOString() });
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
  simStage() {
    const r = activeReq(); if (!r) return;
    if (r.status === 'buscando') patchReq({ status: 'esperando', donor: { name: 'Donante de prueba', email: null, blood: r.blood } });
    else if (r.status === 'esperando') { const a = { id: nextApptId(), name: 'Donante de prueba', blood: r.blood, time: '09:00', state: 'Programada' }; set({ appts: [a, ...get().appts] }); patchReq({ status: 'programada', appt: { id: a.id, time: a.time } }); }
    else if (r.status === 'programada') { set({ appts: get().appts.map((a) => (a.id === r.appt?.id ? { ...a, state: 'Completada' } : a)) }); patchReq({ status: 'completada', completedAt: new Date().toISOString(), delivery: 'preparando' }); }
    else if (r.delivery === 'preparando') dispatchUnit(DEFAULT_TRIP);
    else if (r.delivery === 'en_ruta') { set({ trip: null }); patchReq({ delivery: 'entregada', deliveredAt: new Date().toISOString() }); }
    route();
  },
  sigToggle(el) { const on = el.classList.toggle('ok'); el.textContent = on ? el.dataset.done : el.dataset.todo; document.querySelector('main')?.dispatchEvent(new Event('selchange')); },
  receive() { patchReq({ status: 'cerrada', receivedAt: new Date().toISOString() }); toast('Recepción confirmada · transfusión iniciada'); go('m/radar'); },
  saveMedical() {
    const fd = Object.fromEntries(new FormData(document.getElementById('medForm'))), u = currentUser();
    const miss = ['gender', 'age', 'weight', 'risk0', 'risk1', 'risk2'].concat(fd.gender === 'f' ? ['fem'] : []).filter((n) => !fd[n]);
    document.querySelectorAll('.grp-bad').forEach((g) => g.classList.remove('grp-bad'));
    if (miss.length) { miss.forEach((n) => document.querySelector(`[data-grp="${n}"]`)?.classList.add('grp-bad')); return toast('Responde todas las preguntas para continuar', 'err'); }
    const risky = [0, 1, 2].some((i) => fd['risk' + i] === 'yes') || (fd.gender === 'f' && fd.fem === 'yes'), eligible = fd.age === 'adult' && fd.weight === 'ok' && !risky;
    const medical = { gender: fd.gender, age: fd.age, weight: fd.weight, blood: fd.blood || u.blood, risk0: fd.risk0, risk1: fd.risk1, risk2: fd.risk2, fem: fd.gender === 'f' ? fd.fem : undefined };
    set({ users: get().users.map((x) => (x.email === u.email ? { ...x, blood: medical.blood, medical, status: eligible ? 'Apto para donar' : 'Diferido temporalmente' } : x)) });
    toast(eligible ? 'Datos médicos actualizados · Apto para donar' : 'Datos actualizados · Donación diferida temporalmente'); go('d/home');
  },
  scanAppt() {
    const done = ['Completada', 'No asistió'], cur = selAppt(), next = cur && !done.includes(cur.state) ? cur : get().appts.find((a) => !done.includes(a.state));
    if (!next) return toast('No hay citas pendientes');
    const state = next.state !== 'Extracción' ? 'Extracción' : 'Completada';
    stepAppt(next, state); toast(`${next.name}: ${state}`); route();
  },
  export() { toast('Reporte NOM-253 exportado (simulado)'); }
};

// Acciones que piden confirmación (y, si es crítica, una declaración "estoy consciente").
// Devuelve null cuando todavía no corresponde confirmar (p. ej. falta un dato) para que la acción muestre su propio aviso.
const CONFIRMS = {
  accept: () => ({ title: '¿Atender esta alerta?', text: 'Iniciarás el pre-triaje médico y podrás agendar tu donación.', ok: 'Sí, quiero donar', ack: 'Estoy consciente de que mi aptitud será validada por personal médico antes de donar.' }),
  confirmTriage: () => ({ title: '¿Confirmas tus respuestas?', text: 'Una vez confirmadas no podrás modificarlas en este proceso.', ok: 'Confirmar respuestas', ack: 'Declaro que mis respuestas son verídicas y entiendo que ocultar información puede poner en riesgo a un paciente.' }),
  confirmSlot: () => (sel('slot') ? { title: '¿Confirmar tu cita?', text: `Se agendará tu donación a las <b>${esc(sel('slot'))}</b>.`, ok: 'Confirmar cita' } : null),
  endFlow: () => ({ title: '¿Cancelar tu cita?', text: 'Se liberará tu horario y tendrás que agendar de nuevo.', ok: 'Cancelar cita', cancel: 'Conservar cita' }),
  declineFlow: () => ({ title: '¿Ya no puedes donar?', text: 'Liberaremos tu lugar y avisaremos al hospital para seguir buscando otro donante.', ok: 'Sí, ya no puedo', cancel: 'Seguir con mi cita' }),
  completeAppt: () => { const a = selAppt(); return { title: '¿Registrar la donación?', text: `Se marcará como completada la extracción de <b>${esc(a?.name)}</b> y se agregará a su historial.`, ok: 'Registrar donación', ack: 'Confirmo que la extracción se realizó y que la bolsa quedó etiquetada.' }; },
  dispatch: () => ({ title: '¿Despachar la unidad?', text: `Se asignará un viaje al transportista con destino <b>${esc(get().req?.hospital)}</b>.`, ok: 'Despachar unidad', ack: 'Estoy consciente de que la unidad debe viajar entre 2 y 10 °C.' }),
  receive: () => ({ title: '¿Confirmar la recepción?', text: 'Se cerrará el caso y podrás iniciar la transfusión.', ok: 'Confirmar recepción', ack: 'Confirmo que verifiqué el sello, la integridad de la bolsa y la compatibilidad del paciente.' }),
  saveMedical: () => {
    const f = document.getElementById('medForm'), fd = f ? Object.fromEntries(new FormData(f)) : {};
    const done = ['gender', 'age', 'weight', 'risk0', 'risk1', 'risk2'].concat(fd.gender === 'f' ? ['fem'] : []).every((n) => fd[n]);
    return done ? { title: '¿Guardar tus datos médicos?', text: 'Se recalculará tu aptitud para donar con las respuestas actualizadas.', ok: 'Guardar cambios', ack: 'Declaro que los datos son verídicos y entiendo que serán validados por personal médico.' } : null;
  },
  back: () => (['d/triage', 'd/review', 'd/schedule'].includes(parseHash().path) ? { title: '¿Salir de este proceso?', text: 'Tu avance en este paso se perderá.', ok: 'Salir', cancel: 'Seguir aquí' } : null),
  launch: () => {
    const crit = sel('priority') === 'CRÍTICA', cur = get().req, replacing = cur && !['cancelada', 'programada'].includes(cur.status);
    return { title: crit ? '¿Lanzar CÓDIGO ROJO?' : '¿Lanzar la solicitud?', text: `Se alertará a donantes compatibles (${esc(sel('blood'))}) y al banco de sangre.${replacing ? ` <b>La solicitud ${esc(cur.id)} activa será reemplazada.</b>` : ''}`, ok: crit ? 'Lanzar alerta' : 'Lanzar solicitud', ack: crit ? 'Estoy consciente de que es una alerta de emergencia y de que los datos del paciente son correctos.' : undefined };
  },
  retry: () => ({ title: '¿Ampliar el radio a 15 km?', text: 'Se notificará a más donantes, incluso fuera de la zona inicial.', ok: 'Ampliar radio' }),
  external: () => ({ title: '¿Enviar a un banco externo?', text: 'La solicitud saldrá de la red local de VitalRed.', ok: 'Enviar solicitud' }),
  authorize: () => { const a = get().appts.find((x) => x.id === (get().selAppt || get().appts[0].id)); return { title: '¿Autorizar el ingreso?', text: `Se registrará el ingreso de <b>${esc(a?.name)}</b> a extracción.`, ok: 'Autorizar ingreso' }; },
  reject: () => ({ title: '¿Rechazar el acceso?', text: 'El donante no podrá continuar con su donación.', ok: 'Rechazar acceso', ack: 'Estoy consciente de que esta decisión queda registrada en la bitácora.' }),
  forceAssign: (el) => ({ title: `¿Forzar la asignación de ${esc(el.dataset.id)}?`, text: 'Se omitirá la asignación automática por cercanía y la unidad quedará asignada a la solicitud activa.', ok: 'Forzar asignación', ack: 'Estoy consciente de que esta acción interrumpe la asignación automática del sistema.' }),
  releaseUnit: (el) => ({ title: `¿Liberar ${esc(el.dataset.id)}?`, text: 'La unidad volverá a estar disponible para nuevas solicitudes.', ok: 'Liberar unidad' }),
  startCampaign: () => { const g = stockNow().filter(([, , st]) => st === 'CRÍTICO').map(([x]) => x); return { title: '¿Iniciar campaña de alerta?', text: `Se notificará a los donantes de los grupos en escasez: <b>${esc(g.join(', ') || 'O-')}</b>.`, ok: 'Iniciar campaña', ack: 'Estoy consciente de que se enviará una notificación a todos los donantes compatibles.' }; },
  endCampaign: () => ({ title: '¿Finalizar la campaña?', text: 'Los donantes dejarán de ver la convocatoria.', ok: 'Finalizar campaña' }),
  reserveReq: (el) => { const r = RESERVABLE.find((x) => x.id === el.dataset.id); return { title: '¿Aceptar y preparar la solicitud?', text: `Se reservarán <b>${r?.units} unidades ${esc(r?.blood)}</b> del inventario para ${esc(r?.hospital)}.`, ok: 'Reservar unidades' }; },
  releaseReq: () => ({ title: '¿Liberar la reserva?', text: 'Las unidades volverán al inventario disponible.', ok: 'Liberar reserva' }),
  tripRoute: () => ({ title: '¿Iniciar el traslado?', text: 'Se activará la telemetría de cadena de frío y la ruta hacia el destino.', ok: 'Iniciar traslado', ack: 'Confirmo que la bolsa fue verificada, está sellada y se mantiene entre 2 y 10 °C.' }),
  saveManual: () => (isNaN(parseFloat(val('manualTemp'))) ? null : { title: '¿Guardar la lectura manual?', text: `Se registrará <b>${esc(val('manualTemp'))} °C</b> como temperatura del traslado.`, ok: 'Guardar lectura', ack: 'Confirmo que la temperatura fue medida con un termómetro físico.' }),
  deliver: () => ({ title: '¿Finalizar la entrega?', text: 'Se cerrará el viaje y se generará la bitácora auditada.', ok: 'Finalizar entrega', ack: 'Estoy consciente de que no podré modificar el viaje después de finalizarlo.' }),
};

const runClick = (t, e) => {
  if (t.dataset.act) actions[t.dataset.act]?.(t, e);
  if (t.dataset.go && t.dataset.act !== 'cancelReq') go(t.dataset.go);
};

document.addEventListener('keydown', (e) => {
  if ((e.key === 'Enter' || e.key === ' ') && e.target.matches?.('[role=button][data-act]')) { e.preventDefault(); e.target.click(); }
});

document.addEventListener('click', (e) => {
  const t = e.target.closest('[data-act],[data-go]'); if (!t || t.disabled) return;
  const modal = e.target.closest('.modal');
  if (modal && t.dataset.act && t.dataset.act.startsWith('sim')) {
    modal.remove();
  }
  const c = CONFIRMS[t.dataset.act]?.(t);
  if (c) return confirmModal(c.title, c.text, () => runClick(t, e), c.ok, { ack: c.ack, cancel: c.cancel });
  runClick(t, e);
});

document.addEventListener('change', (e) => {
  e.target.closest('main')?.dispatchEvent(new Event('selchange'));
  const t = e.target.closest('[data-act]');
  if (t && actions[t.dataset.act]) {
    actions[t.dataset.act](t, e);
  }
});

document.addEventListener('submit', (e) => {
  e.preventDefault(); const f = e.target, b = f.querySelector('[type=submit]');
  if (!b) return forms[f.dataset.form]?.(f);
  b.classList.add('loading'); b.disabled = true;
  setTimeout(() => { b.classList.remove('loading'); b.disabled = false; forms[f.dataset.form]?.(f); }, 650);
});

addEventListener('hashchange', route);
route();
