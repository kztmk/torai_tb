# 運営向け 手順書（リリース・配布・更新）

Autopost（Threads / Bluesky 自動投稿ツール）を運営するあなたが行う作業の手順書です。
**GitHub でリリース用タグを公開した直後**を起点にしています。

- GAS リポジトリ: `kztmk/ts_autopost`（**public** のまま維持すること）
- 配布物: GitHub Release に添付される `code.js`
- エンドユーザー向けの手順は Docusaurus マニュアル（`docs/manual`）を参照。

---

## 0. 起点：タグを公開した直後の確認

タグ（例 `v0.1.0`）を push すると、ワークフロー `Publish code.js` が走り、そのタグの
GitHub Release に `code.js` が添付されます。まず次を確認します。

1. GitHub → **Actions** で `Publish code.js` が成功していること。
2. GitHub → **Releases** に対象タグのリリースがあり、Assets に `code.js` があること。
3. 最新版 URL が実体を返すこと（ブラウザ or 端末で確認）:

   ```
   https://github.com/kztmk/ts_autopost/releases/latest/download/code.js
   ```

   > 補足: `latest/download/...` が 404 の場合は、まだ 1 度も Release が作られていないか、
   > リリースが「Draft/Pre-release」になっています。通常リリースとして公開してください。

---

## 1. 初回のみ：テンプレート・スプレッドシートを作る

エンドユーザーはこのテンプレを「コピー」して使います。**1 回だけ**作成すれば OK です。

### 1-1. 新しいスプレッドシートを用意

1. Google ドライブで新規スプレッドシートを作成（名前例: `Autopost テンプレート`）。
2. **拡張機能 → Apps Script** を開く（このスプレッドシートにバインドされたスクリプトが作られる）。

### 1-2. コードとマニフェストを入れる

**方法A（手動・簡単／推奨）**

1. Apps Script エディタで既定の `コード.gs` を開き、中身を全消去して、
   最新の `code.js`（上記 latest URL の内容）を貼り付けて保存。
2. 左の **プロジェクトの設定（⚙）→「`appsscript.json` マニフェスト ファイルをエディタで表示する」にチェック**。
3. エディタに現れた `appsscript.json` を、次の内容に置き換えて保存:

   ```json
   {
     "timeZone": "Asia/Tokyo",
     "dependencies": {},
     "oauthScopes": [
       "https://www.googleapis.com/auth/spreadsheets",
       "https://www.googleapis.com/auth/script.external_request",
       "https://www.googleapis.com/auth/script.scriptapp",
       "https://www.googleapis.com/auth/drive",
       "https://www.googleapis.com/auth/script.container.ui"
     ],
     "webapp": {
       "executeAs": "USER_DEPLOYING",
       "access": "ANYONE_ANONYMOUS"
     },
     "exceptionLogging": "STACKDRIVER",
     "runtimeVersion": "V8"
   }
   ```

**方法B（clasp）**

- 別途 `clasp create --type sheets` で新規バインドスクリプトを作り、`dist/code.js` と
  `appsscript.json` を push する。既存リポジトリの `.clasp.json` は開発用スクリプトを指しているため、
  テンプレ用に別の作業ディレクトリ／`.clasp.json` を用意すること（既存を上書きしない）。

### 1-3. 動作確認（任意だが推奨）

一度自分でコピーを作り、`Autopost 連携 → セットアップ（デプロイ手順）` の実行
（シート作成＋コード生成＋手順ダイアログ）と、ダイアログに沿った
「デプロイ → 新しいデプロイ → ウェブアプリ」でのデプロイまで通るか確認しておくと安全です。
確認に使ったコピーは破棄して構いません。

### 1-4. 共有設定と「コピー」リンクの発行

1. テンプレのスプレッドシートを **「リンクを知っている全員」＝閲覧者**に共有（コピーに必要）。
2. 通常の URL `.../edit#gid=0` の **`/edit` 以降を `/copy` に置き換え**て配布リンクを作る:

   ```
   https://docs.google.com/spreadsheets/d/<テンプレのID>/copy
   ```

