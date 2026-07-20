import { useEffect, useState } from 'react';
import {
  Alert,
  Button,
  Group,
  LoadingOverlay,
  Paper,
  Stack,
  Switch,
  TextInput,
  Title,
} from '@mantine/core';
import { useForm } from '@mantine/form';
import { notifications } from '@mantine/notifications';
import { useTranslation } from 'react-i18next';
import { useAppDispatch, useAppSelector } from '@/hooks/rtkhooks';
import { saveApiKeys } from '@/store/reducers/auth';
import { fetchXAccounts, resetXAccountsState } from '@/store/reducers/xAccountsSlice';
import { resetXErrorsState } from '@/store/reducers/xErrorsSlice';
import { resetXPostedState } from '@/store/reducers/xPostedSlice';
import { resetXPostsState } from '@/store/reducers/xPostsSlice';
import { gasProxyPost, getGasResponseErrorMessage } from '@/utils/gasProxyClient';
import { normalizeGeminiApiKey, validateGeminiApiKey } from '@/utils/geminiApiKey';

interface FormValues {
  chatGptApiKey: string;
  geminiApiKey: string;
  anthropicApiKey: string;
  googleSheetUrl: string;
  gasSetupCode: string;
  discordPostResultNotificationEnabled: boolean;
  discordWebhookUrl: string;
}

const GAS_SETUP_CODE_PATTERN = /^[0-9A-F]{8}-[0-9A-F]{8}-[0-9A-F]{8}$/i;
const DISCORD_WEBHOOK_URL_PATTERN =
  /^https:\/\/((?:ptb|canary)\.)?(discord\.com|discordapp\.com)\/api\/webhooks\/\d+\/[A-Za-z0-9._-]+(\?[\w=&-]+)?$/;
const GEMINI_API_TEST_ENDPOINT =
  'https://generativelanguage.googleapis.com/v1beta/models/gemini-flash-latest:generateContent';

