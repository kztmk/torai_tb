# Firebase状態確認チェック表

このチェック表は、ユーザー登録から規約同意、サブスクリプション契約、GAS URL登録、本人確認までの各段階で、Firebase Realtime Database と Firestore が正常な状態になっているか確認するためのものです。

`{uid}` は対象ユーザーの Firebase Authentication UID に置き換えて確認してください。

## 0. 主な保存先

| 種別 | パス | 用途 |
| --- | --- | --- |
| Firestore | `users/{uid}` | ユーザー基本情報、規約同意、サブスクリプション、銀行振込、Stripe情報 |
| Firestore | `gasProxySecrets/{uid}` | GAS proxy署名用secretとGAS URL |
| Firestore | `discounts/firstMonthDiscount` | 初回決済割引額と銀行振込手数料の運用設定 |
| Firestore | `supportMessageThreads/{uid}` | ユーザーと管理者の個別メッセージスレッド |
| Firestore | `supportMessageThreads/{uid}/messages/{messageId}` | 個別メッセージ本文、送受信日時、既読状態 |
| Firestore | `broadcastMessages/{messageId}` | 管理者から全ユーザーへのアプリ内一斉メッセージ |
| Firestore | `referralCodes/{code}` | 紹介コードから紹介者UIDを引くための参照 |
| Firestore | `referralSummaries/{uid}` | 紹介者ごとの報酬集計 |
| Firestore | `referralRewards/{rewardId}` | 紹介報酬の獲得・付与状態 |
| Firestore | `referralQualifications/{referredUid}` | 紹介されたユーザーの初回契約報酬確定記録 |
| Firestore | `referralMonthlyGrantUsage/{uid_yyyy_mm}` | 月ごとの紹介報酬付与上限管理 |
| Firestore | `freeToolUnlockKeys/{keyHash}` | フリーツール高機能解除キーのハッシュ、対象UID、10日キャッシュ状態 |
| Firestore | `freeToolUnlockKeyUsers/{uid}` | ユーザーごとの現在有効な高機能解除キーのハッシュ |
| Storage | `message-attachments/{uid}/...` | メッセージ添付画像 |
| Realtime Database | `user-data/{uid}/profile` | プロフィール画像、背景画像、ロール |
| Realtime Database | `user-data/{uid}/settings` | APIキー、GAS URL、GAS本人確認完了日時 |

### Firestore `discounts/firstMonthDiscount`

Firebase Console から編集できます。未設定の場合はコード内のデフォルト値が使われます。

| フィールド | 正常値 | 備考 |
| --- | --- | --- |
| `amountByPlanId.basic_monthly` | `780` | 1ヶ月プランの初回決済割引額 |
| `amountByPlanId.half_yearly` | `1000` | 6ヶ月プランの初回決済割引額 |
| `amountByPlanId.yearly` | `2000` | 1年プランの初回決済割引額 |
| `bankTransferFeeAmount` | `880` | 銀行振込の事務手数料。初回割引対象時はこの金額が免除額になる |

## 0.1. クライアントから直接変更できない重要フィールド

以下の Firestore `users/{uid}` フィールドは、Firestore Security Rules によりユーザー自身のクライアントから直接更新できません。変更は Cloud Functions、Stripe Webhook、管理者処理、スケジュール処理から行われる状態が正常です。

| フィールド | 更新元 | 備考 |
| --- | --- | --- |
| `isAdmin` | Firebase Console または管理者運用 | 通常ユーザーは未設定または `false` |
| `subscriptionStatus` | Stripe Webhook、銀行振込承認、スケジュール処理 | クライアントから `active` 等へ変更不可 |
| `appPlanId` / `planId` | Stripe Webhook、銀行振込承認、管理処理 | 契約プラン |
| `currentPeriodStart` / `currentPeriodEnd` | Stripe Webhook、銀行振込承認、管理処理 | 契約期間 |
| `cancelAtPeriodEnd` / `canceledAt` / `endedAt` | Stripe Webhook、スケジュール処理 | 解約・終了状態 |
| `stripeCustomerId` / `stripeSubscriptionId` / `stripePriceId` | Stripe関連Functions / Webhook | Stripe連携情報 |
| `pendingPlanChange` | 管理処理またはStripe関連処理 | プラン変更予約 |
| `bankPaymentInfo` | 銀行振込Functions / スケジュール処理 | 銀行振込申込・承認・期限切れ |
| `firstMonthDiscount` | `acceptTerms` Function、Stripe / 銀行振込Functions | 初回割引状態 |
| `referral` / `referralCredit` | 紹介Functions、Stripe Webhook、銀行振込Functions | 紹介元、報酬、銀行振込クレジット |

初回ドキュメント作成時のみ、`subscriptionStatus: "inactive"`、`bankPaymentInfo: null`、`isAdmin: false`、日本語を選択したGoogle新規ユーザーの `firstMonthDiscount.status: "pending_terms"` の安全な初期値が許可されます。日本語以外の新規ユーザーには `firstMonthDiscount` を作成しません。

管理者画面 `/admin/subscriptions` は、`getAdminSubscriptionDashboard` Function で Firestore `users/{uid}` と Stripe の現在値を照合する参照専用画面です。画面表示だけでは `users/{uid}` の契約フィールドは変更されません。契約前ファネルは `termsAccepted !== true` を `regist`、`termsAccepted === true` かつ未契約を `termaccepted`、有効契約を `subscribed` として集計します。

## 0.2. 紹介プログラム

紹介コード登録、報酬確定、報酬付与は日本語版だけで利用します。Callable Functions と Stripe Webhook / 銀行振込承認処理は、紹介者と紹介されたユーザーが日本語ユーザーであり、Stripe契約の場合はJPYであることを確認します。日本語以外のユーザーやUSD契約では報酬を作成しません。ユーザー自身のクライアントから `users/{uid}.referral` と `users/{uid}.referralCredit` を直接更新することは許可しません。

