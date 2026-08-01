# TB-Torai リリース候補（RC）実機確認手順書

Threads / Bluesky 自動投稿ツール **TB-Torai** を、本番相当環境の実機で通しで確認するための手順書です。
`docs/user-operation-test-checklist.md` は虎威（X 版）由来で削除済み画面を含むため、**TB-Torai ではこちらを正**とします。

- 対象: フロント `autopost-frontend`（ブランチ `phase9-frontend-ui`）＋ GAS `kztmk/ts_autopost`
- 想定所要: 通しで 3〜4 時間（自動投稿トリガーの待ち時間を含む）
- 判定: 各行の「期待結果」を満たせば OK。**S 印は RC 判定の必須項目**（1 つでも落ちたら RC タグを打たない）

---

## 0. 事前準備（実機確認を始める前に）

| No | 準備 | 内容 | 完了条件 |
| --- | --- | --- | --- |
| 0-1 | GAS の再デプロイ | GAS 側を最新版で「デプロイを管理 → 新バージョン」。Phase 4〜7 のエンドポイント（insights / archive / trigger / threadsAuth）を有効にする | `/exec` URL は不変のまま最新版が応答する |
| 0-2 | GAS の紐付け解除 | GAS エディタで `setup_resetProxyAuth` を実行 | `ownerUid` がクリアされ、新しい Firebase uid で初期化できる状態 |
| 0-3 | テンプレシート確認 | `VITE_GAS_TEMPLATE_COPY_URL` のシートが「リンクを知っている全員・閲覧者」で共有されている | 別 Google アカウントで `/copy` が開ける |
| 0-4 | code.js の公開 | `https://github.com/kztmk/ts_autopost/releases/latest/download/code.js` がブラウザで実体を返す | 404 でない（Draft/Pre-release でない） |
| 0-5 | 環境変数確認 | `.env.production` の Firebase 構成 / `VITE_GAS_LATEST_CODE_URL` / `VITE_GAS_TEMPLATE_COPY_URL`。`VITE_PROXY_URL` は空でよい（`firebase.json` の `/api/gas-proxy` rewrite 経由） | 値が本番プロジェクトのもの |
| 0-6 | テスト用アカウント | ①未登録の Google アカウント ②Bluesky（ハンドル＋**アプリパスワード**） ③Threads（Meta アプリの App ID / Secret、`threads_manage_replies` スコープ付き） | 3 つとも手元にある |
| 0-7 | 実機端末 | PC ブラウザ（Chrome）＋ スマホ実機（iOS Safari / Android Chrome のいずれか） | 両方でログインできる |
| 0-8 | ビルドとデプロイ | `npm run build` → Hosting / Functions をデプロイ（**デプロイは運営者が手動で実施**） | 本番 URL が新しいビルドを返す |

---

## 1. 起動・サインイン・規約（S）

| No | 操作 | 期待結果 |
| --- | --- | --- |
| 1-1 S | 本番 URL を開く | タイトル・ロゴが **TB-Torai**。虎威 / X の名称や X アイコンが残っていない |
| 1-2 S | 未登録 Google アカウントでサインイン | Firebase Auth にユーザーが作成され、`users/{uid}` が作られる |
| 1-3 | ようこそメール受信 → 確認リンク | メールが届き、リンクから TB-Torai へ戻れる |
| 1-4 S | 規約未同意で `/dashboard` へ直接アクセス | 規約ページへ誘導される |
| 1-5 S | 規約に同意 | `termsAccepted: true` になり、ダッシュボードへ進める |
| 1-6 | 言語切替（日本語/英語） | 画面文言が切り替わり、未翻訳キー（`common.xxx` の生表示）が出ない |
| 1-7 S | ブラウザをリロード | ログイン状態が復元され、白画面やコンソールエラーが出ない |

---

## 2. サブスクリプション（虎威から継承した部分）

> Stripe / 銀行振込 / 紹介プログラムは虎威から継承したコードです。TB-Torai 独自の変更は入っていないため、**回帰確認の粒度**で確認します。