function ApiKeySettings() {
  const { t } = useTranslation();
  const { loading, error, user, task } = useAppSelector((state) => state.auth);
  const { chatGptApiKey, geminiApiKey, anthropicApiKey, googleSheetUrl } = user;
  const dispatch = useAppDispatch();
  const [isEditingGasConnection, setIsEditingGasConnection] = useState(false);
  const [isTestingDiscordWebhook, setIsTestingDiscordWebhook] = useState(false);
  const [isTestingGeminiApiKey, setIsTestingGeminiApiKey] = useState(false);

  const form = useForm<FormValues>({
    initialValues: {
      chatGptApiKey: chatGptApiKey || '',
      geminiApiKey: geminiApiKey || '',
      anthropicApiKey: anthropicApiKey || '',
      googleSheetUrl: googleSheetUrl || '',
      gasSetupCode: '',
      discordPostResultNotificationEnabled:
        user.discordPostResultNotificationEnabled ?? false,
      discordWebhookUrl: '',
    },
    validate: {
      gasSetupCode: (value, values) => {
        const normalizedValue = (value || '').trim();
        const normalizedGoogleSheetUrl = (values.googleSheetUrl || '').trim();
        const savedGoogleSheetUrl = googleSheetUrl || '';
        const googleSheetUrlChanged = normalizedGoogleSheetUrl !== savedGoogleSheetUrl;
        if (normalizedGoogleSheetUrl && googleSheetUrlChanged && !normalizedValue) {
          return t('profile.api.gasCodeRequired');
        }
        if (normalizedValue && !GAS_SETUP_CODE_PATTERN.test(normalizedValue)) {
          return t('profile.api.gasCodeInvalid');
        }
        return null;
      },
      discordWebhookUrl: (value, values) => {
        const notificationEnabled = values.discordPostResultNotificationEnabled;
        if (!notificationEnabled || !user.gasProxyInitializedAt) {
          return null;
        }

        const normalizedValue = (value || '').trim();
        const hasSavedWebhookUrl = user.discordWebhookUrlSaved ?? false;
        if (!normalizedValue && !hasSavedWebhookUrl) {
          return t('profile.api.discordRequired');
        }
        if (normalizedValue && !DISCORD_WEBHOOK_URL_PATTERN.test(normalizedValue)) {
          return t('profile.api.discordInvalid');
        }
        return null;
      },
      geminiApiKey: (value) => validateGeminiApiKey(value || ''),
    },
  });

  useEffect(() => {
    if (task === 'save_api_keys_error') {
      notifications.show({
        title: t('common.error'),
        message: error || t('profile.api.saveFailed'),
        color: 'red',
      });
    }
    if (task === 'save_api_keys_success') {
      form.setFieldValue('gasSetupCode', '');
      form.setFieldValue('discordWebhookUrl', '');
      setIsEditingGasConnection(false);
      notifications.show({
        title: t('profile.api.saved'),
        message: t('profile.api.savedMessage'),
        color: 'green',
      });
    }
  }, [loading, error, task, dispatch, t]);

  const handleSubmit = (values: FormValues) => {
    const urlChanged = (values.googleSheetUrl || '') !== (googleSheetUrl || '');
    dispatch(
      saveApiKeys({
        chatGptApiKey: values.chatGptApiKey,
        geminiApiKey: normalizeGeminiApiKey(values.geminiApiKey),
        anthropicApiKey: values.anthropicApiKey,
        googleSheetUrl: values.googleSheetUrl,
        gasSetupCode: (values.gasSetupCode || '').trim().toUpperCase(),
        discordPostResultNotificationEnabled: values.discordPostResultNotificationEnabled,
        discordWebhookUrl: (values.discordWebhookUrl || '').trim(),
      })
    )
      .unwrap()
      .then(() => {
        // シートURLが変わった場合は、旧シートのデータ（Xアカウント・投稿・
        // 投稿済み・エラー）を破棄し、新しいシートのXアカウントを取得し直す。
        if (urlChanged) {
          dispatch(resetXAccountsState());
          dispatch(resetXPostsState());
          dispatch(resetXPostedState());
          dispatch(resetXErrorsState());
          if (values.googleSheetUrl) {
            dispatch(fetchXAccounts());
          }
        }
      })
      .catch(() => {
        // 保存失敗時のエラー表示は task 監視の useEffect に委ねる
      });
  };

  const handleTestDiscordWebhook = async () => {
    const webhookUrl = (form.values.discordWebhookUrl || '').trim();
    const hasSavedWebhookUrl = user.discordWebhookUrlSaved ?? false;

    if (!user.gasProxyInitializedAt) {
      form.setFieldError(
        'discordWebhookUrl',
        t('profile.api.gasRequiredForDiscord')
      );
      return;
    }
    if (!webhookUrl && !hasSavedWebhookUrl) {
      form.setFieldError('discordWebhookUrl', t('profile.api.discordTestUrlRequired'));
      return;
    }
    if (webhookUrl && !DISCORD_WEBHOOK_URL_PATTERN.test(webhookUrl)) {
      form.setFieldError('discordWebhookUrl', t('profile.api.discordInvalid'));
      return;
    }

    setIsTestingDiscordWebhook(true);
    try {
      const response = await gasProxyPost(
        webhookUrl ? { webhookUrl } : {},
        {
          action: 'test',
          target: 'notificationSettings',
        }
      );
      const errorMessage = getGasResponseErrorMessage(
        response.data,
        t('profile.api.discordTestFailed')
      );
      if (errorMessage) {
        throw new Error(errorMessage);
      }
      notifications.show({
        title: t('profile.api.discordTestComplete'),
        message: t('profile.api.discordTestCompleteMessage'),
        color: 'green',
      });
    } catch (testError: any) {
      notifications.show({
        title: t('profile.api.discordTestError'),
        message: testError?.message || t('profile.api.discordTestFailed'),
        color: 'red',
      });
    } finally {
      setIsTestingDiscordWebhook(false);
    }
  };

  const handleTestGeminiApiKey = async () => {
    const apiKey = normalizeGeminiApiKey(form.values.geminiApiKey || '');
    if (!apiKey) {
      form.setFieldError('geminiApiKey', t('profile.api.geminiRequired'));
      return;
    }

    const validationError = validateGeminiApiKey(apiKey);
    if (validationError) {
      form.setFieldError('geminiApiKey', validationError);
      return;
    }

    setIsTestingGeminiApiKey(true);
    try {
      const response = await fetch(GEMINI_API_TEST_ENDPOINT, {
        method: 'POST',
        headers: {
          'Content-Type': 'application/json',
          'X-goog-api-key': apiKey,
        },
        body: JSON.stringify({
          contents: [
            {
              parts: [
                {
                  text: 'Explain how AI works in a few words',
                },
              ],
            },
          ],
        }),
      });
      const responseData = await response.json().catch(() => null);
      if (!response.ok) {
        const message =
          typeof responseData?.error?.message === 'string'
            ? responseData.error.message
            : t('profile.api.geminiTestFailed');
        throw new Error(message);
      }

      notifications.show({
        title: t('profile.api.geminiTestComplete'),
        message: t('profile.api.geminiTestCompleteMessage'),
        color: 'green',
      });
    } catch (testError: any) {
      notifications.show({
        title: t('profile.api.geminiTestError'),
        message: testError?.message || t('profile.api.geminiTestFailed'),
        color: 'red',
      });
    } finally {
      setIsTestingGeminiApiKey(false);
    }
  };

  const isGasProxyInitialized = Boolean(user.gasProxyInitializedAt);
  const isSavedGasUrl = form.values.googleSheetUrl === googleSheetUrl;
  const isGasConnectionLocked = isGasProxyInitialized && isSavedGasUrl && !isEditingGasConnection;
  const isDiscordNotificationEnabled = form.values.discordPostResultNotificationEnabled;
  const hasSavedDiscordWebhookUrl = user.discordWebhookUrlSaved ?? false;

  return (
    <Paper shadow="sm" p="lg" radius="md" withBorder>
      <LoadingOverlay visible={loading} zIndex={1000} overlayProps={{ radius: 'sm', blur: 2 }} />
      <Stack>
        <Title order={4}>{t('profile.tabs.apiKeys')}</Title>
        <form onSubmit={form.onSubmit(handleSubmit)}>
          <Group align="flex-end" gap="sm" wrap="nowrap">
            <TextInput
              label="Google Sheets URL"
              placeholder={t('profile.api.googleSheetsPlaceholder')}
              disabled={isGasConnectionLocked}
              {...form.getInputProps('googleSheetUrl')}
              w="100%"
            />
            {isGasConnectionLocked && (
              <Button
                type="button"
                variant="outline"
                onClick={() => {
                  form.setFieldValue('gasSetupCode', '');
                  setIsEditingGasConnection(true);
                }}
              >
                {t('common.edit')}
              </Button>
            )}
          </Group>
          <TextInput
            label={t('profile.api.gasCode')}
            placeholder={t('profile.api.gasCodePlaceholder')}
            description={
              isGasConnectionLocked
                ? t('profile.api.gasVerifiedDescription')
                : t('profile.api.gasCodeDescription')
            }
            disabled={isGasConnectionLocked}
            {...form.getInputProps('gasSetupCode')}
            w="100%"
          />
          {isGasProxyInitialized && (
            <Alert color="green" variant="light">
              {t('profile.api.gasVerified')}
            </Alert>
          )}
          <Switch
            label={t('profile.api.discordEnabled')}
            disabled={!isGasProxyInitialized}
            {...form.getInputProps('discordPostResultNotificationEnabled', { type: 'checkbox' })}
          />
          {isDiscordNotificationEnabled && isGasProxyInitialized && hasSavedDiscordWebhookUrl && (
            <Alert color="blue" variant="light">
              {t('profile.api.discordSaved')}
            </Alert>
          )}
          {isDiscordNotificationEnabled && (
            <Group align="flex-end" gap="sm" wrap="nowrap">
              <TextInput
                label="Discord Webhook URL"
                placeholder="https://discord.com/api/webhooks/..."
                description={t('profile.api.discordSecretDescription')}
                disabled={!isGasProxyInitialized}
                {...form.getInputProps('discordWebhookUrl')}
                style={{ flex: 1 }}
              />
              <Button
                type="button"
                variant="outline"
                loading={isTestingDiscordWebhook}
                disabled={!isGasProxyInitialized}
                onClick={handleTestDiscordWebhook}
              >
                {t('profile.api.testSend')}
              </Button>
            </Group>
          )}
          <TextInput
            label="OpenAI API Key"
            placeholder={t('profile.api.openAiPlaceholder')}
            {...form.getInputProps('chatGptApiKey')}
            w="100%"
            disabled
          />

          <Group align="flex-end" gap="sm" wrap="nowrap">
            <TextInput
              label="Gemini API Key"
              placeholder={t('profile.api.geminiPlaceholder')}
              {...form.getInputProps('geminiApiKey')}
              style={{ flex: 1 }}
            />
            <Button
              type="button"
              variant="outline"
              loading={isTestingGeminiApiKey}
              onClick={handleTestGeminiApiKey}
            >
              {t('profile.api.test')}
            </Button>
          </Group>

          <TextInput
            label="Anthropic API Key"
            placeholder={t('profile.api.anthropicPlaceholder')}
            {...form.getInputProps('anthropicApiKey')}
            w="100%"
            disabled
          />

          <Button type="submit" mt="xl">
            {t('common.save')}
          </Button>
        </form>
      </Stack>
    </Paper>
  );
}

export default ApiKeySettings;
