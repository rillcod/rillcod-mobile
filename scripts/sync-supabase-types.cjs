/**
 * Loads SUPABASE_ACCESS_TOKEN from the environment or from .env / .env.local,
 * then runs `supabase gen types` and writes src/types/supabase.ts.
 *
 * Create a personal access token: https://supabase.com/dashboard/account/tokens
 */
const { readFileSync, existsSync, writeFileSync } = require('fs');
const { spawnSync } = require('child_process');
const path = require('path');

function loadEnvFile(rel) {
  const full = path.join(process.cwd(), rel);
  if (!existsSync(full)) return;
  for (const line of readFileSync(full, 'utf8').split(/\r?\n/)) {
    const trimmed = line.trim();
    if (!trimmed || trimmed.startsWith('#')) continue;
    const eq = trimmed.indexOf('=');
    if (eq === -1) continue;
    const key = trimmed.slice(0, eq).trim();
    let val = trimmed.slice(eq + 1).trim();
    if (
      (val.startsWith('"') && val.endsWith('"')) ||
      (val.startsWith("'") && val.endsWith("'"))
    ) {
      val = val.slice(1, -1);
    }
    if (process.env[key] === undefined) process.env[key] = val;
  }
}

loadEnvFile('.env');
loadEnvFile('.env.local');

const projectId = process.env.SUPABASE_PROJECT_ID || 'akaorqukdoawacvxsdij';

if (!process.env.SUPABASE_ACCESS_TOKEN || !String(process.env.SUPABASE_ACCESS_TOKEN).trim()) {
  console.error(
    'Missing SUPABASE_ACCESS_TOKEN.\n' +
      '  • Export it in your shell, or\n' +
      '  • Add SUPABASE_ACCESS_TOKEN=... to .env (gitignored)\n' +
      'Token: https://supabase.com/dashboard/account/tokens',
  );
  process.exit(1);
}

const outFile = path.join(process.cwd(), 'src', 'types', 'supabase.ts');
const result = spawnSync(
  'npx',
  ['supabase', 'gen', 'types', 'typescript', '--project-id', projectId],
  {
    encoding: 'utf8',
    env: { ...process.env },
    shell: true,
    maxBuffer: 50 * 1024 * 1024,
  },
);

if (result.error) {
  console.error(result.error);
  process.exit(1);
}

if (result.status !== 0) {
  console.error(result.stderr || result.stdout || 'supabase gen types failed');
  process.exit(result.status || 1);
}

writeFileSync(outFile, result.stdout, 'utf8');
console.log('Wrote', outFile);
