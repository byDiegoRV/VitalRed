// Reglas de negocio compartidas entre perfiles (sin backend: todo vive en el estado compartido del navegador).
// Ciclo de una solicitud:  buscando -> esperando (un donante aceptó) -> programada (agendó cita)
//   -> completada (el banco registró la donación) -> entrega: preparando -> en_ruta -> entregada -> cerrada (el médico recibe).
import { get, set, currentUser, normEmail } from './store.js';
import { BANK, HOSPITALS } from './maps.js';

export const COMPONENTS = ['Concentrado de hematíes', 'Sangre total', 'Plasma fresco congelado', 'Plaquetas por aféresis'];
export const DIAGNOSES = ['Hemorragia', 'Cirugía programada', 'Anemia severa', 'Politraumatismo', 'Hemorragia posparto', 'Trombocitopenia', 'Otro'];
export const AREAS = ['Urgencias', 'Quirófano', 'Terapia intensiva', 'Pediatría', 'Ginecología'];
export const HOSPITAL_LIST = Object.keys(HOSPITALS);

const CAN_DONATE = {
  'O-': ['O-', 'O+', 'A-', 'A+', 'B-', 'B+', 'AB-', 'AB+'], 'O+': ['O+', 'A+', 'B+', 'AB+'],
  'A-': ['A-', 'A+', 'AB-', 'AB+'], 'A+': ['A+', 'AB+'], 'B-': ['B-', 'B+', 'AB-', 'AB+'], 'B+': ['B+', 'AB+'],
  'AB-': ['AB-', 'AB+'], 'AB+': ['AB+'],
};

export const compatible = (donorBlood, recipientBlood) => (CAN_DONATE[donorBlood] || []).includes(recipientBlood);
export const compatibleDonors = (blood) => get().users.filter((u) => u.role === 'donor' && compatible(u.blood, blood));

export const eligibleDonors = (blood, excluded = []) => compatibleDonors(blood).filter((u) => !excluded.includes(u.email) && statusOf(u) !== 'Diferido temporalmente');

export const CASES = [
  { hospital: 'Hospital General', blood: 'O-', units: 2, component: 'Concentrado de hematíes', area: 'Urgencias', priority: 'CRÍTICA', patient: 'Roberto Salinas Mora', hc: 'HC 561204', bed: 'Box 3', diagnosis: 'Hemorragia digestiva' },
  { hospital: 'Hospital San Rafael', blood: 'A+', units: 3, component: 'Plasma fresco congelado', area: 'Quirófano', priority: 'ALTA', patient: 'Teresa Ibarra Lugo', hc: 'HC 559871', bed: 'Quirófano 1', diagnosis: 'Cirugía programada' },
  { hospital: 'Clínica Santa María', blood: 'B+', units: 1, component: 'Plaquetas por aféresis', area: 'Terapia intensiva', priority: 'ALTA', patient: 'Andrés Colón Vega', hc: 'HC 560332', bed: 'UCI 5', diagnosis: 'Trombocitopenia' },
  { hospital: 'Hospital del Valle', blood: 'O+', units: 2, component: 'Sangre total', area: 'Pediatría', priority: 'CRÍTICA', patient: 'Mateo Rojas Díaz', hc: 'HC 562018', bed: 'Cuna 12', diagnosis: 'Anemia severa' },
  { hospital: 'Hospital Ángeles', blood: 'AB+', units: 2, component: 'Concentrado de hematíes', area: 'Ginecología', priority: 'ALTA', patient: 'Paola Mendoza Ruiz', hc: 'HC 561777', bed: 'Habitación 204', diagnosis: 'Hemorragia posparto' },
  { hospital: 'Hospital Regional', blood: 'A-', units: 1, component: 'Concentrado de hematíes', area: 'Urgencias', priority: 'CRÍTICA', patient: 'Ernesto Villa Cruz', hc: 'HC 560945', bed: 'Choque 2', diagnosis: 'Politraumatismo' },
];

