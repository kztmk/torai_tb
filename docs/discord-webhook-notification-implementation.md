# Discord Webhook 投稿結果通知 実装手順書

## 目的

虎威でGASがX自動投稿を実行したとき、投稿成功・投稿失敗・重大エラーをDiscordのスマホ通知で確認できるようにする。

最初の実装対象はDiscord Webhookのみとする。LINE Messaging APIやTelegram Botなどの通知先は、後で同じ通知設定モデルに追加できる設計にする。

## 方針

- 虎威側のプロフィール > APIキー画面に通知設定を追加する。
- ユーザーは「Discordにポスト結果を送信」をONにした場合だけWebhook URLを入力する。
- Discord Webhook URLはGAS側の `PropertiesService` に保存する。
- 虎威/Firebase側にはDiscord Webhook URLを永続保存しない。
- 虎威からGASへ通知設定を保存する操作は、既存の `gasProxyPost` 経由で行う。
- GASの自動投稿処理 `autoPostToX` から、成功・失敗・重大エラー時にDiscordへ通知する。
- 通知失敗は自動投稿処理を失敗扱いにしない。ログに残して処理を継続する。

## 保存する設定

GAS `PropertiesService.getScriptProperties()` に以下を保存する。

| key | 内容 |
| --- | --- |
| `discord_notification_enabled` | `true` / `false` |
| `discord_webhook_url` | Discord Webhook URL |

Webhook URLは機密情報扱いとする。虎威の画面に既存値を再表示しない。

## 虎威側実装

### 1. 型定義を追加する

対象:

- `src/store/reducers/auth/types.ts`

`ApiKeyData` に通知設定の表示用フィールドを追加する。

```ts
export interface ApiKeyData {
  chatGptApiKey: string;
  geminiApiKey: string;
  anthropicApiKey: string;
  googleSheetUrl: string;
  gasProxyInitializedAt?: string;
  discordPostResultNotificationEnabled?: boolean;
}
```

Webhook URLは保存値を画面に返さないため、`ApiKeyData` には含めない。

### 2. APIキー画面にフォーム項目を追加する

対象:

- `src/pages/Profile/ApiKeys.tsx`

`FormValues` に以下を追加する。

```ts
discordPostResultNotificationEnabled: boolean;
discordWebhookUrl: string;
```

Mantine UIの追加方針:

- `Switch`
  - label: `Discordにポスト結果を送信`
- `TextInput`
  - label: `Discord Webhook URL`
  - placeholder: `https://discord.com/api/webhooks/...`
  - `Switch` がONの場合だけ表示または有効化
  - 既存URLは再表示しない。保存済みかどうかだけ `Alert` で表示する。

バリデーション:

- ONの場合、Webhook URLが未入力で、かつGAS側に保存済み設定もない場合はエラー。
- URLは以下の形式を許可する。

```ts
const DISCORD_WEBHOOK_URL_PATTERN =
  /^https:\/\/((?:ptb|canary)\.)?(discord\.com|discordapp\.com)\/api\/webhooks\/\d+\/[A-Za-z0-9._-]+(\?[\w=&-]+)?$/;
```

画面文言例:

```text
Discord Webhook URLは保存後に再表示されません。変更する場合のみ新しいURLを入力してください。
```

### 3. 保存thunkに通知設定を追加する

対象:

- `src/store/reducers/auth/apiThunks.ts`

`SaveApiKeysInput` に以下を追加する。

```ts
discordPostResultNotificationEnabled?: boolean;
discordWebhookUrl?: string;
```

既存のAI APIキー保存後、GAS接続が完了している場合だけ `gasProxyPost` で通知設定を送る。

リクエスト例:

```ts
await gasProxyPost(
  {
    enabled: args.discordPostResultNotificationEnabled,
    webhookUrl: args.discordWebhookUrl,
  },
  {
    action: 'upsert',
    target: 'notificationSettings',
  }
);
```

注意:

- `googleSheetUrl` 未登録またはGAS本人確認未完了の場合は、Discord通知設定を保存しない。
- Webhook URLが空で `enabled: false` の場合は、GAS側のURLは保持し、通知だけOFFにする。
- Webhook URLが空で `enabled: true` の場合は、GAS側に既存URLがある場合だけONを許可する設計にする。初回実装では「ON時はURL必須」としてもよい。

