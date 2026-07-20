# Xアカウント分析機能 実装手順書

## 1. この文書の目的

虎威ユーザーが自分のGASと、自分で登録済みのX API認証情報を使って、自分のXアカウントの投稿実績を日次で取得・蓄積し、虎威上で確認できる機能を後日実装するための設計・作業手順を定める。

実装開始時は、この文書だけを根拠にせず、必ずX APIの最新仕様・単価と、対象ブランチの虎威・`x_Autopost`実装を再確認すること。

## 2. 前提とゴール

### 前提

- ユーザーごとのGASは、スプレッドシートに紐づく`x_Autopost`で動作する。
- GASには次のOAuth 1.0aユーザーコンテキスト認証情報が登録済みである。
  - API Key
  - API Key Secret
  - Access Token
  - Access Token Secret
- 虎威とGASは、既存の署名付きGASプロキシで接続済みである。
- 虎威からGASへの呼び出しは`src/utils/gasProxyClient.ts`の`gasProxyPost`を使う。
- GAS側の変更対象は兄弟リポジトリ`../x_Autopost`である。

### 初期リリースのゴール

- GASが1日1回、自分の直近投稿とメトリクスをX API v2から取得する。
- 取得履歴をユーザー自身のスプレッドシートに保存する。
- 虎威から集計結果を取得し、概要・推移・投稿別一覧を表示する。
- X API認証情報をFirebaseへ追加保存しない。
- 取得件数、追跡日数、推定費用、最終実行結果をユーザーが確認できる。
- APIエラーや予算上限到達が自動投稿処理を停止させない。

### 初期リリースの対象外

- 他人のアカウントの非公開指標
- X Ads APIを使った広告キャンペーン分析
- 投稿本文のAI評価・感情分析・改善文の自動生成
- リアルタイム取得
- 全期間の過去投稿の一括バックフィル
- 虎威運営の共通X APIキーによる代理取得

## 3. 採用する全体構成

```text
X API v2
  ↑ OAuth 1.0a（ユーザー自身の4キー）
ユーザー自身のGAS / x_Autopost
  ├─ 日次トリガー
  ├─ 投稿・メトリクス取得
  ├─ 費用上限判定
  ├─ 集計
  └─ スプレッドシートへ履歴保存
          ↑↓ 署名付きGASプロキシ
Firebase Functions /api/gas-proxy
          ↑ Firebase ID token
虎威 React UI
```

### 責務分担

| コンポーネント | 責務 |
| --- | --- |
| X API | 投稿、公開指標、所有投稿に許可された非公開指標を返す |
| GAS | 認証、取得、ページング、費用ガード、履歴保存、集計 |
| Spreadsheet | ユーザー所有の分析データと設定を保存 |
| Firebase Functions | Firebaseユーザーを認証し、既存契約でGASへ署名付き転送 |
| 虎威 | 設定・実行状態・分析結果の表示、手動更新要求 |

分析の正本はGAS側に置く。FirebaseにはX APIキーや投稿別分析履歴を複製しない。将来、横断検索や高速表示が必要になった場合のみ、ユーザー同意・保持期間・削除仕様を決めたうえでFirebaseへの集計値キャッシュを別途検討する。

## 4. X APIの利用方針

### 基本エンドポイント

初期実装は次を第一候補とする。

```text
GET /2/users/{id}/tweets
```

主な指定項目:

```text
max_results=100
start_time=<追跡期間の開始UTC時刻>
tweet.fields=id,text,created_at,public_metrics,non_public_metrics,organic_metrics
exclude=retweets
```

実装時に対象フィールドがこのタイムラインエンドポイントとOAuth 1.0aで返ることを実機確認する。必要な指標が返らない場合のみ、`GET /2/tweets/analytics`または投稿ID一括lookupを比較検討する。Analytics ReadはOwned Readより高くなる可能性があるため、無条件に併用しない。

### ページング

