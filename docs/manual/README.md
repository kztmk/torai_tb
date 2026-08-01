# Autopost ユーザーマニュアル

Threads / Bluesky 予約投稿・自動投稿ツール **Autopost** のユーザーマニュアルです。
[Docusaurus](https://docusaurus.io/) で作成し、**日本語（既定）/ 英語**の 2 言語に対応しています。

## 構成

- `docs/` … 日本語マニュアル（本文）
- `i18n/en/docusaurus-plugin-content-docs/current/` … 英語マニュアル
- `static/img/screenshots/` … スクリーンショット（現在はプレースホルダ）
- `scripts/` … スクリーンショット取得スクリプトと手順（`scripts/README.md`）

## コマンド

```bash
npm start          # 開発サーバ（日本語）
npm start -- --locale en   # 開発サーバ（英語）
npm run build      # 本番ビルド（日英まとめて）
npm run serve      # ビルド結果をローカル確認
```

## スクリーンショット

差し替え手順は [`scripts/README.md`](./scripts/README.md) を参照してください。
本物の画像を `static/img/screenshots/` に**同じファイル名**で置くと差し替わります。