### 1-5. 配布リンクをマニュアル／アプリに反映

- ユーザーマニュアル `docs/manual/docs/getting-started.md`（および英語版）の
  「テンプレートをコピーする」節に、上記 `/copy` リンクを記載する。
- 必要ならアプリ内の案内にも同リンクを載せる。

---

## 2. 初回のみ：フロント（TB-Torai）側

1. `.env`（該当環境）で GAS の最新 code.js URL を上書きしたい場合のみ設定（既定でも可）:

   ```
   VITE_GAS_LATEST_CODE_URL=https://github.com/kztmk/ts_autopost/releases/latest/download/code.js
   ```

2. フロントをビルドしてデプロイ（デプロイ自体はあなたの手順どおり）。
   - プロフィール → API 設定に「最新の GAS スクリプト（code.js）をダウンロード」リンクが出ることを確認。

---

## 3. 毎回：バージョンアップをリリースする

1. コードを修正し、ローカルで動作確認（`npm run build` / 型チェック）。
2. `src/constants.ts` の `VERSION` を更新（任意だが推奨）。
3. コミットして `main`（またはリリースブランチ）へ push。
4. タグを打って push:

   ```bash
   git tag v0.1.1
   git push origin v0.1.1
   ```

5. Actions が `code.js` を Release に公開 → `latest/download/code.js` が新しくなる。
6. **既存ユーザーへの反映**：ユーザーがスプレッドシートのメニュー
   `Autopost 連携 → 更新手順を表示` に従い、最新 code.js を貼り替えて再デプロイ（数クリック・URL 不変）。
   バックエンドを実際に変更したリリースのときだけ案内すれば十分です。

---

## 4. マニフェスト（スコープ / webapp）を変更したリリースのとき（重要）

更新（貼り替え＋再デプロイ）はユーザーがエディタ上のコード（code.js）を差し替える運用です。
**`appsscript.json`（スコープ・webapp 設定）を変更したリリース**では、コードの貼り替えだけでは
マニフェストは変わりません。次を行ってください。

1. **テンプレの `appsscript.json` を更新**（手順 1-2 と同じ要領で反映）。
2. リリースノート等で既存ユーザーに、**Apps Script エディタで `appsscript.json` を最新に置き換え、
   再デプロイ（＆初回は権限の再承認）してください**と案内する。

---

## 5. 注意・チェックリスト

- [ ] `kztmk/ts_autopost` は **public** のまま（private にすると `latest/download` が認証必須になり、ダウンロードが壊れる）。
- [ ] リリースは **Draft/Pre-release ではなく通常公開**（`latest` に含まれる条件）。
- [ ] テンプレの共有は **「リンクを知っている全員・閲覧者」**（コピー可能にするため）。
- [ ] テンプレの `appsscript.json` に **webapp**（executeAs: USER_DEPLOYING / access: ANYONE_ANONYMOUS）と **script.container.ui** スコープが入っている。
- [ ] Apps Script API の有効化は**不要**（手動デプロイ方式のため。ユーザーはトグル操作なしで完結）。
- [ ] マニフェスト変更リリース時は**テンプレ更新＋再デプロイ案内**を忘れない（手順 4）。

---

## 参考：ユーザー側の流れ（要約）

1. アプリの API 設定「テンプレートをコピー」ボタン、または `/copy` リンクでテンプレをコピー。
2. `Autopost 連携 → セットアップ（デプロイ手順）`（シート作成＋コード生成＋手順ダイアログ、初回のみ権限承認）。
3. ダイアログに沿って **デプロイ → 新しいデプロイ → ウェブアプリ** でデプロイ → **ウェブアプリ URL** を取得。
4. その URL と **本人確認コード**をアプリの API 設定へ貼付。
5. 更新は `Autopost 連携 → 更新手順を表示`（最新 code.js を貼り替え＋再デプロイ・URL 不変）。

詳細はユーザーマニュアル（`docs/manual`）の「初期セットアップ」を参照。
