import type { Meta, StoryObj } from '@storybook/react';
import { FeaturesWithCards } from './index'; // コンポーネントをインポート

// Storybook の設定: https://storybook.js.org/docs/react/writing-stories/introduction#default-export
const meta: Meta<typeof FeaturesWithCards> = {
  title: 'Pages/HomePage/FeaturesWithCards', // Storybook UI での表示名
  component: FeaturesWithCards,
  parameters: {
    // キャンバス内でコンポーネントをどのように表示するか (オプション)
    // layout: 'centered', // コンポーネントが中央揃えに適している場合
    // layout: 'padded', // コンポーネントの周囲にパディングが必要な場合
    layout: 'fullscreen', // コンポーネントが全幅を占める場合や、ページセクションのような場合
  },
  // このコンポーネントは自動生成された Autodocs エントリを持ちます: https://storybook.js.org/docs/react/writing-docs/autodocs
  tags: ['autodocs'],
  // argTypes でコントロールを定義できます: https://storybook.js.org/docs/react/api/argtypes
  argTypes: {
    // FeaturesWithCards に props があれば、ここで定義します
    // 例: title: { control: 'text' },
  },
};

export default meta;
type Story = StoryObj<typeof meta>;

// ストーリーの定義: https://storybook.js.org/docs/react/writing-stories/args
export const Default: Story = {
  // FeaturesWithCards コンポーネントに渡す props があれば、ここで指定します
  args: {},
};
