/**
 * ダッシュボード概要（Phase 9・旧 X 用 Activity を置換）。
 * Bluesky/Threads のアカウント数・投稿状況の概要と、アプリ全体のエラー一覧を表示する。
 */
import { useEffect } from 'react';
import { useTranslation } from 'react-i18next';
import { Link } from 'react-router-dom';
import {
  IconAlertCircle,
  IconAlertTriangle,
  IconBrandBluesky,
  IconBrandThreads,
  IconChecks,
  IconClipboardList,
} from '@tabler/icons-react';
import { Alert, Button, Card, Group, SimpleGrid, Stack, Text, Title } from '@mantine/core';
import { useAppDispatch, useAppSelector } from '@/hooks/rtkhooks';
import { fetchAccounts, selectAccounts } from '@/store/reducers/accountsSlice';
import { fetchPostLists, selectPosts } from '@/store/reducers/postsSlice';
import ErrorsList from '@/pages/Posts/ErrorsList';

const StatCard = ({
  icon,
  label,
  value,
}: {
  icon: React.ReactNode;
  label: string;
  value: number;
}) => (
  <Card withBorder radius="md" padding="md">
    <Group gap="sm">
      {icon}
      <div>
        <Text size="xl" fw={700}>
          {value}
        </Text>
        <Text size="xs" c="dimmed">
          {label}
        </Text>
      </div>
    </Group>
  </Card>
);

const Activity = () => {
  const { t } = useTranslation();
  const dispatch = useAppDispatch();
  const user = useAppSelector((state) => state.auth.user);
  const { bluesky, threads } = useAppSelector(selectAccounts);
  const { queued, posted, errors } = useAppSelector(selectPosts);

  const isConnected = Boolean(user.gasProxyInitializedAt);

  useEffect(() => {
    if (isConnected) {
      dispatch(fetchAccounts());
      dispatch(fetchPostLists());
    }
  }, [dispatch, isConnected]);

  if (!isConnected) {
    return (
      <Stack p="md" gap="md">
        <Title order={2}>{t('navigation.activity')}</Title>
        <Alert color="yellow" icon={<IconAlertCircle />} title={t('accounts.notConnectedTitle')}>
          {t('accounts.notConnectedMessage')}
        </Alert>
        <Group>
          <Button component={Link} to="/profile">
            {t('navigation.profile')}
          </Button>
        </Group>
      </Stack>
    );
  }

  return (
    <Stack p="md" gap="lg">
      <Title order={2}>{t('navigation.activity')}</Title>

      <SimpleGrid cols={{ base: 2, sm: 3, md: 5 }}>
        <StatCard
          icon={<IconBrandBluesky size={28} color="var(--mantine-color-blue-6)" />}
          label={t('activity.overview.blueskyAccounts')}
          value={bluesky.length}
        />
        <StatCard
          icon={<IconBrandThreads size={28} color="var(--mantine-color-grape-6)" />}
          label={t('activity.overview.threadsAccounts')}
          value={threads.length}
        />
        <StatCard
          icon={<IconClipboardList size={28} />}
          label={t('activity.overview.queued')}
          value={queued.length}
        />
        <StatCard
          icon={<IconChecks size={28} color="var(--mantine-color-green-6)" />}
          label={t('activity.overview.posted')}
          value={posted.length}
        />
        <StatCard
          icon={<IconAlertTriangle size={28} color="var(--mantine-color-red-6)" />}
          label={t('activity.overview.errors')}
          value={errors.length}
        />
      </SimpleGrid>

      <Group>
        <Button component={Link} to="/dashboard/accounts">
          {t('navigation.accounts')}
        </Button>
      </Group>

      <div>
        <Title order={3} mb="sm">
          {t('errors.title')}
        </Title>
        <ErrorsList errors={errors} />
      </div>
    </Stack>
  );
};

export default Activity;
