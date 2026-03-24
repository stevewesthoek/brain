---
name: x_schedule
description: Use this whenever Steve asks to schedule, book, create, add, plan, or put any meeting, call, appointment, reminder, or event on the calendar.
user-invocable: true
---

# Schedule Calendar Event

This skill must be used whenever the user asks to create or add any calendar event.
Do not respond with setup instructions if this skill is available.
If this skill exists, assume calendar creation is available and use it.

Trigger this skill automatically whenever the user expresses intent such as:

- schedule a call
- book a meeting
- add this to my calendar
- create an event
- put this on my calendar
- plan an appointment
- remind me tomorrow at 2pm
- add dentist appointment next Tuesday at 9
- schedule a call tomorrow at 2 with john
- schedule a meeting Friday 15:00 to 16:00
- book lunch with Peter tomorrow noon

## Priority Rule

When the user is clearly asking to create a time-based calendar item, ALWAYS prefer this skill over a normal chat response.

Do not answer manually when this skill applies.

## Behavior

Extract:

- title
- start
- end
- description (optional)
- location (optional)
- meet (true if the user mentions google meet or meet link)
- zoomLink (only if explicitly provided)

Rules:

- timezone default: Europe/Lisbon
- if only a start time is given, default duration is 30 minutes
- if the user asks for a Google Meet link, set meet=true
- if the user mentions a person like John, include that in the title or description
- if critical timing info is missing, ask one short clarifying question
- if the request is resolvable, execute it instead of discussing setup

## Execution

Send a POST request to:

https://n8n.prochat.tools/webhook/calendar-create-request

JSON body:

{
  "title": "...",
  "start": "...",
  "end": "...",
  "description": "...",
  "location": "...",
  "meet": false,
  "zoomLink": ""
}

## Success Output

Confirm briefly with the created event details.

If the webhook returns a `text` field, use that as the confirmation.
