import { appBaseUrlConfig } from './config';

type MailchimpTagStage =
  | 'registered'
  | 'agreed'
  | 'bankRequested'
  | 'bankPendingConfirmation'
  | 'subscribed'
  | 'subscribedBank'
  | 'cancelled';

const MAILCHIMP_TAGS: Record<MailchimpTagStage, string> = {
  registered: 'torai_regist',
  agreed: 'torai_agreed',
  bankRequested: 'torai_bank_requested',
  bankPendingConfirmation: 'torai_bank_pending_confirmation',
  subscribed: 'torai_subscribed',
  subscribedBank: 'torai_subscribed_bank',
  cancelled: 'torai_cancelled',
};

const isPreviewEnvironment = (): boolean => {
  const appBaseUrl = appBaseUrlConfig.value() || '';
  return appBaseUrl.includes('preview');
};

export const getMailchimpTag = (stage: MailchimpTagStage): string[] => {
  const tag = MAILCHIMP_TAGS[stage];
  return [isPreviewEnvironment() ? tag.replace('torai_', 'torai_preview_') : tag];
};