### 4. Firebase stateチェックリストを更新する

対象:

- `docs/firebase-state-checklist.md`
- `docs/user-operation-test-checklist.md`

追記内容:

- Discord Webhook URLはFirebaseに保存しない。
- 通知ON/OFFの表示状態だけをRTDBに保存するか、GASから取得するかを明記する。

初期実装では、画面の保存直後にRedux stateへ `discordPostResultNotificationEnabled` を反映するだけでよい。リロード後も表示したい場合はGASから設定メタデータを取得するAPIを追加する。

## GAS側実装

### 1. 通知設定APIを追加する

対象:

- `../x_Autopost/src/apiv2.ts`
- 新規推奨: `../x_Autopost/src/api/notificationSettings.ts`

API仕様:

```ts
type NotificationSettingsRequest = {
  enabled: boolean;
  webhookUrl?: string;
};
```

アクション:

```text
target: notificationSettings
action: upsert
```

処理:

- `enabled === true`
  - `webhookUrl` を検証する。
  - `discord_notification_enabled = "true"` を保存する。
  - `webhookUrl` が入力されていれば `discord_webhook_url` を保存する。
- `enabled === false`
  - `discord_notification_enabled = "false"` を保存する。
  - `webhookUrl` が入力されていれば検証後に `discord_webhook_url` を更新する。
  - `webhookUrl` が空の場合は既存の `discord_webhook_url` を保持する。

URL検証:

```ts
function isValidDiscordWebhookUrl(url: string): boolean {
  return /^https:\/\/((?:ptb|canary)\.)?(discord\.com|discordapp\.com)\/api\/webhooks\/\d+\/[A-Za-z0-9._-]+(\?[\w=&-]+)?$/.test(url);
}
```

レスポンス例:

```ts
{
  enabled: true,
  hasWebhookUrl: true
}
```

Webhook URL自体は返さない。

### 2. Discord通知ユーティリティを追加する

新規推奨:

- `../x_Autopost/src/api/discordNotification.ts`

関数例:

```ts
type PostNotificationPayload = {
  status: 'success' | 'error' | 'critical';
  accountId?: string;
  internalId?: string;
  postId?: string;
  content?: string;
  scheduledAt?: string;
  errorMessage?: string;
};

function sendDiscordPostNotification(payload: PostNotificationPayload): void {
  const properties = PropertiesService.getScriptProperties();
  const enabled = properties.getProperty('discord_notification_enabled') === 'true';
  const webhookUrl = properties.getProperty('discord_webhook_url');

  if (!enabled || !webhookUrl) {
    return;
  }

  const message = buildDiscordMessage(payload);

  try {
    UrlFetchApp.fetch(webhookUrl, {
      method: 'post',
      contentType: 'application/json',
      payload: JSON.stringify({
        content: message,
      }),
      muteHttpExceptions: true,
    });
  } catch (error) {
    Logger.log(`Failed to send Discord notification: ${error}`);
  }
}
```

通知失敗時の扱い:

- `throw` しない。
- `Logger.log` のみ。
- 投稿成功・失敗の本処理には影響させない。

### 3. 通知メッセージ形式

成功:

```text
✅ X投稿に成功しました
アカウント: @accountId
内部ID: internalId
X Post ID: postId
本文: first 80 chars...
```

失敗:

```text
❌ X投稿に失敗しました
アカウント: @accountId
内部ID: internalId
エラー: error message
本文: first 80 chars...
```

重大エラー:

```text
🚨 X自動投稿で重大エラーが発生しました
エラー: error message
```

本文は長くしすぎない。最大80〜120文字程度に切り詰める。

### 4. `autoPostToX` に成功通知を追加する

対象:

- `../x_Autopost/src/main.ts`

`processPost(...)` 成功後に通知する。

現在の成功経路:

```ts
await processPost(...);
processedInThisRun = true;
```

追加方針:

```ts
sendDiscordPostNotification({
  status: 'success',
  accountId: postObject.postTo,
  internalId: postObject.id,
  postId: postObject.postId,
  content: postObject.contents,
  scheduledAt: postObject.postSchedule,
});
```

