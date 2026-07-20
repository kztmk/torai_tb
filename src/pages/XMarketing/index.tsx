import { useEffect, useState } from 'react';
import { IconRefresh, IconSettings } from '@tabler/icons-react';
import { useLocation } from 'react-router-dom';
import { useTranslation } from 'react-i18next';
import {
  Alert,
  Button,
  Center,
  Group,
  Loader,
  Modal,
  NumberInput,
  Select,
  Stack,
  Switch,
} from '@mantine/core';
import { notifications } from '@mantine/notifications';
import { useAppDispatch, useAppSelector } from '@/hooks/rtkhooks';
import {
  fetchXMarketingDashboard,
  refreshXMarketing,
  saveXMarketingSettings,
  selectAccount,
  selectXMarketing,
} from '@/store/reducers/xMarketingSlice';
import type { XMarketingDashboard } from '@/types/xMarketing';
import Analytics from './Analytics';
import Crm from './Crm';
import { demoDashboard } from './demo';
import Inbox from './Inbox';

type EditableXMarketingSettings = Omit<
  XMarketingDashboard['settings'],
  'maxPostsPerAccount' | 'maxLikingUsersPerPost' | 'monthlyLimitUsd'
> & {
  maxPostsPerAccount: number | string;
  maxLikingUsersPerPost: number | string;
  monthlyLimitUsd: number | string;
};

