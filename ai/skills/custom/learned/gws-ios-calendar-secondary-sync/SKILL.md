---
name: gws-ios-calendar-secondary-sync
description: iOS Calendar app cannot sync or edit Google secondary calendars regardless of account setup — iCal feeds return 404, subscriptions are read-only. Google Calendar app is the only working option on iOS.
---

# iOS Calendar App Cannot Sync Google Secondary Calendars

## The insight
Apple's iOS Calendar app has a fundamental limitation: it only reliably syncs the **primary** Google calendar (the one whose ID is the account email address). Secondary/group calendars (Family, Personal, Work — any calendar with `c_xxx@group.calendar.google.com` ID) do not sync to iOS Calendar app even when:
- The Google account is correctly added to iOS with Calendar enabled
- The account is removed and re-added
- Calendar sync is toggled off and back on

This is not a configuration problem. It's an Apple design limitation.

## When this applies
- User adds a Google account to iOS Settings → Calendar enabled
- Secondary calendars (Family, Personal, shared Work) don't appear in iOS Calendar app
- Google Calendar app on iOS shows them correctly
- iCal subscription URLs for secondary calendars return 404
- Subscribed calendars appear as read-only (can view, cannot create events)

## The approach
Don't troubleshoot the iOS Calendar app for secondary Google calendars — it won't work. The decision tree:
1. **Must edit events on iOS?** → Use Google Calendar app (only option)
2. **Read-only is acceptable?** → iCal subscription works for primary calendars; 404 for secondary
3. **Must use iOS Calendar app?** → Only works with the primary calendar

## The fix
- Install **Google Calendar app** on iOS — supports full read/write for all Google Calendars including secondary
- Accept that iOS Calendar app is for iCloud calendars; Google Calendar app is for Google Calendars
- For shared calendars (e.g. wife's Family calendar): she uses Google Calendar app on iOS

## Gotchas
- iCal feed URLs (`calendar.google.com/calendar/ical/{id}/public/basic.ics`) return 404 for secondary/group calendar IDs — even when the calendar is set to "public" via API. The public ACL setting does not enable the iCal feed endpoint.
- Making a calendar "public" via `acl().insert` with `scope.type = "default"` does NOT make its iCal feed accessible
- iOS shows "Validation failed. Please edit the URL and try again" when the iCal URL is 404
- MacOS Calendar app handles Google secondary calendar sync better than iOS

## Context
Repo: brain / GWS tooling
Discovered: 2026-04-09
Area: iOS Calendar, Google Calendar, secondary calendar sync
