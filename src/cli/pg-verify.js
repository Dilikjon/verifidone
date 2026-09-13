#!/usr/bin/env node

const path = require('path');
const fs = require('fs');
const crypto = require('crypto');
const { execSync } = require('child_process');

// ── helpers ──────────────────────────────────────────────────────────

const ROOT = process.cwd();

function loadConfig(projectDir) {
  const yamlPath = path.join(projectDir || ROOT, '.projectguard.yaml');
  if (!fs.existsSync(yamlPath)) return null;
  const text = fs.readFileSync(yamlPath, 'utf8');
  const cfg = { name: '', gates: [] };
  let currentGate = null;
  for (const raw of text.split('\n')) {
    const line = raw.replace(/\r$/, '');
    if (/^\s{2,}-\s+name:\s/.test(line)) {
      if (currentGate) cfg.gates.push(currentGate);
      currentGate = { name: line.replace(/.*name:\s*/, '').trim(), enabled: true, files: [], command: '' };
    } else if (currentGate && /^\s{4,}enabled:\s/.test(line)) {
      currentGate.enabled = /\btrue\b/.test(line);
    } else if (currentGate && /^\s{4,}command:\s/.test(line)) {
      currentGate.command = line.replace(/.*command:\s*/, '').trim().replace(/^["']|["']$/g, '');
    } else if (currentGate && /^\s{4,}-\s+/.test(line)) {
      const val = line.replace(/^\s*-\s*/, '').trim().replace(/^["']|["']$/g, '');
      if (currentGate.name === 'file.exists') currentGate.files.push(val);
    }
  }
  if (currentGate) cfg.gates.push(currentGate);
  return cfg;
}

function gateFileExists(cfg) {
  const start = Date.now();
  const missing = (cfg.files || []).filter(f => !fs.existsSync(path.join(ROOT, f)));
  const duration_ms = Date.now() - start;
  return {
    name: 'file.exists',
    passed: missing.length === 0,
    missing,
    evidence: {
      checked: cfg.files || [],
      timestamp: new Date().toISOString(),
      duration_ms,
      fingerprint: crypto.createHash('sha256').update(JSON.stringify({ files: cfg.files || [], missing })).digest('hex')
    }
  };
}

function gateTestPasses(cfg) {
  if (!cfg.command) {
    return { name: 'test.passes', passed: false, error: 'no command configured', evidence: { timestamp: new Date().toISOString(), duration_ms: 0, command: '', fingerprint: '', exit_code: 1 } };
  }
  const start = Date.now();
  try {
    const stdout = execSync(cfg.command, { cwd: ROOT, stdio: 'pipe', timeout: 30000 }).toString();
    const duration_ms = Date.now() - start;
    return {
      name: 'test.passes', passed: true, command: cfg.command,
      evidence: { timestamp: new Date().toISOString(), duration_ms, command: cfg.command, fingerprint: crypto.createHash('sha256').update(stdout).digest('hex'), exit_code: 0 }
    };
  } catch (e) {
    const duration_ms = Date.now() - start;
    const stdout = (e.stdout ? e.stdout.toString() : '') || '';
    return { name: 'test.passes', passed: false, command: cfg.command, error: e.message,
      evidence: { timestamp: new Date().toISOString(), duration_ms, command: cfg.command, fingerprint: crypto.createHash('sha256').update(stdout + e.message).digest('hex'), exit_code: e.status || 1 }
    };
  }
}

function gateLintClean(cfg) {
  if (!cfg.command) {
    return { name: 'lint.clean', passed: false, error: 'no command configured', evidence: { timestamp: new Date().toISOString(), duration_ms: 0, command: '', fingerprint: '', exit_code: 1 } };
  }
  const start = Date.now();
  try {
    const stdout = execSync(cfg.command, { cwd: ROOT, stdio: 'pipe', timeout: 30000 }).toString();
    const duration_ms = Date.now() - start;
    return {
      name: 'lint.clean', passed: true, command: cfg.command,
      evidence: { timestamp: new Date().toISOString(), duration_ms, command: cfg.command, fingerprint: crypto.createHash('sha256').update(stdout).digest('hex'), exit_code: 0 }
    };
  } catch (e) {
    const duration_ms = Date.now() - start;
    const stdout = (e.stdout ? e.stdout.toString() : '') || '';
    return { name: 'lint.clean', passed: false, command: cfg.command, error: e.message,
      evidence: { timestamp: new Date().toISOString(), duration_ms, command: cfg.command, fingerprint: crypto.createHash('sha256').update(stdout + e.message).digest('hex'), exit_code: e.status || 1 }
    };
  }
}

// ── CLI ──────────────────────────────────────────────────────────────

function formatReport(results) {
  const total = results.length;
  const passed = results.filter(r => r.passed).length;
  const failed = results.filter(r => !r.passed && r.skipped !== true).length;
  const skipped = results.filter(r => r.skipped === true).length;
  return `=== VerifiDone Verification Report ===
Timestamp: ${new Date().toISOString()}
Project: ${loadConfig()?.name || 'unknown'}

` + results.map(r => {
    const status = r.skipped ? 'SKIPPED' : (r.passed ? 'PASS' : 'FAIL');
    let s = `[${status}] ${r.name}`;
    if (r.skipped) s += '\n  Reason: disabled in config';
    else if (!r.passed && r.error) s += `\n  Error: ${r.error}`;
    if (r.missing && r.missing.length) s += `\n  Missing: ${r.missing.join(', ')}`;
    if (r.evidence) {
      s += `\n  Evidence:`;
      s += `\n    timestamp: ${r.evidence.timestamp}`;
      s += `\n    duration_ms: ${r.evidence.duration_ms}`;
      s += `\n    fingerprint: ${r.evidence.fingerprint}`;
      if (r.evidence.command) s += `\n    command: ${r.evidence.command}`;
      if (r.evidence.exit_code !== undefined) s += `\n    exit_code: ${r.evidence.exit_code}`;
      if (r.evidence.checked) s += `\n    checked: ${JSON.stringify(r.evidence.checked)}`;
    }
    return s;
  }).join('\n\n') + `

=== Summary ===
Total: ${total} | Passed: ${passed} | Failed: ${failed} | Skipped: ${skipped}
Verification: ${failed === 0 ? 'PASSED ✅' : 'FAILED ❌'}`;
}

function runAll(args = process.argv.slice(2)) {
  const cfg = loadConfig();
  if (!cfg) { console.log('No .projectguard.yaml found in project root.'); process.exit(1); }
  const results = [];
  for (const g of cfg.gates) {
    if (!g.enabled) {
      results.push({ name: g.name, passed: false, skipped: true, evidence: { timestamp: new Date().toISOString(), duration_ms: 0 } });
      continue;
    }
    switch (g.name) {
      case 'file.exists': results.push(gateFileExists(g)); break;
      case 'test.passes': results.push(gateTestPasses(g)); break;
      case 'lint.clean': results.push(gateLintClean(g)); break;
      default: results.push({ name: g.name, passed: false, error: 'unknown gate', evidence: { timestamp: new Date().toISOString(), duration_ms: 0 } });
    }
  }

  const jsonFlag = args.includes('--json');
  const reportFlag = args.includes('--report');

  if (jsonFlag) {
    const output = {
      project: cfg.name || 'unknown',
      timestamp: new Date().toISOString(),
      summary: {
        total: results.length,
        passed: results.filter(r => r.passed && !r.skipped).length,
        failed: results.filter(r => !r.passed && !r.skipped).length,
        skipped: results.filter(r => r.skipped).length
      },
      gates: results,
      overall: results.every(r => r.passed || r.skipped) ? 'passed' : 'failed'
    };
    console.log(JSON.stringify(output, null, 2));
    const ok = output.overall === 'passed';
    process.exit(ok ? 0 : 1);
  }

  console.log('=== VerifiDone verification ===');
  let ok = true;
  for (const r of results) {
    const status = r.skipped ? 'SKIPPED' : (r.passed ? 'PASS' : 'FAIL');
    console.log(`[${status}] ${r.name}`);
    if (r.skipped) console.log('  Reason: disabled in config');
    else if (!r.passed) { ok = false; console.log('  error:', r.error || 'missing:', r.missing); }
    if (r.evidence && !jsonFlag) {
      console.log('  Evidence:');
      console.log('    timestamp:', r.evidence.timestamp);
      console.log('    duration_ms:', r.evidence.duration_ms);
      console.log('    fingerprint:', r.evidence.fingerprint);
    }
  }

  if (reportFlag) {
    const md = formatReport(results);
    const jsonData = {
      project: cfg.name || 'unknown', timestamp: new Date().toISOString(),
      summary: { total: results.length, passed: results.filter(r => r.passed && !r.skipped).length, failed: results.filter(r => !r.passed && !r.skipped).length, skipped: results.filter(r => r.skipped).length },
      gates: results, overall: results.every(r => r.passed || r.skipped) ? 'passed' : 'failed'
    };
    fs.writeFileSync('verification-report.md', md);
    fs.writeFileSync('verification-report.json', JSON.stringify(jsonData, null, 2));
    console.log('Reports written: verification-report.md, verification-report.json');
  }

  console.log(ok ? 'All gates passed.' : 'Some gates failed.');
  process.exit(ok ? 0 : 1);
}

// ── exports ──────────────────────────────────────────────────────────

module.exports = { loadConfig, gateFileExists, gateTestPasses, gateLintClean, runAll, formatReport };

if (require.main === module) runAll();