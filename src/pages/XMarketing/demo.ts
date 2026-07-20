import type {
  XMarketingDailyMetric,
  XMarketingDashboard,
  XMarketingInteraction,
  XMarketingPostAnalytics,
} from '@/types/xMarketing';

const people = [
  ['yamada_taro_', '山田 太郎', 'reply', 92, 'conversation'],
  ['misa_works', '佐藤 美咲', 'like', 64, 'interested'],
  ['suzuki_biz', '鈴木 健太', 'repost', 78, 'interested'],
  ['hanako_tanaka', '田中 花子', 'follow', 55, 'new'],
  ['ito_sho_market', '伊藤 翔', 'reply', 85, 'conversation'],
  ['growth_co_ltd', '株式会社グロース', 'like', 42, 'new'],
  ['d_nakamura', '中村 大輔', 'quote', 71, 'interested'],
] as const;

const interactions: XMarketingInteraction[] = people.map((p, index) => ({
  id: `demo-${index}`,
  accountId: index % 3 === 0 ? 'torai_support' : 'torai_official',
  userId: String(index + 1),
  username: p[0],
  name: p[1],
  reactionType: p[2],
  postId: `post-${index}`,
  postText:
    index === 0
      ? '具体的な設定方法を教えていただけますか？'
      : index === 2
        ? 'この記事は目からウロコでした。特に3つ目が参考になります。'
        : 'いつも分かりやすいです！助かっています。',
  occurredAt: new Date(Date.now() - index * 3600000).toISOString(),
  score: p[3],
  stage: p[4],
  status: index < 3 ? 'unread' : 'read',
  counts: {
    likes: Math.max(1, 6 - index),
    replies: index % 3,
    quotes: index === 6 ? 1 : 0,
    reposts: index === 2 ? 1 : 0,
  },
  tags: index === 0 ? ['SNS運用', '中小企業'] : [],
  memo: '',
}));

const analyticsPosts: XMarketingPostAnalytics[] = [
  ['torai_official', 'analytics-post-1', 'X運用で最初に整えたい3つのポイントをまとめました。', 12840, 932, 486, 42, 61, 18],
  ['torai_official', 'analytics-post-2', '投稿作成を効率化するためのチェックリストです。', 8640, 511, 302, 28, 35, 9],
  ['torai_support', 'analytics-post-3', '虎威の取得設定について、よくある質問をご紹介します。', 6240, 384, 221, 31, 22, 7],
].map((post, index) => {
  const [accountId, postId, text, impressions, engagements, likes, replies, reposts, quotes] = post;
  return {
    id: `${accountId}:${postId}`,
    accountId: String(accountId),
    postId: String(postId),
    text: String(text),
    createdAt: new Date(Date.now() - (index + 1) * 86400000).toISOString(),
    capturedAt: new Date().toISOString(),
    metrics: {
      impressions: Number(impressions),
      engagements: Number(engagements),
      likes: Number(likes),
      replies: Number(replies),
      reposts: Number(reposts),
      quotes: Number(quotes),
      bookmarks: 12 - index * 2,
      profileClicks: 76 - index * 13,
      urlClicks: 48 - index * 9,
    },
    engagementRate: (Number(engagements) / Number(impressions)) * 100,
    metricSource: 'non_public' as const,
    availability: { impressions: true, profileClicks: true, urlClicks: true },
  };
});

const analyticsDaily: XMarketingDailyMetric[] = Array.from({ length: 7 }, (_, index) => {
  const impressions = 3500 + index * 1320;
  const engagements = 190 + index * 86;
  return {
    accountId: 'torai_official',
    date: new Date(Date.now() - (6 - index) * 86400000).toISOString().slice(0, 10),
    postCount: Math.min(10, index + 3),
    impressions,
    engagements,
    likes: 120 + index * 54,
    replies: 12 + index * 5,
    reposts: 18 + index * 6,
    quotes: 5 + index * 2,
    engagementRate: (engagements / impressions) * 100,
    impressionsAvailable: true,
  };
});

export const demoDashboard: XMarketingDashboard = {
  settings: {
    enabled: true,
    analyticsEnabled: true,
    trackingDays: 7,
    maxPostsPerAccount: 10,
    maxLikingUsersPerPost: 25,
    monthlyLimitUsd: 25,
  },
  accounts: [
    { accountId: 'torai_official', estimatedCostUsd: 3.2 },
    { accountId: 'torai_support', estimatedCostUsd: 5.25 },
  ],
  globalCost: { estimatedUsd: 8.45, limitUsd: 25, resources: 8450 },
  interactions,
  analytics: { posts: analyticsPosts, daily: analyticsDaily },
  lastSyncedAt: new Date().toISOString(),
};
