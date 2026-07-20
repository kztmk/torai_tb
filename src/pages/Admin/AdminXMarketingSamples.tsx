import { useState } from 'react';
import {
  IconBrandX,
  IconChartLine,
  IconDatabaseImport,
  IconInbox,
  IconTrash,
  IconUsers,
} from '@tabler/icons-react';
import { Link } from 'react-router-dom';
import {
  Alert,
  Badge,
  Button,
  Group,
  List,
  Paper,
  SimpleGrid,
  Stack,
  Text,
  Title,
} from '@mantine/core';
import { modals } from '@mantine/modals';
import { notifications } from '@mantine/notifications';
import type { TFunction } from 'i18next';
import { useTranslation } from 'react-i18next';
import { gasProxyPost, getGasResponseErrorMessage } from '@/utils/gasProxyClient';

type SampleCounts = {
  interactions: number;
  posts: number;
  daily: number;
  runs: number;
};

type SampleResult = {
  kind: 'import' | 'delete';
  accountIds?: string[];
  counts: SampleCounts;
};

const asRecord = (value: unknown): Record<string, any> =>
  value && typeof value === 'object' && !Array.isArray(value) ? (value as Record<string, any>) : {};

const asCount = (value: unknown) => {
  const number = Number(value);
  return Number.isFinite(number) ? Math.max(0, Math.floor(number)) : 0;
};

const normalizeCounts = (value: unknown): SampleCounts => {
  const counts = asRecord(value);
  return {
    interactions: asCount(counts.interactions),
    posts: asCount(counts.posts),
    daily: asCount(counts.daily),
    runs: asCount(counts.runs),
  };
};

const getSampleErrorMessage = (error: any, fallback: string, t: TFunction) => {
  const message =
    getGasResponseErrorMessage(error?.response?.data, fallback) ||
    error?.response?.data?.message ||
    error?.message ||
    fallback;
  return String(message).includes('X_MARKETING_SAMPLE_REQUIRES_X_ACCOUNT')
    ? t('admin.samples.xAccountRequired')
    : String(message);
};

