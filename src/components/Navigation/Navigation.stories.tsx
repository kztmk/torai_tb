import { useState } from 'react';
import type { Meta, StoryObj } from '@storybook/react';
import { BrowserRouter } from 'react-router-dom';
import { MantineProvider } from '@mantine/core';
import { SidebarState } from '@/layouts/MainLayout/Sidebar/AppsLayout';
import { theme } from '@/themes';
import Navigation from './index';

// メタデータの定義
const meta = {
  title: 'Components/Navigation',
  component: Navigation,
  parameters: {
    layout: 'fullscreen',
  },
  tags: ['autodocs'],
} satisfies Meta<typeof Navigation>;

export default meta;
type Story = StoryObj<typeof meta>;

// デフォルトのストーリー（フル表示）
export const Default: Story = {
  args: {
    sidebarState: 'full',
    onClose: () => console.log('サイドバーを閉じました'),
    onSidebarStateChange: (state) => console.log(`サイドバーの状態を ${state} に変更しました`),
  },
};

// ミニバージョンのストーリー
export const Mini: Story = {
  args: {
    sidebarState: 'mini',
    onClose: () => console.log('サイドバーを閉じました'),
    onSidebarStateChange: (state) => console.log(`サイドバーの状態を ${state} に変更しました`),
  },
};

// 状態を切り替えられるインタラクティブなストーリー
export const Interactive: Story = {
  // 追加: デフォルトのargsを指定
  args: {
    sidebarState: 'full',
    onClose: () => console.log('サイドバーを閉じました'),
    onSidebarStateChange: (state) => console.log(`サイドバーの状態を ${state} に変更しました`),
  },
  render: (args) => {
    // eslint-disable-next-line react-hooks/rules-of-hooks
    const [sidebarState, setSidebarState] = useState<SidebarState>('full');

    return (
      <div style={{ display: 'flex', flexDirection: 'column', height: '100%' }}>
        <div style={{ padding: '1rem', background: '#f0f0f0' }}>
          <button onClick={() => setSidebarState('full')}>フル表示</button>
          <button onClick={() => setSidebarState('mini')}>ミニ表示</button>
          <p>現在の状態: {sidebarState}</p>
        </div>
        <div style={{ flex: 1, display: 'flex' }}>
          <Navigation
            {...args}
            sidebarState={sidebarState}
            onSidebarStateChange={setSidebarState}
            onClose={() => console.log('閉じる')}
          />
          <div style={{ flex: 1, padding: '1rem' }}>
            <h2>メインコンテンツエリア</h2>
            <p>ナビゲーションの横に表示されるコンテンツです。</p>
          </div>
        </div>
      </div>
    );
  },
};
