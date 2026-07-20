// src/store/reducers/auth/apiThunks.ts
import { createAsyncThunk } from '@reduxjs/toolkit';
import { ref as dbRef, update as updateRTDB } from 'firebase/database';
import { getFunctions, httpsCallable } from 'firebase/functions';
import { database, firebaseApp } from '@/firebase';
import { gasProxyPost, getGasResponseErrorMessage } from '@/utils/gasProxyClient';
import { normalizeGeminiApiKey } from '@/utils/geminiApiKey';
import { RootState } from '../../index';
import { SLICE_NAME } from './constants';
import { AffiliateKeyData, ApiKeyData } from './types';

interface SaveApiKeysInput extends ApiKeyData {
  gasSetupCode?: string;
  discordWebhookUrl?: string;
}

interface InitializeGasProxyAuthResponse {
  success: boolean;
  googleSheetUrl: string;
  initializedAt: string;
  ownerUid: string;
}

interface ClearGasProxyAuthResponse {
  success: boolean;
  googleSheetUrl: string;
  initializedAt: string;
}

const GAS_SETUP_CODE_PATTERN = /^[0-9A-F]{8}-[0-9A-F]{8}-[0-9A-F]{8}$/i;

const getNotificationHasWebhookUrl = (data: unknown): boolean | undefined => {
  if (!data || typeof data !== 'object') {
    return undefined;
  }

  let hasWebhookUrl: boolean | undefined;
  const visit = (node: any) => {
    if (hasWebhookUrl !== undefined) {
      return;
    }
    if (!node || typeof node !== 'object') {
      return;
    }
    if (Array.isArray(node)) {
      node.forEach(visit);
      return;
    }
    if (typeof node.hasWebhookUrl === 'boolean') {
      hasWebhookUrl = node.hasWebhookUrl;
      return;
    }
    if (node.data && typeof node.data === 'object') {
      visit(node.data);
    }
  };

  visit(data);
  return hasWebhookUrl;
};

/**
 * API Keyを保存する
 */
export const saveApiKeys = createAsyncThunk<ApiKeyData, SaveApiKeysInput, { state: RootState }>(
  `${SLICE_NAME}/saveApiKeys`,
  async (args, thunkApi) => {
    try {
      const appUser = thunkApi.getState().auth.user;
      if (appUser !== null && appUser.uid !== null) {
        const normalizedGeminiApiKey = normalizeGeminiApiKey(args.geminiApiKey);
        const normalizedSetupCode = args.gasSetupCode?.trim().toUpperCase() ?? '';
        const googleSheetUrlChanged = args.googleSheetUrl !== (appUser.googleSheetUrl ?? '');
        let googleSheetUrl = appUser.googleSheetUrl ?? '';
        let gasProxyInitializedAt = appUser.gasProxyInitializedAt ?? '';
        const functions = getFunctions(firebaseApp, 'asia-northeast1');

        if (args.googleSheetUrl && normalizedSetupCode) {
          if (!GAS_SETUP_CODE_PATTERN.test(normalizedSetupCode)) {
            return thunkApi.rejectWithValue(
              '本人確認コードの形式が正しくありません。Spreadsheetの「虎威連携」メニューで生成されたコードを入力してください。'
            );
          }

          const initializeGasProxyAuth = httpsCallable<
            { googleSheetUrl: string; setupCode: string },
            InitializeGasProxyAuthResponse
          >(functions, 'initializeGasProxyAuth');
          const initializeResult = await initializeGasProxyAuth({
            googleSheetUrl: args.googleSheetUrl,
            setupCode: normalizedSetupCode,
          });
          googleSheetUrl = initializeResult.data.googleSheetUrl;
          gasProxyInitializedAt = initializeResult.data.initializedAt;
        } else if (args.googleSheetUrl && googleSheetUrlChanged) {
          return thunkApi.rejectWithValue(
            'GAS WebアプリURLを変更する場合は、Spreadsheetの「虎威連携」メニューで本人確認コードを生成して入力してください。'
          );
        } else if (!args.googleSheetUrl && googleSheetUrlChanged) {
          const clearGasProxyAuth = httpsCallable<unknown, ClearGasProxyAuthResponse>(
            functions,
            'clearGasProxyAuth'
          );
          const clearResult = await clearGasProxyAuth();
          googleSheetUrl = clearResult.data.googleSheetUrl;
          gasProxyInitializedAt = clearResult.data.initializedAt;
        }

        const settingsRef = dbRef(database, `user-data/${appUser.uid}/settings`);
        const settingsUpdate: {
          chatGptApiKey: string;
          geminiApiKey: string;
          anthropicApiKey: string;
        } = {
          chatGptApiKey: args.chatGptApiKey,
          geminiApiKey: normalizedGeminiApiKey,
          anthropicApiKey: args.anthropicApiKey,
        };

        const hasGasConnection = Boolean(googleSheetUrl && gasProxyInitializedAt);
        const isNotificationSettingsChanged =
          args.discordPostResultNotificationEnabled !==
            (appUser.discordPostResultNotificationEnabled ?? false) ||
          (args.discordPostResultNotificationEnabled && Boolean(args.discordWebhookUrl?.trim()));
        const shouldSaveNotificationSettings =
          hasGasConnection &&
          typeof args.discordPostResultNotificationEnabled === 'boolean' &&
          isNotificationSettingsChanged;
        let discordWebhookUrlSaved = hasGasConnection
          ? (appUser.discordWebhookUrlSaved ?? appUser.discordPostResultNotificationEnabled ?? false)
          : false;

        if (shouldSaveNotificationSettings) {
          const webhookUrl = args.discordWebhookUrl?.trim();
          const notificationResponse = await gasProxyPost(
            {
              enabled: args.discordPostResultNotificationEnabled,
              ...(webhookUrl ? { webhookUrl } : {}),
            },
            {
              action: 'upsert',
              target: 'notificationSettings',
            }
          );
          const gasErrorMessage = getGasResponseErrorMessage(
            notificationResponse.data,
            'GAS通知設定の保存に失敗しました。'
          );
          if (gasErrorMessage) {
            return thunkApi.rejectWithValue(gasErrorMessage);
          }
          discordWebhookUrlSaved =
            getNotificationHasWebhookUrl(notificationResponse.data) ??
            (webhookUrl ? true : discordWebhookUrlSaved);
        }

        const finalSettingsUpdate: Record<string, string | boolean> = {
          ...settingsUpdate,
        };

        if (shouldSaveNotificationSettings) {
          finalSettingsUpdate.discordPostResultNotificationEnabled =
            Boolean(args.discordPostResultNotificationEnabled);
          finalSettingsUpdate.discordWebhookUrlSaved = discordWebhookUrlSaved;
        } else if (
          !hasGasConnection &&
          (appUser.discordPostResultNotificationEnabled || appUser.discordWebhookUrlSaved)
        ) {
          finalSettingsUpdate.discordPostResultNotificationEnabled = false;
          finalSettingsUpdate.discordWebhookUrlSaved = false;
        }

        await updateRTDB(settingsRef, finalSettingsUpdate);

        return {
          chatGptApiKey: args.chatGptApiKey,
          geminiApiKey: normalizedGeminiApiKey,
          anthropicApiKey: args.anthropicApiKey,
          googleSheetUrl,
          gasProxyInitializedAt,
          discordPostResultNotificationEnabled: hasGasConnection
            ? (args.discordPostResultNotificationEnabled ??
              appUser.discordPostResultNotificationEnabled ??
              false)
            : false,
          discordWebhookUrlSaved: hasGasConnection ? discordWebhookUrlSaved : false,
        };
      }
      return { chatGptApiKey: '', geminiApiKey: '', anthropicApiKey: '', googleSheetUrl: '' };
    } catch (error: any) {
      return thunkApi.rejectWithValue(error.message);
    }
  }
);

