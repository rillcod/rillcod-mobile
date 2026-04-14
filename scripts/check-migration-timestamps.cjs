const fs = require('fs');
const path = require('path');

const migrationsDir = path.resolve(__dirname, '../supabase/migrations');
const files = fs.readdirSync(migrationsDir).filter((name) => name.endsWith('.sql'));
const seen = new Map();
let hasError = false;

for (const file of files) {
  const match = file.match(/^(\d{14})_/);
  if (!match) continue;
  const ts = match[1];
  if (seen.has(ts)) {
    hasError = true;
    // eslint-disable-next-line no-console
    console.error(`Duplicate migration timestamp ${ts}: ${seen.get(ts)} and ${file}`);
  } else {
    seen.set(ts, file);
  }
}

if (hasError) {
  process.exit(1);
}

// eslint-disable-next-line no-console
console.log(`Migration timestamp check passed (${files.length} files).`);

