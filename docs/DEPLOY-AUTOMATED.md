# Despliegue automatizado

La versión 2.1.0 se publica con un único pipeline: `.github/workflows/release-live.yml`.

## Qué hace automáticamente

1. Valida frontend, backend y compatibilidad con las tablas nativas de Google Sheets.
2. Consume la sesión OAuth transferible de `clasp` desde el secreto `CLASPRC_JSON`.
3. Localiza por nombre el proyecto existente **HP Party Quest** vinculado a la planilla.
4. Publica exclusivamente `backend/` en Google Apps Script.
5. Actualiza una implementación existente cuando está disponible `APPS_SCRIPT_DEPLOYMENT_ID`; de lo contrario crea una implementación web.
6. Genera `frontend/config.js` con la URL `/exec` real.
7. Llama a `health`, que inicializa el esquema, la configuración y la consigna sin ejecutar funciones manualmente en el editor.
8. Publica `frontend/` en GitHub Pages.
9. Verifica que el backend reporte la versión 2.1.0, que el runtime esté listo, que la página esté disponible y que la configuración live no contenga placeholders.
10. Publica las dos URLs verificadas en el resumen de la ejecución.

## Bloqueo de seguridad deliberado

El pipeline no contiene ni fabrica credenciales. Si no está disponible `CLASPRC_JSON`, finaliza antes del `push` a Apps Script. La creación o actualización del repositorio también exige una sesión GitHub válida. Son los únicos bloqueos externos; no hay pasos de edición de archivos, PowerShell ni configuración manual de la planilla.

## Recuperación segura

El despliegue de Pages ocurre únicamente después de que el backend queda saludable. Si Google rechaza autenticación, permisos o publicación, el frontend live anterior no se reemplaza por una versión incompleta.
