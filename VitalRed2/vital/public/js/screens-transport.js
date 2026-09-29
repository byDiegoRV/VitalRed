import { get, currentUser, ROLES } from './store.js';
import { btn, card, badge, stepper, statusScreen, icon } from './ui.js';

export const DEFAULT_TRIP = { id: 'TR-9902', origin: 'Banco de Sangre Central', dest: 'Hospital General', content: '2 u. Concentrado de hematíes O-', distance: '8.4 km', eta: '18 min', status: 'asignada' };
const SEED_HISTORY = [
  ['TR-9897', '22 sep 2026', 'Banco de Sangre Central', 'Hospital San Rafael', '24 min', '4.6 °C', true],
  ['TR-9891', '21 sep 2026', 'Banco de Sangre Central', 'Clínica Santa María', '31 min', '5.1 °C', true],
  ['TR-9884', '20 sep 2026', 'Hospital del Valle', 'Banco de Sangre Central', '19 min', '7.2 °C', false],
  ['TR-9870', '18 sep 2026', 'Banco de Sangre Central', 'Hospital Regional', '27 min', '4.3 °C', true],
].map(([id, date, origin, dest, dur, temp, ok]) => ({ id, date, origin, dest, dur, temp, ok }));

export const getTrip = () => (get().trip === undefined ? DEFAULT_TRIP : get().trip);
export const getHistory = () => get().tripHistory || SEED_HISTORY;

const STEPS = ['Asignada', 'Custodia', 'En tránsito', 'Entregada'];
const IDX = { asignada: 0, custodia: 1, transito: 2, entregada: 3 };
const NEXT = { asignada: ['Iniciar verificación de custodia', 't/check', 'tripCustody'], custodia: ['Continuar verificación', 't/check'], transito: ['Ver ruta en curso', 't/transit'] };
const kv = (rows) => `<div class="kv">${rows.map(([k, v]) => `<div><small class="lbl">${k.toUpperCase()}</small><b>${v}</b></div>`).join('')}</div>`;
const routeViz = (t) => `<div class="route"><div class="rp"><span class="dot"></span><div><small class="lbl">ORIGEN</small><b>${t.origin}</b></div></div><div class="rline"></div><div class="rp"><span class="dot end"></span><div><small class="lbl">DESTINO</small><b>${t.dest}</b></div></div></div>`;
const noTrip = () => statusScreen(icon('truck', 44), 'Sin viaje a cargo', 'No tienes requisiciones asignadas por ahora.', btn('Simular nueva requisición', { act: 'newTrip' }));
const historyItem = (h) => `<div class="item"><div><b>${h.origin} → ${h.dest}</b><br><small class="mut">${h.id} · ${h.date} · ${h.dur}</small></div>${badge(h.temp, h.ok ? 'ok' : 'red')}</div>`;
const checks = (labels) => labels.map((c) => `<label class="item"><span>${c}</span><input type="checkbox" class="chk"></label>`).join('');
const enableWhen = (root, btnSel, ready) => { const upd = () => { root.querySelector(btnSel).disabled = !ready(root); }; root.addEventListener('change', upd); root.addEventListener('selchange', upd); return () => { root.removeEventListener('change', upd); root.removeEventListener('selchange', upd); }; };

