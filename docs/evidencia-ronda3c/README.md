# Evidencia ronda 3c: asignación real, evaluación del banco, detalle de solicitudes y horas reales

| Verificación | Resultado |
|---|---|
| Flujo completo (paciente -> donante -> banco que **deniega** -> segundo donante -> banco que **aprueba** y despacha -> transportista -> médico, más un segundo caso con otro destino) | **59 de 59** correctas |
| axe-core durante ese flujo, incluidas las ventanas de confirmación (claro/escritorio y oscuro/móvil) | **0 incidencias** |
| axe-core en todas las rutas (incluye `b/records`, `b/record`, `b/evaluate`, `b/deny`, `m/detail`) | **0 incidencias** |
| Pruebas vigentes de banco, cursor y rutas | **23 de 23** correctas |
| Login `main` vs rama (claro/oscuro × móvil/escritorio) | **Idéntico** (píxeles y HTML) |

Nota: las rutas usan una respuesta simulada del servicio OSRM (el entorno de pruebas no tiene Internet).
