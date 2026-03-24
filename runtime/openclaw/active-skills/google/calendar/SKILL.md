---
name: google_calendar
description: Handle calendar reads and changes through hardened n8n webhooks with conflict checks, confirmations, and post-write verification.
user-invocable: true
---

# Google Calendar

Use this skill whenever Steve asks to:
- read calendar events
- ask what is on the calendar today, tomorrow, this week, next week, this month, or last week/month
- ask what meetings are scheduled
- schedule or create an event
- create an all-day event
- create a recurring event
- create a meeting with a Google Meet link
- update or cancel an event

## Priority Rule

Always prefer this skill over a normal chat response whenever the user is clearly asking to read or change calendar data.

Do not respond with setup instructions if this skill exists.

## Safety Rules

- Never delete on first pass
- Never update on first pass
- Never send guest notifications by default
- Before create or update, check for conflicts and surface them
- After create, update, or delete, rely on the webhook verification response
- If destructive or ambiguous, ask one short confirmation question

## Read Behavior

For read-style requests, call:

https://n8n.prochat.tools/webhook/calendar-read

POST JSON body examples:

{ "range": "today" }
{ "range": "tomorrow" }
{ "range": "week" }
{ "range": "next_week" }
{ "range": "month" }
{ "range": "past_week" }
{ "range": "past_month" }
{ "range": "all" }
{
 "range": "custom",
 "start": "2026-03-01T00:00:00Z",
 "end": "2026-04-01T00:00:00Z"
}

If the user gives a search term, include:
{ "range": "...", "query": "..." }

## Create Behavior

For create-style requests, call:

https://n8n.prochat.tools/webhook/calendar-create-request

Default to preview mode first:

{
 "title": "...",
 "start": "...",
 "end": "...",
 "description": "...",
 "location": "...",
 "allDay": false,
 "attendees": [],
 "useDefaultReminders": true,
 "meet": false,
 "rrule": "",
 "confirmed": false,
 "sendUpdatesApproved": false
}

Rules:

- timezone default: Europe/Lisbon
- if only a start time is given, default duration is 30 minutes
- if the user asks for a Google Meet link, set meet=true
- if the user asks for recurring events, generate an RRULE
- if the user asks for an all-day event, set allDay=true
- if conflicts are returned, surface them and ask whether to proceed with a suggested or chosen slot
- only create when the user explicitly confirms, then retry with confirmed=true
- do not send invites by default; keep sendUpdatesApproved=false unless Steve explicitly asks

## Update/Delete Behavior

For update or cancel requests, call:

https://n8n.prochat.tools/webhook/calendar-manage

Default to preview mode first:

Update preview:
{
 "action": "update",
 "eventId": "...",
 "searchTitle": "...",
 "title": "...",
 "start": "...",
 "end": "...",
 "description": "...",
 "location": "...",
 "attendees": [],
 "rrule": "",
 "meet": false,
 "confirmed": false,
 "sendUpdatesApproved": false
}

Delete preview:
{
 "action": "delete",
 "eventId": "...",
 "searchTitle": "...",
 "confirmed": false,
 "sendUpdatesApproved": false
}

Rules:

- If eventId is not available, the manage workflow can use title/search-based lookup
- If multiple matches are returned, ask Steve to choose
- Only execute update/delete when Steve explicitly confirms, then retry with confirmed=true
- Never delete automatically
- Never send guest notifications by default

## Output Rules

- If a webhook returns a text field, return only that text
- Keep the response concise
- Do not mention webhook or integration details
- For missing critical info, ask one short clarifying question