- 1リクエストの`max_results`は100件とする。
- レスポンスの`meta.next_token`がある間だけ次ページを取得する。
- `maxPostsPerRun`に達したら停止する。
- 同一実行中に同じ投稿IDを二重保存しない。
- APIレスポンスが空なら正常終了とする。

例えば1日50投稿、追跡期間30日なら対象は最大1,500投稿で、HTTP通信は最大約15回/日である。1,500回の`UrlFetchApp.fetch`ではない。

### 取得期間

初期値は7日、選択肢は`1 / 7 / 14 / 30日`とする。非公開・オーガニック指標には取得可能期間の制約があるため、30日を上限とし、実装開始時に最新仕様を再確認する。

30日を過ぎた投稿は最終スナップショットを保持し、X APIから再取得しない。

## 5. 費用モデルとガード

### 計算方法

X APIの費用はHTTPリクエスト数ではなく、原則として返されたリソース数で計算する。2026年7月確認時点では、自分のDeveloper Appで自分の投稿を読むOwned Readは次の単価だった。

```text
$0.001 / returned resource
```

単価は変更され得るため、コードに「永久に正しい定数」として埋め込まない。設定値として保持し、実装開始時とリリース前にDeveloper Consoleと公式Pricingで確認する。

概算式:

```text
1日あたり取得リソース数 ≒ 1日平均投稿数 × 追跡日数
月額USD ≒ 1日あたり取得リソース数 × 30 × 1リソース単価
```

1日50投稿の場合:

| 追跡期間 | 定常時の取得上限/日 | HTTP通信上限/日 | 月額概算（$0.001/件） |
| ---: | ---: | ---: | ---: |
| 1日 | 50件 | 1回 | $1.50 |
| 7日 | 350件 | 4回 | $10.50 |
| 14日 | 700件 | 7回 | $21.00 |
| 30日 | 1,500件 | 15回 | $45.00 |

初月は対象投稿が毎日50件ずつ増えるため、30日追跡の概算は`50 × (1 + ... + 30) × $0.001 = $23.25`。2か月目以降は30日ローリングで概ね$45/月となる。

### 必須の費用ガード

GAS設定に次を持たせる。

| 設定 | 初期値 | 説明 |
| --- | ---: | --- |
| `enabled` | `false` | 反応者取得をユーザーが明示的に有効化する |
| `analyticsEnabled` | `false` | 投稿分析を反応者取得とは独立して有効化する |
| `trackingDays` | `7` | 追跡日数 |
| `maxPostsPerRun` | `500` | 1実行の最大返却投稿数 |
| `estimatedUnitCostUsd` | `0.001` | UI上の概算用単価 |
| `monthlyBudgetUsd` | `10` | 月間予算警告・停止基準 |
| `manualRefreshCooldownMinutes` | `60` | 手動更新の連打防止 |

月次取得数をGAS側で記録し、実行前に次を判定する。

```text
estimatedCurrentMonthCost = monthResourcesRead × estimatedUnitCostUsd
```

- 予算の80%で警告状態にする。
- 予算到達後は自動取得を停止する。
- 停止しても保存済みデータの閲覧とX自動投稿は継続する。
- Developer Console側にもSpending limitを設定するよう画面・マニュアルで案内する。
- GASの概算値は請求額を保証しない。正確な残高・請求はDeveloper Consoleを正とする。

## 6. GAS・スプレッドシートのデータ設計

### 現行Xマーケティングへの統合実装（2026年7月）

実装時は反応者インボックスと同じ日次ジョブを共用し、別の`xAnalytics`トリガーを作らず`target: xMarketing`へ統合した。一方で費用を個別に制御できるよう、`enabled`（反応者取得）と`analyticsEnabled`（投稿分析）は独立したスイッチとする。どちらか一方がONなら日次トリガーを維持し、投稿分析がOFFの場合は投稿指標の要求と分析シート更新を行わない。実際の保存先は次のとおり。

- `XMarketingPosts`: `accountId + postId`を主キーにした投稿別最新値
- `XMarketingPostDaily`: `日付 + accountId + postId`を主キーにした日次スナップショット
- `XMarketingRuns`: 反応者取得と投稿分析を合わせた実行・費用履歴

