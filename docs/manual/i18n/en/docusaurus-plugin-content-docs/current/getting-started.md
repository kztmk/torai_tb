---
id: getting-started
title: Getting Started
sidebar_position: 2
---

# Getting Started

These steps take you from creating an account to connecting the backend (your Google Spreadsheet). Copying the template is a button click, you only need a few clicks to deploy, and the rest (sheet creation, verification code, URL retrieval) is automatic.

:::tip About the order
Proceed in this order: **deploy first → reload the sheet → run the menu**. This way, Google's authorization (popup) happens only once. The "Set up" menu appears only after the deployment is complete.
:::

## 1. Create an account and sign in

1. Enter your email address and a password on the sign-up screen to create an account.
2. If you already have an account, log in from the sign-in screen.
3. If you forgot your password, you can reset it from "Forgot password".

![Sign-in screen](/img/screenshots/signin.png)

## 2. Copy the template

In the app, open **Profile → API settings** and click the **"Copy the template to Google Drive" button** in the "First-time setup" section at the top. Google's "Make a copy" screen opens; go ahead and create the copy (do this **while signed in to Google**). The script is copied along with it, and the copied sheet opens automatically.

## 3. Deploy as a web app

In the copied sheet, do the following:

1. Open **"Extensions → Apps Script"** from the sheet menu.
2. Click **"Deploy → New deployment"** at the top right of the script editor.
3. Click **"Select type" (gear) → choose "Web app"**.
4. Click **"Deploy" → "Authorize access"** → allow on Google's screen (**"Select all" → "Continue"**).
5. Copy the shown **"Web app URL"** (`https://script.google.com/macros/s/.../exec`).

:::info
This "Authorize access" is the only authorization step. By deploying first, no authorization popup appears when you run the menu later.
:::

## 4. Run the setup and connect

1. Go back to the spreadsheet tab and **reload the page** (the menu updates and "Set up" appears).
2. Run the menu **"Autopost 連携" → "Set up (URL & code)"**.
3. The dialog shows the **web app URL (detected automatically)** and the **verification code** (each with a copy button). You can also review the deployment checklist.

![The "Autopost 連携" menu](/img/screenshots/gas-menu.png)

4. In the app's **Profile → API settings**, enter the following and save.
   - **Google Sheets URL** … the **web app URL** from the dialog (the label says "Google Sheets URL", but you enter this URL)
   - **GAS verification code** … the **verification code** from the dialog

![API settings (GAS connection)](/img/screenshots/gas-setup.png)

:::caution
The verification code has an expiry (about 10 minutes). If it expires, run "Set up (URL & code)" from the menu again to get a new one.
:::

## 5. Update the backend

Here is how to update the backend. The menu **"Autopost 連携" → "Show update steps"** shows the same guidance. The **web app URL does not change**, so no reconfiguration is needed on the app side.

1. Get the latest code from **"Download the GAS script (code.js) manually"** in the app's **Profile → API settings**.
2. In **"Extensions → Apps Script"**, delete all existing code, paste, and save.
3. **"Deploy" → "Manage deployments" → edit the deployment (pencil) → set Version to "New version" → "Deploy"**.

:::tip If you get a permission error
If you see "You do not have access permission to the sheet or Google Drive", redo the authorization from the **"Autopost 連携" menu** in the spreadsheet.
:::

Once connected, proceed to "[Connect SNS accounts](./connect-accounts.md)".
