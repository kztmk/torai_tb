import { configureStore } from '@reduxjs/toolkit';
import type { Meta, StoryObj } from '@storybook/react';
import { Provider } from 'react-redux';
import xAccountsReducer from '@/store/reducers/xAccountsSlice';
import { XAccount } from '@/types/xAccounts';
import XAccountsListTable from './index';

// モック用のXAccountデータ
const mockXAccounts: XAccount[] = [
  {
    id: 'account1',
    name: '@example_account1',
    apiKey: 'api_key_example_1',
    apiSecret: 'api_secret_example_1',
    accessToken: 'access_token_example_1',
    accessTokenSecret: 'access_token_secret_example_1',
    note: 'テスト用アカウント1',
  },
  {
    id: 'account2',
    name: '@example_account2',
    apiKey: 'api_key_example_2',
    apiSecret: 'api_secret_example_2',
    accessToken: 'access_token_example_2',
    accessTokenSecret: 'access_token_secret_example_2',
    note: 'テスト用アカウント2',
  },
  {
    id: 'account3',
    name: '@example_account3',
    apiKey: 'api_key_example_3',
    apiSecret: 'api_secret_example_3',
    accessToken: 'access_token_example_3',
    accessTokenSecret: 'access_token_secret_example_3',
    note: 'テスト用アカウント3（長めの説明文をここに入れてテキストの折り返しやセルサイズの調整などの挙動を確認します。アカウント管理画面の表示テスト用データです。）',
  },
];

// 空のXAccountデータ
const emptyXAccount: XAccount = {
  id: '',
  name: '',
  apiKey: '',
  apiSecret: '',
  accessToken: '',
  accessTokenSecret: '',
  note: '',
};

/**
 * モックのRedux Storeを作成する関数
 * @param customXAccounts カスタムのXAccountリスト（省略可能）
 * @returns 設定済みのRedux Store
 */
const createMockStore = (customXAccounts: XAccount[] = mockXAccounts) => {
  return configureStore({
    reducer: {
      xAccounts: xAccountsReducer,
    },
    preloadedState: {
      xAccounts: {
        xAccountList: customXAccounts,
        xAccount: emptyXAccount,
        process: 'idle' as const,
        isLoading: false,
        isError: false,
        errorMessage: '',
      },
    },
  });
};

// Storybook用メタデータ
const meta = {
  title: 'Pages/XAccoutsList/XAccountsListTable',
  component: XAccountsListTable,
  parameters: {
    layout: 'fullscreen',
  },
  decorators: [
    (Story) => (
      <Provider store={createMockStore()}>
        <div style={{ padding: '20px', maxWidth: '1200px', margin: '0 auto' }}>
          <Story />
        </div>
      </Provider>
    ),
  ],
  tags: ['autodocs'],
} satisfies Meta<typeof XAccountsListTable>;

export default meta;
type Story = StoryObj<typeof meta>;

// 基本的な表示
export const Default: Story = {};

// データなしの状態
export const EmptyTable: Story = {
  decorators: [
    (Story) => (
      <Provider store={createMockStore([])}>
        <div style={{ padding: '20px', maxWidth: '1200px', margin: '0 auto' }}>
          <Story />
        </div>
      </Provider>
    ),
  ],
};

// 読み込み中の状態
export const Loading: Story = {
  decorators: [
    (Story) => (
      <Provider
        store={configureStore({
          reducer: { xAccounts: xAccountsReducer },
          preloadedState: {
            xAccounts: {
              xAccountList: [],
              xAccount: emptyXAccount,
              process: 'idle' as const,
              isLoading: true,
              isError: false,
              errorMessage: '',
            },
          },
        })}
      >
        <div style={{ padding: '20px', maxWidth: '1200px', margin: '0 auto' }}>
          <Story />
        </div>
      </Provider>
    ),
  ],
};

// エラー状態
export const Error: Story = {
  decorators: [
    (Story) => (
      <Provider
        store={configureStore({
          reducer: { xAccounts: xAccountsReducer },
          preloadedState: {
            xAccounts: {
              xAccountList: [],
              xAccount: emptyXAccount,
              process: 'idle' as const,
              isLoading: false,
              isError: true,
              errorMessage: 'データの取得に失敗しました',
            },
          },
        })}
      >
        <div style={{ padding: '20px', maxWidth: '1200px', margin: '0 auto' }}>
          <Story />
        </div>
      </Provider>
    ),
  ],
};

// 多数のデータがある状態
export const ManyRecords: Story = {
  decorators: [
    (Story) => {
      // 20件のデータを生成
      const manyAccounts = Array.from({ length: 20 }, (_, i) => ({
        id: `account${i + 1}`,
        name: `@example_account${i + 1}`,
        apiKey: `api_key_example_${i + 1}`,
        apiSecret: `api_secret_example_${i + 1}`,
        accessToken: `access_token_example_${i + 1}`,
        accessTokenSecret: `access_token_secret_example_${i + 1}`,
        note: `テスト用アカウント${i + 1}`,
      }));

      return (
        <Provider store={createMockStore(manyAccounts)}>
          <div style={{ padding: '20px', maxWidth: '1200px', margin: '0 auto' }}>
            <Story />
          </div>
        </Provider>
      );
    },
  ],
};
