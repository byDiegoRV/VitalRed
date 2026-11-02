// Reglas de negocio compartidas entre perfiles (sin backend: todo vive en el estado compartido del navegador).
// Ciclo de una solicitud:  buscando -> esperando (un donante aceptó) -> programada (agendó cita)
//   -> completada (el banco registró la donación) -> entrega: preparando -> en_ruta -> entregada -> cerrada (el médico recibe).
import { get, set, currentUser } from './store.js';
import { BANK, HOSPITALS } from './maps.js';

export const COMPONENTS = ['Concentrado de hematíes', 'Sangre total', 'Plasma fresco congelado', 'Plaquetas por aféresis'];
export const DIAGNOSES = ['Hemorragia', 'Cirugía programada', 'Anemia severa', 'Politraumatismo', 'Hemorragia posparto', 'Trombocitopenia', 'Otro'];
export const AREAS = ['Urgencias', 'Quirófano', 'Terapia intensiva', 'Pediatría', 'Ginecología'];
export const HOSPITAL_LIST = Object.keys(HOSPITALS);

// A quién puede donar cada grupo sanguíneo
const CAN_DONATE = {
  'O-': ['O-', 'O+', 'A-', 'A+', 'B-', 'B+', 'AB-', 'AB+'], 'O+': ['O+', 'A+', 'B+', 'AB+'],
  'A-': ['A-', 'A+', 'AB-', 'AB+'], 'A+': ['A+', 'AB+'], 'B-': ['B-', 'B+', 'AB-', 'AB+'], 'B+': ['B+', 'AB+'],
  'AB-': ['AB-', 'AB+'], 'AB+': ['AB+'],
};
export const compatible = (donorBlood, recipientBlood) => (CAN_DONATE[donorBlood] || []).includes(recipientBlood);
export const compatibleDonors = (blood) => get().users.filter((u) => u.role === 'donor' && compatible(u.blood, blood));
// Donantes a los que se notifica: compatibles, aptos (sin diferimiento) y que no fueron rechazados en esta solicitud
export const eligibleDonors = (blood, excluded = []) => compatibleDonors(blood).filter((u) => !excluded.includes(u.email) && statusOf(u) !== 'Diferido temporalmente');

// Casos de demostración distintos (hospital, destino, grupo, hemocomponente...)
export const CASES = [
  { hospital: 'Hospital General', blood: 'O-', units: 2, component: 'Concentrado de hematíes', area: 'Urgencias', priority: 'CRÍTICA', patient: 'Roberto Salinas Mora', hc: 'HC 561204', bed: 'Box 3', diagnosis: 'Hemorragia digestiva' },
  { hospital: 'Hospital San Rafael', blood: 'A+', units: 3, component: 'Plasma fresco congelado', area: 'Quirófano', priority: 'ALTA', patient: 'Teresa Ibarra Lugo', hc: 'HC 559871', bed: 'Quirófano 1', diagnosis: 'Cirugía programada' },
  { hospital: 'Clínica Santa María', blood: 'B+', units: 1, component: 'Plaquetas por aféresis', area: 'Terapia intensiva', priority: 'ALTA', patient: 'Andrés Colín Vega', hc: 'HC 560332', bed: 'UCI 5', diagnosis: 'Trombocitopenia' },
  { hospital: 'Hospital del Valle', blood: 'O+', units: 2, component: 'Sangre total', area: 'Pediatría', priority: 'CRÍTICA', patient: 'Mateo Rojas Díaz', hc: 'HC 562018', bed: 'Cuna 12', diagnosis: 'Anemia severa' },
  { hospital: 'Hospital Ángeles', blood: 'AB+', units: 2, component: 'Concentrado de hematíes', area: 'Ginecología', priority: 'ALTA', patient: 'Paola Mendoza Ruiz', hc: 'HC 561777', bed: 'Habitación 204', diagnosis: 'Hemorragia posparto' },
  { hospital: 'Hospital Regional', blood: 'A-', units: 1, component: 'Concentrado de hematíes', area: 'Urgencias', priority: 'CRÍTICA', patient: 'Ernesto Villa Cruz', hc: 'HC 560945', bed: 'Choque 2', diagnosis: 'Politraumatismo' },
];
// Siguiente caso compatible con el grupo del donante (rota para que no sea siempre el mismo)
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

