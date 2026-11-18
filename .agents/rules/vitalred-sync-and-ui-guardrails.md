---
trigger: always_on
---
# Invariantes de UI, Mapas y Sincronización Multi-Rol (VitalRed v3)

1. **Aislamiento de Mapas Leaflet y Jerarquía de Capas (`styles.css`):**
   - Todo contenedor de mapa (`.lmap`) debe mantener `position: relative; z-index: 0; isolation: isolate;` para confinar los panes internos de Leaflet (`z-index: 200..1000`).
   - `.modal` debe mantenerse en `z-index >= 2000` y `#toasts` en `z-index >= 2100`.
   - Prohibido eliminar o renombrar las clases de marcadores de flota usadas por `maps.js` y `screens-ui.js`: `.pin-wrap`, `.pin`, `.pin-bank`, `.pin-hosp`, `.pin-ok`, `.pin-warn`, `.pin-asg`, `.pin-off`, `.pin-lbl`, `.legend`, `.pin-dot`.

2. **Seguridad de Navegación Móvil y Viewport:**
   - Contención horizontal global (`html, body { overflow-x: hidden; max-width: 100%; }`) y compensación en `footer` cuando hay barra inferior `.tabs` activa (`body[data-role]:not([data-role=guest]) footer`).
   - Ningún CTA principal o secundario de flujo (p. ej. "Cancelar Cita" en `d/qr`) debe quedar oculto bajo `.tabs` en viewports de `360px` a `430px`.

3. **Cascada Multi-Rol y Reconciliación en Tiempo Real (`store.js`, `domain.js`, `app.js`, `firebase-sync.js`):**
   - Al autorizar/aprobar una donación en Banco (`actions.authorize`, `actions.approveDonation`), actualizar la cita (`appts`), vincular la requisición médica tanto por correo como por `appt.id` y despachar la unidad (`dispatchUnit`) si corresponde.
   - Al aplicar `set({ appts })` (local o remoto), reconciliar `state.myAppt` si coincide por `id` o correo normalizado (`normEmail`).
   - Un snapshot remoto con `trip: null` no debe borrar un `state.trip` activo en sesiones con rol `transport`.
