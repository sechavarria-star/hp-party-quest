// Editor-only helper: requests the send-mail permission without sending a message.
function authorizeRecoveryEmail() {
  console.log('Recovery email quota available: ' + MailApp.getRemainingDailyQuota());
}

function requestEmailRecovery_(payload) {
  const recoveryId = randomToken_();
  const reply = { accepted: true, recoveryId: recoveryId, message: 'Si el email tiene un registro activo, recibirás un código. Revisá también Correo no deseado. Podés pedir otro en 60 segundos.' };
  let email;
  try { email = normalizeEmail_(payload.email); validateEmailPolicy_(email); } catch (_) { return reply; }
  const lock = LockService.getScriptLock(); lock.waitLock(20000);
  try {
    const properties = PropertiesService.getScriptProperties();
    const key = 'HPQ_EMAIL_RECOVERY_' + sha256_(email);
    let previous;
    try { previous = JSON.parse(properties.getProperty(key) || '{}'); } catch (_) { previous = {}; }
    const now = Date.now();
    const sameWindow = Number(previous.windowStartedAt) > now - 60 * 60 * 1000;
    const count = sameWindow ? Number(previous.sentCount || 0) : 0;
    // Keep the previous challenge usable when a resend is throttled.
    if (now - Number(previous.sentAt || 0) < 60000 || count >= 3) {
      if (previous.recoveryId) reply.recoveryId = previous.recoveryId;
      return reply;
    }
    const hits = objects_('Participants').filter(function (row) {
      return String(row.data.EmailNormalized || row.data.Email || '').trim().toLowerCase() === email && String(row.data.Status).toUpperCase() === 'ACTIVE';
    });
    if (hits.length !== 1) return reply;
    const cache = CacheService.getScriptCache();
    const globalKey = 'HPQ_RECOVERY_MAIL_HOUR_' + Math.floor(now / 3600000);
    const globalCount = Number(cache.get(globalKey) || 0);
    if (globalCount >= 100 || MailApp.getRemainingDailyQuota() < 1) return reply;
    const code = String(parseInt(Utilities.getUuid().replace(/-/g, '').slice(0, 8), 16) % 1000000).padStart(6, '0');
    const ticket = {
      participantId: hits[0].data.ParticipantID,
      recoveryId: recoveryId,
      codeHash: sha256_(recoveryId + '|' + code),
      expiresAt: now + 10 * 60 * 1000, attempts: 0, used: false, delivered: false,
      sentAt: now, sentCount: count + 1, windowStartedAt: sameWindow ? previous.windowStartedAt : now
    };
    properties.setProperty(key, JSON.stringify(ticket));
    cache.put(globalKey, String(globalCount + 1), 3600);
    try {
      MailApp.sendEmail({
        to: email, name: "HP Kick Off '27 Quest",
        subject: "Tu código para recuperar el pase · HP Kick Off '27",
        body: 'Tu código para recuperar el acceso es: ' + code + '\n\nVence en 10 minutos y solo puede usarse una vez. Ingresalo en la pantalla del juego donde lo pediste.\n\nConservás tu participante, QR y votos. No compartas este código. Si no lo solicitaste, ignorá este mensaje; tu acceso actual sigue funcionando.'
      });
      ticket.delivered = true;
      properties.setProperty(key, JSON.stringify(ticket));
      audit_('RECOVERY_CODE_SENT', ticket.participantId, '', '', 'ACCEPTED', {}, '', 'INFO');
    } catch (_) {
      // Do not log the mail body, code, email, or provider exception.
      ticket.used = true;
      properties.setProperty(key, JSON.stringify(ticket));
      audit_('RECOVERY_DELIVERY_FAILED', ticket.participantId, '', '', 'FAILED', {}, '', 'WARNING');
    }
    return reply;
  } finally { lock.releaseLock(); }
}

function verifyEmailRecovery_(payload) {
  const invalid = function () { return appError_('INVALID_RECOVERY', 'El código no es válido o venció. Revisalo o solicitá uno nuevo.'); };
  let email;
  try { email = normalizeEmail_(payload.email); } catch (_) { throw invalid(); }
  const id = String(payload.recoveryId || '');
  const code = String(payload.code || '').trim();
  if (!/^[A-Za-z0-9_-]{32,256}$/.test(id) || !/^\d{6}$/.test(code)) throw invalid();
  const lock = LockService.getScriptLock(); lock.waitLock(20000);
  try {
    const properties = PropertiesService.getScriptProperties();
    const key = 'HPQ_EMAIL_RECOVERY_' + sha256_(email);
    let ticket;
    try { ticket = JSON.parse(properties.getProperty(key) || 'null'); } catch (_) { ticket = null; }
    if (!ticket || ticket.used || !ticket.delivered || ticket.recoveryId !== id || !(Number(ticket.expiresAt) > Date.now()) || Number(ticket.attempts) >= 5) throw invalid();
    ticket.attempts = Number(ticket.attempts) + 1;
    properties.setProperty(key, JSON.stringify(ticket));
    if (ticket.codeHash !== sha256_(id + '|' + code)) throw invalid();
    const hit = findOne_('Participants', 'ParticipantID', ticket.participantId);
    if (!hit || String(hit.data.Status).toUpperCase() !== 'ACTIVE' || String(hit.data.EmailNormalized || hit.data.Email || '').trim().toLowerCase() !== email) throw invalid();
    // Consume before session creation: concurrent/replayed requests fail closed.
    ticket.used = true;
    ticket.codeHash = '';
    properties.setProperty(key, JSON.stringify(ticket));
    const session = createSession_(hit.data.ParticipantID, 'EMAIL_RECOVERY');
    audit_('RECOVERY_REDEEMED', hit.data.ParticipantID, '', '', 'ACCEPTED', {}, session.sessionId, 'INFO');
    return { sessionToken: session.rawToken, participant: publicParticipant_(hit.data) };
  } finally { lock.releaseLock(); }
}

// Private editor diagnostics: never returns codes, tokens, or participant details.
function inspectRecoveryDelivery() {
  const properties = PropertiesService.getScriptProperties().getProperties();
  const tickets = Object.keys(properties).filter(function (key) { return key.indexOf('HPQ_EMAIL_RECOVERY_') === 0; }).map(function (key) {
    try { return JSON.parse(properties[key]); } catch (_) { return {}; }
  });
  const events = objects_('AuditLog').filter(function (row) { return /^RECOVERY_/.test(String(row.data.EventType)); });
  console.log(JSON.stringify({
    tickets: tickets.length,
    acceptedByGoogle: tickets.filter(function (t) { return t.delivered; }).length,
    consumed: tickets.filter(function (t) { return t.used; }).length,
    mostRecentRequest: tickets.length ? new Date(Math.max.apply(null, tickets.map(function (t) { return Number(t.sentAt || 0); }))).toISOString() : null,
    recentEvents: events.slice(-5).map(function (row) { return { event: row.data.EventType, at: row.data.Timestamp, result: row.data.Result }; }),
    activeParticipants: objects_('Participants').filter(function (row) { return String(row.data.Status).toUpperCase() === 'ACTIVE'; }).length,
    remainingQuota: MailApp.getRemainingDailyQuota()
  }));
}
