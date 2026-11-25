import fs from 'node:fs';
import vm from 'node:vm';
import crypto from 'node:crypto';
import assert from 'node:assert/strict';
import { fileURLToPath } from 'node:url';
import { resolve } from 'node:path';

export function createBackend() {
  const tables = new Map();
  const properties = new Map([['HPQ_SPREADSHEET_ID', 'QA_SPREADSHEET']]);
  const cache = new Map();
  let locked = false;
  const context = vm.createContext({
    console: { log() {}, error() {}, warn() {} },
    PropertiesService: { getScriptProperties: () => ({
      getProperty: key => properties.has(key) ? properties.get(key) : null,
      setProperty: (key, value) => properties.set(key, String(value))
    }) },
    CacheService: { getScriptCache: () => ({ get: key => cache.get(key) || null, put: (key, value) => cache.set(key, value), remove: key => cache.delete(key) }) },
    Utilities: {
      getUuid: () => crypto.randomUUID(),
      base64EncodeWebSafe: value => Buffer.from(value).toString('base64url'),
      base64Decode: value => [...Buffer.from(value, 'base64')],
      computeDigest: (_, value) => [...crypto.createHash('sha256').update(value).digest()],
      DigestAlgorithm: { SHA_256: 'SHA_256' }, Charset: { UTF_8: 'UTF-8' }
    },
    LockService: { getScriptLock: () => ({
      waitLock() { assert.equal(locked, false); locked = true; },
      releaseLock() { locked = false; }
    }) }
  });
  for (const file of ['Code.gs', 'Security.gs', 'Data.gs', 'Setup.gs', 'Selfies.gs', 'Recovery.gs', 'Dashboard.gs'])
    vm.runInContext(fs.readFileSync('backend/' + file, 'utf8'), context, { filename: file });
  const schema = vm.runInContext('HPQ_SCHEMA', context);
  for (const key of Object.keys(schema)) tables.set(key, []);
  context.objects_ = name => tables.get(name).map((data, i) => ({ data, rowNumber: i + 2 }));
  context.appendObject_ = (name, object) => tables.get(name).push({ ...object });
  context.updateCell_ = (name, row, field, value) => { tables.get(name)[row - 2][field] = value; };
  context.sheet_ = name => {
    assert.equal(name, 'Selfies', 'mock direct sheet access is reserved for photo row storage');
    return {
      getLastRow: () => tables.get(name).length + 1,
      getRange(row, col, count = 1, columns = 1) {
        return {
          createTextFinder(target) {
            return {
              matchEntireCell() { return this; }, useRegularExpression() { return this; },
              findNext() {
                const i = tables.get(name).findIndex(data => String(data.ParticipantID) === String(target));
                return i < 0 ? null : { getRow: () => i + 2 };
              }
            };
          },
          getValues: () => Array.from({ length: count }, (_, i) => schema[name].slice(col - 1, col - 1 + columns).map(key => tables.get(name)[row - 2 + i][key] || '')),
          setValues: values => values.forEach((items, i) => {
            items.forEach((value, j) => { tables.get(name)[row - 2 + i][schema[name][col - 1 + j]] = value; });
          })
        };
      }
    };
  };
  context.seedConfig_();
  context.seedChallenge_();
  context.upsertConfig_('FRONTEND_BASE_URL', 'https://sechavarria-star.github.io/hp-party-quest/');
  return { context, tables, properties, call(action, payload) { return context.routeAction_(action, payload); } };
}

export function runSecurityTests() {
  const { context, tables, call } = createBackend();
  const photo = 'data:image/jpeg;base64,' + fs.readFileSync(new URL('./fixtures/selfie-qa.jpg', import.meta.url)).toString('base64');
  const register = (email, name = 'Prueba') => call('register', {
    firstName: name, lastName: 'QA', email, termsAccepted: true, selfieDataUrl: photo, selfieConsent: true
  });
  const alice = register(' qa.alice@hp.com ', 'Alice');
  const bob = register('qa.bob@hp.com', 'Bob');
  assert.equal(tables.get('Participants').length, 2);
  assert.equal(tables.get('Sessions').length, 2);
  assert(!JSON.stringify(alice.participant).includes('@'));
  const sessionCount = tables.get('Sessions').length;
  for (const payload of [
    { email: 'QA.ALICE@HP.COM', firstName: 'Intruso', lastName: 'QA', termsAccepted: true },
    { email: 'qa.alice@hp.com', firstName: 'Alice', lastName: 'QA', termsAccepted: true, qrToken: alice.participant.qrToken },
    { email: 'qa.alice@hp.com', firstName: 'Alice', lastName: 'QA', termsAccepted: true, sessionToken: bob.sessionToken }
  ]) assert.throws(() => call('register', { selfieDataUrl: photo, selfieConsent: true, ...payload }), error => error.code === 'EMAIL_ALREADY_REGISTERED');
  assert.equal(tables.get('Sessions').length, sessionCount, 'duplicate email must not mint a session');
  assert.equal(tables.get('Participants').length, 2);
  assert.throws(() => call('session', { sessionToken: alice.participant.qrToken }), e => e.code === 'INVALID_SESSION');
  const vote = { sessionToken: alice.sessionToken, candidateQrToken: bob.participant.qrToken, challengeId: 'CH-COOL-GLASSES' };
  assert.throws(() => call('vote', { ...vote, candidateQrToken: alice.participant.qrToken }), e => e.code === 'SELF_VOTE');
  call('vote', { ...vote, voterParticipantId: bob.participant.participantId });
  assert.equal(tables.get('Votes')[0].VoterParticipantID, alice.participant.participantId, 'voter comes from session');
  assert.throws(() => call('vote', vote), e => e.code === 'DUPLICATE_VOTE');
  assert.equal(tables.get('Votes').length, 1);
  tables.get('Sessions')[1].ExpiresAt = new Date(0);
  assert.throws(() => call('session', { sessionToken: bob.sessionToken }), e => e.code === 'SESSION_EXPIRED');
  assert.throws(() => register('qa.external@example.com'), e => e.code === 'EMAIL_DOMAIN_NOT_ALLOWED');
  const challenge = tables.get('Challenges')[0];
  challenge.Status = 'CLOSED';
  assert.throws(() => call('vote', vote), e => e.code === 'CHALLENGE_CLOSED');
  assert(tables.get('AuditLog').some(row => row.Result === 'RECOVERY_REQUIRED'));
  console.log('Security: duplicate-email takeover, QR/session separation, self-vote, duplicate vote, voter spoofing, expiry, domain and closed challenge: OK');
}
if (process.argv[1] && fileURLToPath(import.meta.url) === resolve(process.argv[1])) runSecurityTests();
