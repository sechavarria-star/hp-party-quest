const HPQ_SCHEMA = Object.freeze({
  Participants: ['ParticipantID','FirstName','LastName','DisplayName','Email','EmailNormalized','AuthToken','QRToken','QRUrl','QRImageUrl','RegistrationDate','RegistrationSource','Status','TermsAccepted','LastActivityAt','Notes','SelfieConsentAt','SelfieUpdatedAt'],
  Selfies: ['ParticipantID','MimeType','Data1','Data2','Data3','Data4','Data5','ConsentAt','UpdatedAt'],
  Challenges: ['ChallengeID','ChallengeName','Description','Type','Status','StartDateTime','EndDateTime','MaxVotesPerParticipant','AllowSelfVote','ShowLiveRanking','WinnerCount','TieBreakerRule','PublicMessage','CreatedAt','UpdatedAt'],
  Votes: ['VoteID','ChallengeID','VoterParticipantID','CandidateParticipantID','VoteKey','VotedAt','Valid','ValidationResult','SessionID','UserAgent','Source','InvalidatedAt','InvalidatedBy','AdminNotes'],
  Sessions: ['SessionID','ParticipantID','SessionTokenHash','CreatedAt','ExpiresAt','LastUsedAt','Status','UserAgent','RegistrationSource','RevokedAt','RevokedReason'],
  AuditLog: ['LogID','Timestamp','EventType','ParticipantID','ChallengeID','TargetParticipantID','Result','Details','SessionID','Severity','AdminUser'],
  Winners: ['ResultID','ChallengeID','Position','ParticipantID','FinalVotes','CalculatedAt','Confirmed','ConfirmedBy','AnnouncementStatus','Notes','SelfieURL'],
  Dashboard: ['Metric','Value','Notes'],
  Config: ['Key','Value','Description']
});

function setupProject() {
  const ss = spreadsheet_();
  Object.keys(HPQ_SCHEMA).forEach(function (name) { ensureSheet_(ss, name, HPQ_SCHEMA[name]); });
  seedConfig_();
  seedChallenge_();
  formatSheets_();
  refreshDashboardSafely_();
  const report = validateProject();
  console.log(JSON.stringify(report, null, 2));
  return report;
}

/**
 * Idempotent web-runtime bootstrap. This removes the need to run setupProject()
 * manually in the Apps Script editor after a deployment. The first health
 * request creates any missing schema/configuration and records the deployment
 * URLs when they are available.
 */
