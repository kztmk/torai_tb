---
id: auto-posting
title: Enable auto-posting
sidebar_position: 6
---

# Enable auto-posting

Auto-posting is controlled from the **clock icon** at the top of the screen (header). You can operate it from any page.

![Auto-posting control in the header](/img/screenshots/auto-post-header.png)

## Turning it on / off and setting the interval

1. Click the clock icon in the header to open the settings panel.
2. Choose the **posting interval** (1 / 5 / 10 / 15 / 30 minutes).
3. Turn the **auto-posting switch** on to create a posting trigger in the backend.
4. The trigger runs at the specified interval and publishes **posts whose scheduled time has arrived**, in order.

The icon lights up green when auto-posting is on. If you change the interval while it is on, the trigger is automatically recreated.

## How it works

- Posts whose scheduled time has arrived are processed in **parent → child order** (for threads, children are posted after the parent).
- **Posts without a scheduled time are not published** (they are kept as "not scheduled").
- If a thread's parent has not been posted yet, the child automatically waits and is posted right after the parent.
- Once all target posts are processed, the trigger automatically stops (is deleted).

:::caution
For auto-posting to work, the GAS backend must be deployed with its latest version. If the integration is not working, check the redeployment and re-authorization on the spreadsheet side.
:::

## Engagement updates (once a day)

The lower half of the same settings panel has an **Engagement updates** switch. Turn it on and the **likes, replies, reposts and quotes** on your published posts are refreshed automatically **once a day**. The refreshed numbers appear on the "Posted" tab of the post list.

:::info It can take up to 24 hours
Google decides the exact run time, so the numbers stay empty right after you turn the switch on. **Check again the next day.** There is no button to refresh immediately — with many posts it takes several minutes and would leave the screen waiting.
:::

- If the numbers stay at **0**, the first update may not have run yet. Wait a day and check again.
- **Views and shares are not available for Bluesky** (Bluesky does not publish them). They are shown only for Threads posts.
- Turning the switch off stops the updates. Numbers already collected remain as they are.
- This is independent of the auto-posting switch. You can turn engagement updates on even while auto-posting is off.

## Knowing the results

You can check post results in the following ways:

- **Activity page** … view statistics and the error list (see "[View the Activity page](./activity.md)").
- **Discord notifications** … notify Discord of post successes and failures (see "[Notify Discord](./notifications.md)").
