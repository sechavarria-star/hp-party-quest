# Selfies

La foto es obligatoria para registrarse, votar y recibir votos. El participante puede tomarla desde el celular o elegir una imagen. El navegador muestra una vista previa cuadrada y la prepara como JPG de hasta 480 × 480 píxeles, sin transferir la imagen original.

Se pide consentimiento específico para guardar la foto y mostrarla a participantes registrados que escaneen ese QR. El pase incluye una opción para agregar o cambiar la selfie después del registro sin emitir otra identidad ni modificar el QR.

La base privada incorpora la hoja Selfies. Las fotos se guardan como JPG codificado, repartido en fragmentos de hasta 40.000 caracteres por celda, con fecha de consentimiento y actualización. El límite del servidor es 120 KiB y 1024 × 1024 píxeles. No se crean enlaces públicos de imágenes ni se requieren permisos de Google Drive.

La consulta de candidato incluye foto solo si la solicitud presenta una sesión activa. Sin sesión se muestran las iniciales y la invitación a registrarse. Los archivos, URLs o IDs de otro participante enviados por el cliente no permiten elegir qué foto actualizar: siempre se toma la identidad de la sesión.

Los registros anteriores sin foto deben completarla desde su pase; hasta entonces no se habilita el QR y el servidor impide votar o recibir votos. La identidad y el QR original se conservan al guardar la foto. La app no realiza reconocimiento facial ni usa la foto para autenticar identidad.

## Verificación

Pruebas del servidor: consentimiento, JPG y tamaño, fragmentos en varias celdas, acceso anónimo o sesión inválida, reemplazo propio y separación de QR/sesión.

Pruebas móviles locales: selección de foto, consentimiento, registro, actualización posterior, nombre personalizado, foto visible al votante y oculta al visitante no registrado.

La captura con cámara y el escaneo entre celulares reales se validan por separado. Para la aceptación se usa una consigna QA temporal que no altera el estado de la consigna real y cuyos votos quedan identificados por otro ChallengeID.

## Guardar el pase personal

El botón «Guardar mi QR como foto» prepara un PNG del pase con el QR original. Usa el menú nativo de compartir archivos cuando el navegador lo admite. La persona elige Guardar imagen/Fotos o una aplicación disponible; la web no puede escribir automáticamente en la galería. Si no está disponible o falla, muestra la imagen para mantener presionada y una descarga PNG explícita. En Android una descarga puede quedar en Descargas según el navegador. Cancelar el menú no inicia descargas.

Validado en navegadores móviles emulados: archivo PNG, dimensiones, QR decodificado, cancelación y alternativa de descarga. La ubicación final en Fotos/Galería requiere comprobación en dispositivos físicos.

## Anuncios desde resultados

Dashboard y Winners generan enlaces de anuncio para la persona y la consigna correspondientes. Al compartirlos se muestra la selfie, el nombre completo y los votos, con una felicitación. El organizador elige a quién anunciar; el sistema no cierra la votación ni confirma ganadores. Si Winners tiene un total final confirmado para esa persona/consigna, se usa ese total; en caso contrario se cuentan los votos válidos actuales.

Los anuncios se pueden abrir sin sesión, por pedido expreso del organizador para compartir los resultados. El token de anuncio es distinto del QR público, no incluye email ni sesión y queda limitado a esa vista de solo lectura. No permite votar ni abrir el pase. Las fotos siguen almacenadas en la planilla privada; no se suben a Drive ni se cambia el acceso de la planilla.

La frase usa ganadora o ganador con nombres reconocidos, como Julieta o Sebastián. Para nombres ambiguos se utiliza «¡Felicitaciones!», sin asignar un tratamiento incierto. Esto es formato del mensaje y no verificación de identidad.
