# スクリーンショットの用意

マニュアルの画像は `static/img/screenshots/*.png` に置きます。現在はグレーのプレースホルダが入っており、本物の画像で**同じファイル名**に上書きすると差し替わります。

取得方法は 2 通りです。

## 方法 A: 半自動キャプチャ（ログイン操作はあなた、撮影はスクリプト）

私（アシスタント）はブラウザを直接見て操作できないため、あなたのログイン済み Chrome に **CDP（リモートデバッグ）** で接続して撮影するスクリプトを用意しています。

### 手順

1. **Chrome をリモートデバッグ付きで起動**（既存の Chrome とは別プロファイル）:

   ```bash
   "/Applications/Google Chrome.app/Contents/MacOS/Google Chrome" \
     --remote-debugging-port=9222 \
     --user-data-dir="/tmp/autopost-capture"
   ```

2. 起動した Chrome で **アプリを開き、ログイン + GAS 連携**まで済ませます。
   （アカウントや投稿が数件ある状態だと、一覧などが見栄えよく撮れます）

3. アプリの開発サーバ or 本番 URL を確認して、**別ターミナル**でスクリプトを実行:

   ```bash
   cd docs/manual
   node scripts/capture-screenshots.mjs --base http://localhost:5173
   ```

   - `--base` はアプリの URL（例: `http://localhost:5173` や本番 URL）。
   - `--port` はデバッグポート（既定 9222）。
   - `--only signin,activity` のように対象を絞れます。

4. `static/img/screenshots/` に PNG が保存されます。中身を確認してください。

### 自動で撮れる画面（`TARGETS`）

`signin` / `activity` / `sns-tree` / `api-settings` / `discord-setup`

投稿一覧（`post-list` / `posted-list`）は URL に `:platform/:accountId` を含むため、
`capture-screenshots.mjs` の `TARGETS` にあなたのアカウントの実 URL を追記してから
`--only post-list` などで撮影してください。

## 方法 B: 手動キャプチャ（モーダル・外部画面）

次の画面はモーダルや外部サービスのため、手動で撮影して同じ名前で保存してください。

| ファイル名 | 撮る画面 |
| --- | --- |
| `composer.png` | 投稿作成画面（コンポーザー）を開いた状態 |
| `bluesky-register.png` | Bluesky アカウント登録ダイアログ |
| `threads-register.png` | Threads アカウント登録・認可の画面 |
| `distribute.png` | 「投稿間隔の配分」ダイアログ |
| `gas-menu.png` | スプレッドシートの「Autopost 連携」メニュー（Google Sheets 上） |
| `gas-setup.png` | プロフィール → API 設定の GAS 連携欄 |
| `auto-post-header.png` | ヘッダの時計アイコンを押した自動投稿パネル |
| `post-list.png` | 投稿一覧（予約タブ）＋行選択でツールバー表示 |
| `posted-list.png` | 投稿一覧（投稿済みタブ） |
| `discord-notification.png` | Discord に届いた通知メッセージ |

推奨解像度: 横 1000〜1440px 程度。ファイル形式は PNG、ファイル名は上記の通り。

## プレビュー

```bash
cd docs/manual
npm start          # 開発サーバ（日本語）
npm run build      # 本番ビルド（日英）
npm run serve      # ビルド結果をローカル確認
```