/**
 * アフィリエイトキーを保存する
 */
export const affiliateKeySave = createAsyncThunk<
  AffiliateKeyData,
  { keyInfo: [string, string][] },
  { state: RootState; rejectValue: string }
>(`${SLICE_NAME}/affiliateKeySave`, async (args, thunkApi) => {
  try {
    const appUser = thunkApi.getState().auth.user;
    if (appUser && appUser.uid) {
      const newValues = Object.fromEntries(args.keyInfo);
      delete newValues.googleSheetUrl;
      delete newValues.gasProxyInitializedAt;
      const settingsRef = dbRef(database, `user-data/${appUser.uid}/settings`);
      const userSettings = {
        rakutenAppId: appUser.rakutenAppId ?? '',
        amazonAccessKey: appUser.amazonAccessKey ?? '',
        amazonSecretKey: appUser.amazonSecretKey ?? '',
        dmmAffiliateId: appUser.dmmAffiliateId ?? '',
        dmmApiId: appUser.dmmApiId ?? '',
        chatGptApiKey: appUser.chatGptApiKey,
        geminiApiKey: appUser.geminiApiKey,
        anthropicApiKey: appUser.anthropicApiKey,
        ...newValues,
      };
      await updateRTDB(settingsRef, userSettings);
      return {
        rakutenAppId: userSettings.rakutenAppId ?? '',
        amazonAccessKey: userSettings.amazonAccessKey ?? '',
        amazonSecretKey: userSettings.amazonSecretKey ?? '',
        dmmAffiliateId: userSettings.dmmAffiliateId ?? '',
        dmmApiId: userSettings.dmmApiId ?? '',
        googleSheetUrl: appUser.googleSheetUrl ?? '',
      };
    }
    return {
      rakutenAppId: '',
      amazonAccessKey: '',
      amazonSecretKey: '',
      dmmAffiliateId: '',
      dmmApiId: '',
      googleSheetUrl: '',
    };
  } catch (error: any) {
    return thunkApi.rejectWithValue(error.message);
  }
});
