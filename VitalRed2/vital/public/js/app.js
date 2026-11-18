import { get, set, reset, currentUser, HOME, ROLES, normEmail, lockedByOther, holdLock, releaseLock, getInventory, checkExpirations, getUnitExpirationInfo, addInventoryItem, updateInventoryItem, removeInventoryItem } from './store.js';
import { nextReqId, nextApptId, activeReq, donorReqFor, compatible, eligibleDonors, completeDonation, dispatchUnit, releaseDonor, takeTrip as takeTripDomain, historyOf, patchReq, addReview, CHECKS, deferralDate, deferred, fmtDateTime, ago, calculateExpirationDate } from './domain.js';
import { screens } from './screens.js';
import { DEFAULT_TRIP, getTrip, getHistory } from './screens-transport.js';
import { passwordIssues, go, toast, confirmModal, notifModal, icon, esc, download } from './ui.js';
import { guard } from './flow.js';
import { stockNow, RESERVABLE, reportCsv, reportDoc, openNewBagModal, openUnitDetailModal, openPasswordRecoveryModal, openEditProfileModal } from './screens-ui.js';
import { initFirebaseSync, syncPushState, getSyncStatus, onSyncStatusChange, openSyncModal } from './firebase-sync.js';

const NAV = {
  donor: [['d/home', 'Inicio', 'home'], ['d/alert', 'Donar', 'drop'], ['d/qr', 'Citas', 'calendar'], ['d/profile', 'Perfil', 'user']],
  medical: [['m/dashboard', 'Guardia', 'clipboard'], ['m/new', 'Nueva solicitud', 'plus'], ['m/radar', 'Seguimiento', 'radar'], ['m/profile', 'Perfil', 'user']],
  transport: [['t/home', 'Inicio', 'home'], ['t/history', 'Últimos recorridos', 'route'], ['t/profile', 'Perfil', 'user']],
  bank: [['b/dash', 'Dashboard', 'chart'], ['b/appts', 'Donantes (Citas)', 'users'], ['b/records', 'Autorizaciones', 'shield'], ['b/fleet', 'Radar Ambulancias', 'truck'], ['b/reports', 'Reportes', 'file'], ['b/profile', 'Perfil', 'user']]
};

const NAV_PARENT = {
  't/check': 't/home', 't/manual': 't/home', 't/transit': 't/home', 't/delivery': 't/home', 't/logbook': 't/home',
  'd/triage': 'd/alert', 'd/review': 'd/alert', 'd/schedule': 'd/alert', 'd/rejected': 'd/alert', 'd/done': 'd/profile', 'd/pdf': 'd/history',
  'm/reception': 'm/radar', 'm/none': 'm/radar', 'd/history': 'd/home', 'd/medical': 'd/home', 'm/detail': 'm/dashboard', 'b/evaluate': 'b/appts', 'b/deny': 'b/appts', 'b/record': 'b/records'
};

const app = document.getElementById('app');
let cleanup = null, lastPath = null;

function parseHash() {
  const [path, qs] = (location.hash.slice(2) || 'login').split('?');
  return { path, q: Object.fromEntries(new URLSearchParams(qs)) };
}

function userNotifications(user) {
  if (!user) return [];
  const list = get().notifications || [];
  return list.filter((n) => n.recipient === user.role || n.recipient === user.email || n.role === user.role);
}

