---
id: faq
title: FAQ & Troubleshooting
sidebar_position: 10
---

# FAQ & Troubleshooting

### Q. I scheduled a post but it wasn't published

Check the following:

- **Is auto-posting on?** … Check that the clock icon in the header is green (on).
- **Is a scheduled time set?** … Posts with an empty scheduled time are "not scheduled" and are not auto-posted.
- **Is the scheduled time in the past / future?** … Posts whose scheduled time has not arrived wait until that time.
- **Is GAS deployed with its latest version?** … An outdated backend may prevent auto-posting or triggers from working.

### Q. I see "You do not have access permission"

Redo the authorization from the **"Autopost 連携" menu** in the spreadsheet. If that does not resolve it, re-enter the Google Sheets URL and the verification code.

### Q. The verification code is reported as invalid

The verification code has an expiry (about 10 minutes after generation). Run **"Autopost 連携" → "Set up (deployment steps)"** again to generate a new one and enter it again (if you already deployed, you can skip the deployment steps and just paste the new code).

### Q. I can't choose "Web app" when deploying / no URL appears

After opening "Deploy → New deployment", click the **gear (Select type) → "Web app"** at the top left. After deploying, copy the **"Web app URL"** (the URL ending in `.../exec`). If you already deployed and want to check the URL, you can find it under **"Deploy → Manage deployments"**.

### Q. The popup is blocked when I try to add an image

Using local or Google Drive images requires Google authentication. The auth popup opens immediately after you click the button, so please **allow** popups in your browser.

### Q. The Discord test send fails

- Check that the webhook URL is in the correct format (`https://discord.com/api/webhooks/...`).
- Check that the GAS connection is complete first.
- Check that the GAS backend is deployed with its latest version.

### Q. I can't log into Bluesky

Bluesky uses an **App Password**, not your normal login password. Issue an app password from Bluesky's settings and register it.

### Q. Threads authorization is not reflected

Threads requires an **Authorize** step after registering the account. Check that you approved the target account on the authorization screen and that the callback completed. If authorization expires, authorize again.

### Q. Why do the character limits differ between Threads and Bluesky?

Because the counting differs. **Threads counts characters (code points)**, while **Bluesky counts graphemes**. When emoji or combining characters are included, the visible character count may differ from the internal count.

### Q. What is cross-posting?

If you select multiple accounts (even across Bluesky and Threads) in the composer, you can publish the same content to multiple accounts at once. This is called cross-posting.