| No | 操作 | 期待結果 |
| --- | --- | --- |
| 2-1 S | 未契約状態で `/dashboard`・アカウント・投稿画面へ | サブスクリプション画面へ戻される |
| 2-2 | プロフィール・規約ページへ | 未契約でも表示できる |
| 2-3 S | Stripe テストカードで申込 → Checkout 完了 | 決済成功後 TB-Torai に戻り、Webhook 反映後に `subscriptionStatus` が active |
| 2-4 S | 契約反映後に保護ページへ | ダッシュボード・アカウント・投稿画面が表示できる |
| 2-5 | Checkout をキャンセルして戻る | 未完了として案内され、状態が壊れない |
| 2-6 | 決済メール・Mailchimp タグ | 従来どおり送信・付与される（虎威の挙動から変化がない） |

---

## 3. GAS 連携（プロフィール → API 設定）（S）

| No | 操作 | 期待結果 |
| --- | --- | --- |
| 3-1 S | API 設定を開く | 「テンプレートを Google ドライブにコピー」ボタンと「最新の GAS スクリプト（code.js）をダウンロード」リンクが表示される |
| 3-2 S | コピーボタン → Google の「コピーを作成」 | スクリプト付きでシートが複製され、コピーが自動で開く |
| 3-3 S | コピーしたシートで 拡張機能 → Apps Script → デプロイ → 新しいデプロイ → ウェブアプリ → アクセスを承認 | ウェブアプリ URL（`.../exec`）が取得できる。承認はこの 1 回だけ |
| 3-4 S | シートを再読み込み → メニュー「Autopost 連携 → セットアップ（URL・本人確認コード）」 | ダイアログに URL（自動取得）と `XXXXXXXX-XXXXXXXX-XXXXXXXX` 形式のコードが表示される |
| 3-5 S | API 設定に URL＋本人確認コードを入力して保存 | `initializeGasProxyAuth` が成功する |
| 3-6 | 保存先を確認 | RTDB `user-data/{uid}/settings/googleSheetUrl`、Firestore `gasProxySecrets/{uid}`、GAS Properties の owner uid が保存される |
| 3-7 S | 保存後に API 設定を再表示 | GAS URL は表示のみ（入力不可）、コード欄は空で入力不可 |
| 3-8 | 「変更」ボタン → URL 変更をコードなしで保存 | 本人確認コード必須エラー |
| 3-9 | 不正形式・期限切れ（約 10 分超過）のコードで保存 | それぞれフォーマットエラー / 期限切れエラー |
| 3-10 S | 別ユーザーで同じ GAS URL に接続 | uid 不一致で拒否される |
| 3-11 | GAS バージョン表示 | フロントが検知した GAS バージョンと、更新が必要な場合の案内が正しく出る（`useGasVersionStatus`） |
| 3-12 | Discord 通知 ON → Webhook URL 保存 → テスト送信 | Discord にテストメッセージが届き、Webhook URL 本体は Firebase に保存されない（RTDB は `discordWebhookUrlSaved: true` のみ） |

---

## 4. アカウント登録：Bluesky（S）

| No | 操作 | 期待結果 |
| --- | --- | --- |
| 4-1 S | アカウント画面を開く | Bluesky / Threads のタブ（または区分）が表示され、`blueskyAuth fetch` `threadsAuth fetch` が成功して空一覧になる |
| 4-2 | 空欄・不正ハンドルで保存 | バリデーションエラーが表示される |
| 4-3 S | ハンドル＋**アプリパスワード**で登録 | GAS に保存され、一覧に表示される。**通常ログインパスワードでは登録しないこと** |
| 4-4 | 登録済みアカウントを編集（表示名・メモのみ変更） | 認証情報は維持され、変更が反映される |
| 4-5 | 認証情報を再設定 | GAS 側の認証情報が更新される |
| 4-6 S | アカウント削除 | 一覧から消え、GAS 側のアカウント情報も削除される |
| 4-7 | 誤ったアプリパスワードで登録 | 分かりやすいエラーが表示され、画面が固まらない |

---

## 5. アカウント登録：Threads OAuth（S）

| No | 操作 | 期待結果 |
| --- | --- | --- |
| 5-1 S | Threads アカウント追加で App ID / App Secret を入力 | 保存され、認可 URL の取得ボタンが有効になる |
| 5-2 S | 認可 URL を取得（`threadsAuth authorizeUrl`）→ ブラウザで開く | Meta の認可画面が開く |
| 5-3 S | 認可を許可 | GAS の doGet コールバックがトークンを保存し、TB-Torai に戻って一覧にアカウントが表示される |
| 5-4 S | スコープ確認 | `threads_manage_replies` が含まれている（**含まれないとスレッド投稿が失敗する**） |
| 5-5 | パーマリンク取得（`threadsAuth permalink`） | 投稿の Threads URL が取得・表示できる |
| 5-6 | 認可を途中でキャンセル | エラー表示されるが、アカウントが半端な状態で残らない |
| 5-7 | Threads アカウント削除 | 一覧から消え、GAS 側からも削除される |

