import { get, currentUser, HOME } from './store.js';
import { btn, card, badge, field, toggle, stepper, qrPattern, icon, statusScreen, esc } from './ui.js';
import { fleetUnits, fleetMount, BANK } from './maps.js';
import { activeReq, historyOf, fmtDate, nextEligible, compatible, shortName, statusOf, deferred, reasonLabel, REASONS, CHECKS, reviewsAll, eligibleDonors, hhmm, ago, seedAt, fmtDateTime } from './domain.js';
import { donorStage, STAGE_HOME } from './flow.js';

const chip = (b, cls = '') => `<span class="chip ${cls}">${b}</span>`;
const date = () => new Date().toLocaleDateString('es-MX', { weekday: 'long', day: 'numeric', month: 'long', year: 'numeric' });
const YN = [['yes', 'Sí'], ['no', 'NO']];
const TRIAGE = ['¿Has tomado antibióticos, aspirinas o antiinflamatorios en los últimos 7 días?', '¿Presentas fiebre, gripe o malestar en este momento?', '¿Alcohol o sustancias en las últimas 48 horas?', '¿Ayuno de al menos 4 h y líquidos hoy?', '¿Dormiste al menos 6 horas anoche?'];

const STOCK = [['A+', 64, 'ÓPTIMO'], ['A-', 12, 'BAJO'], ['B+', 45, 'ÓPTIMO'], ['B-', 3, 'CRÍTICO'], ['AB+', 28, 'ÓPTIMO'], ['AB-', 5, 'CRÍTICO'], ['O+', 89, 'ÓPTIMO'], ['O-', 8, 'BAJO']];
const level = { ÓPTIMO: 'ok', BAJO: 'warn', CRÍTICO: 'red' };
const REQ_STEPS = ['Creada', 'Buscando', 'Esperando', 'Programada', 'Completada'];
const DELIVERY = { preparando: 'Preparando envío', despachada: 'Esperando transportista', asignada: 'Transportista asignado', en_ruta: 'En ruta', entregada: 'Entregada' };
const reqLabel = (r) => (r.status === 'completada' ? DELIVERY[r.delivery] || 'Completada' : { buscando: 'En búsqueda', esperando: 'Donante en camino', programada: 'Cita programada' }[r.status] || r.status);
const apptSel = () => { const A = get().appts; return A.find((x) => x.id === get().selAppt) || A[0]; };
const initials = (n) => String(n || '?').split(' ').map((w) => w[0]).slice(0, 2).join('');

const seedReqs = () => {
  const m = (x) => seedAt() + x * 60000;
  return [
    { id: 'ST-2048', blood: 'O-', patient: 'Lucía Martínez Reyes', hc: 'HC 482901', bed: 'Quirófano 2', area: 'Quirófano', label: 'En búsqueda', color: 'warn', units: 2, component: 'Concentrado de hematíes', priority: 'CRÍTICA', diagnosis: 'Hemorragia intraoperatoria', stage: 'buscando', at: m(-4), requester: 'Dra. Ana Torres' },
    { id: 'ST-2046', blood: 'AB+', patient: 'Carlos Pérez Luna', hc: 'HC 391774', bed: 'Box Urgencias 08', area: 'Urgencias', label: 'Confirmación de unidad', color: 'ok', units: 3, component: 'Plasma fresco congelado', priority: 'ALTA', diagnosis: 'Coagulopatía', stage: 'completada', donor: 'Daniel R. • AB+', at: m(-95), requester: 'Dr. Mario Fuentes' },
    { id: 'ST-2042', blood: 'A+', patient: 'Elena Ramírez Soto', hc: 'HC 520118', bed: 'Quirófano 4', area: 'Quirófano', label: 'Programada', color: '', units: 1, component: 'Plaquetas por aféresis', priority: 'PROGRAMADA', diagnosis: 'Cirugía programada', stage: 'programada', donor: 'Sofía M. • A+', at: m(90), scheduled: true, requester: 'Dra. Lucía Vera' },
    { id: 'ST-2039', blood: 'B-', patient: 'Miguel Ángel Salas', hc: 'HC 278430', bed: 'Shock room', area: 'Urgencias', label: 'Sin respuesta', color: 'red', units: 4, component: 'Concentrado de hematíes', priority: 'CRÍTICA', diagnosis: 'Politraumatismo', stage: 'sinrespuesta', at: m(-28), requester: 'Dr. Mario Fuentes' },
    { id: 'ST-2035', blood: 'A-', patient: 'Ana Sofía Vega', hc: 'HC 440821', bed: 'Observación 3', area: 'Urgencias', label: 'Cancelada', color: '', units: 2, component: 'Plasma fresco congelado', priority: 'CANCELADA', diagnosis: 'Observación', stage: 'cancelada', at: m(-150), requester: 'Dra. Ana Torres' },
  ].map((x) => ({ hospital: 'Hospital General', ...x }));
};

const reqList = () => {
  const r = get().req;
  const live = r && activeReq() ? [{ id: r.id, blood: r.blood, patient: r.patient || 'Paciente en curso', hc: r.hc || 'HC nuevo', bed: r.bed || r.area, area: r.area, label: reqLabel(r), color: 'warn', units: r.units, component: r.component, priority: r.priority, hospital: r.hospital, diagnosis: r.diagnosis, stage: r.status, at: Date.parse(r.createdAt) || Date.now(), requester: r.requester, live: true }] : [];
  return [...live, ...seedReqs()];
};

export const RESERVABLE = [{ id: 'SR-4821', hospital: 'Hospital San Rafael', blood: 'O-', units: 4, reason: 'Cirugía de emergencia' }];

export const stockNow = () => {
  const held = get().reserved || [];
  return STOCK.map(([g, n]) => {
    const m = Math.max(0, n - RESERVABLE.filter((r) => held.includes(r.id) && r.blood === g).reduce((a, r) => a + r.units, 0));
    return [g, m, m < 6 ? 'CRÍTICO' : m < 20 ? 'BAJO' : 'ÓPTIMO'];
  });
};

const REPORT_HEAD = ['ID Bolsa', 'Grupo', 'Extracción', 'Pruebas (VIH/HEP/SIF)', 'Hospital destino', 'Firma digital'];
const REPORT_ROWS = [['#B-91024', 'O+', '12 Ene 2026', 'Hosp. San Rafael', 'Dr. Torres'], ['#B-91025', 'A-', '12 Ene 2026', 'Clín. Santa María', 'Dra. Okonkwo'], ['#B-91028', 'B+', '13 Ene 2026', 'Hosp. del Valle', 'Dr. Torres'], ['#B-91030', 'O-', '13 Ene 2026', 'Hosp. San Rafael', 'Dra. Okonkwo'], ['#B-91032', 'AB+', '14 Ene 2026', 'Hosp. Ángeles', 'Dr. Torres'], ['#B-91039', 'O+', '14 Ene 2026', 'Hosp. Regional', 'Dr. Torres']].map(([i, g, d, h, f]) => [i, g, d, 'NEGATIVO', h, f]);

export const reportCsv = () => [REPORT_HEAD, ...REPORT_ROWS].map((r) => r.map((c) => `"${String(c).replace(/"/g, '""')}"`).join(',')).join('\r\n');
export const reportDoc = () => `<article class="doc"><header class="doc-head"><div class="logo"><i>${icon('drop', 18)}</i>VitalRed</div><div class="right"><small class="lbl">REPORTE DE TRAZABILIDAD</small><br><b>${new Date().toLocaleDateString('es-MX', { dateStyle: 'long' })}</b></div></header><div class="doc-title"><div><h1>Historial de Trazabilidad</h1><p class="mut">Registros de unidades procesadas según NOM-253-SSA1-2012.</p></div></div><div class="tbl"><table><thead><tr>${REPORT_HEAD.map((h) => `<th>${h}</th>`).join('')}</tr></thead><tbody>${REPORT_ROWS.map((r) => `<tr>${r.map((c) => `<td>${esc(c)}</td>`).join('')}</tr>`).join('')}</tbody></table></div><p class="cert">Documento generado por VitalRed — Banco de Sangre Central.</p></article>`;
const table = (head, rows, cls = '') => `<div class="tbl ${cls}" tabindex="0" role="region" aria-label="Tabla de datos"><table><thead><tr>${head.map((h) => `<th>${h}</th>`).join('')}</tr></thead><tbody>${rows.join('')}</tbody></table></div>`;

