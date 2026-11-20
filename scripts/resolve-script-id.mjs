import fs from 'node:fs';

const [input, title = 'HP Party Quest'] = process.argv.slice(2);
if (!input) throw new Error('Usage: node resolve-script-id.mjs <clasp-list-output> [title]');
const text = fs.readFileSync(input, 'utf8');
const lines = text.split(/\r?\n/).filter((line) => line.toLowerCase().includes(title.toLowerCase()));
const idPattern = /[A-Za-z0-9_-]{30,}/g;
const candidates = [...new Set(lines.flatMap((line) => line.match(idPattern) || []))];
if (candidates.length !== 1) {
  throw new Error(`Could not resolve exactly one Apps Script ID for ${JSON.stringify(title)}; found ${candidates.length}.`);
}
process.stdout.write(candidates[0]);