function ensureRuntimeReady_(frontendUrl) {
  const cache = CacheService.getScriptCache();
  const cacheKey = 'hpq.runtime.' + HPQ.VERSION;
  const cached = !frontendUrl && !liveQaExpired_() && cache.get(cacheKey);
  if (cached) return JSON.parse(cached);
  const lock = LockService.getScriptLock();
  lock.waitLock(20000);
  try {
    const ss = spreadsheet_();
    Object.keys(HPQ_SCHEMA).forEach(function (name) { ensureSheet_(ss, name, HPQ_SCHEMA[name]); });
    seedConfig_();
    seedChallenge_();
    restoreLiveQa_();
    formatSheets_();

    let serviceUrl = '';
    try { serviceUrl = String(ScriptApp.getService().getUrl() || '').trim(); } catch (_) { serviceUrl = ''; }
    if (validHttpsUrl_(serviceUrl) && /\/exec(?:[?#]|$)/.test(serviceUrl)) {
      upsertConfig_('APPS_SCRIPT_WEBAPP_URL', serviceUrl);
    }

    const requestedFrontend = 'https://sechavarria-star.github.io/hp-party-quest/';
    if (!frontendUrl || stripQuery_(frontendUrl) === requestedFrontend) {
      const config = getConfig_();
      const current = String(config.FRONTEND_BASE_URL || '');
      if (!validHttpsUrl_(current) || current.indexOf('REEMPLAZAR') >= 0) {
        upsertConfig_('FRONTEND_BASE_URL', requestedFrontend);
      }
    }
    refreshDashboardSafely_();
    const report = validateProject();
    if (report.ok) cache.put(cacheKey, JSON.stringify(report), 300);
    return report;
  } finally {
    lock.releaseLock();
  }
}

function validateProject() {
  const ss = spreadsheet_();
  const issues = [];
  Object.keys(HPQ_SCHEMA).forEach(function (name) {
    const sheet = ss.getSheetByName(name);
    if (!sheet) { issues.push('Falta la hoja ' + name); return; }
    if (name === 'Dashboard') return; // Presentation sheet, not a row-1 data table.
    const actual = headers_(sheet);
    HPQ_SCHEMA[name].forEach(function (header) {
      if (actual.indexOf(header) < 0) issues.push(name + ': falta la columna ' + header);
    });
  });
  const config = ss.getSheetByName('Config') ? getConfig_() : {};
  if (!validHttpsUrl_(config.FRONTEND_BASE_URL) || String(config.FRONTEND_BASE_URL).indexOf('REEMPLAZAR') >= 0) issues.push('Config.FRONTEND_BASE_URL todavía no está configurado.');
  if (!validHttpsUrl_(config.APPS_SCRIPT_WEBAPP_URL) || String(config.APPS_SCRIPT_WEBAPP_URL).indexOf('REEMPLAZAR') >= 0) issues.push('Config.APPS_SCRIPT_WEBAPP_URL todavía no está configurado.');
  return { ok: issues.length === 0, spreadsheetId: HPQ.SPREADSHEET_ID, version: HPQ.VERSION, issues: issues };
}

function ensureSheet_(ss, name, requiredHeaders) {
  let sheet = ss.getSheetByName(name);
  if (!sheet) sheet = ss.insertSheet(name);
  if (name === 'Dashboard') return;
  const current = headers_(sheet);
  if (!current.length || current.every(function (item) { return !item; })) {
    sheet.getRange(1, 1, 1, requiredHeaders.length).setValues([requiredHeaders]);
  } else {
    const missing = requiredHeaders.filter(function (header) { return current.indexOf(header) < 0; });
    if (missing.length) sheet.getRange(1, current.length + 1, 1, missing.length).setValues([missing]);
  }
  // Imported dashboards can have merged title cells crossing row 1.
  // Freezing headers is cosmetic and must never block registration or voting.
  try { sheet.setFrozenRows(1); }
  catch (error) { console.warn('Skipped header freeze for ' + name + ': ' + error.message); }
}

function seedConfig_() {
  const defaults = [
    ['EVENT_NAME','HP End of Year Party','Nombre público del evento'],
    ['EVENT_CODE','HP-EOY-2026','Identificador del evento'],
    ['EVENT_TIMEZONE','America/Argentina/Buenos_Aires','Zona horaria'],
    ['REGISTRATION_OPEN','TRUE','Habilita registros y uso público'],
    ['ALLOWED_EMAIL_DOMAIN','hp.com','Dominios permitidos, separados por coma'],
    ['REQUIRE_HP_EMAIL','TRUE','Exige dominio corporativo'],
    ['FRONTEND_BASE_URL','https://REEMPLAZAR.github.io/hp-party-quest/','URL pública de GitHub Pages'],
    ['APPS_SCRIPT_WEBAPP_URL','https://script.google.com/macros/s/REEMPLAZAR/exec','URL /exec del backend'],
    ['SESSION_EXPIRATION_HOURS','12','Duración de la sesión'],
    ['ACTIVE_CHALLENGE_ID','CH-COOL-GLASSES','Consigna usada por el frontend'],
    ['PUBLIC_RANKING_ENABLED','FALSE','Mostrar ranking público'],
    ['MAX_PARTICIPANTS','300','Capacidad esperada'],
    ['MAINTENANCE_MODE','FALSE','Bloqueo temporal']
  ];
  defaults.forEach(function (entry) {
    if (!findOne_('Config', 'Key', entry[0])) appendObject_('Config', { Key: entry[0], Value: entry[1], Description: entry[2] });
  });
}

function seedChallenge_() {
  const id = 'CH-COOL-GLASSES';
  if (findOne_('Challenges', 'ChallengeID', id)) return;
  const now = new Date();
  appendObject_('Challenges', {
    ChallengeID: id,
    ChallengeName: 'Anteojos más cool',
    Description: 'Encontrá a la persona con los anteojos más cool, escaneá su QR y confirmá tu voto.',
    Type: 'VOTE_PERSON',
    Status: 'OPEN',
    StartDateTime: '',
    EndDateTime: '',
    MaxVotesPerParticipant: 1,
    AllowSelfVote: false,
    ShowLiveRanking: false,
    WinnerCount: 3,
    TieBreakerRule: 'EARLIEST_LAST_VOTE',
    PublicMessage: 'Buscá, escaneá y votá.',
    CreatedAt: now,
    UpdatedAt: now
  });
}

function formatSheets_() {
  const ss = spreadsheet_();
  Object.keys(HPQ_SCHEMA).forEach(function (name) {
    const sheet = ss.getSheetByName(name);
    if (!sheet || name === 'Dashboard') return;
    const columns = HPQ_SCHEMA[name].length;
    sheet.getRange(1, 1, 1, columns).setBackground('#102a4c').setFontColor('#ffffff').setFontWeight('bold');
    if (name !== 'Selfies') sheet.autoResizeColumns(1, Math.min(columns, 16));

    // The workbook uses native Google Sheets tables. A basic range filter
    // cannot overlap a native table, even partially; attempting to add one
    // throws: “You can’t apply a filter to a range that partially intersects
    // a table”. Native tables already include their own filter controls, so
    // setup intentionally leaves filtering to the table and remains safe to
    // run repeatedly on the existing workbook.
  });
}

function setDeploymentUrls(frontendUrl, appsScriptUrl) {
  if (!validHttpsUrl_(frontendUrl) || !validHttpsUrl_(appsScriptUrl)) throw new Error('Ambas URLs deben comenzar con https://');
  upsertConfig_('FRONTEND_BASE_URL', stripQuery_(frontendUrl));
  upsertConfig_('APPS_SCRIPT_WEBAPP_URL', String(appsScriptUrl).trim());
  return validateProject();
}

function upsertConfig_(key, value) {
  const hit = findOne_('Config', 'Key', key);
  if (hit) updateCell_('Config', hit.rowNumber, 'Value', value);
  else appendObject_('Config', { Key: key, Value: value, Description: '' });
}

// Temporary acceptance-test setup; no public admin action or caller input.
function prepareLiveQa_() {
  const id = 'CH-QA-20261120';
  const properties = PropertiesService.getScriptProperties();
  if (properties.getProperty('HPQ_QA_PREVIOUS_CHALLENGE') !== null) {
    if (liveQaExpired_()) restoreLiveQa_();
    return;
  }
  const previous = String(getConfig_().ACTIVE_CHALLENGE_ID || '');
  if (!findOne_('Challenges', 'ChallengeID', id)) {
    appendObject_('Challenges', {
      ChallengeID: id, ChallengeName: 'PRUEBA · Anteojos más cool',
      Description: 'Prueba técnica de registro, QR y voto. No cuenta para el evento.',
      Type: 'VOTE_PERSON', Status: 'OPEN', StartDateTime: '', EndDateTime: '',
      MaxVotesPerParticipant: 1, AllowSelfVote: false, ShowLiveRanking: false,
      WinnerCount: 0, TieBreakerRule: 'EARLIEST_LAST_VOTE',
      PublicMessage: 'Solo prueba técnica', CreatedAt: new Date(), UpdatedAt: new Date()
    });
  }
  properties.setProperty('HPQ_QA_PREVIOUS_CHALLENGE', previous);
  properties.setProperty('HPQ_QA_EXPIRES_AT', String(Date.now() + 45 * 60 * 1000));
  upsertConfig_('ACTIVE_CHALLENGE_ID', id);
  audit_('QA_OPENED', '', id, '', 'ACCEPTED', { previousChallenge: previous }, '', 'INFO');
}

function liveQaExpired_() {
  const properties = PropertiesService.getScriptProperties();
  return properties.getProperty('HPQ_QA_PREVIOUS_CHALLENGE') !== null &&
    !properties.getProperty('HPQ_QA_RESTORED_AT') &&
    Number(properties.getProperty('HPQ_QA_EXPIRES_AT') || 0) <= Date.now();
}

function restoreLiveQa_() {
  const properties = PropertiesService.getScriptProperties();
  const previous = properties.getProperty('HPQ_QA_PREVIOUS_CHALLENGE');
  if (previous === null || properties.getProperty('HPQ_QA_RESTORED_AT')) return;
  const id = 'CH-QA-20261120';
  if (String(getConfig_().ACTIVE_CHALLENGE_ID) === id) upsertConfig_('ACTIVE_CHALLENGE_ID', previous);
  const hit = findOne_('Challenges', 'ChallengeID', id);
  if (hit) updateCell_('Challenges', hit.rowNumber, 'Status', 'CLOSED');
  properties.setProperty('HPQ_QA_RESTORED_AT', new Date().toISOString());
  CacheService.getScriptCache().remove('hpq.runtime.' + HPQ.VERSION);
  audit_('QA_CLOSED', '', id, '', 'RESTORED', {}, '', 'INFO');
}

function liveQaSummary_() {
  const id = 'CH-QA-20261120';
  const qa = objects_('Participants').filter(function (row) {
    return /^QA (Navegador|API [AB]|Celular [AB])$/.test(String(row.data.FirstName || ''));
  });
  const ids = qa.map(function (row) { return String(row.data.ParticipantID); });
  return {
    challengeId: id,
    testParticipants: qa.length,
    active: String(getConfig_().ACTIVE_CHALLENGE_ID) === id,
    expiresAt: Number(PropertiesService.getScriptProperties().getProperty('HPQ_QA_EXPIRES_AT') || 0),
    acceptedVotes: objects_('Votes').filter(function (row) { return String(row.data.ChallengeID) === id && toBoolean_(row.data.Valid); }).length,
    testVotes: objects_('Votes').filter(function (row) {
      return String(row.data.ChallengeID) === id && ids.indexOf(String(row.data.VoterParticipantID)) >= 0 && toBoolean_(row.data.Valid);
    }).length
  };
}
