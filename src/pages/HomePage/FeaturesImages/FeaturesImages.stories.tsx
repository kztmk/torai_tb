import type { Meta, StoryObj } from '@storybook/react';
import { FeaturesImages } from './FeaturesImages';

const meta = {
  title: 'HomePage/FeaturesImages',
  component: FeaturesImages,
  parameters: {
    layout: 'centered',
  },
  tags: ['autodocs'],
} satisfies Meta<typeof FeaturesImages>;

export default meta;
type Story = StoryObj<typeof meta>;

export const Default: Story = {};
