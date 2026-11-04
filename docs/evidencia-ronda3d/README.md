# Evidencia ronda 3d: viajes disponibles para el transportista

| Verificación | Resultado |
|---|---|
| Flujo completo, ahora con **viajes disponibles -> tomar viaje -> asignado -> en ruta -> entregado** (`flujo-continuo-y-axe.py`) | **66 de 66** correctas |
| axe-core durante ese flujo (claro/oscuro × móvil/escritorio, con ventanas de confirmación) | **0 incidencias** en las 4 combinaciones |
| axe-core en todas las rutas (4 roles, claro/oscuro, móvil/escritorio) | **0 incidencias** |
| Limpieza de datos heredados (viaje de ejemplo `TR-9902` e historial "Hoy • 22 min") | Verificada |
| Pruebas vigentes de banco, cursor y rutas | **23 de 23** correctas |
| Login `main` vs rama | **Idéntico** (píxeles y HTML) |

Qué cambia: el banco ya no asigna el viaje directo; lo **publica** y el transportista lo ve en *Viajes disponibles* con su resumen y lo toma. El médico ve cada etapa (despachada, transportista asignado, en ruta, entregada) y puede terminar el proceso en la recepción.

Nota: las rutas usan una respuesta simulada del servicio OSRM (el entorno de pruebas no tiene Internet).