---

## 6. 投稿作成（PostComposer）（S）

| No | 操作 | 期待結果 |
| --- | --- | --- |
| 6-1 S | 投稿画面を開く | 投稿先アカウント選択に Bluesky / Threads の登録済みアカウントが出る |
| 6-2 S | Bluesky 単独で 300 グラフェム超の本文 | 300 で警告・保存不可。**絵文字や結合文字が 1 文字として数えられる**（`Intl.Segmenter`） |
| 6-3 S | Threads 単独で 500 文字超 | 500 で警告・保存不可 |
| 6-4 S | Bluesky と Threads を同時選択（クロスポスト）で 301〜500 文字 | **厳しい方（300 グラフェム）**が適用されて保存不可 |
| 6-5 S | 本文のみの投稿を保存 | `postData createMultiple` が成功し、投稿一覧に表示される |
| 6-6 S | 画像を添付して保存 | Google Drive の `TB-Torai_MediaFiles/YYYY/MM` にアップロードされ、`mediaUrls` に URL が入る |
| 6-7 S | 大きい画像（3MB 超）を Bluesky 向けに添付 | クライアント側リサイズで **1MB 以下**に縮小されてアップロードされる |
| 6-8 | Drive Picker から既存ファイルを選択 | 選択したファイルが添付される |
| 6-9 S | セグメントを 2 つ以上にしてスレッド投稿を保存 | `createMultiple` → `updateInReplyTo` が走り、投稿間の返信関係が保存される |
| 6-10 S | 複数アカウントを選んでクロスポスト保存 | アカウントごとに行が作成され、`crossPostGroupId` が共通で入る |
| 6-11 S | 下書き自動保存: 入力途中でリロード | 本文・添付・予約日時が復元される |
| 6-12 | 下書きを破棄 | 復元されなくなる |
| 6-13 | AI 生成モーダル（使用する場合） | 生成文が本文に反映され、文字数カウントも追随する |
| 6-14 | 投稿を編集（`postData update`） | 変更がシートに反映される |
| 6-15 S | 投稿を削除（`postData delete`） | 一覧とシートから消える |

---

## 7. 予約設定

| No | 操作 | 期待結果 |
| --- | --- | --- |
| 7-1 S | 投稿に予約日時を設定（`postData updateSchedule`） | 予約日時が保存され、一覧に表示される |
| 7-2 | 予約日時を解除 | 空になる |
| 7-3 S | タイムゾーン確認 | 画面表示（ブラウザ TZ）とシート保存値（GAS は Asia/Tokyo）がずれていない |
| 7-4 | 過去日時を設定 | 仕様どおりエラー、または直近実行対象になる |

---

## 8. 自動投稿（S・実機の山場）

| No | 操作 | 期待結果 |
| --- | --- | --- |
| 8-1 S | ヘッダーの自動投稿コントロール（`AutoPostControl`）を確認 | 現在のトリガー状態（`trigger status`）が表示される |
| 8-2 S | 自動投稿を ON（`trigger create`） | GAS 側に時間トリガーが作成され、UI がアクティブ表示になる |
| 8-3 S | 数分後の予約投稿を用意して待つ | 実際に Bluesky / Threads へ投稿され、`Posts` → `Posted` へ移動する |
| 8-4 S | 投稿結果を確認 | 投稿 ID・postedAt が保存され、実際の Bluesky / Threads 上に投稿が見える |
| 8-5 S | 画像付き投稿の自動実行 | 画像付きで投稿される（Bluesky の 1MB 制限に引っかからない） |
| 8-6 S | スレッド投稿の自動実行 | Threads / Bluesky 上で返信としてつながる（Threads は `threads_manage_replies` 必須） |
| 8-7 S | クロスポストの自動実行 | 両プラットフォームに同じ内容が投稿される |
| 8-8 S | 意図的な失敗（誤ったアプリパスワード等） | `Errors` に記録され、TB-Torai のエラー一覧に表示される |
| 8-9 | Discord 通知 ON での成功・失敗 | Discord にそれぞれのメッセージが届く |
| 8-10 | 予約投稿が無くなった状態 | トリガーが自動削除または停止表示になる |
| 8-11 S | 自動投稿を OFF（`trigger delete`） | 以降の自動投稿が行われない |
| 8-12 | 重複実行 | 同じ投稿が二重投稿されない |

