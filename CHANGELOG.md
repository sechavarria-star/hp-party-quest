# Changelog

## 2.1.1 — 2026-11-20

- Se bloquea la emisión de sesiones por email duplicado y se normalizan emails importados.
- La sesión del navegador se conserva ante errores de conexión.
- Se controla cualquier voto válido previo, incluso si hay filas invalidadas.
- Bootstrap en caché para evitar formatear ocho hojas en cada operación.
- La URL del frontend ya no puede establecerse con un dominio arbitrario desde health.
- Pruebas de seguridad y flujo con dos navegadores móviles aislados.
- Publicación con autenticación local; GitHub Actions publica solo el frontend después de comprobar el backend.

## 2.1.0 — 2026-11-20

- Agregado bootstrap idempotente desde el endpoint `health`; ya no hace falta ejecutar `setupProject()` manualmente.
- Agregado pipeline único para Apps Script + GitHub Pages + verificación live.
- La configuración cruzada de URLs se completa durante el despliegue, sin editar archivos.
- El workflow rechaza placeholders y no publica el frontend si el backend no responde correctamente.

## 2.0.1 — 2026-11-20

- Corregido `setupProject()` para la planilla existente con tablas nativas de Google Sheets.
- Eliminada la creación de filtros básicos que se superponían con las tablas y producían el error “You can’t apply a filter to a range that partially intersects a table”.
- Conservados los filtros propios de cada tabla.
- Agregada una prueba de regresión que ejecuta dos veces el setup contra hojas simuladas con tablas y falla si se reintroduce `createFilter()`.

## 2.0.0

- MVP inicial de registro, identidad QR, sesión persistente y voto único.
