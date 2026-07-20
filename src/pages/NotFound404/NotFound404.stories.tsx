import type { Meta, StoryObj } from '@storybook/react';
import NotFound404 from './';

const meta: Meta<typeof NotFound404> = {
  title: 'Pages/NotFound404',
  component: NotFound404,
};

export default meta;

type Story = StoryObj<typeof NotFound404>;

export const Default: Story = {};