export default function AdminXMarketingSamples() {
  const { t } = useTranslation();
  const [loadingAction, setLoadingAction] = useState<'import' | 'delete' | null>(null);
  const [result, setResult] = useState<SampleResult | null>(null);

  const importSamples = async () => {
    setLoadingAction('import');
    try {
      const response = await gasProxyPost({}, { target: 'xMarketing', action: 'importSampleData' });
      const responseError = getGasResponseErrorMessage(
        response.data,
        t('admin.samples.importFailedMessage')
      );
      if (responseError) {
        throw new Error(responseError);
      }
      const data = asRecord(response.data?.data);
      const counts = normalizeCounts(data.counts);
      setResult({
        kind: 'import',
        accountIds: Array.isArray(data.accountIds) ? data.accountIds.map(String) : [],
        counts,
      });
      notifications.show({
        color: 'green',
        title: t('admin.samples.imported'),
        message: t('admin.samples.importedCounts', counts),
      });
    } catch (error) {
      notifications.show({
        color: 'red',
        title: t('admin.samples.importFailed'),
        message: getSampleErrorMessage(error, t('admin.samples.importFailedMessage'), t),
      });
    } finally {
      setLoadingAction(null);
    }
  };

  const deleteSamples = async () => {
    setLoadingAction('delete');
    try {
      const response = await gasProxyPost({}, { target: 'xMarketing', action: 'deleteSampleData' });
      const responseError = getGasResponseErrorMessage(
        response.data,
        t('admin.samples.deleteFailedMessage')
      );
      if (responseError) {
        throw new Error(responseError);
      }
      const data = asRecord(response.data?.data);
      const counts = normalizeCounts(data.removed);
      setResult({ kind: 'delete', counts });
      notifications.show({
        color: 'green',
        title: t('admin.samples.deleted'),
        message: t('admin.samples.deletedCounts', counts),
      });
    } catch (error) {
      notifications.show({
        color: 'red',
        title: t('admin.samples.deleteFailed'),
        message: getSampleErrorMessage(error, t('admin.samples.deleteFailedMessage'), t),
      });
    } finally {
      setLoadingAction(null);
    }
  };

  const confirmImport = () => {
    modals.openConfirmModal({
      title: t('admin.samples.confirmImportTitle'),
      children: (
        <Text size="sm">
          {t('admin.samples.confirmImportMessage')}
        </Text>
      ),
      labels: { confirm: t('admin.samples.import'), cancel: t('common.cancel') },
      confirmProps: { leftSection: <IconDatabaseImport size={16} /> },
      onConfirm: importSamples,
    });
  };

  const confirmDelete = () => {
    modals.openConfirmModal({
      title: t('admin.samples.confirmDeleteTitle'),
      children: (
        <Text size="sm">
          {t('admin.samples.confirmDeleteMessage')}
        </Text>
      ),
      labels: { confirm: t('admin.samples.deleteOnlySamples'), cancel: t('common.cancel') },
      confirmProps: { color: 'red', leftSection: <IconTrash size={16} /> },
      onConfirm: deleteSamples,
    });
  };

  return (
    <Paper p="lg" shadow="xs">
      <Stack gap="lg">
        <div>
          <Group gap="xs">
            <IconDatabaseImport size={28} />
            <Title order={2}>{t('admin.samples.title')}</Title>
          </Group>
          <Text c="dimmed" mt={6}>
            {t('admin.samples.description')}
          </Text>
        </div>

        <Alert color="blue" title={t('admin.samples.requirements')}>
          <List size="sm" spacing={6}>
            <List.Item>
              {t('admin.samples.requirementOwner')}
            </List.Item>
            <List.Item>
              {t('admin.samples.requirementIntegration')}
            </List.Item>
            <List.Item>
              {t('admin.samples.requirementSafe')}
            </List.Item>
            <List.Item>
              {t('admin.samples.requirementCost')}
            </List.Item>
            <List.Item>
              {t('admin.samples.requirementAvatar')}
            </List.Item>
          </List>
        </Alert>

        <Group>
          <Button
            leftSection={<IconDatabaseImport size={18} />}
            loading={loadingAction === 'import'}
            disabled={loadingAction !== null}
            onClick={confirmImport}
          >
            {t('admin.samples.import')}
          </Button>
          <Button
            color="red"
            variant="outline"
            leftSection={<IconTrash size={18} />}
            loading={loadingAction === 'delete'}
            disabled={loadingAction !== null}
            onClick={confirmDelete}
          >
            {t('admin.samples.delete')}
          </Button>
        </Group>

        {result && (
          <Alert
            color={result.kind === 'import' ? 'green' : 'gray'}
            title={
              result.kind === 'import'
                ? t('admin.samples.importResult')
                : t('admin.samples.deleteResult')
            }
          >
            <Group gap="xs">
              <Badge variant="light">{t('admin.samples.interactionsCount', { count: result.counts.interactions })}</Badge>
              <Badge variant="light">{t('admin.samples.postsCount', { count: result.counts.posts })}</Badge>
              <Badge variant="light">{t('admin.samples.dailyCount', { count: result.counts.daily })}</Badge>
              <Badge variant="light">{t('admin.samples.runsCount', { count: result.counts.runs })}</Badge>
            </Group>
            {result.accountIds && result.accountIds.length > 0 && (
              <Text size="sm" mt="xs">
                {t('admin.samples.targetAccounts')}:{' '}
                {result.accountIds.map((accountId) => `@${accountId}`).join(', ')}
              </Text>
            )}
          </Alert>
        )}

        <div>
          <Title order={3} mb="sm">
            {t('admin.samples.screensToCapture')}
          </Title>
          <Text size="sm" c="dimmed" mb="md">
            {t('admin.samples.captureInstructions')}
          </Text>
          <SimpleGrid cols={{ base: 1, sm: 3 }}>
            <Button
              component={Link}
              to="/dashboard/x-marketing/inbox"
              variant="light"
              leftSection={<IconInbox size={18} />}
            >
              {t('navigation.inbox')}
            </Button>
            <Button
              component={Link}
              to="/dashboard/x-marketing/crm"
              variant="light"
              leftSection={<IconUsers size={18} />}
            >
              {t('navigation.crm')}
            </Button>
            <Button
              component={Link}
              to="/dashboard/x-marketing/analytics"
              variant="light"
              leftSection={<IconChartLine size={18} />}
            >
              {t('navigation.analytics')}
            </Button>
          </SimpleGrid>
        </div>

        <Text size="xs" c="dimmed">
          {t('admin.samples.fictionalNotice')}{' '}
          <IconBrandX size={12} style={{ verticalAlign: 'middle' }} />
        </Text>
      </Stack>
    </Paper>
  );
}
