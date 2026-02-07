# Update Landing Page Styles and Links

The goal is to update the hero notice titles to be ALL CAPS and larger, and to make "Pro" and "VIP" mentions in the first hero notice link to their respective pricing plans.

## Proposed Changes

### [Frontend] [page.tsx](file:///Users/Office/Repos/Clients/JC Citadel/jpv-bootcamp/src/app/page.tsx)

#### [MODIFY] [page.tsx](file:///Users/Office/Repos/Clients/JC Citadel/jpv-bootcamp/src/app/page.tsx)
-   Update `heroNotices` data to use ALL CAPS for titles.
-   Change `heroNotices` data structure to allow `React.ReactNode` for `meta` and `description` to include links.
-   Add links to "Pro" and "VIP" in the first notice's `meta` and `description`.
-   Update the rendering of notice titles to use `text-lg` (or custom size) and `uppercase`.
-   Add unique IDs to pricing plan containers (`pricing-pro`, `pricing-vip`) to enable smooth scroll anchoring.

## Verification Plan

### Automated Tests
-   None (manual UI verification required).

### Manual Verification
-   Run `npm run dev` and verify visually:
    -   Titles "NEXT ONLINE TRAINING" and "INHERITANCE BUILDERS BOOTCAMP CONFERENCE" should be all caps and ~25% larger.
    -   Clicking "Pro" or "VIP" in the first box should scroll down to the Pricing section, specifically targeting the respective plans if possible (or just the section as requested).
