import dayjs from 'dayjs';
import customParseFormat from 'dayjs/plugin/customParseFormat';
import isSameOrAfter from 'dayjs/plugin/isSameOrAfter';
import React, { useEffect, useMemo, useRef } from 'react';
import { IconCalendarMonth, IconClock } from '@tabler/icons-react';
import * as z from 'zod';
import {
  ActionIcon,
  Button,
  Group,
  Modal,
  NumberInput,
  Paper,
  Stack,
  Switch,
  Text,
} from '@mantine/core';
import { DateInput, TimeInput } from '@mantine/dates';
import { useForm, zodResolver } from '@mantine/form';
import { useTranslation } from 'react-i18next';
import type { TFunction } from 'i18next';

dayjs.extend(isSameOrAfter);

type XPostScheduleFormPropsType = {
  setSchedule: (data: ScheduleData | null) => void;
  dialogOpen: boolean;
  onClose: () => void;
};

// 日付と時刻の検証スキーマ
// DateInputはDate | nullを返すため、それに対応
// 日付と時刻を組み合わせて将来の時刻かどうか検証
const isTimeOverStart = (startDate: Date | null, startTime: string): boolean => {
  if (!startDate || !startTime) {
    return false;
  }

  // 時刻文字列からhourとminuteを取得（HH:mm形式）
  const timeParts = startTime.split(':');
  const hour = parseInt(timeParts[0], 10);
  const minute = parseInt(timeParts[1], 10);

  // 日付と時刻を組み合わせた日時を作成
  const combinedDateTime = new Date(startDate);
  combinedDateTime.setHours(hour, minute, 0, 0);

  // 現在時刻と比較
  return new Date() < combinedDateTime;
};

// スキーマの定義
const getSchema = (t: TFunction) => {
  const dateSchema = z.union([
    z.date().refine((date) => Boolean(date), { message: t('xPosts.schedule.selectDate') }),
    z.null().transform(() => null),
  ]);
  const timeSchema = z.string().refine(
    (time) => time !== '' && /^([01]?[0-9]|2[0-3]):[0-5][0-9]$/.test(time),
    { message: t('xPosts.schedule.validTime') }
  );

  return z
  .object({
    startDate: dateSchema,
    endDate: dateSchema,
    startTime: timeSchema,
    endTime: timeSchema,
    duration: z.number().gt(0, { message: t('xPosts.schedule.positiveInterval') }),
    unit: z.boolean(),
  })
  .refine(
    (data) => {
      // 両方の日付がnullでない場合のみ比較
      if (data.startDate && data.endDate) {
        return data.endDate >= data.startDate;
      }
      return true; // どちらかがnullならバリデーションをパス（個別フィールドのバリデーションで対処）
    },
    {
      message: t('xPosts.schedule.endAfterStart'),
      path: ['endDate'],
    }
  )
  .refine(
    (data) => {
      // 終了日がnullでない場合のみ日付範囲をチェック
      if (data.endDate) {
        const maxDate = new Date();
        maxDate.setMonth(maxDate.getMonth() + 18);
        return data.endDate < maxDate;
      }
      return true; // nullならバリデーションをパス
    },
    {
      message: t('xPosts.schedule.within18Months'),
      path: ['endDate'],
    }
  )
  .refine(
    (data) => {
      // 開始日が将来の日付かどうかを検証
      return data.startDate && data.startTime
        ? isTimeOverStart(data.startDate, data.startTime)
        : true;
    },
    {
      message: t('xPosts.schedule.futureStart'),
      path: ['startTime'],
    }
  );
};

// フォームの入力値型定義
export interface FormValues {
  startDate: Date | null;
  endDate: Date | null;
  startTime: string;
  endTime: string;
  duration: number;
  unit: boolean;
}

// 送信用のスケジュールデータ型（Dayjsオブジェクトに変換したもの）
export interface ScheduleData {
  startDate: dayjs.Dayjs;
  endDate: dayjs.Dayjs;
  startTime: dayjs.Dayjs;
  endTime: dayjs.Dayjs;
  duration: number;
  unit: boolean;
}

// フォームの初期値
const defaultValues: FormValues = {
  startDate: null,
  endDate: null,
  startTime: '',
  endTime: '',
  duration: 30,
  unit: false,
};