投稿分析がONの場合、`GET /2/users/{id}/tweets`では`created_at,public_metrics,non_public_metrics,organic_metrics`を要求し、権限・商品条件により非公開指標を取得できない場合は`created_at,public_metrics`で再取得する。投稿分析がOFFで反応者取得だけがONの場合は、反応者取得に必要な自分の投稿だけを読み、分析シートは更新しない。虎威の`投稿分析`画面は`analytics.posts`と`analytics.daily`を表示し、取得できない値を推測で補完しない。

既存シート名との衝突を実装前に確認する。初期案は次の3シートとする。

### `x_analytics_settings`

1行の設定として管理する。

| 列 | 型 | 内容 |
| --- | --- | --- |
| `enabled` | boolean | 分析の有効状態 |
| `tracking_days` | number | 追跡日数 |
| `max_posts_per_run` | number | 1実行上限 |
| `estimated_unit_cost_usd` | number | 概算単価 |
| `monthly_budget_usd` | number | 月間上限 |
| `last_run_at` | ISO string | 最終実行開始時刻 |
| `last_success_at` | ISO string | 最終成功時刻 |
| `last_status` | string | `idle/running/success/warning/error/budget_stopped` |
| `last_error_code` | string | 安定したエラーコード |
| `last_error_message` | string | 秘密情報を含まないメッセージ |
| `last_resources_read` | number | 前回取得件数 |
| `month_key` | `YYYY-MM` | 集計対象月 |
| `month_resources_read` | number | 当月取得リソース概算 |
| `updated_at` | ISO string | 更新時刻 |

### `x_analytics_posts`

投稿ごとの最新値を保持する。主キーは`account_id + post_id`。

| 列 | 内容 |
| --- | --- |
| `account_id` | 虎威内のXアカウント識別子 |
| `x_user_id` | Xの数値ユーザーID |
| `post_id` | X投稿ID。文字列として保存 |
| `created_at` | 投稿日時 |
| `text_preview` | 任意。最小限の本文抜粋。保存不要なら省略 |
| `impression_count` | 表示回数 |
| `like_count` | いいね数 |
| `reply_count` | 返信数 |
| `repost_count` | リポスト数 |
| `quote_count` | 引用数 |
| `bookmark_count` | ブックマーク数 |
| `url_link_clicks` | 取得できる場合のみ |
| `user_profile_clicks` | 取得できる場合のみ |
| `engagement_rate` | 定義を固定して計算 |
| `first_fetched_at` | 初回取得日時 |
| `last_fetched_at` | 最終更新日時 |
| `tracking_completed_at` | 追跡終了日時 |

エンゲージメント率の初期定義:

```text
(like + reply + repost + quote + bookmark) / impression × 100
```

`impression_count`が0または未取得なら`null`とし、0%と表示しない。

### `x_analytics_daily`

アカウント別・日別の集計値を保持する。主キーは`account_id + date`。

| 列 | 内容 |
| --- | --- |
| `account_id` | Xアカウント識別子 |
| `date` | 集計日 `YYYY-MM-DD` |
| `posts_count` | 投稿日が当日の投稿数 |
| `impression_count` | 合計表示回数 |
| `engagement_count` | 合計反応数 |
| `average_engagement_rate` | 投稿別率の平均ではなく、合計値から算出 |
| `followers_count` | 取得する場合のスナップショット |
| `updated_at` | 更新日時 |

## 7. GAS API契約

既存の`action`/`target`ルーティングへ、`target: xAnalytics`を追加する。

### 設定取得

```text
action: getSettings
target: xAnalytics
```

レスポンス:

```json
{
  "status": "success",
  "data": {
    "enabled": true,
    "trackingDays": 7,
    "maxPostsPerRun": 500,
    "estimatedUnitCostUsd": 0.001,
    "monthlyBudgetUsd": 10,
    "lastSuccessAt": "2026-07-12T08:00:00.000Z",
    "lastStatus": "success",
    "monthResourcesRead": 3200,
    "estimatedMonthCostUsd": 3.2
  }
}
```

