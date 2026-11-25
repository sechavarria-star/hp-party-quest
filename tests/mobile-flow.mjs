import fs from 'node:fs';
import http from 'node:http';
import path from 'node:path';
import assert from 'node:assert/strict';
import { createRequire } from 'node:module';
import { createBackend } from './security-regression.mjs';
const require = createRequire(import.meta.url);
const { chromium } = require('C:/Users/SEE/.cache/codex-runtimes/codex-primary-runtime/dependencies/node/node_modules/playwright');
const selfieFile = path.resolve('tests/fixtures/selfie-qa.jpg');
const backend = createBackend();
const api = 'https://script.google.com/macros/s/qa-isolated/exec';
const server = http.createServer((req, res) => {
  const name = new URL(req.url, 'http://localhost').pathname;
  if (name === '/config.js') {
    res.setHeader('Content-Type', 'text/javascript');
    res.end('window.HPQ_CONFIG=' + JSON.stringify({ API_URL: api, REQUEST_TIMEOUT_MS: 10000 }) + ';');
    return;
  }
  const file = path.resolve('frontend', '.' + (name === '/' ? '/index.html' : name));
  if (!file.startsWith(path.resolve('frontend') + path.sep)) { res.writeHead(403).end(); return; }
  if (!fs.existsSync(file)) { res.writeHead(404).end(); return; }
  res.setHeader('Content-Type', file.endsWith('.js') ? 'text/javascript' : file.endsWith('.css') ? 'text/css' : 'text/html');
  res.end(fs.readFileSync(file));
});
await new Promise(resolve => server.listen(0, '127.0.0.1', resolve));
const base = 'http://127.0.0.1:' + server.address().port;
const browser = await chromium.launch({ executablePath: 'C:/Program Files (x86)/Microsoft/Edge/Application/msedge.exe', headless: true });
fs.mkdirSync('test-output', { recursive: true });
try {
  const contexts = [];
  for (const viewport of [{ width: 390, height: 844 }, { width: 412, height: 915 }]) {
    const c = await browser.newContext({ viewport, isMobile: true, hasTouch: true });
    await c.route(api, async route => {
      const form = new URLSearchParams(route.request().postData());
      let result;
      try { result = { ok: true, data: backend.call(form.get('action'), JSON.parse(form.get('payload'))) }; }
      catch (e) { result = { ok: false, code: e.code || 'ERROR', message: e.publicMessage || e.message }; }
      await route.fulfill({ contentType: 'application/json', body: JSON.stringify(result) });
    });
    contexts.push(c);
  }
  const pages = await Promise.all(contexts.map(c => c.newPage()));
  for (const [i, p] of pages.entries()) {
    await p.goto(base);
    await p.locator('#first-name').fill(i ? 'Beto' : 'Ana');
    await p.locator('#last-name').fill('QA');
    await p.locator('#email').fill(i ? 'qa.beto@hp.com' : 'qa.ana@hp.com');
    await p.locator('#terms').check();
    {
      await p.locator('#register-form button[type=submit]').click();
      await p.locator('#register-error').waitFor({ state: 'visible' });
      assert.match(await p.locator('#register-error').textContent(), /selfie es obligatoria/);
      assert.equal(backend.tables.get('Participants').length, i, 'missing selfie never registers');
      await p.locator('#register-selfie-file').setInputFiles(selfieFile);
      await p.locator('#register-selfie-preview').waitFor({ state: 'visible' });
      await p.locator('#register-form button[type=submit]').click();
      await p.locator('#register-error').waitFor({ state: 'visible' });
      assert.equal(backend.tables.get('Participants').length, i, 'photo consent required before registration');
      await p.locator('#register-selfie-consent').check();
    }
    await p.locator('#register-form button[type=submit]').click();
    await p.locator('#view-pass').waitFor({ state: 'visible' });
    assert.equal(await p.locator('#qr-code canvas').count(), 1);
    assert(await p.evaluate(() => document.documentElement.scrollWidth <= window.innerWidth));
    await p.screenshot({ path: 'test-output/mobile-' + (i + 1) + '-pass.png', fullPage: true });
  }
  const exportPage = pages[0];
  await exportPage.waitForFunction(() => !document.getElementById('download-pass').disabled);
  await exportPage.evaluate(() => {
    Object.defineProperty(navigator, 'canShare', { configurable: true, value: data => data.files?.[0]?.type === 'image/png' });
    Object.defineProperty(navigator, 'share', { configurable: true, value: async data => {
      window.sharedPass = { name: data.files[0].name, type: data.files[0].type, bytes: Array.from(new Uint8Array(await data.files[0].arrayBuffer())) };
    }});
  });
  await exportPage.locator('#download-pass').click();
  await exportPage.locator('#pass-image-options').waitFor({ state: 'visible' });
  const shared = await exportPage.evaluate(() => window.sharedPass);
  assert.equal(shared.type, 'image/png');
  assert.match(shared.name, /^HP-Kick-Off-27-Quest-P-.+\.png$/);
  const sharp = require('C:/Users/SEE/.cache/codex-runtimes/codex-primary-runtime/dependencies/node/node_modules/sharp');
  const decoded = await sharp(Buffer.from(shared.bytes)).ensureAlpha().raw().toBuffer({ resolveWithObject: true });
  assert.equal(decoded.info.width, 1080); assert.equal(decoded.info.height, 1350);
  const jsqr = require('../../../../party-quest-qa-tools/node_modules/jsqr');
  const qr = jsqr(new Uint8ClampedArray(decoded.data), 1080, 1350);
  assert.equal(new URL(qr.data).searchParams.get('candidate'), backend.tables.get('Participants')[0].QRToken);
  await exportPage.reload();
  await exportPage.waitForFunction(() => !document.getElementById('download-pass').disabled);
  await exportPage.evaluate(() => Object.defineProperty(navigator, 'share', { configurable: true, value: async () => { throw new DOMException('Canceled', 'AbortError'); }}));
  await exportPage.locator('#download-pass').click();
  assert.equal(await exportPage.locator('#pass-image-options').isVisible(), false, 'cancel does not download or open fallback');
  await exportPage.evaluate(() => Object.defineProperty(navigator, 'canShare', { configurable: true, value: () => false }));
  await exportPage.locator('#download-pass').click();
  await exportPage.locator('#pass-image-options').waitFor({ state: 'visible' });
  const downloadPromise = exportPage.waitForEvent('download');
  await exportPage.locator('#download-pass-png').click();
  assert.equal((await downloadPromise).suggestedFilename(), shared.name);
  const rows = backend.tables.get('Participants');
  rows[0].SelfieUpdatedAt = '';
  const photoRows = backend.tables.get('Selfies');
  photoRows.splice(photoRows.findIndex(row => row.ParticipantID === rows[0].ParticipantID), 1);
  await pages[0].reload();
  await pages[0].locator('#view-pass').waitFor({ state: 'visible' });
  assert.equal(await pages[0].locator('#party-pass').isVisible(), false);
  assert.equal(await pages[0].locator('#pass-selfie-section').getAttribute('open'), '');
  const originalQr = rows[0].QRToken;
  await pages[0].locator('#pass-selfie-file').setInputFiles(selfieFile);
  await pages[0].locator('#pass-selfie-preview').waitFor({ state: 'visible' });
  await pages[0].locator('#pass-selfie-consent').check();
  await pages[0].locator('#save-selfie').click();
  await pages[0].locator('#party-pass').waitFor({ state: 'visible' });
  assert.equal(rows[0].QRToken, originalQr);
  await pages[0].goto(base + '/?candidate=' + rows[1].QRToken);
  await pages[0].locator('#view-candidate').waitFor({ state: 'visible' });
  assert.match(await pages[0].locator('#identity-note').textContent(), /Ana/);
  assert.equal(await pages[0].locator('#candidate-prompt').textContent(), 'Ana, estás por votar a');
  assert.equal(await pages[0].locator('#candidate-name').textContent(), 'Beto Q.');
  await pages[0].locator('#candidate-photo').waitFor({ state: 'visible' });
  assert(await pages[0].locator('#candidate-photo').evaluate(image => image.complete && image.naturalWidth > 0));
  await pages[0].screenshot({ path: 'test-output/mobile-selfie-confirmation.png', fullPage: true });
  await pages[0].locator('#vote-button').click();
  await pages[0].locator('#view-voted').waitFor({ state: 'visible' });
  await pages[0].screenshot({ path: 'test-output/mobile-vote-confirmed.png', fullPage: true });
  await pages[0].goto(base + '/?candidate=' + rows[1].QRToken);
  await pages[0].locator('#vote-button').click();
  await pages[0].locator('#vote-error').waitFor({ state: 'visible' });
  assert.match(await pages[0].locator('#vote-error').textContent(), /Ya usaste/);
  await pages[1].goto(base + '/?candidate=' + rows[1].QRToken);
  await pages[1].locator('#vote-button').click();
  await pages[1].locator('#vote-error').waitFor({ state: 'visible' });
  assert.match(await pages[1].locator('#vote-error').textContent(), /vos mismo/);
  const third = await browser.newContext({ viewport: { width: 390, height: 844 } });
  await third.route(api, async route => {
    const form = new URLSearchParams(route.request().postData());
    let result;
    try { result = { ok: true, data: backend.call(form.get('action'), JSON.parse(form.get('payload'))) }; }
    catch (e) { result = { ok: false, code: e.code, message: e.publicMessage }; }
    await route.fulfill({ contentType: 'application/json', body: JSON.stringify(result) });
  });
  const intruder = await third.newPage();
  await intruder.goto(base + '/?candidate=' + rows[1].QRToken);
  await intruder.locator('#view-candidate').waitFor({ state: 'visible' });
  assert.equal(await intruder.locator('#candidate-photo').isVisible(), false, 'anonymous visitor cannot see the photo');
  await intruder.goto(base);
  await intruder.locator('#first-name').fill('Intruso');
  await intruder.locator('#last-name').fill('QA');
  await intruder.locator('#email').fill('QA.ANA@HP.COM');
  await intruder.locator('#terms').check();
  await intruder.locator('#register-selfie-file').setInputFiles(selfieFile);
  await intruder.locator('#register-selfie-preview').waitFor({ state: 'visible' });
  await intruder.locator('#register-selfie-consent').check();
  await intruder.locator('#register-form button[type=submit]').click();
  await intruder.locator('#register-error').waitFor({ state: 'visible' });
  assert.match(await intruder.locator('#register-error').textContent(), /ya está registrado/);
  assert.equal(backend.tables.get('Participants').length, 2);
  assert.equal(backend.tables.get('Sessions').length, 2);
  assert.equal(backend.tables.get('Votes').length, 1);
  await contexts[0].route(api, route => route.abort('failed'));
  await pages[0].goto(base);
  await pages[0].locator('#view-error').waitFor({ state: 'visible' });
  assert(await pages[0].evaluate(() => Boolean(localStorage.getItem('hpq.sessionToken.v1'))), 'temporary network error preserves identity');
  assert.equal(await pages[0].locator('#session-reset-options').isVisible(), false, 'network errors never offer credential removal');
  await contexts[1].route(api, async route => route.fulfill({ contentType: 'application/json', body: JSON.stringify({ ok: false, code: 'INVALID_SESSION', message: 'No encontramos tu sesión.' }) }));
  const previousToken = await pages[1].evaluate(() => localStorage.getItem('hpq.sessionToken.v1'));
  await pages[1].goto(base + '?candidate=' + rows[0].QRToken);
  await pages[1].locator('#session-reset-options').waitFor({ state: 'visible' });
  assert.equal(await pages[1].evaluate(() => localStorage.getItem('hpq.sessionToken.v1')), previousToken, 'invalid token preserved until explicit choice');
  await pages[1].locator('#restart-registration').click();
  await pages[1].locator('#view-register').waitFor({ state: 'visible' });
  assert.equal(await pages[1].evaluate(() => localStorage.getItem('hpq.sessionToken.v1')), null);
  assert.equal(new URL(pages[1].url()).searchParams.get('candidate'), rows[0].QRToken, 'scanned candidate survives restart');
  assert.equal(backend.tables.get('Participants').length, 2, 'restart does not alter participants');
  assert.equal(backend.tables.get('Votes').length, 1, 'restart does not alter votes');
  await intruder.goto(base + '?volver=1&candidate=' + rows[1].QRToken);
  await intruder.locator('#view-recover').waitFor({ state: 'visible' });
  assert.equal(new URL(intruder.url()).searchParams.has('volver'), false, 'entry parameter removed so normal session restore keeps working');
  await intruder.locator('#recovery-email').fill('qa.ana@hp.com');
  await intruder.locator('#recover-access').click();
  await intruder.locator('#view-candidate').waitFor({ state: 'visible' });
  assert.match(await intruder.locator('#identity-note').textContent(), /Ana/);
  await intruder.locator('#show-my-pass').click();
  await intruder.locator('#view-pass').waitFor({ state: 'visible' });
  assert.equal((await intruder.locator('#pass-id').textContent()).trim(), rows[0].ParticipantID);
  assert.equal(rows[0].QRToken, originalQr);
  assert.equal(backend.tables.get('Participants').length, 2);
  assert.equal(backend.tables.get('Votes').length, 1);
  assert.equal(backend.tables.get('Sessions').length, 3);
  assert.equal(await intruder.locator('#recovery-code').count(), 0, 'no code step');
  await intruder.reload();
  await intruder.locator('#view-candidate').waitFor({ state: 'visible' });
  assert.match(await intruder.locator('#identity-note').textContent(), /Ana/, 'email-only session persists');
  await intruder.screenshot({ path: 'test-output/mobile-email-recovery.png', fullPage: true });
  await intruder.goto(base + '?selfie=' + rows[1].QRToken);
  await intruder.locator('#view-selfie').waitFor({ state: 'visible' });
  assert.match(await intruder.locator('#selfie-name').textContent(), /Beto/);
  assert.match(await intruder.locator('#selfie-image').getAttribute('src'), /^data:image\/jpeg;base64,/);
  const selfieDownloadPromise = intruder.waitForEvent('download');
  await intruder.locator('#selfie-download').click();
  assert.equal((await selfieDownloadPromise).suggestedFilename(), 'Selfie-' + rows[1].ParticipantID + '.jpg');
  await intruder.evaluate(() => localStorage.removeItem('hpq.sessionToken.v1'));
  await intruder.reload();
  await intruder.locator('#view-recover').waitFor({ state: 'visible' });
  assert.equal(await intruder.locator('#selfie-image').getAttribute('src'), null, 'anonymous link never renders the photo');
  await intruder.locator('#recovery-email').fill('qa.ana@hp.com');
  await intruder.locator('#recover-access').click();
  await intruder.locator('#view-selfie').waitFor({ state: 'visible' });
  assert.match(await intruder.locator('#selfie-name').textContent(), /Beto/, 'return keeps target selfie');
  assert.equal(backend.tables.get('Votes').length, 1, 'viewing and downloading never cast a vote');
  await intruder.screenshot({ path: 'test-output/mobile-selfie-viewer.png', fullPage: true });
  const shareUrl = backend.context.announcementShareUrl_(rows[1], backend.context.getConfig_());
  await intruder.evaluate(() => localStorage.setItem('hpq.sessionToken.v1', 'old-invalid-session'));
  await intruder.goto(base + new URL(shareUrl).search);
  await intruder.locator('#view-selfie').waitFor({ state: 'visible' });
  assert.equal(await intruder.locator('#selfie-name').textContent(), 'Beto QA');
  assert.equal(await intruder.locator('#winner-message').textContent(), '¡Felicitaciones!');
  assert.equal(await intruder.locator('#winner-votes').textContent(), '1 voto obtenido');
  assert.equal(await intruder.locator('#recovery-email').isVisible(), false, 'shared announcement bypasses expired session and never asks for access');
  assert.equal(backend.tables.get('Votes').length, 1);
  await intruder.screenshot({ path: 'test-output/mobile-winner-announcement.png', fullPage: true });
  const thanksUrl = backend.context.thanksExportUrl_(backend.context.getConfig_());
  await intruder.addInitScript(() => {
    window.thanksDrawTexts = [];
    const draw = CanvasRenderingContext2D.prototype.fillText;
    CanvasRenderingContext2D.prototype.fillText = function (text, ...args) {
      if (this.canvas.width === 1080 && this.canvas.height === 1350) window.thanksDrawTexts.push(String(text));
      return draw.call(this, text, ...args);
    };
  });
  await intruder.goto(base + new URL(thanksUrl).search);
  await intruder.locator('#thanks-download-all:not([disabled])').waitFor();
  assert.match(await intruder.locator('#thanks-count').textContent(), /2 participantes/);
  const thanksDownloadPromise = intruder.waitForEvent('download');
  await intruder.locator('#thanks-download-all').click();
  const thanksDownload = await thanksDownloadPromise;
  assert.equal(thanksDownload.suggestedFilename(), 'HP-Kick-Off-27-Gracias-por-participar.zip');
  await thanksDownload.saveAs('test-output/thanks-cards.zip');
  const JSZip = require(path.resolve('frontend/assets/vendor/jszip-3.10.1.min.js'));
  const archive = await JSZip.loadAsync(fs.readFileSync('test-output/thanks-cards.zip'), { checkCRC32: true });
  const exported = Object.values(archive.files).filter(file => !file.dir);
  assert.equal(exported.length, 2);
  for (const file of exported) {
    assert.match(file.name, /\.png$/);
    const bytes = await file.async('uint8array');
    const metadata = await sharp(bytes).metadata();
    assert.equal(metadata.width, 1080); assert.equal(metadata.height, 1350);
    fs.writeFileSync('test-output/' + file.name, bytes);
  }
  const drawnText = await intruder.evaluate(() => window.thanksDrawTexts);
  assert(drawnText.includes('Gracias por participar'));
  assert(drawnText.includes('Ana QA')); assert(drawnText.includes('Beto QA'));
  assert(!drawnText.some(text => /voto/i.test(text)), 'thank-you images never show votes');
  assert.equal(backend.tables.get('Votes').length, 1);
  await intruder.screenshot({ path: 'test-output/thanks-export-page.png', fullPage: true });
  backend.tables.get('Participants').length = 0;
  await intruder.locator('#thanks-refresh').click();
  await intruder.waitForFunction(() => document.getElementById('thanks-count').textContent.includes('Todavía no hay participantes'));
  assert.equal(await intruder.locator('#thanks-download-all').isDisabled(), true, 'cleaned database cannot generate an empty archive');
  console.log('PASS: thank-you PNG ZIP download, full names without votes and empty roster; public winner announcement, fullname, photo and votes; selfie links, authenticated viewer and JPEG download; email-only return keeps original participant, QR and votes; explicit recovery from a stale test credential; two isolated mobile browsers, registration, QR rendering, candidate, vote, self-vote, duplicate vote, duplicate registration and identity preservation on network failure. Physical phones and optical QR scan still require real-device validation.');
} finally {
  await browser.close();
  server.close();
}
