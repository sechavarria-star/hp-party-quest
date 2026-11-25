const [apiUrl, frontendUrl] = process.argv.slice(2);
if (!apiUrl || !frontendUrl) throw new Error('Usage: node bootstrap-backend.mjs <api-url> <frontend-url>');

const health = new URL(apiUrl);
health.searchParams.set('action', 'health');
health.searchParams.set('frontend', frontendUrl);
let last;
for (let attempt = 0; attempt < 12; attempt += 1) {
  try {
    const response = await fetch(health, { redirect: 'follow', cache: 'no-store' });
    const text = await response.text();
    if (response.ok) {
      const body = JSON.parse(text);
      if (body.ok && body.data?.service === 'HP Party Quest API' && body.data?.version === '2.2.6' && body.data?.runtimeReady) {
        console.log(JSON.stringify(body, null, 2));
        process.exit(0);
      }
      last = new Error(`Backend not ready: ${text}`);
    } else last = new Error(`Backend returned ${response.status}`);
  } catch (error) { last = error; }
  await new Promise((resolve) => setTimeout(resolve, 5000));
}
throw last;
