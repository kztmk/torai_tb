import { useEffect, useState } from 'react';
import {
  Alert,
  Anchor,
  Button,
  Group,
  LoadingOverlay,
  Paper,
  Stack,
  Switch,
  Text,
  TextInput,
  Title,
} from '@mantine/core';
import { IconCopy, IconDownload } from '@tabler/icons-react';
import { useForm } from '@mantine/form';
import { notifications } from '@mantine/notifications';
import { useTranslation } from 'react-i18next';
import { useAppDispatch, useAppSelector } from '@/hooks/rtkhooks';
import { saveApiKeys } from '@/store/reducers/auth';
import { fetchAccounts, resetAccountsState } from '@/store/reducers/accountsSlice';
import { resetPostsState } from '@/store/reducers/postsSlice';
import { gasProxyPost, getGasResponseErrorMessage } from '@/utils/gasProxyClient';
import { normalizeGeminiApiKey, validateGeminiApiKey } from '@/utils/geminiApiKey';
import { useGasVersionStatus } from '@/hooks/useGasVersionStatus';

interface FormValues {
  chatGptApiKey: string;
  geminiApiKey: string;
  anthropicApiKey: string;
  googleSheetUrl: string;
  gasSetupCode: string;
  discordPostResultNotificationEnabled: boolean;
  discordWebhookUrl: string;
}

// 公開リポジトリ kztmk/ts_autopost の Release から常に最新の code.js を取得する URL。
// タグ push で publish-code-js ワークフローが Release にアセットを添付する。
const GAS_LATEST_CODE_URL =
  import.meta.env.VITE_GAS_LATEST_CODE_URL ||
  'https://github.com/kztmk/ts_autopost/releases/latest/download/code.js';

// テンプレートスプレッドシートの「コピーを作成」URL（.../copy）。
// Google にサインイン済みのブラウザで開くと、そのままユーザーのドライブに複製できる。
// 運営がテンプレ作成後に VITE_GAS_TEMPLATE_COPY_URL を設定する（未設定ならボタン非表示）。
const GAS_TEMPLATE_COPY_URL = import.meta.env.VITE_GAS_TEMPLATE_COPY_URL || '';

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
  const gasStatus = useGasVersionStatus();
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
        // シートURLが変わった場合は、旧シートのデータ（アカウント・投稿・
        // 投稿済み・エラー）を破棄し、新しいシートのアカウントを取得し直す。
        if (urlChanged) {
          dispatch(resetAccountsState());
          dispatch(resetPostsState());
          if (values.googleSheetUrl) {
            dispatch(fetchAccounts());
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
        {!isGasProxyInitialized && (
          <Alert color="blue" variant="light" title={t('profile.api.setupTitle')}>
            <Stack gap="sm">
              <Text size="sm">{t('profile.api.setupStep1')}</Text>
              {GAS_TEMPLATE_COPY_URL && (
                <Button
                  component="a"
                  href={GAS_TEMPLATE_COPY_URL}
                  target="_blank"
                  rel="noopener noreferrer"
                  leftSection={<IconCopy size={16} />}
                  w="fit-content"
                >
                  {t('profile.api.copyTemplate')}
                </Button>
              )}
              <Text size="sm">{t('profile.api.setupStep2')}</Text>
              <Anchor
                href={GAS_LATEST_CODE_URL}
                target="_blank"
                rel="noopener noreferrer"
                size="xs"
                c="dimmed"
              >
                <Group gap={4} align="center">
                  <IconDownload size={14} />
                  {t('profile.api.downloadGasScript')}
                </Group>
              </Anchor>
            </Stack>
          </Alert>
        )}
        {/* バックエンド(GAS)バージョン表示と最新版ダウンロードリンク（常時表示） */}
        <Paper withBorder radius="md" p="sm">
          <Stack gap="xs">
            <Group justify="space-between" wrap="nowrap">
              <Text fw={600} size="sm">
                {t('profile.api.versionSectionTitle')}
              </Text>
              <Anchor
                href={GAS_LATEST_CODE_URL}
                target="_blank"
                rel="noopener noreferrer"
                size="sm"
              >
                <Group gap={4} align="center" wrap="nowrap">
                  <IconDownload size={14} />
                  {t('profile.api.downloadLatest')}
                </Group>
              </Anchor>
            </Group>
            <Group gap="md">
              <Text size="sm" c="dimmed">
                {gasStatus.current
                  ? t('profile.api.versionCurrent', { version: gasStatus.current })
                  : t('profile.api.versionCurrentUnknown')}
              </Text>
              {gasStatus.latest && (
                <Text size="sm" c="dimmed">
                  {t('profile.api.versionLatest', { version: gasStatus.latest })}
                </Text>
              )}
            </Group>
            {gasStatus.current &&
              gasStatus.latest &&
              (gasStatus.outdated ? (
                <Alert color="orange" variant="light">
                  {t('profile.api.versionOutdated', { version: gasStatus.latest })}
                </Alert>
              ) : (
                <Text size="xs" c="green">
                  {t('profile.api.versionUpToDate')}
                </Text>
              ))}
          </Stack>
        </Paper>
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