認証情報、アクセストークン、シート内部行番号は返さない。

### 設定保存

```text
action: upsertSettings
target: xAnalytics
```

リクエスト:

```json
{
  "enabled": true,
  "trackingDays": 7,
  "maxPostsPerRun": 500,
  "monthlyBudgetUsd": 10
}
```

GAS側で型、範囲、許可値を再検証する。クライアント検証だけに依存しない。

### サマリー取得

```text
action: getSummary
target: xAnalytics
```

クエリ例:

```text
accountId=<account id>
rangeDays=30
```

レスポンスには、期間合計、前期間比、日別配列、上位投稿、最終取得状態を含める。投稿本文は必要最小限にし、ページ全件を一度に返さない。

### 投稿一覧取得

```text
action: getPosts
target: xAnalytics
```

許可パラメータ:

- `accountId`
- `from`
- `to`
- `sort`
- `limit`（最大100）
- `cursor`

### 手動更新

```text
action: refresh
target: xAnalytics
```

- クールダウン内なら`429`相当の業務エラーを返す。
- 同時実行は`LockService`で拒否または既存実行を返す。
- 画面操作では非同期ジョブ開始として扱い、長時間HTTP接続を前提にしない。
- 初期版で安全な非同期化が難しい場合、手動更新は対象外にして日次トリガーのみでリリースする。

### 共通エラー形式

```json
{
  "status": "error",
  "code": "X_ANALYTICS_BUDGET_LIMIT",
  "message": "今月の分析予算上限に達したため、取得を停止しました。"
}
```

最低限のエラーコード:

- `X_ANALYTICS_DISABLED`
- `X_ANALYTICS_ACCOUNT_NOT_FOUND`
- `X_ANALYTICS_CREDENTIALS_MISSING`
- `X_ANALYTICS_AUTH_FAILED`
- `X_ANALYTICS_RATE_LIMITED`
- `X_ANALYTICS_BUDGET_LIMIT`
- `X_ANALYTICS_ALREADY_RUNNING`
- `X_ANALYTICS_X_API_ERROR`
- `X_ANALYTICS_STORAGE_ERROR`

X APIレスポンス本文、APIキー、トークン、署名をログやクライアントへ返さない。

## 8. GAS側の実装手順

対象候補:

- `../x_Autopost/src/apiv2.ts`
- `../x_Autopost/src/api/xAnalytics.ts`（新規）
- `../x_Autopost/src/auth.ts`
- `../x_Autopost/src/main.ts`
- `../x_Autopost/src/constants.ts`
- `../x_Autopost/src/test/`配下

### Step 1: 現状調査

1. `xauth`シートの列名とアカウント識別方法を確認する。
2. OAuth 1.0a署名生成・X API呼び出し処理を特定し、自動投稿と共通化できる部分を確認する。
3. `apiv2.ts`のルーティング、レスポンス形式、認可処理を確認する。
4. 既存トリガーの作成・削除処理と関数名を確認する。
5. `appsscript.json`の`oauthScopes`に`script.external_request`とSpreadsheet利用スコープがあることを確認する。

### Step 2: 純粋関数を先に実装

`xAnalytics.ts`で、外部I/Oと分離して次を実装・単体テストする。

- 設定の検証・正規化
- X APIレスポンスの型ガード
- 投稿メトリクスの正規化
- エンゲージメント率計算
- 日次集計
- 月額概算
- ページング停止条件
- X APIエラーから業務エラーへの変換

### Step 3: シートI/O

1. 3シートを不足時だけ作成する初期化関数を追加する。
2. ヘッダー名で列を解決し、列順の固定依存を避ける。
3. 投稿行は一括読み込み・Map化し、一括`setValues`する。投稿ごとの`appendRow`は避ける。
4. `LockService.getScriptLock()`で日次実行と手動実行の競合を防ぐ。
5. 実行開始時に`running`、終了時に`success/warning/error`を必ず保存する。

