import fs from 'node:fs';

const code = fs.readFileSync('backend/Code.gs', 'utf8');
const setup = fs.readFileSync('backend/Setup.gs', 'utf8');
const workflow = fs.readFileSync('.github/workflows/release-live.yml', 'utf8');
const renderer = fs.readFileSync('scripts/render-config.mjs', 'utf8');

const assertions = [
  [code.includes("VERSION: '2.3.0'"), 'backend version is 2.3.0'],
  [code.includes("ensureRuntimeReady_(String((e && e.parameter && e.parameter.frontend) || ''))"), 'health bootstraps runtime'],
  [code.includes("ensureRuntimeReady_('');"), 'POST bootstraps runtime'],
  [setup.includes('function ensureRuntimeReady_('), 'runtime bootstrap exists'],
  [setup.includes("upsertConfig_('APPS_SCRIPT_WEBAPP_URL'"), 'backend URL is self-configured'],
  [setup.includes("upsertConfig_('FRONTEND_BASE_URL'"), 'frontend URL is configured'],
  [!setup.includes('.createFilter('), 'setup does not overlap native table filters'],
  [workflow.includes('CLASPRC_JSON'), 'workflow consumes transferable Google auth only'],
  [workflow.includes('deploy-pages@v4'), 'workflow deploys GitHub Pages'],
  [workflow.includes('verify-live.mjs'), 'workflow performs live verification'],
  [renderer.includes('script\\.google\\.com'), 'config renderer validates Apps Script URL']
];
const failed = assertions.filter(([ok]) => !ok).map(([, label]) => label);
if (failed.length) throw new Error(`Deployment readiness failed: ${failed.join(', ')}`);
console.log(JSON.stringify({ ok: true, checks: assertions.map(([, label]) => label) }, null, 2));
