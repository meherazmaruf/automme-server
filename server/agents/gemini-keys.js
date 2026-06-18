let keyIndex = 0;

const keys = [
  process.env.GEMINI_API_KEY,
  process.env.GEMINI_API_KEY1,
  process.env.GEMINI_API_KEY2,
].filter(Boolean);

if (keys.length === 0) {
  console.error('[Gemini Keys] No API keys found!');
}

export function getGeminiKey() {
  if (keys.length === 0) throw new Error('No Gemini API keys found');
  keyIndex = (keyIndex + 1) % keys.length;
  const key = keys[keyIndex];
  console.log(`[Gemini Keys] Using key ${keyIndex + 1} of ${keys.length}`);
  return key;
}

export function getGeminiKeyAt(index) {
  if (keys.length === 0) throw new Error('No Gemini API keys found');
  return keys[index % keys.length];
}

export function getAllGeminiKeys() {
  return keys;
}

export function getKeyCount() {
  return keys.length;
}
