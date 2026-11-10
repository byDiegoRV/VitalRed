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

const dayMs = 86400000;
const toDateStr = (ts) => new Date(ts).toISOString().slice(0, 10);

export const seedInventory = () => {
  const now = Date.now();
  return [
    { id: 'VR-B-91020', blood: 'O+', component: 'Concentrado eritrocitario', volume: 350, extractedAt: toDateStr(now - 12 * dayMs), expiresAt: toDateStr(now + 30 * dayMs), location: 'Cámara Fría 1 (2° a 6°C) — Estante A-1', status: 'vigente', notes: 'Control serológico NOM-253 negativo.', isUserAdded: false },
    { id: 'VR-B-91021', blood: 'O-', component: 'Concentrado eritrocitario', volume: 300, extractedAt: toDateStr(now - 8 * dayMs), expiresAt: toDateStr(now + 34 * dayMs), location: 'Cámara Fría 1 (2° a 6°C) — Estante A-2', status: 'vigente', notes: 'Unidad de reserva crítica para Urgencias.', isUserAdded: false },
    { id: 'VR-B-91022', blood: 'A+', component: 'Sangre total', volume: 450, extractedAt: toDateStr(now - 5 * dayMs), expiresAt: toDateStr(now + 30 * dayMs), location: 'Cámara Fría 2 (2° a 6°C) — Estante B-1', status: 'vigente', notes: 'Apta para transfusión masiva.', isUserAdded: false },
    { id: 'VR-B-91023', blood: 'B+', component: 'Plaquetas por aféresis', volume: 250, extractedAt: toDateStr(now - 3 * dayMs), expiresAt: toDateStr(now + 2 * dayMs), location: 'Agitador Plaquetario 1 (20° a 24°C) — Bandeja 1', status: 'por_vencer', notes: 'Agitación constante 60 rpm. Priorizar despacho.', isUserAdded: false },
    { id: 'VR-B-91024', blood: 'O+', component: 'Plasma fresco congelado', volume: 250, extractedAt: toDateStr(now - 45 * dayMs), expiresAt: toDateStr(now + 320 * dayMs), location: 'Ultracongelador 1 (-30°C) — Gaveta P-1', status: 'vigente', notes: 'Congelación rápida dentro de 8 h posdonación.', isUserAdded: false },
    { id: 'VR-B-91025', blood: 'A-', component: 'Concentrado eritrocitario', volume: 320, extractedAt: toDateStr(now - 38 * dayMs), expiresAt: toDateStr(now + 4 * dayMs), location: 'Cámara Fría 1 (2° a 6°C) — Estante A-3', status: 'por_vencer', notes: 'Próxima a expirar en 4 días. Asignar de inmediato.', isUserAdded: false },
    { id: 'VR-B-91026', blood: 'AB+', component: 'Concentrado eritrocitario', volume: 300, extractedAt: toDateStr(now - 15 * dayMs), expiresAt: toDateStr(now + 27 * dayMs), location: 'Cámara Fría 2 (2° a 6°C) — Estante B-2', status: 'vigente', notes: 'Receptor universal para hematíes AB.', isUserAdded: false },
    { id: 'VR-B-91027', blood: 'B-', component: 'Concentrado eritrocitario', volume: 280, extractedAt: toDateStr(now - 20 * dayMs), expiresAt: toDateStr(now + 22 * dayMs), location: 'Cámara Fría 1 (2° a 6°C) — Estante A-4', status: 'vigente', notes: 'Nivel en reserva bajo.', isUserAdded: false },
    { id: 'VR-B-91028', blood: 'AB-', component: 'Plaquetas por aféresis', volume: 200, extractedAt: toDateStr(now - 7 * dayMs), expiresAt: toDateStr(now - 2 * dayMs), location: 'Cámara de Cuarentena (4°C) — Gaveta Q-1', status: 'caducado', notes: 'Caducó hace 2 días. Bloqueada para despacho (NOM-253).', isUserAdded: false },
    { id: 'VR-B-91029', blood: 'O-', component: 'Sangre total', volume: 450, extractedAt: toDateStr(now - 2 * dayMs), expiresAt: toDateStr(now + 33 * dayMs), location: 'Cámara Fría 2 (2° a 6°C) — Estante B-3', status: 'vigente', notes: 'Donante universal para urgencias inmediatas.', isUserAdded: false },
    { id: 'VR-B-91030', blood: 'A+', component: 'Plasma fresco congelado', volume: 300, extractedAt: toDateStr(now - 60 * dayMs), expiresAt: toDateStr(now + 305 * dayMs), location: 'Ultracongelador 2 (-30°C) — Gaveta P-2', status: 'vigente', notes: 'Mantenido a -32°C continuo.', isUserAdded: false },
    { id: 'VR-B-91031', blood: 'O+', component: 'Concentrado eritrocitario', volume: 310, extractedAt: toDateStr(now - 39 * dayMs), expiresAt: toDateStr(now + 3 * dayMs), location: 'Cámara Fría 1 (2° a 6°C) — Estante A-1', status: 'por_vencer', notes: 'Por vencer en 3 días.', isUserAdded: false }
  ];
};

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
  inventory: seedInventory(),
  invSeq: 91040,
});

