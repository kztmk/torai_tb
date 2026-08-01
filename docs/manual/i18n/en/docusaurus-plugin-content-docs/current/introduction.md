---
id: introduction
title: Introduction
sidebar_position: 1
slug: /
---

# What is Autopost

**Autopost** is a web app for creating, scheduling, and automatically publishing posts to **Threads** and **Bluesky**. It supports posting to multiple accounts at once (cross-posting), threaded posts, image attachments, bulk AI draft generation, and Discord notifications of post results.

Your post data is stored in your own **Google Spreadsheet** (the GAS backend), and images are stored in your own **Google Drive**. Neither data nor cost is concentrated on the operator's side.

## Supported platforms

| Platform | Authentication | Character counting |
| --- | --- | --- |
| **Threads** | Meta OAuth authorization | Characters (code points) |
| **Bluesky** | Handle + App Password | Graphemes |

## Overall flow

1. **Create an account and sign in** — register with your email address.
2. **Connect GAS** — connect your Google Spreadsheet as the backend.
3. **API settings** — register AI keys and a Discord webhook if needed.
4. **Connect SNS accounts** — register your Bluesky / Threads accounts.
5. **Create posts** — write text, attach images, and set a scheduled time.
6. **Manage posts** — edit, reorder, and distribute scheduled times from the list.
7. **Turn on auto-posting** — enable auto-posting from the clock icon in the header.
8. **Check results** — review results on the Activity page or via Discord notifications.

:::tip Language
The right-hand language switcher, as well as the app itself, supports **Japanese / English**. You can switch this manual to Japanese from the dropdown at the top right.
:::

Start with "[Getting Started](./getting-started.md)" and proceed in order.