| 保存先 | フィールド | 正常値 | 備考 |
| --- | --- | --- | --- |
| Firestore `referralCodes/{code}` | `uid` | 紹介者UID | `getMyReferralDashboard` で作成 |
| Firestore `users/{referredUid}` | `referral.referredByUid` | 紹介者UID | 紹介リンクから登録後に `registerReferralForCurrentUser` が設定 |
| Firestore `users/{referredUid}` | `referral.termsAcceptedAt` | Timestamp | 利用規約同意時 |
| Firestore `referralQualifications/{referredUid}` | `referrerUid` | 紹介者UID | 初回決済完了または銀行振込承認時に一度だけ作成 |
| Firestore `referralRewards/{rewardId}` | `status` | `earned` / `partially_granted` / `granted` | 月3ヶ月分まで付与 |
| Firestore `referralSummaries/{uid}` | `earnedAmount` / `grantedAmount` / `pendingGrantAmount` | 数値 | 紹介者ダッシュボードの集計 |
| Firestore `referralSummaries/{uid}` / `users/{uid}.referral` | `lifetimeDiscountPercent` | `50` / `100` | 50人紹介で永久50%オフ、100人紹介で次回更新から永遠無料 |
| Firestore `users/{uid}.referral` | `lifetimeFreeStripeSubscriptionCanceledAt` | Timestamp | 100人紹介でStripe契約を停止した日時 |
| Firestore `users/{uid}` | `referralCredit.bankAvailableAmount` | 数値 | Stripe顧客がない場合や銀行振込向けの利用可能クレジット |
| Callable `getMyReferralDashboard` | `referredUsers` | 氏名・メールアドレスを含まない配列 | 紹介履歴には個人情報を返さない |
| Stripe Customer balance | customer balance transaction | マイナス金額 | Stripe顧客がある紹介者への報酬付与 |
| Stripe Subscription discount | coupon | `torai_referral_lifetime_50_percent` | 50人マイルストーンの永続割引 |
| Stripe Subscription | canceled subscription | 解除済み | 100人マイルストーンでは今後課金が発生しないようにSubscriptionを停止。Customer balanceの紹介クレジットはStripe Customerに残っていてもよい |

## 0.3. フリーツール高機能解除キー

高機能解除キーは `issueFreeToolUnlockKey` Callable Function で発行します。キー本体はFirebaseに保存せず、SHA-256ハッシュを `freeToolUnlockKeys/{keyHash}` のドキュメントIDとして保存します。再発行すると以前のキーは `revoked:true` になり無効化されます。`freeToolUnlockKeys/{keyHash}` はクライアントから読み書きできません。`freeToolUnlockKeyUsers/{uid}` は発行済み表示のため本人のみ読み取り可能ですが、書き込みは許可しません。

通常版フリーツールは `checkFreeToolSubscriptionStatus` HTTP Function にPOSTでキーを送信し、`subscription_status` として `active` または `inactive` のみを受け取ります。Firestore `users/{uid}` の読み取り負荷を抑えるため、同じキーのサブスクリプション状態は10日間キャッシュされます。`users/{uid}.subscriptionStatus` または `users/{uid}.appPlanId` が変化した場合は、`invalidateFreeToolCacheOnUserChange` がキャッシュを破棄し、次回問い合わせで即再判定されます。`users/{uid}` が削除された場合は、同トリガーで `freeToolUnlockKeyUsers/{uid}` と対象UIDに紐づくすべての `freeToolUnlockKeys/{keyHash}` を削除します。

| 保存先 | フィールド | 正常値 | 備考 |
| --- | --- | --- | --- |
| Firestore `freeToolUnlockKeys/{keyHash}` | `uid` | Firebase Authentication UID | キー所有者 |
| Firestore `freeToolUnlockKeys/{keyHash}` | `revoked` | `false` | 再発行された古いキーは `true` |
| Firestore `freeToolUnlockKeys/{keyHash}` | `lastStatus` | `active` / `inactive` | 外部ツールへ返した直近の状態 |
| Firestore `freeToolUnlockKeys/{keyHash}` | `lastCheckedAt` / `nextRefreshAt` | Timestamp または `null` | 10日キャッシュの基準。サブスク状態変更時は `null` |
| Firestore `freeToolUnlockKeyUsers/{uid}` | `keyHash` | SHA-256ハッシュ | 現在有効なキー |

## 0.4. メッセージ機能

メッセージは Callable Functions 経由で作成・既読更新されます。Firestore クライアントからの直接書き込みは許可しません。

### Firestore `supportMessageThreads/{uid}`

| フィールド | 正常値 | 備考 |
| --- | --- | --- |
| `userUid` | Firebase Authentication UID | スレッド対象ユーザー |
| `userEmail` | ユーザーのメールアドレス | 管理者一覧とメール通知に使用 |
| `userDisplayName` | 表示名またはメール | 管理者一覧に使用 |
| `latestMessageText` | 最新メッセージ本文 | 管理者の最新一覧に表示 |
| `latestMessageAt` | Timestamp | 最新送信日時 |
| `latestSenderRole` | `user` / `admin` | 最新送信者 |
| `userUnreadCount` | 0以上の数値 | ユーザー未読件数 |
| `adminUnreadCount` | 0以上の数値 | 管理者未読件数 |
| `hasImportant` | `true` / `false` または未設定 | 重要メッセージを含む場合 |

### Firestore `supportMessageThreads/{uid}/messages/{messageId}`

