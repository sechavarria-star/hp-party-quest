# Arquitectura

## Componentes

### GitHub Pages

Sirve únicamente archivos estáticos. No contiene secretos. `config.js` incluye la URL pública del web app de Apps Script y puede quedar versionado.

### Google Apps Script

Funciona como API. La implementación debe ejecutarse como el propietario y permitir acceso a cualquier persona que tenga el link. Abre el Sheet por ID, por lo que el frontend nunca necesita credenciales de Google Sheets.

### Google Sheets

Mantiene las ocho hojas definidas para el producto: `Participants`, `Challenges`, `Votes`, `Sessions`, `AuditLog`, `Winners`, `Dashboard` y `Config`.

## Flujo

```text
1. QR de recepción → GitHub Pages
2. POST register → Apps Script
3. Apps Script → Participants + Sessions + AuditLog
4. Frontend guarda sessionToken en localStorage
5. Frontend genera QR personal localmente
6. Escaneo → GitHub Pages/?candidate=QRToken
7. POST candidate → Apps Script
8. POST vote + sessionToken → validaciones bajo LockService
9. Apps Script → Votes + AuditLog
```

## Contrato HTTP

Todas las operaciones de aplicación usan `POST` con dos campos de formulario:

- `action`: `register`, `session`, `candidate` o `vote`.
- `payload`: objeto JSON serializado.

La respuesta siempre es JSON:

```json
{ "ok": true, "data": {} }
```

O bien:

```json
{ "ok": false, "code": "DUPLICATE_VOTE", "message": "Ya usaste tu voto para esta consigna." }
```

`GET ?action=health` es el único endpoint de lectura directa y sirve para monitoreo.

## Consistencia

`register` y `vote` toman un `ScriptLock`. Esto evita que dos solicitudes simultáneas creen participantes duplicados o dos votos con la misma `VoteKey`.

## Límites

La implementación está pensada para una fiesta de hasta unas 300 personas, con ráfagas breves. Para más volumen o alta concurrencia sostenida conviene migrar persistencia a una base transaccional, manteniendo el frontend y el contrato de API.
