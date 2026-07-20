import { createAsyncThunk, createSlice, PayloadAction } from '@reduxjs/toolkit';
import type {
  XMarketingDailyMetric,
  XMarketingDashboard,
  XMarketingInteraction,
  XMarketingPostAnalytics,
} from '@/types/xMarketing';
import { gasProxyPost, getGasResponseErrorMessage } from '@/utils/gasProxyClient';
import type { RootState } from '../index';

type State = {
  dashboard: XMarketingDashboard | null;
  selectedAccountId: string;
  selectedInteractionId: string | null;
  status: 'idle' | 'loading' | 'success' | 'error';
  saving: boolean;
  error: string | null;
};

const initialState: State = {
  dashboard: null,
  selectedAccountId: 'all',
  selectedInteractionId: null,
  status: 'idle',
  saving: false,
  error: null,
};

const defaultSettings: XMarketingDashboard['settings'] = {
  enabled: false,
  analyticsEnabled: false,
  trackingDays: 7,
  maxPostsPerAccount: 10,
  maxLikingUsersPerPost: 25,
  monthlyLimitUsd: 25,
};

const asRecord = (value: unknown): Record<string, any> =>
  value !== null && typeof value === 'object' && !Array.isArray(value)
    ? (value as Record<string, any>)
    : {};
const asNumber = (value: unknown, fallback = 0) => {
  const number = Number(value);
  return Number.isFinite(number) ? number : fallback;
};
const asNonEmptyString = (value: unknown): string | null =>
  typeof value === 'string' && value !== '' ? value : null;
const getRequestErrorMessage = (error: unknown, fallback: string) => {
  const errorRecord = asRecord(error);
  const response = asRecord(errorRecord.response);
  const data = asRecord(response.data);
  return asNonEmptyString(data.message) ?? asNonEmptyString(errorRecord.message) ?? fallback;
};

function normalizeInteraction(value: unknown): XMarketingInteraction {
  const interaction = asRecord(value);
  const counts = asRecord(interaction.counts);
  return {
    id: String(interaction.id || ''),
    accountId: String(interaction.accountId || ''),
    userId: String(interaction.userId || ''),
    username: String(interaction.username || ''),
    name: String(interaction.name || ''),
    reactionType: ['like', 'reply', 'quote', 'repost', 'follow'].includes(interaction.reactionType)
      ? interaction.reactionType
      : 'like',
    postId: String(interaction.postId || ''),
    postText: String(interaction.postText || ''),
    occurredAt: String(interaction.occurredAt || ''),
    score: asNumber(interaction.score),
    stage: ['new', 'interested', 'conversation', 'completed'].includes(interaction.stage)
      ? interaction.stage
      : 'new',
    status: ['unread', 'read', 'handled'].includes(interaction.status)
      ? interaction.status
      : 'unread',
    counts: {
      likes: asNumber(counts.likes),
      replies: asNumber(counts.replies),
      quotes: asNumber(counts.quotes),
      reposts: asNumber(counts.reposts),
    },
    tags: Array.isArray(interaction.tags) ? interaction.tags.map(String) : [],
    memo: String(interaction.memo || ''),
  };
}

function normalizePostAnalytics(value: unknown): XMarketingPostAnalytics {
  const post = asRecord(value);
  const metrics = asRecord(post.metrics);
  const availability = asRecord(post.availability);
  const engagementRate = Number(post.engagementRate);
  return {
    id: String(post.id || ''),
    accountId: String(post.accountId || ''),
    postId: String(post.postId || ''),
    text: String(post.text || ''),
    createdAt: String(post.createdAt || ''),
    capturedAt: String(post.capturedAt || ''),
    metrics: {
      impressions: asNumber(metrics.impressions),
      engagements: asNumber(metrics.engagements),
      likes: asNumber(metrics.likes),
      replies: asNumber(metrics.replies),
      reposts: asNumber(metrics.reposts),
      quotes: asNumber(metrics.quotes),
      bookmarks: asNumber(metrics.bookmarks),
      profileClicks: asNumber(metrics.profileClicks),
      urlClicks: asNumber(metrics.urlClicks),
    },
    engagementRate:
      post.engagementRate === null ||
      post.engagementRate === undefined ||
      !Number.isFinite(engagementRate)
        ? null
        : engagementRate,
    metricSource: ['non_public', 'organic'].includes(post.metricSource)
      ? post.metricSource
      : 'public',
    availability: {
      impressions: availability.impressions === true,
      profileClicks: availability.profileClicks === true,
      urlClicks: availability.urlClicks === true,
    },
  };
}

