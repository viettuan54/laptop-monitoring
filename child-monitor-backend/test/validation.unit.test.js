const { test } = require('node:test');
const assert = require('node:assert/strict');

const {
  validateDurationSeconds,
  MAX_LOG_DURATION_SECONDS,
} = require('../src/utils/validation');

test('accepts an omitted duration and integer values in range', () => {
  assert.equal(validateDurationSeconds(undefined), true);
  assert.equal(validateDurationSeconds(null), true);
  assert.equal(validateDurationSeconds(0), true);
  assert.equal(validateDurationSeconds(30), true);
  assert.equal(validateDurationSeconds(MAX_LOG_DURATION_SECONDS), true);
});

test('rejects negative, fractional, oversized, string and non-finite durations', () => {
  const invalidValues = [
    -1,
    1.5,
    MAX_LOG_DURATION_SECONDS + 1,
    '30',
    Number.NaN,
    Number.POSITIVE_INFINITY,
  ];

  for (const value of invalidValues) {
    assert.equal(validateDurationSeconds(value), false, `expected invalid: ${value}`);
  }
});
