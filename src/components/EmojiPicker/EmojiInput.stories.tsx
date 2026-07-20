import type { Meta, StoryObj } from '@storybook/react';
import { EmojiInput } from './EmojiInput';

const meta = {
  title: 'Components/EmojiPicker',
  component: EmojiInput,
  parameters: {
    layout: 'centered',
  },
  tags: ['autodocs'],
  argTypes: {
    // 必要に応じてargTypesを追加
  },
} satisfies Meta<typeof EmojiInput>;

export default meta;
type Story = StoryObj<typeof meta>;

// 基本的な使用例
export const Default: Story = {};

// カスタムスタイリングを適用した例
export const WithCustomStyle: Story = {
  decorators: [
    (Story) => (
      <div
        style={{ width: '400px', padding: '20px', border: '1px solid #eee', borderRadius: '8px' }}
      >
        <Story />
      </div>
    ),
  ],
};

// モバイルビューの例
export const MobileView: Story = {
  decorators: [
    (Story) => (
      <div style={{ width: '300px', padding: '10px' }}>
        <Story />
      </div>
    ),
  ],
};
