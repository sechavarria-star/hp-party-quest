# Recuperación de acceso por email

Desde el registro o una pantalla de error se puede abrir «Recuperar mi pase por email». La persona solicita un código al email del registro, lo ingresa en el mismo formulario y recupera su participante existente. No se crea otro participante ni se modifican QR, foto o votos. Una sesión anterior válida sigue funcionando; pedir un código no inicia sesión.

El código tiene seis dígitos, vence a los diez minutos y se consume antes de crear la sesión. Se almacena solamente su hash, vinculado al email normalizado y a un identificador aleatorio de solicitud. Se permiten cinco intentos, un envío por minuto, tres envíos por email por hora y hasta cien envíos globales por hora, sujetos además a la cuota de Google. Solicitar otro código reemplaza el anterior; una solicitud limitada conserva el desafío vigente. Los emails inexistentes reciben el mismo formato y mensaje genérico, sin correo.

El envío usa MailApp desde la cuenta que despliega el backend. La autorización de Google requiere acceso a Sheets (ya utilizado) y el permiso script.send_mail. No se solicita lectura de Gmail. Antes de actualizar el despliegue público, el propietario debe ejecutar authorizeRecoveryEmail desde el editor de Apps Script y conceder el nuevo permiso. Esa función consulta la cuota y no envía correos. La versión pública anterior debe seguir activa hasta completar la autorización.

No hay una ruta pública para emitir accesos de administrador. Ni el email solo, ni el QR público permiten recuperar una sesión. El código y su contenido no se registran en auditoría ni se devuelven al navegador. Los errores de entrega se auditan sin contenido ni direcciones. La llegada a correo corporativo y la recuperación final en iPhone/Android requieren validación real; filtros de correo y cuotas pueden afectar la entrega.

Validación local: tests/recovery.mjs cubre código incorrecto, vinculación, repetición, vencimiento, límites, entrega fallida e identidad conservada. tests/mobile-flow.mjs cubre solicitud y verificación desde otro navegador, regreso a la persona escaneada y persistencia de la nueva sesión. Los tests usan un correo simulado; no envían mensajes.

El helper privado inspectRecoveryDelivery se ejecuta solo desde el editor y muestra totales, eventos de envío y cuota, sin códigos, emails ni tokens. Un envío aceptado por Google no confirma entrega en la bandeja del destinatario.
