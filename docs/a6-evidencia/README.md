# Evidencia A6: accesibilidad (axe-core 4.x, reglas WCAG 2.0/2.1 A y AA)

Mismas pantallas y condiciones antes y después: viewport 414x896, tema oscuro (donde aparecieron las incidencias reportadas con axe DevTools) y claro.

| Pantalla | Antes (oscuro) | Después (oscuro) |
|---|---|---|
| Login `/` | 2 | 0 |
| Pre-triaje `#/d/triage` | 1 | 0 |
| Dashboard banco `#/b/dash` | 7 | 0 |
| **Total** | **10** | **0** |

- Salida completa: `axe-antes.txt` y `axe-despues.txt` (incluye tema claro).
- Reproducir: `node server.js` y `python3 audit-axe.py <puerto> <etiqueta>` (requiere playwright y axe-core).
- Capturas: `antes-*.png` / `despues-*.png`.

## Pendiente (no incluido en esta rama)
Tema claro: `.badge.ok`, `.badge.warn` (1.98–2.2) y `.banner` en pre-triaje (3.89) siguen por debajo de 4.5:1.
