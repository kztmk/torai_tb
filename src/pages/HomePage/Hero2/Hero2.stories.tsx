import React from 'react';
import type { Meta, StoryFn } from '@storybook/react';
import { Hero2 } from './index';

const meta: Meta = {
  title: 'Components/Hero2',
  component: Hero2,
  argTypes: {
    // プロップをコントロールしたい場合はここに記述
    // 例: title: { control: 'text' },
  },
};

export default meta;

const Template: StoryFn = () => <Hero2 />;

export const Default = Template.bind({});
Default.args = {
  // デフォルトの props をここに設定
  // title: 'Welcome to Hero2',
  // subtitle: 'This is a subtitle',
};