| フィールド | 正常値 | 備考 |
| --- | --- | --- |
| `body` | メッセージ本文 | 5000文字以内 |
| `senderUid` | 送信者UID | 管理者送信時は管理者UID |
| `senderRole` | `user` / `admin` | 送信者ロール |
| `recipientUid` | 宛先UIDまたは `admin` | 受信者 |
| `recipientRole` | `user` / `admin` | 受信者ロール |
| `createdAt` | Timestamp | 送信日時 |
| `readAt` | Timestamp または `null` | 受信者の既読日時。`null` は未読 |
| `readByUid` | 既読にしたUID または `null` | 既読処理者 |
| `isImportant` | `true` / `false` | 重要フラグ |
| `attachments` | 添付画像情報の配列 | `name`、`url`、`contentType`、`size`、`storagePath` |

通常表示では直近60日以内の個別メッセージのみを取得します。60日より前のメッセージは「過去メッセージを見る」操作時に取得します。

### Firestore `broadcastMessages/{messageId}`

| フィールド | 正常値 | 備考 |
| --- | --- | --- |
| `subject` | 件名 | 管理者が入力 |
| `body` | 本文 | アプリ内表示用。メール送信なし |
| `senderUid` | 管理者UID | 作成者 |
| `createdAt` | Timestamp | 作成日時 |

一斉メッセージのユーザー既読は `broadcastMessages/{messageId}/reads/{uid}` に `readAt` と `uid` を保存します。全ユーザーへのメール配信は Mailchimp で行うため、この機能ではメールを作成しません。

個別メッセージで管理者からユーザーへ送信した場合のみ、Firestore `mail` に `template.name: "adminDirectMessageNotification"` のメール送信ドキュメントが作成されます。

管理者メッセージ一覧は `adminUnreadCount > 0` のスレッドのみを表示します。表示件数が0件の場合は管理者未読なしです。管理者側の検索は、この未読一覧内のユーザー名、メール、UID、最新本文を対象にします。

Storage `message-attachments/{uid}/...` は、対象ユーザー本人と管理者のみ読み取り可能です。書き込みは画像のみ、10MB未満に制限します。

## 1. Googleアカウント新規登録直後

### Firestore `users/{uid}`

| フィールド | 正常値 | 備考 |
| --- | --- | --- |
| `email` | Googleアカウントのメールアドレス | Firebase Authのメールと一致 |
| `displayName` | Googleアカウントの表示名または `null` | Google表示名がコピーされる |
| `termsAccepted` | `false` | 規約同意前 |
| `createdAt` | Timestamp | 登録日時 |
| `updatedAt` | Timestamp | 登録日時付近 |
| `subscriptionStatus` | `inactive` | 契約前 |
| `bankPaymentInfo` | `null` | 銀行振込申込前 |
| `welcomeEmailSentAt` | Timestamp | ようこそメール送信済み |
| `welcomeEmailError` | 未設定または削除済み | エラーなし |
| `applyMailchimpTag` | `["torai_regist"]` | Preview環境では `["torai_preview_regist"]` |
| `isAdmin` | 未設定または `false` | 通常ユーザーは管理者ではない |

### Realtime Database `user-data/{uid}/profile`

| フィールド | 正常値 | 備考 |
| --- | --- | --- |
| `role` | 空文字 | 初期値 |
| `avatarUrl` | デフォルト画像URLまたはGoogle画像URL | 登録方法により変わる |
| `backgroundImageUrl` | デフォルト背景画像URL | 初期値 |

### Realtime Database `user-data/{uid}/settings`

| フィールド | 正常値 | 備考 |
| --- | --- | --- |
| `chatGptApiKey` | 空文字 | 初期値 |
| `geminiApiKey` | 空文字 | 初期値 |
| `anthropicApiKey` | 空文字 | 初期値 |
| `rakutenAppId` | 空文字 | 初期値 |
| `amazonAccessKey` | 空文字 | 初期値 |
| `amazonSecretKey` | 空文字 | 初期値 |
| `dmmAffiliateId` | 空文字 | 初期値 |
| `dmmApiId` | 空文字 | 初期値 |
| `googleSheetUrl` | 空文字 | GAS未登録 |
| `gasProxyInitializedAt` | 空文字 | 本人確認未完了 |
| `discordPostResultNotificationEnabled` | `false` または未設定 | Discord通知OFF |
| `discordWebhookUrlSaved` | `false` または未設定 | Discord Webhook URL未保存 |

## 2. ようこそメール・メール確認後

| 保存先 | フィールド | 正常値 | 備考 |
| --- | --- | --- | --- |
| Firebase Auth | `emailVerified` | `true` | メール確認リンク完了後 |
| Firestore `mail` | `template.name` | `welcomeEmailVerification_ja` | 新規登録時に作成されるメール送信ドキュメント |
| Firestore `mail` | `template.data.verificationLink` | 空でないURL | メール確認リンク |
| Firestore `users/{uid}` | `welcomeEmailSentAt` | Timestamp | ようこそメール送信済み |
| Firestore `users/{uid}` | `welcomeEmailError` | 未設定または削除済み | エラーなし |

Firestore上の `termsAccepted` や `subscriptionStatus` は、メール確認だけでは通常変わりません。

## 3. 規約同意後

規約同意は `acceptTerms` Callable Function で処理されます。クライアントは Firestore `users/{uid}` を直接更新せず、Function 側のサーバー時刻で初回割引の期限を設定します。

### Firestore `users/{uid}`

