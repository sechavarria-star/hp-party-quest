// This download link is issued only inside the private organizer spreadsheet.
function thanksExportUrl_(config) {
  const base = stripQuery_(String(config.FRONTEND_BASE_URL || ''));
  if (!validHttpsUrl_(base)) return '';
  const properties = PropertiesService.getScriptProperties();
  let token = properties.getProperty('HPQ_THANKS_EXPORT_TOKEN');
  if (!token) {
    token = randomToken_();
    properties.setProperty('HPQ_THANKS_EXPORT_TOKEN', token);
  }
  return base + '?agradecimientos=' + encodeURIComponent(token);
}

function authorizeThanksExport_(payload) {
  const token = String(payload.token || '');
  const expected = PropertiesService.getScriptProperties().getProperty('HPQ_THANKS_EXPORT_TOKEN');
  if (!expected || !/^[A-Za-z0-9_-]{32,256}$/.test(token) || sha256_(token) !== sha256_(expected)) {
    throw appError_('EXPORT_NOT_AVAILABLE', 'Abrí la descarga desde el enlace de la planilla de organización.');
  }
}

function thanksParticipant_(participant) {
  return {
    participantId: String(participant.ParticipantID),
    fullName: (String(participant.FirstName || '') + ' ' + String(participant.LastName || '')).replace(/\s+/g, ' ').trim(),
    hasSelfie: Boolean(participant.SelfieUpdatedAt)
  };
}

function getThanksManifest_(payload) {
  authorizeThanksExport_(payload);
  const participants = objects_('Participants').map(function (r) { return r.data; }).filter(function (p) {
    return p.ParticipantID && String(p.Status).toUpperCase() === 'ACTIVE';
  }).map(thanksParticipant_);
  participants.sort(function (a, b) { return a.fullName.localeCompare(b.fullName) || a.participantId.localeCompare(b.participantId); });
  return { title: 'Gracias por participar', participants: participants, total: participants.length };
}

function getThanksImages_(payload) {
  authorizeThanksExport_(payload);
  const ids = payload.participantIds;
  if (!Array.isArray(ids) || ids.length < 1 || ids.length > 5 || ids.some(function (id) { return typeof id !== 'string' || id.length > 80; })) {
    throw appError_('INVALID_BATCH', 'No pudimos preparar este grupo de imágenes. Volvé a intentar.');
  }
  const byId = Object.create(null);
  objects_('Participants').forEach(function (row) {
    const p = row.data;
    if (String(p.Status).toUpperCase() === 'ACTIVE') byId[String(p.ParticipantID)] = p;
  });
  return {
    participants: ids.filter(function (id, i) { return ids.indexOf(id) === i; }).map(function (id) {
      if (!byId[id]) throw appError_('PARTICIPANT_CHANGED', 'La lista de participantes cambió. Actualizala antes de descargar.');
      const participant = thanksParticipant_(byId[id]);
      participant.selfieDataUrl = readSelfie_(id);
      participant.hasSelfie = Boolean(participant.selfieDataUrl);
      return participant;
    })
  };
}
