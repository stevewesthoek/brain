---
type: capture
source: shortcut
para_type: resource
confidence: 0.9
area: Business Automation
created: 2026-04-06
tags:
  - automation
  - shortcut
  - api
  - workflow
  - instruction
---

# Replace Shortcut Input with Text Output

## Summary
This content provides precise instructions for configuring an automation step, specifically how to replace a static 'Shortcut Input' placeholder with the dynamic 'Text' output from a previous step within a JSON request body. This ensures proper data flow for automated tasks, likely within a platform like Apple Shortcuts.

## Key Points
- Instructions to modify the 'content' field in 'Request Body JSON'.
- Replace the 'Shortcut Input' value with the 'Text' output from a preceding 'Get text from' step.
- Ensures dynamic data input from a prior step into the content field of an API request.


## Notes
This document outlines the correct procedure for modifying a specific input within an automation workflow, likely pertaining to Apple Shortcuts or similar tools that use visual programming with 'pills' or 'variables'.

### Instructions for Configuring Automation Content Input

1.  **Locate the Target:** In the 'contents of' block, navigate to the 'Request Body JSON' section.
2.  **Identify the 'content' Row:** Find the row where the `Key` is `content` and the `Value` currently displays the blue pill labeled "Shortcut Input".
3.  **Replace the Value:** This blue "Shortcut Input" pill needs to be replaced with the dynamic output from the preceding 'Get text from' step.
    *   Tap on the blue "Shortcut Input" pill.
    *   Delete the existing pill.
    *   Tap the variable icon (often a magic wand or similar symbol).
    *   From the list of available previous step outputs, select "Text" (this specifically refers to the output from the 'Get text from Shortcut Input' step located directly above).
4.  **Confirm Other Settings:** All other elements mentioned, such as 'Get Value for title in title' and the notification settings, are confirmed to be correct and do not require any changes based on these instructions.

This ensures that the automation properly uses dynamic text generated in an earlier step as the content for the subsequent request.

---
*ChatGPT capture · 2026-04-06 · 90% confidence · suggested: resource*
*Review in [[home|Command Center]] — promote to [[notes/projects/|projects]], [[notes/areas/|areas]], or [[notes/resources/|resources]]*