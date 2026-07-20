import type { ReactNode } from 'react';
import type { TFunction } from 'i18next';
import { useTranslation } from 'react-i18next';
import {
  IconBrandX,
  IconCoin,
  IconMessageCircle,
  IconStar,
  IconUserPlus,
} from '@tabler/icons-react';
import { Badge, Group, Progress, Text, Title } from '@mantine/core';
import type { XMarketingDashboard, XMarketingInteraction } from '@/types/xMarketing';
import classes from './XMarketing.module.css';

const reactionLabelKeys: Record<string, string> = {
  like: 'xMarketing.reactions.like',
  reply: 'xMarketing.reactions.reply',
  quote: 'xMarketing.reactions.quote',
  repost: 'xMarketing.reactions.repost',
  follow: 'xMarketing.reactions.follow',
};
export const reactionLabel = (type: string, t: TFunction) =>
  t(reactionLabelKeys[type] || 'xMarketing.reactions.other');
export const reactionIcon = (type: string) =>
  type === 'reply' ? (
    <IconMessageCircle size={22} />
  ) : type === 'follow' ? (
    <IconUserPlus size={22} />
  ) : type === 'quote' || type === 'repost' ? (
    <IconBrandX size={21} />
  ) : (
    <IconStar size={22} />
  );
export const scoreColor = (score: number) =>
  score >= 75 ? 'red' : score >= 50 ? 'orange' : 'gray';
export const avatarInitial = (name?: string | null) => [...(name || '')][0] || '';

export function MarketingHeader({
  title,
  description,
  dashboard,
  accountId,
  statusBadges,
}: {
  title: string;
  description: string;
  dashboard: XMarketingDashboard;
  accountId: string;
  statusBadges?: ReactNode;
}) {
  const { t, i18n } = useTranslation();
  const account = dashboard?.accounts?.find((v) => v.accountId === accountId);
  const estimatedUsd = dashboard?.globalCost?.estimatedUsd ?? 0;
  const limitUsd = dashboard?.globalCost?.limitUsd ?? 0;
  const percent = Math.min(
    100,
    limitUsd ? (estimatedUsd / limitUsd) * 100 : 0
  );
  return (
    <header className={classes.header}>
      <div>
        <Group gap="sm" align="center">
          <Title order={2}>{title}</Title>
          {statusBadges && <Group gap={6}>{statusBadges}</Group>}
        </Group>
        <Text c="dimmed" size="sm" mt={4}>
          {description}
        </Text>
      </div>
      <div className={classes.costs}>
        <div className={classes.globalCost}>
          <Group justify="space-between" mb={6}>
            <Text fw={700}>{t('xMarketing.cost.allAccountsTotal')}</Text>
            <IconCoin size={18} />
          </Group>
          <Text size="sm">
            {t('xMarketing.cost.monthlyEstimated')} <b>${estimatedUsd.toFixed(2)}</b> /{' '}
            {t('xMarketing.cost.limit')} ${limitUsd.toFixed(2)}
          </Text>
          <Progress value={percent} mt={9} size="sm" color={percent >= 80 ? 'orange' : 'green'} />
        </div>
        <div className={classes.accountCost}>
          <Text size="xs" c="dimmed">
            {t('xMarketing.cost.selectedAccount')}
          </Text>
          <Text fw={600} mt={6}>
            {accountId === 'all' ? t('xMarketing.allAccounts') : `@${accountId}`} $
            {accountId === 'all'
              ? estimatedUsd.toFixed(2)
              : (account?.estimatedCostUsd || 0).toFixed(2)}
          </Text>
          <Text size="xs" c="dimmed" mt={6}>
            {t('xMarketing.lastSync')} {formatLastSyncedAt(dashboard.lastSyncedAt, i18n.language, t)}
          </Text>
        </div>
      </div>
    </header>
  );
}

function formatLastSyncedAt(value: string, locale: string, t: TFunction) {
  if (!value) {
    return t('xMarketing.notSynced');
  }
  const date = new Date(value);
  if (Number.isNaN(date.getTime())) {
    return t('xMarketing.notSynced');
  }
  return date.toLocaleString(locale === 'ja' ? 'ja-JP' : 'en-US', {
    month: '2-digit',
    day: '2-digit',
    hour: '2-digit',
    minute: '2-digit',
  });
}

export function Score({ interaction }: { interaction: XMarketingInteraction }) {
  const { t } = useTranslation();
  return (
    <Group gap={6} wrap="nowrap">
      <Text fw={700} c={scoreColor(interaction.score)} size="lg">
        {interaction.score}
      </Text>
      <Badge color={scoreColor(interaction.score)} variant="light" size="sm">
        {interaction.score >= 75
          ? t('xMarketing.priority.highShort')
          : interaction.score >= 50
            ? t('xMarketing.priority.mediumShort')
            : t('xMarketing.priority.lowShort')}
      </Badge>
    </Group>
  );
}
