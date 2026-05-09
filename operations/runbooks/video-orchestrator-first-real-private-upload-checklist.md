# Video Orchestrator - First Real Private Upload Checklist

## Preflight
- [ ] Mac mini is online
- [ ] PostgreSQL is running
- [ ] Video package exists and is ready for upload
- [ ] Package target is marked upload-ready
- [ ] YouTube OAuth app is configured outside the repo
- [ ] OAuth client secret is not stored in the repo
- [ ] OAuth credential is stored in macOS Keychain
- [ ] `credential_reference` is known and valid
- [ ] `privacy_status` is `private`
- [ ] `real_upload_approved` is `true`
- [ ] Decision on token refresh is explicit
- [ ] Quota assumptions are understood
- [ ] Unverified-project private-viewing risk is understood
- [ ] Manual fallback package exists

## Dry Run
- [ ] Run the credential-backed dry-run path
- [ ] Run the YouTube upload preflight path
- [ ] Confirm no token values are printed
- [ ] Confirm lifecycle dashboard output stays redacted
- [ ] Confirm no credential reference is exposed in UI or API output

## Real Upload
- [ ] Upload exactly one job
- [ ] Upload exactly one video
- [ ] Keep privacy private
- [ ] Do not upload a thumbnail
- [ ] Do not upload captions
- [ ] Do not batch or schedule
- [ ] Record the returned YouTube video ID
- [ ] Run a status check for the known upload
- [ ] Verify the dashboard lifecycle summary updates safely

## Rollback / Fallback
- [ ] If upload fails, use the manual package
- [ ] If privacy is wrong, stop and fix manually in YouTube Studio
- [ ] If credentials fail, delete or recreate the Keychain entry
- [ ] If lifecycle data is ambiguous, treat it as unknown and do not widen access

## Operator Notes
- Do not put secrets in `.env`
- Do not save token JSON to disk
- Do not enable public or unlisted upload
- Do not add thumbnail, caption, bulk, or scheduler logic to the run
- Do not treat dashboard state as the source of truth for publication status
