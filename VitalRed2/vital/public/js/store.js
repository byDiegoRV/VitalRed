const KEY = 'vitalred-v3', SESSION = 'vitalred-session', BOOT = 'vitalred-boot', LOCK = 'vitalred-lock';
const TAB = Math.random().toString(36).slice(2);
const DEFAULT_MEDICAL = { gender: 'm', age: 'adult', weight: 'ok', blood: 'O+', risk0: 'no', risk1: 'no', risk2: 'no' };
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
  appts: [
    ['08:00','Carlos Mendoza R.','O-','FOL-9830','Extracción'],['08:30','Alejandra Gómez P.','O+','FOL-9821','Completada'],['09:15','Sofía Rodríguez S.','A-','FOL-9825','Completada'],
    ['10:00','Mariana Chávez F.','B+','FOL-9834','Pre-Triaje'],['11:15','Roberto Garibay H.','AB+','FOL-9840','Programada'],['12:00','Elena Villalobos G.','O+','FOL-9842','Programada'],['13:15','Diego Martínez N.','A+','FOL-9845','No asistió'],
  ].map(([time, name, blood, id, state]) => ({ time, name, blood, id, state })),
});
let state = JSON.parse(localStorage.getItem(KEY) || 'null') || seed();

// La sesión vive en la pestaña (sessionStorage), no en los datos compartidos: cada vez que se arranca el
// servidor o se abre la app desde cero se empieza en el login. Los datos (solicitudes, citas, usuarios) sí se comparten.
const nav = performance.getEntriesByType?.('navigation')?.[0]?.type;
if (sessionStorage.getItem(BOOT) !== window.__BOOT || nav === 'navigate') { sessionStorage.removeItem(SESSION); state.reg = null; localStorage.setItem(KEY, JSON.stringify(state)); }
sessionStorage.setItem(BOOT, window.__BOOT || '');

export const get = () => state;
export const set = (patch) => {
  const { session, ...rest } = patch;
  if ('session' in patch) { if (session) sessionStorage.setItem(SESSION, session); else sessionStorage.removeItem(SESSION); }
  Object.assign(state, rest); state.session = null;
  localStorage.setItem(KEY, JSON.stringify(state));
};
export const reset = () => { localStorage.removeItem(KEY); sessionStorage.removeItem(SESSION); state = seed(); };
export const sessionEmail = () => sessionStorage.getItem(SESSION);
export const currentUser = () => state.users.find((u) => u.email === sessionEmail());
export const normEmail = (e) => String(e || '').trim().toLowerCase();

// Un solo perfil activo por navegador: la pestaña con sesión mantiene un "latido"; otra pestaña no puede iniciar sesión mientras exista.
const readLock = () => { try { return JSON.parse(localStorage.getItem(LOCK) || 'null'); } catch { return null; } };
export const lockedByOther = () => { const l = readLock(); return l && l.tab !== TAB && Date.now() - l.ts < 6000 ? l : null; };
let beat = null;
export const holdLock = (user) => {
  const write = () => localStorage.setItem(LOCK, JSON.stringify({ tab: TAB, email: user.email, name: user.name, role: user.role, ts: Date.now() }));
  write(); clearInterval(beat); beat = setInterval(write, 2000);
};
export const releaseLock = () => { clearInterval(beat); const l = readLock(); if (l && l.tab === TAB) localStorage.removeItem(LOCK); };
addEventListener('pagehide', releaseLock);
// Si esta pestaña ya tenía sesión (recarga), recupera el latido
{ const u = state.users.find((x) => x.email === sessionStorage.getItem(SESSION)); if (u) holdLock(u); }
export const HOME = { donor: 'd/profile', medical: 'm/dashboard', bank: 'b/dash', transport: 't/home' };
export const ROLES = { donor: 'Donante Voluntario', medical: 'Personal Médico', transport: 'Transportista Sanitario', bank: 'Banco de Sangre' };
