Firebase Functions 解説ドキュメント

このドキュメントでは、functions/src/index.ts に実装された Firebase Cloud Functions v2 を中心に、Stripe および銀行振込サブスクリプションの処理全体を解説します。

概要

このシステムは、React アプリ「虎威」向けに構築されたサブスクリプション管理のバックエンド処理を提供します。Stripe の自動決済と銀行振込による手動決済の両方をサポートしており、Firebase Firestore を用いてユーザーデータを管理します。

主な機能と関数一覧

1. 銀行振込関連の関数

requestBankTransferPayment
• ユーザーが銀行振込プランを選択したときに呼び出されます。
• Firestore 上の users コレクションに支払い情報を保存し、メール通知（Trigger Email Extension）を送信します。

requestBankTransferConfirmation
• ユーザーが振込完了後に名義を送信するリクエストを処理します。
• Firestore に確認リクエストを保存し、ユーザー情報を更新します。

approveBankTransferPayment
• 管理者が振込を確認し、ユーザーのプランをアクティブ化するための関数です。
• サブスクリプション期間を計算し、Firestore のユーザー情報を更新します。

revertBankTransferPayment
• 管理者が振込確認依頼を差し戻すための関数です。
• 差し戻し理由を Firestore に保存し、ユーザー画面、メール、個別メッセージで通知します。

sendBankTransferRenewalNotices
• 6ヶ月プランの期限切れの 7 日前に更新案内を送信する定期関数です（毎日午前9時実行）。

processExpiredBankTransferSubscriptions
• 期限が切れたが未入金状態のサブスクリプションを失効処理する関数（毎日午前10時実行）。

processMissedBankTransferPayments
• 支払期限を過ぎても未入金の場合にステータスを payment_failed に変更（毎日午前11時実行）。

2. Stripe 関連の関数

createStripePortalLink
• 認証ユーザーの Stripe 顧客ポータルへのリンクを作成します。

stripeWebhookHandler
• Stripe の Webhook を処理し、以下のイベントを Firestore に反映：
• checkout.session.completed
• customer.subscription.created
• customer.subscription.updated
• customer.subscription.deleted
• invoice.payment_failed など

getAdminSubscriptionDashboard
• 管理者画面のサブスクリプションダッシュボード用に、Firestore users と Stripe の現在のサブスクリプション情報を照合します。
• Stripe Secret を使用するため Callable Function 側で取得し、ブラウザには集計済みの参照データだけを返します。
• Firestore と Stripe の状態・プラン・価格IDの差異、Stripe取得エラー、14日以内に期限を迎える契約を確認できます。
• Firestore の termsAccepted と subscriptionStatus から、regist（規約未同意）、termaccepted（規約同意済み・契約前）、subscribed（契約済み）の数も集計します。
• この関数は参照専用です。契約状態の修正や同期書き込みは行いません。

3. メッセージ関連の関数

sendUserMessageToAdmin
• ユーザーが管理者へ個別メッセージを送信します。
• supportMessageThreads/{uid}/messages に本文、送信日時、既読状態を保存します。

sendAdminMessageToUser
• 管理者が特定ユーザーへ個別メッセージを送信します。
• ユーザー未読件数を更新し、Trigger Email Extension 用に mail ドキュメントを作成します。
• メールテンプレート名は adminDirectMessageNotification です。

sendAdminBroadcastMessage
• 管理者が全ユーザー向けのアプリ内一斉メッセージを作成します。
• メールは送信しません。全ユーザー向けメール配信は Mailchimp で行います。

getUserMessages / getUserMessageOverview
• ユーザー画面とヘッダ未読バッジ用に、個別メッセージ、一斉メッセージ、未読数を返します。

getAdminMessageThreads / getAdminMessageThread
• 管理者画面の未読メッセージ一覧とユーザー別履歴を返します。
• 通常は直近60日以内のメッセージを返し、過去表示時のみ古いメッセージも返します。

markUserDirectMessagesRead / markBroadcastMessageRead / markAdminThreadRead
• 受信者の既読日時と未読件数を更新します。

setMessageImportant
• 管理者が個別メッセージの重要フラグを設定・解除します。

4. 紹介プログラム関連の関数

registerReferralForCurrentUser
• 紹介リンクの `ref` コードを、サインイン後のユーザーに紐付けます。
• 自己紹介や存在しない紹介コードは拒否します。