注意:

- `processPost` 内でX投稿後に `postObject.postId` が更新されない場合は、`processPost` の戻り値として `postId` を返すように変更する。
- 既に `Posted` へ移動するための `postId` を取得している箇所から返すのが確実。

推奨変更:

```ts
async function processPost(...): Promise<{ postId: string }> {
  ...
  return { postId };
}
```

### 5. `autoPostToX` に失敗通知を追加する

対象:

- `../x_Autopost/src/main.ts`

既存の `catch (e)` 内で、`logErrorToSheet(...)` の後、または `status = failed` 更新後に通知する。

```ts
sendDiscordPostNotification({
  status: 'error',
  accountId: postObject?.postTo,
  internalId: internalPostId,
  content: postContent,
  scheduledAt: postObject?.postSchedule,
  errorMessage: e.message,
});
```

例外:

- `ReplyTargetPendingError`
  - 親投稿待ちなので失敗通知しない。
- `PublishedPostMoveError`
  - X投稿自体は成功しているため、失敗通知ではなく「投稿済み移動失敗」通知にするか、初期実装では通知しない。

### 6. 重大エラー通知を追加する

対象:

- `../x_Autopost/src/main.ts`

最外側 `catch (e)` に追加する。

```ts
sendDiscordPostNotification({
  status: 'critical',
  errorMessage: e.message,
});
```

## セキュリティ

- Discord Webhook URLは機密情報。
- Firebase RTDB/Firestoreには保存しない。
- GAS `PropertiesService` からもAPIレスポンスでURLを返さない。
- ログにWebhook URLを出さない。
- 虎威画面では保存済みURLを再表示しない。
- URL変更時は新しいWebhook URLを再入力する。

## テスト手順

### 虎威側

1. APIキー画面を開く。
2. `Discordにポスト結果を送信` をONにする。
3. Discord Webhook URLを入力する。
4. 保存する。
5. 保存完了通知が出る。
6. Webhook URLが画面に再表示されないことを確認する。
7. OFFにして保存し、GAS側の通知が止まることを確認する。

### GAS側

1. `notificationSettings` の `upsert` をGAS API経由で呼ぶ。
2. `PropertiesService` に以下が保存されることを確認する。
   - `discord_notification_enabled`
   - `discord_webhook_url`
3. Webhook URLがレスポンスに含まれないことを確認する。
4. テスト用関数でDiscordへ送信できることを確認する。

### 自動投稿成功

1. 1件だけ予約投稿を作成する。
2. トリガーで `autoPostToX` を実行する。
3. X投稿が成功する。
4. Discordに成功通知が届く。
5. `Posted` シートへ移動済みであることを確認する。

### 自動投稿失敗

1. 意図的に失敗する投稿を作る。
   - 存在しない外部リプライ先
   - 無効なアカウント認証情報
2. `autoPostToX` を実行する。
3. `Errors` シートに記録される。
4. `Posts` シートの `status` が `failed` になる。
5. Discordに失敗通知が届く。

### 通知失敗

1. Discord Webhook URLを無効なURLにする。
2. 投稿成功または失敗を発生させる。
3. 自動投稿処理自体は通常どおり完了する。
4. 通知失敗は `Logger.log` にだけ残る。

## 実装順

1. GASに `notificationSettings` APIを追加する。
2. GASにDiscord通知ユーティリティを追加する。
3. GASの `autoPostToX` 成功/失敗/重大エラーへ通知を差し込む。
4. 虎威の `ApiKeyData` / auth state に通知ON/OFF表示用フィールドを追加する。
5. 虎威のAPIキー画面にSwitchとWebhook URL入力欄を追加する。
6. `saveApiKeys` からGASへ通知設定を保存する。
7. docs/checklistを更新する。
8. GAS build、虎威 build、手動通知テストを行う。

## 将来拡張

- 通知対象を選べるようにする。
  - 成功のみ
  - 失敗のみ
  - 成功・失敗
- Discord以外の通知先を追加する。
  - Telegram Bot
  - Google Chat Webhook
  - LINE Messaging API
- 投稿失敗時だけ管理者にも通知する。
- 通知履歴をGASシートまたはFirestoreに保存する。
