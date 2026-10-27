// Mapas interactivos de VitalRed (Leaflet, incluido en /vendor/leaflet).
// Las coordenadas son ficticias para la demo: cámbialas aquí para ubicar el prototipo en otra ciudad.
import { icon } from './ui.js';

export const BANK = { name: 'Banco de Sangre Central', ll: [18.8453, -97.1021] };
export const HOSPITALS = {
  'Hospital General': [18.8601, -97.0897],
  'Hospital San Rafael': [18.8665, -97.1102],
  'Clínica Santa María': [18.8372, -97.0942],
  'Hospital del Valle': [18.8309, -97.118],
  'Hospital Ángeles': [18.869, -97.095],
  'Hospital Regional': [18.825, -97.087],
};
export const hospitalLL = (name) => HOSPITALS[name] || HOSPITALS['Hospital General'];
const placeLL = (name) => (name === BANK.name ? BANK.ll : hospitalLL(name));

export const FLEET = [
  { id: 'AMB-017', driver: 'Pedro Páramo', info: '2.3 km (ETA 6 min)', state: 'Disponible', ll: [18.8418, -97.0932] },
  { id: 'AMB-022', driver: 'Laura Salinas', info: '4.5 km (ETA 12 min)', state: 'En tránsito', progress: 0.45 },
  { id: 'AMB-009', driver: 'Carlos Guzmán', info: '', state: 'Ocupada', ll: [18.8381, -97.1104] },
  { id: 'AMB-011', driver: 'M. Arrieta', info: '1.1 km (ETA 3 min)', state: 'Disponible', ll: [18.8547, -97.1077] },
];
const KIND = { Disponible: 'ok', 'En tránsito': 'warn', Ocupada: 'off' };

// ---- utilidades geométricas -------------------------------------------------
// Ruta simulada (sin servicio de ruteo): 3 puntos intermedios desplazados para que parezca una calle.
export const routePath = (a, b) => {
  const dLat = b[0] - a[0], dLon = b[1] - a[1];
  const at = (k, off) => [a[0] + dLat * k - dLon * off, a[1] + dLon * k + dLat * off];
  return [a, at(0.25, 0.06), at(0.5, -0.05), at(0.75, 0.04), b];
};
export const pointAt = (path, t) => {
  const seg = path.slice(1).map((p, i) => [path[i], p]);
  const len = seg.map(([a, b]) => Math.hypot(b[0] - a[0], b[1] - a[1]));
  let d = Math.min(1, Math.max(0, t)) * len.reduce((x, y) => x + y, 0);
  for (let i = 0; i < seg.length; i++) {
    if (d <= len[i] || i === seg.length - 1) {
      const k = len[i] ? d / len[i] : 0, [a, b] = seg[i];
      return [a[0] + (b[0] - a[0]) * k, a[1] + (b[1] - a[1]) * k];
    }
    d -= len[i];
  }
  return path[0];
};

// ---- carga perezosa de Leaflet ---------------------------------------------
let ready = null;
export const loadLeaflet = () => {
  if (window.L) return Promise.resolve(window.L);
  ready ||= new Promise((resolve, reject) => {
    const css = document.createElement('link');
    css.rel = 'stylesheet'; css.href = '/vendor/leaflet/leaflet.css';
    document.head.append(css);
    const js = document.createElement('script');
    js.src = '/vendor/leaflet/leaflet.js';
    js.onload = () => resolve(window.L);
    js.onerror = () => { ready = null; reject(new Error('No se pudo cargar Leaflet')); };
    document.head.append(js);
  });
  return ready;
};

const pin = (L, kind, label, ic) => L.divIcon({
  className: 'pin-wrap',
  html: `<span class="pin pin-${kind}">${icon(ic, 18)}</span><span class="pin-lbl">${label}</span>`,
  iconSize: [34, 34], iconAnchor: [17, 17], popupAnchor: [0, -18],
});

const baseMap = async (el, bounds) => {
  const L = await loadLeaflet();
  el.textContent = '';
  const map = L.map(el, { scrollWheelZoom: false, zoomSnap: 0.5 });
  const tiles = L.tileLayer('https://tile.openstreetmap.org/{z}/{x}/{y}.png', {
    maxZoom: 19,
    attribution: '&copy; <a href="https://www.openstreetmap.org/copyright" target="_blank" rel="noopener">OpenStreetMap</a>',
  }).addTo(map);
  tiles.on('tileerror', () => el.classList.add('offline'));
  tiles.on('tileload', () => el.classList.remove('offline'));
  map.fitBounds(L.latLngBounds(bounds).pad(0.25));
  setTimeout(() => map.invalidateSize(), 0);
  return { L, map };
};

