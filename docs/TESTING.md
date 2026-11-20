# Pruebas del MVP

## Antes del evento

- `validateProject()` devuelve `ok: true`.
- `GET /exec?action=health` responde `ok: true`.
- `frontend/config.js` no contiene `REEMPLAZAR`.
- `Config.FRONTEND_BASE_URL` y `Config.APPS_SCRIPT_WEBAPP_URL` son las URLs definitivas.
- `REGISTRATION_OPEN=TRUE` y `MAINTENANCE_MODE=FALSE`.
- Para probar con emails personales, usar temporalmente `REQUIRE_HP_EMAIL=FALSE`.

## Prueba con dos celulares

1. Abrí el QR de recepción en el celular A y registrá una persona.
2. Verificá que aparece el QR personal.
3. Confirmá filas nuevas en `Participants`, `Sessions` y `AuditLog`.
4. Repetí desde el celular B con otro email.
5. Desde A, escaneá el QR de B.
6. Confirmá que aparece B como candidato y A como votante.
7. Votá y verificá una fila en `Votes` con `Valid=TRUE`.
8. Intentá votar otra vez: debe responder `DUPLICATE_VOTE` y no crear otro voto válido.
9. Desde B, escaneá su propio QR: debe responder `SELF_VOTE`.
10. Cerrá y reabrí la web en A: debe recuperar el QR de A.
11. Registrá el email de A desde otro navegador: no debe duplicar `Participants`; sí debe crear una sesión nueva.

## Pruebas de estado

- `Challenges.Status=CLOSED`: el backend rechaza el voto.
- `REGISTRATION_OPEN=FALSE`: bloquea registro y consultas públicas.
- `MAINTENANCE_MODE=TRUE`: bloquea el uso público.
- `Participants.Status=BLOCKED`: invalida la identidad.
- `Sessions.Status=REVOKED`: fuerza un nuevo registro.

## Criterios de aceptación

- No aparece email en ninguna URL ni en el QR.
- Solo existe un voto válido por `ChallengeID|VoterParticipantID`.
- Un participante no puede votarse salvo que `AllowSelfVote=TRUE`.
- El frontend funciona en Chrome Android y Safari iOS actuales.
- La descarga del pass genera un PNG legible por la cámara de otro celular.
- El evento funciona con Wi-Fi y con datos móviles.
