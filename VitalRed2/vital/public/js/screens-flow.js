import { get, currentUser } from './store.js';
import { esc } from './ui.js';
import { BANK } from './maps.js';
import { activeReq, compatible, routeKm, historyOf, fmtDate, nextEligible, COMPONENTS, AREAS, HOSPITAL_LIST } from './domain.js';
import { pwRules, bindPwRules, btn, card, field, toggle, flow, stepper, qrPattern, statusScreen, icon } from './ui.js';

const YN = [['yes', 'SÍ'], ['no', 'NO']];
const TRIAGE = ['¿Has tomado antibióticos, aspirinas o antiinflamatorios durante los últimos 7 días?', '¿Presentas fiebre, gripe o malestar en este momento?', '¿Has ingerido alcohol o sustancias en las últimas 48 horas?', '¿Cuentas con un ayuno de al menos 4 horas y has ingerido líquidos hoy?', '¿Dormiste al menos 6 horas anoche?'];
const RISKS = ['¿Padeces o has padecido Hepatitis B/C, VIH, Chagas o Sífilis?', '¿Tatuajes, piercings o acupuntura en los últimos 12 meses?', '¿Cirugías mayores o transfusiones en los últimos 12 meses?'];
const LABEL = { f: 'Femenino', m: 'Masculino', o: 'Otro', minor: 'Menor de 18', adult: '18 a 65 años', senior: 'Mayor de 65', low: 'Menos de 50 kg', ok: '50 kg o más', yes: 'SÍ', no: 'NO' };
const fl = (n, label) => (get().inFlow ? flow(n, label) : '');
const today = () => new Date().toLocaleDateString('es-MX', { day: 'numeric', month: 'long', year: 'numeric' });
const countChecked = (root) => root.querySelectorAll('input[type=radio]:checked').length;
const onChange = (root, fn) => { root.addEventListener('change', fn); return () => root.removeEventListener('change', fn); };

const registerStep = (step, d) => ({
  1: `${field('name', 'Nombre completo', 'text', 'Nombre y apellidos', d.name || '')}${field('email', 'Correo electrónico', 'email', 'tucorreo@ejemplo.com', d.email || '')}${field('password', 'Contraseña', 'password', '', d.password || '')}${pwRules()}${field('password2', 'Confirmar contraseña', 'password', '', d.password2 || '')}`,
  2: `<div><span class="mut">Género de nacimiento / registro clínico</span>${toggle('gender', [['f', 'Femenino'], ['m', 'Masculino'], ['o', 'Otro']], d.gender)}</div><div><span class="mut">Rango de edad</span>${toggle('age', [['minor', '< 18'], ['adult', '18–65'], ['senior', '> 65']], d.age)}</div><div><span class="mut">Peso corporal</span>${toggle('weight', [['low', '< 50 kg'], ['ok', '≥ 50 kg']], d.weight)}</div><label class="field"><span>Grupo sanguíneo</span><select name="blood">${['O+', 'O-', 'A+', 'A-', 'B+', 'B-', 'AB+', 'AB-'].map((b) => `<option ${d.blood === b ? 'selected' : ''}>${b}</option>`).join('')}</select></label>`,
  3: `${d.gender === 'f' ? `<div class="banner warn"><b>Salud femenina</b><p>Sección habilitada según tu género.</p></div><div><span class="mut">¿Embarazo, lactancia o parto en los últimos 6 meses?</span>${toggle('fem', YN, d.fem)}</div>` : ''}${RISKS.map((q, i) => `<div><span class="mut">${q}</span>${toggle('risk' + i, YN, d['risk' + i])}</div>`).join('')}`,
  4: `<div class="summary">${[['Nombre', d.name], ['Correo', d.email], ['Género', LABEL[d.gender]], ['Edad', LABEL[d.age]], ['Peso', LABEL[d.weight]], ['Grupo sanguíneo', d.blood || 'O+']].map(([k, v]) => `<div class="item"><span class="mut">${k}</span><b>${v}</b></div>`).join('')}</div><label class="check"><input type="checkbox" name="terms" ${d.terms ? 'checked' : ''}> Acepto el aviso de privacidad. Este cuestionario es una preselección y no sustituye una evaluación médica.</label>`,
})[step];

