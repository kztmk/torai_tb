import { describe, expect, it } from 'vitest';
import { normalizeAppLanguage } from './index';

describe('normalizeAppLanguage', () => {
  it('normalizes supported locale variants', () => {
    expect(normalizeAppLanguage('ja-JP')).toBe('ja');
    expect(normalizeAppLanguage('EN-us')).toBe('en');
  });

  it('rejects unsupported or malformed values', () => {
    expect(normalizeAppLanguage('fr')).toBeNull();
    expect(normalizeAppLanguage('')).toBeNull();
    expect(normalizeAppLanguage(null)).toBeNull();
  });
});
