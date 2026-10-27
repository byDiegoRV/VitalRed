import { get, set, currentUser, ROLES } from './store.js';
import { btn, card, badge, stepper, statusScreen, icon, qrPattern } from './ui.js';
import { mountTripMap } from './maps.js';

export const DEFAULT_TRIP = {
  id: 'TR-9902',
  origin: 'Banco de Sangre Central',
  dest: 'Hospital General',
  content: '2 u. Concentrado de hematíes O-',
  distance: '8.4 km',
  eta: '18 min',
  status: 'asignada',
  check0: false,
  check1: false,
  check2: false,
  scanOk: false,
  signOk: false,
  photoOrigin: null,
  photoOriginMeta: null,
  photoDelivery: null,
  photoDeliveryMeta: null,
  thermalLogs: [
    { time: '10:00', temp: 4.2, status: 'NORMAL' },
    { time: '10:05', temp: 4.4, status: 'NORMAL' },
    { time: '10:10', temp: 4.1, status: 'NORMAL' }
  ]
};

const SEED_HISTORY = [
  { id: 'TR-9897', date: '22 sep 2026', origin: 'Banco de Sangre Central', dest: 'Hospital San Rafael', dur: '24 min', temp: '4.6 °C', ok: true, photoOrigin: null, photoDelivery: null, thermalLogs: [{ time: '09:00', temp: 4.6, status: 'NORMAL' }] },
  { id: 'TR-9891', date: '21 sep 2026', origin: 'Banco de Sangre Central', dest: 'Clínica Santa María', dur: '31 min', temp: '5.1 °C', ok: true, photoOrigin: null, photoDelivery: null, thermalLogs: [{ time: '11:00', temp: 5.1, status: 'NORMAL' }] },
  { id: 'TR-9884', date: '20 sep 2026', origin: 'Hospital del Valle', dest: 'Banco de Sangre Central', dur: '19 min', temp: '7.2 °C', ok: false, photoOrigin: null, photoDelivery: null, thermalLogs: [{ time: '14:00', temp: 7.2, status: 'ALERTA' }] },
  { id: 'TR-9870', date: '18 sep 2026', origin: 'Banco de Sangre Central', dest: 'Hospital Regional', dur: '27 min', temp: '4.3 °C', ok: true, photoOrigin: null, photoDelivery: null, thermalLogs: [{ time: '08:30', temp: 4.3, status: 'NORMAL' }] }
];

export const getTrip = () => {
  if (get().trip === undefined) return DEFAULT_TRIP;
  return get().trip;
};

export const getHistory = () => get().tripHistory || SEED_HISTORY;

const STEPS = ['Asignada', 'Custodia', 'En tránsito', 'Entregada'];
const IDX = { asignada: 0, custodia: 1, transito: 2, entregada: 3 };
const NEXT = {
  asignada: ['Iniciar verificación de custodia', 't/check', 'tripCustody'],
  custodia: ['Continuar verificación', 't/check'],
  transito: ['Ver ruta en curso', 't/transit']
};

const kv = (rows) => `<div class="kv">${rows.map(([k, v]) => `<div><small class="lbl">${k.toUpperCase()}</small><b>${v}</b></div>`).join('')}</div>`;

const routeViz = (t) => `<div class="route"><div class="rp"><span class="dot"></span><div><small class="lbl">ORIGEN</small><b>${t.origin}</b></div></div><div class="rline"></div><div class="rp"><span class="dot end"></span><div><small class="lbl">DESTINO</small><b>${t.dest}</b></div></div></div>`;

const noTrip = () => statusScreen(icon('truck', 44), 'Sin viaje a cargo', 'No tienes requisiciones asignadas por ahora.', btn('Simular nueva requisición', { act: 'newTrip' }));

const historyItem = (h) => `<div class="item"><div><b>${h.origin} → ${h.dest}</b><br><small class="mut">${h.id} • ${h.date} • ${h.dur}</small></div><div class="row" style="flex:none">${badge(h.temp, h.ok ? 'ok' : 'red')}${btn('Bitácora', { act: 'viewLogbook', id: h.id, v: 'ghost', cls: 'sm' })}</div></div>`;

