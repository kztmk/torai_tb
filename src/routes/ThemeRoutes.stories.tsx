import type { Meta, StoryObj } from '@storybook/react';
import ThemeRoutes from '@/routes';

const meta: Meta<typeof ThemeRoutes> = {
  title: 'Routes/ThemeRoutes',
  component: ThemeRoutes,
  decorators: [(Story) => <Story />],
};

export default meta;
type Story = StoryObj<typeof ThemeRoutes>;

export const Home: Story = {};
