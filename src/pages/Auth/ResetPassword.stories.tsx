import type { Meta, StoryObj } from '@storybook/react';
import ResetPassword from './ResetPassword';

const meta: Meta<typeof ResetPassword> = {
  title: 'Pages/Auth/ResetPassword',
  component: ResetPassword,
  parameters: {
    layout: 'fullscreen',
  },
  tags: ['autodocs'],
};

export default meta;
type Story = StoryObj<typeof ResetPassword>;

export const Default: Story = {};
