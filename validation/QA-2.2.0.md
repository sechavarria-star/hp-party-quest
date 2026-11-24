# Selfies y aceptación 2.2.0

Pruebas locales del 24/11/2026:

- Se valida JPG, dimensiones y tamaño máximo; SVG, imágenes inválidas y fotos demasiado grandes se rechazan.
- Sin consentimiento no se registra la foto.
- La imagen conserva sus bytes al repartirse en varias celdas.
- Un visitante anónimo o una sesión inválida no obtienen la foto.
- Actualizar la foto utiliza la identidad de la sesión e ignora un ID ajeno enviado por el cliente.
- La foto puede agregarse al registro o más tarde; reemplazarla no cambia el QR.
- Dos contextos móviles prueban la selección y preparación real de una imagen, consentimiento, confirmación personalizada, foto visible para el votante y oculta para un visitante sin sesión.
- Continúan pasando los controles de email duplicado, auto-voto, voto repetido y persistencia de identidad.
- La consigna QA temporal conserva el estado de borrador de la consigna real y restaura el ID anterior al cerrar o vencer.

El usuario confirmó el 21/11/2026 que dos celulares muestran sus QR. La captura real de selfies y el voto cruzado con la versión 2.2.0 requieren validación separada. No confundir navegadores móviles emulados con celulares físicos.

Prueba API publicada del 24/11/2026: dos identidades QA, guardado y lectura de JPG (incluyendo una foto repartida en varias celdas), bloqueo de lectura sin sesión, actualización propia con ID ajeno ignorado, email duplicado bloqueado y dos votos cruzados confirmados por lectura de Votes. Los votos pertenecen exclusivamente a CH-QA-20261120. No se usaron fotos reales de asistentes.

La consigna temporal se cierra y se restaura la configuración anterior al completar estas comprobaciones. La consigna real conserva su estado anterior.