### Step 4: X APIクライアント

1. 対象`accountId`から4つの認証情報をGAS内で取得する。
2. Xの数値ユーザーIDを一度解決し、GAS側にキャッシュする。
3. `start_time`と`max_results=100`を指定する。
4. `pagination_token`でページングする。
5. 各レスポンスのHTTPステータス、X APIエラー、rate-limitヘッダーを処理する。
6. 401/403は認証エラー、429はレート制限、5xxは再試行可能エラーとして分類する。
7. 429または5xxの再試行は短い指数バックオフと最大回数を設ける。日次実行内で無限再試行しない。
8. 実際に返されたユニークリソース数を当月カウンターへ加算する。

### Step 5: 日次ジョブ

疑似コード:

```ts
function updateXAnalyticsDaily(): void {
  const lock = LockService.getScriptLock();
  if (!lock.tryLock(5000)) return;

  try {
    const settings = loadAnalyticsSettings();
    if (!settings.enabled) return;

    assertBudgetAvailable(settings);
    markRunStarted();

    for (const account of loadXAccounts()) {
      const posts = fetchTrackedPosts(account, settings);
      upsertPostMetrics(account, posts);
      rebuildAffectedDailySummaries(account, posts);
      incrementMonthlyUsage(uniquePostCount(posts));
    }

    markRunSucceeded();
  } catch (error) {
    markRunFailed(toSafeAnalyticsError(error));
  } finally {
    lock.releaseLock();
  }
}
```

1アカウントの失敗で他アカウントの取得を全停止するかは明示的に決める。初期案はアカウント単位でエラーを記録して残りを継続する。

### Step 6: トリガー

- 有効化時に`updateXAnalyticsDaily`の日次時間主導トリガーを1つだけ作成する。
- 同じ関数の重複トリガーを削除してから作成する。
- 無効化時は分析用トリガーだけ削除する。
- タイムゾーン差を画面に明記する。集計日はユーザー/GASのタイムゾーンを正とし、X APIの時刻はUTCで送受信する。

### Step 7: GAS APIルーティング

`apiv2.ts`へ`xAnalytics`を追加し、既存の`assertProxyAuthorized`を必ず通す。分析APIだけ独自の未認証経路を作らない。

## 9. 虎威側の実装手順

対象候補:

- `src/utils/gasProxyClient.ts`（原則変更不要）
- `src/store/reducers/xAnalyticsSlice.ts`（新規）
- `src/types/xAnalytics.ts`（新規）
- `src/pages/Activity/XAnalytics/`（新規）
- `src/pages/Activity/Trigger/index.tsx`または新しい分析ページ
- `src/store/index.ts`
- `docs/firebase-state-checklist.md`
- `docs/user-operation-test-checklist.md`

### Step 1: 型定義

GASレスポンスに対応する次の型を作る。

- `XAnalyticsSettings`
- `XAnalyticsRunStatus`
- `XAnalyticsSummary`
- `XAnalyticsDailyMetric`
- `XAnalyticsPostMetric`
- `XAnalyticsErrorCode`

外部データを`any`のままReduxへ入れず、境界で検証・正規化する。

### Step 2: Redux

少なくとも次のasync thunkを用意する。

- `fetchXAnalyticsSettings`
- `saveXAnalyticsSettings`
- `fetchXAnalyticsSummary`
- `fetchXAnalyticsPosts`
- `requestXAnalyticsRefresh`（採用時のみ）

すべて`gasProxyPost`を使う。生のGAS URLやX API認証情報をリクエストに含めない。

### Step 3: 画面

初期画面に次を表示する。

#### 設定

- 分析ON/OFF
- 対象Xアカウント
- 追跡期間
- 1回の最大取得投稿数
- 月間予算（USD）
- 現在の単価前提と概算式
- 「正確な請求はX Developer Consoleで確認」の注意書き