| フィールド | 正常値 | 備考 |
| --- | --- | --- |
| `termsAccepted` | `true` | 規約同意完了 |
| `isAdmin` | `false` | 通常ユーザー |
| `applyMailchimpTag` | `["torai_agreed"]` | Preview環境では `["torai_preview_agreed"]` |
| `firstMonthDiscount.status` | `eligible` または未設定 | Google新規登録など初回割引対象の場合のみ |
| `firstMonthDiscount.eligibleAt` | Timestamp | 初回割引対象の場合 |
| `firstMonthDiscount.expiresAt` | Timestamp | 初回割引対象の場合。Function側で生成される |

### 変わらないことを確認

| 保存先 | フィールド | 正常値 |
| --- | --- | --- |
| Firestore `users/{uid}` | `subscriptionStatus` | `inactive` |
| Firestore `users/{uid}` | `bankPaymentInfo` | `null` |
| RTDB `user-data/{uid}/settings` | `googleSheetUrl` | 空文字、または未登録状態 |

## 4. サブスクリプション未契約状態

| 保存先 | フィールド | 正常値 | 備考 |
| --- | --- | --- | --- |
| Firestore `users/{uid}` | `subscriptionStatus` | `inactive` | 保護ページへ入れない |
| Firestore `users/{uid}` | `appPlanId` | 未設定または空 | プラン未契約 |
| Firestore `users/{uid}` | `stripeCustomerId` | 未設定 | Stripe未利用 |
| Firestore `users/{uid}` | `stripeSubscriptionId` | 未設定 | Stripe未契約 |
| Firestore `users/{uid}` | `currentPeriodStart` | 未設定 | 契約期間なし |
| Firestore `users/{uid}` | `currentPeriodEnd` | 未設定 | 契約期間なし |
| Firestore `users/{uid}` | `bankPaymentInfo` | `null` または未設定 | 銀行振込未申込 |

## 5. クレジットカード申込開始後

Stripe Checkout作成直後、Webhook完了前の状態です。`createStripeCheckoutSession` は `users/{uid}.preferredLanguage` をサーバー側で確認し、日本語では既存JPY Price ID、日本語以外では `STRIPE_PRICE_ID_BASIC_MONTHLY_USD` のUSD月額Price IDだけを選択します。`stripeCustomerId` や、日本語の割引対象者に限り `firstMonthDiscount.promotionCodeId` 等を更新します。

| 保存先 | フィールド | 正常値 | 備考 |
| --- | --- | --- | --- |
| Firestore `users/{uid}` | `stripeCustomerId` | Stripe customer ID | 既存/新規customerが保存される |
| Firestore `users/{uid}` | `subscriptionStatus` | `inactive` のままの場合あり | Checkout完了前 |
| Firestore `users/{uid}` | `stripeSubscriptionId` | 未設定の場合あり | Checkout完了後に保存 |
| Firestore `users/{uid}` | `firstMonthDiscount.promotionCodeId` | 文字列の場合あり | 日本語のJPY割引対象時のみ |
| Firestore `users/{uid}` | `firstMonthDiscount.appliedPlanId` | 選択planIdの場合あり | 日本語のJPY割引対象時のみ |

## 6. クレジットカード契約完了後

Stripe Checkout成功後、`checkout.session.completed` または `customer.subscription.updated` のWebhook反映後に確認します。

### Firestore `users/{uid}`

| フィールド | 正常値 | 備考 |
| --- | --- | --- |
| `subscriptionStatus` | `active` または `trialing` | 有効契約 |
| `stripeCustomerId` | `cus_...` | Stripe顧客ID |
| `stripeSubscriptionId` | `sub_...` | StripeサブスクリプションID |
| `stripePriceId` | `price_...` | 日本語は既存JPY Price ID、日本語以外はUSD月額Price ID |
| `appPlanId` | `basic_monthly` / `half_yearly` / `yearly` 等 | アプリ内プランID |
| `currentPeriodStart` | Timestamp | 契約期間開始 |
| `currentPeriodEnd` | Timestamp | 契約期間終了 |
| `cancelAtPeriodEnd` | `false` または未設定 | 解約予約なし |
| `canceledAt` | 未設定 | 解約予約なし |
| `applyMailchimpTag` | `["torai_subscribed"]` | Preview環境では `["torai_preview_subscribed"]` |
| `firstMonthDiscount.status` | `redeemed` または未設定 | 初回割引を使った場合 |
| `firstMonthDiscount.checkoutSessionId` | `cs_...` | 初回割引を使った場合 |
| `firstMonthDiscount.redeemedAt` | Timestamp | 初回割引を使った場合 |

### Realtime Database

クレジットカード契約だけでは、通常 `user-data/{uid}/settings` は変わりません。

## 7. クレジットカード解約予約後

Stripe Customer Portalで期間末キャンセルを設定した後に確認します。

| 保存先 | フィールド | 正常値 | 備考 |
| --- | --- | --- | --- |
| Firestore `users/{uid}` | `subscriptionStatus` | `active` または `trialing` | 期間終了までは有効 |
| Firestore `users/{uid}` | `cancelAtPeriodEnd` | `true` | 期間末解約予約 |
| Firestore `users/{uid}` | `canceledAt` | Timestamp | 解約予約日時 |
| Firestore `users/{uid}` | `currentPeriodEnd` | Timestamp | この日時までは利用可能 |

## 8. クレジットカード解約完了後

期間終了またはStripeの削除イベント反映後に確認します。

| 保存先 | フィールド | 正常値 | 備考 |
| --- | --- | --- | --- |
| Firestore `users/{uid}` | `subscriptionStatus` | `canceled` | 利用制限対象 |
| Firestore `users/{uid}` | `stripeSubscriptionId` | 削除または未設定 | サブスクID削除 |
| Firestore `users/{uid}` | `stripePriceId` | 削除または未設定 | Price ID削除 |
| Firestore `users/{uid}` | `currentPeriodStart` | `null` または未設定 | 契約期間クリア |
| Firestore `users/{uid}` | `currentPeriodEnd` | `null` または未設定 | 契約期間クリア |
| Firestore `users/{uid}` | `cancelAtPeriodEnd` | 削除または未設定 | 解約予約フラグクリア |

