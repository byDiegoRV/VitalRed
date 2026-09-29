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
  js/app.js             Router con guardas por rol, acciones y formularios
server.js
```

## Consideraciones
El pre-triaje es una simulación de preselección y **no sustituye una evaluación médica**. Botón "Reiniciar demo" en el pie para limpiar datos.