getMyReferralDashboard
• プロフィールの紹介プログラムタブ用に、紹介コード、紹介リンク、紹介登録数、規約同意数、サブスク開始数、報酬履歴、付与済み/未付与/利用可能/消化済み目安を返します。
• Stripe顧客がある場合は Customer balance を取得し、利用可能報酬に含めます。

qualifyReferralSubscription
• Stripe Webhook または銀行振込承認から呼び出される内部処理です。
• 紹介されたユーザーの初回契約完了を `referralQualifications/{referredUid}` に記録し、報酬の二重作成を防ぎます。
• 1人:1ヶ月、5人:追加3ヶ月、10人:追加6ヶ月、30人:1年、50人:永久50%オフ、100人:次回更新から永遠無料のマイルストーン報酬を作成します。
• 100人達成時にStripe契約がある紹介者は、Customer balance の紹介クレジットが残っていてもSubscriptionを即時キャンセルし、`appPlanId: lifetime` / `subscriptionStatus: active` として無料利用権を維持します。キャンセル通知メールは `mail` に直接キューします。
• 月ごとの付与上限は3ヶ月分です。Stripe顧客がある紹介者には Customer balance、ない場合は銀行振込クレジットとして付与します。

Firestore の更新内容（銀行振込の場合）

users コレクションの更新内容:

お申込み時（requestBankTransferPayment）:

bankPaymentInfo: {
status: 'payment_requested',
planId: 'half_yearly_bank',
planName: '6ヶ月プラン (銀行振込)',
amount: 6800,
currency: '円',
requestedAt: admin.firestore.FieldValue.serverTimestamp(),
paymentDeadline: admin.firestore.Timestamp.fromDate(deadlineDate),
},
updatedAt: admin.firestore.FieldValue.serverTimestamp(),

振込名義の送信時（requestBankTransferConfirmation）:

bankPaymentInfo: {
status: 'pending_confirmation',
transferNameReported: '山田タロウ',
confirmationRequestedAt: admin.firestore.FieldValue.serverTimestamp(),
},
updatedAt: admin.firestore.FieldValue.serverTimestamp(),

管理者による承認時（approveBankTransferPayment）:

appPlanId: 'half_yearly_bank',
stripePriceId: 'bank_half_yearly',
subscriptionStatus: 'active',
currentPeriodStart: admin.firestore.Timestamp.fromDate(startDate),
currentPeriodEnd: admin.firestore.Timestamp.fromDate(endDate),
bankPaymentInfo: {
status: 'active',
confirmedAt: admin.firestore.FieldValue.serverTimestamp(),
planActivatedAt: admin.firestore.FieldValue.serverTimestamp(),
},
cancelAtPeriodEnd: false,
canceledAt: admin.firestore.FieldValue.delete(),
endedAt: admin.firestore.FieldValue.delete(),
updatedAt: admin.firestore.FieldValue.serverTimestamp(),

管理者による差し戻し時（revertBankTransferPayment）:

bankPaymentInfo: {
status: 'payment_requested', // 更新時は 'renewal_requested'
rejectionReason: '振込名義が一致しませんでした。',
rejectedAt: admin.firestore.FieldValue.serverTimestamp(),
rejectedRequestId: '<bankTransferRequests document ID>',
transferNameReported: admin.firestore.FieldValue.delete(),
confirmationRequestedAt: admin.firestore.FieldValue.delete(),
},
updatedAt: admin.firestore.FieldValue.serverTimestamp(),

支払期限切れ時（processMissedBankTransferPayments）:

bankPaymentInfo: {
...,
status: 'payment_failed',
},
updatedAt: admin.firestore.FieldValue.serverTimestamp(),

期限切れ後の失効時（processExpiredBankTransferSubscriptions）:

subscriptionStatus: 'expired',
bankPaymentInfo: {
...,
status: 'expired',
},
endedAt: admin.firestore.FieldValue.serverTimestamp(),
updatedAt: admin.firestore.FieldValue.serverTimestamp(),

設定・定数
• STRIPE_SECRET_KEY、STRIPE_WEBHOOK_SECRET は Firebase Functions の Secret Manager（defineSecret）で管理。
• APP_URL は Firebase Functions の環境変数（defineString）で管理。
• Stripe の日本円 Price ID は STRIPE_PRICE_ID_BASIC_MONTHLY / STRIPE_PRICE_ID_HALF_YEARLY / STRIPE_PRICE_ID_YEARLY、USD月額 Price ID は STRIPE_PRICE_ID_BASIC_MONTHLY_USD の通常パラメータ（defineString）で管理。
• 銀行振込情報（口座番号、名義、案内文など）は BANK_ACCOUNT_DETAILS 定数で管理。
• 日本語ユーザーは既存のJPYプラン、日本語以外のユーザーはUSD月額プランのみを利用する。USDプランには初月割引と紹介報酬を適用しない。
• Stripe の Price ID とアプリ内のプラン ID の対応は getAppPlanIdForStripePriceId で解決する。

