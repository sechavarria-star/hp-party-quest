# Despliegue live

HP Party Quest 2.1.0 usa un despliegue administrado de extremo a extremo. No requiere editar archivos, usar PowerShell, copiar IDs ni ejecutar funciones desde el editor de Apps Script.

La implementación está en `.github/workflows/release-live.yml` y se documenta en [`DEPLOY-AUTOMATED.md`](DEPLOY-AUTOMATED.md).

## Resultado del pipeline

- Backend de Google Apps Script publicado como Web App.
- Planilla inicializada de forma idempotente mediante `GET /exec?action=health`.
- `frontend/config.js` generado con la URL real del backend.
- Frontend publicado en GitHub Pages.
- URLs cruzadas guardadas en `Config`.
- Backend y frontend verificados live.

## Dependencias externas

Solo se requieren sesiones autenticadas transferibles para las cuentas propietarias:

- Google Apps Script: secreto `CLASPRC_JSON`.
- GitHub: sesión con permiso para crear o actualizar el repositorio y ejecutar Actions.

Si falta alguna autenticación, la publicación se detiene antes de dejar un release parcial. No existe un fallback que solicite editar código o ejecutar comandos manuales.