## 9. 銀行振込申込後

銀行振込の申込ボタン押下後に確認します。`bankPaymentInfo` は `requestBankTransferPayment` Function が更新します。

### Firestore `users/{uid}`

| フィールド | 正常値 | 備考 |
| --- | --- | --- |
| `subscriptionStatus` | `inactive` のまま | 入金承認前 |
| `bankPaymentInfo.status` | `payment_requested` | 支払い情報送信済み・入金待ち |
| `bankPaymentInfo.planId` | `half_yearly_bank` 等 | 申込プラン |
| `bankPaymentInfo.planName` | プラン名 | 例: 6ヶ月プラン |
| `bankPaymentInfo.amount` | 合計金額 | 互換用 |
| `bankPaymentInfo.baseAmount` | 基本金額 | 例: 6800 |
| `bankPaymentInfo.feeAmount` | 手数料 | 例: 880 |
| `bankPaymentInfo.discountAmount` | 割引額 | 初回手数料免除なら 880 |
| `bankPaymentInfo.totalAmount` | 請求合計 | 例: 7680 または 6800 |
| `bankPaymentInfo.firstMonthDiscountApplied` | `true` / `false` | 初回割引適用有無 |
| `bankPaymentInfo.currency` | `円` または `JPY` | 実装値に合わせる |
| `bankPaymentInfo.requestedAt` | Timestamp | 申込日時 |
| `bankPaymentInfo.paymentDeadline` | Timestamp | 支払期限 |
| `firstMonthDiscount.status` | `redeemed` または未設定 | 初回割引を使った場合 |
| `firstMonthDiscount.checkoutSessionId` | `bank_transfer` | 初回割引を使った場合 |
| `applyMailchimpTag` | `["torai_bank_requested"]` | Preview環境では `["torai_preview_bank_requested"]` |
| `updatedAt` | Timestamp | 申込日時付近 |

## 10. 銀行振込完了確認申請後

ユーザーが振込名義を入力し、振込完了確認を申請した後に確認します。

| 保存先 | フィールド | 正常値 | 備考 |
| --- | --- | --- | --- |
| Firestore `users/{uid}` | `bankPaymentInfo.status` | `pending_confirmation` | 管理者確認待ち |
| Firestore `users/{uid}` | `bankPaymentInfo.transferNameReported` | ユーザー入力の振込名義 | 空でない |
| Firestore `users/{uid}` | `bankPaymentInfo.confirmationRequestedAt` | Timestamp | 申請日時 |
| Firestore `users/{uid}` | `subscriptionStatus` | `inactive` のまま | 承認前 |
| Firestore `users/{uid}` | `applyMailchimpTag` | `["torai_bank_pending_confirmation"]` | Preview環境では `["torai_preview_bank_pending_confirmation"]` |

## 10.1. 銀行振込確認依頼差し戻し後

管理者が振込確認依頼を差し戻した後に確認します。ユーザーには振込名義入力画面で差し戻し理由が表示され、メール通知と個別メッセージでも通知されます。

| 保存先 | フィールド | 正常値 | 備考 |
| --- | --- | --- | --- |
| Firestore `users/{uid}` | `bankPaymentInfo.status` | `payment_requested` または `renewal_requested` | 再度確認依頼できる状態 |
| Firestore `users/{uid}` | `bankPaymentInfo.rejectionReason` | 管理者入力の理由 | 画面表示とメール通知に使用 |
| Firestore `users/{uid}` | `bankPaymentInfo.rejectedAt` | Timestamp | 差し戻し日時 |
| Firestore `users/{uid}` | `bankPaymentInfo.rejectedRequestId` | `bankTransferRequests/{requestId}` | 差し戻し元 |
| Firestore `users/{uid}` | `bankPaymentInfo.transferNameReported` | 未設定 | 再入力させるため削除 |
| Firestore `bankTransferRequests/{requestId}` | `status` | `reverted_by_admin` | 差し戻し済み |
| Firestore `bankTransferRequests/{requestId}` | `rejectionReason` | 管理者入力の理由 | 監査用 |
| Firestore `mail` | `template.name` | `bankTransferRejectionNotification` | 差し戻し通知メール |
| Firestore `mail` | `template.data.rejectionReason` | 管理者入力の理由 | メール本文で使用 |
| Firestore `supportMessageThreads/{uid}/messages/{messageId}` | `body` | 差し戻し理由を含む本文 | アプリ内メッセージ通知 |
| Firestore `supportMessageThreads/{uid}/messages/{messageId}` | `isImportant` | `true` | 差し戻し通知は重要扱い |

## 11. 銀行振込承認後

管理者が入金確認を承認した後に確認します。

### Firestore `users/{uid}`

| フィールド | 正常値 | 備考 |
| --- | --- | --- |
| `subscriptionStatus` | `active` | 利用可能 |
| `appPlanId` | 承認された銀行振込プランID | 例: `half_yearly_bank` |
| `currentPeriodStart` | Timestamp | 契約開始日 |
| `currentPeriodEnd` | Timestamp | 契約終了日 |
| `cancelAtPeriodEnd` | `false` | 銀行振込は自動更新ではないが有効期間中 |
| `canceledAt` | 削除または未設定 | キャンセルなし |
| `endedAt` | 削除または未設定 | 期限終了前 |
| `bankPaymentInfo.status` | `active` | 承認済み |
| `bankPaymentInfo.confirmedAt` | Timestamp | 承認日時 |
| `bankPaymentInfo.planActivatedAt` | Timestamp | プラン有効化日時 |
| `bankPaymentInfo.planId` | 申込プランID | 引き継がれる |
| `bankPaymentInfo.amount` | 請求金額 | 引き継がれる |
| `bankPaymentInfo.currency` | 通貨 | 引き継がれる |
| `applyMailchimpTag` | `["torai_subscribed_bank"]` | Preview環境では `["torai_preview_subscribed_bank"]` |
| `updatedAt` | Timestamp | 承認日時付近 |

