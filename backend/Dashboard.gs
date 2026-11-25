function dashboardSnapshot_(participants, votes, events, challengeId) {
  const active = participants.filter(function (p) { return String(p.Status).toUpperCase() === 'ACTIVE'; });
  const names = {};
  participants.forEach(function (p) { names[String(p.ParticipantID)] = String(p.DisplayName || (p.FirstName + ' ' + p.LastName)); });
  const valid = votes.filter(function (v) { return String(v.ChallengeID) === challengeId && toBoolean_(v.Valid); });
  const voters = {};
  const counts = {};
  valid.forEach(function (v) {
    voters[String(v.VoterParticipantID)] = true;
    const id = String(v.CandidateParticipantID);
    counts[id] = (counts[id] || 0) + 1;
  });
  const ranking = Object.keys(counts).map(function (id) { return { id: id, name: names[id] || 'Participante no encontrado', votes: counts[id] }; });
  ranking.sort(function (a, b) { return b.votes - a.votes || a.name.localeCompare(b.name) || a.id.localeCompare(b.id); });
  let position = 0;
  const rows = ranking.map(function (item, index) {
    if (index === 0 || item.votes !== ranking[index - 1].votes) position = index + 1;
    return [position, item.id, item.name, item.votes];
  });
  const voted = Object.keys(voters).length;
  return {
    activeParticipants: active.length, validVotes: valid.length, voters: voted,
    participation: active.length ? voted / active.length : 0,
    rejections: events.filter(function (e) { return String(e.EventType) === 'VOTE_REJECTED' && String(e.ChallengeID) === challengeId; }).length,
    ranking: rows
  };
}

// Editor-only manual refresh; the public API does not expose this operation.
function refreshDashboard() {
  const lock = LockService.getScriptLock(); lock.waitLock(20000);
  try { return refreshDashboard_(); } finally { lock.releaseLock(); }
}

function refreshDashboard_() {
  const config = getConfig_();
  const id = String(config.ACTIVE_CHALLENGE_ID || '');
  const challenge = findOne_('Challenges', 'ChallengeID', id);
  const participants = objects_('Participants').map(function (r) { return r.data; });
  const participantById = {};
  participants.forEach(function (participant) { participantById[String(participant.ParticipantID)] = participant; });
  const snapshot = dashboardSnapshot_(
    participants,
    objects_('Votes').map(function (r) { return r.data; }),
    objects_('AuditLog').map(function (r) { return r.data; }), id
  );
  const sheet = sheet_('Dashboard');
  const properties = PropertiesService.getScriptProperties();
  if (properties.getProperty('HPQ_DASHBOARD_LAYOUT') !== '3') {
    // The imported template merged its explanatory note across the ranking.
    // Keep the note on the left so future rankings can grow down the right.
    sheet.getRange('A13:H15').breakApart().clearContent();
    sheet.getRange('A13:B15').merge().setValue('Se actualiza con cada voto. Solo se cuentan votos válidos de la consigna activa. Los empates comparten posición.').setWrap(true).setFontSize(10);
    [175,140,12,36,105,125,50,85].forEach(function (width, i) { sheet.setColumnWidth(i + 1, width); });
    properties.setProperty('HPQ_DASHBOARD_LAYOUT', '3');
  }
  sheet.getRange('A1').setValue("HP Kick Off '27 · Resultados");
  sheet.getRange('A4:B4').setValues([['Consigna activa', safeSheetValue_(id)]]).setWrap(true);
  sheet.getRange('A6:B10').setValues([
    ['Participantes activos', snapshot.activeParticipants], ['Votos válidos', snapshot.validVotes],
    ['Personas que votaron', snapshot.voters], ['Participación', snapshot.participation],
    ['Rechazos registrados', snapshot.rejections]
  ]);
  sheet.getRange('B6:B8').setNumberFormat('0');
  sheet.getRange('B9').setNumberFormat('0%');
  sheet.getRange('B10').setNumberFormat('0');
  sheet.getRange('D4:H4').setValues([['Pos.', 'Participante ID', 'Nombre', 'Votos', 'Selfie']]).setBackground('#102a4c').setFontColor('#ffffff').setFontWeight('bold');
  const previousRows = Number(properties.getProperty('HPQ_DASHBOARD_RANKING_ROWS') || 0);
  const outputRows = Math.max(10, previousRows, snapshot.ranking.length);
  sheet.getRange(5, 4, outputRows, 5).clearContent();
  if (snapshot.ranking.length) sheet.getRange(5, 4, snapshot.ranking.length, 4).setValues(snapshot.ranking.map(function (row) { return row.map(safeSheetValue_); }));
  if (snapshot.ranking.length) {
    const links = snapshot.ranking.map(function (row) {
      const url = participantSelfieUrl_(participantById[String(row[1])], config);
      const rich = SpreadsheetApp.newRichTextValue().setText(url ? 'Ver selfie' : 'Sin selfie');
      if (url) rich.setLinkUrl(url);
      return [rich.build()];
    });
    sheet.getRange(5, 8, links.length, 1).setRichTextValues(links);
  }
  refreshWinnerSelfieLinks_(participantById, config);
  properties.setProperty('HPQ_DASHBOARD_RANKING_ROWS', String(snapshot.ranking.length));
  properties.setProperty('HPQ_DASHBOARD_DIRTY', '0');
  return { challengeId: id, validVotes: snapshot.validVotes, rankedParticipants: snapshot.ranking.length };
}

function refreshDashboardSafely_() {
  try { refreshDashboard_(); return true; }
  catch (error) {
    // A display failure must never turn a saved vote into an API failure.
    try { PropertiesService.getScriptProperties().setProperty('HPQ_DASHBOARD_DIRTY', '1'); } catch (_) {}
    console.error('Dashboard refresh failed: ' + String(error && error.name || 'Error'));
    return false;
  }
}

function participantSelfieUrl_(participant, config) {
  if (!participant || !participant.SelfieUpdatedAt || !participant.QRToken) return '';
  const base = stripQuery_(String(config.FRONTEND_BASE_URL || ''));
  if (!validHttpsUrl_(base)) return '';
  return base + '?selfie=' + encodeURIComponent(String(participant.QRToken));
}

function refreshWinnerSelfieLinks_(participantById, config) {
  objects_('Winners').forEach(function (winner) {
    const participantId = String(winner.data.ParticipantID || '');
    if (!participantId) return;
    const url = participantSelfieUrl_(participantById[participantId], config);
    if (String(winner.data.SelfieURL || '') !== url) updateCell_('Winners', winner.rowNumber, 'SelfieURL', url);
  });
}
