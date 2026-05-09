# Video Orchestrator - Security Boundary Checklist

Use this checklist before any future expansion of the Video Orchestrator.

## Secrets
- [ ] No secrets are added to repo files
- [ ] No secrets are written to `.env`
- [ ] No secrets are logged
- [ ] No secrets are emitted in events or dashboard payloads

## Keychain
- [ ] Keychain access is explicit and narrowly scoped
- [ ] Keychain reads never print token values
- [ ] Keychain writes never store non-token material
- [ ] Keychain values are not copied into DB rows

## OAuth
- [ ] OAuth is explicitly approved before use
- [ ] Token exchange is user-invoked only
- [ ] Callback validation stays localhost-only
- [ ] No additional OAuth scopes are added without review

## YouTube Upload
- [ ] Upload stays private-only unless separately approved
- [ ] Public upload remains disabled
- [ ] Unlisted upload remains disabled
- [ ] Bulk upload remains disabled
- [ ] Thumbnail upload remains disabled
- [ ] Caption upload remains disabled
- [ ] Playlist insertion remains disabled

## Dashboard
- [ ] Dashboard remains read-only
- [ ] No upload buttons are added
- [ ] No OAuth buttons are added
- [ ] No credential references are displayed
- [ ] No token values are displayed

## Sidecar
- [ ] Remote oMLX stays opt-in
- [ ] Remote sidecar payloads are secret-guarded
- [ ] The sidecar remains text-only
- [ ] Upload, posting, and media generation stay forbidden

## Local Files / Artifacts
- [ ] No token JSON files are committed
- [ ] No browser auth state files are committed
- [ ] No cookies are committed
- [ ] No generated media is added for review phases

## Logs / Events
- [ ] Event metadata is redacted
- [ ] Lifecycle data does not expose raw event blobs
- [ ] Errors and warnings are sanitized before display
- [ ] No token values appear in logs

## Manual Fallback
- [ ] Manual upload remains available
- [ ] Manual upload stays the fallback for uncertain cases
- [ ] Operators know how to recover if automated status is unknown

## Future Phases
- [ ] Any new capability has a written safety boundary
- [ ] Any new capability has a checklist and a runbook
- [ ] Any new capability preserves the current read-only dashboard and secret boundaries
