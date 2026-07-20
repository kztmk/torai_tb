import type { Meta, StoryObj } from '@storybook/react';
import { Provider } from 'react-redux';
import { MemoryRouter } from 'react-router-dom';
import store from '@/store';
import SignIn from './SignIn';

const meta: Meta<typeof SignIn> = {
  title: 'Pages/Auth/SignIn',
  component: SignIn,
  parameters: {
    layout: 'fullscreen',
  },
  tags: ['autodocs'],
  //argTypes は _appMode プロパティを使わないので削除またはコメントアウト
  argTypes: {
    _appMode: {
      control: { type: 'radio' },
      options: [undefined, 'preview', 'production'],
      description: 'アプリケーションモード (Storybook用)',
    },
  },
  decorators: [
    (Story) => (
      <Provider store={store}>
        <Story />
      </Provider>
    ),
  ],
};

export default meta;
type Story = StoryObj<typeof meta>;

// デフォルトのストーリー (通常モード)
export const Default: Story = {
  // args は不要
  // parameters.env で VITE_APP_MODE を undefined または production に設定しても良い
  parameters: {
    env: {
      VITE_APP_MODE: 'production', // または undefined
    },
  },
};

// プレビューモード用のストーリーを追加
export const PreviewMode: Story = {
  // args は不要
  args: {
    _appMode: 'preview',
    VITE_APP_MODE: 'preview',
  },
  parameters: {
    // このストーリーに対して VITE_APP_MODE を 'preview' に設定
    env: {
      VITE_APP_MODE: 'preview',
    },
  },
};

// モバイル表示のストーリー (通常モード)
export const Mobile: Story = {
  // args は不要
  parameters: {
    viewport: {
      defaultViewport: 'mobile1',
    },
    env: {
      VITE_APP_MODE: 'production', // または undefined
    },
  },
};

// モバイル表示のストーリー (プレビューモード)
export const MobilePreview: Story = {
  // args は不要
  parameters: {
    viewport: {
      defaultViewport: 'mobile1',
    },
    // このストーリーに対して VITE_APP_MODE を 'preview' に設定
    env: {
      VITE_APP_MODE: 'preview',
    },
  },
};
