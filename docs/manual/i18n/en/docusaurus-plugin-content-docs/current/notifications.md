---
id: notifications
title: Notify Discord
sidebar_position: 7
---

# Notify Discord

You can notify a Discord channel of auto-posting results (success / failure). You receive one message summarizing each auto-posting run.

![Example Discord notification](/img/screenshots/discord-notification.png)

## 1. Prepare a Webhook URL in Discord

1. Open **Server Settings → Integrations → Webhooks** in the Discord server where you want to receive notifications.
2. Create a "New Webhook" and choose the target channel.
3. **Copy the webhook URL** (`https://discord.com/api/webhooks/...`).

## 2. Register it in the app

1. Open **Profile → API settings**.
2. Turn on **"Send post results to Discord"**.
3. Paste the URL you copied in step 1 into **Discord Webhook URL**.
4. **Save**.

![Discord notification settings](/img/screenshots/discord-setup.png)

:::info
The webhook URL is sensitive, so it is not shown again after saving. Enter a new URL only when you want to change it.
:::

## 3. Verify with a test send

Press the **"Send test"** button in the settings to send a test message to Discord. If it arrives, the setup is correct.

:::caution GAS connection required
Discord notifications are sent via the GAS backend. Complete the GAS connection in "[Getting Started](./getting-started.md)" first. If the test send fails, check that the GAS backend is deployed with its latest version.
:::

## What gets notified

When an auto-posting run executes, the following is notified for the posts processed in that run:

- The number of successes and failures
- Each post's platform (Threads / Bluesky) and account
- An excerpt of the body
- The post ID on success, or the error details on failure
