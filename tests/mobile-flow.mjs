import fs from 'node:fs';
import http from 'node:http';
import path from 'node:path';
import assert from 'node:assert/strict';
import { createRequire } from 'node:module';
import { createBackend } from './security-regression.mjs';
const require = createRequire(import.meta.url);
const { chromium } = require('C:/Users/SEE/.cache/codex-runtimes/codex-primary-runtime/dependencies/node/node_modules/playwright');
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
    await p.locator('#register-form button[type=submit]').click();
    await p.locator('#view-pass').waitFor({ state: 'visible' });
    assert.equal(await p.locator('#qr-code canvas').count(), 1);
    assert(await p.evaluate(() => document.documentElement.scrollWidth <= window.innerWidth));
    await p.screenshot({ path: 'test-output/mobile-' + (i + 1) + '-pass.png', fullPage: true });
  }
  const rows = backend.tables.get('Participants');
  await pages[0].goto(base + '/?candidate=' + rows[1].QRToken);
  await pages[0].locator('#view-candidate').waitFor({ state: 'visible' });
  assert.match(await pages[0].locator('#identity-note').textContent(), /Ana/);
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
  await intruder.goto(base);
  await intruder.locator('#first-name').fill('Intruso');
  await intruder.locator('#last-name').fill('QA');
  await intruder.locator('#email').fill('QA.ANA@HP.COM');
  await intruder.locator('#terms').check();
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
  console.log('PASS: two isolated mobile browsers, registration, QR rendering, candidate, vote, self-vote, duplicate vote, duplicate-email takeover and identity preservation on network failure. Physical phones and optical QR scan still require real-device validation.');
} finally {
  await browser.close();
  server.close();
}