export const nextCase = (donorBlood) => {
  const start = get().caseIdx || 0;
  for (let k = 0; k < CASES.length; k++) {
    const i = (start + k) % CASES.length;
    if (compatible(donorBlood, CASES[i].blood)) { set({ caseIdx: i + 1 }); return CASES[i]; }
  }
  return CASES[0];
};

export const nextReqId = () => { const n = (get().reqSeq || 2048) + 1; set({ reqSeq: n }); return `ST-${n}`; };
export const nextApptId = () => { const n = (get().apptSeq || 8890) + 1; set({ apptSeq: n }); return `VR-2026-${n}`; };
export const activeReq = () => {
  const reqs = get().requests || [];
  const curId = get().activeReqId;
  if (curId) {
    const found = reqs.find((r) => r.id === curId);
    if (found && !['cancelada', 'cerrada'].includes(found.status)) return found;
  }
  const firstActive = reqs.find((r) => !['cancelada', 'cerrada'].includes(r.status));
  if (firstActive) return firstActive;
  const r = get().req;
  return r && !['cancelada', 'cerrada'].includes(r.status) ? r : null;
};
export const donorReqFor = (user = currentUser()) => {
  const act = activeReq();
  if (!user) return act;
  const reqs = get().requests || [];
  const uEmail = normEmail(user.email);
  const mine = reqs.find((r) => !['cancelada', 'cerrada'].includes(r.status) && r.donor?.email && normEmail(r.donor.email) === uEmail);
  if (mine) return mine;
  const isAvail = (r) => r && r.status === 'buscando' && compatible(user.blood, r.blood) && !(r.excluded || []).map(normEmail).includes(uEmail);
  if (isAvail(act)) return act;
  return reqs.find(isAvail) || act;
};
export const shortName = (n) => { const p = String(n || '').trim().split(/\s+/); return p.length > 1 ? `${p[0]} ${p[1][0]}.` : p[0] || ''; };

export const km = (a, b) => {
  const r = Math.PI / 180, h = Math.sin(((b[0] - a[0]) * r) / 2) ** 2 + Math.cos(a[0] * r) * Math.cos(b[0] * r) * Math.sin(((b[1] - a[1]) * r) / 2) ** 2;
  return 12742 * Math.asin(Math.sqrt(h));
};
export const routeKm = (hospital) => km(BANK.ll, HOSPITALS[hospital] || HOSPITALS['Hospital General']);

const SEED_HISTORY = {
  'donante@vitalred.org': [
    { id: 'D-0004', date: '2026-07-14', hospital: 'Hospital Ángeles', component: 'Sangre total', units: 1, folio: 'VR-2026-0714', area: 'Urgencias' },
    { id: 'D-0003', date: '2026-04-02', hospital: 'Hospital San Rafael', component: 'Plaquetas por aféresis', units: 1, folio: 'VR-2026-0402', area: 'Terapia intensiva' },
    { id: 'D-0002', date: '2026-01-09', hospital: 'Cl nica Santa María', component: 'Sangre total', units: 1, folio: 'VR-2026-0109', area: 'Quirófano' },
    { id: 'D-0001', date: '2025-09-18', hospital: 'Hospital del Valle', component: 'Concentrado de hematíes', units: 1, folio: 'VR-2025-0918', area: 'Pediatría' },
  ],
};

export const historyOf = (user) => [
  ...(get().donations || []).filter((d) => normEmail(d.email) === normEmail(user.email)).slice().reverse(),
  ...(SEED_HISTORY[user.email] || []),
];

export const fmtDate = (iso) => {
  if (!iso) return '';
  if (typeof iso === 'string' && /^\d{4}-\d{2}-\d{2}$/.test(iso)) {
    const [y, m, d] = iso.split('-').map(Number);
    return new Date(y, m - 1, d).toLocaleDateString('es-MX', { day: 'numeric', month: 'long', year: 'numeric' });
  }
  return new Date(iso).toLocaleDateString('es-MX', { day: 'numeric', month: 'long', year: 'numeric' });
};