export default function XMarketing() {
  const dispatch = useAppDispatch();
  const location = useLocation();
  const { t } = useTranslation();
  const state = useAppSelector(selectXMarketing);
  const demo =
    import.meta.env.DEV && new URLSearchParams(location.search).get('demo') === 'x-marketing';
  const dashboard = demo ? demoDashboard : state.dashboard;
  const normalizedPath = location.pathname.replace(/\/+$/, '');
  const isCrmRoute = normalizedPath.endsWith('/crm');
  const isAnalyticsRoute = normalizedPath.endsWith('/analytics');
  const [settingsOpened, setSettingsOpened] = useState(false);
  const [settings, setSettings] = useState<EditableXMarketingSettings>(
    dashboard?.settings || demoDashboard.settings
  );

  useEffect(() => {
    if (!demo) {
      dispatch(fetchXMarketingDashboard('all'));
    }
  }, [demo, dispatch]);

  useEffect(() => {
    if (dashboard && !settingsOpened) {
      setSettings(dashboard?.settings || demoDashboard.settings);
    }
  }, [dashboard, settingsOpened]);

  if (!demo && state.status === 'loading' && !dashboard) {
    return (
      <Center h={400}>
        <Loader />
      </Center>
    );
  }
  if (!demo && state.status === 'error' && !dashboard) {
    return (
      <Alert color="red" title={t('xMarketing.errors.loadDashboard')}>
        {state.error}
      </Alert>
    );
  }
  if (!dashboard) {
    return null;
  }

  const accounts = [
    { value: 'all', label: t('xMarketing.allAccounts') },
    ...(dashboard?.accounts || []).map((v) => ({ value: v.accountId, label: `@${v.accountId}` })),
  ];
  const saveSettings = async () => {
    try {
      const validatedSettings: XMarketingDashboard['settings'] = {
        ...settings,
        maxPostsPerAccount: Math.round(
          getSafeNumberInputValue(settings.maxPostsPerAccount, 1, 100)
        ),
        maxLikingUsersPerPost: Math.round(
          getSafeNumberInputValue(settings.maxLikingUsersPerPost, 1, 100)
        ),
        monthlyLimitUsd: getSafeNumberInputValue(settings.monthlyLimitUsd, 1, 1000),
      };
      await dispatch(saveXMarketingSettings(validatedSettings)).unwrap();
      setSettingsOpened(false);
      notifications.show({
        color: 'green',
        title: t('xMarketing.settings.saved'),
        message: t('xMarketing.settings.savedMessage'),
      });
      dispatch(fetchXMarketingDashboard('all'));
    } catch (error) {
      notifications.show({
        color: 'red',
        title: t('xMarketing.settings.saveFailed'),
        message: getErrorMessage(error, t('xMarketing.errors.tryAgain')),
      });
    }
  };
  const refresh = async () => {
    try {
      await dispatch(refreshXMarketing()).unwrap();
      notifications.show({
        color: 'green',
        title: t('xMarketing.refresh.complete'),
        message: t('xMarketing.refresh.completeMessage'),
      });
      dispatch(fetchXMarketingDashboard('all'));
    } catch (error) {
      notifications.show({
        color: 'red',
        title: t('xMarketing.refresh.failed'),
        message: getErrorMessage(error, t('xMarketing.errors.tryAgain')),
      });
    }
  };
  const closeSettings = () => {
    setSettings(dashboard?.settings || demoDashboard.settings);
    setSettingsOpened(false);
  };

  return (
    <>
      <Group justify="space-between" mb="md">
        <Select
          value={state.selectedAccountId}
          onChange={(value) => dispatch(selectAccount(value || 'all'))}
          data={accounts}
          w={250}
          aria-label={t('navigation.xAccounts')}
        />
        <Group>
          <Button
            variant="default"
            leftSection={<IconSettings size={16} />}
            onClick={() => setSettingsOpened(true)}
          >
            {t('xMarketing.settings.button')}
          </Button>
          <Button
            variant="light"
            loading={state.saving}
            leftSection={<IconRefresh size={16} />}
            onClick={refresh}
          >
            {t('xMarketing.refresh.button')}
          </Button>
        </Group>
      </Group>
      {isAnalyticsRoute ? (
        <Analytics dashboard={dashboard} />
      ) : isCrmRoute ? (
        <Crm dashboard={dashboard} />
      ) : (
        <Inbox dashboard={dashboard} />
      )}
      <Modal
        opened={settingsOpened}
        onClose={closeSettings}
        title={t('xMarketing.settings.title')}
      >
        <Stack>
          <Switch
            label={t('xMarketing.settings.enableInteractions')}
            checked={settings.enabled}
            onChange={(event) => setSettings({ ...settings, enabled: event.currentTarget.checked })}
          />
          <Switch
            label={t('xMarketing.settings.enableAnalytics')}
            description={t('xMarketing.settings.analyticsDescription')}
            checked={settings.analyticsEnabled}
            onChange={(event) =>
              setSettings({ ...settings, analyticsEnabled: event.currentTarget.checked })
            }
          />
          <Select
            label={t('xMarketing.settings.trackingPeriod')}
            value={String(settings.trackingDays)}
            data={[
              { value: '1', label: t('xMarketing.days', { count: 1 }) },
              { value: '7', label: t('xMarketing.days', { count: 7 }) },
              { value: '14', label: t('xMarketing.days', { count: 14 }) },
              { value: '30', label: t('xMarketing.days', { count: 30 }) },
            ]}
            onChange={(value) => setSettings({ ...settings, trackingDays: Number(value || 7) })}
          />
          <NumberInput
            label={t('xMarketing.settings.postsPerAccount')}
            min={1}
            max={100}
            value={settings.maxPostsPerAccount}
            onChange={(value) =>
              setSettings({
                ...settings,
                maxPostsPerAccount: value,
              })
            }
          />
          <NumberInput
            label={t('xMarketing.settings.likingUsersLimit')}
            min={1}
            max={100}
            value={settings.maxLikingUsersPerPost}
            onChange={(value) =>
              setSettings({
                ...settings,
                maxLikingUsersPerPost: value,
              })
            }
          />
          <NumberInput
            label={t('xMarketing.settings.monthlyBudget')}
            min={1}
            max={1000}
            decimalScale={2}
            value={settings.monthlyLimitUsd}
            onChange={(value) =>
              setSettings({
                ...settings,
                monthlyLimitUsd: value,
              })
            }
          />
          <Alert color="palePurple">
            {t('xMarketing.settings.costNotice')}
          </Alert>
          <Button loading={state.saving} onClick={saveSettings}>
            {t('xMarketing.settings.save')}
          </Button>
        </Stack>
      </Modal>
    </>
  );
}

function getSafeNumberInputValue(value: string | number, min: number, max: number) {
  const parsed = typeof value === 'number' ? value : Number(value);
  if (!Number.isFinite(parsed)) {
    return min;
  }
  return Math.min(max, Math.max(min, parsed));
}

function getErrorMessage(error: unknown, fallback: string) {
  if (typeof error === 'string' && error !== '') {
    return error;
  }
  if (error !== null && typeof error === 'object' && 'message' in error) {
    const message = (error as { message?: unknown }).message;
    if (typeof message === 'string' && message !== '') {
      return message;
    }
  }
  return fallback;
}
