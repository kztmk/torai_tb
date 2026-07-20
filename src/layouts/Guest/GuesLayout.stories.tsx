import type { Meta, StoryObj } from '@storybook/react';
import GuestLayout from '@/layouts/Guest';

const meta: Meta<typeof GuestLayout> = {
  title: 'Layouts/GuestLayout',
  component: GuestLayout,
};

export default meta;
type Story = StoryObj<typeof GuestLayout>;

export const Default: Story = {};
