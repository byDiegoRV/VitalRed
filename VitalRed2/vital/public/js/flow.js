// Guardas de navegación: impiden abrir pantallas que ya no corresponden al paso actual del flujo
// (por ejemplo, volver al pre-triaje después de confirmarlo, o a la ruta de un viaje ya entregado).
// Cada regla recibe el estado y devuelve null (permitido) o [ruta destino, mensaje].
import { getTrip } from './screens-transport.js';

const done = (s) => !!(s.myAppt && (s.appts || []).some((a) => a.id === s.myAppt.id && a.state === 'Completada'));
const pending = (s) => !!s.myAppt && !done(s);
const answered = (s) => Array.isArray(s.triageAns) && s.triageAns.length === 5 && s.triageAns.every(Boolean);

// Dónde debe estar quien ya pasó por el pre-triaje
const afterTriage = (s) => {
  if (pending(s)) return ['d/qr', 'Ya tienes una cita agendada'];
  if (s.triage === true) return ['d/schedule', 'Tu pre-triaje ya fue confirmado'];
  if (s.triage === false) return ['d/rejected', 'Tu pre-triaje ya fue evaluado'];
  return null;
};

const RULES = {
  // ---- Donante
  'd/triage': (s) => {
    if (!s.inFlow) return ['d/alert', 'Primero acepta una alerta de donación'];
    return afterTriage(s);
  },
  'd/review': (s) => {
    if (!s.inFlow) return ['d/alert', 'Primero acepta una alerta de donación'];
    const a = afterTriage(s);
    if (a) return a;
    return answered(s) ? null : ['d/triage', 'Responde primero el pre-triaje'];
  },
  'd/schedule': (s) => {
    if (pending(s)) return ['d/qr', 'Ya tienes una cita agendada'];
    if (!s.inFlow) return ['d/alert', 'Primero acepta una alerta de donación'];
    return s.triage === true ? null : ['d/triage', 'Completa el pre-triaje antes de agendar'];
  },
  'd/rejected': (s) => (s.triage === false ? null : ['d/alert', 'Esta pantalla ya no está disponible']),
  'd/done': (s) => (done(s) ? null : ['d/qr', 'Aún no hay una donación completada']),
  'd/pdf': (s) => (done(s) ? null : ['d/qr', 'Aún no hay una donación completada']),

  // ---- Médico
  'm/none': (s) => (s.req && s.req.status !== 'cancelada' ? ['m/radar', 'Hay una solicitud activa'] : null),
  'm/reception': (s) => (s.req && s.req.status === 'programada' ? null : ['m/radar', 'La recepción aún no está disponible']),
  'm/radar': (s) => (s.req && s.req.status === 'cancelada' ? ['m/none', 'La solicitud fue cancelada'] : null),

  // ---- Transportista (asignada -> custodia -> tránsito -> entrega -> bitácora)
  't/check': (s) => {
    const t = getTrip();
    if (!t) return ['t/home', 'No hay un viaje activo'];
    return t.status === 'transito' ? ['t/transit', 'El traslado ya está en tránsito'] : null;
  },
  't/transit': (s) => transit(s),
  't/manual': (s) => transit(s),
  't/delivery': (s) => transit(s),
  't/logbook': (s) => (s.activeLogbook ? null : ['t/home', 'Aún no hay una bitácora generada']),
};

function transit() {
  const t = getTrip();
  if (!t) return ['t/home', 'No hay un viaje activo'];
  if (t.status === 'transito') return null;
  return ['t/check', 'Primero completa la verificación de custodia'];
}

export const guard = (path, state) => RULES[path]?.(state) || null;
