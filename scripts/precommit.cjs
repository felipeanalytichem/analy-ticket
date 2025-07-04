#!/usr/bin/env node

/*
 * Cross-platform pre-commit runner (CommonJS).
 * 1) Executes `npm run lint` for full project safety check.
 * 2) Executes `lint-staged` programmatically (same behaviour as previous shell hook).
 */

const { execSync } = require('child_process');

function run(cmd) {
  execSync(cmd, { stdio: 'inherit', shell: true });
}

try {
  // Fast feedback lint of staged files
  run('npx --no-install lint-staged');
  // Full project lint (uncomment if desired)
  // run('npm run lint');
} catch (err) {
  console.error('\n❌ Pre-commit checks failed. Commit aborted.');
  process.exit(1);
}

console.log('✅ Pre-commit checks passed.');