export const transportScreens = {
  't/home': {
    role: 'transport', wide: true,
    render: () => {
      const u = currentUser(), t = getTrip();
      const head = `<div class="hello full"><div><h1>Hola, ${u.name.split(' ')[0]}</h1><p class="mut">Unidad ${u.unit || 'AMB-014'} • Turno activo</p></div>${badge('En servicio', 'ok')}</div>`;
      if (!t) return head + noTrip();
      const [label, to, act] = NEXT[t.status] || NEXT.asignada;
      return `${head}${card(`<div class="between"><small class="lbl">VIAJE A CARGO</small>${badge(STEPS[IDX[t.status]], 'warn')}</div><h2 style="margin:4px 0 14px">Requisición #${t.id}</h2>${routeViz(t)}${kv([['Contenido', t.content], ['Distancia', t.distance], ['Tiempo estimado', t.eta], ['Rango térmico', '2 - 10 °C']])}${stepper(STEPS, IDX[t.status])}${btn(label, { go: to, act })}`, 'trip')}${card(`<div class="between"><h3>Últimos recorridos</h3>${btn('Ver todos', { go: 't/history', v: 'ghost', cls: 'sm' })}</div>${getHistory().slice(0, 3).map(historyItem).join('')}`)}${card(`<h3>Recordatorios de custodia</h3>${['Verifica el sello y la integridad de la bolsa', 'Toma fotografía obligatoria pre-despacho y entrega', 'Mantén el contenedor entre 2 y 10 °C', 'Registra la temperatura manual si el sensor pierde señal'].map((r) => `<div class="item"><span>${icon('check', 16)} ${r}</span></div>`).join('')}`)}`;
    }
  },
  't/check': {
    role: 'transport', wide: true,
    render: () => {
      const t = getTrip();
      if (!t) return noTrip();
      const photo = t.photoOrigin;
      const meta = t.photoOriginMeta || {};
      const ready = Boolean(t.check0 && t.check1 && t.check2 && photo);
      return `${stepper(STEPS, 1)}${card(`<h2>Checklist de custodia NOM-253</h2><p class="mut" style="margin:4px 0 8px">Los 3 controles y la evidencia fotográfica son obligatorios.</p><label class="item"><span>Contenedor hermético y limpio</span><input type="checkbox" data-act="toggleCheck" data-idx="0" ${t.check0 ? 'checked' : ''}></label><label class="item"><span>Temperatura entre 2 °C y 10 °C</span><input type="checkbox" data-act="toggleCheck" data-idx="1" ${t.check1 ? 'checked' : ''}></label><label class="item"><span>Bolsa íntegra sin fugas ni coágulos</span><input type="checkbox" data-act="toggleCheck" data-idx="2" ${t.check2 ? 'checked' : ''}></label>`)}${card(`<h3>Evidencia fotográfica pre-despacho</h3><p class="mut" style="margin-bottom:10px"><small>Fotografía del empaque biológico sellado en origen</small></p><div class="photo-box">${photo ? `<div class="photo-preview"><img src="${photo}" alt="Foto Origen"><div class="photo-meta"><small><b>REQ:</b> ${t.id}</small><br><small><b>STAMP:</b> ${meta.timestamp || new Date().toISOString()}</small><br><small><b>LOC:</b> ${t.origin}</small></div></div>` : '<p class="mut center" style="padding:20px 0">No se ha capturado fotografía</p>'}<div class="row" style="margin-top:10px"><label class="btn ghost sm" style="cursor:pointer;text-align:center">${icon('file', 16)} Upload / Tomar foto<input type="file" accept="image/*" data-act="uploadPhotoOrigin" style="display:none"></label>${btn('Foto de prueba', { act: 'dummyPhotoOrigin', v: 'ghost', cls: 'sm' })}</div></div>`)}${card(`<h3>Requisición #${t.id}</h3>${routeViz(t)}<div class="stack" style="margin-top:14px">${btn('Aceptar custodia e iniciar ruta', { act: 'tripRoute', go: 't/transit', id: 'routeBtn', dis: !ready })}${btn('Sensor IoT sin señal', { go: 't/manual', v: 'ghost' })}</div>`)}`;
    }
  },
  't/manual': {
    role: 'transport',
    render: () => {
      if (!getTrip()) return noTrip();
      return `${stepper(STEPS, 1)}${card(`${badge('Alerta de telemetría', 'warn')}<h2 style="margin:8px 0">Sensor IoT sin señal</h2><p class="mut" style="margin-bottom:12px">Utilice el termómetro físico de la hielera y capture la lectura.</p><div class="stack"><label class="field"><span>Temperatura (°C)</span><input id="manualTemp" type="number" step="0.1" placeholder="4.8"><small class="err" id="manualTemp-err"></small></label>${btn('Guardar registro manual e iniciar ruta', { act: 'saveManual', v: 'warn' })}</div>`)}`;
    }
  },
  't/transit': {
    role: 'transport', wide: true,
    render: () => {
      const t = getTrip();
      if (!t) return noTrip();
      const temp = get().temp;
      const mode = get().simMode || 'normal';
      const hot = temp > 6;
      const offline = mode === 'offline';
      const pos = Math.min(100, Math.max(0, (temp / 12) * 100));
      return `${stepper(STEPS, 2)}${card(`<div class="between"><h3>Ruta en curso</h3>${badge(offline ? 'Sensor Offline' : 'GPS Activo', offline ? 'warn' : 'ok')}</div><div id="tripMap" class="lmap sm" role="region" aria-label="Mapa interactivo de la ruta en curso" tabindex="0">Cargando mapa…</div>${routeViz(t)}<div class="progress"><i id="eta" style="width:45%"></i></div><small class="mut">Llegada estimada en ${t.eta}</small>`)}${card(`<h3>Cadena de frío (IoT)</h3>${offline ? '<div class="temp hot">SIN SEÑAL</div><div class="banner warn" style="margin-top:12px"><b>Pérdida de señal del sensor IoT.</b><p>Conmute a captura manual con termómetro físico.</p></div>' : `<div id="tempBox" class="temp ${hot ? 'hot' : ''}">${temp.toFixed(1)} °C</div><div class="gauge"><i id="gm" style="left:${pos}%"></i></div><div class="between"><small class="mut">0 °C</small><small class="mut">Rango 2 - 10 °C</small><small class="mut">12 °C</small></div>`}${hot && !offline ? '<div class="banner warn" style="margin-top:12px"><b>Temperatura fuera de rango (>6.0 °C).</b><p>Recalibra el sensor y contacta al banco de sangre.</p></div>' : ''}<div class="stack" style="margin-top:14px"><div class="row">${btn('Panel Simulador IoT', { act: 'openSimModal', v: 'ghost' })}${offline ? btn('Registro Manual', { go: 't/manual', v: 'warn' }) : ''}</div>${hot && !offline ? btn('Recalibrar y contactar al banco', { act: 'recal', v: 'warn' }) : ''}${btn('Llegada a destino', { go: 't/delivery' })}</div>`)}`;
    },
    mount: (root) => {
      let pct = 45;
      const tm = mountTripMap(root, getTrip() || DEFAULT_TRIP);
      const i = setInterval(() => {
        pct = Math.min(95, pct + 3);
        tm.setProgress(pct);
        const etaEl = root.querySelector('#eta');
        if (etaEl) etaEl.style.width = pct + '%';
        const mode = get().simMode || 'normal';
        if (mode === 'normal') {
          const v = Math.round((4 + Math.random() * 1.2) * 10) / 10;
          set({ temp: v });
          const tBox = root.querySelector('#tempBox');
          if (tBox) tBox.textContent = v.toFixed(1) + ' °C';
          const gm = root.querySelector('#gm');
          if (gm) gm.style.left = (v / 12) * 100 + '%';
          const t = getTrip();
          if (t && t.thermalLogs) {
            const timeStr = new Date().toLocaleTimeString('es-MX', { hour: '2-digit', minute: '2-digit' });
            t.thermalLogs.push({ time: timeStr, temp: v, status: 'NORMAL' });
            set({ trip: t });
          }
        }
      }, 3000);
      return () => { clearInterval(i); tm.destroy(); };
    }
  },
  't/delivery': {
    role: 'transport',
    render: () => {
      const t = getTrip();
      if (!t) return noTrip();
      const photo = t.photoDelivery;
      const meta = t.photoDeliveryMeta || {};
      const ready = Boolean(t.scanOk && t.signOk && photo);
      return `${stepper(STEPS, 3)}${card(`<h2>Entrega y recepción firmada</h2><p class="mut" style="margin:4px 0 12px">Escanear entrega, adjuntar evidencia fotográfica y obtener firma.</p><div class="stack"><div class="sig ${t.scanOk ? 'ok' : ''}" data-act="toggleDeliveryScan">${icon('clipboard', 20)}&nbsp;${t.scanOk ? 'Código verificado' : 'Escanear entrega en el área clínica'}</div><div class="sig ${t.signOk ? 'ok' : ''}" data-act="toggleDeliverySign">${icon('user', 20)}&nbsp;${t.signOk ? currentUser().name : 'Firma del personal receptor'}</div></div>`)}${card(`<h3>Evidencia fotográfica de recepción</h3><p class="mut" style="margin-bottom:10px"><small>Fotografía de la bolsa entregada en quirófano / receptor</small></p><div class="photo-box">${photo ? `<div class="photo-preview"><img src="${photo}" alt="Foto Entrega"><div class="photo-meta"><small><b>REQ:</b> ${t.id}</small><br><small><b>STAMP:</b> ${meta.timestamp || new Date().toISOString()}</small><br><small><b>DEST:</b> ${t.dest}</small></div></div>` : '<p class="mut center" style="padding:20px 0">No se ha capturado fotografía</p>'}<div class="row" style="margin-top:10px"><label class="btn ghost sm" style="cursor:pointer;text-align:center">${icon('file', 16)} Upload / Tomar foto<input type="file" accept="image/*" data-act="uploadPhotoDelivery" style="display:none"></label>${btn('Foto de prueba', { act: 'dummyPhotoDelivery', v: 'ghost', cls: 'sm' })}</div></div>`)}${card(`${btn('Finalizar entrega y ver bitácora', { act: 'deliver', id: 'delBtn', dis: !ready })}`)}`;
    }
  },
  't/logbook': {
    role: 'transport', wide: true,
    render: () => {
      const logData = get().activeLogbook || getTrip() || DEFAULT_TRIP;
      const logs = logData.thermalLogs && logData.thermalLogs.length ? logData.thermalLogs : [{ time: '10:00', temp: 4.2, status: 'NORMAL' }];
      const temps = logs.map((l) => l.temp);
      const minTemp = Math.min(...temps).toFixed(1), maxTemp = Math.max(...temps).toFixed(1);
      const avgTemp = (temps.reduce((a, b) => a + b, 0) / temps.length).toFixed(1);
      const inRange = Math.min(...temps) >= 2 && Math.max(...temps) <= 10;
      const shown = logs.slice(-8);
      const u = currentUser();
      const fmt = (m) => (m && m.timestamp ? new Date(m.timestamp).toLocaleString('es-MX', { dateStyle: 'short', timeStyle: 'short' }) : '');
      const photo = (src, label, alt, meta) => `<figure class="evid"><figcaption class="lbl">${label}</figcaption>${src ? `<div class="photo-preview"><img src="${src}" alt="${alt}"></div><small class="mut">${meta?.location ? meta.location + ' · ' : ''}${fmt(meta)}</small>` : '<div class="photo-empty">Sin foto registrada</div>'}</figure>`;
      const tile = ([k, v]) => `<div><small class="lbl">${k.toUpperCase()}</small><b>${v}</b></div>`;
      return `<article class="doc logbook"><header class="doc-head"><div class="logo"><i>${icon('drop', 18)}</i>VitalRed</div><div class="right"><small class="lbl">BITÁCORA DE RUTA</small><br><b>${logData.id || 'TR-9902'}</b></div></header><div class="doc-title"><div><h1>Bitácora de Trazabilidad Transfusional</h1><p class="mut">Documento oficial de custodia y cadena de frío según NOM-253-SSA1-2012.</p></div><div class="qr sm" role="img" aria-label="Código de verificación del documento">${qrPattern(String(logData.id || 'TR-9902'))}</div></div><div class="doc-grid">${[['Operador', u?.name || 'Luis Pérez'], ['Unidad', u?.unit || 'AMB-014'], ['Origen', logData.origin], ['Destino', logData.dest], ['Contenido', logData.content], ['Estado', 'ENTREGADO']].map(tile).join('')}</div><h3>Resumen de Telemetría Térmica ${inRange ? '<span class="badge ok">CUMPLE NORMA</span>' : '<span class="badge red">FUERA DE RANGO</span>'}</h3><div class="doc-grid cols4">${[['Temp. mínima', minTemp + ' °C'], ['Temp. máxima', maxTemp + ' °C'], ['Temp. promedio', avgTemp + ' °C'], ['Rango norma', '2.0 – 10.0 °C']].map(tile).join('')}</div><h3>Historial de Lecturas de Temperatura</h3><div class="tbl"><table><thead><tr><th>Hora</th><th>Temperatura</th><th>Estado</th></tr></thead><tbody>${shown.map((l) => `<tr><td>${l.time}</td><td><b>${l.temp} °C</b></td><td>${l.status === 'NORMAL' ? '<span class="badge ok">NORMAL</span>' : '<span class="badge red">ALERTA</span>'}</td></tr>`).join('')}</tbody></table></div>${logs.length > shown.length ? `<small class="mut">Se muestran las últimas ${shown.length} de ${logs.length} lecturas registradas.</small>` : ''}<h3>Evidencias Fotográficas de Custodia</h3><div class="grid two evid-grid">${photo(logData.photoOrigin, 'FOTO EN ORIGEN (PRE-DESPACHO)', 'Foto de origen', logData.photoOriginMeta)}${photo(logData.photoDelivery, 'FOTO EN DESTINO (RECEPCIÓN)', 'Foto de destino', logData.photoDeliveryMeta)}</div><p class="cert">Certificación de recepción y conformidad en punto de entrega.</p><div class="sigs"><div class="signline">Firma del transportista · ${u?.name || 'Luis Pérez'}</div><div class="signline">Firma Personal Receptor Hospital Destino</div></div><small class="mut">Generado por VitalRed • Módulo de Transporte • Trazabilidad Auditada.</small></article><div class="stack noprint" style="margin-top:16px">${btn('Descargar Bitácora PDF', { act: 'printLogbook', v: 'primary' })}${btn('Volver a Inicio', { go: 't/home', v: 'ghost' })}</div>`;
    }
  },
  't/history': {
    role: 'transport', wide: true,
    render: () => {
      const h = getHistory();
      const ok = h.filter((x) => x.ok).length;
      return `<div class="full"><h1>Últimos recorridos</h1><p class="mut">Historial de traslados de hemocomponentes</p></div><div class="grid kpi full">${[['Recorridos', h.length], ['Cadena de frío íntegra', ok], ['Incidentes térmicos', h.length - ok]].map(([l, n]) => card(`<small class="mut">${l}</small><h1>${n}</h1>`)).join('')}</div>${card(h.map(historyItem).join(''), 'full')}`;
    }
  },
  't/profile': profileScreen('transport')
};