export const nextEligible = (user) => {
  const last = historyOf(user)[0]; if (!last) return null;
  const d = new Date(last.date); d.setMonth(d.getMonth() + 3); return d;
};

export const daysUntil = (targetDate) => {
  if (!targetDate) return 0;
  const target = new Date(targetDate);
  const diff = Math.ceil((target.getTime() - Date.now()) / (1000 * 60 * 60 * 24));
  return Math.max(0, diff);
};

export const patchReq = (p, targetId = null) => {
  const currentReqs = get().requests || [];
  const activeId = targetId || get().activeReqId || get().req?.id;
  const target = currentReqs.find((r) => r.id === activeId) || get().req || {};
  const log = [...(target.log || [])];
  const key = p.status && p.status !== target.status ? p.status : p.delivery && p.delivery !== target.delivery ? `entrega_${p.delivery}` : null;
  if (key) log.push({ k: key, at: Date.now() });
  const updated = { ...target, ...p, log };
  const updatedList = currentReqs.map((r) => (r.id === target.id ? updated : r));
  if (!updatedList.some((r) => r.id === target.id) && target.id) {
    updatedList.unshift(updated);
  }
  const isTargetActive = !get().activeReqId || get().activeReqId === target.id;
  set({
    requests: updatedList,
    req: isTargetActive ? updated : get().req
  });
};

export const completeDonation = (appt) => {
  const users = get().users || [];
  const sessionUser = currentUser();
  const reqs = get().requests || [];
  const aEmail = normEmail(appt?.email);
  const explicitMatch = reqs.find((x) =>
    (appt?.reqId && x.id === appt.reqId) ||
    (appt?.id && x.appt?.id === appt.id) ||
    (aEmail && x.donor?.email && normEmail(x.donor.email) === aEmail)
  );
  const compatMatch = !explicitMatch && appt?.blood
    ? reqs.find((x) => ['buscando', 'esperando', 'programada'].includes(x.status) && compatible(appt.blood, x.blood))
    : null;
  const r = explicitMatch || compatMatch || get().req;

  const donor = (aEmail && users.find((u) => normEmail(u.email) === aEmail))
    || (r?.donor?.email && users.find((u) => normEmail(u.email) === normEmail(r.donor.email)))
    || (sessionUser?.role === 'donor' ? sessionUser : null)
    || users.find((u) => u.role === 'donor')
    || { email: appt?.email || 'donante@vitalred.org', name: appt?.name || 'Donante' };

  const donorEmail = donor.email || appt?.email || 'donante@vitalred.org';
  const normDonorEmail = normEmail(donorEmail);
  const mine = !!(r && (
    (r.donor?.email && normEmail(r.donor.email) === normDonorEmail) ||
    (appt?.id && r.appt?.id === appt.id) ||
    (appt?.reqId && r.id === appt.reqId) ||
    compatMatch
  ));
  const rec = {
    id: `D-${String((get().donations || []).length + 5).padStart(4, '0')}`,
    email: donorEmail,
    date: new Date().toISOString(),
    hospital: mine ? r.hospital : 'Banco de Sangre Central',
    component: mine ? r.component : 'Sangre total',
    units: mine && r.units ? r.units : 1,
    folio: appt?.id || 'VR-APPT',
    area: mine ? r.area : 'Convocatoria',
    reqId: mine ? r.id : null
  };
  set({
    donations: [...(get().donations || []), rec],
    users: users.map((u) => (normEmail(u.email) === normDonorEmail ? { ...u, donations: (u.donations || 0) + 1 } : u)),
    lastDonation: { email: donorEmail, id: rec.id }
  });
  if (r && (mine || ['esperando', 'programada'].includes(r.status))) {
    patchReq({
      status: 'completada',
      completedAt: new Date().toISOString(),
      delivery: 'preparando',
      donor: r.donor || { name: appt?.name || donor.name, email: donorEmail, blood: appt?.blood || donor.blood || r.blood },
      appt: { ...(r.appt || {}), id: appt?.id || r.appt?.id, time: appt?.time || r.appt?.time, state: 'Completada' }
    }, r.id);
  }
};

