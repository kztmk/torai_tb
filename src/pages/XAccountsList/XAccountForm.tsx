import React, { useEffect, useState } from 'react';
import { IconEdit, IconKey, IconPlus, IconX } from '@tabler/icons-react';
import { MRT_Row, MRT_TableInstance } from 'mantine-react-table';
import { z } from 'zod';
import { Box, Button, Card, Group, Textarea, TextInput } from '@mantine/core';
import { useForm, zodResolver } from '@mantine/form';
import { notifications } from '@mantine/notifications';
import { useTranslation } from 'react-i18next';
import type { TFunction } from 'i18next';
import { useAppDispatch, useAppSelector } from '@/hooks/rtkhooks';
import { createXAccount, resetProcess, updateXAccount } from '@/store/reducers/xAccountsSlice';
import { XAccount } from '@/types/xAccounts';

// XAccountフォームのバリデーションスキーマ
const credentialFieldNames = ['apiKey', 'apiSecret', 'accessToken', 'accessTokenSecret'] as const;

const getValidationSchema = (
  isEditing: boolean,
  isResettingCredentials: boolean,
  t: TFunction
) =>
  z
    .object({
      name: z
        .string()
        .min(1, t('xAccounts.validation.nameRequired'))
        .regex(/^@/, t('xAccounts.validation.nameAt')),
      apiKey:
        isEditing && !isResettingCredentials ? z.string() : z.string().min(1, t('xAccounts.validation.apiKeyRequired')),
      apiSecret:
        isEditing && !isResettingCredentials
          ? z.string()
          : z.string().min(1, t('xAccounts.validation.apiSecretRequired')),
      accessToken:
        isEditing && !isResettingCredentials
          ? z.string()
          : z.string().min(1, t('xAccounts.validation.accessTokenRequired')),
      accessTokenSecret:
        isEditing && !isResettingCredentials
          ? z.string()
          : z.string().min(1, t('xAccounts.validation.accessTokenSecretRequired')),
      note: z.string().optional(),
    })
    .superRefine((values, ctx) => {
      if (!isEditing || !isResettingCredentials) {
        return;
      }

      const filledCredentialCount = credentialFieldNames.filter(
        (fieldName) => values[fieldName].trim().length > 0
      ).length;

      if (filledCredentialCount === 0 || filledCredentialCount === credentialFieldNames.length) {
        return;
      }

      credentialFieldNames.forEach((fieldName) => {
        if (values[fieldName].trim().length === 0) {
          ctx.addIssue({
            code: z.ZodIssueCode.custom,
            path: [fieldName],
            message: t('xAccounts.validation.allCredentials'),
          });
        }
      });
    });

/**
 * XAccoutのDataを登録・編集するためのForm
 *
 */
interface XAccountFormProps {
  row: MRT_Row<XAccount>;
  table: MRT_TableInstance<XAccount>;
  accountData: XAccount;
  feedBack: ({ operation, accountName }: { operation: string; accountName: string }) => void;
}

// 空のフォーム初期値
const emptyInitialValues = {
  id: '',
  name: '',
  apiKey: '',
  apiSecret: '',
  accessToken: '',
  accessTokenSecret: '',
  note: '',
};

