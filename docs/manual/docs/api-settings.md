---
id: api-settings
title: API 設定（AI・Discord）
sidebar_position: 8
---

# API 設定（AI・Discord）

**プロフィール → API 設定**では、GAS 連携のほかに、AI ポスト生成と Discord 通知の設定を行います。

![API 設定画面](/img/screenshots/api-settings.png)

## AI（ポスト一括生成）の API キー

AI による投稿の一括生成を使うには、以下のいずれかの API キーを登録します。

| プロバイダー | 用途 |
| --- | --- |
| OpenAI | ChatGPT 系モデルでの生成 |
| Gemini | Google Gemini での生成 |
| Anthropic | Claude での生成 |

- キーを入力して保存すると、投稿一覧の **「AI で一括作成」**が利用できるようになります。
- Gemini はキーの形式チェックとテスト実行に対応しています。

:::info
API キーは各プロバイダーの管理画面で発行します。利用にあたっては各サービスの料金・利用規約に従ってください。
:::

## Discord 通知

投稿結果を Discord に通知する設定です。手順は「[Discord に通知する](./notifications.md)」を参照してください。

## GAS 連携

Google スプレッドシートの接続設定です。手順は「[初期セットアップ](./getting-started.md)」を参照してください。