export const dispatchUnit = (baseTrip, reqId = null, opts = {}) => {
  const targetId = reqId || get().activeReqId || get().req?.id;
  const r = (get().requests || []).find((x) => x.id === targetId) || get().req;
  if (!r || ['cancelada', 'cerrada'].includes(r.status)) return null;
  const readyByApproval = r.status === 'completada' && r.delivery === 'preparando';
  const readyDirect = opts.direct === true && (!r.delivery || r.delivery === 'preparando');
  if (!readyByApproval && !readyDirect) return null;

  const existingQueue = get().tripQueue || [];
  const dup = existingQueue.find((q) => q.reqId === r.id);
  if (dup) return dup;
  if (get().trip?.reqId === r.id) return get().trip;

  const dist = routeKm(r.hospital);
  const assignedUnit = opts.unitId || baseTrip?.assignedUnit || null;
  const trip = {
    ...baseTrip,
    id: `TR-${r.id.slice(3)}`,
    origin: BANK.name,
    dest: r.hospital,
    content: `${r.units} u. ${r.component} ${r.blood}`,
    distance: `${dist.toFixed(1)} km`,
    eta: `${Math.max(5, Math.round((dist / 30) * 60))} min`,
    status: 'disponible',
    check0: false,
    check1: false,
    check2: false,
    scanOk: false,
    signOk: false,
    photoOrigin: null,
    photoDelivery: null,
    thermalLogs: [],
    reqId: r.id,
    priority: r.priority,
    area: r.area,
    bed: r.bed,
    requester: r.requester,
    ...(assignedUnit ? { assignedUnit } : {}),
    publishedAt: Date.now()
  };
  set({ tripQueue: [...existingQueue, trip] });
  patchReq({
    ...(r.status !== 'completada' ? { status: 'completada', completedAt: new Date().toISOString() } : {}),
    delivery: 'despachada',
    tripId: trip.id
  }, r.id);
  return trip;
};

export const takeTrip = (id, user) => {
  const q = get().tripQueue || [], t = q.find((x) => x.id === id);
  if (!t || get().trip) return null;
  const trip = { ...t, status: 'asignada', assignedAt: Date.now(), assignedTo: `${user.name} — ${t.assignedUnit || user.unit || 'AMB-014'}` };
  set({ trip, tripQueue: q.filter((x) => x.id !== id), temp: 4.2 });
  if (trip.reqId) patchReq({ delivery: 'asignada', assignedTo: trip.assignedTo }, trip.reqId);
  return trip;
};

export const releaseDonor = (email, denied = null) => {
  const nEmail = normEmail(email);
  const r = (get().requests || []).find((x) => x.donor?.email && normEmail(x.donor.email) === nEmail) || get().req;
  const my = get().myAppt;
  if (r && r.donor?.email && normEmail(r.donor.email) === nEmail && ['esperando', 'programada'].includes(r.status)) {
    const excluded = denied ? [...(r.excluded || []), email] : r.excluded || [];
    patchReq({
      status: 'buscando',
      donor: null,
      appt: null,
      excluded,
      declined: (r.declined || 0) + 1,
      lastDenied: denied || undefined,
      notified: eligibleDonors(r.blood, excluded).length
    }, r.id);
  }
  set({ inFlow: false, triage: null, triageAns: null, myAppt: null, slot: null, appts: denied ? get().appts : get().appts.filter((a) => !my || a.id !== my.id) });
};

