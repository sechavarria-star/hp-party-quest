import fs from 'node:fs';

const [apiUrl, frontendUrl, output = 'frontend/config.js'] = process.argv.slice(2);
const validApi = /^https:\/\/script\.google\.com\/macros\/s\/[A-Za-z0-9_-]+\/exec$/;
const validFrontend = /^https:\/\/[A-Za-z0-9.-]+\/[A-Za-z0-9._~/-]*\/?$/;

if (!validApi.test(apiUrl || '')) throw new Error('Invalid Apps Script /exec URL.');
if (!validFrontend.test(frontendUrl || '')) throw new Error('Invalid frontend URL.');

const canonicalFrontend = frontendUrl.endsWith('/') ? frontendUrl : `${frontendUrl}/`;
const js = `window.HPQ_CONFIG = Object.freeze({\n` +
  `  API_URL: ${JSON.stringify(apiUrl)},\n` +
  `  FRONTEND_URL: ${JSON.stringify(canonicalFrontend)},\n` +
  `  EVENT_NAME: 'HP Party Quest',\n` +
  `  EVENT_TAGLINE: 'Conectate. Explorá. Votá.',\n` +
  `  ACTIVE_CHALLENGE_ID: 'CH-COOL-GLASSES',\n` +
  `  REQUEST_TIMEOUT_MS: 45000\n` +
  `});\n`;

fs.writeFileSync(output, js, 'utf8');
console.log(JSON.stringify({ ok: true, output, apiUrl, frontendUrl: canonicalFrontend }));