export const overrides = {
  // PANTALLA DE LOGIN CON EL DISEÑO ORIGINAL CENTRADO
  login: {
    render: () => `<div class="auth">
      <div class="card" style="background:linear-gradient(140deg,#d92d20,#b42318 60%,#7a271a);color:#fff;border:0;padding:24px;margin-bottom:14px">
        <div class="brand-mark" style="background:rgba(255,255,255,0.2);width:48px;height:48px;border-radius:14px;display:grid;place-items:center;margin-bottom:12px">
          ${icon('drop', 26)}
        </div>
        <h1 style="color:#fff;font-size:26px;margin:0 0 6px">VitalRed</h1>
        <p style="color:rgba(255,255,255,0.92);font-size:13px;margin:0 0 14px;line-height:1.4">Plataforma de emergencias transfusionales y logística biológica.</p>
        <div style="font-weight:600;font-size:12px;line-height:1.7;color:#fff">
          <div>• Alertas Código Rojo geolocalizadas</div>
          <div>• Cadena de frío con telemetría</div>
          <div>• Trazabilidad conforme a NOM-253</div>
        </div>
      </div>
      ${card(`
        <h2>Iniciar sesión</h2>
        <p class="mut" style="margin:6px 0 16px">Tu perfil se detecta automáticamente con tus credenciales.</p>
        <form data-form="login" class="stack" novalidate>
          ${field('email', 'Correo o cédula profesional', 'text', 'usuario@vitalred.org')}
          ${field('password', 'Contraseña', 'password', '••••••••')}
          ${btn('<span class="spin"></span>Ingresar', { type: 'submit' })}
        </form>
        <p class="center mut" style="margin-top:14px">¿Eres donante nuevo? <a href="#/register">Regístrate</a> • <a href="#/register?inst=1">Registro institucional</a></p>
      `)}
    </div>`
  },

  'm/radar': {
    role: 'medical',
    render: () => {
      const r = get().req;
      if (!r) return statusScreen(icon('radar', 44), 'Sin solicitud', 'Crea una solicitud para activar el radar.', btn('Nueva solicitud', { go: 'm/new' }));
      const idx = { buscando: 1, sinrespuesta: 1, esperando: 2, programada: 3, completada: 4, cerrada: 4 }[r.status] ?? 1, head = stepper(REQ_STEPS, idx);
      const sim = (label) => btn(label, { act: 'simStage', v: 'ghost' });
      const row = (k, v) => `<div class="item"><span class="mut">${k}</span><b>${v}</b></div>`;
      const sub = `${r.units} u. de ${esc(r.blood)} • ${esc(r.component || '')} • ${esc(r.hospital)}`;
      const wrap = (html) => card(`${html}<div class="stack" style="margin-top:12px">${btn('Ver detalle completo y línea de tiempo', { go: `m/detail?id=${r.id}`, v: 'ghost' })}</div>`);
      if (r.status === 'cerrada') return wrap(`${head}<div class="center stack"><div class="big ok-ring">${icon('check', 40)}</div><h2>Caso cerrado</h2><p class="mut">${sub}</p><p class="mut">La unidad fue recibida y la transfusión inició. Quedó registrada en la trazabilidad.</p>${btn('Nueva solicitud', { go: 'm/new' })}</div>`);
      if (r.status === 'completada') {
        const d = r.delivery || 'preparando', steps = [['preparando', 'Donación aprobada • preparando envío'], ['despachada', 'Unidad despachada • esperando transportista'], ['asignada', 'Transportista asignado'], ['en_ruta', 'Unidad en ruta hacia el hospital'], ['entregada', 'Unidad entregada en el hospital']], at = steps.findIndex(([k]) => k === d), t = get().trip, simLabel = { preparando: 'Simular: banco despacha la unidad', despachada: 'Simular: un transportista toma el viaje', asignada: 'Simular: inicia el traslado', en_ruta: 'Simular: unidad entregada' }[d];
        return wrap(`${head}<div class="center"><div class="big ok-ring">${icon('check', 40)}</div><h2>Donación completada</h2><p class="mut">${sub}</p></div><div class="stack" style="margin-top:12px">${row('Donante', esc(shortName(r.donor?.name)))}${row('Destino', esc(r.hospital))}${r.assignedTo ? row('Transportista', esc(r.assignedTo)) : ''}${t && t.reqId === r.id ? row('Distancia • tiempo', `${esc(t.distance)} • ${esc(t.eta)}`) : ''}</div><ul class="tl" aria-label="Seguimiento de la unidad">${steps.map(([k, l], i) => `<li class="${i < at ? 'done' : i === at ? 'now' : ''}"><i></i><span>${l}</span></li>`).join('')}</ul>${d === 'entregada' ? `<div class="stack">${btn('Ir a recepción de la unidad', { go: 'm/reception' })}</div>` : `<div class="banner info">El banco publica el viaje, un transportista lo toma y entrega la unidad con cadena de frío.</div>${sim(simLabel)}`}`);
      }
      if (r.status === 'programada') return wrap(`${head}<div class="center"><div class="big ok-ring">${icon('calendar', 40)}</div><h2>Cita programada</h2><p class="mut">${sub}</p></div><div class="stack" style="margin-top:12px">${row('Donante', esc(shortName(r.donor?.name)) + ' • ' + esc(r.donor?.blood || r.blood))}${row('Centro de donación', esc(BANK.name))}${row('Hora de la cita', 'Hoy • ' + esc(r.appt?.time || ''))}${row('Folio del pase', esc(r.appt?.id || ''))}</div><div class="banner info">El banco de sangre ya tiene la solicitud. Al registrar la donación se despachará la unidad.</div><div class="stack">${btn('Cancelar solicitud', { act: 'cancelReq', v: 'ghost' })}${sim('Simular: donación completada')}</div>`);
      if (r.status === 'esperando') return wrap(`${head}<div class="center"><div class="ring" style="margin:0 auto 8px">${esc(initials(r.donor?.name))}</div><h2>Donante en camino</h2><p class="mut">${sub}</p><p id="radarMsg" class="mut"><b>${esc(shortName(r.donor?.name))}</b> (${esc(r.donor?.blood || r.blood)}) aceptó la alerta y está completando su pre-triaje.</p></div><div class="stack">${btn('Cancelar solicitud', { act: 'cancelReq', v: 'ghost' })}${sim('Simular: cita agendada')}</div>`);
      const ds = eligibleDonors(r.blood, r.excluded || []);
      return wrap(`${head}<div class="center"><h2>Radar transfusional</h2><p class="mut">${sub}</p><div class="radar" id="radarTxt">${ds.length} notificados</div><p id="radarMsg" class="mut">Estamos alertando donantes compatibles.</p></div>${r.lastDenied ? `<div class="banner warn"><b>Donación no autorizada por el banco</b><p>${esc(r.lastDenied.name)}: ${esc(r.lastDenied.reasons.map(reasonLabel).join('; '))}. Se reanudó la búsqueda de otro donante.</p></div>` : r.declined ? '<div class="banner info"><b>El donante anterior canceló</b><p>Se reanudó la búsqueda de otro donante.</p></div>' : ''}<div class="stack" style="margin-top:12px"><small class="lbl">DONANTES NOTIFICADOS (${ds.length})</small>${ds.length ? ds.map((d) => `<div class="item"><span>${esc(shortName(d.name))} • ${esc(d.blood)}</span>${badge('Notificado', '')}</div>`).join('') : '<div class="item"><span class="mut">Aún no hay donantes compatibles registrados</span></div>'}</div><div class="stack">${btn('Cancelar solicitud', { act: 'cancelReq', v: 'ghost' })}${sim('Simular: un donante acepta')}${btn('Simular: sin respuesta', { go: 'm/none', v: 'ghost', act: 'noResp' })}</div>`);
    },
  },

  'm/reception': {
    role: 'medical',
    render: () => { const r = get().req; return card(`${r ? stepper(REQ_STEPS, 4) : ''}<h2>Recepción de unidad</h2><p class="mut">${r ? `${r.units} u. de ${esc(r.blood)} • ${esc(r.component || '')} • ${esc(r.id)}` : ''}</p><div class="stack" style="margin-top:12px"><div class="sig" role="button" tabindex="0" data-act="sigToggle" data-todo="Toca para escanear código de la bolsa" data-done="Código verificado ✓">Toca para escanear código de la bolsa</div><div><span class="mut">Verificación clínica</span>${['Confirmación de sello de laboratorio', 'Integridad física'].map((c) => `<label class="item"><span>${c}</span><input type="checkbox" class="chk" style="width:22px;min-height:22px"></label>`).join('')}</div><div class="sig" role="button" tabindex="0" data-act="sigToggle" data-todo="Toca para firmar" data-done="Firmado ✓">Toca para firmar</div>${btn('Confirmar recepción e iniciar transfusión', { act: 'receive', id: 'recvBtn', dis: true })}</div>`); },
    mount: (root) => { const upd = () => { root.querySelector('#recvBtn').disabled = !(root.querySelectorAll('.sig.ok').length === 2 && [...root.querySelectorAll('.chk')].every((c) => c.checked)); }; root.addEventListener('selchange', upd); root.addEventListener('change', upd); return () => { root.removeEventListener('selchange', upd); root.removeEventListener('change', upd); }; },
  },

  // DETALLE DE SOLICITUD CON LÍNEA DE TIEMPO
  'm/detail': {
    role: 'medical', wide: true,
    render: ({ q }) => {
      const all = reqList(), x = all.find((i) => i.id === q?.id);
      if (!x) return statusScreen(icon('clipboard', 44), 'Solicitud no encontrada', 'El registro de solicitud con folio ' + esc(q?.id || '') + ' no se encuentra disponible.', btn('Volver a la Guardia', { go: 'm/dashboard' }));
      const r = x.live ? get().req : null;
      const row = (k, v) => `<div class="item"><span class="mut">${k}</span><b>${v}</b></div>`;
      const logTime = (key) => {
        if (!r?.log) return null;
        const entry = [...r.log].reverse().find((l) => l.k === key);
        return entry ? entry.at : null;
      };

      const STAGES = [
        { key: 'creada', title: 'Solicitud Creada', actor: 'Personal Médico', desc: 'Solicitud transfusional dada de alta con datos del paciente.' },
        { key: 'buscando', title: 'Alerta a Donantes', actor: 'Sistema VitalRed', desc: 'Notificación enviada a donantes compatibles en la zona geográfica.' },
        { key: 'esperando', title: 'Donante Aceptó', actor: 'Donante Voluntario', desc: 'Un donante voluntario atendió el Código Rojo y comenzó su pre-triaje.' },
        { key: 'programada', title: 'Cita en Banco de Sangre', actor: 'Donante / Banco', desc: 'Horario confirmado en Banco Central y pase digital QR activo.' },
        { key: 'completada', title: 'Donación Evaluada y Aprobada', actor: 'Banco de Sangre', desc: 'Extracción completada y 4 controles de calidad NOM-253 aprobados.' },
        { key: 'entrega_despachada', title: 'Unidad Despachada', actor: 'Banco de Sangre', desc: 'Bolsa sellada, empaque biológico verificado y viaje logístico publicado.' },
        { key: 'entrega_asignada', title: 'Transportista Asignado', actor: 'Transportista', desc: 'Ambulancia sanitaria asignada y checklist de custodia aceptado.' },
        { key: 'entrega_en_ruta', title: 'Traslado en Ruta', actor: 'Transportista', desc: 'Traslado activo monitoreado por telemetría IoT (2 a 10 °C).' },
        { key: 'entrega_entregada', title: 'Unidad Entregada en Hospital', actor: 'Transportista', desc: 'Unidad entregada en el servicio hospitalario con evidencia fotográfica.' },
        { key: 'cerrada', title: 'Recepción y Transfusión', actor: 'Personal Médico', desc: 'Sello e integridad verificados, firma capturada e inicio de transfusión.' }
      ];

      const curDelivery = r?.delivery || '';
      const curStatus = r?.status || x.stage;
      const isReached = (stKey, idx) => {
        if (x.priority === 'CANCELADA') return idx === 0;
        if (r) {
          if (logTime(stKey)) return true;
          if (curStatus === 'cerrada') return true;
          if (curStatus === 'completada') {
            if (['creada', 'buscando', 'esperando', 'programada', 'completada'].includes(stKey)) return true;
            if (curDelivery === 'despachada' && stKey === 'entrega_despachada') return true;
            if (curDelivery === 'asignada' && ['entrega_despachada', 'entrega_asignada'].includes(stKey)) return true;
            if (curDelivery === 'en_ruta' && ['entrega_despachada', 'entrega_asignada', 'entrega_en_ruta'].includes(stKey)) return true;
            if (curDelivery === 'entregada' && ['entrega_despachada', 'entrega_asignada', 'entrega_en_ruta', 'entrega_entregada'].includes(stKey)) return true;
          }
          if (curStatus === 'programada' && ['creada', 'buscando', 'esperando', 'programada'].includes(stKey)) return true;
          if (curStatus === 'esperando' && ['creada', 'buscando', 'esperando'].includes(stKey)) return true;
          if (curStatus === 'buscando' && ['creada', 'buscando'].includes(stKey)) return true;
          return false;
        } else {
          const rank = { buscando: 2, sinrespuesta: 2, esperando: 3, programada: 4, completada: 9, cerrada: 10, cancelada: 1 }[x.stage] ?? 1;
          return idx < rank;
        }
      };

      const reachedMap = STAGES.map((s, idx) => isReached(s.key, idx));
      let lastCompletedIdx = -1;
      for (let i = 0; i < reachedMap.length; i++) {
        if (reachedMap[i]) lastCompletedIdx = i;
      }
      const activeIdx = x.priority === 'CANCELADA' ? -1 : (lastCompletedIdx < STAGES.length - 1 ? lastCompletedIdx + 1 : lastCompletedIdx);

      const timelineHtml = STAGES.map((s, idx) => {
        const done = reachedMap[idx];
        const isNow = idx === activeIdx && !done;
        let timeVal = 'Pendiente';
        if (r && logTime(s.key)) {
          timeVal = hhmm(logTime(s.key));
        } else if (done) {
          timeVal = idx === 0 ? hhmm(x.at) : 'Completado';
        } else if (isNow) {
          timeVal = 'En proceso';
        }
        return `
          <div class="tl-step ${done ? 'done' : isNow ? 'now' : ''}">
            <div class="tl-step-icon">${done ? '✓' : idx + 1}</div>
            <div class="tl-step-body">
              <div class="tl-step-head">
                <b>${esc(s.title)}</b>
                <span class="time">${timeVal}</span>
              </div>
              <p>${esc(s.desc)}</p>
              <small class="badge" style="font-size:10.5px;padding:1px 7px;margin-top:4px">${esc(s.actor)}</small>
            </div>
          </div>
        `;
      }).join('');

      const t = get().trip, trip = r && t && t.reqId === r.id ? t : null;
      const evalRec = r ? reviewsAll().find((v) => v.reqId === r.id && v.decision === 'apta') : null;

      return `
        <div class="between" style="margin-bottom:14px">
          <div>
            <h1>Detalle de Solicitud Transfusional</h1>
            <p class="mut">Folio Oficial: <b>${esc(x.id)}</b> • ${esc(x.hospital)} • ${esc(x.area)}</p>
          </div>
          ${badge(x.label, x.color)}
        </div>
        ${x.priority === 'CRÍTICA' ? '<div class="banner warn"><b>Atención Prioritaria: CÓDIGO ROJO</b><p>Meta transfusional establecida en menos de 30 minutos desde la activación del protocolo.</p></div>' : ''}
        ${x.priority === 'CANCELADA' ? '<div class="banner warn"><b>Solicitud Cancelada</b><p>El personal médico dio de baja esta solicitud. Los donantes vinculados fueron liberados.</p></div>' : ''}
        <div class="split">
          <div class="stack">
            ${card(`
              <div class="between">
                <h3>Paciente y Servicio</h3>
                ${chip(x.blood, x.priority === 'CRÍTICA' ? 'red' : '')}
              </div>
              <div class="stack" style="margin-top:10px">
                ${row('Nombre completo', esc(x.patient))}
                ${row('Expediente (HC)', esc(x.hc))}
                ${row('Cama / Ubicación', esc(x.bed))}
                ${row('Servicio clínico', esc(x.area))}
                ${row('Diagnóstico / Motivo', esc(x.diagnosis || 'Urgencia transfusional'))}
              </div>
            `)}
            ${card(`
              <h3>Especificaciones Biológicas</h3>
              <div class="stack" style="margin-top:10px">
                ${row('Grupo ABO/Rh requerido', esc(x.blood))}
                ${row('Hemocomponente', esc(x.component))}
                ${row('Cantidad de unidades', `${x.units} bolsa(s)`)}
                ${row('Prioridad de solicitud', `<span class="${x.priority === 'CRÍTICA' ? 'redtxt' : ''}">${esc(x.priority)}</span>`)}
                ${row('Médico solicitante', esc(x.requester || 'Dra. Ana Torres'))}
                ${row('Fecha de creación', esc(fmtDateTime(x.at)))}
              </div>
            `)}
            ${card(`
              <h3>Donante Asignado y Control</h3>
              <div class="stack" style="margin-top:10px">
                ${r?.donor ? `
                  ${row('Donante', esc(r.donor.name))}
                  ${row('Grupo sanguíneo', esc(r.donor.blood || r.blood))}
                  ${r.appt ? row('Horario de cita', 'Hoy • ' + esc(r.appt.time)) + row('Pase Digital', esc(r.appt.id)) : ''}
                  ${evalRec ? row('Control de Calidad', `Aprobado • ${esc(fmtDateTime(evalRec.at))}`) : ''}
                ` : x.donor ? `
                  ${row('Donante voluntario', esc(x.donor))}
                  ${row('Estado de cita', 'Programada / Confirmada')}
                ` : `
                  <p class="mut">Aún no se ha asignado un donante. La red se encuentra notificando a los perfiles compatibles en el área.</p>
                `}
                ${r?.lastDenied ? `
                  <div class="banner warn" style="margin-top:8px">
                    <b>Donación previa no autorizada</b>
                    <p>${esc(r.lastDenied.name)}: ${esc(r.lastDenied.reasons.map(reasonLabel).join('; '))}. Búsqueda reanudada.</p>
                  </div>
                ` : ''}
              </div>
            `)}
            ${(trip || curDelivery) ? card(`
              <h3>Logística y Cadena de Frío</h3>
              <div class="stack" style="margin-top:10px">
                ${row('Estatus de entrega', esc(DELIVERY[curDelivery] || 'En logística'))}
                ${trip ? `
                  ${row('Unidad de transporte', esc(trip.assignedTo || 'AMB-014'))}
                  ${row('Distancia y tiempo', `${esc(trip.distance)} • ${esc(trip.eta)}`)}
                  ${row('Rango térmico normativo', '2.0 °C a 10.0 °C')}
                ` : ''}
              </div>
            `) : ''}
            <div class="card stack">
              <h3>Acciones de la Solicitud</h3>
              ${r && r.status === 'completada' && curDelivery === 'entregada' ? btn('Confirmar recepción de unidad (Firma)', { go: 'm/reception', v: 'ok' }) : ''}
              ${x.live && r && !['cerrada', 'cancelada'].includes(r.status) ? `
                ${btn('Ver seguimiento en vivo (Radar)', { go: 'm/radar' })}
                ${btn('Cancelar solicitud', { act: 'cancelReq', v: 'ghost' })}
              ` : ''}
              ${btn('← Volver a la Guardia', { go: 'm/dashboard', v: 'ghost' })}
            </div>
          </div>
          <div>
            ${card(`
              <div class="between">
                <h3>Línea de Tiempo del Estado</h3>
                ${badge(x.label, x.color)}
              </div>
              <p class="mut" style="font-size:13px;margin:4px 0 14px">Historial de avance en tiempo real de la requisición según protocolos NOM-253.</p>
              <div class="timeline" aria-label="Línea de tiempo de la solicitud">
                ${timelineHtml}
              </div>
            `)}
          </div>
        </div>
      `;
    },
  },

  'b/evaluate': {
    role: 'bank',
    render: () => {
      const a = apptSel();
      if (!a || a.state !== 'Extracción') return statusScreen(icon('clipboard', 44), 'Nada que evaluar', 'Selecciona en la agenda una cita en estado Extracción para evaluar la donación.', btn('Ir a la agenda', { go: 'b/appts' }));
      const r = get().req, linked = r && a.email && r.donor?.email === a.email;
      return `<h1>Evaluación de la donación</h1><p class="mut" style="margin-bottom:16px">Confirma si la sangre extraída cumple los controles de calidad.</p><div class="stack">${card(`<div class="between" style="justify-content:flex-start;gap:14px"><div class="ring" style="margin:0;flex:none">${esc(initials(a.name))}</div><div><b>${esc(a.name)}</b><br><small class="mut">Folio: ${esc(a.id)} • Grupo ${esc(a.blood || '')}</small>${linked ? `<br><small class="mut">Para ${esc(r.hospital)} • ${esc(r.component)}</small>` : ''}</div></div>`)}${card(`<h3>Controles de calidad</h3>${CHECKS.map((c) => `<label class="item"><span>${c}</span><input type="checkbox" class="chkq" style="width:22px;min-height:22px"></label>`).join('')}<label class="field" style="margin-top:12px"><span>Notas (opcional)</span><textarea id="evalNotes" rows="3" placeholder="Observaciones del personal"></textarea></label><div class="stack">${btn('Todo salió bien • Aprobar donación', { act: 'approveDonation', id: 'approveBtn', dis: true, v: 'ok' })}${btn('Denegar donación', { go: 'b/deny', v: 'ghost' })}</div>`)}</div>`;
    },
    mount: (root) => { const upd = () => { root.querySelector('#approveBtn').disabled = ![...root.querySelectorAll('.chkq')].every((c) => c.checked); }; root.addEventListener('change', upd); return () => root.removeEventListener('change', upd); },
  },

  'b/deny': {
    role: 'bank',
    render: () => {
      const a = apptSel();
      if (!a || ['Completada', 'Rechazada', 'No asistió'].includes(a.state)) return statusScreen(icon('clipboard', 44), 'Nada que denegar', 'Selecciona en la agenda una cita pendiente o en extracción.', btn('Ir a la agenda', { go: 'b/appts' }));
      const cats = [...new Set(REASONS.map((r) => r.cat))];
      return `<h1>Denegar donación</h1><p class="mut" style="margin-bottom:16px">Selecciona uno o más motivos. El donante verá el motivo y la solicitud buscará a otra persona.</p><div class="stack">${card(`<div class="between" style="justify-content:flex-start;gap:14px"><div class="ring" style="margin:0;flex:none">${esc(initials(a.name))}</div><div><b>${esc(a.name)}</b><br><small class="mut">Folio: ${esc(a.id)} • Grupo ${esc(a.blood || '')} • Estado: ${esc(a.state)}</small></div></div>`)}${card(`<h3>Motivos</h3>${cats.map((c) => `<fieldset class="rsngrp"><legend>${c}</legend>${REASONS.filter((r) => r.cat === c).map((r) => `<label class="item"><span>${r.label}</span><input type="checkbox" class="rsn" value="${r.id}" style="width:22px;min-height:22px"></label>`).join('')}</fieldset>`).join('')}<label class="field"><span>Notas</span><textarea id="denyNotes" rows="3" placeholder="Detalle de lo observado"></textarea></label><div class="stack">${btn('Denegar donación', { act: 'denyDonation', id: 'denyBtn', dis: true })}${btn('Cancelar', { go: 'b/appts', v: 'ghost' })}</div>`)}</div>`;
    },
    mount: (root) => { const upd = () => { root.querySelector('#denyBtn').disabled = !root.querySelector('.rsn:checked'); }; root.addEventListener('change', upd); return () => root.removeEventListener('change', upd); },
  },

  'b/records': {
    role: 'bank', wide: true,
    render: () => {
      const f = get().recFilter || 'all', all = reviewsAll(), ok = all.filter((r) => r.decision === 'apta').length, no = all.length - ok;
      const rows = all.filter((r) => f === 'all' || (f === 'ok' ? r.decision === 'apta' : r.decision === 'no_apta'));
      const kpis = [['Autorizadas', ok, 'APTAS', 'ok'], ['No autorizadas', no, 'DENEGADAS', 'red'], ['Total de evaluaciones', all.length, 'Historial', '']];
      return `<h1>Autorizaciones</h1><p class="mut" style="margin-bottom:16px">Todas las donaciones aprobadas y denegadas por el banco de sangre.</p><div class="grid kpi">${kpis.map(([l, n, b, c]) => card(`<small class="mut">${l}</small><h2 class="kpi-n">${n}</h2>${badge(b, c)}`)).join('')}</div>${card(`<div class="between"><h3>Registros</h3><div class="seg">${[['all', 'Todas'], ['ok', 'Autorizadas'], ['no', 'No autorizadas']].map(([v, l]) => `<button class="${f === v ? 'on' : ''}" data-act="filterRec" data-v="${v}">${l}</button>`).join('')}</div></div>${rows.length ? table(['Fecha y hora', 'Donante', 'Grupo', 'Decisión', 'Motivo', ''], rows.map((r) => `<tr><td>${esc(fmtDateTime(r.at))}</td><td>${esc(r.name)}</td><td class="redtxt"><b>${esc(r.blood || '')}</b></td><td>${badge(r.decision === 'apta' ? 'AUTORIZADA' : 'NO AUTORIZADA', r.decision === 'apta' ? 'ok' : 'red')}</td><td>${r.decision === 'apta' ? '<span class="mut">Controles aprobados</span>' : esc(reasonLabel(r.reasons[0])) + (r.reasons.length > 1 ? ` +${r.reasons.length - 1}` : '')}</td><td>${btn('Ver con detalle', { go: `b/record?id=${r.id}`, v: 'ghost', cls: 'sm' })}</td></tr>`), 'h1 h3 h5') : '<p class="mut" style="margin-top:12px">No hay registros en este filtro.</p>'}`, 'full')}`;
    },
  },

  'b/record': {
    role: 'bank',
    render: ({ q }) => {
      const r = reviewsAll().find((x) => x.id === q?.id);
      if (!r) return statusScreen(icon('clipboard', 44), 'Registro no encontrado', 'El registro ya no está disponible.', btn('Volver a las autorizaciones', { go: 'b/records' }));
      const ok = r.decision === 'apta', row = (k, v) => `<div class="item"><span class="mut">${k}</span><b>${v}</b></div>`;
      return `<div class="between"><div><h1>${ok ? 'Donación autorizada' : 'Donación no autorizada'}</h1><p class="mut">Registro ${esc(r.id)}</p></div>${badge(ok ? 'AUTORIZADA' : 'NO AUTORIZADA', ok ? 'ok' : 'red')}</div><div class="stack" style="margin-top:16px">${card(`<h3>Donante</h3>${row('Nombre', esc(r.name))}${row('Grupo sanguíneo', esc(r.blood || ''))}${row('Folio de la cita', esc(r.apptId || '—'))}${row('Hemocomponente', esc(r.component || 'Sangre total'))}${r.hospital ? row('Solicitud', `${esc(r.reqId || '')} • ${esc(r.hospital)}`) : ''}`)}${card(`<h3>Evaluación</h3>${row('Fecha y hora', esc(fmtDateTime(r.at)))}${row('Evaluó', esc(r.by))}${ok ? (r.checks || CHECKS).map((c) => `<div class="item"><span>✓ ${c}</span></div>`).join('') : `<small class="lbl" style="display:block;margin:8px 0 4px">MOTIVOS</small>${r.reasons.map((i) => `<div class="item"><span>${esc(reasonLabel(i))}</span>${badge(REASONS.find((x) => x.id === i)?.cat || '', '')}</div>`).join('')}${r.deferUntil ? row('Diferido hasta', esc(fmtDate(r.deferUntil))) : ''}`}${r.notes ? `<div class="banner info"><b>Notas</b><p>${esc(r.notes)}</p></div>` : ''}${!ok && r.reqId ? '<div class="banner warn"><b>Consecuencia</b><p>La solicitud volvió a buscar a otro donante y el donante fue notificado del motivo.</p></div>' : ''}`)}</div><div class="stack" style="margin-top:16px">${btn('Volver a las autorizaciones', { go: 'b/records', v: 'ghost' })}</div>`;
    },
  },

  notfound: {
    render: () => {
      const u = currentUser();
      return statusScreen(icon('x', 44), 'Página no encontrada', 'La dirección no existe o ya no está disponible en tu flujo actual.', btn('Ir al inicio', { go: u ? HOME[u.role] : 'login' }));
    }
  },

  register: {
    render: ({ q }) => q.inst
      ? card(`<h2>Registro institucional</h2><p class="mut" style="margin:6px 0 16px">Tu rol se asigna según tu folio de verificación sanitaria.</p><form data-form="register" data-role="inst" class="stack" novalidate>${field('name', 'Nombre completo')}${field('email', 'Cédula profesional / correo')}${field('folio', 'Folio de verificación', 'text', 'MED-1024')}${field('hospital', 'Hospital / institución')}${field('password', 'Contraseña (mín. 6)', 'password')}${btn('<span class="spin"></span>Crear cuenta', { type: 'submit' })}</form><p class="center mut" style="margin-top:12px"><a href="#/login">← Volver al inicio de sesión</a></p>`)
      : card(`<h2>Registro de donante</h2><p class="mut" style="margin:6px 0 16px">Cuestionario base de elegibilidad NOM-253-SSA1-2012. Tus respuestas son confidenciales.</p><form data-form="register" data-role="donor" class="stack" novalidate>${field('name', 'Nombre completo')}${field('email', 'Correo')}${field('password', 'Contraseña (mín. 6)', 'password')}<div><span class="mut">Género</span>${toggle('gender', [['f', 'Femenino'], ['m', 'Masculino'], ['o', 'Otro']])}</div><div><span class="mut">Edad</span>${toggle('age', [['minor', '< 18'], ['adult', '18–65'], ['senior', '> 65']])}</div><div><span class="mut">Peso</span>${toggle('weight', [['low', '< 50 kg'], ['ok', '≥ 50 kg']])}</div><div><span class="mut">Grupo sanguíneo</span><select id="blood">${['O+', 'O-', 'A+', 'A-', 'B+', 'B-', 'AB+', 'AB-'].map((b) => `<option>${b}</option>`).join('')}</select></div><div id="femSection" hidden><span class="mut">¿Embarazo/lactancia o parto en los últimos 6 meses?</span>${toggle('fem', YN)}</div>${['¿Hepatitis B/C, VIH, Chagas o Sífilis?', '¿Tatuajes, piercings o acupuntura en 12 meses?', '¿Cirugías mayores o transfusiones en 12 meses?'].map((r, i) => `<div><span class="mut">${r}</span>${toggle('risk' + i, YN)}</div>`).join('')}${btn('<span class="spin"></span>Crear cuenta', { type: 'submit' })}</form><p class="center mut" style="margin-top:12px"><a href="#/login">← Volver al inicio de sesión</a></p>`),
  },

  'd/home': {
    role: 'donor',
    render: () => {
      const u = currentUser(), r = activeReq(), camp = get().campaign, H = historyOf(u), n = H.length, next = nextEligible(u), st = donorStage(get(), u);
      const hot = r && r.status === 'buscando' && compatible(u.blood, r.blood) && !deferred(u) && !(r.excluded || []).includes(u.email) && ['idle', 'done'].includes(st);
      const can = !next || next <= new Date(), unseen = (get().reviews || []).filter((r) => r.email === u.email && r.decision === 'no_apta' && !r.seen).slice(-1)[0];
      return `<div class="hello full"><div><h1>Hola, ${esc(u.name.split(' ')[0])} 👋</h1><p class="mut">Tu red de donación en un solo lugar.</p></div>${badge('• ' + statusOf(u), statusOf(u).startsWith('Apto') ? 'ok' : 'warn')}</div>${unseen ? card(`<span class="chip red">DONACIÓN NO REALIZADA</span><h3 style="margin:8px 0">No pudiste donar esta vez</h3><p class="mut" style="margin-bottom:12px">Motivo: ${esc(unseen.reasons.map(reasonLabel).join('; '))}.${unseen.deferUntil ? ` Podrás donar de nuevo a partir del ${fmtDate(unseen.deferUntil)}.` : ''}</p><div class="stack">${btn('Ver detalle', { go: 'd/history' })}${btn('Entendido', { act: 'ackNotice', id: unseen.id, v: 'ghost' })}</div>`, 'alert') : ''}${!['idle', 'done'].includes(st) ? card(`<span class="chip red">EN CURSO</span><h3 style="margin:8px 0">Tienes una donación en proceso</h3><p class="mut" style="margin-bottom:12px">Continúa donde te quedaste.</p>${btn('Continuar', { go: STAGE_HOME[st] })}`, 'alert') : camp && !hot ? card(`<span class="chip red">CONVOCATORIA</span><h3 style="margin:8px 0">El banco necesita donantes ${esc(camp.blood.join(', '))}</h3><p class="mut" style="margin-bottom:12px">Banco de Sangre Central • Tu donación ayuda a recuperar el inventario.</p>${btn('Quiero donar', { go: 'd/alert' })}`, 'alert') : ''}${!['idle', 'done'].includes(st) ? '' : hot ? card(`<span class="chip red">${r.priority === 'CRÍTICA' ? 'CÓDIGO ROJO' : 'URGENTE'}</span><h3 style="margin:8px 0">${r.units} u. de ${esc(r.blood)} • ${esc(r.hospital)}</h3>${btn('Responder ahora', { go: 'd/alert' })}`, 'alert') : card('<h3>Sin alertas activas</h3><p class="mut" style="margin:6px 0 12px">Te avisaremos cuando un hospital cercano necesite tu tipo de sangre.</p>' + (r ? '' : btn('Recibir alerta de demostración', { act: 'demoAlert', v: 'ghost' })))}${card(`<h3>Tu impacto</h3><div class="grid two" style="margin-top:12px"><div class="stat"><b style="color:var(--red-text)">${n}</b><small>Donaciones</small></div><div class="stat"><b style="color:var(--ok-text)">${n * 3}</b><small>Vidas ayudadas</small></div></div><div style="margin-top:12px">${btn('Ver historial completo', { go: 'd/history', v: 'ghost' })}</div>`)}${card(`<h3>Próxima donación</h3><p class="mut" style="margin:6px 0 12px">${deferred(u) ? `Tu donación está diferida hasta el ${fmtDate(u.deferUntil)}.` : can ? 'Ya puedes donar sangre total. Mantén al día tus datos médicos para estar listo.' : `Podrás donar de nuevo a partir del ${fmtDate(next)} (sangre total, cada 3 meses).`}</p>${btn('Actualizar datos médicos', { go: 'd/medical', v: 'ghost' })}`)}${card(`<h3>Consejos antes de donar</h3>${['Duerme al menos 6 horas', 'Mantén un ayuno ligero de 4 horas', 'Hidrátate bien y evita el alcohol 48 h'].map((t) => `<div class="item"><span>• ${t}</span></div>`).join('')}`)}`;
    },
  },

  'd/profile': {
    role: 'donor',
    render: () => { const u = currentUser(), ini = u.name.split(' ').map((w) => w[0]).slice(0, 2).join(''); return `<h2 class="ptitle">Mi Perfil</h2>${card(`<div class="between" style="justify-content:flex-start;gap:16px"><div class="ring">${ini}</div><div><h2>${u.name}</h2>${chip('Tipo: ' + (u.blood || 'O+'), 'red')}</div></div>`)}<div class="banner ${statusOf(u).startsWith('Apto') ? 'ok' : 'warn'}"><b>• ${statusOf(u)}</b><p>${statusOf(u).startsWith('Apto') ? 'Tu pre-triaje está vigente. Puedes responder a alertas de emergencia.' : 'Tu registro requiere revisión médica.'}</p></div>${btn('Actualizar datos médicos', { go: 'd/medical', v: 'ghost' })}<div class="grid two" style="margin-top:12px"><div class="stat"><b style="color:var(--red-text)">${historyOf(u).length}</b><small>Donaciones</small></div><div class="stat"><b style="color:var(--ok-text)">${historyOf(u).length * 3}</b><small>Vidas ayudadas</small></div></div><div style="margin-top:12px">${btn('Ver historial de donaciones', { go: 'd/history', v: 'ghost' })}</div>`; },
  },

  'd/alert': {
    role: 'donor',
    render: () => { const r = get().req || { blood: 'O+', units: 2, hospital: 'Hospital General' }; return `<div class="emerg">ALERTA DE EMERGENCIA</div>${stepper(['Responder', 'Pre-triaje', 'Cita', 'Pase'], 0)}${card(`${chip('CÓDIGO ROJO', 'red')}<h2 style="margin-top:10px">${r.hospital}</h2><p class="mut">Banco de Sangre • Urgencias</p><p style="margin:8px 0"><b>3.2 km • 8 min</b></p><p>Se requiere sangre ${r.blood} con prioridad inmediata.</p>`)}<div class="stack">${btn('¡Puedo donar / Aceptar!', { go: 'd/triage' })}${btn('No puedo en este momento', { act: 'snooze', go: 'd/profile', v: 'ghost' })}</div>`; },
  },

  'd/triage': {
    role: 'donor',
    render: () => `<h2 class="ptitle">Paso 2: Pre-Triaje Médico</h2><div class="banner info">Tus respuestas son confidenciales y serán validadas por personal médico.</div><div data-triage class="stack">${TRIAGE.map((q, i) => card(`<small class="lbl">PREGUNTA ${i + 1}</small><h3 style="margin:4px 0 10px">${q}</h3>${toggle('t' + i, YN)}`, 'q')).join('')}<p class="center mut" id="cnt">Progreso: 0/5</p>${btn('Enviar Cuestionario para Validación', { act: 'submitTriage', id: 'triageBtn', dis: true })}</div>`,
    mount: (root) => { const upd = () => { const n = root.querySelectorAll('.tbtn.sel').length; root.querySelector('#cnt').textContent = `Progreso: ${n}/5`; root.querySelector('#triageBtn').disabled = n < 5; }; root.addEventListener('selchange', upd); return () => root.removeEventListener('selchange', upd); },
  },

  'd/qr': {
    role: 'donor',
    render: () => { const a = get().myAppt || { id: 'VR-2026-8891', time: '08:00', name: currentUser().name }; return `<h2 class="ptitle">Paso 4: Pase de Acceso</h2><h2 class="center" style="color:var(--ok-text)">¡Cita Confirmada!</h2><div class="qr">${qrPattern(a.id)}</div><p class="center"><small class="lbl">FOLIO DE ACCESO</small><br><b style="font-size:22px">${a.id}</b></p>${card(`<b>Hospital General • Banco de Sangre</b><p class="mut">Hoy • ${a.time}</p><p class="mut">${currentUser().name} • Tipo ${currentUser().blood || 'O+'}</p>`)}<div class="stack">${btn('Cancelar Cita', { act: 'say', v: 'ghost' }).replace('data-act="say"', 'data-act="say" data-msg="Cita cancelada"')}${btn('Simular donación completada', { act: 'finishDonation' })}</div>`; },
  },

  'm/dashboard': {
    role: 'medical', wide: true,
    render: () => {
      const f = get().filter || 'all', all = reqList(), rows = all.filter((x) => f === 'all' || x.priority === 'CRÍTICA');
      const live = all.filter((x) => x.priority !== 'CANCELADA'), crit = live.filter((x) => x.priority === 'CRÍTICA').length, units = live.reduce((n, x) => n + (x.units || 0), 0);
      const kpis = [['Solicitudes activas', live.length, 'En curso', 'warn'], ['Críticas', crit, 'CÓDIGO ROJO', 'red'], ['Unidades solicitadas', units, 'Hemocomponentes', ''], ['Banco de sangre', 'En línea', `a las ${hhmm(Date.now())}`, 'ok']];
      return `<div class="band"><small>BANCO DE SANGRE • TURNO ACTIVO</small><h1>Guardia - Urgencias/Quirófano</h1><div class="between"><small>${date()} • Actualizado a las ${hhmm(Date.now())}</small><span class="badge ok">• SISTEMA EN LÍNEA</span></div></div><div class="grid kpi" style="margin:16px 0 0">${kpis.map(([l, n, b, c]) => card(`<small class="mut">${l}</small><h2 class="kpi-n">${n}</h2>${badge(b, c)}`)).join('')}</div><div class="between" style="margin:16px 0"><h2>Solicitudes activas <span class="chip dark">${rows.length}</span></h2><div class="seg"><button class="${f === 'all' ? 'on' : ''}" data-act="filter" data-v="all">Todas</button><button class="${f === 'crit' ? 'on' : ''}" data-act="filter" data-v="crit">Críticas • ${crit}</button></div></div><div class="reqs">${rows.map((x) => `<div class="card req ${x.priority === 'CANCELADA' ? 'dim' : ''}"><div class="between"><div class="row" style="flex:none;gap:12px">${chip(x.blood, x.priority === 'CRÍTICA' ? 'red' : '')}<div><b>${esc(shortName(x.patient))} • ${esc(x.hc)}</b><br><small class="mut">${esc(x.bed)}</small></div></div>${badge(x.label, x.color)}</div><hr><div class="between"><div><small class="lbl">HEMOCOMPONENTE</small><br>${esc(x.component)} • ${x.units} unidad${x.units > 1 ? 'es' : ''}</div><div><small class="lbl">PRIORIDAD</small><br><b class="${x.priority === 'CRÍTICA' ? 'redtxt' : ''}">${x.priority}</b></div><div class="right"><small class="lbl">${esc(x.id)}</small><br>${x.scheduled ? `Hoy • ${hhmm(x.at)}` : ago(x.at)}</div></div><div style="margin-top:12px">${btn('Ver detalle completo', { go: `m/detail?id=${x.id}`, v: 'ghost', cls: 'sm' })}</div></div>`).join('')}</div><button class="fab" data-go="m/new">Nueva Solicitud Urgente</button>`;
    },
  },

  'm/new': {
    role: 'medical',
    render: () => card(`<h2>Nueva solicitud transfusional</h2><p class="mut" style="margin:6px 0 16px">Meta: menos de 30 segundos.</p><div class="stack"><div><span class="mut">Grupo ABO/Rh</span>${toggle('blood', ['O-', 'O+', 'A-', 'A+', 'B-', 'B+', 'AB-', 'AB+'].map((b) => [b, b]))}</div><div><span class="mut">Unidades</span>${toggle('units', [1, 2, 3, 4].map((n) => [n, n]))}</div><div><span class="mut">Prioridad</span>${toggle('priority', [['CRÍTICA', 'CÓDIGO ROJO'], ['ALTA', 'Alta'], ['PROGRAMADA', 'Programada']])}</div>${btn('Lanzar Código Rojo al radar', { act: 'launch', id: 'launchBtn', dis: true })}</div>`),
    mount: (root) => { const upd = () => { root.querySelector('#launchBtn').disabled = root.querySelectorAll('.tbtn.sel').length < 3; }; root.addEventListener('selchange', upd); return () => root.removeEventListener('selchange', upd); },
  },

  'b/dash': {
    role: 'bank', wide: true,
    render: () => `<div class="between"><div><h1>Banco de Sangre Central</h1><p class="mut">Panel de Control e Inventario de Cámaras Frigoríficas</p></div><small class="mut">${date()}</small></div><div class="grid kpi" style="margin:16px 0">${[['Unidades totales', 342, '▲ +12 hoy', 'ok'], ['Solicitudes pendientes', 5, 'En espera', 'warn'], ['Alertas críticas', stockNow().filter(([, , st]) => st === 'CRÍTICO').length, 'CRÍTICO', 'red'], ['Donaciones hoy', get().appts.filter((a) => a.state === 'Completada').length + 16, 'Meta: 25', '']].map(([l, n, b, c]) => card(`<small class="mut">${l}</small><h1>${n}</h1>${badge(b, c)}`)).join('')}</div><div class="split"><div>${card(`<div class="between"><div><h3>Matriz de Stock — Cámaras Frigoríficas</h3><small class="mut">Monitor de temperatura y reservas por grupo</small></div>${badge('• Tiempo real', 'ok')}</div>${table(['Grupo', 'Bolsas disponibles', 'Estado', 'Actualización'], stockNow().map(([g, n, s], i) => `<tr><td>${chip(g, s === 'CRÍTICO' ? 'red' : '')}</td><td><b>${n} bolsas</b></td><td>${badge(s, level[s])}</td><td class="mut">${ago(seedAt() - (i + 1) * 3600000)}</td></tr>`))}`)}${card(`<div class="between"><div><h3>Lanzar Convocatoria a Donantes</h3><small class="mut">${get().campaign ? `Campaña activa • ${get().campaign.blood.join(', ')} • ${get().campaign.notified} donantes notificados` : 'Alerta push a donantes del grupo en escasez'}</small></div>${get().campaign ? '<button class="btn ghost sm" data-act="endCampaign">Finalizar campaña</button>' : '<button class="btn sm" data-act="startCampaign">Iniciar Campaña de Alerta</button>'}</div>`)}</div><div>${card(`<h3>Solicitudes Entrantes</h3><div class="stack" style="margin-top:10px">${(() => { const r = get().req; if (!r || ['cancelada', 'cerrada'].includes(r.status)) return ''; const lab = { buscando: [r.lastDenied ? 'BUSCANDO OTRO DONANTE' : 'BUSCANDO', 'red'], esperando: ['DONANTE ACEPTÓ', 'warn'], programada: ['CITA PROGRAMADA', 'warn'], completada: ['DONACIÓN COMPLETA', 'ok'] }[r.status] || ['EN CURSO', '']; return `<div class="inc"><span class="badge ${lab[1]}">${lab[0]}</span><b>${esc(r.hospital)} • ${esc(r.id)}</b><small>${r.units} u. ${esc(r.blood)} • ${esc(r.component)} • ${esc(r.area)}</small>${r.donor ? `<small class="mut">Donante: ${esc(shortName(r.donor.name))}${r.appt ? ' • cita ' + esc(r.appt.time) : ''}</small>` : ''}${r.lastDenied && r.status === 'buscando' ? `<small class="mut">Donante no apto: ${esc(r.lastDenied.name)} (${esc(r.lastDenied.reasons.map(reasonLabel).join('; '))}). Se está buscando otro donante.</small>` : ''}${r.patient ? `<small class="mut">Paciente: ${esc(r.patient)} • ${esc(r.hc || '')} • ${esc(r.bed || '')}</small>` : ''}${r.status === 'completada' && r.delivery === 'preparando' ? `<div class="row"><button class="btn sm" data-act="dispatch">Despachar unidad</button></div>` : r.delivery ? `<small class="mut">Traslado: ${DELIVERY[r.delivery]}${r.assignedTo ? ' • ' + esc(r.assignedTo) : ''}</small>` : ''}</div>`; })()}${(() => { const r = RESERVABLE[0], held = (get().reserved || []).includes(r.id); return `<div class="inc"><span class="badge ${held ? 'ok' : 'red'}">${held ? 'RESERVADA' : 'URGENTE'}</span><b>${r.hospital}</b><small>Reclama: ${r.units} unidades ${r.blood} (${r.reason})</small><div class="row">${held ? `<button class="btn ghost sm" data-act="releaseReq" data-id="${r.id}">Liberar reserva</button>` : `<button class="btn sm" data-act="reserveReq" data-id="${r.id}">Aceptar y Preparar</button>`}<button class="btn ghost sm" data-act="detailReq" data-id="${r.id}">Ver Detalles</button></div></div>`; })()}<div class="inc"><span class="badge warn">En revisión</span><b>Hospital Central del Valle</b><small>Necesita: 2 unidades A+</small></div><div class="inc"><span class="badge">Programada</span><b>Clínica Santa María</b><small>Necesita: 6 unidades B+</small></div></div>`)}</div></div>`,
  },

  'b/appts': {
    role: 'bank', wide: true,
    render: () => { const t = get().apptTab || 'Todos', A = get().appts, sel = A.find((a) => a.id === get().selAppt) || A[0], rows = A.filter((a) => t === 'Todos' || a.state === t); return `<div class="between"><div><h1>Gestión de Citas</h1><p class="mut">Recepción y validación de donantes con Pase Digital QR</p></div></div><div class="split rev" style="margin-top:16px"><div>${card(`<div class="between"><h3>Agenda del Día</h3><div class="seg">${['Todos', 'Pre-Triaje', 'Extracción', 'Completada'].map((x) => `<button class="${t === x ? 'on' : ''}" data-act="tab" data-v="${x}">${x}</button>`).join('')}</div></div>${table(['Hora', 'Donante', 'Grupo', 'Folio', 'Estado'], rows.map((a) => `<tr class="pick ${a.id === sel.id ? 'on' : ''}" data-act="pick" data-id="${a.id}"><td><b>${a.time}</b></td><td>${esc(a.name)}</td><td class="redtxt"><b>${a.blood || ''}</b></td><td>${a.id}</td><td>${badge(a.state, a.state === 'Completada' ? 'ok' : a.state === 'Extracción' ? 'warn' : ['No asistió', 'Rechazada'].includes(a.state) ? 'red' : '')}</td></tr>`), 'h4')}`)}</div><div>${card(`<h3>Validación de Pase QR</h3><div class="center stack" style="margin-top:12px"><div class="ring">${esc(initials(sel.name))}</div><b>${esc(sel.name)}</b><small class="mut">Folio: ${sel.id}</small><div class="banner info">Grupo: ${sel.blood || 'O+'}</div></div><div class="stack" style="margin:12px 0"><div>✓ Ayuno obligatorio (4–6 hrs)</div><div>✓ Identificación oficial validada</div><div>✓ Pre-registro médico aprobado</div></div><div class="stack">${sel.state === 'Extracción' ? btn('Evaluar donación', { go: 'b/evaluate', v: 'ok' }) : btn('Autorizar Ingreso', { act: 'authorize', v: 'ok' })}${btn('Rechazar Acceso', { go: 'b/deny', v: 'ghost' })}${btn('Escanear QR', { act: 'scanAppt', v: 'ghost' })}</div>`)}</div></div>`; },
  },

  'b/fleet': {
    role: 'bank', wide: true,
    render: () => { const U = fleetUnits(), cnt = (st) => U.filter((u) => u.state === st).length; return `<h1>Radar de Ambulancias</h1><p class="mut" style="margin-bottom:16px">Coordinación logística de traslado de unidades biológicas</p><div class="split rev">${card(`<div id="fleetMap" class="lmap" role="region" aria-label="Mapa interactivo de ambulancias y destinos" tabindex="0">Cargando mapa…</div><div class="between" style="margin-top:12px"><small>${U.length - cnt('Ocupada')} Unidades activas</small><small>${cnt('Disponible')} Disponibles</small><small>${cnt('En tránsito') + cnt('Asignada')} En ruta o asignadas</small></div><ul class="legend" aria-label="Leyenda del mapa"><li><i class="pin-dot bank"></i>Banco</li><li><i class="pin-dot hosp"></i>Hospital</li><li><i class="pin-dot ok"></i>Disponible</li><li><i class="pin-dot warn"></i>En tránsito</li><li><i class="pin-dot asg"></i>Asignada</li><li><i class="pin-dot off"></i>Ocupada</li></ul><p class="mut" id="routeSrc" role="status"><small>Calculando rutas…</small></p>`)}${card(`<h3>Reasignación Manual</h3>${U.map((u) => `<div class="inc"><div class="between"><b>${u.id}</b>${badge(u.state, u.state === 'Disponible' ? 'ok' : u.state === 'Ocupada' ? '' : 'warn')}</div><small class="mut">Chofer: ${esc(u.driver)}<span data-info="${u.id}"></span></small><div class="row inc-actions"><button class="btn ghost sm" data-amb="${u.id}" aria-label="Ver en mapa ${u.id}">${icon('route', 16)} Ver en mapa</button>${u.state === 'Disponible' ? `<button class="btn sm" data-act="forceAssign" data-id="${u.id}">Forzar Asignación</button>` : u.state === 'Asignada' ? `<button class="btn ghost sm" data-act="releaseUnit" data-id="${u.id}">Liberar unidad</button>` : ''}</div></div>`).join('')}`)}</div>`; },
    mount: fleetMount,
  },

  'b/reports': {
    role: 'bank', wide: true,
    render: () => `<h1>Reportes — Historial de Trazabilidad</h1><p class="mut" style="margin-bottom:16px">Trazabilidad legal y médica de cada unidad procesada</p><div class="split rev">${card(`<h3>Registros de Trazabilidad Activa</h3>${table(['ID Bolsa', 'Grupo', 'Extracción', 'Pruebas (VIH/HEP/SIF)', 'Hospital destino', 'Firma digital'], [['#B-91024', 'O+', '12 Ene 2026', 'Hosp. San Rafael', 'Dr. Torres'], ['#B-91025', 'A-', '12 Ene 2026', 'Clín. Santa María', 'Dra. Okonkwo'], ['#B-91028', 'B+', '13 Ene 2026', 'Hosp. del Valle', 'Dr. Torres'], ['#B-91030', 'O-', '13 Ene 2026', 'Hosp. San Rafael', 'Dra. Okonkwo'], ['#B-91032', 'AB+', '14 Ene 2026', 'Hosp. Ángeles', 'Dr. Torres'], ['#B-91039', 'O+', '14 Ene 2026', 'Hosp. Regional', 'Dr. Torres']].map(([i, g, d, h, f]) => `<tr><td class="redtxt"><b>${i}</b></td><td><b>${g}</b></td><td>${d}</td><td>${badge('NEGATIVO ✓', 'ok')}</td><td>${h}</td><td>✍ ${f}</td></tr>`), 'h3 h6')}<div class="between" style="margin-top:12px"><small class="mut">Normativa: NOM-253-SSA1-2012</small><div class="row" style="flex:none"><button class="btn sm" data-act="exportPdf">Exportar PDF</button><button class="btn ghost sm" data-act="exportCsv">Exportar CSV</button></div></div>`)}${card(`<h3>Resumen de Periodo</h3><div class="stack" style="margin-top:10px">${[['BOLSAS PROCESADAS', '248 unidades', ''], ['TASA DE DESCARTE', '2.4%', 'redtxt'], ['HOSPITALES ATENDIDOS', '14 centros', ''], ['PROMEDIO DE ENTREGA', '28 minutos', 'oktxt']].map(([l, v, c]) => `<div class="stat left"><small class="lbl">${l}</small><h2 class="${c}">${v}</h2></div>`).join('')}</div>`)}</div>`,
  },
};
