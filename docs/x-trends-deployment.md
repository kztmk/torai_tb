# 東京のXトレンド取得機能 デプロイ手順

## 認証方式

`updateTokyoXTrends` はX API v2の `GET /2/trends/by/woeid/1118370` を使用します。
読み取り専用のアプリ認証であるため、実際のAPI呼び出しには `API_KEY` と
`API_KEY_SECRET` をFirebase Secretsの `X_API_KEY` と `X_API_KEY_SECRET` に保存し、
そこから生成したBearer Tokenを使用します。

## Secretの設定

環境ごとに設定します。値をコマンドラインへ直接記載せず、プロンプトへ貼り付けてください。

```bash
firebase functions:secrets:set X_API_KEY -P preview
firebase functions:secrets:set X_API_KEY_SECRET -P preview
```

本番では `-P preview` を `-P prod` に置き換えます。

## デプロイ

```bash
npm run deploy:functions:preview
firebase deploy --only firestore:rules -P preview
npm run build:preview
npm run deploy:hosting:preview
```

本番では各コマンドの `preview` を `prod` に置き換えます。Hostingの本番ビルドは
`npm run build` を先に実行します。

## 初回取得の確認

デプロイ直後は、Firebase ConsoleのCloud Schedulerで
`firebase-schedule-updateTokyoXTrends-asia-northeast1` を手動実行します。

実行後、次を確認します。

1. Functionsログに `Tokyo X trends updated.` が記録される。
2. Firestore `XTrends` に新しいドキュメントが作成される。
3. 虎威の「アクティビティ > トリガー管理」に東京のXトレンドが表示される。

X APIは従量課金のため、定期実行間隔は4時間です。失敗時の再試行は1回に制限しています。
Firestoreには最新12回分（約48時間）を保持し、画面には最新6回分（約24時間）を表示します。
