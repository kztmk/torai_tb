export type XMarketingStage = 'new' | 'interested' | 'conversation' | 'completed';
export type XMarketingReaction = 'like' | 'reply' | 'quote' | 'repost' | 'follow';

export type XMarketingInteraction = {
  id: string;
  accountId: string;
  userId: string;
  username: string;
  name: string;
  reactionType: XMarketingReaction;
  postId: string;
  postText: string;
  occurredAt: string;
  score: number;
  stage: XMarketingStage;
  status: 'unread' | 'read' | 'handled';
  counts: { likes: number; replies: number; quotes: number; reposts: number };
  tags: string[];
  memo: string;
};

export type XMarketingPostAnalytics = {
  id: string;
  accountId: string;
  postId: string;
  text: string;
  createdAt: string;
  capturedAt: string;
  metrics: {
    impressions: number;
    engagements: number;
    likes: number;
    replies: number;
    reposts: number;
    quotes: number;
    bookmarks: number;
    profileClicks: number;
    urlClicks: number;
  };
  engagementRate: number | null;
  metricSource: 'public' | 'non_public' | 'organic';
  availability: {
    impressions: boolean;
    profileClicks: boolean;
    urlClicks: boolean;
  };
};

export type XMarketingDailyMetric = {
  accountId: string;
  date: string;
  postCount: number;
  impressions: number;
  engagements: number;
  likes: number;
  replies: number;
  reposts: number;
  quotes: number;
  engagementRate: number | null;
  impressionsAvailable: boolean;
};

export type XMarketingDashboard = {
  settings: {
    enabled: boolean;
    analyticsEnabled: boolean;
    trackingDays: number;
    maxPostsPerAccount: number;
    maxLikingUsersPerPost: number;
    monthlyLimitUsd: number;
  };
  accounts: { accountId: string; estimatedCostUsd: number }[];
  globalCost: { estimatedUsd: number; limitUsd: number; resources: number };
  interactions: XMarketingInteraction[];
  analytics: {
    posts: XMarketingPostAnalytics[];
    daily: XMarketingDailyMetric[];
  };
  lastSyncedAt: string;
};
