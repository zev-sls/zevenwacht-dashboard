const fs = require('fs');
const path = require('path');
const { spawnSync } = require('child_process');

const root = path.join(__dirname, '..');
const workbookPath = process.argv[2];
const sheetName = process.argv[3];

if (!workbookPath) {
  console.error('Usage: npm.cmd run update-sales -- path\\to\\sales.xlsx [SheetName]');
  process.exit(1);
}

if (!process.env.DATA_ENCRYPTION_KEY) {
  const localEnv = path.join(root, '.env.local');
  if (fs.existsSync(localEnv)) process.loadEnvFile(localEnv);
}
if (Buffer.from(process.env.DATA_ENCRYPTION_KEY || '', 'base64').length !== 32) {
  throw new Error('Set a valid DATA_ENCRYPTION_KEY in .env.local or the environment');
}

function run(script, args) {
  const result = spawnSync(process.execPath, [path.join(__dirname, script), ...args], {
    cwd: root,
    env: process.env,
    stdio: 'inherit'
  });
  if (result.error) throw result.error;
  if (result.status !== 0) process.exit(result.status || 1);
}

run('import-sales-excel.js', [workbookPath, ...(sheetName ? [sheetName] : [])]);

const rows = JSON.parse(fs.readFileSync(path.join(root, 'private', 'sales-data.json'), 'utf8'));
if (!Array.isArray(rows) || rows.length === 0) throw new Error('No imported sales rows found');

const periods = new Map();
for (const [index, row] of rows.entries()) {
  if (!Array.isArray(row) || row.length !== 6) {
    throw new Error(`Invalid sales row ${index + 1}: expected six fields`);
  }
  const match = /^(\d{2})\/(\d{2})\/(\d{4})$/.exec(row[0]);
  if (!match) throw new Error(`Invalid period in sales row ${index + 1}`);
  const day = Number(match[1]);
  const month = Number(match[2]);
  const year = Number(match[3]);
  const date = new Date(Date.UTC(year, month - 1, day));
  if (date.getUTCFullYear() !== year || date.getUTCMonth() + 1 !== month || date.getUTCDate() !== day) {
    throw new Error(`Invalid calendar date in sales row ${index + 1}`);
  }
  if (typeof row[4] !== 'number' || !Number.isFinite(row[4]) ||
      typeof row[5] !== 'number' || !Number.isFinite(row[5])) {
    throw new Error(`Invalid quantity or revenue in sales row ${index + 1}`);
  }
  if (row[4] === 0 && row[5] === 0) {
    throw new Error(`Zero quantity and revenue in sales row ${index + 1}`);
  }

  const period = `${year}-${String(month).padStart(2, '0')}`;
  const summary = periods.get(period) || { rows: 0, bottles: 0, revenue: 0, zeroBottleValueRows: 0 };
  summary.rows += 1;
  summary.bottles += row[4];
  summary.revenue += row[5];
  if (row[4] === 0 && row[5] !== 0) summary.zeroBottleValueRows += 1;
  periods.set(period, summary);
}

const latest = [...periods.keys()].sort().at(-1);
const summary = periods.get(latest);
console.log(`Latest month ${latest}: ${summary.rows} rows, ${summary.bottles} bottles, R${summary.revenue.toFixed(2)} revenue`);
console.log(`Zero-bottle value rows: ${summary.zeroBottleValueRows}`);

run('encrypt-data.js', ['sales']);
