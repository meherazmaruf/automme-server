let keyIndex = 0;

export function getGeminiKey() {
  const keys = [
    process.env.GEMINI_API_KEY || process.env.OPENAI_API_KEY,
    process.env.GEMINI_API_KEY1 || process.env.GEMINI_API_KEY_2,
    process.env.GEMINI_API_KEY2 || process.env.GEMINI_API_KEY_3,
  ].filter(Boolean);

  if (keys.length === 0) {
    throw new Error('No Gemini API keys found. Set GEMINI_API_KEY in .env');
  }

  keyIndex = (keyIndex + 1) % keys.length;
  const key = keys[keyIndex];
  console.log(`[Gemini Keys] Using key ${keyIndex + 1} of ${keys.length}`);
  return key;
}