const XPostScheduleForm: React.FC<XPostScheduleFormPropsType> = (props) => {
  const { t } = useTranslation();
  const schema = useMemo(() => getSchema(t), [t]);
  const { setSchedule, dialogOpen, onClose } = props;
  const refStartTime = useRef<HTMLInputElement>(null);
  const refEndTime = useRef<HTMLInputElement>(null);

  dayjs.extend(customParseFormat);

  const form = useForm<FormValues>({
    initialValues: defaultValues,
    validate: zodResolver(schema),
  });

  // dialogOpenが変わったとき（ダイアログが開かれたとき）にフォームを初期化
  useEffect(() => {
    if (dialogOpen) {
      form.reset();
    }
  }, [dialogOpen]);

  const pickerControlStartTime = (
    <ActionIcon variant="subtle" color="gray" onClick={() => refStartTime.current?.showPicker()}>
      <IconClock size={16} stroke={1.5} />
    </ActionIcon>
  );

  const pickerControlEndTime = (
    <ActionIcon variant="subtle" color="gray" onClick={() => refEndTime.current?.showPicker()}>
      <IconClock size={16} stroke={1.5} />
    </ActionIcon>
  );

  const onSubmit = (formValues: FormValues) => {
    try {
      // 日付と時刻のnullチェック（Zodですでに検証済みだが念のため）
      if (!formValues.startDate || !formValues.endDate) {
        form.setFieldError('startDate', t('xPosts.schedule.startDateMissing'));
        return;
      }

      console.log('formValues-startTime:', formValues.startTime);
      console.log('formValues-endTime:', formValues.endTime);
      // 文字列からDayjsオブジェクトへ変換
      const scheduleData: ScheduleData = {
        startDate: dayjs(formValues.startDate),
        endDate: dayjs(formValues.endDate),
        startTime: dayjs(formValues.startTime, 'HH:mm'),
        endTime: dayjs(formValues.endTime, 'HH:mm'),
        duration: formValues.duration,
        unit: formValues.unit,
      };

      setSchedule(scheduleData);
      onClose();
    } catch (error) {
      console.error('日付・時刻の変換エラー:', error);
      form.setErrors({
        startDate: t('xPosts.schedule.invalidDateTime'),
      });
    }
  };

  const handleCancel = () => {
    setSchedule(null);
    onClose();
  };

  const handleReset = () => {
    form.setValues(defaultValues);
  };

  return (
    <Modal opened={dialogOpen} onClose={onClose} title={t('xPosts.schedule.title')}>
      <Paper component="form" id="schedule-form" onSubmit={form.onSubmit(onSubmit)}>
        <Stack gap="md">
          <DateInput
            label={t('xPosts.schedule.startDate')}
            required
            {...form.getInputProps('startDate')}
            clearable
            leftSection={<IconCalendarMonth />}
          />
          <DateInput
            label={t('xPosts.schedule.endDate')}
            required
            {...form.getInputProps('endDate')}
            clearable
            leftSection={<IconCalendarMonth />}
          />
          <TimeInput
            label={t('xPosts.schedule.startTime')}
            ref={refStartTime}
            required
            {...form.getInputProps('startTime')}
            rightSection={pickerControlStartTime}
            withSeconds={false}
          />
          <TimeInput
            label={t('xPosts.schedule.endTime')}
            ref={refEndTime}
            required
            {...form.getInputProps('endTime')}
            rightSection={pickerControlEndTime}
            withSeconds={false}
          />
          <NumberInput label={t('xPosts.schedule.interval')} required {...form.getInputProps('duration')} />
          <Group>
            <Text>{t('xPosts.schedule.minutes')}</Text>
            <Switch label={t('xPosts.schedule.hours')} {...form.getInputProps('unit', { type: 'checkbox' })} />
          </Group>
          <Group mt="md">
            <Button variant="outline" color="red" onClick={handleCancel}>
              {t('common.cancel')}
            </Button>
            <Button variant="outline" color="gray" onClick={handleReset}>
              {t('xPosts.form.reset')}
            </Button>
            <Button type="submit">{t('common.create')}</Button>
          </Group>
        </Stack>
      </Paper>
    </Modal>
  );
};

export default XPostScheduleForm;
