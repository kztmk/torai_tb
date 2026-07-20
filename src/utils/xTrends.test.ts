import { describe, expect, it } from 'vitest';
import { parseXTrends, parseXTrendTimestamp } from './xTrends';

const trends = [{ rank: 1, chart: '東京のトレンド', keyword: '#虎威', posts: 100 }];

describe('parseXTrends', () => {
  it('parses the structured array saved by the new function', () => {
    expect(parseXTrends(trends)).toEqual(trends);
  });

  it('keeps compatibility with legacy JSON string documents', () => {
    expect(parseXTrends(JSON.stringify(trends))).toEqual(trends);
  });

  it('returns an empty array for invalid data', () => {
    expect(parseXTrends('{invalid')).toEqual([]);
    expect(parseXTrends(null)).toEqual([]);
  });

  it('keeps a legacy trend with null posts and omits the null field', () => {
    expect(
      parseXTrends([{ rank: 1, chart: '東京のトレンド', keyword: '#虎威', posts: null }])
    ).toEqual([{ rank: 1, chart: '東京のトレンド', keyword: '#虎威' }]);
  });
});

describe('parseXTrendTimestamp', () => {
  it('accepts a Firestore Timestamp-compatible object without instanceof', () => {
    const timestampLike = {
      date: new Date('2026-07-10T00:00:00.000Z'),
      toDate() {
        return this.date;
      },
    };
    expect(
      parseXTrendTimestamp(timestampLike)
    ).toBe('2026-07-10T00:00:00.000Z');
  });

  it('rejects an invalid date returned by a Timestamp-compatible object', () => {
    expect(parseXTrendTimestamp({ toDate: () => new Date('invalid') })).toBe('');
  });

  it('returns an empty string when a Timestamp-compatible object throws', () => {
    expect(
      parseXTrendTimestamp({
        toDate: () => {
          throw new Error('invalid timestamp');
        },
      })
    ).toBe('');
  });

  it('keeps a valid legacy string timestamp', () => {
    expect(parseXTrendTimestamp('2026-07-11T00:00:00.000Z')).toBe(
      '2026-07-11T00:00:00.000Z'
    );
  });

  it('rejects an invalid legacy string timestamp', () => {
    expect(parseXTrendTimestamp('not-a-date')).toBe('');
  });
});