## 12. 銀行振込キャンセル後

支払前の銀行振込申込をユーザーがキャンセルした後に確認します。

| 保存先 | フィールド | 正常値 | 備考 |
| --- | --- | --- | --- |
| Firestore `users/{uid}` | `bankPaymentInfo.status` | `payment_canceled` | キャンセル済み |
| Firestore `users/{uid}` | `bankPaymentInfo.canceledAt` | Timestamp | キャンセル日時 |
| Firestore `users/{uid}` | `subscriptionStatus` | `inactive` | 未契約 |
| Firestore `users/{uid}` | `firstMonthDiscount.status` | `eligible` に戻る場合あり | 初回割引を銀行振込に使ってキャンセルした場合 |
| Firestore `users/{uid}` | `firstMonthDiscount.amountOff` / `appliedPlanId` | 削除または未設定 | 初回割引を戻した場合 |
| Firestore `users/{uid}` | `firstMonthDiscount.checkoutSessionId` / `redeemedAt` | 削除または未設定 | 初回割引を戻した場合 |

## 13. 銀行振込期限切れ・契約終了後

スケジュール関数または管理処理により期限切れになった後に確認します。

| 保存先 | フィールド | 正常値 | 備考 |
| --- | --- | --- | --- |
| Firestore `users/{uid}` | `subscriptionStatus` | `expired` または `inactive` | 実行された処理により異なる |
| Firestore `users/{uid}` | `bankPaymentInfo.status` | `payment_expired` または期限切れ系 | 支払期限切れ |
| Firestore `users/{uid}` | `applyMailchimpTag` | `["torai_cancelled"]` | Preview環境では `["torai_preview_cancelled"]` |
| Firestore `users/{uid}` | `endedAt` | Timestampの場合あり | 契約終了日時 |
| Firestore `users/{uid}` | `updatedAt` | Timestamp | 処理日時 |

## 14. GAS URL登録・本人確認前

プロフィール/API設定でGAS URLだけを入力し、本人確認コードを保存していない状態は正常完了ではありません。

| 保存先 | フィールド | 正常値 | 備考 |
| --- | --- | --- | --- |
| RTDB `user-data/{uid}/settings` | `googleSheetUrl` | 空文字または旧URL | URL変更時は本人確認コードなしでは保存されない |
| RTDB `user-data/{uid}/settings` | `gasProxyInitializedAt` | 空文字または旧初期化日時 | 新URLでは初期化未完了 |
| Firestore `gasProxySecrets/{uid}` | ドキュメント | ない、または旧URL用 | 新URLのsecretはまだない |

`googleSheetUrl` と `gasProxyInitializedAt` はクライアントから直接変更できません。初期空値以外の登録・変更は `initializeGasProxyAuth` Function が本人確認コードを検証したうえで Admin SDK から更新します。

## 15. GAS URL登録・本人確認完了後

GAS本人確認コードを入力して保存し、`initializeGasProxyAuth` が成功した後に確認します。

### Realtime Database `user-data/{uid}/settings`

| フィールド | 正常値 | 備考 |
| --- | --- | --- |
| `googleSheetUrl` | GAS Webアプリ `/exec` URL | 虎威に入力したURL |
| `gasProxyInitializedAt` | ISO文字列 | GASが返した初期化日時 |
| `chatGptApiKey` | 既存値維持 | GAS保存で消えないこと |
| `geminiApiKey` | 既存値維持 | GAS保存で消えないこと |
| `anthropicApiKey` | 既存値維持 | GAS保存で消えないこと |
| `discordPostResultNotificationEnabled` | 既存値維持 | Discord Webhook URLは保存しない |
| `discordWebhookUrlSaved` | 既存値維持 | 保存済み有無のみ、URL本体は保存しない |

### Firestore `gasProxySecrets/{uid}`

| フィールド | 正常値 | 備考 |
| --- | --- | --- |
| `gasProxySecret` | 空でない文字列 | ブラウザには返さない |
| `googleSheetUrl` | GAS Webアプリ `/exec` URL | RTDBのURLと一致 |
| `initializedAt` | ISO文字列 | RTDBの `gasProxyInitializedAt` と同等 |
| `updatedAt` | Timestamp | 保存日時 |

### Firestore `users/{uid}`

GAS本人確認では通常 `users/{uid}` は更新されません。サブスクリプションや規約同意状態が変わっていないことを確認してください。

## 16. GAS URL変更後

既に本人確認済みのユーザーがGAS URLを変更した場合に確認します。

| 保存先 | フィールド | 正常値 | 備考 |
| --- | --- | --- | --- |
| RTDB `user-data/{uid}/settings` | `googleSheetUrl` | 新しいGAS WebアプリURL | 本人確認コード付き保存後 |
| RTDB `user-data/{uid}/settings` | `gasProxyInitializedAt` | 新しいISO文字列 | 再初期化日時 |
| Firestore `gasProxySecrets/{uid}` | `googleSheetUrl` | 新しいGAS WebアプリURL | RTDBと一致 |
| Firestore `gasProxySecrets/{uid}` | `gasProxySecret` | 新しいsecret | 旧secretから更新 |
| Firestore `gasProxySecrets/{uid}` | `updatedAt` | 新しいTimestamp | 再保存日時 |