function route() {
  cleanup?.(); cleanup = null;
  let { path, q } = parseHash();
  if (path !== lastPath) { if (path === 'register' && lastPath !== 'register' && get().reg) set({ reg: null }, { noSync: true }); lastPath = path; window.scrollTo(0, 0); }
  const user = currentUser(), screen = screens[path] || (user ? screens.notfound : null);
  if (!screen) return go('login');
  if (screen.role && (!user || user.role !== screen.role)) { toast('Inicia sesión con el rol correspondiente', 'err'); return go(user ? HOME[user.role] : 'login'); }
  if (!screen.role && user && ['login', 'register'].includes(path)) return go(HOME[user.role]);
  const blocked = user && guard(path, get());
  if (blocked) { toast(blocked[1], 'err'); return go(blocked[0], true); }

  document.documentElement.dataset.theme = get().theme;
  document.body.dataset.role = user?.role || 'guest';
  const showBack = !!NAV_PARENT[path];

  const notifs = userNotifications(user);
  const unreadCount = notifs.filter((n) => !n.read).length;

  const draw = () => {
    let mainHtml = '';
    try {
      mainHtml = screen.render({ q });
    } catch (err) {
      console.error('[VitalRed screen render error]', err);
      mainHtml = `
        <div class="empty-state error" role="alert" style="margin:40px auto;max-width:540px">
          <div class="empty-icon" style="color:var(--red-solid)">${icon('alert', 48)}</div>
          <h2 class="empty-title">Error al cargar la pantalla</h2>
          <p class="empty-desc">Ocurrió un error inesperado al procesar los datos de esta vista (${esc(path)}). Puedes restablecer los datos del sistema para volver a un estado consistente.</p>
          <div class="empty-action" style="display:flex;gap:10px;justify-content:center;margin-top:14px">
            <button class="btn primary sm" data-act="resetDemo" type="button" style="width:auto">Restablecer datos</button>
            <button class="btn ghost sm" onclick="location.reload()" type="button" style="width:auto">Recargar página</button>
          </div>
        </div>
      `;
    }

    app.innerHTML = `<a href="#main-content" class="skip-link">Saltar al contenido principal</a><div class="page">
      <header class="hdr">
        <div class="row" style="flex:none">
          ${showBack ? `<button class="btn ghost sm" data-act="back">← Volver</button>` : ''}
          <div class="logo" role="button" tabindex="0" data-go="${user ? HOME[user.role] : 'splash'}" aria-label="Ir al inicio de VitalRed"><i>${icon('drop', 18)}</i>VitalRed</div>
        </div>
        <div class="row" style="flex:none;align-items:center">
          ${(() => {
            const sync = getSyncStatus();
            const labels = { online: 'En vivo', connecting: 'Conectando…', local: 'Local' };
            return `<button class="cloud-pill ${sync.status}" data-act="openSyncModal" type="button" aria-label="Sincronización en la nube: ${labels[sync.status] || sync.status}. Sala: ${esc(sync.room)}" title="Sincronización en la nube (Sala: ${esc(sync.room)})"><span class="cloud-dot"></span><span>${labels[sync.status] || sync.status}</span></button>`;
          })()}
          ${user ? `
            <button class="btn ghost sm notif-btn" data-act="openNotifs" aria-label="Notificaciones (${unreadCount} no leídas)">
              ${icon('bell', 18)}
              ${unreadCount > 0 ? `<span class="notif-badge">${unreadCount > 9 ? '9+' : unreadCount}</span>` : ''}
            </button>
            <div class="who" role="button" tabindex="0" data-act="openProfile" aria-label="Ver perfil de ${esc(user.name)}" title="Ver perfil" style="cursor:pointer"><b>${esc(user.name)}</b><small>${ROLES[user.role]}</small></div>
            <button class="btn ghost sm" data-act="logout">Salir</button>
          ` : ''}
          <button class="btn ghost sm" data-act="theme" aria-label="Cambiar tema">${icon(get().theme === 'dark' ? 'moon' : 'sun', 18)}</button>
        </div>
      </header>
      ${user ? `<nav class="tabs">${NAV[user.role].map(([r, l, i]) => `<a href="#/${r}" class="${r === path || NAV_PARENT[path] === r ? 'on' : ''}">${icon(i, 18)}<span>${l}</span></a>`).join('')}</nav>` : ''}
      <main id="main-content" tabindex="-1" class="${screen.wide ? 'wide' : ''}">${mainHtml}</main>
      <footer>VitalRed v3.0 — Plataforma de Emergencias Transfusionales y Logística Biológica NOM-253 — <a href="javascript:void(0)" data-act="resetDemo" role="button">Restablecer datos</a></footer>
    </div>`;
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
  i?.setAttribute('aria-invalid', 'true');
  const e = document.getElementById(id + '-err');
  if (e) {
    e.textContent = msg;
    e.setAttribute('role', 'alert');
    e.setAttribute('aria-live', 'polite');
    if (i && !i.getAttribute('aria-describedby')) {
      i.setAttribute('aria-describedby', id + '-err');
    }
  }
  return false;
};
const clearErrs = () => {
  document.querySelectorAll('input.bad, select.bad, textarea.bad').forEach((i) => {
    i.classList.remove('bad');
    i.removeAttribute('aria-invalid');
  });
  document.querySelectorAll('.err').forEach((e) => (e.textContent = ''));
};

const reqErrors = () => {
  const e = {}, name = val('patient'), hc = val('hc'), bed = val('bed');
  if (name.length < 3) e.patient = 'Escribe el nombre completo del paciente';
  if (hc.length < 3) e.hc = 'Escribe el número de expediente (HC)';
  if (!bed) e.bed = 'Indica la cama o ubicación';
  return e;
};

const busyMsg = (l) => `Ya hay una sesión activa (${l.name} — ${ROLES[l.role]}) en otra pestaña. Ciérrala para iniciar con otro perfil.`;
const enter = (user) => {
  const other = lockedByOther();
  if (other) { toast(busyMsg(other), 'err'); return false; }
  set({ session: user.email }); holdLock(user);
  toast(`Bienvenido, ${user.name.split(' ')[0]}`);
  go(HOME[user.role]);
  return true;
};

const setTrip = (status) => { const t = getTrip(); set({ trip: { ...t, status, ...(status === 'transito' && !t.startedAt ? { startedAt: Date.now() } : {}) } }); };
const selAppt = () => { const A = get().appts; return A.find((a) => a.id === get().selAppt) || A[0]; };

const stepAppt = (a, state) => {
  set({ appts: get().appts.map((x) => (x.id === a.id ? { ...x, state } : x)) });
  if (get().myAppt?.id === a.id) set({ myAppt: { ...get().myAppt, state } });
  if (state === 'Completada') completeDonation(a);
};

const linkedReqForAppt = (a) => {
  if (!a) return null;
  const reqs = get().requests || [];
  const aEmail = normEmail(a.email);
  return reqs.find((x) =>
    (a.reqId && x.id === a.reqId) ||
    (a.id && x.appt?.id === a.id) ||
    (aEmail && x.donor?.email && normEmail(x.donor.email) === aEmail)
  ) || (a.blood ? reqs.find((x) => ['buscando', 'esperando', 'programada', 'completada'].includes(x.status) && compatible(a.blood, x.blood)) : null);
};

const applyIncomingSync = (remotePayload) => {
  if (!remotePayload || typeof remotePayload !== 'object') return;
  const curPath = parseHash().path;
  const curTrip = getTrip();

  set(remotePayload, { remote: true });

  // Si el transportista está activamente en la pantalla de ruta (t/transit):
  // No desmontar el mapa de Leaflet ni reiniciar el contador si el viaje sigue activo en la misma etapa
  if (curPath === 't/transit') {
    const newTrip = getTrip();
    if (newTrip && curTrip && newTrip.id === curTrip.id && newTrip.status === curTrip.status) {
      return;
    }
  }

  // Evitar re-renderizado destructivo si el usuario está en login/registro, interactuando con un modal o input
  if (curPath === 'login' || curPath === 'register' || document.querySelector('.modal') || document.activeElement?.matches?.('input:focus, select:focus, textarea:focus')) {
    return;
  }

  route();
};

const forms = {
  reg() { actions.regNext(); },
  login() {
    clearErrs();
    const idInput = normEmail(val('email')), password = val('password');
    let ok = true;
    if (!idInput) ok = fail('email', 'Ingresa tu correo o cédula');
    if (!password) ok = fail('password', 'Ingresa tu contraseña');
    if (!ok) return;
    const user = (get().users || []).find((u) => {
      const matchId = normEmail(u.email) === idInput
        || (u.cedula && normEmail(u.cedula) === idInput)
        || (u.folio && normEmail(u.folio) === idInput)
        || (u.license && normEmail(u.license) === idInput);
      return matchId && u.password === password;
    });
    if (!user) { fail('password', 'Credenciales incorrectas'); return toast('Correo, cédula o contraseña incorrectos', 'err'); }
    enter(user);
  },
  register(form) {
    clearErrs();
    const inst = form.dataset.role === 'inst', FOLIO = { MED: 'medical', TRA: 'transport', BAN: 'bank' };
    const folioRaw = val('folio').toUpperCase();
    const validFolioFmt = /^(MED|TRA|BAN)-[A-Z0-9]{2,10}$/.test(folioRaw);
    const role = inst ? (validFolioFmt ? FOLIO[folioRaw.slice(0, 3)] : undefined) : 'donor', donor = role === 'donor';
    const name = val('name'), rawEmail = val('email'), email = normEmail(rawEmail), password = val('password');
    let ok = true;
    if (name.length < 3) ok = fail('name', 'Ingresa tu nombre completo');
    if (!email) ok = fail('email', 'Campo obligatorio');
    else if (!inst && !/^\S+@\S+\.\S+$/.test(email)) ok = fail('email', 'Correo con formato inválido');
    else if (inst && email.includes('@') && !/^\S+@\S+\.\S+$/.test(email)) ok = fail('email', 'Correo con formato inválido');
    else if (inst && !email.includes('@') && email.length < 4) ok = fail('email', 'Ingresa un correo válido o una cédula profesional (mín. 4 caracteres)');
    if (email && emailTaken(email)) ok = fail('email', 'Ya existe una cuenta con este dato');
    if (inst && !role) ok = fail('folio', 'Folio inválido. Usa el formato MED-1024, TRA-2001 o BAN-3005');
    else if (inst && folioTaken(folioRaw)) ok = fail('folio', 'Este folio de verificación ya está registrado');
    if (passwordIssues(password).length) ok = fail('password', 'La contraseña no cumple los requisitos');
    if (password !== val('password2')) ok = fail('password2', 'Las contraseñas no coinciden');
    if (donor && !(sel('gender') && sel('age') && sel('weight'))) { ok = false; toast('Completa género, edad y peso', 'err'); }
    if (!donor && val('hospital').length < 3) ok = fail('hospital', 'Indica tu hospital o institución');
    if (!ok) return;
    const user = { name, email, password, role };
    if (donor) {
      const risky = [0, 1, 2].some((i) => sel('risk' + i) === 'yes') || (sel('gender') === 'f' && sel('fem') === 'yes');
      const eligible = sel('age') === 'adult' && sel('weight') === 'ok' && !risky;
      Object.assign(user, { blood: val('blood'), status: eligible ? 'Apto para donar' : 'Diferido temporalmente', donations: 0, medical: { gender: sel('gender'), age: sel('age'), weight: sel('weight'), blood: val('blood'), risk0: sel('risk0'), risk1: sel('risk1'), risk2: sel('risk2'), fem: sel('gender') === 'f' ? sel('fem') : undefined } });
    } else {
      user.hospital = val('hospital');
      user.folio = folioRaw;
      if (role === 'medical') {
        user.cedula = !email.includes('@') ? rawEmail.toUpperCase() : folioRaw;
        user.service = 'Urgencias / Guardia';
        user.shift = 'Matutino';
      } else if (role === 'transport') {
        user.license = folioRaw;
        user.unit = `AMB-${folioRaw.split('-')[1] || '015'}`;
        user.operatorStatus = 'En servicio';
        user.shift = 'Matutino';
      } else if (role === 'bank') {
        user.position = 'Personal de Banco de Sangre';
        user.cargo = 'Personal de Banco de Sangre';
        user.shift = 'Matutino';
      }
    }
    set({ users: [...(get().users || []), user] });
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
const emailTaken = (e) => {
  const n = normEmail(e);
  if (!n) return false;
  return (get().users || []).some((u) =>
    normEmail(u.email) === n
    || (u.cedula && normEmail(u.cedula) === n)
    || (u.folio && normEmail(u.folio) === n)
    || (u.license && normEmail(u.license) === n)
  );
};
const folioTaken = (f) => {
  const n = normEmail(f);
  if (!n) return false;
  return (get().users || []).some((u) =>
    (u.folio && normEmail(u.folio) === n)
    || (u.cedula && normEmail(u.cedula) === n)
    || (u.license && normEmail(u.license) === n)
    || normEmail(u.email) === n
  );
};
const medicalOf = (d) => ({ gender: d.gender, age: d.age, weight: d.weight, blood: d.blood || 'O+', risk0: d.risk0, risk1: d.risk1, risk2: d.risk2, fem: d.gender === 'f' ? d.fem : undefined });

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
  openSyncModal() {
    openSyncModal((newRoom) => {
      toast(`Sala cambiada a "${newRoom}". Sincronizando...`);
      initFirebaseSync(applyIncomingSync);
      route();
    });
  },
  openProfile() {
    const u = currentUser();
    if (!u) return;
    const profileRoute = NAV[u.role]?.find((n) => n[0].endsWith('/profile'))?.[0] || `${u.role[0]}/profile`;
    go(profileRoute);
  },
  openRecoverModal() {
    openPasswordRecoveryModal();
  },
  openEditProfileModal() {
    const u = currentUser();
    if (u) openEditProfileModal(u, () => route());
  },
  back() {
    const { path } = parseHash();
    const parent = NAV_PARENT[path];
    if (parent) go(parent);
    else window.history.back();
  },
  openNotifs() {
    const u = currentUser();
    if (!u) return;
    const notifs = userNotifications(u).map((n) => ({
      ...n,
      time: ago(n.at)
    }));

    notifModal(
      notifs,
      (id, targetGo) => {
        set({
          notifications: (get().notifications || []).map((n) => (n.id === id ? { ...n, read: true } : n))
        });
        route();
        if (targetGo) go(targetGo);
      },
      () => {
        set({
          notifications: (get().notifications || []).map((n) =>
            n.recipient === u.role || n.recipient === u.email || n.role === u.role ? { ...n, read: true } : n
          )
        });
        toast('Notificaciones marcadas como leídas');
        route();
      }
    );
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
  eye(el) {
    const i = el.previousElementSibling, show = i.type === 'password';
    i.type = show ? 'text' : 'password';
    el.innerHTML = icon(show ? 'eyeoff' : 'eye', 18);
    el.setAttribute('aria-pressed', show);
    el.setAttribute('aria-label', show ? 'Ocultar contraseña' : 'Mostrar contraseña');
  },
  accept() {
    const u = currentUser(), r = donorReqFor(u);
    if (r && r.status === 'buscando' && compatible(u.blood, r.blood)) {
      patchReq({ status: 'esperando', donor: { name: u.name, email: u.email, blood: u.blood } }, r.id);
    }
    set({ inFlow: true, flowOwner: u.email, triage: null, triageAns: null, myAppt: null, slot: null, ...(r?.id ? { activeReqId: r.id } : {}) });
  },
  endFlow() { releaseDonor(currentUser().email); toast('Cita cancelada'); },
  declineFlow() { releaseDonor(currentUser().email); toast('Gracias por avisar. Seguiremos buscando otro donante'); },
  forceAssign(el) {
    const id = el.dataset.id, r = activeReq() || get().req;
    const reqId = r?.id || 'ST-2048';
    set({ fleet: { ...(get().fleet || {}), [id]: { state: 'Asignada', req: reqId } } });
    if (r) {
      dispatchUnit({ ...DEFAULT_TRIP, assignedUnit: id }, r.id, { direct: true, unitId: id });
    }
    toast(`${id} asignada a la solicitud ${reqId}`);
    route();
  },
  releaseUnit(el) {
    const f = { ...(get().fleet || {}) }; delete f[el.dataset.id];
    set({ fleet: f }); toast(`${el.dataset.id} liberada`); route();
  },
  releaseTrip() {
    const cur = getTrip();
    if (!cur) return;
    const queue = get().tripQueue || [];
    if (!queue.some((q) => q.id === cur.id)) {
      queue.unshift({
        id: cur.id,
        origin: cur.origin,
        dest: cur.dest,
        content: cur.content,
        distance: cur.distance,
        eta: cur.eta,
        reqId: cur.reqId,
        area: cur.area,
        bed: cur.bed,
        priority: cur.priority,
        requester: cur.requester,
        status: 'disponible',
        publishedAt: Date.now()
      });
    }
    if (cur.reqId) {
      patchReq({ delivery: 'despachada' }, cur.reqId);
    }
    set({ trip: null, tripQueue: queue });
    toast('Viaje liberado y devuelto a la lista de disponibles', 'ok');
    go('t/home');
    route();
  },
  startCampaign() {
    const groups = stockNow().filter(([, , st]) => st === 'CRÍTICO').map(([g]) => g);
    const blood = groups.length ? groups : ['O-'];
    set({ campaign: { blood, at: new Date().toISOString(), notified: blood.length * 60 + 12 } });
    toast(`Campaña iniciada para ${blood.join(', ')}`); route();
  },
  endCampaign() { set({ campaign: null }); toast('Campaña finalizada'); route(); },
  openNewBagModal() {
    openNewBagModal(() => route());
  },
  resetInvFilters() {
    set({ invSearch: '', invBlood: 'Todos', invComponent: 'Todos', invStatus: 'Todos' });
    route();
  },
  viewBagDetail(el) {
    const id = el.dataset.id;
    const unit = (get().inventory || []).find((u) => u.id === id);
    if (!unit) return toast('Unidad no encontrada', 'err');
    openUnitDetailModal(unit, () => route());
  },
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
  exportCsv(el) {
    if (el) {
      el.classList.add('loading');
      el.setAttribute('aria-busy', 'true');
    }
    toast('Generando reporte CSV de trazabilidad...', 'ok');
    setTimeout(() => {
      download(`reporte-trazabilidad-${new Date().toISOString().slice(0, 10)}.csv`, reportCsv());
      toast('Reporte CSV descargado');
      if (el) {
        el.classList.remove('loading');
        el.removeAttribute('aria-busy');
      }
    }, 400);
  },
  exportPdf(el) {
    if (el) {
      el.classList.add('loading');
      el.setAttribute('aria-busy', 'true');
    }
    toast('Preparando vista de impresión para PDF...', 'ok');
    setTimeout(() => {
      const sheet = document.createElement('div'); sheet.className = 'print-sheet'; sheet.innerHTML = reportDoc();
      document.body.append(sheet); document.body.classList.add('printing-sheet');
      const end = () => {
        sheet.remove();
        document.body.classList.remove('printing-sheet');
        removeEventListener('afterprint', end);
        if (el) {
          el.classList.remove('loading');
          el.removeAttribute('aria-busy');
        }
      };
      addEventListener('afterprint', end);
      setTimeout(end, 60000);
      window.print();
    }, 350);
  },
  retryMap() {
    toast('Reconectando mapas y servicio de rutas...', 'ok');
    route();
  },
  theme() { set({ theme: get().theme === 'dark' ? 'light' : 'dark' }); route(); },
  logout() { confirmModal('Cerrar sesión', '¿Deseas salir de VitalRed?', () => { releaseLock(); set({ session: null, reg: null }); toast('Sesión cerrada'); go('login'); }); },
  resetDemo() {
    releaseLock();
    reset();
    set({});
    syncPushState(get());
    toast('Datos del sistema restablecidos');
    go('login');
    route();
  },
  snooze() { set({ inFlow: false }); toast('Alerta pospuesta por 15 min', 'ok', { label: 'DESHACER (5s)', run: () => toast('Alerta reactivada') }); },
  filter(el) { set({ filter: el.dataset.v }); route(); },
  unit(el) { const u = document.getElementById('units'); u.textContent = Math.min(9, Math.max(1, +u.textContent + +el.dataset.d)); document.querySelector('main')?.dispatchEvent(new Event('selchange')); },
  pick(el) { set({ selAppt: el.dataset.id }); route(); },
  tab(el) { set({ apptTab: el.dataset.v }); route(); },
  authorize() {
    const a = selAppt(); if (!a) return;
    if (!['Programada', 'Pre-Triaje'].includes(a.state)) return toast('Esta cita ya fue procesada', 'err');
    stepAppt(a, 'Extracción');
    const r = linkedReqForAppt(a);
    if (r) patchReq({ appt: { ...(r.appt || { id: a.id, time: a.time }), state: 'Extracción' } }, r.id);
    toast(`Ingreso autorizado: ${a.name}`);
    route();
  },
  approveDonation() {
    const a = selAppt(); if (!a || a.state !== 'Extracción') return toast('Primero autoriza el ingreso de la donación', 'err');
    if (![...document.querySelectorAll('.chkq')].every((c) => c.checked)) return toast('Marca los 4 controles para aprobar la donación', 'err');
    const r = linkedReqForAppt(a);
    const comp = r ? r.component : 'Sangre total';
    const today = new Date().toISOString().slice(0, 10);
    addInventoryItem({
      blood: a.blood || 'O+',
      component: comp,
      volume: comp.includes('total') ? 450 : 300,
      extractedAt: today,
      expiresAt: calculateExpirationDate(comp, today),
      donorName: a.name,
      notes: `Donación aprobada folio ${a.id}. Controles de calidad NOM-253 aprobados.`
    });
    const rec = addReview({ apptId: a.id, email: a.email || null, name: a.name, blood: a.blood, decision: 'apta', checks: CHECKS, notes: val('evalNotes'), reqId: r ? r.id : null, hospital: r ? r.hospital : null, component: comp });
    stepAppt(a, 'Completada');
    const targetReq = linkedReqForAppt(a);
    if (targetReq) {
      dispatchUnit(DEFAULT_TRIP, targetReq.id);
    }
    toast(`Donación aprobada: ${a.name}`);
    go(`b/record?id=${rec.id}`);
  },
  denyDonation() {
    const a = selAppt(), ids = [...document.querySelectorAll('.rsn:checked')].map((c) => c.value), notes = val('denyNotes');
    if (!a || ['Completada', 'Rechazada', 'No asistió'].includes(a.state)) return toast('Esta cita ya no se puede evaluar', 'err');
    if (!ids.length) return toast('Selecciona al menos un motivo', 'err');
    if (ids.includes('other') && notes.length < 5) return toast('Describe el motivo en las notas', 'err');
    const r = linkedReqForAppt(a), until = deferralDate(ids);
    const rec = addReview({ apptId: a.id, email: a.email || null, name: a.name, blood: a.blood, decision: 'no_apta', reasons: ids, notes, deferUntil: until, reqId: r ? r.id : null, hospital: r ? r.hospital : null, component: r ? r.component : 'Sangre total' });
    stepAppt(a, 'Rechazada');
    if (a.email) {
      set({ users: get().users.map((u) => (normEmail(u.email) === normEmail(a.email) ? { ...u, ...(until ? { status: 'Diferido temporalmente', deferUntil: until, deferBy: 'review' } : {}) } : u)) });
      releaseDonor(a.email, { name: a.name, reasons: ids, notes, at: new Date().toISOString(), reviewId: rec.id });
    }
    toast('Donación denegada y registrada', 'err'); go(`b/record?id=${rec.id}`);
  },
  filterRec(el) { set({ recFilter: el.dataset.v }); route(); },
  filterDonorHist(el) { set({ donorHistFilter: el.dataset.v }); route(); },
  ackNotice(el) { const id = el.id || el.dataset?.id; set({ reviews: (get().reviews || []).map((r) => (r.id === id ? { ...r, seen: true } : r)) }); route(); },
  dispatch(el) { const reqId = el?.dataset?.id; const t = dispatchUnit(DEFAULT_TRIP, reqId, { direct: true }); if (!t) return toast('La unidad aún no está lista para despacho', 'err'); toast(`Unidad despachada — viaje ${t.id}`); route(); },
  say(el) { toast(el.dataset.msg); },
  submitTriage() { set({ triageAns: [0, 1, 2, 3, 4].map((i) => sel('t' + i)) }); go('d/review'); },
  confirmTriage() { const pass = get().triageAns.every((v, i) => v === ['no', 'no', 'no', 'yes', 'yes'][i]); set({ triage: pass, inFlow: pass ? get().inFlow : false }); go(pass ? 'd/schedule' : 'd/rejected'); },
  regBack() {
    const r = get().reg || { step: 1, data: {} };
    const fd = Object.fromEntries(new FormData(document.getElementById('regForm')));
    const data = { ...r.data, ...fd };
    if (r.step === 4) data.terms = fd.terms;
    if (data.gender !== 'f') delete data.fem;
    r.data = data;
    r.step = Math.max(1, r.step - 1);
    set({ reg: r }, { noSync: true });
    route();
  },
  regNext() {
    const r = get().reg || { step: 1, data: {} }, fd = Object.fromEntries(new FormData(document.getElementById('regForm')));
    r.data = { ...r.data, ...fd };
    if (r.step === 4) r.data.terms = fd.terms;
    if (r.data.gender !== 'f') delete r.data.fem;
    clearErrs(); document.querySelectorAll('.grp-bad').forEach((g) => g.classList.remove('grp-bad'));
    set({ reg: r }, { noSync: true }); if (!REG_RULES[r.step](r.data)) return;
    if (r.step < 4) { r.step++; set({ reg: r }, { noSync: true }); return route(); }
    const d = r.data, risky = [0, 1, 2].some((i) => d['risk' + i] === 'yes') || (d.gender === 'f' && d.fem === 'yes'), eligible = d.age === 'adult' && d.weight === 'ok' && !risky;
    const email = normEmail(d.email);
    if (emailTaken(email)) { r.step = 1; set({ reg: r }, { noSync: true }); toast('Ya existe una cuenta con este correo', 'err'); return route(); }
    const other = lockedByOther(); if (other) return toast(busyMsg(other), 'err');
    const user = { name: d.name.trim(), email, password: d.password, role: 'donor', blood: d.blood || 'O+', status: eligible ? 'Apto para donar' : 'Diferido temporalmente', donations: 0, medical: medicalOf(d) };
    set({ users: [...(get().users || []), user], reg: null }); toast('¡Registro completado!'); enter(user);
  },
  confirmSlot() {
    const time = sel('slot'); if (!time) return toast('Elige un horario', 'err');
    const u = currentUser(), r = donorReqFor(u), myAppt = { id: nextApptId(), name: u.name, email: u.email, blood: u.blood, time, state: 'Programada', reqId: r?.id || null };
    set({ myAppt, appts: [myAppt, ...get().appts] });
    if (r && (normEmail(r.donor?.email) === normEmail(u.email) || r.status === 'buscando')) {
      patchReq({
        status: 'programada',
        donor: r.donor || { name: u.name, email: u.email, blood: u.blood },
        appt: { id: myAppt.id, time, state: 'Programada' }
      }, r.id);
    }
    go('d/qr');
  },
  pdf() { go('d/pdf'); },
  print() { window.print(); },
  launch() {
    clearErrs();
    const errs = reqErrors(), ids = Object.keys(errs);
    if (ids.length) { ids.forEach((i) => fail(i, errs[i])); document.getElementById(ids[0])?.focus(); return toast('Completa los datos del paciente', 'err'); }
    const blood = sel('blood'), u = currentUser(), now = Date.now();
    const newReq = {
      id: nextReqId(),
      blood,
      units: +document.getElementById('units').textContent,
      priority: sel('priority'),
      component: val('component'),
      area: val('area'),
      hospital: val('hospital') || u.hospital || 'Hospital General',
      patient: val('patient'),
      hc: val('hc'),
      bed: val('bed'),
      diagnosis: val('diagnosis'),
      requester: u.name,
      status: 'buscando',
      notified: eligibleDonors(blood).length,
      createdAt: new Date(now).toISOString(),
      by: u.email,
      log: [{ k: 'creada', at: now }, { k: 'buscando', at: now }],
      live: true
    };
    const prevRequests = get().requests || [];
    const updatedRequests = [newReq, ...prevRequests.filter((r) => r.id !== newReq.id)];
    set({
      requests: updatedRequests,
      activeReqId: newReq.id,
      req: newReq,
      inFlow: false,
      triage: null,
      triageAns: null
    });
    toast(`Solicitud ${newReq.id} lanzada al radar`);
    go('m/radar');
  },
  selectReq(el) {
    const id = el?.dataset?.id || el;
    const reqs = get().requests || [];
    const target = reqs.find((r) => r.id === id);
    if (!target) return;
    set({ activeReqId: target.id, req: target });
    route();
  },
  focusRadar(el) {
    actions.selectReq(el);
    go('m/radar');
  },
  openReception(el) {
    if (el?.dataset?.id) actions.selectReq(el);
    go('m/reception');
  },
  cancelReq(el) {
    const targetId = el?.dataset?.id;
    const prev = (targetId ? (get().requests || []).find((r) => r.id === targetId) : null) || activeReq() || get().req;
    if (!prev) return;
    if (targetId) set({ activeReqId: prev.id, req: prev });
    confirmModal('¿Deseas cancelar la búsqueda?', 'Se suspenderá la búsqueda de donantes y el traslado de hemocomponentes. Esta acción afectará la atención del paciente en Quirófano/Urgencias.', () => {
      const prevAppts = get().appts, prevMy = get().myAppt;
      if (prev.donor) set({ inFlow: false, triage: null, triageAns: null, myAppt: null, appts: get().appts.filter((a) => !prev.appt || a.id !== prev.appt.id) });
      patchReq({ status: 'cancelada' }, prev.id);
      if (prev.id) {
        const cleanQueue = (get().tripQueue || []).filter((q) => q.reqId !== prev.id);
        set({ tripQueue: cleanQueue });
      }
      const remainingActive = (get().requests || []).filter((r) => r.id !== prev.id && !['cancelada', 'cerrada'].includes(r.status));
      if (remainingActive.length) {
        set({ activeReqId: remainingActive[0].id, req: remainingActive[0] });
        go('m/radar');
      } else {
        go('m/none');
      }
      toast('Solicitud cancelada', 'ok', {
        label: 'Deshacer (5s)',
        run: () => {
          patchReq({ status: 'buscando' }, prev.id);
          set({ req: prev, activeReqId: prev.id, appts: prevAppts, myAppt: prevMy });
          toast('Cancelación revertida');
          go('m/radar');
        }
      });
    }, 'Sí, cancelar', { danger: true, cancel: 'Continuar búsqueda' });
  },
  retry() { const { donor, appt, ...rest } = get().req; set({ req: { ...rest } }); patchReq({ status: 'buscando', notified: eligibleDonors(rest.blood, rest.excluded || []).length }); toast('Ampliando radio a 15 km'); go('m/radar'); },
  external() { toast('Solicitud enviada a banco externo'); go('m/dashboard'); },
  saveManual() {
    const t = parseFloat(val('manualTemp'));
    if (isNaN(t)) return fail('manualTemp', 'Ingresa una temperatura válida');
    set({ temp: t });
    setTrip('transito');
    const cur = getTrip();
    if (cur?.reqId) patchReq({ delivery: 'en_ruta' }, cur.reqId);
    toast('Registro manual guardado');
    go('t/transit');
  },
  recal() { set({ temp: 4.6, simMode: 'normal' }); toast('Sensor recalibrado, banco notificado'); route(); },
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
    const t = getTrip(), temp = get().temp, now = Date.now();
    const finalTrip = { ...t, status: 'entregada', temp: temp.toFixed(1) + ' °C', ok: temp <= 6, deliveredAt: now };
    set({ activeLogbook: finalTrip, tripHistory: [{ id: t.id, date: fmtDateTime(now), at: now, origin: t.origin, dest: t.dest, dur: t.eta || '—', temp: temp.toFixed(1) + ' °C', ok: temp <= 6, photoOrigin: t.photoOrigin, photoDelivery: t.photoDelivery, thermalLogs: t.thermalLogs, startedAt: t.startedAt, deliveredAt: now, content: t.content }, ...getHistory()], trip: null, temp: 4.2 });
    if (t.reqId) patchReq({ delivery: 'entregada', deliveredAt: new Date(now).toISOString() }, t.reqId);
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
  tripRoute() { setTrip('transito'); const t = getTrip(); if (t?.reqId) patchReq({ delivery: 'en_ruta' }, t.reqId); },
  takeTrip(el) { const t = takeTripDomain(el.dataset.id, currentUser()); if (!t) return toast('No se pudo tomar el viaje: termina primero el viaje actual', 'err'); toast(`Viaje ${t.id} asignado a ti`); route(); },
  sigToggle(el) { const on = el.classList.toggle('ok'); el.textContent = on ? el.dataset.done : el.dataset.todo; document.querySelector('main')?.dispatchEvent(new Event('selchange')); },
  receive() { const r = activeReq() || get().req; patchReq({ status: 'cerrada', receivedAt: new Date().toISOString() }, r?.id); toast('Recepción confirmada — transfusión iniciada'); go('m/radar'); },
  saveMedical() {
    const fd = Object.fromEntries(new FormData(document.getElementById('medForm'))), u = currentUser();
    const miss = ['gender', 'age', 'weight', 'risk0', 'risk1', 'risk2'].concat(fd.gender === 'f' ? ['fem'] : []).filter((n) => !fd[n]);
    document.querySelectorAll('.grp-bad').forEach((g) => g.classList.remove('grp-bad'));
    if (miss.length) { miss.forEach((n) => document.querySelector(`[data-grp="${n}"]`)?.classList.add('grp-bad')); return toast('Responde todas las preguntas para continuar', 'err'); }
    const risky = [0, 1, 2].some((i) => fd['risk' + i] === 'yes') || (fd.gender === 'f' && fd.fem === 'yes'), eligible = fd.age === 'adult' && fd.weight === 'ok' && !risky;
    const medical = { gender: fd.gender, age: fd.age, weight: fd.weight, blood: fd.blood || u.blood, risk0: fd.risk0, risk1: fd.risk1, risk2: fd.risk2, fem: fd.gender === 'f' ? fd.fem : undefined };
    set({ users: get().users.map((x) => (x.email === u.email ? { ...x, blood: medical.blood, medical, status: eligible ? 'Apto para donar' : 'Diferido temporalmente' } : x)) });
    toast(eligible ? 'Datos médicos actualizados — Apto para donar' : 'Datos actualizados — Donación diferida temporalmente'); go('d/home');
  },
  scanAppt() {
    const done = ['Completada', 'No asistió', 'Rechazada'], cur = selAppt(), next = cur && !done.includes(cur.state) ? cur : get().appts.find((a) => !done.includes(a.state));
    if (!next) return toast('No hay citas pendientes');
    if (next.state === 'Extracción') { set({ selAppt: next.id }); toast('Evalúa la donación para aprobarla o denegarla'); return go('b/evaluate'); }
    stepAppt(next, 'Extracción'); toast(`${next.name}: Extracción`); route();
  },
  export() { toast('Reporte NOM-253 exportado (simulado)'); }
};

const CONFIRMS = {
  accept: () => ({ title: '¿Atender esta alerta?', text: 'Iniciarás el pre-triaje médico y podrás agendar tu donación.', ok: 'Sí, quiero donar', ack: 'Estoy consciente de que mi aptitud será validada por personal médico antes de donar.' }),
  confirmTriage: () => ({ title: '¿Confirmas tus respuestas?', text: 'Una vez confirmadas no podrás modificarlas en este proceso.', ok: 'Confirmar respuestas', ack: 'Declaro que mis respuestas son verídicas y entiendo que ocultar información puede poner en riesgo a un paciente.' }),
  confirmSlot: () => (sel('slot') ? { title: '¿Confirmar tu cita?', text: `Se agendará tu donación a las <b>${esc(sel('slot'))}</b>.`, ok: 'Confirmar cita' } : null),
  endFlow: () => ({ title: '¿Cancelar tu cita?', text: 'Se liberará tu horario y tendrás que agendar de nuevo.', ok: 'Cancelar cita', cancel: 'Conservar cita', danger: true }),
  declineFlow: () => ({ title: '¿Ya no puedes donar?', text: 'Liberaremos tu lugar y avisaremos al hospital para seguir buscando otro donante.', ok: 'Sí, ya no puedo', cancel: 'Seguir con mi cita', danger: true }),
  approveDonation: () => { const a = selAppt(); return [...document.querySelectorAll('.chkq')].every((c) => c.checked) ? { title: '¿Aprobar la donación?', text: `La sangre de <b>${esc(a?.name)}</b> quedará aprobada y se registrará en su historial.`, ok: 'Aprobar donación', ack: 'Confirmo que se verificaron los 4 controles y que la sangre no presenta problemas.' } : null; },
  denyDonation: () => { const a = selAppt(); return document.querySelector('.rsn:checked') ? { title: '¿Denegar la donación?', text: `Se notificará a <b>${esc(a?.name)}</b>, quedará registrado el motivo y la solicitud buscará a otro donante.`, ok: 'Denegar donación', ack: 'Estoy consciente de que esta decisión queda registrada en el historial del donante y en la bitácora.', danger: true } : null; },
  dispatch: (el) => {
    const reqId = el?.dataset?.id || activeReq()?.id || get().req?.id;
    const r = (get().requests || []).find((x) => x.id === reqId) || get().req;
    return { title: '¿Despachar la unidad?', text: `Se asignará un viaje al transportista con destino <b>${esc(r?.hospital || 'Hospital General')}</b>.`, ok: 'Despachar unidad', ack: 'Estoy consciente de que la unidad debe viajar entre 2 y 10 °C.' };
  },
  receive: () => ({ title: '¿Confirmar la recepción?', text: 'Se cerrará el caso y podrás iniciar la transfusión.', ok: 'Confirmar recepción', ack: 'Confirmo que verifiqué el sello, la integridad de la bolsa y la compatibilidad del paciente.' }),
  saveMedical: () => {
    const f = document.getElementById('medForm'), fd = f ? Object.fromEntries(new FormData(f)) : {};
    const done = ['gender', 'age', 'weight', 'risk0', 'risk1', 'risk2'].concat(fd.gender === 'f' ? ['fem'] : []).every((n) => fd[n]);
    return done ? { title: '¿Guardar tus datos médicos?', text: 'Se recalculará tu aptitud para donar con las respuestas actualizadas.', ok: 'Guardar cambios', ack: 'Declaro que los datos son verídicos y entiendo que serán validados por personal médico.' } : null;
  },
  back: () => (['d/triage', 'd/review', 'd/schedule'].includes(parseHash().path) ? { title: '¿Salir de este proceso?', text: 'Tu avance en este paso se perderá.', ok: 'Salir', cancel: 'Seguir aquí', danger: true } : null),
  launch: () => {
    if (Object.keys(reqErrors()).length) return null;
    const crit = sel('priority') === 'CRÍTICA';
    return {
      title: crit ? '¿Lanzar CÓDIGO ROJO?' : '¿Lanzar la solicitud?',
      text: `Se alertará a donantes compatibles (${esc(sel('blood'))}) y al banco de sangre. Esta solicitud se sumará a las solicitudes activas de la guardia.`,
      ok: crit ? 'Lanzar alerta' : 'Lanzar solicitud',
      ack: crit ? 'Estoy consciente de que es una alerta de emergencia y de que los datos del paciente son correctos.' : undefined
    };
  },
  retry: () => ({ title: '¿Ampliar el radio a 15 km?', text: 'Se notificará a más donantes, incluso fuera de la zona inicial.', ok: 'Ampliar radio' }),
  external: () => ({ title: '¿Enviar a un banco externo?', text: 'La solicitud saldrá de la red local de VitalRed.', ok: 'Enviar solicitud' }),
  authorize: () => { const a = get().appts.find((x) => x.id === (get().selAppt || get().appts[0].id)); return { title: '¿Autorizar el ingreso?', text: `Se registrará el ingreso de <b>${esc(a?.name)}</b> a extracción.`, ok: 'Autorizar ingreso' }; },
  forceAssign: (el) => ({ title: `¿Forzar la asignación de ${esc(el.dataset.id)}?`, text: 'Se omitirá la asignación automática por cercanía y la unidad quedará asignada a la solicitud activa.', ok: 'Forzar asignación', ack: 'Estoy consciente de que esta acción interrumpe la asignación automática del sistema.' }),
  releaseUnit: (el) => ({ title: `¿Liberar ${esc(el.dataset.id)}?`, text: 'La unidad volverá a estar disponible para nuevas solicitudes.', ok: 'Liberar unidad', danger: true }),
  startCampaign: () => { const g = stockNow().filter(([, , st]) => st === 'CRÍTICO').map(([x]) => x); return { title: '¿Iniciar campaña de alerta?', text: `Se notificará a los donantes de los grupos en escasez: <b>${esc(g.join(', ') || 'O-')}</b>.`, ok: 'Iniciar campaña', ack: 'Estoy consciente de que se enviará una notificación a todos los donantes compatibles.' }; },
  takeTrip: (el) => { const q = (get().tripQueue || []).find((x) => x.id === el.dataset.id); return { title: '¿Tomar este viaje?', text: `Serás responsable del traslado a <b>${esc(q?.dest)}</b> (${esc(q?.content)}).`, ok: 'Tomar viaje', ack: 'Confirmo que puedo realizar el traslado y mantener la bolsa entre 2 y 10 °C.' }; },
  endCampaign: () => ({ title: '¿Finalizar la campaña?', text: 'Los donantes dejarán de ver la convocatoria.', ok: 'Finalizar campaña', danger: true }),
  reserveReq: (el) => { const r = RESERVABLE.find((x) => x.id === el.dataset.id); return { title: '¿Aceptar y preparar la solicitud?', text: `Se reservarán <b>${r?.units} unidades ${esc(r?.blood)}</b> del inventario para ${esc(r?.hospital)}.`, ok: 'Reservar unidades' }; },
  releaseReq: () => ({ title: '¿Liberar la reserva?', text: 'Las unidades volverán al inventario disponible.', ok: 'Liberar reserva', danger: true }),
  tripRoute: () => ({ title: '¿Iniciar el traslado?', text: 'Se activará la telemetría de cadena de frío y la ruta hacia el destino.', ok: 'Iniciar traslado', ack: 'Confirmo que la bolsa fue verificada, está sellada y se mantiene entre 2 y 10 °C.' }),
  saveManual: () => (isNaN(parseFloat(val('manualTemp'))) ? null : { title: '¿Guardar la lectura manual?', text: `Se registrará <b>${esc(val('manualTemp'))} °C</b> como temperatura del traslado.`, ok: 'Guardar lectura', ack: 'Confirmo que la temperatura fue medida con un termómetro físico.' }),
  deliver: () => ({ title: '¿Finalizar la entrega?', text: 'Se cerrará el viaje y se generará la bitácora auditada.', ok: 'Finalizar entrega', ack: 'Estoy consciente de que no podré modificar el viaje después de finalizarlo.' }),
  releaseTrip: () => ({ title: '¿Liberar el viaje a cargo?', text: 'El traslado será cancelado y la unidad biológica regresará de inmediato a la lista de viajes disponibles para que otro transportista pueda tomarlo.', ok: 'Liberar viaje', cancel: 'Conservar viaje', danger: true }),
  resetDemo: () => ({ title: '¿Restablecer datos del sistema?', text: 'Esta acción es irreversible y eliminará todos los registros creados (solicitudes, unidades, evaluaciones e historial).', ok: 'Restablecer datos', ack: 'Estoy consciente de que se restablecerán todos los datos a su estado inicial', danger: true, cancel: 'Cancelar' }),
};

const runClick = (t, e) => {
  if (t.dataset.act) actions[t.dataset.act]?.(t, e);
  if (t.dataset.go && t.dataset.act !== 'cancelReq') go(t.dataset.go);
};

document.addEventListener('keydown', (e) => {
  if ((e.key === 'Enter' || e.key === ' ') && e.target.matches?.('[role=button][data-act], [role=tab][data-act]')) { e.preventDefault(); e.target.click(); }
});

document.addEventListener('click', (e) => {
  const t = e.target.closest('[data-act],[data-go]'); if (!t || t.disabled) return;
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

if (typeof window !== 'undefined') {
  window.__vitalred_on_local_change = (state) => {
    syncPushState(state);
  };

  onSyncStatusChange(() => {
    const pill = document.querySelector('.cloud-pill');
    if (pill) {
      const sync = getSyncStatus();
      const labels = { online: 'En vivo', connecting: 'Conectando…', local: 'Local' };
      pill.className = `cloud-pill ${sync.status}`;
      pill.title = `Sincronización en la nube (Sala: ${sync.room})`;
      pill.setAttribute('aria-label', `Sincronización en la nube: ${labels[sync.status] || sync.status}. Sala: ${sync.room}`);
      pill.innerHTML = `<span class="cloud-dot"></span><span>${labels[sync.status] || sync.status}</span>`;
    }
  });

  initFirebaseSync(applyIncomingSync);

  addEventListener('storage', (e) => {
    if (e.key === 'vitalred-v3' && e.newValue) {
      try {
        const p = JSON.parse(e.newValue);
        applyIncomingSync({
          users: p.users,
          requests: p.requests,
          trip: p.trip,
          tripQueue: p.tripQueue,
          tripHistory: p.tripHistory,
          fleet: p.fleet,
          inventory: p.inventory,
          appts: p.appts,
          reviews: p.reviews,
          donations: p.donations,
          lastDonation: p.lastDonation,
          campaign: p.campaign,
          reserved: p.reserved,
        });
      } catch {}
    }
  });
}
