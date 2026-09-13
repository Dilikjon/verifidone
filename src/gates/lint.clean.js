#!/usr/bin/env node

const { execSync } = require('child_process');
const crypto = require('crypto');

function check(config = {}) {
  const cmd = config.command || 'npm run lint';
  const start = Date.now();
  try {
    const stdout = execSync(cmd, { stdio: 'pipe', timeout: 30000 }).toString();
    const duration_ms = Date.now() - start;
    return {
      name: 'lint.clean',
      passed: true,
      command: cmd,
      evidence: {
        timestamp: new Date().toISOString(),
        duration_ms,
        command: cmd,
        fingerprint: crypto.createHash('sha256').update(stdout).digest('hex'),
        exit_code: 0
      }
    };
  } catch (e) {
    const duration_ms = Date.now() - start;
    const stdout = (e.stdout ? e.stdout.toString() : '') || '';
    return {
      name: 'lint.clean',
      passed: false,
      command: cmd,
      error: e.message,
      evidence: {
        timestamp: new Date().toISOString(),
        duration_ms,
        command: cmd,
        fingerprint: crypto.createHash('sha256').update(stdout + e.message).digest('hex'),
        exit_code: e.status || 1
      }
    };
  }
}

module.exports = { check };