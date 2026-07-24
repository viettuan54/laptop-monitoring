const DEFAULT_GEMINI_MODEL = 'gemini-2.5-flash';
const MODEL_ID_PATTERN = /^[a-z0-9][a-z0-9._-]{1,127}$/i;

function getGeminiModel(env = process.env) {
  const configuredModel = env.GEMINI_MODEL?.trim();
  const model = configuredModel || DEFAULT_GEMINI_MODEL;

  if (!MODEL_ID_PATTERN.test(model)) {
    throw new Error('GEMINI_MODEL must be a valid Gemini model ID');
  }

  return model;
}

module.exports = {
  DEFAULT_GEMINI_MODEL,
  getGeminiModel,
};