ONにする前に、選択値から次をプレビューする。

```text
推定取得件数/日
推定HTTP通信回数/日
推定月額USD
```

1日平均投稿数は、直近7日実績から算出するかユーザー入力とする。実績がなければ「計算不能」とし、架空の金額を断定しない。

#### サマリー

- 最終成功日時と状態
- 今月の取得リソース概算
- 今月の推定費用
- 表示回数
- 反応数
- エンゲージメント率
- 投稿数
- 前期間比
- 日別推移

#### 投稿別一覧

- 投稿日時
- 本文抜粋
- 表示回数
- いいね、返信、リポスト、引用、ブックマーク
- エンゲージメント率
- 最終取得日時
- X投稿へのリンク

秘密情報や非公開指標をコンソールログへ出さない。

### Step 4: UX上の必須状態

- GAS未接続
- Xアカウント未登録
- 分析無効
- 初回取得前
- 取得中
- 正常
- 一部警告
- 認証エラー
- X APIレート制限
- 予算上限停止
- 保存済みデータはあるが最新取得に失敗

取得失敗時に既存データを消さず、「最終成功日時」を残す。

## 10. セキュリティとプライバシー

- 4つのX API認証情報は既存GAS内だけで使用する。
- Firebase、Redux、ブラウザログ、分析レスポンスに認証情報を複製しない。
- GASプロキシのFirebase認証、UID、HMAC署名、timestamp、requestId検証を維持する。
- GASの分析APIは、接続済みのFirebase UID以外から利用できないようにする。
- 投稿本文保存は分析に必要な最小限とする。本文を保存しない構成も検討する。
- ログには投稿本文全文、APIレスポンス全文、URLクエリ、認証ヘッダーを残さない。
- アカウント削除または分析データ削除時のシート行削除方法を用意する。
- X APIのDeveloper Agreementと保存・表示条件をリリース前に確認する。

## 11. 制限と性能

### GAS

2026年7月確認時点の`UrlFetchApp`日次上限は、個人アカウント20,000回、Google Workspace 100,000回。1,500投稿を100件ずつ取得する場合は約15回なので、通信回数は通常問題にならない。

ただし、GASには実行時間、Spreadsheet read/write、同時実行など別の制限もある。実装時は次で抑制する。

- 100件単位のX API取得
- シートの一括読み書き
- `LockService`
- 1実行件数上限
- アカウント単位の処理時間計測
- 次回継続用カーソル（1回で完了できない場合）

### X API

- Rate limitと課金は別の制約である。
- 成功して返された投稿数を費用概算へ使う。
- 同一UTC日内の重複取得は重複課金されない場合があるが、実装上は重複排除を前提に節約する。
- 日をまたいで同じ投稿を再取得すると再課金対象になり得る。

## 12. テスト計画

### GAS単体テスト

- 0件、1件、100件、101件、1,500件のページング
- `next_token`なし/あり
- 同じ投稿IDの重複排除
- 指標欠損、0 impression、未知フィールド
- エンゲージメント率
- 日次集計とタイムゾーン境界
- 月替わりの利用数リセット
- 予算80%警告、100%停止
- 401、403、429、500、タイムアウト
- 途中ページ失敗時の整合性
- 複数アカウントの一部失敗
- ロック取得失敗
- トリガー重複防止
- APIレスポンスに秘密情報が含まれないこと

### 虎威単体テスト

- GASレスポンス正規化
- 設定値の範囲検証
- 月額概算
- impression未取得時の率表示
- 各エラーコードの日本語表示
- ローディング中の二重操作防止
- 古いデータを保持したエラー表示

### 結合テスト

1. テスト用Xアカウントで4キーを登録する。
2. GAS本人確認を完了する。
3. 分析を7日、上限100件、低い予算で有効化する。
4. GASを手動実行し、X APIレスポンスを取得する。
5. 3シートの作成・列・値を確認する。
6. 虎威でサマリーと投稿一覧を確認する。
7. X上の表示値と数件を突合する。
8. 2回目の実行で既存行が更新され、重複しないことを確認する。
9. 予算上限を超えさせ、分析だけ停止することを確認する。
10. X自動投稿が継続することを確認する。
11. APIキーやトークンがFirebase、ブラウザ、ログに出ていないことを確認する。