## 17. GAS URL解除後

既に本人確認済みのユーザーがGAS URLを空にして保存した場合に確認します。解除は `clearGasProxyAuth` Function が Admin SDK で実行します。

| 保存先 | フィールド | 正常値 | 備考 |
| --- | --- | --- | --- |
| RTDB `user-data/{uid}/settings` | `googleSheetUrl` | 空文字 | GAS未登録状態へ戻る |
| RTDB `user-data/{uid}/settings` | `gasProxyInitializedAt` | 空文字 | 本人確認未完了状態へ戻る |
| Firestore `gasProxySecrets/{uid}` | ドキュメントが存在しない | 署名用secret削除済み |

## 18. Xアカウント登録後

Xアカウント情報はFirebaseには保存されず、GAS側の `PropertiesService` に保存されます。
GASの一覧取得では、保存済みのX API認証情報はブラウザへ返さず、`accountId` と `note` のみを返します。

| 保存先 | フィールド | 正常値 | 備考 |
| --- | --- | --- | --- |
| Firestore `users/{uid}` | サブスクリプション関連 | 変化なし | Xアカウント登録では更新しない |
| RTDB `user-data/{uid}/settings` | `googleSheetUrl` | 変化なし | 既存URL維持 |
| Firestore `gasProxySecrets/{uid}` | `gasProxySecret` | 変化なし | 署名用secret維持 |
| GAS Properties | `xauth_{accountId}` | JSON文字列 | X API認証情報 |
| GAS `xauth fetch` レスポンス | `accountId`, `note` | 文字列 | X API認証情報は返さない |

## 18.1. Xアカウント削除後

Xアカウント削除時は、対象アカウントの投稿データも削除し、投稿予定の有無に関わらずゾンビデータを残しません。

| 保存先 | フィールド | 正常値 | 備考 |
| --- | --- | --- | --- |
| GAS Properties | `xauth_{accountId}` | 存在しない | X API認証情報削除済み |
| Google Spreadsheet `Posts` | `postTo` が対象 `accountId` の投稿行 | 存在しない | 投稿予定の有無に関わらず削除済み |

## 19. 投稿作成・予約後

投稿データはFirebaseには保存されず、GAS経由でGoogle Spreadsheetに保存されます。

| 保存先 | フィールド | 正常値 | 備考 |
| --- | --- | --- | --- |
| Firestore `users/{uid}` | サブスクリプション関連 | 変化なし | 投稿作成では更新しない |
| RTDB `user-data/{uid}/settings` | `googleSheetUrl` | 変化なし | 既存URL維持 |
| Google Spreadsheet `Posts` | 投稿行 | 作成・更新される | Firebaseではなくシート側 |

## 20. 自動投稿成功後

自動投稿結果はFirebaseではなくGoogle Spreadsheet側で確認します。

| 保存先 | フィールド | 正常値 | 備考 |
| --- | --- | --- | --- |
| Google Spreadsheet `Posts` | 対象投稿行 | `Posted`へ移動済み | 投稿後 |
| Google Spreadsheet `Posted` | 投稿行 | `postedAt`、`postId` が入る | X投稿成功 |
| Google Spreadsheet `Errors` | 対象エラー | なし | 成功時 |
| GAS Properties | `discord_notification_enabled` | `true` の場合のみ通知対象 | Firebaseには保存しない |
| GAS Properties | `discord_webhook_url` | Discord Webhook URL | Firebase/虎威画面へ再表示しない |
| Discord | Webhook通知 | 成功メッセージが送信される | 通知ONかつURL保存済みの場合 |
| Firestore `users/{uid}` | サブスクリプション関連 | 変化なし | 自動投稿では更新しない |

## 21. 自動投稿失敗後

| 保存先 | フィールド | 正常値 | 備考 |
| --- | --- | --- | --- |
| Google Spreadsheet `Errors` | エラー行 | `timestamp`、`context`、`message`、`stack` | 失敗内容が記録される |
| Google Spreadsheet `Posts` | 対象投稿 | `postId` が `ERROR` 等 | 再処理防止 |
| Discord | Webhook通知 | 失敗または重大エラーメッセージが送信される | 通知失敗は自動投稿失敗として扱わない |
| Firestore `users/{uid}` | サブスクリプション関連 | 変化なし | 投稿失敗では更新しない |

## 22. アカウント削除後

ユーザー自身または管理者がアカウント削除した後に確認します。

| 保存先 | 正常値 | 備考 |
| --- | --- | --- |
| Firebase Auth | 対象UIDが存在しない | Auth削除済み |
| Firestore `users/{uid}` | ドキュメントが存在しない | 削除済み |
| RTDB `user-data/{uid}` | ノードが存在しない | 削除済み |
| Firestore `gasProxySecrets/{uid}` | ドキュメントが存在しない | 削除処理対象に含まれる |
| Firestore `freeToolUnlockKeyUsers/{uid}` | ドキュメントが存在しない | ユーザー削除トリガーで削除済み |
| Firestore `freeToolUnlockKeys/{keyHash}` | 対象UIDのキーが存在しない | 現在キーと再発行で失効した古いキーも削除済み |
| Firestore `supportMessageThreads/{uid}` | ドキュメントと `messages` サブコレクションが存在しない | 個別メッセージ履歴も削除済み |

## 22.1. 東京のXトレンド定期取得後

`updateTokyoXTrends` が4時間ごとにX API v2から東京（WOEID `1118370`）のトレンドを取得します。

