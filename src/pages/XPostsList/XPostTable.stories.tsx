import { configureStore } from '@reduxjs/toolkit';
import type { Meta, StoryObj } from '@storybook/react';
import { Provider } from 'react-redux';
import { XPostDataType } from '@/types/xAccounts';
import XPostTable from './index';

// モックデータの作成
const mockXPosts: XPostDataType[] = [
  {
    id: '1',
    contents: 'これは最初のテスト投稿です。#テスト #初投稿',
    postTo: 'mock-account-1',
    postSchedule: null,
    mediaUrls: JSON.stringify([
      {
        filename: 'test-image-1.jpg',
        fileId: 'file-id-1',
        webViewLink: 'https://via.placeholder.com/150',
        webContentLink: 'https://via.placeholder.com/150',
      },
    ]),
    createdAt: new Date().toISOString(),
  },
  {
    id: '2',
    contents:
      '二つ目の投稿です。長めのテキストを書いてみます。これはテスト用の文章で、特に意味はありません。ただ、文字数を増やすために書いています。',
    postTo: 'mock-account-1',
    postSchedule: new Date(Date.now() + 24 * 60 * 60 * 1000).toISOString(), // 明日
    createdAt: new Date().toISOString(),
  },
  {
    id: '3',
    contents: '予約投稿のテストです。#予約投稿',
    postTo: 'mock-account-1',
    postSchedule: new Date(Date.now() + 48 * 60 * 60 * 1000).toISOString(), // 明後日
    createdAt: new Date().toISOString(),
  },
  {
    id: '4',
    contents: '画像付き投稿のテスト。複数の画像を添付しています。#画像 #複数',
    postTo: 'mock-account-1',
    postSchedule: null,
    mediaUrls: JSON.stringify([
      {
        filename: 'test-image-1.jpg',
        fileId: 'file-id-1',
        webViewLink: 'https://via.placeholder.com/150',
        webContentLink: 'https://via.placeholder.com/150',
      },
      {
        filename: 'test-image-2.jpg',
        fileId: 'file-id-2',
        webViewLink: 'https://via.placeholder.com/150',
        webContentLink: 'https://via.placeholder.com/150',
      },
    ]),
    createdAt: new Date().toISOString(),
  },
  {
    id: '5',
    contents: '別のアカウント用の投稿です。',
    postTo: 'mock-account-2',
    createdAt: new Date().toISOString(),
  },
];

// モックストアの設定
const createMockStore = () => {
  return configureStore({
    reducer: {
      xAccounts: (
        state = {
          xAccountList: [
            {
              id: 'mock-account-1',
              name: 'テストアカウント1',
              apiKey: 'mock-api-key',
              apiSecret: 'mock-api-secret',
              accessToken: 'mock-access-token',
              accessTokenSecret: 'mock-access-token-secret',
              note: 'テスト用アカウント',
            },
            {
              id: 'mock-account-2',
              name: 'テストアカウント2',
              apiKey: 'mock-api-key-2',
              apiSecret: 'mock-api-secret-2',
              accessToken: 'mock-access-token-2',
              accessTokenSecret: 'mock-access-token-secret-2',
              note: 'テスト用アカウント2',
            },
          ],
        }
      ) => state,
      xPosts: (
        state = {
          xPostList: mockXPosts,
          xPost: {},
          process: 'idle',
          isLoading: false,
          isError: false,
          errorMessage: '',
        }
      ) => state,
      apiController: (
        state = {
          status: 'idle',
          error: null,
          uploadedMedia: null,
          triggerStatus: null,
          archivedSheet: null,
        }
      ) => state,
    },
  });
};

// メタ情報の設定
const meta = {
  title: 'Pages/XPosts/XPostTable',
  component: XPostTable,
  parameters: {
    layout: 'fullscreen',
  },
  tags: ['autodocs'],
  decorators: [
    (Story) => (
      <Provider store={createMockStore()}>
        <div style={{ maxWidth: '1200px', margin: '20px auto', padding: '0 16px' }}>
          <Story />
        </div>
      </Provider>
    ),
  ],
} satisfies Meta<typeof XPostTable>;

export default meta;
type Story = StoryObj<typeof meta>;

// 基本的な表示
export const Default: Story = {
  args: {
    xAccountId: 'mock-account-1',
  },
};

// モバイル表示
export const MobileView: Story = {
  args: {
    xAccountId: 'mock-account-1',
  },
  parameters: {
    viewport: {
      defaultViewport: 'mobile1',
    },
  },
};

// 別アカウントの投稿（フィルタリングのテスト）
export const DifferentAccount: Story = {
  args: {
    xAccountId: 'mock-account-2',
  },
};

// ロード中の表示
export const Loading: Story = {
  args: {
    xAccountId: 'mock-account-1',
  },
  decorators: [
    (Story) => {
      const mockStore = configureStore({
        reducer: {
          xAccounts: (
            state = {
              xAccountList: [
                {
                  id: 'mock-account-1',
                  name: 'テストアカウント1',
                  apiKey: 'mock-api-key',
                  apiSecret: 'mock-api-secret',
                  accessToken: 'mock-access-token',
                  accessTokenSecret: 'mock-access-token-secret',
                  note: 'テスト用アカウント',
                },
              ],
            }
          ) => state,
          xPosts: (
            state = {
              xPostList: [],
              xPost: {},
              process: 'fetch',
              isLoading: true,
              isError: false,
              errorMessage: '',
            }
          ) => state,
          apiController: (
            state = {
              status: 'idle',
              error: null,
              uploadedMedia: null,
              triggerStatus: null,
              archivedSheet: null,
            }
          ) => state,
        },
      });

      return (
        <Provider store={mockStore}>
          <div style={{ maxWidth: '1200px', margin: '20px auto', padding: '0 16px' }}>
            <Story />
          </div>
        </Provider>
      );
    },
  ],
};

// エラー状態の表示
export const Error: Story = {
  args: {
    xAccountId: 'mock-account-1',
  },
  decorators: [
    (Story) => {
      const mockStore = configureStore({
        reducer: {
          xAccounts: (
            state = {
              xAccountList: [
                {
                  id: 'mock-account-1',
                  name: 'テストアカウント1',
                  apiKey: 'mock-api-key',
                  apiSecret: 'mock-api-secret',
                  accessToken: 'mock-access-token',
                  accessTokenSecret: 'mock-access-token-secret',
                  note: 'テスト用アカウント',
                },
              ],
            }
          ) => state,
          xPosts: (
            state = {
              xPostList: [],
              xPost: {},
              process: 'idle',
              isLoading: false,
              isError: true,
              errorMessage: '投稿の取得中にエラーが発生しました。',
            }
          ) => state,
          apiController: (
            state = {
              status: 'idle',
              error: null,
              uploadedMedia: null,
              triggerStatus: null,
              archivedSheet: null,
            }
          ) => state,
        },
      });

      return (
        <Provider store={mockStore}>
          <div style={{ maxWidth: '1200px', margin: '20px auto', padding: '0 16px' }}>
            <Story />
          </div>
        </Provider>
      );
    },
  ],
};
