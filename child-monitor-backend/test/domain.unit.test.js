const { test } = require('node:test');
const assert = require('node:assert/strict');

const { normalizeDomain } = require('../src/utils/domain');

test('normalizes safe domains and simple URLs', () => {
  assert.equal(normalizeDomain('https://www.Example.com/path'), 'example.com');
  assert.equal(normalizeDomain('sub.example.com.'), 'sub.example.com');
  assert.equal(normalizeDomain('tênmiền.vn'), 'xn--tnmin-hsa0954c.vn');
});

test('rejects hosts-file injection and invalid DNS labels', () => {
  assert.equal(normalizeDomain('example.com\n1.2.3.4 injected.test'), null);
  assert.equal(normalizeDomain('example.com\r\n# === LAPTOP-MONITOR END ==='), null);
  assert.equal(normalizeDomain('example.com # comment'), null);
  assert.equal(normalizeDomain('-bad.example'), null);
  assert.equal(normalizeDomain('bad_.example'), null);
  assert.equal(normalizeDomain('localhost'), null);
});
