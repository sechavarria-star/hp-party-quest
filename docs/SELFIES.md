# Selfies

La foto es opcional. El participante puede tomarla desde el celular o elegir una imagen. El navegador muestra una vista previa cuadrada y la prepara como JPG de hasta 480 × 480 píxeles, sin transferir la imagen original.

Se pide consentimiento específico para guardar la foto y mostrarla a participantes registrados que escaneen ese QR. El pase incluye una opción para agregar o cambiar la selfie después del registro sin emitir otra identidad ni modificar el QR.

La base privada incorpora la hoja Selfies. Las fotos se guardan como JPG codificado, repartido en fragmentos de hasta 40.000 caracteres por celda, con fecha de consentimiento y actualización. El límite del servidor es 120 KiB y 1024 × 1024 píxeles. No se crean enlaces públicos de imágenes ni se requieren permisos de Google Drive.

La consulta de candidato incluye foto solo si la solicitud presenta una sesión activa. Sin sesión se muestran las iniciales y la invitación a registrarse. Los archivos, URLs o IDs de otro participante enviados por el cliente no permiten elegir qué foto actualizar: siempre se toma la identidad de la sesión.

Los participantes que no agreguen foto conservan sus iniciales como alternativa. La app no realiza reconocimiento facial ni usa la foto para autenticar identidad.

## Verificación

Pruebas del servidor: consentimiento, JPG y tamaño, fragmentos en varias celdas, acceso anónimo o sesión inválida, reemplazo propio y separación de QR/sesión.

Pruebas móviles locales: selección de foto, consentimiento, registro, actualización posterior, nombre personalizado, foto visible al votante y oculta al visitante no registrado.

La captura con cámara y el escaneo entre celulares reales se validan por separado. Para la aceptación se usa una consigna QA temporal que no altera el estado de la consigna real y cuyos votos quedan identificados por otro ChallengeID.