| 保存先 | フィールド | 正常値 | 備考 |
| --- | --- | --- | --- |
| Firestore `XTrends/{snapshotId}` | `timestamp` | Timestamp | Firestoreサーバー時刻 |
| Firestore `XTrends/{snapshotId}` | `location.name` | `Tokyo` | 取得対象地域 |
| Firestore `XTrends/{snapshotId}` | `location.woeid` | `1118370` | 東京のWOEID |
| Firestore `XTrends/{snapshotId}` | `source` | `x-api-v2` | スクレイピングではなくX APIから取得 |
| Firestore `XTrends/{snapshotId}` | `xtrends` | 最大20件の配列 | `rank`, `chart`, `keyword`, 任意の`posts` |
| Firestore `XTrends` | ドキュメント数 | 最大12件（約48時間） | 古いスナップショットは定期取得時に削除。画面表示は最新6件（約24時間） |

## 23. 正常状態の早見表

| 操作段階 | Firestore `users/{uid}` | RTDB `user-data/{uid}/settings` | Firestore `gasProxySecrets/{uid}` |
| --- | --- | --- | --- |
| 登録直後 | `termsAccepted:false`, `subscriptionStatus:inactive`, `bankPaymentInfo:null`, `welcomeEmailSentAt`, `applyMailchimpTag:["torai_regist"]` | `googleSheetUrl:''`, `gasProxyInitializedAt:''` | なし |
| 規約同意後 | `termsAccepted:true`, `subscriptionStatus:inactive`, `applyMailchimpTag:["torai_agreed"]` | 変化なし | なし |
| クレカ契約後 | `subscriptionStatus:active/trialing`, `stripeCustomerId`, `stripeSubscriptionId`, `appPlanId`, `currentPeriodStart/End`, `applyMailchimpTag:["torai_subscribed"]` | 変化なし | なし |
| 銀行振込申込後 | `bankPaymentInfo.status:payment_requested`, `subscriptionStatus:inactive`, `applyMailchimpTag:["torai_bank_requested"]` | 変化なし | なし |
| 銀行振込確認依頼後 | `bankPaymentInfo.status:pending_confirmation`, `subscriptionStatus:inactive`, `applyMailchimpTag:["torai_bank_pending_confirmation"]` | 変化なし | なし |
| 銀行振込承認後 | `subscriptionStatus:active`, `bankPaymentInfo.status:active`, `appPlanId`, `currentPeriodStart/End`, `applyMailchimpTag:["torai_subscribed_bank"]` | 変化なし | なし |
| GAS本人確認後 | サブスク/規約状態は変化なし | `googleSheetUrl:/exec URL`, `gasProxyInitializedAt:ISO文字列` | `gasProxySecret`, `googleSheetUrl`, `initializedAt`, `updatedAt` |
| Discord通知設定後 | 変化なし | `discordPostResultNotificationEnabled:true/false`, `discordWebhookUrlSaved:true/false`、Discord Webhook URLは保存しない | GAS Propertiesに `discord_notification_enabled` / `discord_webhook_url` |
| Stripe解約予約後 | `cancelAtPeriodEnd:true`, `canceledAt`, `subscriptionStatus:active/trialing` | 変化なし | 変化なし |
| Stripe解約完了後 | `subscriptionStatus:canceled`, Stripe関連IDが削除/クリア, `applyMailchimpTag:["torai_cancelled"]` | 変化なし | 変化なし |
| アカウント削除後 | `users/{uid}` なし、対象UIDの `freeToolUnlockKeyUsers` / `freeToolUnlockKeys` なし | `user-data/{uid}` なし | `gasProxySecrets/{uid}` なし |

## 24. Xマーケティング（GAS所有データ）

Xマーケティングの認証情報、反応者データ、投稿分析、取得履歴はFirebaseへ保存しない。ユーザー自身のGAS `PropertiesService` とスプレッドシートを正本とし、虎威は既存の署名付きGASプロキシ経由で表示・更新する。

| 保存先 | データ | 契約 |
| --- | --- | --- |
| GAS Script Properties | `x_marketing_settings` | 反応者取得と投稿分析それぞれの有効状態、追跡日数、取得上限、全アカウント月間予算 |
| Spreadsheet `XMarketingInteractions` | 反応者・投稿・スコア・CRM状態 | X認証情報を含めない |
| Spreadsheet `XMarketingPosts` | 追跡対象投稿ごとの最新指標 | 投稿ID、本文抜粋、表示回数、エンゲージメント、公開反応数を保存 |
| Spreadsheet `XMarketingPostDaily` | 投稿ごとの日次スナップショット | 同じ投稿・同じ日付は上書きし、最大32日分を保持 |
| Spreadsheet `XMarketingRuns` | アカウント別取得リソース数・推定費用・実行結果 | 全アカウント合計費用の算出元 |
| Firebase | Xマーケティングデータ | 保存しない |

GAS API契約は`target: xMarketing`を使用する。表示取得は`action: fetch`、設定保存は`upsertSettings`、手動取得は`refresh`、CRM更新は`updateProspect`とする。`enabled`は反応者取得、`analyticsEnabled`は投稿分析を個別に制御し、どちらか一方が`true`なら日次トリガーを維持する。`fetch`レスポンスの`analytics.posts`に投稿別最新値、`analytics.daily`にアカウント・日付別集計を含める。

管理者のマニュアル撮影用操作は`action: importSampleData`と`deleteSampleData`を使用する。FunctionsのGASプロキシで`users/{uid}.isAdmin`またはFirebase Authの`isAdmin`カスタムクレームを確認し、非管理者からの直接呼び出しを拒否する。サンプルもFirebaseには保存せず、管理者本人のGASシートへ`torai-sample:`接頭辞付きで追加する。削除時は同接頭辞と専用実行履歴マーカーだけを削除し、通常取得した行を保持する。
