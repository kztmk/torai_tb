---
id: connect-accounts
title: SNS アカウントを連携する
sidebar_position: 3
---

# SNS アカウントを連携する

左メニューの **SNS** ツリーから、Bluesky / Threads のアカウントを登録します。親項目（Bluesky / Threads）をクリックすると、そのプラットフォームのアカウント管理画面が開きます。登録済みのアカウントはツリーの枝として表示され、クリックすると各アカウントの投稿画面に移動します。

![左メニューの SNS ツリー](/img/screenshots/sns-tree.png)

## Bluesky を連携する

1. 左メニューの **Bluesky** を開き、「新規アカウント登録」をクリックします。
2. 次を入力します。

   | 項目 | 説明 |
   | --- | --- |
   | 表示名 | アプリ内での表示用の名前 |
   | アカウント ID | アプリ内で識別するための ID |
   | ハンドル | Bluesky のハンドル（例: `example.bsky.social`） |
   | App Password | Bluesky で発行したアプリパスワード（`xxxx-xxxx-xxxx-xxxx`） |

3. 保存すると登録完了です。

:::info App Password の発行
App Password は Bluesky の **設定 → プライバシーとセキュリティ → アプリパスワード**から発行します。通常のログインパスワードではなく、必ずアプリパスワードを使用してください。
:::

![Bluesky アカウント登録](/img/screenshots/bluesky-register.png)

## Threads を連携する

Threads は Meta の OAuth 認可が必要です。

1. 左メニューの **Threads** を開き、「新規アカウント登録」をクリックします。
2. 次を入力します。

   | 項目 | 説明 |
   | --- | --- |
   | 表示名 | アプリ内での表示用の名前 |
   | アカウント ID | アプリ内で識別するための ID |
   | App ID | Meta 開発者ポータルで作成した Threads アプリの App ID |
   | App Secret | 同じく App Secret |

3. 保存後、**認可（Authorize）** ボタンから Meta の認可画面に進み、対象の Threads アカウントで許可します。
4. 認可が完了するとアクセストークンが保存され、投稿できるようになります。

![Threads アカウント登録・認可](/img/screenshots/threads-register.png)

:::tip 複数アカウント
Bluesky・Threads とも、複数アカウントを登録できます。投稿作成時に複数アカウントを選べば、同じ内容を一度に投稿（クロスポスト）できます。
:::

アカウントを登録したら、「[投稿を作成する](./create-posts.md)」に進みます。