export const hhmm = (ts) => new Date(ts).toLocaleTimeString('es-MX', { hour: '2-digit', minute: '2-digit', hourCycle: 'h23' });
export const fmtDateTime = (ts) => `${new Date(ts).toLocaleDateString('es-MX', { day: 'numeric', month: 'short', year: 'numeric' })} — ${hhmm(ts)}`;
export const ago = (ts) => {
  const m = Math.max(0, Math.round((Date.now() - ts) / 60000));
  if (m < 1) return 'Hace un momento';
  if (m < 60) return `Hace ${m} min`;
  const h = Math.floor(m / 60);
  return h < 24 ? `Hace ${h} h ${m % 60} min` : `Hace ${Math.floor(h / 24)} d`;
};

export const seedAt = () => { if (!get().seedAt) set({ seedAt: Date.now() }); return get().seedAt; };

export const slotsFromNow = (n = 4) => {
  const d = new Date(); d.setSeconds(0, 0); d.setMinutes(d.getMinutes() < 30 ? 30 : 60);
  return Array.from({ length: n }, (_, i) => { const t = new Date(d.getTime() + i * 1800000); return [t.toLocaleTimeString('en-GB', { hour: '2-digit', minute: '2-digit' }), t.toLocaleTimeString('en-US', { hour: '2-digit', minute: '2-digit' })]; });
};

export const CHECKS = ['Hemoglobina dentro del rango', 'Presión arterial y pulso normales', 'Tamizaje sin reactivos', 'Bolsa íntegra, sellada y etiquetada'];
export const REASONS = [
  { id: 'dental', cat: 'Salud', label: 'Muelas picadas o infección dental activa', days: 14 },
  { id: 'fever', cat: 'Salud', label: 'Fiebre, gripe o infección reciente', days: 14 },
  { id: 'bp', cat: 'Salud', label: 'Presión arterial o pulso fuera de rango', days: 7 },
  { id: 'meds', cat: 'Salud', label: 'Medicamento detectado en la valoración', days: 30 },
  { id: 'tattoo', cat: 'Riesgo', label: 'Tatuaje, perforación o acupuntura reciente (menos de 12 meses)', days: 365 },
  { id: 'hb', cat: 'Laboratorio', label: 'Hemoglobina por debajo del mínimo', days: 90 },
  { id: 'screen', cat: 'Laboratorio', label: 'Prueba de tamizaje reactiva (VIH, hepatitis o sífilis)', days: 365 },
  { id: 'alcohol', cat: 'Conducta', label: 'Alcohol o sustancias en las últimas 48 h', days: 2 },
  { id: 'fast', cat: 'Conducta', label: 'No cumplió el ayuno indicado', days: 1 },
  { id: 'bag', cat: 'Calidad', label: 'Bolsa con incidencia (coágulos, fuga o contaminación)', days: 0 },
  { id: 'other', cat: 'Otro', label: 'Otro motivo (especificar en las notas)', days: 0 },
];
export const reasonLabel = (id) => REASONS.find((r) => r.id === id)?.label || id;

const SEED_REVIEWS = [
  { id: 'RV-0003', apptId: 'FOL-9712', name: 'Karla Domínguez S.', blood: 'A-', decision: 'no_apta', reasons: ['tattoo'], notes: 'Tatuaje realizado hace 5 meses en la espalda.', at: '2026-10-14T10:20:00', by: 'Mtra. Sofía Ruiz', component: 'Sangre total', deferUntil: '2027-10-14T10:20:00' },
  { id: 'RV-0002', apptId: 'FOL-9704', name: 'Alejandra Gómez P.', blood: 'O+', decision: 'apta', checks: CHECKS, notes: '', at: '2026-10-12T09:40:00', by: 'Mtra. Sofía Ruiz', component: 'Sangre total' },
  { id: 'RV-0001', apptId: 'FOL-9688', name: 'Iván Rosas T.', blood: 'B+', decision: 'no_apta', reasons: ['dental', 'meds'], notes: 'Infección dental en tratamiento con antibiótico.', at: '2026-10-09T11:05:00', by: 'Mtra. Sofía Ruiz', component: 'Sangre total', deferUntil: '2026-11-08T11:05:00' },
];

