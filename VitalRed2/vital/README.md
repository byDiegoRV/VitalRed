# VitalRed — Versión 3 (Prototipo funcional)

Plataforma web/móvil para gestión de emergencias transfusionales y logística biológica (Código Rojo). Prototipo **100 % frontend**: la autenticación, los roles, las solicitudes, el pre-triaje, las citas y la telemetría se simulan con estado local (`localStorage`).

## Tecnologías
Node.js + Express (servidor estático) · JavaScript ES Modules (SPA con router por hash) · CSS propio con variables (modo claro/oscuro) · sin librerías de UI.

## Requisitos e instalación
Node.js 18 o superior.
```bash
npm install
npm start      # http://localhost:3000
```

## Credenciales de prueba (el rol se identifica automáticamente)
| Rol | Correo | Contraseña |
|---|---|---|
| Donante Voluntario | donante@vitalred.org | Donante123 |
| Personal Médico | medico@vitalred.org | Medico123 |
| Transportista Sanitario | transporte@vitalred.org | Transp123 |
| Banco de Sangre | banco@vitalred.org | Banco123 |

Registro de donante (contraseña: mínimo 8 caracteres, mayúscula, minúscula, número y carácter especial, con confirmación): asistente de 4 pasos (cuenta → perfil → control de salud → confirmación), con retroceso y respuestas conservadas. Registro institucional: el rol se asigna por el folio (`MED-…`, `TRA-…`, `BAN-…`).

## Funcionalidades
- Login sin selección manual de rol, validaciones, estados de error y carga; cierre de sesión.
- **Donante:** perfil, alerta Código Rojo, pre-triaje (radios) con revisión y corrección, agenda, pase QR, donación y **constancia PDF**.
- **Médico:** dashboard con filtros, nueva solicitud, radar con stepper, cancelación con deshacer, recepción con firma, estado sin respuesta.
- **Transportista:** inicio con el viaje a cargo (origen → destino), custodia, tránsito con telemetría, entrega firmada, últimos recorridos y perfil.
- **Banco:** dashboard con matriz de stock, citas con validación QR, radar de ambulancias, reportes de trazabilidad.
- Modo claro/oscuro, diseño responsive (móvil, tablet, laptop, escritorio).

## PDF del donante
Donante → completar donación → **Descargar justificante** → *Imprimir / Guardar como PDF* (el navegador abre el diálogo de impresión; elige "Guardar como PDF"). Los estilos `@media print` ocultan la interfaz y dejan solo el documento.

## Estructura
```
public/
  index.html
  css/styles.css        Tokens, tema, componentes, responsive e impresión
  js/store.js           Estado persistente y datos semilla
  js/ui.js              Componentes reutilizables
  js/screens.js         Pantallas de médico (radar, recepción) y banco
  js/screens-transport.js  Viaje, custodia, tránsito, recorridos y perfiles
  js/screens-ui.js      Pantallas según mockups (donante, médico, banco)
  js/screens-flow.js    Registro por pasos, pre-triaje, agenda, PDF
  js/maps.js            Mapas interactivos (Leaflet) y cálculo de rutas reales (Leaflet Routing Machine)
  js/flow.js            Guardas de navegación: qué pantallas son accesibles según el paso del flujo
  js/domain.js          Reglas compartidas entre perfiles: compatibilidad ABO/Rh, casos, historial y ciclo de la solicitud
  js/app.js             Router con guardas por rol, acciones y formularios
  vendor/leaflet/       Leaflet 1.9.4 incluido en el proyecto (licencia BSD-2)
  vendor/leaflet-routing-machine/  Plugin de rutas 3.2.12 (licencia ISC)
server.js
```

## Mapas interactivos
El **Radar de Ambulancias** (banco) y la **Ruta en curso** (transportista) usan [Leaflet](https://leafletjs.com) con mosaicos de OpenStreetMap. Se puede hacer zoom, mover el mapa, abrir el detalle de cada unidad y, en el radar, pulsar **Ver en mapa** para centrar una ambulancia. Los mosaicos y las rutas necesitan Internet: la ruta se calcula por calles con el plugin Leaflet Routing Machine usando el servicio público OSRM (datos de OpenStreetMap), de donde salen la distancia y el tiempo mostrados. Sin conexión se dibuja una ruta simulada y la pantalla lo avisa. El servidor público de OSRM es solo para demostración (máximo ~1 petición por segundo); para uso real conviene alojar tu propio OSRM y cambiar `OSRM` en `js/maps.js`. Las coordenadas (ficticias) están al inicio de `js/maps.js`: cámbialas para ubicar la demo en otra ciudad.

## Navegación y confirmaciones
- **Guardas de flujo** (`js/flow.js`): no se puede abrir una pantalla que ya no corresponde (por ejemplo, volver al pre-triaje tras confirmarlo, o a la ruta de un viaje ya entregado). Se redirige a la pantalla correcta con un aviso. Una dirección inexistente muestra la pantalla 404 a los usuarios con sesión.
- **Confirmaciones**: las acciones críticas (lanzar Código Rojo, forzar una asignación, iniciar una campaña, finalizar una entrega, etc.) abren una ventana de confirmación; las más delicadas exigen marcar *Estoy consciente de…*. La ventana es accesible (foco atrapado, Esc cierra).
- Banco: Forzar asignación, campaña de alerta (visible para los donantes), reservas de inventario y exportación real a CSV/PDF.

## Flujo continuo entre perfiles (sin backend)
Todos los perfiles comparten los datos en el navegador (`localStorage`), así que una acción de un perfil se refleja en los demás al iniciar sesión con ellos:
1. **Médico** crea la solicitud (hospital destino, hemocomponente, área, grupo, unidades, prioridad). Se notifica a los donantes **compatibles** registrados.
2. **Donante** compatible la ve, acepta, hace el pre-triaje y agenda (o pulsa *Ya no puedo donar* y la búsqueda se reanuda). El médico ve las etapas **Esperando** y **Programada**.
3. **Banco** ve la solicitud y la cita, autoriza el ingreso, **registra la donación** (queda en el historial del donante) y **despacha la unidad**.
4. **Transportista** recibe el viaje hacia el hospital que la pidió, con ruta real, y entrega.
5. **Médico** ve **Completada** con el seguimiento de la unidad, confirma la recepción y cierra el caso.

Para demostraciones con un solo perfil, el médico puede usar los botones *Simular* del radar. *Recibir alerta de demostración* (donante) rota entre casos con distintos hospitales, grupos y hemocomponentes.

## Sesión y registro
- La sesión es **por pestaña** y la app **siempre abre en el login** (cada `npm start` y cada apertura nueva); recargar con F5 conserva la sesión.
- Solo puede haber **un perfil activo por navegador**: otra pestaña no puede iniciar sesión mientras exista una sesión viva.
- El registro empieza siempre vacío, normaliza el correo y no permite correos repetidos (sin distinguir mayúsculas). Los datos médicos del registro se guardan y se editan en *Mis datos médicos*.

## Accesibilidad
Los colores de texto cumplen WCAG 2.1 AA (contraste 4.5:1) en tema claro y oscuro, y las pantallas se revisaron con axe-core. Ver `docs/evidencia-ronda2/`.

## Consideraciones
El pre-triaje es una simulación de preselección y **no sustituye una evaluación médica**. Botón "Reiniciar demo" en el pie para limpiar datos.
