---
name: meta-app-review-copy-facebook-page-posting
description: Battle-tested Meta app review submission copy for page posting integrations — speeds up permission justification without rediscovery.
---

# Meta App Review Copy: Facebook Page Posting

## The insight

Meta's app review process requires detailed justifications for each permission. The copy must be:
- **Specific** (not generic "we use this for posting")
- **Legitimate** (explains real use case, not circumventing restrictions)
- **Demonstrable** (you must provide a video or API test proving it works)
- **Aligned with Meta's allowed usage** (they publish the allowed uses; your copy must reference them)

Generic copy gets rejected. Copy that's too vague gets flagged for more info. Copy that looks like data harvesting gets rejected outright.

This skill captures the exact language that worked for Says the Bible's Page posting integration, which can be adapted for similar integrations (content publishing to managed Pages, not user data collection).

## When this applies

Scenarios:
- You're submitting a Meta app for review that posts to a managed Facebook Page
- You need descriptions for `pages_show_list`, `pages_read_engagement`, and `pages_manage_posts`
- You need to write a "Reviewer Instructions" section explaining how to test the flow
- You want to avoid rejection cycles and Meta's follow-up questions

Does NOT apply if:
- You're using Facebook Login for user authentication (different permissions, different approach)
- You're accessing user data beyond Page management (audiences, analytics, etc.)
- This is a consumer-facing app that users choose to connect (different tone/framing)

## The approach

Meta's review examines four things:

1. **Purpose clarity** — why does the app need this permission?
2. **Use alignment** — does it match Meta's published "allowed usage"?
3. **User value** — how does the permission add value (not just collect data)?
4. **Demonstration** — can you prove it with a video or API test?

For each permission, structure your answer:
- **What it does** (in plain language, not API docs speak)
- **Why it adds value** (benefit to app admins, not you)
- **How it's used** (specific endpoints, not vague "we access it")
- **What isn't accessed** (reassure Meta about what you're *not* doing)

## The fix

### Permission: `pages_show_list`

**Description text:**

```
Says the Bible uses the pages_show_list permission to display the list of Facebook Pages that the app administrator manages. This allows the content team to select which Page to publish monthly Bible story episodes to.

The permission is used only during the manual reviewer workflow at https://saysthe.bible/admin/facebook-review. The app loads the managed Pages via the /me/accounts endpoint and displays them in a dropdown selector. No data is stored or transmitted beyond what is necessary to identify the target Page ID for publishing.

The permission adds value by allowing content creators to verify they are posting to the correct Page before each episode release, preventing accidental posts to wrong Pages.
```

**Screen recording:** Show the OAuth flow completing and Pages loading in a dropdown.

---

### Permission: `pages_read_engagement`

**Description text:**

```
Says the Bible uses the pages_read_engagement permission to verify Page access and retrieve Page metadata during the reviewer workflow. This ensures that the authorized user has valid access to the Says the Bible managed Page before attempting to publish content.

The app queries the /me/accounts endpoint to list all Pages the user manages and retrieves basic Page information (ID, name, access token). This metadata is used to populate the Page selector in the reviewer interface at https://saysthe.bible/admin/facebook-review, allowing content creators to confirm they are posting to the correct Page.

The permission adds value by providing a safety checkpoint in the publishing workflow. Before any post is sent, the reviewer can see all available Pages and explicitly select the target Page. No engagement data, analytics, or Page insights are accessed or stored. Only the Page ID and name are used.

This is a read-only permission used for verification purposes only, not for analytics or data collection.
```

**API test:** Query `GET /{pageId}?fields=id,name,engagement` and screenshot the response.

---

### Permission: `pages_manage_posts`

**Description text:**

```
Says the Bible uses the pages_manage_posts permission to automatically publish monthly Bible story episodes to the Says the Bible Facebook Page as part of our content distribution pipeline.

The app generates a Facebook post (message + link) for each new episode and uses the Graph API endpoint /{pageId}/feed to publish the post at a scheduled time. Posts include a brief description of the episode and a link to the product page or YouTube video.

The permission adds value by automating the social media publishing workflow, ensuring consistent content distribution without manual posting. This allows the content team to focus on story production rather than manual social media management.

The app only publishes to the managed Says the Bible Page. No personal timelines, user content, or data outside the Page is accessed or modified. Posts are created with a 15-minute delay after YouTube publication to ensure the product page is live when social traffic arrives.
```

**Screen recording:** Show the complete flow — select page, compose test post, click "Send Through n8n", show confirmation, then show the post appeared on the Facebook Page.

**API test:** Make a `POST /{pageId}/feed` call with message and link, screenshot the success response.

---

### Reviewer Instructions (main form)

**Description text:**

```
Says the Bible is a scripture-based bedtime routine system for children ages 3–10. The app publishes monthly Bible stories to Facebook as part of our content distribution pipeline.

The integration uses the Facebook Graph API to post to a single managed Facebook Page. It does not access personal timelines, friends lists, or user data beyond what is necessary to authenticate and identify the managed Page.

**To test the integration:**

1. Visit https://saysthe.bible/admin/facebook-review
2. Log in with the provided test account credentials
3. Click "Connect Facebook Reviewer Account"
4. Approve the requested permissions (pages_show_list, pages_read_engagement, pages_manage_posts)
5. Select "Says the Bible" from the Managed Page dropdown
6. Click "Send Test Post Through n8n"
7. Verify the test post appears on the Says the Bible Facebook Page

The app uses the Facebook Graph API endpoints:
- /me/accounts (to list managed Pages)
- /{pageId}/feed (to publish posts)

No personal user data is collected, stored, or retained. The integration only accesses Page management permissions.
```

**Test credentials section (optional):**

```
Test account email: [your reviewer email]
Test account password: [your reviewer password]

Access the reviewer interface at: https://saysthe.bible/admin/facebook-review
```

---

### Answer to "Are you using Facebook Login?"

```
No. We use the Facebook Graph API for Page management only. This app does not use Facebook Login for user authentication.
```

---

### Answer to "Do you use any Meta APIs?"

```
Yes. We use the Facebook Graph API with the following endpoints:
- /me/accounts — to list managed Pages
- /{pageId}/feed — to publish content to a managed Page

Both are used only for authorized Page admins managing their own Pages, not for accessing user data or third-party Pages.
```

## Gotchas

- **Screenshots/videos must be crystal clear** — Meta reviewers will watch them once. If the flow isn't obvious (small text, unclear clicks), they'll reject and ask for a re-submission.

- **Every permission needs an API test call** — if you leave it at "0 of 1 API calls required", Meta will reject. Complete the test before resubmitting.

- **Timeline: 24–72 hours** — even after approval, it can take time to show. Don't panic if it's not instant.

- **Test account credentials are required** — if your app needs a login, provide a test account that Meta can use. If you're using OAuth (like this integration), show the OAuth flow completing.

- **"We post to Facebook" is too vague** — Meta needs to know *what* you're posting, *where*, and *why*. "Monthly Bible stories to a managed Page for content distribution" is specific enough.

- **Avoid marketing language** — don't say "We help you reach more people!" Say "We publish scheduled content to your managed Page." Meta wants to know the mechanics, not the business benefit.

- **One permission per form submission** — if you're requesting multiple permissions, each gets its own review round. Submit all three, but complete the required testing for each one before resubmitting the form.

## Context

Repo: says-the-bible  
Discovered: 2026-04-07  
Area: Meta app review, Facebook Graph API integration, Page posting
