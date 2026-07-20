import type { Meta, StoryObj } from '@storybook/react';
import { FeaturesAsymmetrical } from './index'; // FeaturesAsymmetricalコンポーネントのパスを適宜修正してください

// Storybookのメタデータを定義します
const meta: Meta<typeof FeaturesAsymmetrical> = {
  title: 'Components/FeaturesAsymmetrical', // Storybookのサイドバーに表示されるタイトル
  component: FeaturesAsymmetrical,
  parameters: {
    // レイアウトや他のパラメータをここで設定できます
    layout: 'fullscreen', // 'centered' や 'padded' なども利用可能です
  },
  // コンポーネントのpropsの型やコントロールを定義します (任意)
  argTypes: {
    title: { control: 'text' },
    description: { control: 'text' },
    imageUrl: { control: 'text' },
    imageAlt: { control: 'text' },
    features: { control: 'object' },
    imagePosition: {
      control: { type: 'radio' },
      options: ['left', 'right'],
    },
    backgroundColor: { control: 'color' },
    textColor: { control: 'color' },
    buttonText: { control: 'text' },
    buttonLink: { control: 'text' },
  },
  // デフォルトのprops値を設定します (任意)
  args: {
    title: '革新的な機能',
    description:
      '私たちの新しいソリューションがどのようにあなたのビジネスを変革するかをご覧ください。',
    imageUrl: 'https://via.placeholder.com/600x400', // サンプルの画像URL
    imageAlt: 'プレースホルダー画像',
    features: [
      {
        id: '1',
        name: '高速パフォーマンス',
        description: '最先端の技術により、驚異的な速度を実現します。',
        // icon: YourIconComponent1, // アイコンコンポーネントを使用する場合
      },
      {
        id: '2',
        name: '柔軟なカスタマイズ',
        description: 'あなたのニーズに合わせて、自由に設定を調整できます。',
        // icon: YourIconComponent2,
      },
      {
        id: '3',
        name: '堅牢なセキュリティ',
        description: '最新のセキュリティ対策で、あなたの大切なデータを守ります。',
        // icon: YourIconComponent3,
      },
    ],
    imagePosition: 'left',
    buttonText: 'もっと詳しく',
    buttonLink: '#',
  },
};

export default meta;

// Storyの型を定義します
type Story = StoryObj<typeof meta>;

// 基本的なストーリーを定義します
export const Default: Story = {
  // このストーリー固有のpropsを上書きできます
  args: {
    // デフォルトのargsを使用
  },
};

export const ImageRight: Story = {
  args: {
    imagePosition: 'right',
    title: '右側に画像を表示',
    description: '画像の配置を右側に変更したバリエーションです。',
    features: [
      {
        id: '1',
        name: 'レスポンシブデザイン',
        description: 'あらゆるデバイスで最適に表示されます。',
      },
      {
        id: '2',
        name: '簡単な統合',
        description: '既存のシステムとシームレスに連携します。',
      },
    ],
  },
};

export const CustomColors: Story = {
  args: {
    title: 'カスタムカラー',
    description: '背景色とテキストの色をカスタマイズした例です。',
    backgroundColor: '#f0f8ff', // AliceBlue
    textColor: '#333333', // Dark Gray
  },
};

export const WithoutButton: Story = {
  args: {
    title: 'ボタンなし',
    description: 'コールトゥアクションボタンを表示しない場合の例です。',
    buttonText: undefined, // または空文字 ''
    buttonLink: undefined, // または空文字 ''
  },
};
