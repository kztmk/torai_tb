import React, { useEffect } from 'react';
import { IconCheck, IconCopy, IconFlag, IconGift, IconRefresh } from '@tabler/icons-react';
import {
  Alert,
  Badge,
  Box,
  Button,
  Group,
  Paper,
  Progress,
  SimpleGrid,
  Stack,
  Table,
  Text,
  TextInput,
  ThemeIcon,
  Title,
} from '@mantine/core';
import { notifications } from '@mantine/notifications';
import { useTranslation } from 'react-i18next';
import { useAppDispatch, useAppSelector } from '@/hooks/rtkhooks';
import { fetchReferralDashboard } from '@/store/reducers/referralsSlice';

const formatAmount = (value: number | null | undefined, locale: string) =>
  new Intl.NumberFormat(locale, { style: 'currency', currency: 'JPY', maximumFractionDigits: 0 }).format(value ?? 0);

const formatDate = (value: string | null | undefined, locale: string) =>
  value ? new Date(value).toLocaleDateString(locale) : '-';

const referralMilestoneThresholds = [1, 5, 10, 30, 50, 100] as const;

const getMilestoneProgress = (
  subscribedCount: number,
  referralMilestones: { threshold: number; reward: string; detail: string }[]
) => {
  const nextMilestone = referralMilestones.find(
    (milestone) => milestone.threshold > subscribedCount
  );

  if (!nextMilestone) {
    return {
      nextMilestone: referralMilestones[referralMilestones.length - 1],
      remainingCount: 0,
      progressValue: 100,
      previousThreshold: referralMilestones[referralMilestones.length - 2].threshold,
    };
  }

  const previousMilestone = [...referralMilestones]
    .reverse()
    .find((milestone) => milestone.threshold <= subscribedCount);
  const previousThreshold = previousMilestone?.threshold ?? 0;
  const progressRange = nextMilestone.threshold - previousThreshold;
  const progressValue =
    progressRange > 0
      ? Math.min(100, Math.max(0, ((subscribedCount - previousThreshold) / progressRange) * 100))
      : 0;

  return {
    nextMilestone,
    remainingCount: nextMilestone.threshold - subscribedCount,
    progressValue,
    previousThreshold,
  };
};

const Metric = ({
  label,
  value,
  suffix = '',
}: {
  label: string;
  value: number;
  suffix?: string;
}) => (
  <Paper withBorder p="md" radius="sm">
    <Text size="xs" c="dimmed" fw={700}>
      {label}
    </Text>
    <Text size="xl" fw={800}>
      {value.toLocaleString()}
      {suffix}
    </Text>
  </Paper>
);

