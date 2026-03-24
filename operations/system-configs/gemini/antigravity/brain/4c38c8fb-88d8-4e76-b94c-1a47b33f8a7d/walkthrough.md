# Walkthrough - Commit and Push Changes

I have successfully added, committed, and pushed the pending changes to the `main` branch.

## Changes Made

- Staged the deletion of `_brain` and the addition of `.ai/brain`.
- Committed the changes with the message: `"Update repository structure: reorganize brain data"`.
- Pushed the commit to the `main` branch on GitHub.

## Landing Page Updates

I have updated the hero notice cards and pricing section:

### 1. Title Styles
- Changed "Next Online Training" and "Inheritance Builders Bootcamp Conference" to **ALL CAPS**.
- Increased font size by using `text-lg` (approximately 28% larger than previous `text-sm`).
- Added `font-bold` and `tracking-wide` for better readability.

### 2. Pricing Links
- In the "Next Online Training" box, mentions of **Pro** and **VIP** (in both metadata and description) are now clickable links.
- Clicking these links will scroll the page down to the corresponding pricing plan.
- Added `scroll-mt-32` to the pricing boxes to ensure they aren't hidden by the header after scrolling.

render_diffs(file:///Users/Office/Repos/Clients/JC Citadel/jpv-bootcamp/src/app/page.tsx)
