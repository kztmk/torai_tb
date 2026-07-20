import React from 'react';
import type { Meta, StoryObj } from '@storybook/react';
import { MantineProvider } from '@mantine/core';
import PostGenerator from './index';

const meta: Meta<typeof PostGenerator> = {
  title: 'Pages/XPostsList/PostGenerator',
  component: PostGenerator,
};

export default meta;

type Story = StoryObj<typeof PostGenerator>;

export const Default: Story = {};