// Monta una función asíncrona como `mount` de una pantalla, cancelando si se sale antes de terminar.
const lazyMount = (init) => (root) => {
  let dead = false, stop = () => {};
  Promise.resolve(init(root)).then((fn) => { if (typeof fn === 'function') { if (dead) fn(); else stop = fn; } })
    .catch(() => { const m = root.querySelector('.lmap'); if (m) { m.classList.add('nomap'); m.textContent = 'No se pudo cargar el mapa interactivo.'; } });
  return () => { dead = true; stop(); };
};

// ---- Radar de ambulancias (banco de sangre) ---------------------------------
export const fleetMount = lazyMount(async (root) => {
  const el = root.querySelector('#fleetMap');
  if (!el) return null;
  const hosp = hospitalLL('Hospital General'), path = routePath(BANK.ll, hosp);
  const pos = (u) => (u.progress != null ? pointAt(path, u.progress) : u.ll);
  const { L, map } = await baseMap(el, [BANK.ll, hosp, ...FLEET.map(pos)]);
  L.polyline(path, { color: '#175cd3', weight: 4, opacity: 0.85, dashArray: '8 8' }).addTo(map);
  L.marker(BANK.ll, { icon: pin(L, 'bank', 'Banco', 'drop'), title: BANK.name, alt: BANK.name }).addTo(map).bindPopup(`<b>${BANK.name}</b><br>Cámaras frigoríficas · origen`);
  L.marker(hosp, { icon: pin(L, 'hosp', 'Hosp. General', 'hospital'), title: 'Hospital General', alt: 'Hospital General' }).addTo(map).bindPopup('<b>Hospital General</b><br>Destino de la solicitud ST-2048');
  const marks = {};
  FLEET.forEach((u) => {
    marks[u.id] = L.marker(pos(u), { icon: pin(L, KIND[u.state], u.id, 'truck'), title: `${u.id} · ${u.state}`, alt: `${u.id}, ${u.state}` })
      .addTo(map).bindPopup(`<b>${u.id}</b> · ${u.state}<br>Chofer: ${u.driver}${u.info ? `<br>${u.info}` : ''}`);
  });
  let p = FLEET.find((u) => u.progress != null).progress;
  const timer = setInterval(() => { p = p >= 0.95 ? 0.05 : p + 0.02; marks['AMB-022'].setLatLng(pointAt(path, p)); }, 1500);
  const onClick = (e) => {
    const b = e.target.closest('[data-amb]');
    if (!b || !marks[b.dataset.amb]) return;
    map.flyTo(marks[b.dataset.amb].getLatLng(), 15, { duration: 0.8 });
    marks[b.dataset.amb].openPopup();
    el.focus({ preventScroll: true });
  };
  root.addEventListener('click', onClick);
  return () => { clearInterval(timer); root.removeEventListener('click', onClick); map.remove(); };
});

// ---- Ruta en curso (transportista) -----------------------------------------
// Devuelve { setProgress(0-100), destroy() } de forma síncrona; el mapa se crea cuando Leaflet termina de cargar.
export const mountTripMap = (root, trip) => {
  const el = root.querySelector('#tripMap');
  let api = null, dead = false, pct = 45;
  if (el) {
    const a = placeLL(trip.origin), b = placeLL(trip.dest), path = routePath(a, b);
    baseMap(el, [a, b]).then(({ L, map }) => {
      if (dead) { map.remove(); return; }
      L.polyline(path, { color: '#175cd3', weight: 5, opacity: 0.85 }).addTo(map);
      L.marker(a, { icon: pin(L, 'bank', 'Origen', 'drop'), title: trip.origin, alt: `Origen: ${trip.origin}` }).addTo(map).bindPopup(`<b>Origen</b><br>${trip.origin}`);
      L.marker(b, { icon: pin(L, 'hosp', 'Destino', 'hospital'), title: trip.dest, alt: `Destino: ${trip.dest}` }).addTo(map).bindPopup(`<b>Destino</b><br>${trip.dest}`);
      const veh = L.marker(pointAt(path, pct / 100), { icon: pin(L, 'warn', trip.id, 'truck'), title: `Unidad en ruta ${trip.id}`, alt: `Unidad en ruta ${trip.id}`, zIndexOffset: 500 }).addTo(map);
      api = { move: (v) => veh.setLatLng(pointAt(path, v / 100)), destroy: () => map.remove() };
    }).catch(() => { el.classList.add('nomap'); el.textContent = 'No se pudo cargar el mapa interactivo.'; });
  }
  return {
    setProgress(v) { pct = v; api?.move(v); },
    destroy() { dead = true; api?.destroy(); },
  };
};
