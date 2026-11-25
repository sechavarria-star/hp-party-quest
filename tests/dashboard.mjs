import assert from 'node:assert/strict';
import fs from 'node:fs';
import { createBackend } from './security-regression.mjs';
const { context, tables, properties, call } = createBackend();
const photo = 'data:image/jpeg;base64,' + fs.readFileSync(new URL('./fixtures/selfie-qa.jpg', import.meta.url)).toString('base64');
const register = (email, firstName) => call('register', { email, firstName, lastName: 'QA', termsAccepted: true, selfieDataUrl: photo, selfieConsent: true });
const ana = register('qa.dashboard.ana@hp.com', 'Ana');
const beto = register('qa.dashboard.beto@hp.com', 'Beto');
const challengeId = 'CH-COOL-GLASSES';
let refreshes = 0;
const originalSafe = context.refreshDashboardSafely_;
context.refreshDashboardSafely_ = () => { refreshes++; return true; };
call('vote', { sessionToken: ana.sessionToken, candidateQrToken: beto.participant.qrToken, challengeId });
assert.equal(refreshes, 1, 'accepted vote refreshes dashboard');
assert.throws(() => call('vote', { sessionToken: ana.sessionToken, candidateQrToken: beto.participant.qrToken, challengeId }), e => e.code === 'DUPLICATE_VOTE');
assert.equal(refreshes, 2, 'rejected attempts refresh displayed rejection count');
const originalRefresh = context.refreshDashboard_;
context.refreshDashboard_ = () => { throw new Error('Display unavailable'); };
context.refreshDashboardSafely_ = originalSafe;
call('vote', { sessionToken: beto.sessionToken, candidateQrToken: ana.participant.qrToken, challengeId });
assert.equal(tables.get('Votes').length, 2, 'display failure does not fail a saved vote');
assert.equal(properties.get('HPQ_DASHBOARD_DIRTY'), '1');
context.refreshDashboard_ = originalRefresh;
const sourceBefore = JSON.stringify({ participants: tables.get('Participants'), votes: tables.get('Votes') });
const data = context.dashboardSnapshot_(tables.get('Participants'), tables.get('Votes'), tables.get('AuditLog'), challengeId);
assert.equal(data.activeParticipants, 2); assert.equal(data.validVotes, 2); assert.equal(data.voters, 2);
assert.equal(data.participation, 1); assert.equal(data.rejections, 1);
assert.deepEqual(Array.from(data.ranking, row => Number(row[0])), [1, 1], 'ties share position');
assert.equal(data.ranking.reduce((sum, row) => sum + row[3], 0), data.validVotes);
const other = context.dashboardSnapshot_(tables.get('Participants'), tables.get('Votes').concat([
  { ChallengeID: challengeId, Valid: false, VoterParticipantID: 'X', CandidateParticipantID: 'X' },
  { ChallengeID: 'OTHER', Valid: true, VoterParticipantID: 'Y', CandidateParticipantID: 'Y' }
]), [], challengeId);
assert.equal(other.validVotes, 2, 'ignore invalid and other-challenge votes');
const output = new Map(); const clears = [];
context.SpreadsheetApp = { newRichTextValue() {
  const value = { text: '', url: '' };
  return { setText(text) { value.text = text; return this; }, setLinkUrl(url) { value.url = url; return this; }, build() { return value; } };
}};
tables.get('Winners').push({ ResultID: 'W-QA', ParticipantID: ana.participant.participantId, Position: 2, FinalVotes: 7, Confirmed: true });
const dashboard = { setColumnWidth() {}, getRange(...args) {
  const key = args.join(':');
  const range = {
    breakApart() { return range; }, clearContent() { clears.push(key); output.delete(key); return range; },
    merge() { return range; }, setValue(value) { output.set(key, value); return range; },
    setValues(values) { output.set(key, JSON.parse(JSON.stringify(values))); return range; },
    setRichTextValues(values) { output.set(key, JSON.parse(JSON.stringify(values))); return range; },
    setBackground() { return range; }, setFontColor() { return range; }, setFontWeight() { return range; },
    setWrap() { return range; }, setFontSize() { return range; }, setNumberFormat() { return range; }
  };
  return range;
} };
context.sheet_ = name => { assert.equal(name, 'Dashboard'); return dashboard; };
context.refreshDashboard_();
assert.equal(output.get('A6:B10')[1][1], 2);
assert.equal(output.get('5:4:2:4').reduce((sum, row) => sum + row[3], 0), 2);
assert.equal(properties.get('HPQ_DASHBOARD_DIRTY'), '0');
const selfieLink = output.get('5:8:2:1')[0][0];
assert.equal(selfieLink.text, 'Ver selfie');
assert.equal(new URL(selfieLink.url).searchParams.get('selfie'), ana.participant.qrToken);
assert.equal(context.participantSelfieUrl_({ QRToken: 'QR' }, { FRONTEND_BASE_URL: 'https://example.com/' }), '', 'missing selfie gets no link');
assert.equal(new URL(tables.get('Winners')[0].SelfieURL).searchParams.get('selfie'), ana.participant.qrToken);
assert.equal(tables.get('Winners')[0].Position, 2); assert.equal(tables.get('Winners')[0].FinalVotes, 7); assert.equal(tables.get('Winners')[0].Confirmed, true, 'links never alter winner decisions');
tables.get('Votes')[0].Valid = false;
context.refreshDashboard_();
assert.equal(output.get('A6:B10')[1][1], 1);
assert(clears.includes('5:4:10:5'), 'clear stale ranking rows after an invalidation');
tables.get('Votes')[0].Valid = true;
assert.equal(JSON.stringify({ participants: tables.get('Participants'), votes: tables.get('Votes') }), sourceBefore, 'refresh preserves original records');
console.log('Dashboard: automatic refresh, challenge/validity filters, counts, ties, stale rows, preserved records and saved-vote safety on display failure: OK');