// ¿Hay una solicitud en curso? (no cancelada ni cerrada)
export const activeReq = () => { const r = get().req; return r && !['cancelada', 'cerrada'].includes(r.status) ? r : null; };
export const shortName = (n) => { const p = String(n || '').trim().split(/\s+/); return p.length > 1 ? `${p[0]} ${p[1][0]}.` : p[0] || ''; };
export const km = (a, b) => {
  const r = Math.PI / 180, h = Math.sin(((b[0] - a[0]) * r) / 2) ** 2 + Math.cos(a[0] * r) * Math.cos(b[0] * r) * Math.sin(((b[1] - a[1]) * r) / 2) ** 2;
  return 12742 * Math.asin(Math.sqrt(h));
};
export const routeKm = (hospital) => km(BANK.ll, HOSPITALS[hospital] || HOSPITALS['Hospital General']);

// ---- Historial de donaciones -------------------------------------------------
const SEED_HISTORY = {
  'donante@vitalred.org': [
    { id: 'D-0004', date: '2026-07-14', hospital: 'Hospital Ángeles', component: 'Sangre total', units: 1, folio: 'VR-2026-0714', area: 'Urgencias' },
    { id: 'D-0003', date: '2026-04-02', hospital: 'Hospital San Rafael', component: 'Plaquetas por aféresis', units: 1, folio: 'VR-2026-0402', area: 'Terapia intensiva' },
    { id: 'D-0002', date: '2026-01-09', hospital: 'Clínica Santa María', component: 'Sangre total', units: 1, folio: 'VR-2026-0109', area: 'Quirófano' },
    { id: 'D-0001', date: '2025-09-18', hospital: 'Hospital del Valle', component: 'Concentrado de hematíes', units: 1, folio: 'VR-2025-0918', area: 'Pediatría' },
  ],
};
export const historyOf = (user) => [
  ...(get().donations || []).filter((d) => d.email === user.email).slice().reverse(),
  ...(SEED_HISTORY[user.email] || []),
];
export const fmtDate = (iso) => new Date(iso).toLocaleDateString('es-MX', { day: 'numeric', month: 'long', year: 'numeric' });
// Próxima fecha en que puede donar (sangre total: cada 3 meses)
export const nextEligible = (user) => {
  const last = historyOf(user)[0]; if (!last) return null;
  const d = new Date(last.date); d.setMonth(d.getMonth() + 3); return d;
};

// ---- Transiciones del ciclo de la solicitud ---------------------------------
export const patchReq = (p) => {
  const r = get().req || {}, log = [...(r.log || [])];
  const key = p.status && p.status !== r.status ? p.status : p.delivery && p.delivery !== r.delivery ? `entrega_${p.delivery}` : null;
  if (key) log.push({ k: key, at: Date.now() });
  set({ req: { ...r, ...p, log } });
};

// El banco registró la donación completa: se anota en el historial del donante y se avanza la solicitud
export const completeDonation = (appt) => {
  const donor = get().users.find((u) => u.email === appt.email); if (!donor) return;
  const r = get().req, mine = r && r.donor?.email === donor.email;
  const rec = { id: `D-${String((get().donations || []).length + 5).padStart(4, '0')}`, email: donor.email, date: new Date().toISOString(), hospital: mine ? r.hospital : 'Banco de Sangre Central', component: mine ? r.component : 'Sangre total', units: 1, folio: appt.id, area: mine ? r.area : 'Convocatoria', reqId: mine ? r.id : null };
  set({ donations: [...(get().donations || []), rec], users: get().users.map((u) => (u.email === donor.email ? { ...u, donations: (u.donations || 0) + 1 } : u)), lastDonation: { email: donor.email, id: rec.id } });
  if (mine && ['esperando', 'programada'].includes(r.status)) patchReq({ status: 'completada', completedAt: new Date().toISOString(), delivery: 'preparando' });
};

// El banco despacha la unidad: se crea el viaje del transportista hacia el hospital que la pidió
export const dispatchUnit = (baseTrip) => {
  const r = get().req; if (!r || r.status !== 'completada' || r.delivery !== 'preparando') return null;
  const dist = routeKm(r.hospital), tr = get().users.find((u) => u.role === 'transport');
  const trip = { ...baseTrip, id: `TR-${r.id.slice(3)}`, origin: BANK.name, dest: r.hospital, content: `${r.units} u. ${r.component} ${r.blood}`, distance: `${dist.toFixed(1)} km`, eta: `${Math.max(5, Math.round((dist / 30) * 60))} min`, status: 'asignada', check0: false, check1: false, check2: false, scanOk: false, signOk: false, photoOrigin: null, photoDelivery: null, thermalLogs: [], reqId: r.id, priority: r.priority, area: r.area, bed: r.bed, requester: r.requester, assignedAt: Date.now(), assignedTo: tr ? `${tr.name} · ${tr.unit || 'AMB-014'}` : 'Transportista' };
  set({ trip, temp: 4.2 }); patchReq({ delivery: 'en_ruta', tripId: trip.id, assignedTo: trip.assignedTo });
  return trip;
};

