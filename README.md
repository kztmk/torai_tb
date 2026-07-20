# Snake-SNS: X自動投稿管理システム

![Snake-SNS Logo](/public/vite.svg)

Snake-SNSは、Google SpreadsheetをバックエンドとしたREST APIを利用して、X（旧Twitter）への自動投稿を管理するフロントエンドアプリケーションです。Xのアカウント管理、投稿作成、予約投稿設定、スレッド投稿設定など、X上での効果的なコンテンツ発信を支援します。

## 主な機能

- **Xアカウント管理**: 複数のXアカウントのAPI情報を登録・管理
- **投稿作成・管理**: テキスト投稿、画像付き投稿の作成と管理
- **予約投稿**: 指定日時での自動投稿スケジュール設定
- **スレッド投稿**: 複数の投稿をスレッドとして連続投稿する設定
- **投稿エクスポート**: 投稿データのCSVエクスポート機能
- **ダッシュボード**: ユーザーフレンドリーなインターフェースで投稿状況を把握

## 技術スタック

- **フロントエンド**: React + TypeScript + Vite
- **UIライブラリ**: Mantine
- **状態管理**: Redux Toolkit
- **フォーム管理**: Mantine Form + Zod
- **認証**: Firebase Authentication
- **データベース**: Google Spreadsheet (REST API経由)
- **APIクライアント**: Axios
- **テスト**: Vitest, Storybook
- **スタイリング**: Mantine + CSS Modules + PostCSS

## デプロイ方法

### 前提条件

- Node.js 16.x 以上
- npm または yarn
- Firebase アカウント
- Google Cloud Platform アカウント（Google Sheets APIの利用）
- X Developer アカウント（X APIの利用）

### インストール

```bash
# リポジトリのクローン
git clone https://your-repository-url/snake-sns.git
cd snake-sns

# 依存パッケージのインストール
npm install
# or
yarn install

# 開発サーバーの起動
npm run dev
# or
yarn dev
```

### 環境設定

`.env.develop` ファイルと `.env.production` ファイルを作成し、以下の環境変数を設定します:

```
VITE_FIREBASE_API_KEY=your-firebase-api-key
VITE_FIREBASE_AUTH_DOMAIN=your-firebase-auth-domain
VITE_FIREBASE_PROJECT_ID=your-firebase-project-id
VITE_FIREBASE_STORAGE_BUCKET=your-firebase-storage-bucket
VITE_FIREBASE_MESSAGING_SENDER_ID=your-firebase-messaging-sender-id
VITE_FIREBASE_APP_ID=your-firebase-app-id
```

## システムアーキテクチャ

Snake-SNSは以下の構造で動作します:

1. **フロントエンド**: React + TypeScriptで構築されたSPA
2. **バックエンド**: Google App Script (GAS) で構築されたREST API
3. **データストレージ**: Google Spreadsheet
4. **認証**: Firebase Authentication
5. **メディアストレージ**: Firebase Storage

### フロー概要

1. ユーザーがFirebase Authenticationでログイン
2. プロフィール設定でGoogle Sheets APIのエンドポイントURLを設定
3. Xアカウント情報を登録・管理（X APIの認証情報）
4. 投稿内容を作成し、即時投稿または予約投稿として設定
5. GASで構築されたREST APIがGoogle Spreadsheetにデータを保存
6. 予約投稿はGASのトリガー機能を利用して指定時刻に実行

## コンポーネント構造

- `XAccountsList`: Xアカウントの一覧表示と管理
- `XPostsList`: Xアカウントごとの投稿一覧表示と管理
- `XPostForm`: 新規投稿作成・編集フォーム
- `XPostScheduleForm`: 予約投稿設定フォーム

## API仕様

### エンドポイント

Google App Script で公開しているREST APIを利用します。主なエンドポイントは:

- `?action=create&target=xauth`: Xアカウント新規作成
- `?action=update&target=xauth`: Xアカウント更新
- `?action=delete&target=xauth`: Xアカウント削除
- `?action=fetch&target=xauth`: Xアカウント一覧取得
- `?action=create&target=postData`: 投稿新規作成
- `?action=update&target=postData`: 投稿更新
- `?action=delete&target=postData`: 投稿削除
- `?action=fetch&target=postData&xAccountId={id}`: アカウント別投稿一覧取得
- `?action=create&target=trigger`: 予約投稿トリガー作成

## 開発

### 開発サーバー起動

```bash
npm run dev
```

### Storybook起動

```bash
npm run storybook
```

### ビルド

```bash
npm run build
```

### テスト実行

```bash
npm run test
```

## ライセンス

MIT License

## 貢献

プルリクエストを歓迎します。大きな変更を加える場合は、まずissueを開いて議論してください。

## お問い合わせ

お問い合わせは [your-email@example.com](mailto:your-email@example.com) までご連絡ください。
