// Mapas interactivos de VitalRed (Leaflet + Leaflet Routing Machine, incluidos en /vendor).
// Las rutas se calculan con el servicio OSRM (datos de OpenStreetMap): distancia y tiempo son reales.
// Sin conexión se usa una ruta simulada y se avisa en pantalla.
// Las coordenadas son ficticias para la demo: cámbialas aquí para ubicar el prototipo en otra ciudad.
import { icon, esc } from './ui.js';
import { get } from './store.js';

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

const FLEET_BASE = [
  { id: 'AMB-017', driver: 'Pedro Páramo', state: 'Disponible', ll: [18.8418, -97.0932] },
  { id: 'AMB-022', driver: 'Laura Salinas', state: 'En tránsito', progress: 0.45 },
  { id: 'AMB-009', driver: 'Carlos Guzmán', state: 'Ocupada', ll: [18.8381, -97.1104] },
  { id: 'AMB-011', driver: 'M. Arrieta', state: 'Disponible', ll: [18.8547, -97.1077] },
];
// Estado efectivo de cada unidad (incluye las asignaciones forzadas desde el radar)
export const fleetUnits = () => FLEET_BASE.map((u) => { const f = (get().fleet || {})[u.id]; return f ? { ...u, state: f.state, req: f.req } : u; });
const KIND = { Disponible: 'ok', 'En tránsito': 'warn', Ocupada: 'off', Asignada: 'asg' };

// ---- geometría ---------------------------------------------------------------
const meters = ([la1, lo1], [la2, lo2]) => {
  const r = Math.PI / 180, dLa = (la2 - la1) * r, dLo = (lo2 - lo1) * r;
  const h = Math.sin(dLa / 2) ** 2 + Math.cos(la1 * r) * Math.cos(la2 * r) * Math.sin(dLo / 2) ** 2;
  return 12742000 * Math.asin(Math.sqrt(h));
};
// Recorrido sobre una polilínea: at(0..1) devuelve la posición a ese avance de la distancia total
const makeTrack = (pts) => {
  const cum = [0];
  for (let i = 1; i < pts.length; i++) cum.push(cum[i - 1] + meters(pts[i - 1], pts[i]));
  const total = cum[cum.length - 1] || 1;
  return {
    total,
    at(t) {
      const d = Math.min(1, Math.max(0, t)) * total;
      let i = 1; while (i < cum.length - 1 && cum[i] < d) i++;
      const seg = cum[i] - cum[i - 1] || 1, k = (d - cum[i - 1]) / seg, [a, b] = [pts[i - 1], pts[i]];
      return [a[0] + (b[0] - a[0]) * k, a[1] + (b[1] - a[1]) * k];
    },
  };
};
// Ruta simulada de respaldo (3 puntos intermedios para que no sea una recta)
const simulated = (a, b) => {
  const dLat = b[0] - a[0], dLon = b[1] - a[1];
  const at = (k, off) => [a[0] + dLat * k - dLon * off, a[1] + dLon * k + dLat * off];
  const coords = [a, at(0.25, 0.06), at(0.5, -0.05), at(0.75, 0.04), b];
  const km = coords.slice(1).reduce((s, p, i) => s + meters(coords[i], p), 0) / 1000;
  return { coords, km, min: (km / 30) * 60, real: false }; // 30 km/h urbano estimado
};

// ---- carga perezosa de Leaflet y del plugin de rutas -------------------------
const loadScript = (src) => new Promise((resolve, reject) => {
  const s = document.createElement('script');
  s.src = src; s.onload = resolve; s.onerror = () => reject(new Error(`No se pudo cargar ${src}`));
  document.head.append(s);
});
let ready = null, routing = null;
export const loadLeaflet = () => {
  if (window.L) return Promise.resolve(window.L);
  ready ||= new Promise((resolve, reject) => {
    const css = document.createElement('link');
    css.rel = 'stylesheet'; css.href = '/vendor/leaflet/leaflet.css';
    document.head.append(css);
    loadScript('/vendor/leaflet/leaflet.js').then(() => resolve(window.L), (e) => { ready = null; reject(e); });
  });
  return ready;
};
const loadRouting = async () => {
  const L = await loadLeaflet();
  if (!L.Routing) { routing ||= loadScript('/vendor/leaflet-routing-machine/leaflet-routing-machine.min.js').catch((e) => { routing = null; throw e; }); await routing; }
  return L;
};

