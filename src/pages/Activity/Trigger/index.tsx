import { useEffect, useState } from 'react';
import { IconClock, IconRefresh, IconX } from '@tabler/icons-react';
import {
  Badge,
  Box,
  Button,
  Card,
  Grid,
  Group,
  LoadingOverlay,
  Paper,
  Select,
  Switch,
  Text,
  Title,
} from '@mantine/core';
import { useAppDispatch, useAppSelector } from '@/hooks/rtkhooks';
import {
  createTrigger,
  deleteTrigger,
  getTriggerStatus,
} from '@/store/reducers/apiControllerSlice';
import XTrendsTable from '../XTrends';
import { useTranslation } from 'react-i18next';

/**
 * トリガー管理コンポーネント
 * トリガーの状態表示とトリガーのON/OFF切り替え機能を提供
 */
const Trigger = () => {
  const { t } = useTranslation();
  const { status, triggerStatus } = useAppSelector((state) => state.apiController);

  const [intervalToSet, setIntervalToSet] = useState<number>(5);
  const dispatch = useAppDispatch();

  // 許可される間隔の選択肢
  const intervalOptions = [
    { value: '1', label: t('activity.trigger.minutes', { count: 1 }) },
    { value: '5', label: t('activity.trigger.minutes', { count: 5 }) },
    { value: '10', label: t('activity.trigger.minutes', { count: 10 }) },
    { value: '15', label: t('activity.trigger.minutes', { count: 15 }) },
    { value: '30', label: t('activity.trigger.minutes', { count: 30 }) },
  ];

  // トリガー状態の切り替えハンドラ
  const handleTriggerToggle = async (checked: boolean) => {
    if (checked) {
      dispatch(createTrigger({ functionName: 'autoPostToX', intervalMinutes: intervalToSet }));
    } else {
      dispatch(deleteTrigger());
    }
  };

  // トリガー状態の取得
  useEffect(() => {
    dispatch(getTriggerStatus({ functionName: 'autoPostToX' }));
  }, []);

  // triggerStatus.interval が変更されたらローカルステートも更新する (任意)
  // これにより、トリガーが有効になった際に Select のデフォルト値が追従する
  useEffect(() => {
    if (
      triggerStatus?.isTriggerConfigured &&
      triggerStatus.interval &&
      triggerStatus.interval > 0
    ) {
      // 有効な interval があればローカルステートに反映
      // ただし、ユーザーが Select で変更中の場合は上書きしない方が良い場合もある
      // ここでは、APIから取得した値を優先して設定する
      setIntervalToSet(triggerStatus.interval);
    }
  }, [triggerStatus?.interval, triggerStatus?.isTriggerConfigured]);

  return (
    <Paper p="md" withBorder>
      <LoadingOverlay visible={status === 'loading'} />
      <Group gap="lg" mb="md">
        <Title order={3}>{t('activity.trigger.title')}</Title>
        <Button
          leftSection={<IconRefresh size={18} />}
          onClick={() => dispatch(getTriggerStatus({ functionName: 'autoPostToX' }))}
          disabled={status === 'loading'}
          variant="light"
        >
          {t('activity.trigger.refresh')}
        </Button>
      </Group>
      <Card withBorder mb="md">
        <Grid justify="center" align="center" gutter={20}>
          <Grid.Col span={{ base: 12, xs: 12, sm: 6 }}>
            <Box style={{ height: '100%' }}>
              <Group align="center" style={{ display: 'flex' }}>
                <Text fw={500}>{t('activity.trigger.autoPost')}:</Text>

                {triggerStatus && (
                  <Group>
                    <Badge
                      color={triggerStatus.isTriggerConfigured ? 'green' : 'red'}
                      variant="light"
                      leftSection={
                        triggerStatus.isTriggerConfigured ? (
                          <IconClock size={14} />
                        ) : (
                          <IconX size={14} />
                        )
                      }
                    >
                      {triggerStatus.isTriggerConfigured
                        ? t('activity.trigger.active')
                        : t('activity.trigger.stopped')}
                    </Badge>

                    {triggerStatus.isTriggerConfigured && triggerStatus.interval && (
                      <Badge color="blue" variant="light">
                        {t('activity.trigger.intervalValue', { count: triggerStatus.interval })}
                      </Badge>
                    )}
                  </Group>
                )}
              </Group>
              <Text size="sm" c="dimmed">
                {t('activity.trigger.description')}
              </Text>
            </Box>
          </Grid.Col>
          <Grid.Col span={{ base: 12, xs: 12, sm: 6 }}>
            <Box style={{ height: '100%' }}>
              <Group align="center" gap="lg">
                <Switch
                  checked={triggerStatus?.isTriggerConfigured || false}
                  onChange={(event) => handleTriggerToggle(event.currentTarget.checked)}
                  size="lg"
                  label={triggerStatus?.isTriggerConfigured
                    ? t('activity.trigger.running')
                    : t('activity.trigger.start')}
                  disabled={status === 'loading'}
                  labelPosition="left"
                  style={{ marginTop: '24px' }}
                />
                <Select
                  label={t('activity.trigger.interval')}
                  value={String(intervalToSet)} // Select の value は string
                  onChange={(value) => {
                    if (value) {
                      setIntervalToSet(Number(value)); // state には number で保存
                    }
                  }}
                  data={intervalOptions}
                  disabled={triggerStatus?.isTriggerConfigured || status === 'loading'} // トリガー動作中は変更不可にする
                  style={{ width: '120px' }}
                  allowDeselect={false} // 選択解除を不許可
                />
              </Group>
            </Box>
          </Grid.Col>
        </Grid>
      </Card>

      <Text size="sm" c="dimmed" mt="lg">
        {t('activity.trigger.notice')}
      </Text>
      <XTrendsTable />
    </Paper>
  );
};

export default Trigger;
