# Google Calendar Booking Pages for ProChat

## Decision

Google Calendar appointment schedules are not currently creatable through the available local `gws` CLI surface.

What the CLI supports:
- Standard Calendar resources such as `calendars`, `calendarList`, and `events`
- Event creation and listing

What I could not find:
- Any `appointmentSchedules`, `bookingPages`, or similar Calendar API resources or methods in the local CLI schema
- Any CLI path that creates a Google Calendar booking page / appointment schedule directly

Therefore, the booking pages for `info@prochat.tools` must be created manually in the Google Calendar web UI.

## Why this matters

Google Calendar appointment schedules are the correct product for ProChat’s `/book` page. Do not replace them with normal calendar events. Normal events do not generate public booking URLs or the booking-page behavior needed for visitors.

## Manual setup steps

Use the Google Calendar web UI while signed in as `info@prochat.tools`:

1. Open Google Calendar.
2. Create a new appointment schedule.
3. Ensure the schedule checks existing busy time so the page does not offer conflicting slots.
4. Limit booking to weekdays only.
5. Add a booking window with advance notice and a reasonable future range.
6. Copy the public booking URL after saving each schedule.
7. If Google offers a paid-booking or Stripe step, complete that separately in the UI only if you want paid bookings enabled.

## Offer 1

### Name

AI Fit Check

### Duration

15 minutes

### Price

Free

### Purpose

A short call for questions, doubts, worries, and quick triage. The goal is to understand what the person wants to achieve with AI and whether a focused setup session makes sense.

### Description

Bring your main question, problem, or goal. In 15 minutes we will clarify where you are stuck, what you want AI to help with, and whether a practical AI setup session is the right next step.

### Preparation instructions

Please prepare your main plan, problem, or goal before the call. Come with one clear outcome you want to achieve.

### Suggested scheduling settings

- Weekdays only, Monday through Friday
- No weekend bookings
- Respect busy time on the calendar
- Add buffer time if Google Calendar supports it
- Avoid very early or late calls
- Require booking at least 12 to 24 hours in advance
- Limit availability to the next 30 to 60 days

### Suggested booking-page copy

Short, practical help to clarify your AI goal and see whether a focused setup session makes sense.

### Public link

Copy the booking page URL from the appointment schedule’s share or booking-page section after saving.

## Offer 2

### Name

Personal AI Setup Session

### Duration

60 minutes

### Price

$150

### Purpose

A focused 1:1 session to help someone configure their personal or business AI environment.

### Description

A practical 60-minute session for AI setup, automations, local tools, CLI setup, privacy/security basics, and a simple AI workflow plan after the call. This is for people who want help making AI useful in their work, business, or personal productivity setup.

### Included

- Answer questions, doubts, and worries
- Help with practical AI usage
- Help with automations where feasible inside the session
- Help install local tools and CLIs where feasible
- Help with privacy/security basics
- Create a simple AI workflow plan after the call

### Not included

- Full custom software development
- Guaranteed business results
- Complex automation builds that do not fit inside the hour
- Enterprise security consulting
- Legal, medical, or financial advice
- Unlimited follow-up support
- Remote control of the client’s computer unless Steve explicitly decides otherwise
- Extra implementation work beyond the 60 minutes

### Boundary note

If the work cannot be completed during the 60-minute session, the person can hire Steve for additional scoped work separately.

### Preparation instructions

Please prepare your main plan, problem, or goal before the call. Come with one clear outcome you want to achieve.

### Suggested scheduling settings

- Weekdays only, Monday through Friday
- No weekend bookings
- Respect busy time on the calendar
- Add buffer time if Google Calendar supports it
- Avoid very early or late calls
- Require booking at least 12 to 24 hours in advance
- Limit availability to the next 30 to 60 days

### Paid booking note

If Google Calendar offers paid appointment bookings for this Workspace account, configure payment in the Google Calendar UI only after confirming the Stripe/payment setup is available and intended.

If paid booking cannot be configured from the UI or is not available on the subscription, create the booking page without payment and handle payment manually outside the booking page.

### Suggested booking-page copy

Get practical help setting up AI for your work, business, or personal productivity.

### Public link

Copy the booking page URL from the appointment schedule’s share or booking-page section after saving.

## CTA labels for website

- Primary: `Book a free AI Fit Check`
- Secondary: `Book a 60-minute AI Setup Session`

## What to copy into the final /book page later

- Two booking links, one per appointment schedule
- The short positioning line:
  - `Get practical help setting up AI for your work, business, or personal productivity.`
- The exact CTA labels above

## Validation checklist

- Confirm the appointment schedule names match the two offers above
- Confirm busy time is respected
- Confirm weekday-only availability
- Confirm booking lead time is at least 12 to 24 hours
- Confirm future booking range is limited to 30 to 60 days
- Confirm the free offer has no payment step
- Confirm the paid offer only uses Stripe/payment if verified in Google Calendar
- Confirm the public booking URLs are copied and stored for the website team

## Commands used

- `gws --help`
- `gws schema calendar.events.list`
- `gws schema calendar.events.insert`
- `gws schema calendar.appointmentSchedules.list`
- `gws schema calendar.bookingPages.list`

## Result

No appointment schedule was created from CLI.
No public booking URLs exist yet.