> 注意: GAS の時間トリガーは push 直後に反映ラグがあります。想定時刻に動かない場合は数分待つか、GAS エディタから直接実行して切り分けてください。

---

## 9. 投稿結果・データ同期

| No | 操作 | 期待結果 |
| --- | --- | --- |
| 9-1 S | ダッシュボードを開く | Bluesky / Threads のアカウント数と投稿状況の概要、エラー一覧が表示される |
| 9-2 S | 投稿一覧（Posts / Posted / Errors）を開く | `postData` `postedData` `errorData` の fetch が成功し、3 種が表示される |
| 9-3 S | ヘッダの時計アイコン → 「エンゲージメント更新」スイッチを ON | `trigger/ensureEngagement` が成功し、バッジが ON・「反映は最大 24 時間後」のトーストが出る |
| 9-3b S | GAS のトリガー一覧を確認 | `updateAllEngagement` の**日次トリガーが 1 件だけ**作成されている（2 回 ON にしても重複しない。GAS 側が `ensureDailyTrigger` で冪等） |
| 9-3c | 画面を再読み込み | スイッチが ON のまま復元される（`getEngagementTriggerStatus` が状態を取得できている） |
| 9-3d | 自動投稿スイッチとの独立性 | エンゲージメント更新を ON/OFF しても、**自動投稿の ON/OFF と間隔表示が変わらない**（状態スロットが別なので上書きされないこと） |
| 9-3e S | 数値の反映確認 | **日次トリガーの実行時刻は Google が決めるため即時には入らない**。実機確認では GAS エディタで `runEngagementUpdateOnce()` を手実行 → 画面を再読み込みし、いいね・返信などに実数が入り `insightsUpdatedAt` に日時が入ることを確認する |
| 9-3f | Bluesky の views / shares | **仕様どおり常に 0**（Bluesky 公開 API が返さないため GAS 側でハードコード）。`PostedList` は Threads のときだけ views/shares を表示するので、Bluesky 行に両列が出ないのが正しい |
| 9-3g | スイッチを OFF | `trigger/deleteEngagement` が成功し、GAS のトリガーが消える。**取得済みの数値は Posted シートに残る** |
| 9-4 | アーカイブ実行（`archive`、posted / errors） | アーカイブ先シートにコピーされ、一覧から移動する |
| 9-5 | 署名エラーを故意に起こす（secret 不一致・時刻ずれ） | 署名エラーとして拒否され、ユーザーに分かるメッセージが出る |
| 9-6 | GAS 未接続ユーザーで同期 | 「先に GAS 連携が必要」と案内される（無限ローディングにならない） |

---

## 10. 解除・削除・境界

| No | 操作 | 期待結果 |
| --- | --- | --- |
| 10-1 | GAS URL を空にして保存 | `clearGasProxyAuth` が成功し、RTDB の URL がクリアされ `gasProxySecrets/{uid}` が削除される |
| 10-2 | RTDB `user-data/{uid}/settings/googleSheetUrl` をクライアントから直接更新 | Firestore/RTDB ルールで拒否される |
| 10-3 S | サインアウト | `/auth/signin` に戻り、保護ページへ入れない |
| 10-4 | 再サインイン | アカウント・投稿・GAS 連携の状態が復元される |
| 10-5 | Stripe を期間末キャンセル | `cancelAtPeriodEnd: true`、解約予定日が表示され、期間内は利用できる |
| 10-6 | アカウント削除 | Auth / Firestore / RTDB / `gasProxySecrets/{uid}` が削除される |

---

## 11. 実機端末・UI（S）

