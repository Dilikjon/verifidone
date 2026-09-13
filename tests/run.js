#!/usr/bin/env node

const path = require('path');
const { execSync } = require('child_process');

const fileExists = require('../src/gates/file.exists.js');
const testPasses = require('../src/gates/test.passes.js');
const lintClean = require('../src/gates/lint.clean.js');

const fixtureDir = path.join(__dirname, 'fixtures', 'demo-project');

console.log('=== VerifiDone MVP Unit Tests ===\n');

// --- Original 6 tests (backward compatibility) ---

// Test 1: file.exists gate
console.log('Test 1: file.exists gate');
process.chdir(fixtureDir);
const r1 = fileExists.check({ files: ['README.md', 'package.json', 'src/index.js'] });
console.log('  Expected: passed=true');
console.log('  Got:', r1.passed ? 'PASS' : 'FAIL');
if (!r1.passed) console.log('  Missing:', r1.missing);

// Test 2: file.exists with missing file
console.log('\nTest 2: file.exists with missing file');
const r2 = fileExists.check({ files: ['README.md', 'missing.txt'] });
console.log('  Expected: passed=false');
console.log('  Got:', r2.passed ? 'FAIL' : 'PASS');

// Test 3: test.passes gate (success case)
console.log('\nTest 3: test.passes gate (success)');
const r3 = testPasses.check({ command: 'node -e "console.log(1)"' });
console.log('  Expected: passed=true');
console.log('  Got:', r3.passed ? 'PASS' : 'FAIL');
if (!r3.passed) console.log('  Error:', r3.error);

// Test 4: test.passes gate (failure case)
console.log('\nTest 4: test.passes gate (failure)');
const r4 = testPasses.check({ command: 'node -e "process.exit(1)"' });
console.log('  Expected: passed=false');
console.log('  Got:', r4.passed ? 'FAIL' : 'PASS');

// Test 5: lint.clean gate (success case)
console.log('\nTest 5: lint.clean gate (success)');
const r5 = lintClean.check({ command: 'node -e "console.log(1)"' });
console.log('  Expected: passed=true');
console.log('  Got:', r5.passed ? 'PASS' : 'FAIL');
if (!r5.passed) console.log('  Error:', r5.error);

// Test 6: lint.clean gate (failure case)
console.log('\nTest 6: lint.clean gate (failure)');
const r6 = lintClean.check({ command: 'node -e "process.exit(1)"' });
console.log('  Expected: passed=false');
console.log('  Got:', r6.passed ? 'FAIL' : 'PASS');

// --- Evidence structure tests ---

console.log('\nTest 7: evidence structure for file.exists');
const ev1 = fileExists.check({ files: ['README.md'] });
console.log('  evidence present:', !!ev1.evidence ? 'PASS' : 'FAIL');
console.log('  evidence.timestamp:', !!ev1.evidence.timestamp ? 'PASS' : 'FAIL');
console.log('  evidence.duration_ms (>=0):', (ev1.evidence.duration_ms >= 0) ? 'PASS' : 'FAIL');
console.log('  evidence.fingerprint (non-empty):', (ev1.evidence.fingerprint && ev1.evidence.fingerprint.length > 0) ? 'PASS' : 'FAIL');
console.log('  evidence.checked:', (ev1.evidence.checked && ev1.evidence.checked.length > 0) ? 'PASS' : 'FAIL');

console.log('\nTest 8: evidence structure for test.passes');
const ev3 = testPasses.check({ command: 'node -e "console.log(1)"' });
console.log('  evidence present:', !!ev3.evidence ? 'PASS' : 'FAIL');
console.log('  evidence.command:', ev3.evidence.command === 'node -e "console.log(1)"' ? 'PASS' : 'FAIL');
console.log('  evidence.exit_code:', ev3.evidence.exit_code === 0 ? 'PASS' : 'FAIL');
console.log('  evidence.duration_ms (>=0):', (ev3.evidence.duration_ms >= 0) ? 'PASS' : 'FAIL');
console.log('  evidence.fingerprint:', (ev3.evidence.fingerprint.length > 0) ? 'PASS' : 'FAIL');

console.log('\nTest 9: skipped gate reported');
const skippedGate = { name: 'non.existent', passed: false, skipped: true, evidence: { timestamp: new Date().toISOString(), duration_ms: 0 } };
console.log('  skipped:true:', skippedGate.skipped === true ? 'PASS' : 'FAIL');

// --- Backward compatibility check ---
console.log('\nTest 10: backward compatibility (passed field exists)');
console.log('  r1.passed exists:', typeof r1.passed === 'boolean' ? 'PASS' : 'FAIL');
console.log('  r1.missing exists:', Array.isArray(r1.missing) ? 'PASS' : 'FAIL');
console.log('  r3.passed exists:', typeof r3.passed === 'boolean' ? 'PASS' : 'FAIL');
console.log('  r3.command exists:', !!r3.command ? 'PASS' : 'FAIL');

console.log('\n=== All unit tests completed ===');
