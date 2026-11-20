function appError_(code, publicMessage) {
  const error = new Error(publicMessage);
  error.code = code;
  error.publicMessage = publicMessage;
  return error;
}

function cleanName_(value, label) {
  const text = String(value || '').replace(/[\u0000-\u001f\u007f]/g, '').replace(/\s+/g, ' ').trim();
  if (text.length < 1 || text.length > 60) throw appError_('INVALID_NAME', 'Revisá el ' + label + '.');
  if (/^[=+\-@]/.test(text)) throw appError_('INVALID_NAME', 'Revisá el ' + label + '.');
  return text;
}

function normalizeEmail_(value) {
  const email = String(value || '').trim().toLowerCase();
  if (email.length > 160 || !/^[^\s@]+@[^\s@]+\.[^\s@]+$/.test(email)) throw appError_('INVALID_EMAIL', 'Ingresá un email válido.');
  return email;
}

function validateEmailPolicy_(email) {
  const config = getConfig_();
  if (!toBoolean_(config.REQUIRE_HP_EMAIL)) return;
  const domains = String(config.ALLOWED_EMAIL_DOMAIN || 'hp.com').split(',').map(function (item) { return item.trim().toLowerCase(); }).filter(Boolean);
  const domain = email.split('@').pop();
  if (domains.indexOf(domain) < 0) throw appError_('EMAIL_DOMAIN_NOT_ALLOWED', 'Usá tu email corporativo autorizado.');
}

function assertAvailable_() {
  const config = getConfig_();
  if (toBoolean_(config.MAINTENANCE_MODE)) throw appError_('MAINTENANCE', 'El juego está en mantenimiento. Probá nuevamente en unos minutos.');
}

function assertRegistrationOpen_() {
  const config = getConfig_();
  if (!toBoolean_(config.REGISTRATION_OPEN)) throw appError_('REGISTRATION_CLOSED', 'El registro está cerrado.');
}

function enforceCapacity_(config) {
  const maximum = Number(config.MAX_PARTICIPANTS || 300);
  const active = objects_('Participants').filter(function (row) { return String(row.data.Status || '').toUpperCase() === 'ACTIVE'; }).length;
  if (active >= maximum) throw appError_('CAPACITY_REACHED', 'Se alcanzó el máximo de participantes. Consultá a la organización.');
}

function createSession_(participantId, source) {
  const config = getConfig_();
  const hours = Math.max(1, Math.min(168, Number(config.SESSION_EXPIRATION_HOURS || 12)));
  const now = new Date();
  const expires = new Date(now.getTime() + hours * 60 * 60 * 1000);
  const rawToken = randomToken_() + randomToken_();
  const sessionId = uniqueId_('S', 'Sessions', 'SessionID');
  appendObject_('Sessions', {
    SessionID: sessionId,
    ParticipantID: participantId,
    SessionTokenHash: sha256_(rawToken),
    CreatedAt: now,
    ExpiresAt: expires,
    LastUsedAt: now,
    Status: 'ACTIVE',
    UserAgent: '',
    RegistrationSource: String(source || 'GITHUB_PAGES').slice(0, 40),
    RevokedAt: '',
    RevokedReason: ''
  });
  audit_('SESSION_CREATED', participantId, '', '', 'ACCEPTED', { expiresAt: expires.toISOString() }, sessionId, 'INFO');
  return { sessionId: sessionId, rawToken: rawToken };
}

function authenticateSession_(rawToken, touch) {
  const token = String(rawToken || '').trim();
  if (token.length < 24) throw appError_('INVALID_SESSION', 'No encontramos tu sesión. Abrí el navegador donde creaste tu QR o consultá a la organización.');
  const hit = findOne_('Sessions', 'SessionTokenHash', sha256_(token));
  if (!hit || String(hit.data.Status || '').toUpperCase() !== 'ACTIVE') throw appError_('INVALID_SESSION', 'No encontramos tu sesión. Abrí el navegador donde creaste tu QR o consultá a la organización.');
  const expires = asDate_(hit.data.ExpiresAt);
  if (!expires || expires.getTime() < Date.now()) {
    updateCell_('Sessions', hit.rowNumber, 'Status', 'EXPIRED');
    throw appError_('SESSION_EXPIRED', 'Tu sesión venció. Consultá a la organización para recuperar tu acceso.');
  }
  const participantHit = findOne_('Participants', 'ParticipantID', hit.data.ParticipantID);
  if (!participantHit || String(participantHit.data.Status || '').toUpperCase() !== 'ACTIVE') throw appError_('INVALID_PARTICIPANT', 'Tu participante no está activo.');
  if (touch) updateCell_('Sessions', hit.rowNumber, 'LastUsedAt', new Date());
  return { session: hit.data, participant: participantHit.data };
}

function uniqueId_(prefix, sheetName, field) {
  for (let i = 0; i < 10; i += 1) {
    const id = prefix + '-' + Utilities.getUuid().replace(/-/g, '').slice(0, 8).toUpperCase();
    if (!findOne_(sheetName, field, id)) return id;
  }
  throw appError_('ID_GENERATION_FAILED', 'No pudimos generar el identificador. Intentá nuevamente.');
}

function uniqueToken_(sheetName, field) {
  for (let i = 0; i < 10; i += 1) {
    const token = randomToken_().slice(0, 16);
    if (!findOne_(sheetName, field, token)) return token;
  }
  throw appError_('TOKEN_GENERATION_FAILED', 'No pudimos generar el QR. Intentá nuevamente.');
}

function randomToken_() {
  return Utilities.base64EncodeWebSafe(Utilities.getUuid() + '|' + Utilities.getUuid()).replace(/=+$/g, '');
}

function sha256_(value) {
  const bytes = Utilities.computeDigest(Utilities.DigestAlgorithm.SHA_256, String(value), Utilities.Charset.UTF_8);
  return bytes.map(function (byte) { const normalized = byte < 0 ? byte + 256 : byte; return ('0' + normalized.toString(16)).slice(-2); }).join('');
}

function toBoolean_(value) {
  return value === true || String(value || '').toUpperCase() === 'TRUE' || String(value) === '1';
}

function validHttpsUrl_(value) {
  return /^https:\/\//i.test(String(value || '').trim());
}

function stripQuery_(value) {
  return String(value || '').trim().replace(/[?#].*$/, '').replace(/\/?$/, '/');
}
