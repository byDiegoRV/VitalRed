# Evidencia ronda 2: accesibilidad, responsive, mapas y bitácora

Auditoría con axe-core (reglas WCAG 2.0/2.1 A y AA) sobre **27 rutas de los 4 roles**, en tema claro y oscuro, móvil (414×896) y escritorio (1440×900), más detección de desbordamiento horizontal.

| Métrica | Antes (`main`) | Después (esta rama) |
|---|---|---|
| Hallazgos de axe (ruta × tema × vista) | 262 | **0** |
| Páginas con scroll horizontal en móvil | 2 (`b/appts` 521 px, `b/reports` 689 px) | **0** |
| Bitácora PDF | 2 páginas, fotos rotas | **1 página A4**, fotos, QR y firmas |
| Formulario *Nueva solicitud* | No habilitaba "Lanzar" (evento `selchange` nunca se disparaba) | Funciona |
| Mapas | Recuadro de texto | Leaflet interactivo (radar y ruta en curso) |

Archivos: `antes-*` / `despues-*` (capturas y PDF), `audit-axe-completa.py` y `capturas-antes-despues.py` (scripts de reproducción; requieren Playwright y axe-core).
