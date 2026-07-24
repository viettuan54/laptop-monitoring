const { test } = require('node:test');
const assert = require('node:assert/strict');

const {
  DEFAULT_GEMINI_MODEL,
  getGeminiModel,
} = require('../src/utils/aiConfig');

test('uses a stable default model when GEMINI_MODEL is omitted', () => {
  assert.equal(getGeminiModel({}), DEFAULT_GEMINI_MODEL);
});

test('uses and trims the configured Gemini model ID', () => {
  assert.equal(
    getGeminiModel({ GEMINI_MODEL: '  gemini-3.6-flash  ' }),
    'gemini-3.6-flash'
  );
});

test('rejects malformed model IDs', () => {
  assert.throws(
    () => getGeminiModel({ GEMINI_MODEL: 'gemini model\ninjected' }),
    /valid Gemini model ID/
  );
});
