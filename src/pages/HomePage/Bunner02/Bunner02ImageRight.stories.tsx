import type { Meta, StoryObj } from '@storybook/react';
import { Bunner02ImageRight } from './Bunner02ImageRight'; // コンポーネントをインポート

// Storybook の設定: https://storybook.js.org/docs/react/writing-stories/introduction#default-export
const meta: Meta<typeof Bunner02ImageRight> = {
  title: 'Pages/HomePage/Bunner02ImageRight', // Storybook UI での表示名
  component: Bunner02ImageRight,
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
    // Bunner02ImageRight に props があれば、ここで定義します
    // 例: backgroundColor: { control: 'color' },
  },
};

export default meta;
type Story = StoryObj<typeof meta>;

// ストーリーの定義: https://storybook.js.org/docs/react/writing-stories/args
export const Default: Story = {
  // Bunner02ImageRight コンポーネントが props を取らない場合、args は空です
  args: {},
};
