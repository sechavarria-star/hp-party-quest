# Corrección de identidad 2.1.1

El registro duplicado de 2.1.0 emitía una sesión del participante encontrado por email, sin prueba de identidad. Se eliminó esa recuperación: un email ya registrado se rechaza sin crear participante ni sesión. Ni el QR público ni una sesión de otro usuario permiten recuperarlo.

La sesión original permanece en el navegador y no se borra ante fallas de red. Recuperar acceso perdido requiere consultar a la organización. El MVP no verifica la propiedad del email en el primer registro: validar el dominio hp.com no equivale a validar identidad. No se incorporó envío de emails ni autenticación corporativa.

También se impide que una llamada pública a health configure un dominio de frontend arbitrario.

Publicación habitual: sesión local de clasp para Google Apps Script y Git para GitHub. No se transfieren credenciales de Google a Actions. El workflow de frontend verifica salud del backend antes de publicar. El pipeline original que requiere secretos queda disponible solo bajo ejecución manual.

Las pruebas automatizadas no sustituyen el escaneo entre dos celulares reales.
