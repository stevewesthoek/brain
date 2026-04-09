---
name: gws-calendar-shadow-events-antipattern
description: Creating "blocking" shadow events to prevent double-booking on a shared calendar is the wrong approach — it pollutes the owner's view and is hard to maintain. Use native freeBusyReader sharing instead.
---

# GWS Calendar Shadow Events Anti-Pattern

## The insight
When asked to prevent double-booking on a shared calendar, the instinct is to mirror work/personal events as "🚫 BLOCKED" placeholder events in the shared calendar. This is wrong for three reasons:
1. The calendar owner sees the blocking events in their own view (they can't distinguish real vs shadow events at a glance)
2. Shadow events go stale immediately — any new event on the source calendar doesn't get a shadow
3. Google Calendar already solves this natively via the `freeBusyReader` role

The native solution: share Work/Personal calendars with `freeBusyReader` role. The recipient sees grey "busy" blocks with no event titles — exactly what's needed for double-booking awareness.

## When this applies
- User wants a shared calendar where a spouse/colleague can see when slots are blocked
- User says "I don't want them to see event details, just that I'm busy"
- Temptation to write a sync script that copies events as placeholders

## The approach
Always reach for native calendar sharing before writing sync scripts:
1. Share Work calendar with `freeBusyReader` → recipient sees busy blocks, no details
2. Share Personal calendar with `freeBusyReader` → same
3. Share Family calendar with `writer` (or `reader` for external) → full visibility
4. Recipient adds all three calendars → sees complete availability picture

No automation needed. No shadow events. No stale data.

## The fix
Via Google Calendar web UI:
- Calendar settings → Share with specific people → Permission: "See only free/busy (hide details)"

Via API (primary calendars only — see `gws-calendar-secondary-acl`):
```python
svc.acl().insert(
    calendarId=cal_id,
    body={"role": "freeBusyReader", "scope": {"type": "user", "emailAddress": email}}
)
```

## Gotchas
- `freeBusyReader` via API only works on primary calendars; secondary calendars need web UI
- Shadow events created in the Family calendar are visible to the owner (info@prochat.tools) because they own the Family calendar too — this is how the mess was discovered
- Even if shadow events are cleaned up, they need a recurring sync job to stay current — this is always a maintenance burden
- The 94 blocking events created during this session had to be manually deleted via API

## Context
Repo: brain / GWS tooling
Discovered: 2026-04-09
Area: Google Calendar, shared calendars, double-booking prevention
