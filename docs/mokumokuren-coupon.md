# 新規サブスク特典: mokumokuren Pro 2ヶ月無料クーポン

新規サブスクリプション契約が完了した瞬間（`users/{uid}.currentPeriodStart` が**初めて作成**されたとき）に、
兄弟アプリ **mokumokuren** の「Pro 2ヶ月無料」プロモーションコードを自動発行し、
サブスクリプション管理画面に表示する仕組み。

## 流れ

1. Stripe webhook / 銀行振込処理が `users/{uid}` に `currentPeriodStart` を書き込む（既存処理）
2. Firestore トリガー `issueMokumokurenCoupon`（`functions/src/handlers/mokumokurenCoupon.ts`）が
   「無 → 有」の遷移を検知
3. **mokumokuren 側の Stripe アカウント**にクーポン `mokumokuren-2mo-free`
   （100%オフ × 2ヶ月）を get-or-create し、uid から決定的に生成した一意コード
   `TORAI-XXXXXXXX`（1回限り・`metadata.source=torai`）を発行
4. `users/{uid}.mokumokurenCoupon = { code, promotionCodeId, createdAt }` に保存
5. サブスク管理画面の `MokumokurenCouponCard` がコードとコピー用ボタン・使い方を表示
   （フィールドが無い間は何も表示しない）

## 冪等性・リトライ

- コードは `sha256(uid)` から決定的に生成 → リトライ・再実行しても同じコードに収束
- Stripe 側は `idempotencyKey: torai-moku-v1-{uid}`、加えて「コードは存在するが
  Firestore 未保存」の中断ケースは `promotionCodes.list({ code })` で回収
- 発行済み（`mokumokurenCoupon.code` あり）・解約→再契約では再発行しない
- キー無効（401）はリトライせずログのみ。その他のエラーは `retry: true` で再試行

## デプロイ前の準備（1回だけ）

1. **mokumokuren 側**の Stripe ダッシュボード（本番）で**制限付きキー**を作成:
   「Coupons: 書き込み」権限のみ（プロモーションコードは Coupons 権限に含まれる）
2. 虎威の Firebase プロジェクトに登録:
   ```
   firebase functions:secrets:set MOKUMOKUREN_STRIPE_KEY
   ```
   （テスト環境では mokumokuren のテストキーを設定）
3. `firebase deploy --only functions` — 初回は Eventarc の権限伝播で
   トリガー作成が失敗することがある。数分待って再実行すれば通る

## ユーザー側の利用手順（カードにも表記）

mokumokuren をインストール → 設定（⚙）→「アカウント / Pro」でサインイン →
**「クーポンコードをお持ちの方はこちら」**から決済画面を開きコードを入力。
このコード経路は mokumokuren の初月無料トライアルと**排他**（トライアルなしで
2ヶ月無料が初日から適用）。
