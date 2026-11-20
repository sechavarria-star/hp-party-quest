const [apiUrl, frontendUrl] = process.argv.slice(2);
if (!apiUrl || !frontendUrl) throw new Error('Usage: node verify-live.mjs <api-url> <frontend-url>');

async function getText(url, attempts = 12) {
  let last;
  for (let i = 0; i < attempts; i += 1) {
    try {
      const response = await fetch(url, { redirect: 'follow', cache: 'no-store' });
      const text = await response.text();
      if (response.ok) return { response, text };
      last = new Error(`${url} returned ${response.status}`);
    } catch (error) { last = error; }
    await new Promise((resolve) => setTimeout(resolve, 5000));
  }
  throw last;
}

const healthUrl = new URL(apiUrl);
healthUrl.searchParams.set('action', 'health');
healthUrl.searchParams.set('frontend', frontendUrl);
const health = await getText(healthUrl.href);
const body = JSON.parse(health.text);
if (!body.ok || body.data?.service !== 'HP Party Quest API' || body.data?.version !== '2.1.1' || !body.data?.runtimeReady) {
  throw new Error(`Backend health verification failed: ${health.text}`);
}

const page = await getText(frontendUrl);
if (!/HP Party Quest/i.test(page.text)) throw new Error('Frontend HTML does not identify HP Party Quest.');
const config = await getText(new URL('config.js', frontendUrl).href);
if (config.text.includes('REEMPLAZAR') || !config.text.includes(apiUrl)) throw new Error('Live frontend configuration is incomplete.');

console.log(JSON.stringify({
  ok: true,
  backend: apiUrl,
  frontend: frontendUrl,
  version: body.data.version,
  runtimeReady: body.data.runtimeReady,
  issues: body.data.issues || []
}, null, 2));
