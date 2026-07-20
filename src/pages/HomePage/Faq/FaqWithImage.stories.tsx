import type { Meta, StoryObj } from '@storybook/react';
import { FaqWithImage } from './index'; // FaqWithImageコンポーネントのパスを適宜修正してください

// Storybookのメタデータを定義します
const meta: Meta<typeof FaqWithImage> = {
  title: 'Components/FaqWithImage', // Storybookのサイドバーに表示されるタイトル
  component: FaqWithImage,
  parameters: {
    layout: 'fullscreen',
  },
  argTypes: {
    title: { control: 'text' },
    subtitle: { control: 'text' },
    imageUrl: { control: 'text' },
    imageAlt: { control: 'text' },
    imagePosition: {
      control: { type: 'radio' },
      options: ['left', 'right'],
    },
    faqItems: { control: 'object' },
    backgroundColor: { control: 'color' },
    textColor: { control: 'color' },
    questionTextColor: { control: 'color' },
    answerTextColor: { control: 'color' },
    accentColor: { control: 'color' }, // 例えばアコーディオンの開閉アイコンや区切り線など
  },
  args: {
    title: 'よくあるご質問',
    subtitle: '製品やサービスに関する一般的な質問とその回答をまとめました。',
    imageUrl: 'https://via.placeholder.com/500x500?text=FAQ+Image', // サンプルの画像URL
    imageAlt: 'FAQイメージ',
    imagePosition: 'left',
    faqItems: [
      {
        id: 'q1',
        question: '最初の質問は何ですか？',
        answer: 'これは最初の質問に対する回答です。詳細な情報や関連リンクを含めることができます。',
      },
      {
        id: 'q2',
        question: 'コンポーネントのカスタマイズは可能ですか？',
        answer:
          'はい、多くのプロパティを通じてコンポーネントの外観や動作をカスタマイズできます。ドキュメントを参照してください。',
      },
      {
        id: 'q3',
        question: 'サポート体制について教えてください。',
        answer:
          'メールサポートとチャットサポートを提供しています。詳細はお問い合わせページをご覧ください。',
      },
      {
        id: 'q4',
        question: '返金ポリシーはありますか？',
        answer:
          '購入後30日以内であれば、特定の条件下で返金が可能です。詳細は利用規約をご確認ください。',
      },
    ],
    backgroundColor: '#ffffff',
    textColor: '#333333',
    questionTextColor: '#1a1a1a',
    answerTextColor: '#555555',
    accentColor: '#007bff', // Bootstrap primary blue
  },
};

export default meta;

type Story = StoryObj<typeof meta>;

export const Default: Story = {
  args: {
    // デフォルトのargsを使用
  },
};

export const ImageRight: Story = {
  args: {
    imagePosition: 'right',
    title: '画像が右側のFAQ',
    subtitle: '画像の配置を右側に変更したバリエーションです。',
    faqItems: [
      {
        id: 'q1_right',
        question: '右側画像のFAQでの質問1は？',
        answer: 'これは右側画像FAQの質問1に対する回答です。',
      },
      {
        id: 'q2_right',
        question: 'このレイアウトの利点は何ですか？',
        answer: 'コンテンツと画像のバランスを視覚的に調整するのに役立ちます。',
      },
    ],
  },
};

export const CustomTheme: Story = {
  args: {
    title: 'カスタムテーマFAQ',
    subtitle: '背景色、テキスト色、アクセント色をカスタマイズした例です。',
    backgroundColor: '#f0f4f8', // Light grayish blue
    textColor: '#2c3e50', // Dark blue/gray
    questionTextColor: '#2980b9', // Peter River blue
    answerTextColor: '#7f8c8d', // Asbestos gray
    accentColor: '#e74c3c', // Alizarin red
    imageUrl: 'https://via.placeholder.com/500x500/e74c3c/ffffff?text=Custom+Theme',
    imageAlt: 'カスタムテーマFAQイメージ',
  },
};

export const Minimal: Story = {
  args: {
    title: '最小構成のFAQ',
    subtitle: undefined, // サブタイトルなし
    imageUrl: 'https://via.placeholder.com/500x300?text=Minimal+FAQ',
    imageAlt: '最小構成FAQイメージ',
    faqItems: [
      {
        id: 'min_q1',
        question: '最小構成での質問は？',
        answer: 'はい、これが最小構成での回答です。',
      },
    ],
  },
};
