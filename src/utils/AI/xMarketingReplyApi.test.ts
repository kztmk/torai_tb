import { beforeEach, describe, expect, it, vi } from 'vitest';
import type { XMarketingInteraction } from '@/types/xMarketing';

const genAiMocks = vi.hoisted(() => {
  const generateContent = vi.fn();
  const GoogleGenAI = vi.fn(() => ({
    models: {
      generateContent,
    },
  }));

  return { generateContent, GoogleGenAI };
});

vi.mock('@google/genai/web', () => ({
  GoogleGenAI: genAiMocks.GoogleGenAI,
}));

import { generateXMarketingReply } from './xMarketingReplyApi';

const interaction: XMarketingInteraction = {
  id: 'interaction-1',
  accountId: 'torai',
  userId: 'user-1',
  username: 'customer',
  name: 'お客様',
  reactionType: 'reply',
  postId: 'post-1',
  postText: '設定方法を教えてください',
  occurredAt: '2026-07-15T00:00:00.000Z',
  score: 80,
  stage: 'interested',
  status: 'unread',
  counts: { likes: 1, replies: 1, quotes: 0, reposts: 0 },
  tags: [],
  memo: '',
};

describe('generateXMarketingReply', () => {
  beforeEach(() => {
    genAiMocks.generateContent.mockReset();
    genAiMocks.GoogleGenAI.mockClear();
  });

  it('uses the saved Gemini key and reaction context to generate one reply', async () => {
    genAiMocks.generateContent.mockResolvedValue({ text: 'お問い合わせありがとうございます。' });

    await expect(
      generateXMarketingReply('  AQ.Ab123456789012345678901234567890  ', interaction)
    ).resolves.toBe('お問い合わせありがとうございます。');
    expect(genAiMocks.GoogleGenAI).toHaveBeenCalledWith({
      apiKey: 'AQ.Ab123456789012345678901234567890',
    });
    expect(genAiMocks.generateContent).toHaveBeenCalledWith({
      model: 'gemini-flash-lite-latest',
      contents: expect.stringContaining('設定方法を教えてください'),
      config: {
        systemInstruction: expect.stringContaining('返信案を1件だけ'),
      },
    });
  });

  it('rejects an unregistered key before calling Gemini', async () => {
    await expect(generateXMarketingReply('', interaction)).rejects.toThrow(
      'Gemini APIキーが設定されていません。'
    );
    expect(genAiMocks.GoogleGenAI).not.toHaveBeenCalled();
  });

  it('rejects an empty Gemini response', async () => {
    genAiMocks.generateContent.mockResolvedValue({ text: '   ' });

    await expect(
      generateXMarketingReply('AQ.Ab123456789012345678901234567890', interaction)
    ).rejects.toThrow('Geminiから返信案を取得できませんでした。');
  });
});