### 費用確認

- Developer Consoleの実測リソース数・費用とGAS概算を比較する。
- 差異がある場合は単価、Owned Read適用条件、重複排除、追加リソースを調査する。
- 実測が確認できるまで「月額保証」の文言を出さない。

## 13. リリース手順

1. X APIの最新Pricing、Metrics、Timeline、Analytics、Rate limitを確認する。
2. `x_Autopost`でGAS処理・API・テストを実装する。
3. GAS開発環境で実X APIを最小件数だけ使って確認する。
4. `snake-sns`で型、Redux、画面、テストを実装する。
5. `docs/firebase-state-checklist.md`を更新する。
6. `docs/user-operation-test-checklist.md`へ分析の操作確認を追加する。
7. ユーザー向けマニュアルに料金、追跡日数、Developer Consoleの予算上限設定を追加する。
8. GASをデプロイし、必要な権限を再承認する。
9. Firebase Functionsを変更した場合だけFunctionsをデプロイする。既存プロキシ契約内なら原則変更不要。
10. Hostingをデプロイする。
11. 少数ユーザーまたはテストアカウントで段階的に有効化する。
12. Developer Console、GAS実行履歴、シート状態、虎威表示を監視する。

## 14. 完了条件（Definition of Done）

- [ ] ユーザー自身の4キーで自分の投稿を取得できる。
- [ ] 1回最大100件でページングされる。
- [ ] 1実行上限と追跡日数が強制される。
- [ ] 日次トリガーが重複しない。
- [ ] 投稿別最新値と日別集計が重複なく保存される。
- [ ] 虎威で設定、サマリー、日別推移、投稿一覧を表示できる。
- [ ] 推定費用とその前提を表示できる。
- [ ] 予算到達時に分析取得だけ停止する。
- [ ] X自動投稿に影響しない。
- [ ] APIキー、トークン、署名がFirebase・レスポンス・ログに出ない。
- [ ] 認証エラー、レート制限、予算停止を区別して表示できる。
- [ ] 失敗後も以前の分析結果を閲覧できる。
- [ ] GAS単体、虎威単体、結合、実機費用確認が完了している。
- [ ] Firebase状態チェックリストとユーザー操作テストを更新している。
- [ ] 最新のX API公式仕様とDeveloper Consoleの単価を再確認している。

## 15. 実装開始日のチェックリスト

実装担当者は最初に次を実施する。

```text
[ ] snake-snsとx_Autopostの対象ブランチ・git statusを確認
[ ] docs/gas-proxy-developer-guide.mdを読む
[ ] x_Autopostのxauth、OAuth署名、apiv2、trigger実装を読む
[ ] X API PricingでOwned Readの最新単価と適用条件を確認
[ ] User Posts Timelineのmax_results、取得可能期間、metrics fieldsを確認
[ ] Post Analyticsが本当に必要か判断
[ ] Apps Scriptの最新quotaを確認
[ ] テスト用XアカウントとDeveloper Consoleのspending limitを準備
[ ] データ保持範囲と投稿本文保存の要否を決定
[ ] 初期リリースの追跡日数、上限、予算初期値を確定
```

## 16. 公式仕様リンク

- X API Pricing: https://docs.x.com/x-api/getting-started/pricing
- User Posts: https://docs.x.com/x-api/users/get-posts
- Metrics: https://docs.x.com/x-api/fundamentals/metrics
- Post Analytics: https://docs.x.com/x-api/posts/get-post-analytics
- Rate limits: https://docs.x.com/x-api/fundamentals/rate-limits
- Usage: https://docs.x.com/x-api/usage/introduction
- Apps Script quotas: https://developers.google.com/apps-script/guides/services/quotas
