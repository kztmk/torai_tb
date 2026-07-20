import { configureStore } from '@reduxjs/toolkit';
import type { Meta, StoryObj } from '@storybook/react';
import { Provider } from 'react-redux';
import Trigger from './index';

// モックのRedux Store作成
const createMockStore = (googleSheetUrl: string | null = 'https://example.com/api') => {
  return configureStore({
    reducer: {
      auth: (
        state = {
          user: {
            uid: 'mock-user-id',
            email: 'test@example.com',
            displayName: 'テストユーザー',
            role: 'user',
            photoURL: null,
            avatarUrl: null,
            backgroundImageUrl: null,
            googleSheetUrl,
          },
          loading: false,
          error: null,
          task: null,
        }
      ) => state,
    },
  });
};

// メタデータ設定
const meta = {
  title: 'Pages/Activity/Trigger',
  component: Trigger,
  parameters: {
    layout: 'padded',
  },
  tags: ['autodocs'],
  decorators: [
    (Story) => (
      <Provider store={createMockStore()}>
        <div style={{ maxWidth: '800px', margin: '0 auto' }}>
          <Story />
        </div>
      </Provider>
    ),
  ],
} satisfies Meta<typeof Trigger>;

export default meta;
type Story = StoryObj<typeof meta>;

// デフォルトのストーリー
export const Default: Story = {};

// トリガーアクティブ状態をモックするためのAxiosのモック
export const TriggerActive: Story = {
  parameters: {
    mockData: [
      {
        url: 'https://example.com/api?action=status&target=trigger',
        method: 'GET',
        status: 200,
        response: {
          status: 'success',
          data: {
            exists: true,
            nextRun: new Date(Date.now() + 1000 * 60 * 5).toISOString(), // 5分後
            created: new Date().toISOString(),
            frequency: 5,
          },
        },
      },
    ],
  },
};

// トリガー非アクティブ状態
export const TriggerInactive: Story = {
  parameters: {
    mockData: [
      {
        url: 'https://example.com/api?action=status&target=trigger',
        method: 'GET',
        status: 200,
        response: {
          status: 'success',
          data: {
            exists: false,
          },
        },
      },
    ],
  },
};

// エラー状態
export const Error: Story = {
  parameters: {
    mockData: [
      {
        url: 'https://example.com/api?action=status&target=trigger',
        method: 'GET',
        status: 200,
        response: {
          status: 'error',
          message: 'トリガー情報の取得に失敗しました',
        },
      },
    ],
  },
};

// GoogleSheet URL未設定状態
export const NoGoogleSheetUrl: Story = {
  decorators: [
    (Story) => (
      <Provider store={createMockStore(null)}>
        <div style={{ maxWidth: '800px', margin: '0 auto' }}>
          <Story />
        </div>
      </Provider>
    ),
  ],
};

// ローディング状態
export const Loading: Story = {
  parameters: {
    mockData: [
      {
        url: 'https://example.com/api?action=status&target=trigger',
        method: 'GET',
        delay: 3000, // 3秒遅延でローディング状態を表示
        response: {
          status: 'success',
          data: {
            exists: true,
            nextRun: new Date(Date.now() + 1000 * 60 * 5).toISOString(),
            created: new Date().toISOString(),
            frequency: 5,
          },
        },
      },
    ],
  },
};