export const flowScreens = {
  register: {
    render: ({ q }) => {
      if (q.inst) return card(`<h2>Registro institucional</h2><p class="mut" style="margin:6px 0 16px">Tu rol se asigna según tu folio de verificación sanitaria.</p><form data-form="register" data-role="inst" class="stack" novalidate>${field('name', 'Nombre completo')}${field('email', 'Cédula profesional / correo')}${field('folio', 'Folio de verificación', 'text', 'MED-1024')}${field('hospital', 'Hospital / institución')}${field('password', 'Contraseña', 'password')}${pwRules()}${field('password2', 'Confirmar contraseña', 'password')}${btn('<span class="spin"></span>Crear cuenta', { type: 'submit' })}</form><p class="center mut" style="margin-top:12px"><a href="#/login">← Volver al inicio de sesión</a></p>`);
      const r = get().reg || { step: 1, data: {} };
      const titles = ['Datos de la cuenta', 'Datos personales', 'Control de salud (NOM-253)', 'Revisa y confirma'];
      return card(`${stepper(['Cuenta', 'Perfil', 'Salud', 'Confirmar'], r.step - 1)}<h2>${titles[r.step - 1]}</h2><p class="mut" style="margin:4px 0 16px">Paso ${r.step} de 4 · Tus respuestas se guardan mientras avanzas.</p><form id="regForm" data-form="reg" class="stack" novalidate>${registerStep(r.step, r.data)}<div class="row" style="margin-top:8px">${r.step > 1 ? btn('← Atrás', { act: 'regBack', v: 'ghost', type: 'button' }) : ''}${btn(r.step === 4 ? 'Finalizar registro' : 'Siguiente →', { act: 'regNext', type: 'button' })}</div></form><p class="center mut" style="margin-top:12px"><a href="#/login">← Volver al inicio de sesión</a></p>`);
    },
    mount: (root) => bindPwRules(root),
  },
  'd/alert': {
    role: 'donor',
    render: () => {
      const u = currentUser(), c = get().campaign, q = activeReq(), avail = q && q.status === 'buscando' && compatible(u.blood, q.blood);
      const r = avail ? q : !q && c ? { hospital: BANK.name, blood: c.blood.join(' / '), units: null, campaign: true } : null;
      if (!r) return statusScreen(icon('bell', 44), 'Sin alertas activas', q ? (q.status === 'buscando' ? `Hay una solicitud de ${esc(q.blood)} que no es compatible con tu grupo (${esc(u.blood)}). Te avisaremos cuando haya una para ti.` : 'La solicitud actual ya fue atendida por otro donante.') : 'Cuando un hospital lance un Código Rojo compatible contigo, aparecerá aquí.', q ? '' : btn('Recibir alerta de demostración', { act: 'demoAlert' }));
      const km = r.campaign ? null : routeKm(r.hospital);
      return `<div class="emerg">${r.campaign ? 'CONVOCATORIA DEL BANCO' : 'ALERTA DE EMERGENCIA'}</div>${fl(1, 'RESPONDER')}${card(`<span class="chip red">${r.campaign ? 'CONVOCATORIA' : r.priority === 'CRÍTICA' ? 'CÓDIGO ROJO' : 'URGENTE'}</span><h2 style="margin-top:10px">${esc(r.hospital)}</h2><p class="mut">${r.campaign ? 'Banco de Sangre · Inventario' : `${esc(r.area)} · ${esc(r.component)}`}</p><p style="margin:8px 0"><b>${r.campaign ? 'Centro de donación: Banco de Sangre Central' : `Destino a ${km.toFixed(1)} km del banco · ${Math.max(5, Math.round((km / 30) * 60))} min`}</b></p><p>Se requiere sangre ${esc(r.blood)}${r.units ? ` (${r.units} unidad${r.units > 1 ? 'es' : ''})` : ''} con ${r.campaign ? 'prioridad alta' : 'prioridad inmediata'}.</p>`)}<div class="stack">${btn('¡Puedo donar / Aceptar!', { act: 'accept', go: 'd/triage' })}${btn('No puedo en este momento', { act: 'snooze', go: 'd/profile', v: 'ghost' })}</div>`;
    },
  },
  'd/triage': {
    role: 'donor',
    render: () => { const a = get().triageAns || []; return `<h2 class="ptitle">Paso 2: Pre-Triaje Médico</h2>${fl(2, 'PRE-TRIAJE')}<div class="banner info">Tus respuestas son confidenciales y serán validadas por personal médico. Es una preselección, no una evaluación médica.</div><div class="stack">${TRIAGE.map((q, i) => card(`<small class="lbl">PREGUNTA ${i + 1}</small><h3 style="margin:4px 0 10px">${q}</h3>${toggle('t' + i, YN, a[i])}`, 'q')).join('')}<p class="center mut" id="cnt">Progreso: ${a.filter(Boolean).length}/5</p>${btn('Revisar respuestas', { act: 'submitTriage', id: 'triageBtn', dis: a.filter(Boolean).length < 5 })}</div>`; },
    mount: (root) => onChange(root, () => { const n = countChecked(root); root.querySelector('#cnt').textContent = `Progreso: ${n}/5`; root.querySelector('#triageBtn').disabled = n < 5; }),
  },
  'd/review': {
    role: 'donor',
    render: () => `<h2 class="ptitle">Revisa tus respuestas</h2>${fl(2, 'CONFIRMAR PRE-TRIAJE')}${card((get().triageAns || []).map((v, i) => `<div class="item"><span>${i + 1}. ${TRIAGE[i]}</span><b>${LABEL[v] || '—'}</b></div>`).join(''))}<div class="stack">${btn('Confirmar y continuar', { act: 'confirmTriage' })}${btn('← Corregir respuestas', { go: 'd/triage', v: 'ghost' })}</div>`,
  },
  'd/schedule': {
    role: 'donor',
    render: () => { const q = activeReq(), mine = q && q.donor?.email === currentUser().email; return `<h2 class="ptitle">Paso 3: Agendar Cita</h2>${fl(3, 'AGENDAR')}${card(`<div class="between" style="justify-content:flex-start;gap:14px"><div class="ico">${icon('hospital', 24)}</div><div><b>${BANK.name}</b><br><span class="mut">${mine ? `Para ${esc(q.hospital)}` : 'Convocatoria del banco'}</span><br><small class="mut">Av. Central 1250 · Acceso prioritario</small></div></div>`)}<small class="lbl">HOY · ${today().toUpperCase()}</small><h2 style="margin:4px 0 10px">Selecciona una hora</h2>${toggle('slot', [['08:00', '08:00 AM'], ['08:30', '08:30 AM'], ['09:00', '09:00 AM'], ['09:30', '09:30 AM']], get().slot, 'pills')}<div class="banner warn" style="margin-top:14px"><b>Cita prioritaria</b><p>Presenta tu pase QR al llegar. El equipo médico estará preparado.</p></div><div class="stack">${btn('Confirmar Cita Prioritaria', { act: 'confirmSlot' })}${btn('Ya no puedo donar', { act: 'declineFlow', go: 'd/profile', v: 'ghost' })}</div>`; },
  },
  'd/qr': {
    role: 'donor',
    render: () => {
      const u = currentUser(), a = get().myAppt && get().myAppt.email === u.email ? get().myAppt : null, q = activeReq();
      if (!a) return statusScreen(icon('calendar', 44), 'Aún no tienes citas', 'Agenda una cita al responder una alerta de donación.', btn('Ver alertas', { go: 'd/alert' }));
      if (a.state === 'Completada') return statusScreen(icon('check', 44), 'Donación completada', 'Tu donación quedó registrada en tu historial.', `${btn('Ver mi donación', { go: 'd/done' })}${btn('Ver historial', { go: 'd/history', v: 'ghost' })}`);
      return `<h2 class="ptitle">Paso 4: Pase de Acceso</h2>${fl(4, 'PASE')}<h2 class="center" style="color:var(--ok-text)">¡Cita Confirmada!</h2><div class="qr">${qrPattern(a.id)}</div><p class="center"><small class="lbl">FOLIO DE ACCESO</small><br><b style="font-size:22px">${esc(a.id)}</b></p>${card(`<b>${BANK.name}</b><p class="mut">${q && q.donor?.email === u.email ? `Para ${esc(q.hospital)} · ` : ''}${today()} · ${esc(a.time)}</p><p class="mut">${esc(u.name)} · Tipo ${esc(u.blood || 'O+')}</p><p class="mut">Estado: <b>${a.state === 'Extracción' ? 'En extracción' : 'Esperando tu llegada'}</b></p>`)}<div class="banner info">Presenta este pase en el Banco de Sangre. El personal registrará tu donación al terminar.</div><div class="stack">${btn('Cancelar Cita', { act: 'endFlow', go: 'd/profile', v: 'ghost' })}</div>`;
    },
  },
  'd/pdf': {
    role: 'donor',
    render: () => { const u = currentUser(), h = historyOf(u)[0] || { folio: '—', date: new Date().toISOString(), hospital: BANK.name, component: 'Sangre total' }; return `<article class="doc"><header class="between"><div class="logo"><i>${icon('drop', 18)}</i>VitalRed</div><div class="right"><small class="lbl">FOLIO</small><br><b>${esc(h.folio)}</b></div></header><h1>Constancia de Donación de Sangre</h1><p class="mut">Se hace constar que la persona indicada acudió a donar sangre de forma voluntaria y altruista.</p><div class="doc-grid">${[['Donante', u.name], ['Tipo sanguíneo', u.blood || 'O+'], ['Institución', BANK.name], ['Fecha', fmtDate(h.date)], ['Hemocomponente', h.component], ['Destino', `${h.hospital} · ${h.area || ''}`]].map(([k, v]) => `<div><small class="lbl">${k.toUpperCase()}</small><b>${esc(v)}</b></div>`).join('')}</div><div class="doc-foot"><div class="qr sm">${qrPattern(h.folio)}</div><div><p>Este documento justifica la ausencia laboral/académica del donante durante el día de la donación.</p><div class="signline">Personal responsable · Banco de Sangre</div></div></div><small class="mut">Comprobante generado por VitalRed · Cumple NOM-253-SSA1-2012. Prototipo de demostración.</small></article><div class="stack noprint"><button class="btn primary" data-act="print">Imprimir / Guardar como PDF</button>${btn('Volver', { go: 'd/done', v: 'ghost' })}</div>`; },
  },
  'd/done': {
    role: 'donor',
    render: () => { const u = currentUser(), h = historyOf(u)[0]; return card(`<div class="center stack"><div class="big ok-ring">${icon('check', 40)}</div><h2>¡Gracias, ${esc(u.name.split(' ')[0])}!</h2><p class="mut">Tu donación quedó registrada. Puede ayudar hasta a 3 personas.</p>${h ? `<div class="banner info" style="text-align:left"><b>${esc(h.component)}</b><p>Para ${esc(h.hospital)} · ${esc(fmtDate(h.date))} · Folio ${esc(h.folio)}</p></div>` : ''}${btn('Descargar justificante (PDF)', { act: 'pdf', v: 'blue' })}${btn('Ver historial de donaciones', { go: 'd/history', v: 'ghost' })}${btn('Volver al perfil', { go: 'd/profile', v: 'ghost' })}</div>`); },
  },
  'd/history': {
    role: 'donor',
    render: () => {
      const u = currentUser(), H = historyOf(u), n = H.length, next = nextEligible(u);
      const stat = (k, v, c) => card(`<small class="mut">${k}</small><h2 class="kpi-n"${c ? ` style="color:var(--${c})"` : ''}>${v}</h2>`);
      return `<h1>Historial de donaciones</h1><p class="mut" style="margin-bottom:16px">Cada donación puede ayudar hasta a 3 personas.</p><div class="grid kpi">${stat('Donaciones', n, 'red-text')}${stat('Vidas ayudadas', n * 3, 'ok-text')}${stat('Última donación', H[0] ? fmtDate(H[0].date) : '—')}${stat('Próxima fecha', next ? (next <= new Date() ? 'Ya puedes donar' : fmtDate(next)) : 'Ya puedes donar')}</div><h2 style="margin:20px 0 12px">Detalle</h2>${n ? `<div class="reqs">${H.map((h) => card(`<div class="between"><b>${esc(h.hospital)}</b><span class="badge ok">COMPLETADA</span></div><p class="mut">${esc(h.component)} · ${h.units} unidad${h.units > 1 ? 'es' : ''}</p><div class="item"><span class="mut">Fecha</span><b>${esc(fmtDate(h.date))}</b></div><div class="item"><span class="mut">Destino</span><b>${esc(h.area || '')}</b></div><div class="item"><span class="mut">Centro</span><b>${BANK.name}</b></div><div class="item"><span class="mut">Folio</span><b>${esc(h.folio)}</b></div>`)).join('')}</div>` : statusScreen(icon('drop', 44), 'Aún no tienes donaciones', 'Cuando completes tu primera donación aparecerá aquí con todos sus detalles.', btn('Ver alertas', { go: 'd/alert' }))}`;
    },
  },
  'd/medical': {
    role: 'donor',
    render: () => {
      const u = currentUser(), m = { ...(u.medical || {}), blood: u.medical?.blood || u.blood };
      return `<h1>Mis datos médicos</h1><p class="mut" style="margin-bottom:16px">Son los datos que registraste al crear tu cuenta. Mantenlos al día: se usan para validar tu aptitud para donar.</p><form id="medForm" class="stack" novalidate>${card(`<h3>Datos personales</h3><div class="stack" style="margin-top:12px">${registerStep(2, m)}</div>`)}${card(`<h3>Control de salud (NOM-253)</h3><div class="stack" style="margin-top:12px">${RISKS.map((q, i) => `<div><span class="mut">${q}</span>${toggle('risk' + i, YN, m['risk' + i])}</div>`).join('')}<div data-fem${m.gender === 'f' ? '' : ' hidden'}><span class="mut">¿Embarazo, lactancia o parto en los últimos 6 meses?</span>${toggle('fem', YN, m.fem)}</div></div>`)}<div class="stack">${btn('Guardar cambios', { act: 'saveMedical', type: 'button' })}${btn('Cancelar', { go: 'd/home', v: 'ghost', type: 'button' })}</div></form>`;
    },
    mount: (root) => { const fem = root.querySelector('[data-fem]'), on = () => { fem.hidden = root.querySelector('input[name=gender]:checked')?.value !== 'f'; }; root.querySelectorAll('input[name=gender]').forEach((i) => i.addEventListener('change', on)); },
  },
  'm/new': {
    role: 'medical', wide: true,
    render: () => `<div class="band"><small>BANCO DE SANGRE · TURNO ACTIVO</small><h2>Nueva Solicitud Transfusional</h2></div><div class="newgrid full"><div class="newcol">${card(`<h3>Grupo sanguíneo (ABO/Rh)</h3><p class="mut" style="margin-bottom:10px">Selecciona una tipificación completa</p>${toggle('blood', ['A+', 'A-', 'B+', 'B-', 'AB+', 'AB-', 'O+', 'O-'].map((b) => [b, b]), '', 'four')}`)}${card(`<h3>Destino y hemocomponente</h3><div class="stack" style="margin-top:12px"><label class="field"><span>Hospital destino</span><select id="hospital" name="hospital">${HOSPITAL_LIST.map((h) => `<option ${h === (currentUser().hospital || 'Hospital General') ? 'selected' : ''}>${h}</option>`).join('')}</select></label><label class="field"><span>Hemocomponente</span><select id="component" name="component">${COMPONENTS.map((c) => `<option>${c}</option>`).join('')}</select></label><label class="field"><span>Área solicitante</span><select id="area" name="area">${AREAS.map((a) => `<option>${a}</option>`).join('')}</select></label></div>`)}${card(`<h3>Prioridad</h3><div style="margin-top:10px">${toggle('priority', [['PROGRAMADA', 'Ordinaria', '24h'], ['ALTA', 'Urgente', '2–4h'], ['CRÍTICA', 'CÓDIGO ROJO', '<30m']], '', 'three')}</div>`)}</div><aside class="newside" aria-label="Resumen de la solicitud">${card(`<h3>Cantidad de unidades</h3><div class="between" style="margin-top:10px"><button class="btn ghost sm" data-act="unit" data-d="-1" aria-label="Menos">−</button><b id="units" style="font-size:28px">1</b><button class="btn sm" data-act="unit" data-d="1" aria-label="Más">+</button></div>`)}${card(`<h3>Selección actual</h3><p style="margin-top:14px" id="curSel" class="mut" aria-live="polite">Sin tipo seleccionado</p>`)}${btn('Lanzar Solicitud Transfusional', { act: 'launch', id: 'launchBtn', dis: true })}<p class="center" id="valMsg" style="margin-top:10px" aria-live="polite"><small class="mut">Selecciona grupo y prioridad para continuar</small></p></aside></div>`,
    mount: (root) => { const upd = () => { const b = root.querySelector('input[name=blood]:checked')?.value, p = root.querySelector('input[name=priority]:checked'); root.querySelector('#curSel').innerHTML = b ? `<span class="chip red">${b}</span> ${root.querySelector('#units').textContent} unidad(es)` : 'Sin tipo seleccionado'; root.querySelector('#launchBtn').disabled = !(b && p); root.querySelector('#valMsg').innerHTML = b && p ? '<small style="color:var(--ok-text)">✓ Grupo y prioridad validados · Solicitud lista para lanzar</small>' : '<small class="mut">Selecciona grupo y prioridad para continuar</small>'; }; root.addEventListener('selchange', upd); return () => root.removeEventListener('selchange', upd); },
  },
};
