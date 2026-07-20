# 運用チェックリスト自動化

このメモは `docs/user-operation-test-checklist.md` と `docs/firebase-state-checklist.md` の項目を、Playwright と Firebase 状態確認に落とし込むための運用入口です。

## 追加した構成

| ファイル | 用途 |
| --- | --- |
| `tests/operation/checklist.ts` | チェックリスト No、テスト層、自動化状態、spec の対応表 |
| `playwright.operation.config.ts` | 運用 E2E 用 Playwright 設定 |
| `tests/operation/specs/auth-and-routing.spec.ts` | 未ログイン状態で実行できる初期 smoke |
| `tests/operation/specs/firebase-state.spec.ts` | `OPERATION_TEST_UID` を使った Firebase 状態確認の土台 |
| `tests/operation/specs/referral-rewards.spec.ts` | 紹介報酬、マイルストーン、100人達成時の lifetime 化を確認 |

## 実行

ローカルの Vite を自動起動して smoke を実行します。

```sh
npm run test:operation
```

デフォルトでは `.env.development` を読み、アプリと Node 側の Firebase 状態確認は `dev-torai` を使います。

既にアプリを起動している場合は、起動済み URL を指定できます。

```sh
OPERATION_SKIP_WEBSERVER=1 OPERATION_BASE_URL=http://127.0.0.1:5173 npm run test:operation
```

preview など別の Vite mode を使う場合:

```sh
OPERATION_ENV_MODE=preview npm run test:operation
```

ブラウザを表示したまま確認したい場合:

```sh
npm run test:operation:headed
```

HTMLレポートを出したい場合:

```sh
OPERATION_HTML_REPORT=1 npm run test:operation
```

## ログイン済みブラウザ状態を使う場合

Googleログイン、Firebase Console、Cloud Console、Mailchimp などは、最初は手動ログイン済み状態を保存して使います。

```sh
npx playwright codegen --save-storage=tests/operation/.auth/operator.json http://127.0.0.1:5173
```

保存後、次のように実行します。

```sh
OPERATION_STORAGE_STATE=tests/operation/.auth/operator.json npm run test:operation
```

`tests/operation/.auth/` にはログイン情報が入るため、コミットしないでください。

## Firebase 状態確認

Firebase client env と対象 UID がある場合、`firebase-state.spec.ts` が Firestore / RTDB の状態を直接確認します。Firebase client env は `OPERATION_ENV_MODE` に対応する `.env.<mode>` から自動で読み込まれます。

```sh
OPERATION_TEST_UID=<uid> npm run test:operation -- tests/operation/specs/firebase-state.spec.ts
```

## 紹介報酬状態確認

紹介報酬の確認は、紹介者 UID と、必要に応じて紹介されたユーザー UID を指定して実行します。

```sh
OPERATION_REFERRAL_REFERRER_UID=<referrer_uid> \
OPERATION_REFERRAL_REFERRED_UID=<referred_uid> \
npm run test:operation -- tests/operation/specs/referral-rewards.spec.ts
```

100人達成時の Stripe 停止まで確認する場合は、100人達成済みの紹介者 UID を指定します。Stripe API 上の Subscription 状態も確認したい場合だけ、停止済みの Subscription ID と Stripe secret key を追加します。

```sh
OPERATION_REFERRAL_REFERRER_UID=<lifetime_referrer_uid> \
OPERATION_REFERRAL_STRIPE_SUBSCRIPTION_ID=<canceled_subscription_id> \
OPERATION_STRIPE_SECRET_KEY=<sk_test_or_live_key> \
npm run test:operation -- tests/operation/specs/referral-rewards.spec.ts
```

Stripe secret key を指定しない場合でも、Firestore の `appPlanId:lifetime`、`subscriptionStatus:active`、Stripe契約ID削除、報酬履歴、永久無料化メールキューは確認されます。

## 自動化の考え方

| 層 | 方針 |
| --- | --- |
| `app-e2e` | アプリ画面の表示、遷移、入力、モーダル、保護ルートを Playwright で確認 |
| `firebase-state` | Firestore / RTDB / Auth の期待状態を API で確認 |
| `external-console` | Stripe、Firebase Console、Cloud Console、Mailchimp は補助確認に留める |
| `operator-assisted` | Google認可、Apps Scriptメニュー、メール目視などは人間の確認待ちを残す |
| `manual` | X実投稿など、外部副作用が大きい項目は手動または専用検証環境のみ |

まずは `tests/operation/checklist.ts` の `candidate` を1つずつ `automated` に変えていく形で拡張します。
