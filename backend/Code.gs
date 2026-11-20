const HPQ = Object.freeze({
  SPREADSHEET_ID: PropertiesService.getScriptProperties().getProperty('HPQ_SPREADSHEET_ID') || '',
  VERSION: '2.1.1',
  MAX_PAYLOAD_CHARS: 12000
});

function doGet(e) {
  const action = String((e && e.parameter && e.parameter.action) || 'health');
  if (action !== 'health') return jsonResponse_({ ok: false, code: 'METHOD_NOT_ALLOWED', message: 'Usá POST para esta operación.' });
  const bootstrap = ensureRuntimeReady_(String((e && e.parameter && e.parameter.frontend) || ''));
  return jsonResponse_({
    ok: true,
    data: {
      service: 'HP Party Quest API',
      version: HPQ.VERSION,
      spreadsheetConfigured: Boolean(HPQ.SPREADSHEET_ID),
      runtimeReady: bootstrap.ok,
      issues: bootstrap.issues,
      timestamp: new Date().toISOString()
    }
  });
}

function doPost(e) {
  try {
    const request = parseRequest_(e);
    ensureRuntimeReady_('');
    const data = routeAction_(request.action, request.payload);
    return jsonResponse_({ ok: true, data: data });
  } catch (error) {
    console.error(error && error.stack ? error.stack : error);
    return jsonResponse_({
      ok: false,
      code: error && error.code ? error.code : 'INTERNAL_ERROR',
      message: error && error.publicMessage ? error.publicMessage : 'No pudimos completar la operación. Intentá nuevamente.'
    });
  }
}

function parseRequest_(e) {
  if (!e || !e.parameter) throw appError_('BAD_REQUEST', 'La solicitud está vacía.');
  const action = String(e.parameter.action || '').trim();
  const raw = String(e.parameter.payload || '{}');
  if (!action) throw appError_('BAD_REQUEST', 'Falta indicar la operación.');
  if (raw.length > HPQ.MAX_PAYLOAD_CHARS) throw appError_('PAYLOAD_TOO_LARGE', 'La solicitud supera el tamaño permitido.');
  let payload;
  try { payload = JSON.parse(raw); } catch (_) { throw appError_('INVALID_JSON', 'La solicitud no tiene un formato válido.'); }
  return { action: action, payload: payload || {} };
}

function routeAction_(action, payload) {
  const routes = {
    register: registerParticipant_,
    session: getSessionParticipant_,
    candidate: getCandidate_,
    vote: castVote_
  };
  if (!routes[action]) throw appError_('UNKNOWN_ACTION', 'La operación solicitada no existe.');
  return routes[action](payload);
}

function registerParticipant_(payload) {
  assertAvailable_();
  assertRegistrationOpen_();
  const firstName = cleanName_(payload.firstName, 'nombre');
  const lastName = cleanName_(payload.lastName, 'apellido');
  const email = normalizeEmail_(payload.email);
  if (payload.termsAccepted !== true) throw appError_('TERMS_REQUIRED', 'Tenés que aceptar el consentimiento para registrarte.');
  validateEmailPolicy_(email);

  const lock = LockService.getScriptLock();
  lock.waitLock(20000);
  try {
    const config = getConfig_();
    const existing = objects_('Participants').find(function (row) {
      return String(row.data.EmailNormalized || row.data.Email || '').trim().toLowerCase() === email;
    });
    let participant;

    if (existing) {
      if (String(existing.data.Status || '').toUpperCase() !== 'ACTIVE') throw appError_('PARTICIPANT_BLOCKED', 'Este registro no está habilitado. Consultá a la organización.');
      audit_('REGISTRATION_DUPLICATE', existing.data.ParticipantID, '', '', 'RECOVERY_REQUIRED', {}, '', 'WARNING');
      throw appError_('EMAIL_ALREADY_REGISTERED', 'Ese email ya está registrado. Abrí el juego en el navegador donde creaste tu QR. Si perdiste el acceso, consultá a la organización.');
    } else {
      enforceCapacity_(config);
      const participantId = uniqueId_('P', 'Participants', 'ParticipantID');
      const qrToken = uniqueToken_('Participants', 'QRToken');
      const displayName = firstName + ' ' + lastName.charAt(0).toUpperCase() + '.';
      const frontend = validHttpsUrl_(config.FRONTEND_BASE_URL) ? stripQuery_(config.FRONTEND_BASE_URL) : '';
      const now = new Date();
      participant = {
        ParticipantID: participantId,
        FirstName: firstName,
        LastName: lastName,
        DisplayName: displayName,
        Email: email,
        EmailNormalized: email,
        AuthToken: '',
        QRToken: qrToken,
        QRUrl: frontend ? frontend + (frontend.indexOf('?') >= 0 ? '&' : '?') + 'candidate=' + encodeURIComponent(qrToken) : '',
        QRImageUrl: '',
        RegistrationDate: now,
        RegistrationSource: String(payload.registrationSource || 'GITHUB_PAGES').slice(0, 40),
        Status: 'ACTIVE',
        TermsAccepted: true,
        LastActivityAt: now,
        Notes: ''
      };
      appendObject_('Participants', participant);
      audit_('REGISTRATION_CREATED', participantId, '', '', 'ACCEPTED', { source: participant.RegistrationSource }, '', 'INFO');
    }

    const session = createSession_(participant.ParticipantID, payload.registrationSource || 'GITHUB_PAGES');
    return {
      duplicateRegistration: false,
      sessionToken: session.rawToken,
      participant: publicParticipant_(participant)
    };
  } finally {
    lock.releaseLock();
  }
}