const ReferralProgram: React.FC = () => {
  const { t, i18n } = useTranslation();
  const locale = i18n.resolvedLanguage === 'ja' ? 'ja-JP' : 'en-US';
  const referralMilestones = referralMilestoneThresholds.map((threshold, index) => ({
    threshold,
    reward: t(`profile.referral.milestones.${index}.reward`),
    detail: t('profile.referral.peopleReferred', { count: threshold }),
  }));
  const dispatch = useAppDispatch();
  const { dashboard, loading, error } = useAppSelector((state) => state.referrals);
  const subscribedCount = dashboard?.summary.subscribedCount ?? 0;
  const { nextMilestone, remainingCount, progressValue, previousThreshold } =
    getMilestoneProgress(subscribedCount, referralMilestones);
  const allMilestonesCompleted = remainingCount === 0 && subscribedCount >= nextMilestone.threshold;

  useEffect(() => {
    dispatch(fetchReferralDashboard());
  }, [dispatch]);

  const copyReferralUrl = async () => {
    if (!dashboard?.referralUrl) {
      return;
    }
    if (!navigator.clipboard) {
      notifications.show({
        color: 'red',
        title: t('profile.referral.copyFailed'),
        message: t('profile.referral.clipboardUnsupported'),
      });
      return;
    }
    try {
      await navigator.clipboard.writeText(dashboard.referralUrl);
      notifications.show({
        color: 'green',
        title: t('profile.referral.copied'),
        message: t('profile.referral.copiedMessage'),
      });
    } catch (error) {
      console.error('Failed to copy referral URL:', error);
      notifications.show({
        color: 'red',
        title: t('profile.referral.copyFailed'),
        message: t('profile.referral.copyFailedMessage'),
      });
    }
  };

  return (
    <Stack gap="md">
      <Group justify="space-between" align="flex-start">
        <div>
          <Title order={2}>{t('profile.tabs.referral')}</Title>
          <Text size="sm" c="dimmed">
            {t('profile.referral.description')}
          </Text>
        </div>
        <Button
          variant="light"
          leftSection={<IconRefresh size="1rem" />}
          loading={loading === 'pending'}
          onClick={() => dispatch(fetchReferralDashboard())}
        >
          {t('common.update')}
        </Button>
      </Group>

      {error && <Alert color="red">{error}</Alert>}

      <Paper withBorder p="md" radius="sm">
        <Stack>
          <TextInput label={t('profile.referral.code')} value={dashboard?.referralCode ?? ''} readOnly />
          <Group align="flex-end">
            <TextInput
              label={t('profile.referral.link')}
              value={dashboard?.referralUrl ?? ''}
              readOnly
              style={{ flex: 1 }}
            />
            <Button leftSection={<IconCopy size="1rem" />} onClick={copyReferralUrl}>
              {t('profile.basic.unlock.copy')}
            </Button>
          </Group>
        </Stack>
      </Paper>

      <Paper withBorder p="md" radius="sm">
        <Stack gap="md">
          <Group justify="space-between" align="flex-start" gap="md">
            <div>
              <Group gap="xs">
                <ThemeIcon color="blue" variant="light" radius="xl" size="lg">
                  <IconFlag size="1rem" />
                </ThemeIcon>
                <Text fw={800}>{allMilestonesCompleted ? t('profile.referral.finalAchieved') : t('profile.referral.nextReward')}</Text>
              </Group>
              <Text size="sm" c="dimmed" mt={4}>
                {allMilestonesCompleted
                  ? t('profile.referral.noMoreRewards')
                  : t('profile.referral.untilReward', { reward: nextMilestone.reward, count: remainingCount })}
              </Text>
            </div>
            <Badge color={allMilestonesCompleted ? 'green' : 'blue'} size="lg" radius="sm">
              {allMilestonesCompleted
                ? t('profile.referral.peopleReferred', { count: subscribedCount })
                : t('profile.referral.progressPeople', { current: subscribedCount, total: nextMilestone.threshold })}
            </Badge>
          </Group>

          <Progress
            value={progressValue}
            size="lg"
            radius="xl"
            color={allMilestonesCompleted ? 'green' : 'blue'}
          />

          <Group justify="space-between" gap="xs">
            <Text size="xs" c="dimmed">
              {t('profile.referral.people', { count: previousThreshold })}
            </Text>
            <Text size="xs" c="dimmed">
              {t('profile.referral.people', { count: nextMilestone.threshold })}
            </Text>
          </Group>

          <SimpleGrid cols={{ base: 2, sm: 3, md: 6 }} spacing="xs">
            {referralMilestones.map((milestone) => {
              const achieved = subscribedCount >= milestone.threshold;
              const isNext = !achieved && milestone.threshold === nextMilestone.threshold;

              return (
                <Box
                  key={milestone.threshold}
                  p="sm"
                  style={{
                    minHeight: 112,
                    border: `1px solid ${
                      achieved
                        ? 'var(--mantine-color-green-4)'
                        : isNext
                          ? 'var(--mantine-color-blue-4)'
                          : 'var(--mantine-color-gray-3)'
                    }`,
                    borderRadius: 8,
                    background: achieved
                      ? 'var(--mantine-color-green-0)'
                      : isNext
                        ? 'var(--mantine-color-blue-0)'
                        : 'var(--mantine-color-gray-0)',
                  }}
                >
                  <Stack gap={6} align="center">
                    <ThemeIcon
                      color={achieved ? 'green' : isNext ? 'blue' : 'gray'}
                      variant={achieved || isNext ? 'filled' : 'light'}
                      radius="xl"
                    >
                      {achieved ? <IconCheck size="1rem" /> : <IconGift size="1rem" />}
                    </ThemeIcon>
                    <Text size="xs" fw={800} ta="center">
                      {milestone.detail}
                    </Text>
                    <Text
                      size="xs"
                      c={achieved ? 'green.8' : isNext ? 'blue.8' : 'dimmed'}
                      ta="center"
                    >
                      {milestone.reward}
                    </Text>
                    <Badge
                      size="xs"
                      color={achieved ? 'green' : isNext ? 'blue' : 'gray'}
                      variant={achieved || isNext ? 'light' : 'outline'}
                    >
                      {achieved ? t('profile.referral.achieved') : isNext ? t('profile.referral.nextGoal') : t('profile.referral.notAchieved')}
                    </Badge>
                  </Stack>
                </Box>
              );
            })}
          </SimpleGrid>
        </Stack>
      </Paper>

      <SimpleGrid cols={{ base: 2, md: 4 }}>
        <Metric label={t('profile.referral.registered')} value={dashboard?.summary.registeredCount ?? 0} />
        <Metric label={t('profile.referral.termsAccepted')} value={dashboard?.summary.termsAcceptedCount ?? 0} />
        <Metric label={t('profile.referral.subscriptionStarted')} value={dashboard?.summary.subscribedCount ?? 0} />
        <Metric label={t('profile.referral.earnedMonths')} value={dashboard?.summary.earnedMonths ?? 0} suffix={t('profile.referral.monthSuffix')} />
      </SimpleGrid>

      <SimpleGrid cols={{ base: 2, md: 4 }}>
        <Metric label={t('profile.referral.earnedReward')} value={dashboard?.summary.earnedAmount ?? 0} suffix={t('profile.referral.yenSuffix')} />
        <Metric label={t('profile.referral.granted')} value={dashboard?.summary.grantedAmount ?? 0} suffix={t('profile.referral.yenSuffix')} />
        <Metric label={t('profile.referral.pending')} value={dashboard?.summary.pendingGrantAmount ?? 0} suffix={t('profile.referral.yenSuffix')} />
        <Metric label={t('profile.referral.consumed')} value={dashboard?.summary.consumedAmount ?? 0} suffix={t('profile.referral.yenSuffix')} />
      </SimpleGrid>

      <Paper withBorder p="md" radius="sm">
        <Group justify="space-between">
          <div>
            <Text fw={700}>{t('profile.referral.available')}</Text>
            <Text size="sm" c="dimmed">
              {t('profile.referral.availableDescription')}
            </Text>
          </div>
          <Text size="xl" fw={800}>
            {formatAmount(dashboard?.summary.availableAmount, locale)}
          </Text>
        </Group>
        {dashboard?.summary.lifetimeDiscountPercent && (
          <Badge color="green" mt="md">
            {dashboard.summary.lifetimeDiscountPercent >= 100
              ? t('profile.referral.freeForever')
              : t('profile.referral.lifetimeDiscount', { percent: dashboard.summary.lifetimeDiscountPercent })}
          </Badge>
        )}
      </Paper>

      <Paper withBorder p="md" radius="sm">
        <Title order={3} mb="md">
          {t('profile.referral.rewardHistory')}
        </Title>
        {!dashboard || dashboard.rewards.length === 0 ? (
          <Text c="dimmed">{t('profile.referral.noRewards')}</Text>
        ) : (
          <Table.ScrollContainer minWidth={760}>
            <Table striped highlightOnHover>
              <Table.Thead>
                <Table.Tr>
                  <Table.Th>{t('profile.referral.reward')}</Table.Th>
                  <Table.Th>{t('profile.referral.status')}</Table.Th>
                  <Table.Th>{t('profile.referral.earned')}</Table.Th>
                  <Table.Th>{t('profile.referral.granted')}</Table.Th>
                  <Table.Th>{t('profile.referral.pending')}</Table.Th>
                  <Table.Th>{t('profile.referral.earnedAt')}</Table.Th>
                </Table.Tr>
              </Table.Thead>
              <Table.Tbody>
                {dashboard.rewards.map((reward) => (
                  <Table.Tr key={reward.id}>
                    <Table.Td>{reward.label}</Table.Td>
                    <Table.Td>
                      <Badge color={reward.status === 'granted' ? 'green' : 'yellow'}>
                        {reward.status}
                      </Badge>
                    </Table.Td>
                    <Table.Td>{formatAmount(reward.rewardAmount, locale)}</Table.Td>
                    <Table.Td>{formatAmount(reward.grantedAmount, locale)}</Table.Td>
                    <Table.Td>{formatAmount(reward.remainingAmount, locale)}</Table.Td>
                    <Table.Td>{formatDate(reward.earnedAt, locale)}</Table.Td>
                  </Table.Tr>
                ))}
              </Table.Tbody>
            </Table>
          </Table.ScrollContainer>
        )}
      </Paper>

      <Paper withBorder p="md" radius="sm">
        <Title order={3} mb="md">
          {t('profile.referral.referralHistory')}
        </Title>
        {!dashboard || dashboard.referredUsers.length === 0 ? (
          <Text c="dimmed">{t('profile.referral.noReferrals')}</Text>
        ) : (
          <Table.ScrollContainer minWidth={760}>
            <Table striped highlightOnHover>
              <Table.Thead>
                <Table.Tr>
                  <Table.Th>{t('profile.referral.referral')}</Table.Th>
                  <Table.Th>{t('profile.referral.registration')}</Table.Th>
                  <Table.Th>{t('profile.referral.termsAcceptedShort')}</Table.Th>
                  <Table.Th>{t('profile.referral.subscriptionStarted')}</Table.Th>
                  <Table.Th>{t('profile.referral.status')}</Table.Th>
                </Table.Tr>
              </Table.Thead>
              <Table.Tbody>
                {dashboard.referredUsers.map((user, index) => (
                  <Table.Tr key={user.uid}>
                    <Table.Td>{index + 1}</Table.Td>
                    <Table.Td>{formatDate(user.registeredAt, locale)}</Table.Td>
                    <Table.Td>
                      <Badge color={user.termsAccepted ? 'green' : 'gray'}>
                        {user.termsAccepted ? t('common.success') : t('profile.referral.incomplete')}
                      </Badge>
                    </Table.Td>
                    <Table.Td>
                      <Badge color={user.subscriptionQualified ? 'green' : 'gray'}>
                        {user.subscriptionQualified ? t('common.success') : t('profile.referral.incomplete')}
                      </Badge>
                    </Table.Td>
                    <Table.Td>{user.subscriptionStatus}</Table.Td>
                  </Table.Tr>
                ))}
              </Table.Tbody>
            </Table>
          </Table.ScrollContainer>
        )}
      </Paper>
    </Stack>
  );
};

export default ReferralProgram;
