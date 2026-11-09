const KEY = 'vitalred-v3', SESSION = 'vitalred-session', BOOT = 'vitalred-boot', LOCK = 'vitalred-lock';
const TAB = Math.random().toString(36).slice(2);
const DEFAULT_MEDICAL = { gender: 'm', age: 'adult', weight: 'ok', blood: 'O+', risk0: 'no', risk1: 'no', risk2: 'no' };

const seedNotifs = () => [
  { id: 'notif-1', recipient: 'donor', title: 'Alerta Código Rojo', text: 'Hospital General solicita sangre O- con prioridad inmediata.', type: 'alert', at: Date.now() - 15 * 60000, read: false, go: 'd/alert' },
  { id: 'notif-2', recipient: 'donor', title: 'Recordatorio NOM-253', text: 'Recuerda mantener ayuno de al menos 4 horas antes de acudir a tu cita.', type: 'shield', at: Date.now() - 120 * 60000, read: true, go: 'd/home' },
  { id: 'notif-3', recipient: 'medical', title: 'Donante en camino', text: 'Un donante voluntario O- aceptó la alerta de la solicitud ST-2048.', type: 'check', at: Date.now() - 20 * 60000, read: false, go: 'm/radar' },
  { id: 'notif-4', recipient: 'medical', title: 'Inventario de Cám. Frigoríficas', text: 'Grupos B- y AB- en niveles críticos según el último reporte.', type: 'alert', at: Date.now() - 180 * 60000, read: true, go: 'm/dashboard' },
  { id: 'notif-5', recipient: 'bank', title: 'Solicitud Entrante Urgente', text: 'Urgencias Hospital General solicita 2 u. Concentrado de hematíes O-.', type: 'alert', at: Date.now() - 10 * 60000, read: false, go: 'b/dash' },
  { id: 'notif-6', recipient: 'bank', title: 'Pase Digital Agendado', text: 'Cita programada para hoy a las 08:30 con código de verificación QR.', type: 'calendar', at: Date.now() - 45 * 60000, read: false, go: 'b/appts' },
  { id: 'notif-7', recipient: 'transport', title: 'Viaje disponible en Banco', text: 'Nueva unidad biológica lista para despacho hacia Hospital General.', type: 'truck', at: Date.now() - 5 * 60000, read: false, go: 't/home' }
];

const seed = () => ({
  theme: matchMedia('(prefers-color-scheme: dark)').matches ? 'dark' : 'light',
  session: null,
  users: [
    { name: 'Aleks López', email: 'donante@vitalred.org', password: 'Donante123', role: 'donor', blood: 'O+', status: 'Apto para donar', donations: 4, medical: DEFAULT_MEDICAL },
    { name: 'Dra. Ana Torres', email: 'medico@vitalred.org', password: 'Medico123', role: 'medical', hospital: 'Hospital General' },
    { name: 'Luis Pérez', email: 'transporte@vitalred.org', password: 'Transp123', role: 'transport', hospital: 'Banco Central', unit: 'AMB-014', license: 'LIC-458213' },
    { name: 'Mtra. Sofía Ruiz', email: 'banco@vitalred.org', password: 'Banco123', role: 'bank', hospital: 'Banco Central' },
  ],
  req: null, reg: null, triageAns: null, triage: null, temp: 4.2, signed: false,
  notifications: seedNotifs(),
  appts: [
    ['08:00','Carlos Mendoza R.','O-','FOL-9830','Extracción'],['08:30','Alejandra Gómez P.','O+','FOL-9821','Completada'],['09:15','Sofía Rodríguez S.','A-','FOL-9825','Completada'],
    ['10:00','Mariana Chávez F.','B+','FOL-9834','Pre-Triaje'],['11:15','Roberto Garibay H.','AB+','FOL-9840','Programada'],['12:00','Elena Villalobos G.','O+','FOL-9842','Programada'],['13:15','Diego Martínez N.','A+','FOL-9845','No asistió']
  ].map(([time, name, blood, id, state]) => ({ time, name, blood, id, state })),
});

let state = JSON.parse(localStorage.getItem(KEY) || 'null') || seed();

if (!Array.isArray(state.notifications)) {
  state.notifications = seedNotifs();
  localStorage.setItem(KEY, JSON.stringify(state));
}

let dirty = false;
if (state.trip && !state.trip.assignedAt) { state.trip = null; dirty = true; }
if (Array.isArray(state.tripHistory) && state.tripHistory.some((h) => h.date === 'Hoy')) { state.tripHistory = state.tripHistory.filter((h) => h.date !== 'Hoy'); dirty = true; }
if (dirty) localStorage.setItem(KEY, JSON.stringify(state));

const nav = performance.getEntriesByType?.('navigation')?.[0]?.type;
if (sessionStorage.getItem(BOOT) !== window.__BOOT || nav === 'navigate') {
  sessionStorage.removeItem(SESSION);
  state.reg = null;
  localStorage.setItem(KEY, JSON.stringify(state));
}
sessionStorage.setItem(BOOT, window.__BOOT || '');

export const get = () => state;
export const set = (patch) => {
  const { session, ...rest } = patch;
  if ('session' in patch) { if (session) sessionStorage.setItem(SESSION, session); else sessionStorage.removeItem(SESSION); }
  Object.assign(state, rest);
  state.session = null;
  localStorage.setItem(KEY, JSON.stringify(state));
};
export const reset = () => { localStorage.removeItem(KEY); sessionStorage.removeItem(SESSION); state = seed(); };
export const sessionEmail = () => sessionStorage.getItem(SESSION);
export const currentUser = () => state.users.find((u) => u.email === sessionEmail());
export const normEmail = (e) => String(e || '').trim().toLowerCase();

const readLock = () => { try { return JSON.parse(localStorage.getItem(LOCK) || 'null'); } catch { return null; } };
export const lockedByOther = () => { const l = readLock(); return l && l.tab !== TAB && Date.now() - l.ts < 6000 ? l : null; };
let beat = null;
export const holdLock = (user) => {
  const write = () => localStorage.setItem(LOCK, JSON.stringify({ tab: TAB, email: user.email, name: user.name, role: user.role, ts: Date.now() }));
  write(); clearInterval(beat); beat = setInterval(write, 2000);
};
export const releaseLock = () => { clearInterval(beat); const l = readLock(); if (l && l.tab === TAB) localStorage.removeItem(LOCK); };
addEventListener('pagehide', releaseLock);

{ const u = state.users.find((x) => x.email === sessionStorage.getItem(SESSION)); if (u) holdLock(u); }

export const HOME = { donor: 'd/profile', medical: 'm/dashboard', bank: 'b/dash', transport: 't/home' };
export const ROLES = { donor: 'Donante Voluntario', medical: 'Personal Médico', transport: 'Transportista Sanitario', bank: 'Banco de Sangre' };