注意点
• 銀行振込のユーザーには Trigger Email Extension によってメールが自動送信されます。
• 銀行振込差し戻し通知のメールテンプレート名は bankTransferRejectionNotification です。template.data には displayName、serviceName、planName、transferName、rejectionReason、requestType が渡されます。
• 銀行振込差し戻し時は、同じ理由を supportMessageThreads/{uid}/messages に管理者からの重要メッセージとして保存します。メールは bankTransferRejectionNotification 側で送信済みのため、adminDirectMessageNotification は作成しません。
• 管理者からユーザーへの個別メッセージ通知のメールテンプレート名は adminDirectMessageNotification です。template.data には displayName、body、appName が渡されます。
• 管理者から全ユーザーへの一斉メッセージでは mail ドキュメントを作成しません。メール配信は Mailchimp で行います。
• メッセージ添付画像は Storage の message-attachments/{uid}/... に保存します。対象ユーザー本人と管理者のみ読み取れます。
• 管理者サブスクリプションダッシュボードは getAdminSubscriptionDashboard を呼び出し、Stripe と Firestore の差異を確認します。表示は参照専用です。
• 紹介報酬は Stripe Customer balance を優先します。Stripe顧客がない紹介者には `users/{uid}.referralCredit.bankAvailableAmount` として付与し、銀行振込申込時に請求額から差し引きます。
• 紹介報酬の消化済み額は、Stripe Customer balance の残高と Firestore の銀行振込クレジット残高から算出する目安です。請求単位の厳密な消化履歴は Stripe invoice Webhook の追加で拡張できます。
• Firestore 構造：
• users コレクションにサブスクリプション情報が保存されます。
• bankTransferRequests コレクションには確認申請が保存されます。
• mail コレクションを通じてメール通知が行われます。

今後の拡張余地
• Stripe Webhook のリトライ処理の強化。
• 多通貨対応（円以外の銀行振込、為替計算など）。
• 管理者用ダッシュボードから承認操作ができる UI の追加。

# Setting up

## 方法 2: Google Cloud Console で設定する

Google Cloud Console にアクセスします。

プロジェクトを選択します。

ナビゲーションメニューから「Cloud Functions」を選択します。

リストから関数 proxyToGas を見つけてクリックします。

関数の詳細ページで、「トリガー」タブを選択します。

HTTPS トリガーの URL の横にある編集アイコン（鉛筆マークなど）をクリックするか、トリガーに関する設定項目を探します。（UI は変更される可能性があります）

「認証」または「セキュリティ」に関連する設定項目で、「未認証の呼び出しを許可」または「Allow unauthenticated invocations」のようなオプションを選択します。

もし Cloud Functions の画面に直接なければ、基盤となる Cloud Run サービスへのリンクがあるかもしれません。その場合は Cloud Run サービスの認証設定を変更します。

設定を保存します。

Google Cloud Console にアクセスします。

正しいプロジェクトが選択されていることを確認します。

ナビゲーションメニュー（左上のハンバーガーメニュー）を開き、「コンピューティング」セクションの中にある 「Cloud Run」 を選択します。

Cloud Run のサービス一覧が表示されます。関数名 proxyToGas に対応するサービス名（通常は関数名と同じか、似た名前）を見つけてクリックします。

もしサービス名が不明な場合は、Cloud Functions のコンソールで proxyToGas 関数の詳細ページを開くと、どこかに「基盤となる Cloud Run サービス」や「Service」といったリンクや情報が表示されている可能性があります。

Cloud Run サービスのダッシュボードが表示されたら、上部にある 「セキュリティ」 タブ（またはそれに類する名前のタブ、"Networking" や "Security" など）をクリックします。

「認証」セクションを探します。

「未認証の呼び出しを許可」または「Allow unauthenticated invocations」というオプションを選択（チェックを入れるか、ラジオボタンを選択）します。

ページ下部（または上部）にある 「保存」 または 「デプロイ」 ボタンをクリックして変更を適用します。新しいリビジョンがデプロイされる場合があります。

変更が完了するまで少し待ちます。
