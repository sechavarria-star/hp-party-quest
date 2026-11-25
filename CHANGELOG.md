# Changelog

## 2.2.5 — 2026-11-25

- Columna «Selfie» con enlaces «Ver selfie» en el ranking de Dashboard.
- Winners incorpora SelfieURL y actualiza los enlaces para los participantes cargados sin modificar posiciones, votos ni confirmaciones.
- Visor de foto con nombre y descarga JPG, con el acceso existente del juego. El enlace muestra la última foto guardada.

## 2.2.4 — 2026-11-25

- Dashboard ahora calcula participantes activos, votos válidos, votantes, participación y ranking desde los datos reales.
- Se actualiza al votar, registrarse y al inicializar el servicio; incluye los votos existentes.
- Los empates comparten posición. Un fallo del panel no convierte un voto guardado en un error.
- El inicializador respeta Dashboard como hoja de presentación y conserva su ancho y título combinado.

## 2.2.3 — 2026-11-25

- Por pedido del organizador, el regreso al pase usa solo el email registrado, sin códigos ni correos de confirmación. Conocer ese email permite abrir su pase.
- Conserva el participante, QR, selfie y votos. No duplica registros ni cambia las reglas de votación.
- Se retira el envío de correo del código y de los permisos solicitados.

## 2.2.2 — 2026-11-25

- Recuperación por email con código de seis dígitos, vigencia de 10 minutos y un solo uso.
- Conserva participante, QR, selfie y votos. Solo se crea una sesión nueva al validar el código.
- Cinco intentos por código, reenvío cada 60 segundos, tres envíos por email por hora y límite global.
- Respuesta genérica al solicitar el código para no revelar si un email está registrado.
- Permiso de Google limitado a enviar correo, además del acceso existente a Sheets.

## Corrección de acceso — 2026-11-25

- Una sesión rechazada ofrece descartar explícitamente el acceso local anterior y volver al registro.
- Los errores de conexión conservan el acceso y no muestran esa opción. No se alteran participantes, QR ni votos del servidor; se mantiene la protección contra emails duplicados.

## 2.2.1 — 2026-11-24

- Pase personal PNG de 1080 × 1350 con opción de compartir como archivo de imagen y alternativa de descarga.
- Imagen preparada antes de tocar el botón para conservar el permiso de compartir del celular; cancelar no descarga nada.

- Selfie obligatoria para completar el registro, con validación en cliente y servidor.
- Los registros anteriores sin foto deben completarla desde su pase para votar y recibir votos.
- Se conserva la identidad y el QR de los participantes existentes.

## 2.2.0 — 2026-11-24

- Selfie opcional al registrarse, con vista previa, recorte cuadrado y compresión local.
- Participantes ya registrados pueden agregar o reemplazar su foto sin cambiar su QR.
- Confirmación personalizada con el nombre del votante y la foto del candidato.
- Fotos en la hoja privada Selfies, separadas en celdas de tamaño limitado; el QR no contiene la foto.
- El backend entrega fotos solo a sesiones activas y actualiza únicamente la del participante autenticado.
- Consigna temporal de aceptación separada, autorizada por el organizador, con restauración de la consigna previa al cerrar o vencer.

## 2.1.1 — 2026-11-20

### Identidad visual actualizada el 21/11/2026

- Logo HP de la cartelera en lugar de la imitación tipográfica.
- Kick Off '27 reemplaza las menciones visibles de Party en la interfaz y el pase descargable.

- Se bloquea la emisión de sesiones por email duplicado y se normalizan emails importados.
- La sesión del navegador se conserva ante errores de conexión.
- Se controla cualquier voto válido previo, incluso si hay filas invalidadas.
- Bootstrap en caché para evitar formatear ocho hojas en cada operación.
- Las celdas combinadas del dashboard no bloquean el inicio si no permiten inmovilizar encabezados.
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
