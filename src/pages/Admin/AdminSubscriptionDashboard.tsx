import React, { useEffect, useMemo, useState } from 'react';
import { IconAlertTriangle, IconRefresh, IconSearch } from '@tabler/icons-react';
import {
  Alert,
  Badge,
  Button,
  Group,
  LoadingOverlay,
  Paper,
  SimpleGrid,
  Stack,
  Table,
  Text,
  TextInput,
  Title,
} from '@mantine/core';
import { useTranslation } from 'react-i18next';
import { useAppDispatch, useAppSelector } from '@/hooks/rtkhooks';
import {
  AdminSubscriptionAttention,
  AdminSubscriptionFunnelStage,
  AdminSubscriptionRow,
  AdminSubscriptionSource,
  fetchAdminSubscriptionDashboard,
} from '@/store/reducers/adminSubscriptionsSlice';

const sourceColor: Record<AdminSubscriptionSource, string> = {
  stripe: 'blue',
  bank: 'teal',
  mixed: 'orange',
  none: 'gray',
};

const attentionColor: Record<AdminSubscriptionAttention, string> = {
  ok: 'green',
  warning: 'yellow',
  danger: 'red',
};

const funnelLabel: Record<AdminSubscriptionFunnelStage, string> = {
  regist: 'regist',
  termaccepted: 'termaccepted',
  subscribed: 'subscribed',
};

const funnelColor: Record<AdminSubscriptionFunnelStage, string> = {
  regist: 'gray',
  termaccepted: 'violet',
  subscribed: 'green',
};

const formatDate = (value: string | null | undefined, locale: string) =>
  value ? new Date(value).toLocaleDateString(locale) : '-';

const formatDateTime = (value: string | null | undefined, locale: string) =>
  value ? new Date(value).toLocaleString(locale) : '-';

const valueOrDash = (value?: string | null) => value || '-';

const statusBadgeColor = (status?: string | null) => {
  if (status === 'active' || status === 'trialing') {
    return 'green';
  }
  if (status === 'past_due' || status === 'unpaid' || status === 'incomplete') {
    return 'yellow';
  }
  if (status === 'canceled' || status === 'expired') {
    return 'red';
  }
  return 'gray';
};

const Metric = ({ label, value, color = 'dark' }: { label: string; value: number; color?: string }) => (
  <Paper withBorder p="md" radius="sm">
    <Text size="xs" c="dimmed" fw={700}>
      {label}
    </Text>
    <Text size="xl" fw={800} c={color}>
      {value.toLocaleString()}
    </Text>
  </Paper>
);

const matchesFilter = (
  row: AdminSubscriptionRow,
  filter: string,
  query: string
) => {
  if (filter === 'attention' && row.attentionLevel === 'ok') {
    return false;
  }
  if (filter === 'stripe' && row.source !== 'stripe' && row.source !== 'mixed') {
    return false;
  }
  if (filter === 'bank' && row.source !== 'bank' && row.source !== 'mixed') {
    return false;
  }
  if (filter === 'inactive' && row.firestore.status !== 'inactive') {
    return false;
  }
  if (filter === 'preSubscription' && row.funnelStage === 'subscribed') {
    return false;
  }

  const normalizedQuery = query.trim().toLowerCase();
  if (!normalizedQuery) {
    return true;
  }
  return [
    row.uid,
    row.email,
    row.displayName,
    row.funnelStage,
    row.firestore.status,
    row.firestore.appPlanId,
    row.firestore.stripeCustomerId,
    row.firestore.stripeSubscriptionId,
    row.stripe.status,
    row.stripe.appPlanId,
    row.bank.status,
    row.bank.planName,
    ...row.mismatchReasons,
  ]
    .filter(Boolean)
    .join(' ')
    .toLowerCase()
    .includes(normalizedQuery);
};

