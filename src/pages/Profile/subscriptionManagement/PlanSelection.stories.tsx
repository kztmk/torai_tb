import { action } from '@storybook/addon-actions';
import type { Meta, StoryObj } from '@storybook/react';
import { Box } from '@mantine/core';
import planDataJSON from '@/data/subscriptionPlan.json';
import type { Plan } from '.';
import PlanSelection from './PlanSelection';

const plans = planDataJSON as Plan[];
const bankTransferPlans = plans.filter(
  (plan) => plan.payment_method === 'bank' && plan.display
);

const viewportParameters = {
  viewports: {
    iphone: {
      name: 'iPhone',
      styles: {
        width: '390px',
        height: '844px',
      },
    },
    ipad: {
      name: 'iPad',
      styles: {
        width: '820px',
        height: '1180px',
      },
    },
    desktop: {
      name: 'Desktop',
      styles: {
        width: '1280px',
        height: '900px',
      },
    },
  },
};

const meta: Meta<typeof PlanSelection> = {
  title: 'Pages/Profile/SubscriptionManagement/PlanSelection',
  component: PlanSelection,
  parameters: {
    layout: 'fullscreen',
    viewport: viewportParameters,
  },
  tags: ['autodocs'],
  args: {
    availablePlans: plans,
    currentUserSubscription: null,
    onSelectBankTransfer: action('onSelectBankTransfer'),
    onSelectStripe: action('onSelectStripe'),
    isBankTransferLoading: false,
    isStripeLoading: false,
    isFirstMonthDiscountAvailable: false,
  },
  decorators: [
    (Story) => (
      <Box maw={960} mx="auto" p="xl">
        <Story />
      </Box>
    ),
  ],
};

export default meta;
type Story = StoryObj<typeof meta>;

export const AllPlans: Story = {};

export const AllPlansWithDiscount: Story = {
  args: {
    isFirstMonthDiscountAvailable: true,
  },
};

export const BankTransferOnly: Story = {
  args: {
    availablePlans: bankTransferPlans,
  },
};

export const BankTransferOnlyWithDiscount: Story = {
  args: {
    availablePlans: bankTransferPlans,
    isFirstMonthDiscountAvailable: true,
  },
};

export const BankTransferOnlyIPhone: Story = {
  args: {
    availablePlans: bankTransferPlans,
  },
  parameters: {
    viewport: {
      ...viewportParameters,
      defaultViewport: 'iphone',
    },
  },
};

export const BankTransferOnlyIPad: Story = {
  args: {
    availablePlans: bankTransferPlans,
  },
  parameters: {
    viewport: {
      ...viewportParameters,
      defaultViewport: 'ipad',
    },
  },
};

export const BankTransferOnlyDesktop: Story = {
  args: {
    availablePlans: bankTransferPlans,
  },
  parameters: {
    viewport: {
      ...viewportParameters,
      defaultViewport: 'desktop',
    },
  },
};