function normalizeDailyMetric(value: unknown): XMarketingDailyMetric {
  const metric = asRecord(value);
  const engagementRate = Number(metric.engagementRate);
  return {
    accountId: String(metric.accountId || ''),
    date: String(metric.date || ''),
    postCount: asNumber(metric.postCount),
    impressions: asNumber(metric.impressions),
    engagements: asNumber(metric.engagements),
    likes: asNumber(metric.likes),
    replies: asNumber(metric.replies),
    reposts: asNumber(metric.reposts),
    quotes: asNumber(metric.quotes),
    engagementRate:
      metric.engagementRate === null ||
      metric.engagementRate === undefined ||
      !Number.isFinite(engagementRate)
        ? null
        : engagementRate,
    impressionsAvailable: metric.impressionsAvailable === true,
  };
}

function normalizeDashboard(value: unknown): XMarketingDashboard {
  const dashboard = asRecord(value);
  const settings = asRecord(dashboard.settings);
  const globalCost = asRecord(dashboard.globalCost);
  const analytics = asRecord(dashboard.analytics);
  return {
    settings: {
      enabled: typeof settings.enabled === 'boolean' ? settings.enabled : defaultSettings.enabled,
      analyticsEnabled:
        typeof settings.analyticsEnabled === 'boolean'
          ? settings.analyticsEnabled
          : defaultSettings.analyticsEnabled,
      trackingDays: asNumber(settings.trackingDays, defaultSettings.trackingDays),
      maxPostsPerAccount: asNumber(settings.maxPostsPerAccount, defaultSettings.maxPostsPerAccount),
      maxLikingUsersPerPost: asNumber(
        settings.maxLikingUsersPerPost,
        defaultSettings.maxLikingUsersPerPost
      ),
      monthlyLimitUsd: asNumber(settings.monthlyLimitUsd, defaultSettings.monthlyLimitUsd),
    },
    accounts: Array.isArray(dashboard.accounts)
      ? dashboard.accounts.map((value: unknown) => {
          const account = asRecord(value);
          return {
            accountId: String(account.accountId || ''),
            estimatedCostUsd: asNumber(account.estimatedCostUsd),
          };
        })
      : [],
    globalCost: {
      estimatedUsd: asNumber(globalCost.estimatedUsd),
      limitUsd: asNumber(globalCost.limitUsd, defaultSettings.monthlyLimitUsd),
      resources: asNumber(globalCost.resources),
    },
    interactions: Array.isArray(dashboard.interactions)
      ? dashboard.interactions
          .map(normalizeInteraction)
          .filter((interaction: XMarketingInteraction) => interaction.id !== '')
      : [],
    analytics: {
      posts: Array.isArray(analytics.posts)
        ? analytics.posts
            .map(normalizePostAnalytics)
            .filter((post: XMarketingPostAnalytics) => post.id !== '' && post.postId !== '')
        : [],
      daily: Array.isArray(analytics.daily)
        ? analytics.daily
            .map(normalizeDailyMetric)
            .filter(
              (metric: XMarketingDailyMetric) => metric.accountId !== '' && metric.date !== ''
            )
        : [],
    },
    lastSyncedAt: String(dashboard.lastSyncedAt || ''),
  };
}

export const fetchXMarketingDashboard = createAsyncThunk<
  XMarketingDashboard,
  string | undefined,
  { rejectValue: string }
>('xMarketing/fetchDashboard', async (accountId = 'all', api) => {
  try {
    const response = await gasProxyPost({}, { target: 'xMarketing', action: 'fetch', accountId });
    const error = getGasResponseErrorMessage(
      response.data,
      'Xマーケティングデータを取得できませんでした。'
    );
    if (error !== null) {
      return api.rejectWithValue(error);
    }
    return normalizeDashboard(response.data.data);
  } catch (error: unknown) {
    return api.rejectWithValue(
      getRequestErrorMessage(error, 'Xマーケティングデータを取得できませんでした。')
    );
  }
});

export const updateXMarketingProspect = createAsyncThunk<
  XMarketingInteraction,
  { interactionId: string; stage?: string; status?: string; tags?: string[]; memo?: string },
  { rejectValue: string }
>('xMarketing/updateProspect', async (input, api) => {
  try {
    const response = await gasProxyPost(input, { target: 'xMarketing', action: 'updateProspect' });
    const error = getGasResponseErrorMessage(response.data, '対応内容を保存できませんでした。');
    if (error !== null) {
      return api.rejectWithValue(error);
    }
    return normalizeInteraction(response.data?.data?.interaction);
  } catch (error: unknown) {
    return api.rejectWithValue(getRequestErrorMessage(error, '対応内容を保存できませんでした。'));
  }
});

