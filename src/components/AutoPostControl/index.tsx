/**
 * 自動投稿トリガーの ON/OFF・間隔設定（ヘッダのグローバルウィジェット）。
 * GAS の trigger create/delete/status を使う。autoPost は全アカウント横断で queued を処理するため、
 * この設定はアプリ全体で共通。どのページからも操作できるようヘッダに常設する。
 *
 * エンゲージメント日次更新（GAS: updateAllEngagement）の ON/OFF も同じ場所で扱う。
 * こちらは everyDays(1) の日次トリガーで、手動更新は用意していない
 * （GAS 側の insights refresh は同期実行で数分かかり、プロキシの 30 秒タイムアウトに収まらないため）。
 */
import { useEffect, useState } from 'react';
import { useTranslation } from 'react-i18next';
import { IconClockCog } from '@tabler/icons-react';
import {
  ActionIcon,
  Badge,
  Divider,
  Group,
  Indicator,
  Popover,
  Select,
  Stack,
  Switch,
  Text,
  Tooltip,
} from '@mantine/core';
import { notifications } from '@mantine/notifications';
import { useAppDispatch, useAppSelector } from '@/hooks/rtkhooks';
import {
  createTrigger,
  deleteTrigger,
  disableEngagementTrigger,
  enableEngagementTrigger,
  getEngagementTriggerStatus,
  getTriggerStatus,
  selectEngagementStatus,
  selectTriggerStatus,
} from '@/store/reducers/apiControllerSlice';

const POSTING_HANDLER = 'autoPost';
const INTERVALS = ['1', '5', '10', '15', '30'];

// 通知の message には必ず文字列を渡す。Error / オブジェクトをそのまま渡すと
// Mantine がそれを React の子として描画しようとしてクラッシュする（React error #31）。
const toMessage = (e: unknown, fallback: string): string => {
  if (typeof e === 'string' && e) return e;
  if (e && typeof e === 'object' && typeof (e as { message?: unknown }).message === 'string') {
    return (e as { message: string }).message;
  }
  return fallback;
};

const AutoPostControl = () => {
  const { t } = useTranslation();
  const dispatch = useAppDispatch();
  const user = useAppSelector((s) => s.auth.user);
  const triggerStatus = useAppSelector(selectTriggerStatus);
  const engagementStatus = useAppSelector(selectEngagementStatus);
  const [interval, setIntervalValue] = useState('5');
  const [busy, setBusy] = useState(false);
  const [engagementBusy, setEngagementBusy] = useState(false);

  const isConnected = Boolean(user.gasProxyInitializedAt);
  const isOn = triggerStatus.isTriggerConfigured;
  const isEngagementOn = engagementStatus.isTriggerConfigured;

  useEffect(() => {
    if (isConnected) {
      dispatch(getTriggerStatus({ functionName: POSTING_HANDLER }));
      dispatch(getEngagementTriggerStatus());
    }
  }, [dispatch, isConnected]);

  useEffect(() => {
    if (isOn && triggerStatus.interval > 0) setIntervalValue(String(triggerStatus.interval));
  }, [isOn, triggerStatus.interval]);

  if (!isConnected) return null;

  const refresh = () => dispatch(getTriggerStatus({ functionName: POSTING_HANDLER }));

  const enable = async (minutes: number) => {
    setBusy(true);
    try {
      await dispatch(
        createTrigger({ functionName: POSTING_HANDLER, intervalMinutes: minutes })
      ).unwrap();
      notifications.show({ color: 'green', message: t('autoPost.enabled', { minutes }) });
      refresh();
    } catch (e: any) {
      notifications.show({ color: 'red', message: toMessage(e, t('autoPost.failed')) });
    } finally {
      setBusy(false);
    }
  };

  const disable = async () => {
    setBusy(true);
    try {
      await dispatch(deleteTrigger()).unwrap();
      notifications.show({ color: 'green', message: t('autoPost.disabled') });
      refresh();
    } catch (e: any) {
      notifications.show({ color: 'red', message: toMessage(e, t('autoPost.failed')) });
    } finally {
      setBusy(false);
    }
  };

  const toggleEngagement = async (checked: boolean) => {
    setEngagementBusy(true);
    try {
      if (checked) {
        await dispatch(enableEngagementTrigger()).unwrap();
        notifications.show({ color: 'green', message: t('autoPost.engagementEnabled') });
      } else {
        await dispatch(disableEngagementTrigger()).unwrap();
        notifications.show({ color: 'green', message: t('autoPost.engagementDisabled') });
      }
      dispatch(getEngagementTriggerStatus());
    } catch (e: any) {
      notifications.show({ color: 'red', message: toMessage(e, t('autoPost.engagementFailed')) });
    } finally {
      setEngagementBusy(false);
    }
  };

  return (
    <Popover width={290} position="bottom-end" withArrow shadow="md">
      <Popover.Target>
        <Tooltip label={t('autoPost.title')}>
          <Indicator color={isOn ? 'green' : 'gray'} size={9} offset={5} processing={isOn}>
            <ActionIcon
              size="lg"
              variant={isOn ? 'light' : 'subtle'}
              color={isOn ? 'green' : 'gray'}
              aria-label="auto post"
            >
              <IconClockCog size={20} />
            </ActionIcon>
          </Indicator>
        </Tooltip>
      </Popover.Target>
      <Popover.Dropdown>
        <Stack gap="sm">
          <Group justify="space-between">
            <Text fw={600} size="sm">
              {t('autoPost.title')}
            </Text>
            <Badge color={isOn ? 'green' : 'gray'}>{isOn ? t('autoPost.on') : t('autoPost.off')}</Badge>
          </Group>
          <Text size="xs" c="dimmed">
            {isOn ? t('autoPost.onDesc', { minutes: triggerStatus.interval }) : t('autoPost.offDesc')}
          </Text>
          <Select
            label={t('autoPost.interval')}
            data={INTERVALS.map((v) => ({ value: v, label: t('autoPost.minutes', { count: Number(v) }) }))}
            value={interval}
            onChange={(v) => {
              if (!v) return;
              setIntervalValue(v);
              if (isOn) enable(Number(v)); // 有効中は作り直し
            }}
            disabled={busy}
            comboboxProps={{ withinPortal: true }}
          />
          <Switch
            checked={isOn}
            onChange={(e) => {
              const checked = e.currentTarget.checked;
              if (checked) enable(Number(interval));
              else disable();
            }}
            disabled={busy}
            label={t('autoPost.enableLabel')}
          />

          <Divider />

          <Group justify="space-between">
            <Text fw={600} size="sm">
              {t('autoPost.engagementTitle')}
            </Text>
            <Badge color={isEngagementOn ? 'green' : 'gray'}>
              {isEngagementOn ? t('autoPost.on') : t('autoPost.off')}
            </Badge>
          </Group>
          <Text size="xs" c="dimmed">
            {isEngagementOn ? t('autoPost.engagementOnDesc') : t('autoPost.engagementOffDesc')}
          </Text>
          <Switch
            checked={isEngagementOn}
            onChange={(e) => toggleEngagement(e.currentTarget.checked)}
            disabled={engagementBusy || !engagementStatus.loaded}
            label={t('autoPost.engagementEnableLabel')}
          />
        </Stack>
      </Popover.Dropdown>
    </Popover>
  );
};

export default AutoPostControl;
