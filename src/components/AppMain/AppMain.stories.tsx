import type { Meta, StoryObj } from '@storybook/react';
import AppMain from './';

const meta: Meta = {
    title: 'Components/AppMain',
    component: AppMain,
    tags: ['autodocs'],
};

export default meta;
type Story = StoryObj<typeof AppMain>;

export const Primary: Story = {
    args: {},
};