export const transportScreens = {
  't/home': {
    role: 'transport', wide: true,
    render: () => {
      const u = currentUser(), t = getTrip();
      const head = `<div class="hello full"><div><h1>Hola, ${u.name.split(' ')[0]}</h1><p class="mut">Unidad ${u.unit || 'AMB-014'} · Turno activo</p></div>${badge('En servicio', 'ok')}</div>`;
      if (!t) return head + noTrip();
      const [label, to, act] = NEXT[t.status] || NEXT.asignada;
      return `${head}${card(`<div class="between"><small class="lbl">VIAJE A CARGO</small>${badge(STEPS[IDX[t.status]], 'warn')}</div><h2 style="margin:4px 0 14px">Requisición #${t.id}</h2>${routeViz(t)}${kv([['Contenido', t.content], ['Distancia', t.distance], ['Tiempo estimado', t.eta], ['Rango térmico', '2 – 10 °C']])}${stepper(STEPS, IDX[t.status])}${btn(label, { go: to, act })}`, 'trip')}${card(`<div class="between"><h3>Últimos recorridos</h3>${btn('Ver todos', { go: 't/history', v: 'ghost', cls: 'sm' })}</div>${getHistory().slice(0, 3).map(historyItem).join('')}`)}${card(`<h3>Recordatorios de custodia</h3>${['Verifica el sello y la integridad de la bolsa', 'Mantén el contenedor entre 2 y 10 °C', 'Registra la temperatura manual si el sensor pierde señal'].map((r) => `<div class="item"><span>${icon('check', 16)} ${r}</span></div>`).join('')}`)}`;
    },
  },
  't/check': {
    role: 'transport', wide: true,
    render: () => { const t = getTrip(); if (!t) return noTrip(); return `${stepper(STEPS, 1)}${card(`<h2>Checklist de custodia NOM-253</h2><p class="mut" style="margin:4px 0 8px">Los 3 controles son obligatorios para iniciar la ruta.</p>${checks(['Contenedor hermético y limpio', 'Temperatura entre 2 °C y 10 °C', 'Bolsa íntegra sin fugas ni coágulos'])}`)}${card(`<h3>Requisición #${t.id}</h3>${routeViz(t)}<div class="stack" style="margin-top:14px">${btn('Aceptar custodia e iniciar ruta', { act: 'tripRoute', go: 't/transit', id: 'routeBtn', dis: true })}${btn('Sensor IoT sin señal', { go: 't/manual', v: 'ghost' })}</div>`)}`; },
    mount: (root) => enableWhen(root, '#routeBtn', (r) => [...r.querySelectorAll('.chk')].every((c) => c.checked)),
  },
  't/manual': {
    role: 'transport',
    render: () => { if (!getTrip()) return noTrip(); return `${stepper(STEPS, 1)}${card(`${badge('Alerta de telemetría', 'warn')}<h2 style="margin:8px 0">Sensor IoT sin señal</h2><p class="mut" style="margin-bottom:12px">Utilice el termómetro físico de la hielera y capture la lectura.</p><div class="stack"><label class="field"><span>Temperatura (°C)</span><input id="manualTemp" type="number" step="0.1" placeholder="4.8"><small class="err" id="manualTemp-err"></small></label>${btn('Guardar registro manual e iniciar ruta', { act: 'saveManual', v: 'warn' })}</div>`)}`; },
  },
  't/transit': {
    role: 'transport', wide: true,
    render: () => {
      const t = getTrip(); if (!t) return noTrip();
      const temp = get().temp, hot = temp > 6, pos = Math.min(100, (temp / 12) * 100);
      return `${stepper(STEPS, 2)}${card(`<div class="between"><h3>Ruta en curso</h3>${badge('GPS activo', 'ok')}</div><div class="map">Mapa de ruta en tiempo real</div>${routeViz(t)}<div class="progress"><i id="eta" style="width:35%"></i></div><small class="mut">Llegada estimada en ${t.eta}</small>`)}${card(`<h3>Cadena de frío</h3><div id="tempBox" class="temp ${hot ? 'hot' : ''}">${temp.toFixed(1)} °C</div><div class="gauge"><i id="gm" style="left:${pos}%"></i></div><div class="between"><small class="mut">0 °C</small><small class="mut">Rango 2 – 10 °C</small><small class="mut">12 °C</small></div>${hot ? '<div class="banner warn" style="margin-top:12px"><b>Temperatura fuera de rango.</b><p>Recalibra el sensor y contacta al banco de sangre.</p></div>' : ''}<div class="stack" style="margin-top:14px">${hot ? btn('Recalibrar y contactar al banco', { act: 'recal', v: 'warn' }) : ''}${btn('Simular fallo térmico', { act: 'heat', v: 'ghost' })}${btn('Llegada a destino', { go: 't/delivery' })}</div>`)}`;
    },
    mount: (root) => { let pct = 35; const i = setInterval(() => { pct = Math.min(95, pct + 4); root.querySelector('#eta').style.width = pct + '%'; if (get().temp <= 6) { const v = Math.round((4 + Math.random() * 1.4) * 10) / 10; get().temp = v; root.querySelector('#tempBox').textContent = v.toFixed(1) + ' °C'; root.querySelector('#gm').style.left = (v / 12) * 100 + '%'; } }, 2500); return () => clearInterval(i); },
  },
  't/delivery': {
    role: 'transport',
    render: () => { if (!getTrip()) return noTrip(); return `${stepper(STEPS, 3)}${card(`<h2>Entrega y recepción firmada</h2><div class="stack" style="margin-top:12px"><div class="sig" data-act="scan">${icon('clipboard', 20)}&nbsp;Escanear entrega en el área clínica</div><div class="sig" data-act="sign">${icon('user', 20)}&nbsp;Firma del personal receptor</div>${btn('Finalizar entrega', { act: 'deliver', id: 'delBtn', dis: true })}</div>`)}`; },
    mount: (root) => enableWhen(root, '#delBtn', (r) => r.querySelectorAll('.sig.ok').length === 2),
  },
  't/history': {
    role: 'transport', wide: true,
    render: () => { const h = getHistory(), ok = h.filter((x) => x.ok).length; return `<div class="full"><h1>Últimos recorridos</h1><p class="mut">Historial de traslados de hemocomponentes</p></div><div class="grid kpi full">${[['Recorridos', h.length], ['Cadena de frío íntegra', ok], ['Incidentes térmicos', h.length - ok]].map(([l, n]) => card(`<small class="mut">${l}</small><h1>${n}</h1>`)).join('')}</div>${card(h.map(historyItem).join(''), 'full')}`; },
  },
  't/profile': profileScreen('transport'),
};

export function profileScreen(role) {
  const rows = { transport: (u) => [['Unidad asignada', u.unit || 'AMB-014'], ['Licencia', u.license || 'LIC-458213'], ['Base', u.hospital || 'Banco Central']], medical: (u) => [['Cédula profesional', 'CED-7765421'], ['Servicio', 'Urgencias / Quirófano'], ['Hospital', u.hospital || 'Hospital General']], bank: (u) => [['Cargo', 'Dirección médica'], ['Institución', u.hospital || 'Banco Central'], ['Turno', 'Matutino']] };
  return {
    role, wide: true,
    render: () => { const u = currentUser(), ini = u.name.split(' ').map((w) => w[0]).slice(0, 2).join(''); return `${card(`<div class="center"><div class="ring">${ini}</div><h2 style="margin-top:12px">${u.name}</h2><p class="mut">${ROLES[role]}</p>${badge('Sesión activa', 'ok')}</div>`)}${card(`<h3>Datos del perfil</h3>${[['Correo', u.email], ...rows[role](u)].map(([k, v]) => `<div class="item"><span class="mut">${k}</span><b>${v}</b></div>`).join('')}`)}${card(`<h3>Preferencias y sesión</h3><div class="stack" style="margin-top:12px">${btn(`${icon('sun', 18)}&nbsp;Cambiar tema claro / oscuro`, { act: 'theme', v: 'ghost' })}${btn('Cerrar sesión', { act: 'logout' })}</div>`)}`; },
  };
}
