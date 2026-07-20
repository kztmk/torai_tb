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

const isPreviewMode = () => import.meta.env.VITE_APP_MODE === 'preview';

export const getMailchimpTag = (stage: MailchimpTagStage): string[] => {
  const tag = MAILCHIMP_TAGS[stage];
  return [isPreviewMode() ? tag.replace('torai_', 'torai_preview_') : tag];
};