// El donante se arrepiente (o el banco deniega su donación): la solicitud vuelve a buscar donantes y se libera su cita.
// Si `denied` viene informado, el donante queda excluido de esta solicitud y se deja constancia del motivo.
export const releaseDonor = (email, denied = null) => {
  const r = get().req, my = get().myAppt;
  if (r && r.donor?.email === email && ['esperando', 'programada'].includes(r.status)) {
    const { donor, appt, ...rest } = r, excluded = denied ? [...(r.excluded || []), email] : r.excluded || [];
    set({ req: { ...rest, excluded, declined: (r.declined || 0) + 1, lastDenied: denied || undefined } });
    patchReq({ status: 'buscando', notified: eligibleDonors(r.blood, excluded).length });
  }
  set({ inFlow: false, triage: null, triageAns: null, myAppt: null, slot: null, appts: denied ? get().appts : get().appts.filter((a) => !my || a.id !== my.id) });
};

// ---- Fechas y horas reales -----------------------------------------------------
export const hhmm = (ts) => new Date(ts).toLocaleTimeString('es-MX', { hour: '2-digit', minute: '2-digit', hourCycle: 'h23' });
export const fmtDateTime = (ts) => `${new Date(ts).toLocaleDateString('es-MX', { day: 'numeric', month: 'short', year: 'numeric' })} · ${hhmm(ts)}`;
export const ago = (ts) => {
  const m = Math.max(0, Math.round((Date.now() - ts) / 60000));
  if (m < 1) return 'Hace un momento';
  if (m < 60) return `Hace ${m} min`;
  const h = Math.floor(m / 60);
  return h < 24 ? `Hace ${h} h ${m % 60} min` : `Hace ${Math.floor(h / 24)} d`;
};
// Momento de la primera carga de datos de demostración (los datos de ejemplo se expresan relativos a él)
export const seedAt = () => { if (!get().seedAt) set({ seedAt: Date.now() }); return get().seedAt; };
// Próximos horarios de cita: a partir de la hora actual, cada 30 min
export const slotsFromNow = (n = 4) => {
  const d = new Date(); d.setSeconds(0, 0); d.setMinutes(d.getMinutes() < 30 ? 30 : 60);
  return Array.from({ length: n }, (_, i) => { const t = new Date(d.getTime() + i * 1800000); return [t.toLocaleTimeString('en-GB', { hour: '2-digit', minute: '2-digit' }), t.toLocaleTimeString('en-US', { hour: '2-digit', minute: '2-digit' })]; });
};

// ---- Evaluación de la donación por el banco ------------------------------------
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
// Diferimiento del donante tras una denegación (el motivo más largo manda)
export const deferralDate = (ids) => { const d = Math.max(0, ...ids.map((i) => REASONS.find((r) => r.id === i)?.days || 0)); return d ? new Date(Date.now() + d * 86400000).toISOString() : null; };
export const deferred = (u) => !!(u.deferUntil && new Date(u.deferUntil) > new Date());
export const statusOf = (u) => (deferred(u) ? 'Diferido temporalmente' : u.deferBy === 'review' ? 'Apto para donar' : u.status);
// Donaciones y denegaciones del donante, de la más reciente a la más antigua
export const attemptsOf = (u) => [
  ...historyOf(u).map((d) => ({ ...d, kind: 'donacion', at: d.date })),
  ...reviewsAll().filter((r) => r.email === u.email && r.decision === 'no_apta').map((r) => ({ ...r, kind: 'rechazo' })),
].sort((a, b) => new Date(b.at) - new Date(a.at));

// ---- Viaje de demostración (destinos y rutas distintos cada vez) ------------------
export const demoTrip = (base) => {
  const i = get().tripIdx || 0, c = CASES[i % CASES.length], n = (get().tripSeq || 9902) + 1, dist = routeKm(c.hospital);
  set({ tripIdx: i + 1, tripSeq: n });
  return { ...base, id: `TR-${n}`, origin: BANK.name, dest: c.hospital, content: `${c.units} u. ${c.component} ${c.blood}`, distance: `${dist.toFixed(1)} km`, eta: `${Math.max(5, Math.round((dist / 30) * 60))} min`, status: 'asignada', priority: c.priority, area: c.area, bed: c.bed, requester: `Servicio de ${c.area}`, assignedAt: Date.now(), assignedTo: 'Transportista de turno', thermalLogs: [], reqId: null };
};