function getSessionParticipant_(payload) {
  const auth = authenticateSession_(payload.sessionToken, true);
  return { participant: publicParticipant_(auth.participant) };
}

function getCandidate_(payload) {
  assertAvailable_();
  const qrToken = String(payload.qrToken || '').trim();
  if (!qrToken) throw appError_('INVALID_QR', 'El QR no contiene un participante válido.');
  const candidateHit = findOne_('Participants', 'QRToken', qrToken);
  if (!candidateHit || String(candidateHit.data.Status || '').toUpperCase() !== 'ACTIVE') throw appError_('INVALID_CANDIDATE', 'No encontramos un participante activo para este QR.');
  const challenge = getChallenge_(String(payload.challengeId || ''));
  return {
    candidate: publicParticipant_(candidateHit.data),
    challenge: publicChallenge_(challenge)
  };
}

function castVote_(payload) {
  assertAvailable_();
  const lock = LockService.getScriptLock();
  lock.waitLock(20000);
  let auth;
  let challenge;
  let candidate;
  try {
    auth = authenticateSession_(payload.sessionToken, false);
    challenge = getChallenge_(String(payload.challengeId || ''));
    candidate = findOne_('Participants', 'QRToken', String(payload.candidateQrToken || '').trim());
    if (!candidate || String(candidate.data.Status || '').toUpperCase() !== 'ACTIVE') {
      audit_('VOTE_REJECTED', auth.participant.ParticipantID, challenge.ChallengeID, '', 'INVALID_CANDIDATE', {}, auth.session.SessionID, 'WARNING');
      throw appError_('INVALID_CANDIDATE', 'El participante elegido no está disponible.');
    }
    validateChallengeOpen_(challenge);
    if (String(candidate.data.ParticipantID) === String(auth.participant.ParticipantID) && !toBoolean_(challenge.AllowSelfVote)) {
      audit_('VOTE_REJECTED', auth.participant.ParticipantID, challenge.ChallengeID, candidate.data.ParticipantID, 'SELF_VOTE', {}, auth.session.SessionID, 'INFO');
      throw appError_('SELF_VOTE', 'Buen intento 😏 No podés votarte a vos mismo.');
    }
    const voteKey = challenge.ChallengeID + '|' + auth.participant.ParticipantID;
    const existing = objects_('Votes').some(function (row) {
      return String(row.data.VoteKey) === voteKey && toBoolean_(row.data.Valid);
    });
    if (existing) {
      audit_('VOTE_REJECTED', auth.participant.ParticipantID, challenge.ChallengeID, candidate.data.ParticipantID, 'DUPLICATE_VOTE', {}, auth.session.SessionID, 'INFO');
      throw appError_('DUPLICATE_VOTE', 'Ya usaste tu voto para esta consigna.');
    }
    const now = new Date();
    appendObject_('Votes', {
      VoteID: uniqueId_('V', 'Votes', 'VoteID'),
      ChallengeID: challenge.ChallengeID,
      VoterParticipantID: auth.participant.ParticipantID,
      CandidateParticipantID: candidate.data.ParticipantID,
      VoteKey: voteKey,
      VotedAt: now,
      Valid: true,
      ValidationResult: 'ACCEPTED',
      SessionID: auth.session.SessionID,
      UserAgent: '',
      Source: 'QR_SCAN',
      InvalidatedAt: '',
      InvalidatedBy: '',
      AdminNotes: ''
    });
    audit_('VOTE_ACCEPTED', auth.participant.ParticipantID, challenge.ChallengeID, candidate.data.ParticipantID, 'ACCEPTED', {}, auth.session.SessionID, 'INFO');
    touchParticipant_(auth.participant.ParticipantID, now);
    return { candidateDisplayName: String(candidate.data.DisplayName), challengeId: challenge.ChallengeID, votedAt: now.toISOString() };
  } finally {
    lock.releaseLock();
  }
}

function validateChallengeOpen_(challenge) {
  if (String(challenge.Status || '').toUpperCase() !== 'OPEN') throw appError_('CHALLENGE_CLOSED', 'La votación todavía no está abierta o ya finalizó.');
  const now = new Date();
  const start = asDate_(challenge.StartDateTime);
  const end = asDate_(challenge.EndDateTime);
  if (start && now < start) throw appError_('CHALLENGE_NOT_STARTED', 'La votación todavía no comenzó.');
  if (end && now > end) throw appError_('CHALLENGE_CLOSED', 'La votación ya finalizó.');
}

function getChallenge_(requestedId) {
  const config = getConfig_();
  const challengeId = requestedId || String(config.ACTIVE_CHALLENGE_ID || '').trim();
  if (!challengeId) throw appError_('NO_ACTIVE_CHALLENGE', 'No hay una consigna activa.');
  const hit = findOne_('Challenges', 'ChallengeID', challengeId);
  if (!hit) throw appError_('INVALID_CHALLENGE', 'No encontramos la consigna activa.');
  return hit.data;
}

function publicParticipant_(row) {
  return {
    participantId: String(row.ParticipantID),
    displayName: String(row.DisplayName || (row.FirstName + ' ' + String(row.LastName || '').charAt(0) + '.')),
    qrToken: String(row.QRToken)
  };
}

function publicChallenge_(row) {
  return {
    challengeId: String(row.ChallengeID),
    name: String(row.ChallengeName || ''),
    description: String(row.Description || row.PublicMessage || ''),
    status: String(row.Status || ''),
    allowSelfVote: toBoolean_(row.AllowSelfVote)
  };
}

function jsonResponse_(body) {
  return ContentService.createTextOutput(JSON.stringify(body)).setMimeType(ContentService.MimeType.JSON);
}