export const reviewsAll = () => [...(get().reviews || []), ...SEED_REVIEWS].sort((a, b) => new Date(b.at) - new Date(a.at));
const currentBy = () => currentUser()?.name || 'Banco de Sangre';

export const addReview = (rec) => {
  const n = (get().reviewSeq || 3) + 1; set({ reviewSeq: n });
  const r = { id: `RV-${String(n).padStart(4, '0')}`, at: new Date().toISOString(), by: currentBy(), ...rec };
  set({ reviews: [...(get().reviews || []), r] }); return r;
};

export const deferralDate = (ids) => { const d = Math.max(0, ...ids.map((i) => REASONS.find((r) => r.id === i)?.days || 0)); return d ? new Date(Date.now() + d * 86400000).toISOString() : null; };
export const deferred = (u) => !!(u.deferUntil && new Date(u.deferUntil) > new Date());
export const statusOf = (u) => (deferred(u) ? 'Diferido temporalmente' : u.deferBy === 'review' ? 'Apto para donar' : u.status);

export const attemptsOf = (u) => [
  ...historyOf(u).map((d) => ({ ...d, kind: 'donacion', at: d.date })),
  ...reviewsAll().filter((r) => r.email === u.email && r.decision === 'no_apta').map((r) => ({ ...r, kind: 'rechazo' })),
].sort((a, b) => new Date(b.at) - new Date(a.at));

export const demoTrip = (base) => {
  const i = get().tripIdx || 0, c = CASES[i % CASES.length], n = (get().tripSeq || 9902) + 1, dist = routeKm(c.hospital);
  set({ tripIdx: i + 1, tripSeq: n });
  return { ...base, id: `TR-${n}`, origin: BANK.name, dest: c.hospital, content: `${c.units} u. ${c.component} ${c.blood}`, distance: `${dist.toFixed(1)} km`, eta: `${Math.max(5, Math.round((dist / 30) * 60))} min`, status: 'disponible', priority: c.priority, area: c.area, bed: c.bed, requester: `Servicio de ${c.area}`, publishedAt: Date.now(), demo: true, thermalLogs: [], reqId: null };
};

export const SHELF_LIFE_DAYS = {
  'Concentrado eritrocitario': 42,
  'Concentrado de hematíes': 42,
  'Sangre total': 35,
  'Plaquetas por aféresis': 5,
  'Plaquetas': 5,
  'Plasma fresco congelado': 365,
  'Crioprecipitado': 365
};

export const RECOMMENDED_VOLUMES = {
  'Concentrado eritrocitario': 300,
  'Concentrado de hematíes': 300,
  'Sangre total': 450,
  'Plaquetas por aféresis': 250,
  'Plaquetas': 250,
  'Plasma fresco congelado': 250,
  'Crioprecipitado': 150
};

export const CHAMBER_LOCATIONS = [
  'Cámara Fría 1 (2° a 6°C) — Estante A-1',
  'Cámara Fría 1 (2° a 6°C) — Estante A-2',
  'Cámara Fría 1 (2° a 6°C) — Estante A-3',
  'Cámara Fría 1 (2° a 6°C) — Estante A-4',
  'Cámara Fría 2 (2° a 6°C) — Estante B-1',
  'Cámara Fría 2 (2° a 6°C) — Estante B-2',
  'Cámara Fría 2 (2° a 6°C) — Estante B-3',
  'Ultracongelador 1 (-30°C) — Gaveta P-1',
  'Ultracongelador 2 (-30°C) — Gaveta P-2',
  'Agitador Plaquetario 1 (20° a 24°C) — Bandeja 1',
  'Agitador Plaquetario 2 (20° a 24°C) — Bandeja 2',
  'Cámara de Cuarentena (4°C) — Gaveta Q-1'
];

export const calculateExpirationDate = (component, extractionDate) => {
  const days = SHELF_LIFE_DAYS[component] || 35;
  const base = extractionDate ? new Date(extractionDate + 'T00:00:00') : new Date();
  base.setDate(base.getDate() + days);
  return base.toISOString().slice(0, 10);
};
