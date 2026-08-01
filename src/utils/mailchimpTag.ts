type MailchimpTagStage =
  | 'registered'
  | 'agreed'
  | 'bankRequested'
  | 'bankPendingConfirmation'
  | 'subscribed'
  | 'subscribedBank'
  | 'cancelled';

const MAILCHIMP_TAGS: Record<MailchimpTagStage, string> = {
  registered: 'tbtorai_regist',
  agreed: 'tbtorai_agreed',
  bankRequested: 'tbtorai_bank_requested',
  bankPendingConfirmation: 'tbtorai_bank_pending_confirmation',
  subscribed: 'tbtorai_subscribed',
  subscribedBank: 'tbtorai_subscribed_bank',
  cancelled: 'tbtorai_cancelled',
};

const isPreviewMode = () => import.meta.env.VITE_APP_MODE === 'preview';

export const getMailchimpTag = (stage: MailchimpTagStage): string[] => {
  const tag = MAILCHIMP_TAGS[stage];
  return [isPreviewMode() ? tag.replace('tbtorai_', 'tbtorai_preview_') : tag];
};