| No | 操作 | 期待結果 |
| --- | --- | --- |
| 11-1 S | スマホ実機で全主要画面（ダッシュボード / アカウント / 投稿作成 / 投稿一覧 / API 設定） | 操作不能なレイアウト崩れがない。ボタンが画面外に出ない |
| 11-2 S | スマホ実機で投稿作成 → 画像添付 → 保存 | Drive アップロードまで完走する |
| 11-3 | スマホで Threads OAuth | 認可画面から戻ってこられる（アプリ内ブラウザで詰まらない） |
| 11-4 | ダークモード / ライトモード | どちらでも文字が読める |
| 11-5 | 複数タブで同時操作 | データ競合や二重保存が起きない |
| 11-6 S | 全画面でブラウザコンソール | 未処理例外・404 リクエストが出ていない |

---

## 12. RC 判定基準

以下がすべて満たされたら RC タグを打ってよい。

- [ ] 上記の **S 印がすべて OK**
- [ ] 新規登録 → 規約同意 → サブスク契約 → GAS 連携 → アカウント登録 → 投稿作成 → 予約 → 自動投稿 → `Posted` 反映、が**1 本の通しで完走**できた
- [ ] Bluesky と Threads の**両方**で実投稿を確認した
- [ ] 失敗ケースが `Errors` に記録され、UI にエラーとして見えた
- [ ] スマホ実機で主要画面が操作できた
#### 9-3 エンゲージメント更新（対応済み・2026-07-31）

日次トリガーの ON/OFF を `AutoPostControl` に配線済み。**手動更新ボタンは意図的に作らない**方針を確定した。

- 追加: `apiControllerSlice` に `enableEngagementTrigger` / `disableEngagementTrigger` / `getEngagementTriggerStatus` と、専用スロット `engagementStatus`（`triggerStatus` を共用すると自動投稿の表示を上書きするため）
- 状態取得は既存 `trigger/status` を `functionName: 'updateAllEngagement'` で流用（GAS の `checkTriggerExists` は任意の functionName を受ける）
- マニュアル `auto-posting.md` / `manage-posts.md`（日英）に「1 日 1 回更新・反映は最大 24 時間後・0 のままなら 1 日待つ」を明記

> **手動更新を作らない理由**: `insights/refresh` は名前に反して**同期実行**（`main.ts` が `runEngagementUpdateOnce()` の完了を待つ）。GAS は投稿 1 件ごとに 500ms スリープ＋最大 5 分の時間予算で回る一方、`proxyToGas` の GAS 向け fetch は **30 秒でタイムアウト**（`functions/src/handlers/proxy.ts:749`）。投稿が数十件を超えるとフロントはタイムアウトするが GAS は裏で完走するため、ユーザーには成否が分からない。GA で入れる場合は GAS 側の非同期化（別リポジトリ）が前提。

- [ ] GET `insights/account`（フォロワー数などアカウント全体指標）は引き続き未使用。GA で使うか判断する

### RC タグを打つ前に必要な作業（コード側）

実機確認とは別に、以下が未了です。

- [ ] Phase 9 の成果物をコミットする（現在すべて `phase9-frontend-ui` に未コミット）
- [ ] `package.json` の `name: "torai"` / `version: "2.1.7"` を TB-Torai の値へ更新するか、据え置く判断をする
- [ ] `VITE_APP_VERSION`（現在 `0.1.0`）と打つタグを一致させる
- [ ] 虎威由来の残骸を整理する: `docs/user-operation-test-checklist.md`（X 版・削除済み画面を含む）、`design-qa.md`（削除済みの X マーケティング）、`AGENT.md` / `README.md` の記述
- [ ] `docs/manual` の `getting-started.md` の「アカウント作成」節が**メール／パスワード前提**のまま。実装は Google サインインなので実機確認時の見え方に合わせて修正する

---

## 13. トラブル時の切り分け

| 症状 | 確認 |
| --- | --- |
| GAS 連携が保存できない | コードの有効期限（約 10 分）／`setup_resetProxyAuth` 済みか／GAS が最新版でデプロイされているか |
| 署名エラー | 端末時刻のずれ、`gasProxySecrets/{uid}` の有無、GAS 側 owner uid |
| 自動投稿が動かない | GAS のトリガー一覧、反映ラグ（数分待つ）、GAS エディタから直接実行して切り分け |
| Threads のスレッドが失敗 | `threads_manage_replies` スコープ、トークンの有効期限 |
| Bluesky の投稿が失敗 | アプリパスワードか（通常パスワード不可）、画像が 1MB 以下か |
| 画像がアップロードされない | Drive の権限、`TB-Torai_MediaFiles` フォルダ、ブラウザのポップアップブロック |
