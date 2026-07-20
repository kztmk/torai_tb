export type XTrend = {
  rank: number;
  chart: string;
  keyword: string;
  posts?: number;
};

type RawXTrend = Omit<XTrend, 'posts'> & {
  posts?: number | null;
};

export const parseXTrends = (value: unknown): XTrend[] => {
  let parsedValue = value;
  if (typeof value === 'string') {
    try {
      parsedValue = JSON.parse(value);
    } catch {
      return [];
    }
  }
  if (!Array.isArray(parsedValue)) {
    return [];
  }

  return parsedValue
    .filter((trend): trend is RawXTrend => {
      if (!trend || typeof trend !== 'object') {
        return false;
      }
      const candidate = trend as Record<string, unknown>;
      return (
        typeof candidate.rank === 'number' &&
        typeof candidate.chart === 'string' &&
        typeof candidate.keyword === 'string' &&
        (candidate.posts === undefined ||
          candidate.posts === null ||
          typeof candidate.posts === 'number')
      );
    })
    .map((trend): XTrend => {
      const { posts, ...requiredFields } = trend;
      return typeof posts === 'number' ? { ...requiredFields, posts } : requiredFields;
    });
};

export const parseXTrendTimestamp = (value: unknown): string => {
  if (value && typeof value === 'object') {
    const toDate = (value as Record<string, unknown>).toDate;
    if (typeof toDate === 'function') {
      try {
        const date = toDate.call(value);
        return date instanceof Date && !Number.isNaN(date.getTime()) ? date.toISOString() : '';
      } catch {
        return '';
      }
    }
  }
  if (typeof value === 'string') {
    const date = new Date(value);
    return Number.isNaN(date.getTime()) ? '' : value;
  }
  return '';
};
