---
id: notifications
title: Discord に通知する
sidebar_position: 7
---

# Discord に通知する

自動投稿の結果（成功・失敗）を Discord チャンネルに通知できます。1 回の自動投稿の実行分をまとめて 1 通のメッセージで受け取れます。

![Discord 通知の例](/img/screenshots/discord-notification.png)

## 1. Discord で Webhook URL を用意する

1. 通知を受け取りたい Discord サーバーの **サーバー設定 → 連携サービス → ウェブフック**を開きます。
2. 「新しいウェブフック」を作成し、投稿先チャンネルを選びます。
3. **ウェブフック URL をコピー**します（`https://discord.com/api/webhooks/...`）。

## 2. アプリに登録する

1. **プロフィール → API 設定**を開きます。
2. **「Discord にポスト結果を送信」**をオンにします。
3. **Discord Webhook URL** に、手順 1 でコピーした URL を貼り付けます。
4. **保存**します。

![Discord 通知の設定](/img/screenshots/discord-setup.png)

:::info
Webhook URL は機密情報のため、保存後は再表示されません。変更したいときだけ、新しい URL を入力し直してください。
:::

## 3. テスト送信で確認する

設定欄の **「テスト送信」**ボタンを押すと、Discord にテストメッセージが届きます。届けば設定は正常です。

:::caution GAS 連携が前提
Discord 通知は GAS バックエンド経由で送信されます。先に「[初期セットアップ](./getting-started.md)」の GAS 連携を完了しておいてください。テスト送信が失敗する場合は、GAS バックエンドが最新版でデプロイされているか確認してください。
:::

## 通知される内容

自動投稿が実行されると、その回に処理した投稿について次の内容が通知されます。

- 成功・失敗の件数
- 各投稿のプラットフォーム（Threads / Bluesky）とアカウント
- 本文の抜粋
- 成功時は投稿 ID、失敗時はエラー内容
