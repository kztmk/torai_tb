---
id: connect-accounts
title: Connect SNS accounts
sidebar_position: 3
---

# Connect SNS accounts

Register your Bluesky / Threads accounts from the **SNS** tree in the left menu. Clicking a parent item (Bluesky / Threads) opens the account management screen for that platform. Registered accounts appear as branches of the tree; clicking one takes you to that account's posting screen.

![SNS tree in the left menu](/img/screenshots/sns-tree.png)

## Connect Bluesky

1. Open **Bluesky** in the left menu and click "Add account".
2. Enter the following:

   | Field | Description |
   | --- | --- |
   | Display name | A name used for display within the app |
   | Account ID | An ID to identify the account within the app |
   | Handle | Your Bluesky handle (e.g. `example.bsky.social`) |
   | App Password | An app password issued in Bluesky (`xxxx-xxxx-xxxx-xxxx`) |

3. Save to complete registration.

:::info Issuing an App Password
Issue an App Password from Bluesky's **Settings → Privacy and Security → App Passwords**. Be sure to use an app password, not your normal login password.
:::

![Bluesky account registration](/img/screenshots/bluesky-register.png)

## Connect Threads

Threads requires Meta OAuth authorization.

1. Open **Threads** in the left menu and click "Add account".
2. Enter the following:

   | Field | Description |
   | --- | --- |
   | Display name | A name used for display within the app |
   | Account ID | An ID to identify the account within the app |
   | App ID | The App ID of the Threads app you created in the Meta developer portal |
   | App Secret | The corresponding App Secret |

3. After saving, proceed to the Meta authorization screen from the **Authorize** button and grant access with the target Threads account.
4. Once authorization completes, an access token is saved and you can post.

![Threads account registration and authorization](/img/screenshots/threads-register.png)

:::tip Multiple accounts
Both Bluesky and Threads support multiple accounts. If you select multiple accounts when creating a post, you can publish the same content at once (cross-posting).
:::

Once your accounts are registered, proceed to "[Create posts](./create-posts.md)".
