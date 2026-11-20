import fs from 'node:fs';
import vm from 'node:vm';
import assert from 'node:assert/strict';

const source = fs.readFileSync(new URL('../backend/Setup.gs', import.meta.url), 'utf8');
const executable = source
  .replace(/\/\*[\s\S]*?\*\//g, '')
  .replace(/\/\/.*$/gm, '');

assert.equal(
  /\.createFilter\s*\(/.test(executable),
  false,
  'setupProject must not create a basic filter over native Google Sheets tables'
);

const context = vm.createContext({ Object, Date, console });
vm.runInContext(source, context, { filename: 'Setup.gs' });
const schema = vm.runInContext('HPQ_SCHEMA', context);

function range(values) {
  return {
    getValues: () => values,
    setValues: () => range(values),
    setBackground: () => range(values),
    setFontColor: () => range(values),
    setFontWeight: () => range(values)
  };
}

const sheets = new Map(Object.entries(schema).map(([name, headers]) => {
  const sheet = {
    name,
    headers: [...headers],
    frozenRows: 0,
    getLastColumn() { return this.headers.length; },
    getLastRow: () => 2,
    getRange(row, col, rows, cols) {
      if (row === 1 && rows === 1) return range([this.headers.slice(col - 1, col - 1 + cols)]);
      return range([]);
    },
    setFrozenRows(value) { this.frozenRows = value; },
    autoResizeColumns: () => {},
    createFilter: () => { throw new Error("You can’t apply a filter to a range that partially intersects a table"); }
  };
  return [name, sheet];
}));

const spreadsheet = {
  getSheetByName: name => sheets.get(name) || null,
  insertSheet: name => { throw new Error(`Unexpected sheet creation: ${name}`); }
};

context.spreadsheet_ = () => spreadsheet;
context.headers_ = sheet => [...sheet.headers];
context.seedConfig_ = () => {};
context.seedChallenge_ = () => {};
context.validateProject = () => ({ ok: true });

const first = context.setupProject();
const second = context.setupProject();
assert.equal(first.ok, true);
assert.equal(second.ok, true);
for (const sheet of sheets.values()) assert.equal(sheet.frozenRows, 1);

console.log('setupProject native-table compatibility and idempotency: OK');