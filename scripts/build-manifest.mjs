import fs from 'node:fs';
import path from 'node:path';
import crypto from 'node:crypto';
import { execFileSync } from 'node:child_process';
const files = {};
function visit(dir = '.') {
  for (const item of fs.readdirSync(dir, { withFileTypes: true })) {
    if (['.git', 'node_modules', 'test-output', '.clasprc.json', '.clasp.json', 'RELEASE-MANIFEST.json', 'SHA256SUMS.txt'].includes(item.name)) continue;
    const name = path.posix.join(dir.replaceAll('\\', '/'), item.name);
    if (item.isDirectory()) visit(name);
    else files[name] = crypto.createHash('sha256').update(fs.readFileSync(name)).digest('hex');
  }
}
if (process.argv.includes('--staged')) {
  // Allow a frontend release while unrelated local backend work remains pending.
  const names = execFileSync('git', ['ls-files', '-z'], { encoding: 'utf8' }).split('\0').filter(Boolean);
  for (const name of names) {
    if (['RELEASE-MANIFEST.json', 'SHA256SUMS.txt'].includes(name)) continue;
    files[name] = crypto.createHash('sha256').update(execFileSync('git', ['show', ':' + name])).digest('hex');
  }
} else visit();
fs.writeFileSync('RELEASE-MANIFEST.json', JSON.stringify({
  name: 'HP Kick Off 27 Quest', version: '2.2.4', builtAt: new Date().toISOString(),
  releaseMode: 'Local Apps Script authentication + GitHub Pages Actions', files
}, null, 2) + '\n');
fs.writeFileSync('SHA256SUMS.txt', Object.entries(files).map(([name, hash]) => hash + '  ' + name).join('\n') + '\n');
console.log('Release manifest: ' + Object.keys(files).length + ' files; credentials and local test artifacts excluded.');
