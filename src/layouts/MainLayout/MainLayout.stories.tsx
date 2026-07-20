import type { Meta, StoryObj } from '@storybook/react';
import { BrowserRouter } from 'react-router-dom';
import { MantineProvider } from '@mantine/core';
import { theme } from '@/themes';
import { MainLayout } from './index';

// メタデータの定義
const meta = {
  title: 'Layouts/MainLayout',
  component: MainLayout,
  parameters: {
    layout: 'fullscreen',
  },
  tags: ['autodocs'],
  // MainLayoutコンポーネントがchildrenを必要とするため、デフォルトの引数を設定
  args: {
    children: (
      <div style={{ padding: '2rem', height: '100%' }}>
        <h1>メインコンテンツ</h1>
        <p>ここにページのコンテンツが表示されます</p>
      </div>
    ),
  },
} satisfies Meta<typeof MainLayout>;

export default meta;
type Story = StoryObj<typeof meta>;

// デフォルト（フルサイドバー）表示のストーリー
export const Default: Story = {
  args: {
    // childrenはmetaレベルで定義済み
  },
};

// サイドバーが最小化された状態のストーリー
export const MiniSidebar: Story = {
  parameters: {
    initialSidebarState: 'mini',
  },
  // localStorage経由でサイドバー状態を設定するためのカスタムレンダリング
  render: (args) => {
    // レンダリング前にlocalStorageをセットアップ
    localStorage.setItem('mantine-nav-state', JSON.stringify('mini'));
    return <MainLayout {...args} />;
  },
};

// サイドバーが非表示の状態のストーリー
export const HiddenSidebar: Story = {
  parameters: {
    initialSidebarState: 'hidden',
  },
  render: (args) => {
    localStorage.setItem('mantine-nav-state', JSON.stringify('hidden'));
    return <MainLayout {...args} />;
  },
};

// モバイル表示のストーリー
export const Mobile: Story = {
  parameters: {
    viewport: {
      defaultViewport: 'mobile1',
    },
  },
};

// タブレット表示のストーリー
export const Tablet: Story = {
  parameters: {
    viewport: {
      defaultViewport: 'tablet',
    },
  },
};

// 長いコンテンツでのスクロール表示テスト用のストーリー
export const WithLongContent: Story = {
  args: {
    children: (
      <div style={{ padding: '2rem' }}>
        <h1>長いコンテンツの例</h1>
        {Array(20)
          .fill(0)
          .map((_, i) => (
            <div key={i} style={{ marginBottom: '2rem' }}>
              <h2>セクション {i + 1}</h2>
              <p>
                これは長いコンテンツの例です。このコンテンツはスクロール動作をテストするために使用されます。
                レイアウトがスクロール時にどのように動作するかを確認できます。
              </p>
              <p>
                スクロール時のヘッダーとフッターの固定表示、サイドバーの動作などを確認してください。
              </p>
            </div>
          ))}
      </div>
    ),
  },
};
