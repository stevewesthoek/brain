# Brain Core Live HTTP Verification

## Result

- Brain Core live start was attempted with `npm run --prefix projects/brain-core dev`.
- The local server bound to `http://127.0.0.1:4877`.
- Live HTTP verification passed on the read-only endpoints.

## Endpoints Checked

- `/status`
- `/capabilities`
- `/runtime/reports`
- `/local-apps`
- `/video/status`
- `/video/queue`
- `/scheduler/jobs`

## Generated Reports Used

- `runtime/local/local-apps/latest.json`
- `runtime/local/video/latest.json`

## Safety Checks

- `executableActionsEnabled` is `false`
- runtime reports set `writesToMind: false`
- runtime reports set `executableActions: false`
- Brain Console is still not installed in Mind
- no POST endpoints were called during verification
- no Mind files were touched

## Package Verification

- Brain Console package output exists in `projects/brain-console-obsidian/release/`
- release output is ignored and remains unstaged
- package contents were inspected and remained install-safe

## Remaining Blocker

- actual Obsidian manual install/test still requires explicit user approval