export const saveXMarketingSettings = createAsyncThunk<
  void,
  XMarketingDashboard['settings'],
  { rejectValue: string }
>('xMarketing/saveSettings', async (input, api) => {
  try {
    const response = await gasProxyPost(input, {
      target: 'xMarketing',
      action: 'upsertSettings',
    });
    const error = getGasResponseErrorMessage(response.data, '取得設定を保存できませんでした。');
    if (error !== null) {
      return api.rejectWithValue(error);
    }
  } catch (error: unknown) {
    return api.rejectWithValue(getRequestErrorMessage(error, '取得設定を保存できませんでした。'));
  }
});

export const refreshXMarketing = createAsyncThunk<void, void, { rejectValue: string }>(
  'xMarketing/refresh',
  async (_, api) => {
    try {
      const response = await gasProxyPost({}, { target: 'xMarketing', action: 'refresh' });
      const error = getGasResponseErrorMessage(response.data, 'X APIから更新できませんでした。');
      if (error !== null) {
        return api.rejectWithValue(error);
      }
      const result = asRecord(response.data?.data);
      if (result.status === 'disabled') {
        return api.rejectWithValue(
          '取得設定で反応者取得または投稿分析を有効にしてから更新してください。'
        );
      }
      if (result.status === 'budget_stopped') {
        return api.rejectWithValue('今月の予算上限に達したため、X APIからの取得を停止しました。');
      }
      if (result.status === 'already_running') {
        return api.rejectWithValue('Xマーケティングの取得はすでに実行中です。');
      }
    } catch (error: unknown) {
      return api.rejectWithValue(getRequestErrorMessage(error, 'X APIから更新できませんでした。'));
    }
  }
);

const slice = createSlice({
  name: 'xMarketing',
  initialState,
  reducers: {
    selectAccount(state, action: PayloadAction<string>) {
      state.selectedAccountId = action.payload;
      state.selectedInteractionId = null;
    },
    selectInteraction(state, action: PayloadAction<string | null>) {
      state.selectedInteractionId = action.payload;
    },
  },
  extraReducers: (builder) => {
    builder.addCase(fetchXMarketingDashboard.pending, (state) => {
      state.status = 'loading';
      state.error = null;
    });
    builder.addCase(fetchXMarketingDashboard.fulfilled, (state, action) => {
      state.status = 'success';
      state.dashboard = action.payload;
      const interactions = (action.payload?.interactions || []).filter(
        (interaction) =>
          state.selectedAccountId === 'all' || interaction.accountId === state.selectedAccountId
      );
      const selectedExists = interactions.some(
        (interaction) => interaction.id === state.selectedInteractionId
      );
      if (!selectedExists) {
        state.selectedInteractionId = interactions[0]?.id || null;
      }
    });
    builder.addCase(fetchXMarketingDashboard.rejected, (state, action) => {
      state.status = 'error';
      state.error = action.payload || '取得に失敗しました。';
    });
    builder.addCase(updateXMarketingProspect.pending, (state) => {
      state.saving = true;
    });
    builder.addCase(updateXMarketingProspect.fulfilled, (state, action) => {
      state.saving = false;
      if (state.dashboard) {
        const index = state.dashboard.interactions.findIndex((v) => v.id === action.payload.id);
        if (index >= 0) {
          state.dashboard.interactions[index] = action.payload;
        }
      }
    });
    builder.addCase(updateXMarketingProspect.rejected, (state, action) => {
      state.saving = false;
      state.error = action.payload || '保存に失敗しました。';
    });
    builder.addCase(saveXMarketingSettings.pending, (state) => {
      state.saving = true;
    });
    builder.addCase(saveXMarketingSettings.fulfilled, (state) => {
      state.saving = false;
    });
    builder.addCase(saveXMarketingSettings.rejected, (state, action) => {
      state.saving = false;
      state.error = action.payload || '保存に失敗しました。';
    });
    builder.addCase(refreshXMarketing.pending, (state) => {
      state.saving = true;
    });
    builder.addCase(refreshXMarketing.fulfilled, (state) => {
      state.saving = false;
    });
    builder.addCase(refreshXMarketing.rejected, (state, action) => {
      state.saving = false;
      state.error = action.payload || '更新に失敗しました。';
    });
  },
});

export const { selectAccount, selectInteraction } = slice.actions;
export const selectXMarketing = (state: RootState) => state.xMarketing;
export default slice.reducer;
