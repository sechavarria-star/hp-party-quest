function announcementGreeting_(firstName) {
  const name = String(firstName || '').normalize('NFD').replace(/[\u0300-\u036f]/g, '').trim().toLowerCase().split(/\s+/)[0];
  const feminine = 'ana maria julieta sofia laura florencia agustina carolina lucia paula mariana daniela patricia cecilia veronica romina fernanda victoria camila claudia alejandra silvia gabriela natalia adriana lorena marcela noelia elena graciela carla ines valentina'.split(' ');
  const masculine = 'sebastian julian julio carlos juan jose pablo pedro martin diego gustavo sergio jorge marcelo fernando alejandro daniel roberto manuel nicolas miguel leonardo ricardo francisco luis matias agustin gabriel tomas santiago federico andres lawrence'.split(' ');
  if (feminine.indexOf(name) >= 0) return '¡Felicitamos a la ganadora!';
  if (masculine.indexOf(name) >= 0) return '¡Felicitamos al ganador!';
  return '¡Felicitaciones!';
}

// Issued only by the private spreadsheet refresh. A public QR is not a share token.
function announcementShareUrl_(participant, config) {
  const base = stripQuery_(String(config.FRONTEND_BASE_URL || ''));
  const challengeId = String(config.ACTIVE_CHALLENGE_ID || '');
  if (!participant || !participant.SelfieUpdatedAt || !participant.ParticipantID || !challengeId || !validHttpsUrl_(base)) return '';
  const properties = PropertiesService.getScriptProperties();
  const index = 'HPQ_ANNOUNCEMENT_INDEX_' + sha256_(challengeId + '|' + participant.ParticipantID);
  let token = properties.getProperty(index);
  if (!token) {
    token = randomToken_();
    properties.setProperty('HPQ_ANNOUNCEMENT_' + sha256_(token), JSON.stringify({ participantId: String(participant.ParticipantID), challengeId: challengeId }));
    properties.setProperty(index, token);
  }
  return base + '?ganador=' + encodeURIComponent(token);
}

function getWinnerAnnouncement_(payload) {
  const unavailable = function () { return appError_('ANNOUNCEMENT_NOT_AVAILABLE', 'Este anuncio no está disponible.'); };
  const token = String(payload.token || '');
  if (!/^[A-Za-z0-9_-]{32,256}$/.test(token)) throw unavailable();
  let grant;
  try { grant = JSON.parse(PropertiesService.getScriptProperties().getProperty('HPQ_ANNOUNCEMENT_' + sha256_(token)) || 'null'); } catch (_) { grant = null; }
  if (!grant) throw unavailable();
  const hit = findOne_('Participants', 'ParticipantID', grant.participantId);
  if (!hit || String(hit.data.Status).toUpperCase() !== 'ACTIVE') throw unavailable();
  const photo = readSelfie_(grant.participantId);
  if (!photo) throw unavailable();
  const votes = objects_('Votes').filter(function (row) { return String(row.data.ChallengeID) === grant.challengeId && String(row.data.CandidateParticipantID) === grant.participantId && toBoolean_(row.data.Valid); }).length;
  const confirmed = objects_('Winners').find(function (row) { return String(row.data.ChallengeID) === grant.challengeId && String(row.data.ParticipantID) === grant.participantId && toBoolean_(row.data.Confirmed); });
  const finalVotes = confirmed && confirmed.data.FinalVotes !== '' ? Number(confirmed.data.FinalVotes) : NaN;
  const challenge = findOne_('Challenges', 'ChallengeID', grant.challengeId);
  return {
    greeting: announcementGreeting_(hit.data.FirstName),
    fullName: (String(hit.data.FirstName || '') + ' ' + String(hit.data.LastName || '')).replace(/\s+/g, ' ').trim(),
    selfieDataUrl: photo,
    votes: isFinite(finalVotes) && finalVotes >= 0 ? finalVotes : votes,
    challengeName: challenge ? String(challenge.data.ChallengeName || '') : '',
    eventName: "HP Kick Off '27"
  };
}
