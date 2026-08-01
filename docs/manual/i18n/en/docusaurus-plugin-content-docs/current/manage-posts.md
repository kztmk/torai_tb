---
id: manage-posts
title: Manage posts
sidebar_position: 5
---

# Manage posts

The post list has three tabs: "Scheduled", "Posted", and "Errors". Selecting multiple rows with the checkboxes enables bulk operations from the icon toolbar at the top.

![Post list (Scheduled tab)](/img/screenshots/post-list.png)

## Scheduled tab

A list of posts that will be published (or are drafts).

### Top toolbar (icons)

When you select rows with the checkboxes, icon buttons appear at the top. Hover over an icon to see its description.

| Icon | Function |
| --- | --- |
| New post | Opens the composer. |
| Bulk AI generation | Generates multiple post drafts at once from keywords (see below). |
| Bulk delete | Deletes the selected posts together. |
| Distribute scheduled times | Assigns scheduled times to the selected posts in order (see below). |
| Clear schedule | Clears the scheduled time of the selected posts (i.e. not scheduled). |
| Create thread | Turns the selected posts into a thread in display order. |

### Per-row actions

At the start of each row are **Edit** / **Delete** buttons and a **thread menu**.

- **Edit** — modify the body, images, and scheduled time.
- **Delete** — delete that post.
- **Thread menu** — "Detach from thread" (remove just that post from the thread) or "Release entire thread" (return the whole thread to individual posts).

### Distribute scheduled times

Select multiple posts and open "Distribute scheduled times", then specify a **start date, end date, start time, end time, and interval**; scheduled times are assigned to the selected posts in order. Use this when you want to schedule many posts at once.

:::note
This feature is unrelated to the auto-posting trigger. It simply sets the "scheduled time" of each post in bulk.
:::

![Distribute scheduled times](/img/screenshots/distribute.png)

### Bulk AI generation

Enter keywords and the AI generates multiple post drafts. You can choose which drafts to adopt with checkboxes and edit them on the spot. Adopted drafts are added to the post list.

:::info
To use AI generation, you need to register an AI (OpenAI / Gemini / Anthropic) API key in **Profile → API settings**.
:::

## Posted tab

A list of completed posts. You can check engagement (views / likes / replies / reposts / quotes / shares) and links to the posts.

- **Bluesky** … builds and links the post page URL from the post ID (AT URI). Views and shares are not available because Bluesky does not publish them, so those metrics are shown only for Threads posts.
- **Threads** … clicking the link fetches that post's permalink and opens it in a new tab.

![Posted tab](/img/screenshots/posted-list.png)

:::info When engagement numbers are 0
Metrics are refreshed **once a day**, and only while the **Engagement updates switch** under the header's clock icon is on. If the numbers stay at 0 and "Last updated" stays empty, check that the switch is on — and if you have just turned it on, give it a day. See "[Enable auto-posting](./auto-posting.md)" for details.
:::

## Errors tab

Check failed posts and their cause (error details). If you fix the cause and reschedule, the post is published again on a later auto-posting run.

Once your posts are ready, proceed to "[Enable auto-posting](./auto-posting.md)".
