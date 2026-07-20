const GEMINI_API_KEY_MIN_LENGTH = 20;

export const normalizeGeminiApiKey = (value: string | null | undefined): string =>
  (value || '').trim();

export const validateGeminiApiKey = (value: string | null | undefined): string | null => {
  const normalizedValue = normalizeGeminiApiKey(value);
  if (!normalizedValue) {
    return null;
  }
  if (/\s/.test(normalizedValue)) {
    return 'Gemini APIキーに空白や改行が含まれています。Google AI Studioでコピーしたキーのみを入力してください。';
  }
  if (normalizedValue.length < GEMINI_API_KEY_MIN_LENGTH) {
    return 'Gemini APIキーが短すぎます。Google AI Studioで発行したAPIキーを入力してください。';
  }
  if (/^Bearer\s+/i.test(normalizedValue) || /^ya29\./i.test(normalizedValue)) {
    return 'Gemini APIキーにはOAuthアクセストークンを使用できません。Google AI Studioで発行したAPIキーを入力してください。';
  }
  if (/^(sk-|sk-ant-)/i.test(normalizedValue)) {
    return 'Gemini APIキーにはOpenAIやAnthropicのAPIキーを使用できません。Google AI Studioで発行したAPIキーを入力してください。';
  }
  return null;
};
