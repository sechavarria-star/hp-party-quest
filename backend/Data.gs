function spreadsheet_() {
  return SpreadsheetApp.openById(HPQ.SPREADSHEET_ID);
}

function sheet_(name) {
  const sheet = spreadsheet_().getSheetByName(name);
  if (!sheet) throw appError_('MISSING_SHEET', 'Falta la hoja ' + name + '. Ejecutá setupProject().');
  return sheet;
}

function headers_(sheet) {
  const lastColumn = sheet.getLastColumn();
  if (lastColumn < 1) return [];
  return sheet.getRange(1, 1, 1, lastColumn).getDisplayValues()[0].map(function (value) { return String(value).trim(); });
}

function objects_(name) {
  const sheet = sheet_(name);
  const headers = headers_(sheet);
  const lastRow = sheet.getLastRow();
  if (lastRow < 2) return [];
  const values = sheet.getRange(2, 1, lastRow - 1, headers.length).getValues();
  return values.map(function (row, index) {
    const data = {};
    headers.forEach(function (header, column) { if (header) data[header] = row[column]; });
    return { rowNumber: index + 2, data: data };
  });
}

function findOne_(name, field, value) {
  const target = String(value);
  const rows = objects_(name);
  for (let i = 0; i < rows.length; i += 1) {
    if (String(rows[i].data[field]) === target) return rows[i];
  }
  return null;
}

function appendObject_(name, object) {
  const sheet = sheet_(name);
  const headers = headers_(sheet);
  if (!headers.length) throw appError_('MISSING_HEADERS', 'La hoja ' + name + ' no tiene encabezados.');
  const row = headers.map(function (header) {
    const value = Object.prototype.hasOwnProperty.call(object, header) ? object[header] : '';
    return safeSheetValue_(value);
  });
  sheet.getRange(sheet.getLastRow() + 1, 1, 1, row.length).setValues([row]);
}

function updateCell_(name, rowNumber, field, value) {
  const sheet = sheet_(name);
  const headers = headers_(sheet);
  const index = headers.indexOf(field);
  if (index < 0) throw appError_('MISSING_COLUMN', 'Falta la columna ' + field + ' en ' + name + '.');
  sheet.getRange(rowNumber, index + 1).setValue(safeSheetValue_(value));
}

function getConfig_() {
  const rows = objects_('Config');
  const config = {};
  rows.forEach(function (row) {
    const key = String(row.data.Key || '').trim();
    if (key) config[key] = row.data.Value;
  });
  return config;
}

function audit_(eventType, participantId, challengeId, targetParticipantId, result, details, sessionId, severity) {
  try {
    appendObject_('AuditLog', {
      LogID: uniqueId_('L', 'AuditLog', 'LogID'),
      Timestamp: new Date(),
      EventType: eventType,
      ParticipantID: participantId || '',
      ChallengeID: challengeId || '',
      TargetParticipantID: targetParticipantId || '',
      Result: result || '',
      Details: JSON.stringify(details || {}).slice(0, 4000),
      SessionID: sessionId || '',
      Severity: severity || 'INFO',
      AdminUser: ''
    });
  } catch (error) {
    console.error('Audit failure: ' + error);
  }
}

function touchParticipant_(participantId, date) {
  const hit = findOne_('Participants', 'ParticipantID', participantId);
  if (hit) updateCell_('Participants', hit.rowNumber, 'LastActivityAt', date || new Date());
}

function safeSheetValue_(value) {
  if (typeof value !== 'string') return value;
  return /^[=+\-@]/.test(value) ? "'" + value : value;
}

function asDate_(value) {
  if (!value) return null;
  if (Object.prototype.toString.call(value) === '[object Date]' && !isNaN(value.getTime())) return value;
  const parsed = new Date(value);
  return isNaN(parsed.getTime()) ? null : parsed;
}
