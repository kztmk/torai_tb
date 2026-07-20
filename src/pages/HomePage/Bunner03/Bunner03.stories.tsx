import type { Meta, StoryObj } from '@storybook/react';
import { Bunner03ImageLeft } from './Bunner03ImageLeft'; // コンポーネントをインポート

// Storybook の設定: https://storybook.js.org/docs/react/writing-stories/introduction#default-export
const meta: Meta<typeof Bunner03ImageLeft> = {
  title: 'Pages/HomePage/Bunner01ImageLeft', // Storybook UI での表示名
  component: Bunner03ImageLeft,
  parameters: {
    // キャンバス内でコンポーネントをどのように表示するか (オプション)
    // 'centered': 中央揃え
    // 'padded': パディングあり
    // 'fullscreen': 全画面
    layout: 'fullscreen', // バナーのようなコンポーネントには 'fullscreen' が適している場合があります
  },
  // このコンポーネントは自動生成された Autodocs エントリを持ちます: https://storybook.js.org/docs/react/writing-docs/autodocs
  tags: ['autodocs'],
  // argTypes でコントロールを定義できます: https://storybook.js.org/docs/react/api/argtypes
  argTypes: {
    // EmailBannerLeft に props があれば、ここで定義します
    // 例: backgroundColor: { control: 'color' },
  },
};

export default meta;
type Story = StoryObj<typeof meta>;

// ストーリーの定義: https://storybook.js.org/docs/react/writing-stories/args
export const Default: Story = {
  // EmailBannerLeft コンポーネントは props を取らないため、args は空です
  args: {},
};