const AdminSubscriptionDashboard: React.FC = () => {
  const { t, i18n } = useTranslation();
  const isJapanese = i18n.resolvedLanguage === 'ja';
  const locale = isJapanese ? 'ja-JP' : 'en-US';
  const dispatch = useAppDispatch();
  const { dashboard, loading, error } = useAppSelector((state) => state.adminSubscriptions);
  const [filter, setFilter] = useState('attention');
  const [query, setQuery] = useState('');
  const [serverQuery, setServerQuery] = useState('');
  const [pageTokens, setPageTokens] = useState<string[]>(['']);
  const currentPageToken = pageTokens[pageTokens.length - 1] || null;

  useEffect(() => {
    dispatch(
      fetchAdminSubscriptionDashboard({
        pageToken: currentPageToken,
        query: serverQuery || null,
      })
    );
  }, [currentPageToken, dispatch, serverQuery]);

  const refreshDashboard = () => {
    dispatch(
      fetchAdminSubscriptionDashboard({
        pageToken: currentPageToken,
        query: serverQuery || null,
      })
    );
  };

  const runServerSearch = () => {
    setPageTokens(['']);
    setServerQuery(query.trim());
  };

  const clearServerSearch = () => {
    setQuery('');
    setServerQuery('');
    setPageTokens(['']);
  };

  const filteredRows = useMemo(
    () => dashboard?.rows.filter((row) => matchesFilter(row, filter, query)) ?? [],
    [dashboard?.rows, filter, query]
  );

  const rows = filteredRows.map((row) => (
    <Table.Tr key={row.uid}>
      <Table.Td>
        <Stack gap={2}>
          <Text fw={700} size="sm">
            {row.displayName || row.email || row.uid}
          </Text>
          <Text size="xs" c="dimmed">
            {row.email || row.uid}
          </Text>
        </Stack>
      </Table.Td>
      <Table.Td>
        <Stack gap={4}>
          <Badge color={sourceColor[row.source]}>
            {t(`admin.subscriptions.sources.${row.source}`)}
          </Badge>
          <Badge color={funnelColor[row.funnelStage]} variant="light">
            {funnelLabel[row.funnelStage]}
          </Badge>
        </Stack>
      </Table.Td>
      {isJapanese && <Table.Td>
        <Stack gap={4}>
          <Badge color={statusBadgeColor(row.firestore.status)}>{row.firestore.status}</Badge>
          <Text size="xs">{valueOrDash(row.firestore.appPlanId)}</Text>
        </Stack>
      </Table.Td>}
      <Table.Td>
        <Stack gap={4}>
          <Badge color={statusBadgeColor(row.stripe.status)}>{valueOrDash(row.stripe.status)}</Badge>
          <Text size="xs">{valueOrDash(row.stripe.appPlanId || row.stripe.priceId)}</Text>
        </Stack>
      </Table.Td>
      <Table.Td>
        <Stack gap={4}>
          <Badge color={statusBadgeColor(row.bank.status)}>{valueOrDash(row.bank.status)}</Badge>
          <Text size="xs">{valueOrDash(row.bank.planName || row.bank.planId)}</Text>
        </Stack>
      </Table.Td>
      <Table.Td>
        <Stack gap={2}>
          <Text size="sm">{formatDate(row.periodEnd, locale)}</Text>
          {row.expiresSoon && <Badge color="orange">{t('admin.subscriptions.within14Days')}</Badge>}
          {row.stripe.cancelAtPeriodEnd && <Badge color="yellow">{t('admin.subscriptions.cancellationScheduled')}</Badge>}
        </Stack>
      </Table.Td>
      <Table.Td>
        <Stack gap={4}>
          <Badge color={attentionColor[row.attentionLevel]}>
            {row.attentionLevel === 'ok'
              ? 'OK'
              : row.attentionLevel === 'warning'
                ? t('admin.subscriptions.review')
                : t('admin.subscriptions.actionRequired')}
          </Badge>
          {row.mismatchReasons.length > 0 ? (
            row.mismatchReasons.map((reason) => (
              <Text key={reason} size="xs">
                {reason}
              </Text>
            ))
          ) : (
            <Text size="xs" c="dimmed">
              {t('admin.subscriptions.noDifference')}
            </Text>
          )}
        </Stack>
      </Table.Td>
    </Table.Tr>
  ));

  return (
    <Stack gap="md">
      <Group justify="space-between" align="flex-start">
        <div>
          <Title order={2}>{t('admin.subscriptions.title')}</Title>
          <Text size="sm" c="dimmed">
            {t('admin.subscriptions.description', {
              date: formatDateTime(dashboard?.generatedAt, locale),
            })}
          </Text>
        </div>
        <Button
          leftSection={<IconRefresh size="1rem" />}
          onClick={refreshDashboard}
          loading={loading === 'pending'}
        >
          {t('common.update')}
        </Button>
      </Group>

      {error && (
        <Alert color="red" icon={<IconAlertTriangle size="1rem" />}>
          {error}
        </Alert>
      )}

      {dashboard?.truncated && (
        <Alert color="yellow" icon={<IconAlertTriangle size="1rem" />}>
          {t('admin.subscriptions.moreUsers')}
        </Alert>
      )}

      <Text size="xs" c="dimmed">
        {t('admin.subscriptions.summaryScope')}
      </Text>

      <SimpleGrid cols={{ base: 2, sm: 3, lg: 6 }}>
        <Metric label={t('admin.subscriptions.visibleUsers')} value={dashboard?.summary.totalUsers ?? 0} />
        <Metric label={t('admin.subscriptions.regist')} value={dashboard?.summary.registCount ?? 0} color="gray" />
        <Metric label="termaccepted" value={dashboard?.summary.termacceptedCount ?? 0} color="violet" />
        <Metric label={t('admin.subscriptions.preSubscription')} value={dashboard?.summary.preSubscriptionCount ?? 0} color="orange" />
        <Metric label={t('admin.subscriptions.subscribed')} value={dashboard?.summary.subscribedCount ?? 0} color="green" />
        <Metric label={t('admin.subscriptions.termsAccepted')} value={dashboard?.summary.termsAcceptedCount ?? 0} color="blue" />
      </SimpleGrid>

      <SimpleGrid cols={{ base: 2, sm: 3, lg: 6 }}>
        <Metric label={t('admin.subscriptions.firestoreActive')} value={dashboard?.summary.firestoreActiveCount ?? 0} color="green" />
        <Metric label={t('admin.subscriptions.stripeActive')} value={dashboard?.summary.stripeActiveCount ?? 0} color="blue" />
        {isJapanese && <Metric label={t('subscription.bankTransfer')} value={dashboard?.summary.bankCount ?? 0} color="teal" />}
        <Metric label={t('admin.subscriptions.review')} value={dashboard?.summary.mismatchCount ?? 0} color="orange" />
        <Metric label={t('admin.subscriptions.expiring')} value={dashboard?.summary.expiringWithin14DaysCount ?? 0} color="red" />
      </SimpleGrid>

      <Paper withBorder p="md" radius="sm" pos="relative">
        <LoadingOverlay visible={loading === 'pending' && Boolean(dashboard)} />
        <Group justify="space-between" mb="md" align="flex-end">
          <TextInput
            leftSection={<IconSearch size="1rem" />}
            label={t('common.search')}
            placeholder={t('admin.subscriptions.searchPlaceholder')}
            value={query}
            onChange={(event) => setQuery(event.currentTarget.value)}
            onKeyDown={(event) => {
              if (event.key === 'Enter') {
                runServerSearch();
              }
            }}
            style={{ flex: 1, minWidth: 260 }}
          />
          <Group gap="xs">
            <Button size="xs" variant="filled" onClick={runServerSearch}>
              {t('common.search')}
            </Button>
            {serverQuery && (
              <Button size="xs" variant="light" onClick={clearServerSearch}>
                {t('admin.subscriptions.clear')}
              </Button>
            )}
            {[
              ['attention', t('admin.subscriptions.review')],
              ['all', t('common.all')],
              ['preSubscription', t('admin.subscriptions.preSubscriptionShort')],
              ['stripe', 'Stripe'],
              ...(isJapanese ? [['bank', t('subscription.bankTransfer')]] : []),
              ['inactive', t('admin.subscriptions.inactive')],
            ].map(([value, label]) => (
              <Button
                key={value}
                size="xs"
                variant={filter === value ? 'filled' : 'light'}
                onClick={() => setFilter(value)}
              >
                {label}
              </Button>
            ))}
          </Group>
        </Group>

        {loading === 'pending' && !dashboard ? (
          <Text>{t('common.loading')}</Text>
        ) : filteredRows.length === 0 ? (
          <Text c="dimmed">{t('admin.subscriptions.noSubscriptions')}</Text>
        ) : (
          <Table.ScrollContainer minWidth={1100}>
            <Table striped highlightOnHover withTableBorder withColumnBorders>
              <Table.Thead>
                <Table.Tr>
                  <Table.Th>{t('admin.subscriptions.user')}</Table.Th>
                  <Table.Th>{t('admin.subscriptions.source')}</Table.Th>
                  <Table.Th>Firestore</Table.Th>
                  <Table.Th>Stripe</Table.Th>
                  {isJapanese && <Table.Th>{t('subscription.bankTransfer')}</Table.Th>}
                  <Table.Th>{t('admin.subscriptions.periodEnd')}</Table.Th>
                  <Table.Th>{t('admin.subscriptions.attention')}</Table.Th>
                </Table.Tr>
              </Table.Thead>
              <Table.Tbody>{rows}</Table.Tbody>
            </Table>
          </Table.ScrollContainer>
        )}
        <Group justify="space-between" mt="md">
          <Text size="xs" c="dimmed">
            {serverQuery
              ? t('admin.subscriptions.serverSearch', { query: serverQuery })
              : t('admin.subscriptions.page', {
                  page: pageTokens.length,
                  count: dashboard?.userLimit ?? 0,
                })}
          </Text>
          <Group gap="xs">
            <Button
              size="xs"
              variant="light"
              disabled={pageTokens.length <= 1 || loading === 'pending'}
              onClick={() => setPageTokens((tokens) => tokens.slice(0, -1))}
            >
              {t('common.back')}
            </Button>
            <Button
              size="xs"
              variant="light"
              disabled={!dashboard?.nextPageToken || Boolean(serverQuery) || loading === 'pending'}
              onClick={() => {
                if (dashboard?.nextPageToken) {
                  setPageTokens((tokens) => [...tokens, dashboard.nextPageToken || '']);
                }
              }}
            >
              {t('common.next')}
            </Button>
          </Group>
        </Group>
      </Paper>
    </Stack>
  );
};

export default AdminSubscriptionDashboard;
