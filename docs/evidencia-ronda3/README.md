# Evidencia ronda 3: navegación, confirmaciones, rutas reales y acciones del banco

| Verificación | Resultado |
|---|---|
| Auditoría axe-core (27 rutas, 4 roles, claro/oscuro, móvil/escritorio) | **0 incidencias** |
| Auditoría axe-core de estados nuevos (ventanas de confirmación abiertas, 404, campaña, unidad asignada, reservas, impresión, tránsito, registro con reglas cumplidas, pre-triaje con respuestas) | **0 incidencias** |
| Pruebas funcionales (`pruebas-funcionales.py`) | **78 de 78** correctas |
| Login `main` vs rama (claro/oscuro × móvil/escritorio) | **Idéntico** (píxeles y HTML) |

## Qué cubren las pruebas funcionales
- Guardas de flujo del donante, médico y transportista (también tras terminar el flujo).
- Confirmaciones: el botón queda deshabilitado hasta marcar *Estoy consciente*, Esc cierra, "Volver" pide confirmación.
- Pantalla 404 y cursor (flecha en texto, mano en botones; el login conserva el suyo).
- Banco: campaña visible para el donante, reservas que cambian el inventario, Exportar CSV (descarga real) y PDF (hoja de impresión), forzar y liberar unidades.
- Rutas: distancia y tiempo del radar y de la ruta en curso salen del plugin de rutas y se guardan en el viaje.

## Nota sobre las rutas
El entorno donde se generó esta evidencia no tiene Internet, así que las pruebas y capturas de rutas usan una **respuesta simulada del servicio OSRM** (mismo formato) para ejercitar el código del plugin. El comportamiento con el servidor público real debe comprobarse en un navegador con conexión.

Archivos: capturas `*.png` y scripts de reproducción (requieren Playwright y axe-core).
