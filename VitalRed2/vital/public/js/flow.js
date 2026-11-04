// Guardas de navegación: cada pantalla de un flujo solo es accesible en su etapa. Si se intenta abrir otra
// (por la URL, con "atrás" o forzándola), se redirige a la pantalla de la etapa actual con un aviso.
// Cada regla recibe el estado y devuelve null (permitido) o [ruta destino, mensaje].
import { getTrip } from './screens-transport.js';
import { currentUser } from './store.js';
import { activeReq } from './domain.js';

// ---------------- Donante ----------------
const answered = (s) => Array.isArray(s.triageAns) && s.triageAns.length === 5 && s.triageAns.every(Boolean);

// idle -> triage -> review -> schedule -> booked -> done   (rejected si el pre-triaje no se aprueba)
export const donorStage = (s, u) => {
  const a = s.myAppt && s.myAppt.email === u.email ? s.myAppt : null;
  if (a && a.state === 'Completada') return 'done';
  if (a && a.state !== 'No asistió') return 'booked';
  if (!s.inFlow || s.flowOwner !== u.email) return 'idle';
  if (s.triage === true) return 'schedule';
  return answered(s) ? 'review' : 'triage';
};
export const STAGE_HOME = { idle: 'd/alert', triage: 'd/triage', review: 'd/review', schedule: 'd/schedule', booked: 'd/qr', done: 'd/done' };
const STAGE_MSG = {
  idle: 'Primero acepta una alerta de donación', triage: 'Completa tu pre-triaje para continuar', review: 'Confirma tus respuestas del pre-triaje',
  schedule: 'Tu pre-triaje ya fue confirmado: agenda tu cita', booked: 'Ya tienes una cita agendada', done: 'Tu donación ya fue completada',
};
const DONOR_ALLOWED = { idle: ['d/alert'], triage: ['d/triage'], review: ['d/review', 'd/triage'], schedule: ['d/schedule'], booked: ['d/qr'], done: ['d/done', 'd/pdf', 'd/alert'] };
const donorRule = (path) => (s) => {
  const u = currentUser(); if (!u) return null;
  const st = donorStage(s, u);
  if (path === 'd/rejected') return s.triage === false && st === 'idle' ? null : [STAGE_HOME[st], STAGE_MSG[st]];
  return DONOR_ALLOWED[st].includes(path) ? null : [STAGE_HOME[st], STAGE_MSG[st]];
};

// ---------------- Transportista (asignada -> custodia -> tránsito -> entrega -> bitácora) ----------------
function transit() {
  const t = getTrip();
  if (!t) return ['t/home', 'No hay un viaje activo'];
  if (t.status === 'transito') return null;
  return ['t/check', 'Primero completa la verificación de custodia'];
}

const RULES = {
  ...Object.fromEntries(['d/alert', 'd/triage', 'd/review', 'd/schedule', 'd/rejected', 'd/done', 'd/pdf'].map((p) => [p, donorRule(p)])),

  // ---- Médico
  'm/new': () => (activeReq() ? ['m/radar', 'Ya tienes una solicitud en curso: cancélala o espera a que se complete'] : null),
  'm/none': (s) => (s.req && !['cancelada', 'cerrada'].includes(s.req.status) ? ['m/radar', 'Hay una solicitud activa'] : null),
  'm/reception': (s) => (s.req && s.req.status === 'completada' && s.req.delivery === 'entregada' ? null : ['m/radar', 'La recepción estará disponible cuando llegue la unidad']),
  'm/radar': (s) => (s.req && s.req.status === 'cancelada' ? ['m/none', 'La solicitud fue cancelada'] : null),

  // ---- Transportista
  't/check': () => {
    const t = getTrip();
    if (!t) return ['t/home', 'No hay un viaje activo'];
    return t.status === 'transito' ? ['t/transit', 'El traslado ya está en tránsito'] : null;
  },
  't/transit': () => transit(),
  't/manual': () => transit(),
  't/delivery': () => transit(),
  't/logbook': (s) => (s.activeLogbook ? null : ['t/home', 'Aún no hay una bitácora generada']),
};

export const guard = (path, state) => RULES[path]?.(state) || null;