export function profileScreen(role) {
  const rows = {
    transport: (u) => [['Unidad asignada', u.unit || 'AMB-014'], ['Licencia', u.license || 'LIC-458213'], ['Base', u.hospital || 'Banco Central']],
    medical: (u) => [['Cédula profesional', 'CED-7765421'], ['Servicio', 'Urgencias / Quirófano'], ['Hospital', u.hospital || 'Hospital General']],
    bank: (u) => [['Cargo', 'Dirección Médica'], ['Institución', u.hospital || 'Banco Central'], ['Turno', 'Matutino']]
  };
  return {
    role, wide: true,
    render: () => {
      const u = currentUser(), ini = u.name.split(' ').map((w) => w[0]).slice(0, 2).join('');
      return `${card(`<div class="center"><div class="ring">${ini}</div><h2 style="margin-top:12px">${u.name}</h2><p class="mut">${ROLES[role]}</p>${badge('Sesión activa', 'ok')}</div>`)}${card(`<h3>Datos del perfil</h3>${[['Correo', u.email], ...rows[role](u)].map(([k, v]) => `<div class="item"><span class="mut">${k}</span><b>${v}</b></div>`).join('')}`)}${card(`<h3>Preferencias y sesión</h3><div class="stack" style="margin-top:12px">${btn(`${icon('sun', 18)}&nbsp;Cambiar tema claro / oscuro`, { act: 'theme', v: 'ghost' })}${btn('Cerrar sesión', { act: 'logout' })}</div>`)}`;
    }
  };
}
