# Validación 2.1.1

Probado localmente el 20/11/2026:

- Backend real ejecutado con servicios de almacenamiento simulados.
- Email duplicado (incluyendo mayúsculas y espacios) no crea sesión ni participante.
- QR público y sesión ajena no recuperan una identidad.
- Votante tomado de la sesión aunque se envíe un ID ajeno.
- Rechazo de auto-voto, voto repetido, sesión vencida, dominio no permitido y challenge cerrado.
- Compatibilidad e idempotencia del setup sobre tablas nativas.
- Dos contextos móviles independientes (390x844 y 412x915): registro, dibujo del QR, candidato y confirmación de voto.
- Persistencia de la credencial local cuando falla la conexión.

No confundir estas pruebas con dos teléfonos físicos: el escaneo óptico y los resultados en la planilla publicada deben confirmarse después del despliegue.

El reporte QA-REPORT.md y sus capturas pertenecen al paquete original 2.1.0.
