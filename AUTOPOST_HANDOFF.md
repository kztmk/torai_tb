# Autopost Frontend 引き継ぎメモ

Threads / Bluesky 予約投稿のフロントエンド。snake-sns（torai, X 用）をフォークして
Threads/Bluesky 用に作り替える。GAS バックエンド（別リポジトリ）はすでに機能完成済み。

> 注意: リポジトリ内の `CLAUDE.md` / `AGENT.md` / `README.md` / `docs/` / `branch.diff` 等は
> **snake-sns 由来で内容が古い/無関係**。このメモを正とすること（Phase 8 で整理・削除する）。

## 作業ワークフロー（ユーザー指定）

- 作業ごとに**ブランチを作成**する（main へ直接作業しない）。
- **完了時に自動コミットしない**。作業が一段落したら停止。
- ユーザーが**コードレビュー後にコミットを依頼**する。依頼されるまでコミットしない。
- デフォルトブランチは `main`、リモートリポジトリ作成済み。

## GAS バックエンド（連携先・変更不可の相手）

- 場所: `~/Documents/Devs/GAS/Autopost_Threads`（別リポジトリ、Phase 0〜7 完成・実機検証済み）
- Web アプリ URL（/exec）:
  `https://script.google.com/macros/s/AKfycbxL0YmXIvr5RUnX_B4SCL5SK-qO2XqFs2tGGdUwiR4yaBM9o0Sz-phQU-WDvVCHV365/exec`
- **重要**: 現在の /exec デプロイは Phase 3 時点の古いバージョン。Phase 4〜7 のエンドポイント
  （insights / archive / trigger の一部 / threadsAuth の一部）と `setup_resetProxyAuth` を使うには
  **ユーザーが「デプロイを管理 → 新バージョン」で再デプロイ**する必要がある（URL は不変）。
- **接続前に必須**: 現在 `ownerUid = test-uid-phase1`（テスト用）で初期化済み。本番フロント（実 Firebase uid）
  で初期化し直す前に、GAS エディタで **`setup_resetProxyAuth`** を実行して紐付けを解除すること。
  その後スプレッドシートのメニューまたは `setup_generateSetupCode` で本人確認コードを生成し、
  フロントの接続画面で GAS URL + コードを入力して初期化する。
- GAS 側の運用知見: 時間トリガー（autoPost / updateAllEngagement 等）は clasp push 直後は
  反映ラグがあり、エディタ実行は常に最新。

## Proxy 契約（無改変で流用する）

- `src/utils/gasProxyClient.ts`（汎用 action/target 送信、Firebase ID トークン付与）はそのまま使える。
- `functions/src/handlers/proxy.ts`（HMAC 署名・GAS へ転送）は**無改変で流用**（ADR 0001）。
  署名規約 `timestamp.uid.action.target.stableStringify(body)` は GAS 側 `security.ts` と一致済み。
- RTDB `user-data/{uid}/settings/googleSheetUrl`、Firestore `gasProxySecrets/{uid}` のスキーマもそのまま。

## target マッピング（フロント X → GAS Threads/Bluesky）

| フロント(X)の target | GAS の target | 備考 |
|---|---|---|
| `xauth` | `blueskyAuth` / `threadsAuth` | X は1つ、こちらは2プラットフォームに分岐 |
| `postData` | `postData` | Post スキーマが変更: platform / accountId / mediaUrls(JSON配列) / crossPostGroupId / inReplyTo |
| `postedData` `errorData` | 同名 | Posted はエンゲージメント列(views/likes/replies/reposts/quotes/shares/insightsUpdatedAt)を持つ |
| `trigger` | `trigger` | create/delete(投稿) + ensureEngagement/deleteEngagement + ensure/deleteMaintenance |
| `posted` `errors` | `archive`(action=run, body {source,filename}) | アーカイブ |
| `xMarketing` | 削除 | X 固有分析。ページごと削除 |
| `notificationSettings` | 任意 | Discord 通知。残す/スタブは判断 |
| (新規) | `insights` | GET action=account(platform/accountId), POST action=refresh |

### GAS の主なエンドポイント（action/target）
- POST: `blueskyAuth`(create/update/delete) / `threadsAuth`(create/update/delete/authorizeUrl) /
  `postData`(create/createMultiple/updateInReplyTo/delete) / `trigger`(create/delete/ensureMaintenance/
  deleteMaintenance/ensureEngagement/deleteEngagement) / `insights`(refresh) / `archive`(run) /
  `security`(initialize=無認証)
- GET(action=fetch 等): `blueskyAuth`/`threadsAuth`/`postData`/`postedData`/`errorData`(fetch) /
  `trigger`(status) / `insights`(account, ?platform=&accountId=) / `security`(status=無認証)
- Threads OAuth: `threadsAuth authorizeUrl` で認可 URL を得てユーザーに開かせる → GAS の doGet 無認証
  コールバックがトークン保存（BYO Meta アプリ。ADR 0003）。**リプライには threads_manage_replies が必須**。

## Phase 8（フロント基盤）やること
1. snake-sns 固有の残骸を整理・削除（docs, branch.diff, sns-snake, mail-templates, X固有ページ等）。
2. X 固有ページ（XAccountsList/XMarketing/XPostsList）を削除 or スタブ化。
3. Firebase 設定を新プロジェクトの値に差し替え（`.env.*`, `.firebaserc`, `src/firebase.ts`）。
   ブランディング（アプリ名 torai → 任意）変更。
4. ビルドを通す。Functions/Hosting のデプロイ設定。
5. **疎通確認**: フロントにログイン → GAS URL + setup code で `initializeGasProxyAuth` 成功 →
   署名付きリクエストが GAS に通る（例: `blueskyAuth fetch` が空配列を返す）。

### Phase 8 のユーザー作業（手動）
- 新 Firebase プロジェクト作成 / Blaze 化 / Auth・RTDB・Firestore・Storage 有効化 / 構成値共有。
- GAS の再デプロイ（新バージョン）と `setup_resetProxyAuth` 実行。

## Phase 9（フロント UI）やること
- アカウント管理: Bluesky(ハンドル+アプリパスワード) / Threads(App ID/Secret → 認可 URL 表示 → 認可反映)。
- 投稿作成: 文字数バリデーション(Threads 500字 / Bluesky 300グラフェム)、クロスポスト(複数アカウント選択→
  createMultiple)、スレッド作成(createMultiple → updateInReplyTo)、画像(Firebase Storage アップロード+
  クライアント側リサイズで Bluesky 1MB 対応、mediaUrls に URL)。
- 投稿一覧: ステータス・エラー・投稿 ID・エンゲージメント表示。

## 全体計画・設計判断の出典（GAS リポジトリ側）
`~/Documents/Devs/GAS/Autopost_Threads/` の:
- `docs/development-plan.md`(全 Phase 手順) / `CONTEXT.md`(用語集) / `docs/adr/0001..0003`(設計決定)
- `tools/proxy-test.mjs`(署名付きリクエストの参照実装。フロントの配線検証にも使える)