const XAccountForm: React.FC<XAccountFormProps> = (props) => {
  const { t } = useTranslation();
  const { row, table, accountData, feedBack } = props;
  const isEditing = Boolean(row);
  const [isResettingCredentials, setIsResettingCredentials] = useState(false);
  const dispatch = useAppDispatch();
  const { process, isLoading, isError, errorMessage } = useAppSelector((state) => state.xAccounts);

  // フォームの初期化
  const form = useForm({
    mode: 'uncontrolled',
    initialValues: structuredClone(accountData) || emptyInitialValues,
    validate: zodResolver(getValidationSchema(isEditing, isResettingCredentials, t)),
    transformValues: (values) => ({
      ...values,
      name: values.name.trim(),
      apiKey: values.apiKey.trim(),
      apiSecret: values.apiSecret.trim(),
      accessToken: values.accessToken.trim(),
      accessTokenSecret: values.accessTokenSecret.trim(),
      note: values.note?.trim() || '', // note はオプションなので null/undefined を空文字に変換
    }),
  });

  // dipatchの結果を受け取る
  useEffect(() => {
    if (!isLoading && isError) {
      // error
      notifications.show({
        title: t('common.error'),
        message: errorMessage,
        color: 'red',
        icon: <IconX size={16} />,
        position: 'top-center',
        withCloseButton: true,
      });
    }
    if (!isLoading && !isError && process === 'addNew') {
      // success
      dispatch(resetProcess());
      feedBack({ operation: 'created', accountName: form.getValues().name });
      table.setCreatingRow(null);
    }
    if (!isLoading && !isError && process === 'update') {
      // update success
      // show dialog
      dispatch(resetProcess());
      feedBack({ operation: 'updated', accountName: form.getValues().name });
      table.setEditingRow(null);
    }
  }, [isLoading, isError, errorMessage, process, dispatch]);

  const handleSubmit = async (values: XAccount) => {
    if (isEditing) {
      // 更新処理
      const updatedValues = {
        ...values,
        id: row.original.id,
        name: row.original.name,
      };
      await dispatch(updateXAccount(updatedValues));
    } else {
      // 登録処理
      await dispatch(createXAccount(values));
    }
  };

  const handleCancel = () => {
    // フォームをクリアしてモーダルを閉じる
    if (isEditing) {
      form.reset();
      table.setEditingRow(null);
    } else {
      form.reset();
      table.setCreatingRow(null);
    }
  };

  const clearCredentialFields = () => {
    form.setValues({
      apiKey: '',
      apiSecret: '',
      accessToken: '',
      accessTokenSecret: '',
    });
  };

  const handleCredentialResetToggle = () => {
    if (isResettingCredentials) {
      clearCredentialFields();
    }
    setIsResettingCredentials((current) => !current);
  };

  // フォームアクション用のアイコンを選択
  const actionIcon = isEditing ? <IconEdit size={18} /> : <IconPlus size={18} />;
  const credentialRequired = !isEditing || isResettingCredentials;
  const showCredentialFields = !isEditing || isResettingCredentials;

  return (
    <Card shadow="sm" padding="lg" radius="md" withBorder>
      <Box mx="auto" w="100%">
        <form onSubmit={form.onSubmit(handleSubmit)} style={{ width: '100%' }}>
          <TextInput
            label={t('xAccounts.accountName')}
            placeholder={t('xAccounts.accountNamePlaceholder')}
            withAsterisk
            disabled={isEditing}
            {...form.getInputProps('name')}
            key={form.key('name')}
            mb="md"
            w="100%"
          />

          <Textarea
            label={t('xAccounts.memo')}
            placeholder={t('xAccounts.memoPlaceholder')}
            {...form.getInputProps('note')}
            key={form.key('note')}
            mb="md"
            minRows={3}
            w="100%"
          />

          {isEditing && (
            <Button
              type="button"
              variant={isResettingCredentials ? 'light' : 'outline'}
              leftSection={<IconKey size={18} />}
              onClick={handleCredentialResetToggle}
              mb="md"
              w="100%"
            >
              {isResettingCredentials
                ? t('xAccounts.cancelCredentialReset')
                : t('xAccounts.resetCredentials')}
            </Button>
          )}

          {showCredentialFields && (
            <>
              <TextInput
                label="API Key"
                placeholder={t('xAccounts.apiKeyPlaceholder')}
                withAsterisk={credentialRequired}
                {...form.getInputProps('apiKey')}
                key={form.key('apiKey')}
                mb="md"
                w="100%"
              />

              <TextInput
                label="API Secret"
                placeholder={t('xAccounts.apiSecretPlaceholder')}
                withAsterisk={credentialRequired}
                {...form.getInputProps('apiSecret')}
                key={form.key('apiSecret')}
                mb="md"
                w="100%"
              />

              <TextInput
                label="Access Token"
                placeholder={t('xAccounts.accessTokenPlaceholder')}
                withAsterisk={credentialRequired}
                {...form.getInputProps('accessToken')}
                key={form.key('accessToken')}
                mb="md"
                w="100%"
              />

              <TextInput
                label="Access Token Secret"
                placeholder={t('xAccounts.accessTokenSecretPlaceholder')}
                withAsterisk={credentialRequired}
                {...form.getInputProps('accessTokenSecret')}
                key={form.key('accessTokenSecret')}
                mb="md"
                w="100%"
              />
            </>
          )}

          <Group justify="center" mt="xl" w="100%" gap="md">
            <Button
              variant="outline"
              color="gray"
              onClick={handleCancel}
              size="md"
              w={150}
              leftSection={<IconX size={18} />}
              type="button"
            >
              {t('common.cancel')}
            </Button>
            <Button
              type="submit"
              loading={isLoading}
              size="md"
              w={150}
              leftSection={!isLoading && actionIcon}
            >
              {isEditing ? t('common.update') : t('common.create')}
            </Button>
          </Group>
        </form>
      </Box>
    </Card>
  );
};

export default XAccountForm;