let state;
try {
  state = JSON.parse(localStorage.getItem(KEY) || 'null') || seed();
} catch (e) {
  console.warn('[VitalRed store] Error parsing stored state, resetting to seed:', e);
  state = seed();
  try { localStorage.setItem(KEY, JSON.stringify(state)); } catch {}
}

try {
  if (!Array.isArray(state.notifications)) {
    state.notifications = seedNotifs();
    localStorage.setItem(KEY, JSON.stringify(state));
  }

  if (!Array.isArray(state.inventory)) {
    state.inventory = seedInventory();
    if (!state.invSeq) state.invSeq = 91040;
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
} catch (e) {
  console.warn('[VitalRed store] Storage sync warning:', e);
}

export const get = () => state;
export const set = (patch) => {
  const { session, ...rest } = patch;
  if ('session' in patch) {
    try {
      if (session) sessionStorage.setItem(SESSION, session); else sessionStorage.removeItem(SESSION);
    } catch {}
  }
  Object.assign(state, rest);
  state.session = null;
  try {
    localStorage.setItem(KEY, JSON.stringify(state));
  } catch (e) {
    console.warn('[VitalRed store] Failed to persist state:', e);
  }
};
export const reset = () => {
  try {
    localStorage.removeItem(KEY);
    sessionStorage.removeItem(SESSION);
  } catch {}
  state = seed();
};
export const sessionEmail = () => {
  try { return sessionStorage.getItem(SESSION); } catch { return null; }
};
export const currentUser = () => state.users.find((u) => u.email === sessionEmail());
export const normEmail = (e) => String(e || '').trim().toLowerCase();

const readLock = () => {
  try {
    return JSON.parse(localStorage.getItem(LOCK) || 'null');
  } catch {
    return null;
  }
};
export const lockedByOther = () => { const l = readLock(); return l && l.tab !== TAB && Date.now() - l.ts < 6000 ? l : null; };
let beat = null;
export const holdLock = (user) => {
  const write = () => {
    try {
      localStorage.setItem(LOCK, JSON.stringify({ tab: TAB, email: user.email, name: user.name, role: user.role, ts: Date.now() }));
    } catch {}
  };
  write(); clearInterval(beat); beat = setInterval(write, 2000);
};
export const releaseLock = () => { clearInterval(beat); const l = readLock(); if (l && l.tab === TAB) localStorage.removeItem(LOCK); };
addEventListener('pagehide', releaseLock);

{ const u = state.users.find((x) => x.email === sessionStorage.getItem(SESSION)); if (u) holdLock(u); }

export const HOME = { donor: 'd/profile', medical: 'm/dashboard', bank: 'b/dash', transport: 't/home' };
export const ROLES = { donor: 'Donante Voluntario', medical: 'Personal Médico', transport: 'Transportista Sanitario', bank: 'Banco de Sangre' };

export const getUnitExpirationInfo = (item) => {
  if (!item) return { status: 'vigente', label: 'Vigente', badgeCls: 'ok', daysLeft: 99, dispatchable: true };
  if (item.status === 'cuarentena') {
    return { status: 'cuarentena', label: 'Cuarentena', badgeCls: 'red', daysLeft: 0, dispatchable: false };
  }
  const now = new Date();
  now.setHours(0, 0, 0, 0);
  const [ey, em, ed] = String(item.expiresAt || '').split('-').map(Number);
  if (!ey || !em || !ed) return { status: 'vigente', label: 'Vigente', badgeCls: 'ok', daysLeft: 99, dispatchable: true };
  const exp = new Date(ey, em - 1, ed);
  exp.setHours(0, 0, 0, 0);
  const diffDays = Math.round((exp.getTime() - now.getTime()) / 86400000);
  if (diffDays < 0) {
    return { status: 'caducado', label: 'Caducada', badgeCls: 'red', daysLeft: diffDays, dispatchable: false };
  }
  const comp = String(item.component || '').toLowerCase();
  const criticalThreshold = comp.includes('plaqueta') ? 2 : 5;
  if (diffDays <= criticalThreshold) {
    return { status: 'por_vencer', label: `Por vencer (${diffDays}d)`, badgeCls: 'warn', daysLeft: diffDays, dispatchable: true };
  }
  return { status: 'vigente', label: `Vigente (${diffDays}d)`, badgeCls: 'ok', daysLeft: diffDays, dispatchable: true };
};

export const addInventoryItem = (item) => {
  const inv = state.inventory || [];
  const seq = (state.invSeq || 91040) + 1;
  const id = (item.id && item.id.trim()) ? item.id.trim() : `VR-B-${seq}`;
  const today = new Date().toISOString().slice(0, 10);
  const newItem = {
    id,
    blood: item.blood || 'O+',
    component: item.component || 'Concentrado eritrocitario',
    volume: Number(item.volume) || 300,
    extractedAt: item.extractedAt || today,
    expiresAt: item.expiresAt || today,
    location: item.location || 'Cámara Fría 1 (2° a 6°C) — Estante A-1',
    status: item.status || 'vigente',
    donorName: item.donorName || '',
    notes: item.notes || '',
    isUserAdded: true,
    createdAt: Date.now()
  };
  set({
    inventory: [newItem, ...inv],
    invSeq: seq
  });
  return newItem;
};

export const updateInventoryItem = (id, patch) => {
  const inv = (state.inventory || []).map((item) => (item.id === id ? { ...item, ...patch, updatedAt: Date.now() } : item));
  set({ inventory: inv });
};

export const removeInventoryItem = (id) => {
  const inv = (state.inventory || []).filter((item) => item.id !== id);
  set({ inventory: inv });
};

export const getInventory = (filters = {}) => {
  let list = state.inventory || [];
  if (filters.search) {
    const q = filters.search.trim().toLowerCase();
    list = list.filter((i) =>
      i.id.toLowerCase().includes(q) ||
      i.blood.toLowerCase().includes(q) ||
      i.component.toLowerCase().includes(q) ||
      (i.location && i.location.toLowerCase().includes(q)) ||
      (i.donorName && i.donorName.toLowerCase().includes(q))
    );
  }
  if (filters.blood && filters.blood !== 'all' && filters.blood !== 'Todos') {
    list = list.filter((i) => i.blood === filters.blood);
  }
  if (filters.component && filters.component !== 'all' && filters.component !== 'Todos') {
    list = list.filter((i) => i.component === filters.component);
  }
  if (filters.status && filters.status !== 'all' && filters.status !== 'Todos') {
    list = list.filter((i) => {
      const info = getUnitExpirationInfo(i);
      return info.status === filters.status;
    });
  }
  return list;
};

export const checkExpirations = () => {
  const list = state.inventory || [];
  let vigentes = 0, porVencer = 0, caducadas = 0, cuarentena = 0;
  list.forEach((item) => {
    const info = getUnitExpirationInfo(item);
    if (info.status === 'vigente') vigentes++;
    else if (info.status === 'por_vencer') porVencer++;
    else if (info.status === 'caducado') caducadas++;
    else if (info.status === 'cuarentena') cuarentena++;
  });
  return {
    total: list.length,
    vigentes,
    porVencer,
    caducadas,
    cuarentena
  };
};
