import { action } from '@storybook/addon-actions';
import type { Meta, StoryObj } from '@storybook/react';
import PriceTable from './index'; // PriceTable コンポーネントをインポート

// Storybook の設定: https://storybook.js.org/docs/react/writing-stories/introduction#default-export
const meta: Meta<typeof PriceTable> = {
  title: 'Pages/HomePage/PriceTable', // Storybook UI での表示名
  component: PriceTable,
  parameters: {
    // キャンバス内でコンポーネントをどのように表示するか (オプション)
    layout: 'fullscreen', // PriceTable はページセクションなので 'fullscreen' が適している場合が多い
  },
  // このコンポーネントは自動生成された Autodocs エントリを持ちます: https://storybook.js.org/docs/react/writing-docs/autodocs
  tags: ['autodocs'],
  // argTypes でコントロールを定義できます: https://storybook.js.org/docs/react/api/argtypes
  argTypes: {
    onSelectPlan: {
      action: 'onSelectPlan', // onSelectPlan が呼び出されたときに Actions タブにログ出力
      description: 'プラン選択時に呼び出されるコールバック関数',
    },
    processingPayment: {
      control: 'object', // オブジェクト形式でコントロール可能にする
      description: '処理中の支払い情報 (例: { planId: "yearly", method: "stripe" }) または null',
    },
  },
  // デフォルトのargs (全てのストーリーで共有されるpropsの初期値)
  args: {
    onSelectPlan: action('onSelectPlan'), // action を使用してインタラクションをログ
  },
};

export default meta;
type Story = StoryObj<typeof meta>;

// ストーリーの定義: https://storybook.js.org/docs/react/writing-stories/args

// 基本的な表示
export const Default: Story = {
  args: {
    processingPayment: null, // 初期状態では何も処理していない
  },
};

// Stripe 決済処理中の表示
export const ProcessingStripe: Story = {
  args: {
    processingPayment: { planId: 'yearly', method: 'stripe' },
  },
};

// 銀行振込処理中の表示
export const ProcessingBank: Story = {
  args: {
    processingPayment: { planId: 'half_yearly', method: 'bank' },
  },
};

// 特定のプラン（例：6ヶ月プラン）でStripe処理中
export const ProcessingHalfYearlyStripe: Story = {
  args: {
    processingPayment: { planId: 'half_yearly', method: 'stripe' },
  },
};

// データがない場合の表示 (PriceTableコンポーネント自体が対応している場合)
// PriceTableコンポーネントの tablePlansData を空にするか、
// display: false にしてこのストーリーをテストする必要があります。
// Storybook上でデータを直接変更するのは難しいので、
// コンポーネント側でそのようなケースをハンドリングしていることを前提とします。
// もしStorybookでテストしたい場合は、PriceTableにプランデータをpropsとして渡せるように変更する必要があります。