const OSRM = 'https://router.project-osrm.org/route/v1';
// Calcula la ruta por calles con el plugin; si no hay conexión devuelve la simulada (real: false)
export const calcRoute = async (a, b) => {
  try {
    const L = await loadRouting();
    const router = L.Routing.osrmv1({ serviceUrl: OSRM, profile: 'driving', timeout: 8000, useHints: false, suppressDemoServerWarning: true });
    const r = await new Promise((resolve, reject) => router.route(
      [L.Routing.waypoint(L.latLng(a)), L.Routing.waypoint(L.latLng(b))],
      (err, routes) => (err || !routes?.length ? reject(err || new Error('Sin ruta')) : resolve(routes[0])), null, { geometryOnly: true },
    ));
    return { coords: r.coordinates.map((p) => [p.lat, p.lng]), km: r.summary.totalDistance / 1000, min: r.summary.totalTime / 60, real: true };
  } catch { return simulated(a, b); }
};
export const fmtKm = (km) => `${km.toFixed(1)} km`;
export const fmtMin = (m) => `${Math.max(1, Math.round(m))} min`;
const sleep = (ms) => new Promise((r) => setTimeout(r, ms));

const pin = (L, kind, label, ic) => L.divIcon({
  className: 'pin-wrap',
  html: `<span class="pin pin-${kind}">${icon(ic, 18)}</span><span class="pin-lbl">${esc(label)}</span>`,
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
  Promise.resolve(init(root, () => dead)).then((fn) => { if (typeof fn === 'function') { if (dead) fn(); else stop = fn; } })
    .catch(() => { const m = root.querySelector('.lmap'); if (m) { m.classList.add('nomap'); m.textContent = 'No se pudo cargar el mapa interactivo.'; } });
  return () => { dead = true; stop(); };
};

const srcText = (real) => (real ? 'Rutas calculadas por calles con OSRM (OpenStreetMap): distancia y tiempo reales.' : 'Sin conexión al servicio de rutas: se muestran rutas y tiempos estimados.');

// ---- Radar de ambulancias (banco de sangre) ---------------------------------
export const fleetMount = lazyMount(async (root, isDead) => {
  const el = root.querySelector('#fleetMap');
  if (!el) return null;
  const units = fleetUnits(), hosp = hospitalLL('Hospital General');
  const start = simulated(BANK.ll, hosp);
  let track = makeTrack(start.coords), main = start;
  const pos = (u) => (u.progress != null ? track.at(u.progress) : u.ll);
  const { L, map } = await baseMap(el, [BANK.ll, hosp, ...units.map(pos)]);
  if (isDead()) { map.remove(); return null; }
  L.marker(BANK.ll, { icon: pin(L, 'bank', 'Banco', 'drop'), title: BANK.name, alt: BANK.name }).addTo(map).bindPopup(`<b>${BANK.name}</b><br>Cámaras frigoríficas · origen`);
  L.marker(hosp, { icon: pin(L, 'hosp', 'Hosp. General', 'hospital'), title: 'Hospital General', alt: 'Hospital General' }).addTo(map).bindPopup('<b>Hospital General</b><br>Destino de la solicitud ST-2048');
  const info = {}, marks = {};
  const describe = (u) => {
    if (u.state === 'Asignada') return `Asignada a ${esc(u.req)}`;
    if (u.state === 'En tránsito' && main) return `ETA ${fmtMin(main.min * (1 - (u.progress ?? 0)))} al hospital`;
    const i = info[u.id]; return i ? `${fmtKm(i.km)} al banco · ETA ${fmtMin(i.min)}${i.real ? '' : ' (estimado)'}` : '';
  };
  const refresh = (u) => {
    const t = root.querySelector(`[data-info="${u.id}"]`), txt = describe(u) || (u.state === 'Disponible' ? 'Calculando ruta…' : ''); if (t) t.textContent = txt ? ` · ${txt}` : '';
    marks[u.id]?.setPopupContent(`<b>${u.id}</b> · ${u.state}<br>Chofer: ${esc(u.driver)}${describe(u) ? `<br>${describe(u)}` : ''}`);
  };
  units.forEach((u) => {
    marks[u.id] = L.marker(pos(u), { icon: pin(L, KIND[u.state], u.id, 'truck'), title: `${u.id} · ${u.state}`, alt: `${u.id}, ${u.state}` }).addTo(map).bindPopup('');
    refresh(u);
  });
  let line = null, pickup = null, timer = null;
  const mover = units.find((u) => u.progress != null);
  let p = mover?.progress ?? 0;
  const label = root.querySelector('#routeSrc');
  // 1) ruta principal banco -> hospital
  main = await calcRoute(BANK.ll, hosp);
  if (isDead()) { map.remove(); return null; }
  track = makeTrack(main.coords);
  line = L.polyline(main.coords, { color: '#175cd3', weight: 5, opacity: 0.85, dashArray: main.real ? null : '8 8' }).addTo(map);
  map.fitBounds(line.getBounds().pad(0.3));
  if (mover) { marks[mover.id].setLatLng(track.at(p)); refresh(mover); timer = setInterval(() => { p = p >= 0.95 ? 0.05 : p + 0.02; marks[mover.id].setLatLng(track.at(p)); refresh({ ...mover, progress: p }); }, 1500); }
  if (label) label.textContent = srcText(main.real);
  // 2) ruta de cada unidad disponible hacia el banco (una por segundo, según la política del servicio)
  (async () => {
    let real = main.real;
    for (const u of units.filter((x) => x.state === 'Disponible')) {
      await sleep(1100); if (isDead()) return;
      info[u.id] = await calcRoute(u.ll, BANK.ll); real = real && info[u.id].real;
      if (isDead()) return; refresh(u);
    }
    if (label && !isDead()) label.textContent = srcText(real);
  })();
  const onClick = (e) => {
    const b = e.target.closest('[data-amb]');
    if (!b || !marks[b.dataset.amb]) return;
    const u = units.find((x) => x.id === b.dataset.amb), i = info[u.id];
    pickup?.remove(); pickup = null;
    if (u.state === 'Disponible' && i) {
      pickup = L.polyline(i.coords, { color: '#067647', weight: 5, opacity: 0.9, dashArray: i.real ? null : '8 8' }).addTo(map);
      map.fitBounds(pickup.getBounds().pad(0.3));
    } else map.flyTo(marks[u.id].getLatLng(), 15, { duration: 0.8 });
    marks[u.id].openPopup();
    el.focus({ preventScroll: true });
  };
  root.addEventListener('click', onClick);
  return () => { clearInterval(timer); root.removeEventListener('click', onClick); map.remove(); };
});

// ---- Ruta en curso (transportista) -----------------------------------------
// Devuelve { setProgress(0-100), destroy() } de forma síncrona; onRoute recibe { km, min, real } al calcular la ruta.
export const mountTripMap = (root, trip, { onRoute } = {}) => {
  const el = root.querySelector('#tripMap');
  let api = null, dead = false, pct = 45;
  if (el) {
    const a = placeLL(trip.origin), b = placeLL(trip.dest);
    baseMap(el, [a, b]).then(async ({ L, map }) => {
      if (dead) { map.remove(); return; }
      L.marker(a, { icon: pin(L, 'bank', 'Origen', 'drop'), title: trip.origin, alt: `Origen: ${trip.origin}` }).addTo(map).bindPopup(`<b>Origen</b><br>${esc(trip.origin)}`);
      L.marker(b, { icon: pin(L, 'hosp', 'Destino', 'hospital'), title: trip.dest, alt: `Destino: ${trip.dest}` }).addTo(map).bindPopup(`<b>Destino</b><br>${esc(trip.dest)}`);
      api = { move() {}, destroy: () => map.remove() };
      const r = await calcRoute(a, b);
      if (dead) return;
      const track = makeTrack(r.coords);
      const line = L.polyline(r.coords, { color: '#175cd3', weight: 5, opacity: 0.85, dashArray: r.real ? null : '8 8' }).addTo(map);
      map.fitBounds(line.getBounds().pad(0.25));
      const veh = L.marker(track.at(pct / 100), { icon: pin(L, 'warn', trip.id, 'truck'), title: `Unidad en ruta ${trip.id}`, alt: `Unidad en ruta ${trip.id}`, zIndexOffset: 500 }).addTo(map);
      api.move = (v) => veh.setLatLng(track.at(v / 100));
      onRoute?.(r);
    }).catch(() => { el.classList.add('nomap'); el.textContent = 'No se pudo cargar el mapa interactivo.'; });
  }
  return {
    setProgress(v) { pct = v; api?.move(v); },
    destroy() { dead = true; api?.destroy(); },
  };
};
