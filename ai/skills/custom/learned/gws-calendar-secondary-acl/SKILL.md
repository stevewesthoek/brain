---
name: gws-calendar-secondary-acl
description: When Google Workspace Calendar API ACL sharing returns HTTP 400 "Invalid scope value" for secondary/group calendars — this is not a scope problem, it's a calendar type limitation.
---

# GWS Calendar Secondary Calendar ACL Sharing Fails

## The insight
Secondary Google Workspace calendars (Family, Personal, Work — any calendar with an ID like `c_xxx@group.calendar.google.com`) have a different permission model than primary calendars. The Google Calendar API ACL endpoint rejects sharing requests for these calendars with HTTP 400 "Invalid scope value" regardless of which OAuth scopes are granted to the service account. The error message is completely misleading — it suggests a scope configuration problem but the real issue is that group/secondary calendars cannot be shared to external users via the API ACL endpoint.

## When this applies
- `svc.acl().insert(calendarId=..., body={"role": "writer", "scope": {"type": "user", "emailAddress": ...}})` returns HTTP 400
- Error message: `"Invalid scope value."` with `"reason": "invalid"`
- Calendar ID is of the form `c_xxxxx@group.calendar.google.com` (not a plain email address)
- Sharing to external accounts (outside the GWS domain)
- Trying every role value (owner, writer, reader, freeBusyReader) — all fail the same way

## The approach
Don't waste time debugging OAuth scopes or trying different role values. The limitation is the calendar type, not the auth config. Secondary/group calendars must be shared via:
1. **Google Calendar web UI** (Settings → Share with specific people) — works for in-domain and external users
2. **`calendarList.insert`** on the recipient's account — works for read-only subscription if the calendar is set to public

## The fix
For sharing with external users:
- Use the Google Calendar **web UI** — it's the only reliable path
- Permission levels available for external users: "See only free/busy" and "See all event details" (edit permissions grayed out for external)
- For read-only public subscriptions: first set `acl` with `scope.type = "default"` and `role = "reader"` (this works), then the recipient can use `calendarList.insert` with the calendar ID

## Gotchas
- Adding scopes to the service account DWD does NOT fix this — it's not a scope issue
- `"Invalid scope value"` in this context means the ACL scope (user/group/domain) is rejected for this calendar type, not the OAuth scope
- Primary calendars (ID = email address like `info@prochat.tools`) work fine with ACL API
- The web UI shows "Your organisation might limit how you can share your calendar outside of your organisation" — external users can only get read-level access, not edit

## Context
Repo: brain / GWS tooling
Discovered: 2026-04-09
Area: Google Calendar API, secondary calendars, cross-domain sharing
