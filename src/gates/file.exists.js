const crypto = require('crypto');
const fs = require('fs');

function check(config = {}) {
  const start = Date.now();
  const files = config.files || ['README.md', 'package.json'];
  const missing = [];
  for (const f of files) {
    if (!fs.existsSync(f)) missing.push(f);
  }
  const duration_ms = Date.now() - start;
  return {
    name: 'file.exists',
    passed: missing.length === 0,
    missing,
    evidence: {
      checked: files,
      timestamp: new Date().toISOString(),
      duration_ms,
      fingerprint: crypto.createHash('sha256').update(JSON.stringify({ files, missing })).digest('hex')
    }
  };
}

module.exports = { check };