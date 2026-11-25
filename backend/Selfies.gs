const SELFIE_MAX_BYTES = 120 * 1024;
const SELFIE_CHUNK = 40000;

function validateSelfie_(dataUrl, consent) {
  if (!dataUrl) return null;
  if (consent !== true) throw appError_('SELFIE_CONSENT_REQUIRED', 'Aceptá guardar y mostrar tu selfie a quienes escaneen tu QR.');
  const text = String(dataUrl);
  const prefix = 'data:image/jpeg;base64,';
  if (text.indexOf(prefix) !== 0) throw appError_('INVALID_SELFIE', 'Usá una foto JPG tomada o preparada desde el registro.');
  const encoded = text.slice(prefix.length);
  if (!encoded || encoded.length > Math.ceil(SELFIE_MAX_BYTES / 3) * 4 || !/^[A-Za-z0-9+/]+={0,2}$/.test(encoded)) {
    throw appError_('INVALID_SELFIE', 'La foto supera el tamaño permitido o no es válida. Volvé a tomarla.');
  }
  let bytes;
  try { bytes = Utilities.base64Decode(encoded); }
  catch (_) { throw appError_('INVALID_SELFIE', 'No pudimos leer esa foto. Volvé a tomarla.'); }
  if (bytes.length > SELFIE_MAX_BYTES || bytes.length < 12 || (bytes[0] & 255) !== 255 || (bytes[1] & 255) !== 216 ||
      (bytes[bytes.length - 2] & 255) !== 255 || (bytes[bytes.length - 1] & 255) !== 217 || !validSelfieDimensions_(bytes)) {
    throw appError_('INVALID_SELFIE', 'La foto no es un JPG válido de hasta 1024 × 1024. Volvé a tomarla.');
  }
  return encoded;
}

function validSelfieDimensions_(bytes) {
  let offset = 2;
  while (offset + 8 < bytes.length) {
    if ((bytes[offset++] & 255) !== 255) return false;
    while ((bytes[offset] & 255) === 255) offset += 1;
    const marker = bytes[offset++] & 255;
    if (marker === 217 || marker === 218) return false;
    const length = ((bytes[offset] & 255) << 8) | (bytes[offset + 1] & 255);
    if (length < 2 || offset + length > bytes.length) return false;
    if (marker === 192 || marker === 193 || marker === 194) {
      const height = ((bytes[offset + 3] & 255) << 8) | (bytes[offset + 4] & 255);
      const width = ((bytes[offset + 5] & 255) << 8) | (bytes[offset + 6] & 255);
      return width > 0 && height > 0 && width <= 1024 && height <= 1024;
    }
    offset += length;
  }
  return false;
}

function findSelfieRow_(participantId) {
  const sheet = sheet_('Selfies');
  if (sheet.getLastRow() < 2) return null;
  const cell = sheet.getRange(2, 1, sheet.getLastRow() - 1, 1)
    .createTextFinder(String(participantId)).matchEntireCell(true).useRegularExpression(false).findNext();
  if (!cell) return null;
  const rowNumber = cell.getRow();
  const values = sheet.getRange(rowNumber, 1, 1, HPQ_SCHEMA.Selfies.length).getValues()[0];
  const data = {};
  HPQ_SCHEMA.Selfies.forEach(function (key, index) { data[key] = values[index]; });
  return { rowNumber: rowNumber, data: data };
}

function writeSelfie_(participantId, encoded, now) {
  const row = { ParticipantID: participantId, MimeType: 'image/jpeg', ConsentAt: now, UpdatedAt: now };
  for (let i = 0; i < 5; i += 1) {
    const chunk = encoded.slice(i * SELFIE_CHUNK, (i + 1) * SELFIE_CHUNK);
    row['Data' + (i + 1)] = chunk ? 'b64:' + chunk : '';
  }
  const hit = findSelfieRow_(participantId);
  if (hit) {
    sheet_('Selfies').getRange(hit.rowNumber, 1, 1, HPQ_SCHEMA.Selfies.length)
      .setValues([HPQ_SCHEMA.Selfies.map(function (key) { return row[key] || ''; })]);
  } else appendObject_('Selfies', row);
}

function readSelfie_(participantId) {
  const hit = findSelfieRow_(participantId);
  if (!hit || String(hit.data.MimeType) !== 'image/jpeg') return '';
  let encoded = '';
  for (let i = 1; i <= 5; i += 1) {
    const chunk = String(hit.data['Data' + i] || '');
    if (chunk && chunk.indexOf('b64:') !== 0) return '';
    encoded += chunk.slice(4);
  }
  if (!encoded || encoded.length > Math.ceil(SELFIE_MAX_BYTES / 3) * 4) return '';
  return 'data:image/jpeg;base64,' + encoded;
}

function updateParticipantSelfie_(payload) {
  assertAvailable_();
  // Resolve identity before processing or storing photo bytes.
  const auth = authenticateSession_(payload.sessionToken, false);
  const encoded = validateSelfie_(payload.selfieDataUrl, payload.selfieConsent);
  if (!encoded) throw appError_('SELFIE_REQUIRED', 'Tomá una selfie antes de guardarla.');
  const lock = LockService.getScriptLock();
  lock.waitLock(20000);
  try {
    const current = authenticateSession_(payload.sessionToken, false);
    const now = new Date();
    writeSelfie_(current.participant.ParticipantID, encoded, now);
    const hit = findOne_('Participants', 'ParticipantID', current.participant.ParticipantID);
    updateCell_('Participants', hit.rowNumber, 'SelfieConsentAt', now);
    updateCell_('Participants', hit.rowNumber, 'SelfieUpdatedAt', now);
    audit_('SELFIE_SAVED', auth.participant.ParticipantID, '', '', 'ACCEPTED', {}, auth.session.SessionID, 'INFO');
    refreshDashboardSafely_();
    return { participant: publicParticipant_(findOne_('Participants', 'ParticipantID', current.participant.ParticipantID).data) };
  } finally { lock.releaseLock(); }
}
