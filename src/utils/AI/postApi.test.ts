import { afterEach, beforeEach, describe, expect, it, vi } from 'vitest';

const genAiMocks = vi.hoisted(() => {
  const generateContent = vi.fn();
  const GoogleGenAI = vi.fn(() => ({
    models: {
      generateContent,
    },
  }));

  return {
    generateContent,
    GoogleGenAI,
  };
});

vi.mock('@google/genai/web', () => ({
  GoogleGenAI: genAiMocks.GoogleGenAI,
}));

import { fetchGeneratedPostsAPI } from './postApi';

describe('fetchGeneratedPostsAPI', () => {
  beforeEach(() => {
    genAiMocks.generateContent.mockReset();
    genAiMocks.GoogleGenAI.mockClear();
    vi.spyOn(console, 'log').mockImplementation(() => {});
    vi.spyOn(console, 'warn').mockImplementation(() => {});
    vi.spyOn(console, 'error').mockImplementation(() => {});
  });

  afterEach(() => {
    vi.restoreAllMocks();
  });

  it('passes a trimmed Gemini authorization key to GoogleGenAI and transforms posts', async () => {
    genAiMocks.generateContent.mockResolvedValue({
      text: JSON.stringify({
        posts: [{ text: '投稿案1' }, { text: '投稿案2' }],
      }),
    });

    const posts = await fetchGeneratedPostsAPI(
      '  AQ.Ab123456789012345678901234567890  ',
      'テスト'
    );

    expect(genAiMocks.GoogleGenAI).toHaveBeenCalledWith({
      apiKey: 'AQ.Ab123456789012345678901234567890',
    });
    expect(genAiMocks.generateContent).toHaveBeenCalledWith({
      model: 'gemini-flash-lite-latest',
      contents: expect.stringContaining('テスト'),
      config: {
        systemInstruction: expect.stringContaining('あなたの役割'),
      },
    });
    expect(posts).toEqual([
      expect.objectContaining({ text: '投稿案1', adopted: false }),
      expect.objectContaining({ text: '投稿案2', adopted: false }),
    ]);
  });

  it('extracts JSON from fenced Gemini responses', async () => {
    genAiMocks.generateContent.mockResolvedValue({
      text: [
        '```json',
        JSON.stringify({
          posts: [{ text: 'フェンス付き投稿' }],
        }),
        '```',
      ].join('\n'),
    });

    await expect(fetchGeneratedPostsAPI('AQ.Ab123456789012345678901234567890', 'テスト'))
      .resolves.toEqual([expect.objectContaining({ text: 'フェンス付き投稿' })]);
  });

  it('extracts nested posts objects from wrapped Gemini responses', async () => {
    genAiMocks.generateContent.mockResolvedValue({
      text: [
        '以下のJSONです。',
        JSON.stringify({
          response: {
            posts: [{ text: 'ラップされた投稿' }],
          },
        }),
        '以上です。',
      ].join('\n'),
    });

    await expect(fetchGeneratedPostsAPI('AQ.Ab123456789012345678901234567890', 'テスト'))
      .resolves.toEqual([expect.objectContaining({ text: 'ラップされた投稿' })]);
  });

  it('rejects OAuth access tokens before calling Gemini', async () => {
    await expect(fetchGeneratedPostsAPI('ya29.invalid-access-token', 'テスト')).rejects.toThrow(
      'OAuthアクセストークン'
    );
    expect(genAiMocks.GoogleGenAI).not.toHaveBeenCalled();
    expect(genAiMocks.generateContent).not.toHaveBeenCalled();
  });
});
