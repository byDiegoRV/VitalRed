# Evidencia ronda 3b: flujo continuo, sesión única, registro e historial

| Verificación | Resultado |
|---|---|
| Flujo completo médico -> donante -> banco -> transportista -> médico (`flujo-continuo-y-axe.py`) | **59 de 59** correctas |
| axe-core durante ese flujo, incluidas las ventanas de confirmación (claro/escritorio y oscuro/móvil) | **0 incidencias** |
| axe-core en todas las rutas (4 roles, claro/oscuro, móvil/escritorio, incluye `d/history` y `d/medical`) | **0 incidencias** |
| Pruebas vigentes de banco, cursor y rutas (`pruebas-banco-cursor-rutas.py`) | **23 de 23** correctas |
| Login `main` vs rama (claro/oscuro × móvil/escritorio) | **Idéntico** (píxeles y HTML) |

## Qué cubre el flujo
Arranque siempre en login, un solo perfil activo, registro sin datos previos ni correos repetidos, solicitud con hospital/hemocomponente/área, notificados = donantes compatibles, arrepentimiento del donante, guardas al forzar URLs en cada etapa, ventanas *Cita programada* y *Donación completada*, registro de la donación por el banco, despacho, entrega con ruta, recepción del médico, historial del donante y casos de demostración distintos.

Nota: las rutas usan una respuesta simulada del servicio OSRM (el entorno de pruebas no tiene Internet).
