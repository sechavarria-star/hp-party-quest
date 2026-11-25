// The organizer explicitly chose email-only access for this employee event.
// Knowing a registered email is sufficient; no mailbox verification is performed.
function recoverByEmail_(payload) {
  const email = normalizeEmail_(payload.email);
  const lock = LockService.getScriptLock(); lock.waitLock(20000);
  try {
    const hits = objects_('Participants').filter(function (row) {
      return String(row.data.EmailNormalized || row.data.Email || '').trim().toLowerCase() === email && String(row.data.Status || '').toUpperCase() === 'ACTIVE';
    });
    if (hits.length !== 1) throw appError_('EMAIL_NOT_REGISTERED', 'No encontramos un registro activo con ese email. Revisalo o registrate primero.');
    const session = createSession_(hits[0].data.ParticipantID, 'EMAIL_ONLY_RETURN');
    audit_('EMAIL_ACCESS_RESTORED', hits[0].data.ParticipantID, '', '', 'ACCEPTED', {}, session.sessionId, 'INFO');
    return { sessionToken: session.rawToken, participant: publicParticipant_(hits[0].data) };
  } finally { lock.releaseLock(); }
}
