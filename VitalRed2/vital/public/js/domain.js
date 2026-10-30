// Reglas de negocio compartidas entre perfiles (sin backend: todo vive en el estado compartido del navegador).
// Ciclo de una solicitud:  buscando -> esperando (un donante aceptó) -> programada (agendó cita)
//   -> completada (el banco registró la donación) -> entrega: preparando -> en_ruta -> entregada -> cerrada (el médico recibe).
import { get, set } from './store.js';
import { BANK, HOSPITALS } from './maps.js';

export const COMPONENTS = ['Concentrado de hematíes', 'Sangre total', 'Plasma fresco congelado', 'Plaquetas por aféresis'];
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

// Casos de demostración distintos (hospital, destino, grupo, hemocomponente...)
export const CASES = [
  { hospital: 'Hospital General', blood: 'O-', units: 2, component: 'Concentrado de hematíes', area: 'Urgencias', priority: 'CRÍTICA' },
  { hospital: 'Hospital San Rafael', blood: 'A+', units: 3, component: 'Plasma fresco congelado', area: 'Quirófano', priority: 'ALTA' },
  { hospital: 'Clínica Santa María', blood: 'B+', units: 1, component: 'Plaquetas por aféresis', area: 'Terapia intensiva', priority: 'ALTA' },
  { hospital: 'Hospital del Valle', blood: 'O+', units: 2, component: 'Sangre total', area: 'Pediatría', priority: 'CRÍTICA' },
  { hospital: 'Hospital Ángeles', blood: 'AB+', units: 2, component: 'Concentrado de hematíes', area: 'Ginecología', priority: 'ALTA' },
  { hospital: 'Hospital Regional', blood: 'A-', units: 1, component: 'Concentrado de hematíes', area: 'Urgencias', priority: 'CRÍTICA' },
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
export const patchReq = (p) => set({ req: { ...get().req, ...p } });

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
  const dist = routeKm(r.hospital);
  const trip = { ...baseTrip, id: `TR-${r.id.slice(3)}`, origin: BANK.name, dest: r.hospital, content: `${r.units} u. ${r.component} ${r.blood}`, distance: `${dist.toFixed(1)} km`, eta: `${Math.max(5, Math.round((dist / 30) * 60))} min`, status: 'asignada', check0: false, check1: false, check2: false, scanOk: false, signOk: false, photoOrigin: null, photoDelivery: null, thermalLogs: [], reqId: r.id };
  set({ trip, temp: 4.2 }); patchReq({ delivery: 'en_ruta', tripId: trip.id });
  return trip;
};

// El donante se arrepiente: la solicitud vuelve a buscar donantes y se libera su cita
export const releaseDonor = (email) => {
  const r = get().req, my = get().myAppt;
  if (r && r.donor?.email === email && ['esperando', 'programada'].includes(r.status)) {
    const { donor, appt, ...rest } = r;
    set({ req: { ...rest, status: 'buscando', notifiedAt: undefined, declined: (r.declined || 0) + 1 } });
  }
  set({ inFlow: false, triage: null, triageAns: null, myAppt: null, slot: null, appts: get().appts.filter((a) => !my || a.id !== my.id) });
};
