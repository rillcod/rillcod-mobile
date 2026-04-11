#!/usr/bin/env node
/**
 * EAS runs `npm ci`, which requires package-lock.json in the build root.
 * If the archive ever omits it (or an old clone had no lockfile), generate
 * one here before the install step. Prefer committing package-lock.json.
 */
const fs = require('fs');
const path = require('path');
const { execSync } = require('child_process');

const root = process.cwd();
const lockPath = path.join(root, 'package-lock.json');
const pkgPath = path.join(root, 'package.json');

if (!fs.existsSync(pkgPath)) {
  console.error('[eas-ensure-package-lock] package.json not found at', root);
  process.exit(1);
}

function lockOk() {
  if (!fs.existsSync(lockPath)) return false;
  const st = fs.statSync(lockPath);
  return st.isFile() && st.size > 100;
}

if (lockOk()) {
  console.log('[eas-ensure-package-lock] ok', fs.statSync(lockPath).size, 'bytes');
  process.exit(0);
}

console.warn('[eas-ensure-package-lock] missing or tiny lockfile; running npm install --package-lock-only');
try {
  execSync('npm install --package-lock-only --ignore-scripts', {
    cwd: root,
    stdio: 'inherit',
    env: {
      ...process.env,
      npm_config_fund: 'false',
      npm_config_audit: 'false',
    },
  });
} catch {
  console.error('[eas-ensure-package-lock] npm install --package-lock-only failed');
  process.exit(1);
}

if (!lockOk()) {
  console.error('[eas-ensure-package-lock] lockfile still missing after generation');
  process.exit(1);
}
console.log('[eas-ensure-package-lock] generated package-lock.json');
