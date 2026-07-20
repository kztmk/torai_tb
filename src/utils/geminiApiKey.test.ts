import { describe, expect, it } from 'vitest';

import { normalizeGeminiApiKey, validateGeminiApiKey } from './geminiApiKey';

describe('geminiApiKey utilities', () => {
  it('normalizes nullish values to an empty string', () => {
    expect(normalizeGeminiApiKey(null)).toBe('');
    expect(normalizeGeminiApiKey(undefined)).toBe('');
  });

  it('treats empty nullish values as valid optional input', () => {
    expect(validateGeminiApiKey(null)).toBeNull();
    expect(validateGeminiApiKey(undefined)).toBeNull();
  });

  it('allows current Gemini authorization keys that do not start with AIza', () => {
    expect(validateGeminiApiKey('AQ.Ab123456789012345678901234567890')).toBeNull();
  });

  it('rejects OpenAI and Anthropic API keys', () => {
    expect(validateGeminiApiKey('sk-proj-12345678901234567890')).toContain(
      'OpenAIやAnthropic'
    );
    expect(validateGeminiApiKey('sk-ant-12345678901234567890')).toContain(
      'OpenAIやAnthropic'
    );
  });
});
