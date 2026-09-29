import { get, set, currentUser, ROLES } from './store.js';
import { overrides } from './screens-ui.js';
import { flowScreens } from './screens-flow.js';
import { transportScreens, profileScreen } from './screens-transport.js';
import { btn, card, badge, field, toggle, stepper, statusScreen, qrPattern, icon } from './ui.js';

const REQ_STEPS = ['Creada', 'Buscando', 'Esperando', 'Programada', 'Completada'];
const STEP_INDEX = { creada: 0, buscando: 1, esperando: 2, programada: 3, completada: 4 };
const TRIAGE = ['¿Antibióticos, aspirinas o antiinflamatorios en los últimos 7 días?', '¿Fiebre, tos, gripe o diarrea recientes?', '¿Alcohol o sustancias en las últimas 48 horas?', '¿Ayuno de al menos 4 horas y líquidos hoy?', '¿Dormiste al menos 6 horas anoche?'];
const EXPECTED = ['no', 'no', 'no', 'yes', 'yes'];
const YN = [['yes', 'SÍ'], ['no', 'NO']];
const RISKS = ['¿Hepatitis B/C, VIH, Chagas o Sífilis?', '¿Tatuajes, piercings o acupuntura en 12 meses?', '¿Cirugías mayores o transfusiones en 12 meses?'];

