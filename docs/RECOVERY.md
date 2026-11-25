# Volver al pase con el email

Por pedido expreso del organizador para este evento de empleados, se usa acceso directo con el email registrado, sin comprobar la casilla ni enviar códigos o enlaces. Conocer el email de un participante activo permite abrir su pase. No debe describirse como identidad verificada ni como protección frente a suplantación por quien conozca ese email.

Desde «Ya me registré · Abrir mi pase» o «Volver a mi pase», la persona ingresa su email y vuelve al mismo participante, QR, foto y votos. Se normaliza el email y se busca un único participante activo; no se crea un registro ni se acepta un ParticipantID enviado por el cliente. Se emite una sesión nueva con la duración configurada. Los votos siguen vinculados al mismo participante y mantienen sus controles de duplicados y autovoto. La selfie sigue siendo obligatoria.

No se envían correos y el código ya no solicita el permiso de envío. La autorización anteriormente concedida en Google no se revoca automáticamente. Los accesos anteriores válidos siguen funcionando.

Validación: tests/recovery.mjs comprueba retorno sin código, identidad/QR/foto/votos conservados, ausencia de envío de correo, email inexistente e inactivo. tests/mobile-flow.mjs comprueba el retorno desde otro navegador y persistencia.