/** Cada pantalla: { role?, tabs?, render(), mount?(root) → cleanup } */
export const screens = {
  // ---------- MÓDULO A ----------
  login: {
    render: ({ q }) => card(`<h2>Iniciar sesión</h2><p class="mut" style="margin:6px 0 16px">${ROLES[q.role] || 'Acceso a VitalRed'}</p><form data-form="login" class="stack" novalidate>${field('email', 'Correo o cédula', 'text', 'usuario@vitalred.org')}${field('password', 'Contraseña', 'password', '••••••••')}${btn('Ingresar', { type: 'submit' })}</form><p class="center mut" style="margin-top:14px">¿Sin cuenta? <a href="#/register?role=${q.role || 'donor'}">Regístrate</a></p><details style="margin-top:12px"><summary class="mut">Cuentas de demostración</summary><small class="mut">donante@ · medico@ · transporte@ · banco@vitalred.org<br>Donante123 · Medico123 · Transp123 · Banco123</small></details>`),
  },
  register: {
    render: ({ q }) => {
      const role = q.role || 'donor';
      const donor = role === 'donor';
      return card(`<h2>Registro · ${ROLES[role]}</h2><p class="mut" style="margin:6px 0 16px">${donor ? 'Cuestionario base de elegibilidad NOM-253-SSA1-2012. Tus respuestas son confidenciales.' : 'Captura tus credenciales institucionales.'}</p>
      <form data-form="register" data-role="${role}" class="stack" novalidate>${field('name', 'Nombre completo')}${field('email', donor ? 'Correo' : 'Cédula profesional / correo')}${field('password', 'Contraseña (mín. 6)', 'password')}
      ${donor ? `<div><span class="mut">Género</span>${toggle('gender', [['f', 'Femenino'], ['m', 'Masculino'], ['o', 'Otro']])}</div>
      <div><span class="mut">Edad</span>${toggle('age', [['minor', '< 18'], ['adult', '18–65'], ['senior', '> 65']])}</div>
      <div><span class="mut">Peso</span>${toggle('weight', [['low', '< 50 kg'], ['ok', '≥ 50 kg']])}</div>
      <div><span class="mut">Grupo sanguíneo</span><select id="blood">${['O+', 'O-', 'A+', 'A-', 'B+', 'B-', 'AB+', 'AB-'].map((b) => `<option>${b}</option>`).join('')}</select></div>
      <div id="femSection" hidden><span class="mut">¿Embarazo/lactancia o parto en los últimos 6 meses?</span>${toggle('fem', YN)}</div>
      ${RISKS.map((r, i) => `<div><span class="mut">${r}</span>${toggle('risk' + i, YN)}</div>`).join('')}` : `${field('hospital', 'Hospital / Institución de adscripción')}`}
      ${btn('Crear cuenta', { type: 'submit' })}</form>`);
    },
  },

  // ---------- MÓDULO D ----------
  'd/profile': {
    role: 'donor',
    render: () => {
      const u = currentUser(), r = get().req, hot = r && ['buscando', 'esperando'].includes(r.status);
      return `${hot ? card(`<div class="between"><div><span class="badge red">CÓDIGO ROJO</span><h3 style="margin-top:6px">${r.units} u. de ${r.blood} · ${r.hospital}</h3></div>${btn('Ver', { go: 'd/alert', cls: 'sm' })}</div>`, 'alert') : ''}
      ${card(`<div class="center"><div class="avatar">${u.blood || 'O+'}</div><h2>${u.name}</h2>${badge('✓ ' + u.status, u.status.startsWith('Apto') ? 'ok' : 'warn')}</div><div class="grid" style="margin:18px 0"><div class="stat"><b>${u.donations || 0}</b><small>Donaciones</small></div><div class="stat"><b style="color:var(--red)">${(u.donations || 0) * 3}</b><small>Vidas ayudadas</small></div></div><div class="stack">${btn('Recibir alerta de demostración', { act: 'demoAlert' })}${btn('Actualizar pre-triaje', { go: 'd/triage', v: 'ghost' })}</div>`)}`;
    },
  },
  'd/alert': {
    role: 'donor',
    render: () => { const r = get().req || { blood: 'O-', units: 2, hospital: 'Hospital General' }; return card(`<span class="badge red">ALERTA URGENTE</span><h2 style="margin:10px 0">Código Rojo · ${r.hospital}</h2><div class="grid" style="margin-bottom:16px"><div class="stat"><b>${r.blood}</b><small>Tipo requerido</small></div><div class="stat"><b>${r.units}</b><small>Unidades</small></div><div class="stat"><b>3.2 km</b><small>Distancia</small></div></div><div class="stack">${btn('¡Puedo donar / Aceptar!', { go: 'd/triage' })}${btn('Posponer 15 min', { go: 'd/profile', v: 'ghost', act: 'snooze' })}${btn('No puedo en este momento', { go: 'd/profile', v: 'ghost' })}</div>`, 'alert'); },
  },
  'd/triage': {
    role: 'donor',
    render: () => card(`<h2>Pre-triaje express</h2><p class="mut" style="margin:6px 0 16px">Tus respuestas son confidenciales (NOM-253-SSA1-2012).</p><div class="stack" data-triage>${TRIAGE.map((q, i) => `<div><span style="font-weight:600">${i + 1}. ${q}</span>${toggle('t' + i, YN)}</div>`).join('')}<div class="between"><small class="mut" id="cnt">0/5 respondidas</small></div>${btn('Validar y continuar', { act: 'submitTriage', id: 'triageBtn', dis: true })}</div>`),
    mount: (root) => { const upd = () => { const n = root.querySelectorAll('.tbtn.sel').length; root.querySelector('#cnt').textContent = `${n}/5 respondidas`; root.querySelector('#triageBtn').disabled = n < 5; }; root.addEventListener('selchange', upd); return () => root.removeEventListener('selchange', upd); },
  },
  'd/rejected': { role: 'donor', render: () => statusScreen(icon('x', 44), 'No puedes donar hoy', 'Según tus respuestas, tu donación queda diferida. Pospondremos tus alertas y podrás intentarlo más adelante.', btn('Volver al perfil', { go: 'd/profile' })) },
  'd/schedule': {
    role: 'donor',
    render: () => card(`<h2>Selecciona tu horario</h2><p class="mut" style="margin:6px 0 16px">Hospital General · Banco de Sangre</p><div class="tog" data-name="slot">${['08:00', '08:30', '09:00', '09:30'].map((h) => `<button type="button" class="tbtn" data-act="tog" data-v="${h}">${h}</button>`).join('')}</div><div style="height:16px"></div>${btn('Confirmar cita prioritaria', { act: 'confirmSlot' })}`),
  },
  'd/qr': {
    role: 'donor',
    render: () => { const a = get().myAppt || { id: 'VR-2026-8891', time: '08:00' }; return card(`<div class="center stack"><span class="badge ok">¡Cita confirmada!</span><h2>Pase digital QR</h2><div class="qr">${qrPattern(a.id)}</div><b>${a.id}</b><p class="mut">Hospital General · ${a.time} · Ayuno 4 h · Presenta este pase al llegar.</p>${btn('Simular donación completada', { act: 'finishDonation' })}</div>`); },
  },
  'd/done': {
    role: 'donor',
    render: () => card(`<div class="center stack"><div class="big ok-ring">${icon('check', 40)}</div><h2>¡Gracias, ${currentUser().name.split(' ')[0]}!</h2><p class="mut">Tu donación quedó registrada. Puede ayudar hasta a 3 personas.</p>${btn('Descargar justificante (PDF)', { act: 'pdf', v: 'blue' })}${btn('Volver al perfil', { go: 'd/profile', v: 'ghost' })}</div>`),
  },

  // ---------- MÓDULO M ----------
  'm/dashboard': {
    role: 'medical', wide: true,
    render: () => { const r = get().req; return card(`<div class="between"><div><h2>Guardia de Urgencias</h2><p class="mut">Solicitudes transfusionales activas</p></div>${btn('+ Nueva solicitud', { go: 'm/new', cls: 'sm' })}</div>` + (r ? `<div class="item"><div><b>${r.id} · ${r.blood}</b><br><small class="mut">${r.units} unidades · ${r.hospital}</small></div><div>${badge(r.priority, r.priority === 'CRÍTICA' ? 'red' : 'warn')} ${badge(r.status)} ${btn('Seguimiento', { go: r.status === 'programada' ? 'm/reception' : 'm/radar', cls: 'sm', v: 'ghost' })}</div></div>` : '<p class="mut center" style="padding:24px">Sin solicitudes activas.</p>')); },
  },
  'm/new': {
    role: 'medical',
    render: () => card(`<h2>Nueva solicitud transfusional</h2><p class="mut" style="margin:6px 0 16px">Meta: menos de 30 segundos.</p><div class="stack"><div><span class="mut">Grupo ABO/Rh</span>${toggle('blood', ['O-', 'O+', 'A-', 'A+', 'B-', 'B+', 'AB-', 'AB+'].map((b) => [b, b]))}</div><div><span class="mut">Unidades</span>${toggle('units', [1, 2, 3, 4].map((n) => [n, n]))}</div><div><span class="mut">Prioridad</span>${toggle('priority', [['CRÍTICA', 'CÓDIGO ROJO'], ['ALTA', 'Alta'], ['PROGRAMADA', 'Programada']])}</div>${btn('Lanzar Código Rojo al radar', { act: 'launch', id: 'launchBtn', dis: true })}</div>`),
    mount: (root) => { const upd = () => { root.querySelector('#launchBtn').disabled = root.querySelectorAll('.tbtn.sel').length < 3; }; root.addEventListener('selchange', upd); return () => root.removeEventListener('selchange', upd); },
  },
  'm/radar': {
    role: 'medical',
    render: () => { const r = get().req; if (!r) return statusScreen(icon('radar', 44), 'Sin solicitud', 'Crea una solicitud para activar el radar.', btn('Nueva solicitud', { go: 'm/new' })); return card(`${stepper(REQ_STEPS, STEP_INDEX[r.status])}<div class="center"><h2>Radar transfusional</h2><p class="mut">${r.units} u. de ${r.blood} · radio 2 km</p><div class="radar" id="radarTxt">${r.status === 'buscando' ? 'Buscando…' : r.notified + ' notificados'}</div><p id="radarMsg" class="mut">${r.status === 'esperando' ? 'Donantes en camino…' : 'Estamos alertando donantes compatibles.'}</p></div><div class="stack">${btn('Cancelar solicitud', { act: 'cancelReq', v: 'ghost' })}${btn('Simular: sin respuesta', { go: 'm/none', v: 'ghost', act: 'noResp' })}</div>`); },
    mount: (root, rerender) => { const r = get().req; if (!r) return; const t1 = setTimeout(() => { if (get().req?.status === 'buscando') { set({ req: { ...get().req, status: 'esperando', notified: 3 } }); rerender(); } }, 3500), t2 = setTimeout(() => { if (get().req?.status === 'esperando') { set({ req: { ...get().req, status: 'programada' } }); rerender(); } }, 8000); return () => { clearTimeout(t1); clearTimeout(t2); }; },
  },
  'm/reception': {
    role: 'medical',
    render: () => { const r = get().req; return card(`${r ? stepper(REQ_STEPS, STEP_INDEX[r.status]) : ''}<h2>Recepción de unidad</h2><div class="stack" style="margin-top:12px"><div class="sig" data-act="scan">Toca para escanear código de la bolsa</div><div><span class="mut">Verificación clínica</span>${['Confirmación de sello de laboratorio', 'Integridad física'].map((c) => `<label class="item"><span>${c}</span><input type="checkbox" class="chk" style="width:22px;min-height:22px"></label>`).join('')}</div><div class="sig" data-act="sign">Toca para firmar</div>${btn('Confirmar recepción e iniciar transfusión', { act: 'receive', id: 'recvBtn', dis: true })}</div>`); },
    mount: (root) => { const upd = () => { root.querySelector('#recvBtn').disabled = !(root.querySelectorAll('.sig.ok').length === 2 && [...root.querySelectorAll('.chk')].every((c) => c.checked)); }; root.addEventListener('selchange', upd); root.addEventListener('change', upd); return () => { root.removeEventListener('selchange', upd); root.removeEventListener('change', upd); }; },
  },
  'm/none': {
    role: 'medical',
    render: () => { const cancelled = get().req?.status === 'cancelada'; return cancelled ? statusScreen(icon('x', 44), 'Solicitud cancelada', 'La solicitud fue cancelada y los donantes fueron notificados.', btn('Volver al dashboard', { go: 'm/dashboard' })) : statusScreen(icon('alert', 44), 'Solicitud sin respuesta', 'No se encontraron donantes disponibles en el rango de 15 km a la redonda de tu ubicación actual.', `<div class="banner info" style="text-align:left"><b>Sugerencia de búsqueda</b><p>Puedes ampliar el radio de búsqueda o contactar un banco de sangre externo para más opciones.</p></div>${btn('Volver a buscar / Ampliar radio', { act: 'retry' })}${btn('Solicitar a banco externo', { act: 'external', v: 'ghost' })}`); },
  },

  // ---------- MÓDULO B ----------
  'b/appts': {
    role: 'bank', wide: true,
    render: () => card(`<div class="between"><div><h2>Agenda del día</h2><p class="mut">${get().appts.length} citas</p></div>${btn('Escanear pase QR', { act: 'scanAppt', cls: 'sm' })}</div>${get().appts.map((a) => `<div class="item"><div><b>${a.name}</b><br><small class="mut">${a.id} · ${a.time}</small></div>${badge(a.state, a.state === 'Completada' ? 'ok' : a.state === 'Extracción' ? 'warn' : '')}</div>`).join('')}`),
  },
  'b/fleet': {
    role: 'bank', wide: true,
    render: () => card(`<h2>Telemetría de flota</h2><div class="sig" style="margin:12px 0;height:160px">Mapa en vivo</div>${[['AMB-01', '4.2 °C', 'ok'], ['AMB-02', '5.6 °C', 'ok'], ['AMB-03', '7.1 °C', 'red']].map(([n, t, c]) => `<div class="item"><b>${n}</b><span>${badge(t, c)}</span></div>`).join('')}`),
  },
  'b/reports': {
    role: 'bank', wide: true,
    render: () => card(`<h2>Reportes de trazabilidad NOM-253</h2><div class="grid" style="margin:14px 0"><div class="stat"><b>128</b><small>Bolsas</small></div><div class="stat"><b>2.4%</b><small>Descarte</small></div><div class="stat"><b>9</b><small>Hospitales</small></div></div>${btn('Exportar reporte (CSV)', { act: 'export', v: 'ok' })}`),
  },
};

Object.assign(screens, overrides, flowScreens, transportScreens, { 'm/profile': profileScreen('medical'), 'b/profile': profileScreen('bank') });
['d/home', 'd/profile'].forEach((k) => { screens[k].wide = true; });
