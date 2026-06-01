# ProChat OS Dependency License Audit

**Status:** preliminary legal/productization support audit from current manifests and available package metadata  
**Date:** 2026-05-23  
**Scope:** `brain/package.json`, `projects/probot/package.json`, `projects/probot/package-lock.json`  
**Strategy source:** from the `brain` repo root, `../mind/wiki/organisations/prochat/brand/prochat-os-strategy.md`

This is an execution-facing dependency/license audit. It must support the canonical ProChat OS strategy in `mind`; it must not redefine product strategy, category, positioning, or business direction.

## Summary

No blocking dependency license issue was found in the current ProBot direct dependency set.

The current direct runtime and development dependencies are permissive: MIT, BSD-2-Clause, or Apache-2.0 based on package metadata and upstream project pages.

This is compatible with a ProChat OS source-available/non-commercial license, provided third-party notices are preserved.

## Important limitation

A full machine-generated lockfile audit was not completed in this pass because the BuildFlow context read for the lockfile/search timed out while extracting every transitive license entry.

Before public release, run a dedicated local audit command in the public extraction repo and commit the generated notice file.

Recommended command for the public repo:

```bash
npx license-checker --production --summary
npx license-checker --production --json > THIRD_PARTY_LICENSES.json
```

## Direct package audit

### Root `brain/package.json`

| Package | Role | Declared/known license | Risk |
|---|---|---|---|
| machine-brain | private package metadata | UNLICENSED | Low; private package metadata now avoids accidental MIT publication. |

The root package previously declared `MIT`; it now declares `UNLICENSED` because the private brain repo is not the public product license. Public ProChat OS packages should use:

```json
"license": "SEE LICENSE IN LICENSE.md"
```

### `projects/probot/package.json`

| Package | Scope | License | Risk | Notes |
|---|---|---:|---:|---|
| `@slack/bolt` | runtime | MIT | Low | Slack Bolt JS upstream is MIT. |
| `better-sqlite3` | runtime | MIT | Low | Native module; license is permissive, packaging can be operationally sensitive. |
| `dotenv` | runtime | BSD-2-Clause | Low | Permissive; preserve notices. |
| `grammy` | runtime | MIT | Low | Telegram bot framework. |
| `zod` | runtime | MIT | Low | Schema validation library. |
| `@types/better-sqlite3` | dev | MIT | Low | Type declarations. |
| `@types/node` | dev | MIT | Low | Type declarations. |
| `tsx` | dev | MIT | Low | TypeScript runner. |
| `typescript` | dev | Apache-2.0 | Low | Preserve notices; patent grant is compatible. |

## Transitive dependency notes

The visible `projects/probot/package-lock.json` entries are largely MIT in the accessible portion, including esbuild optional platform packages.

A final public release should generate a complete `THIRD_PARTY_LICENSES.json` or `NOTICE.md` from the final extracted repo, because transitive dependencies can change with every install/update.

## License compatibility with ProChat OS strategy

Permissive dependencies generally allow ProChat OS to be distributed under a more restrictive source-available license for Steve's own code.

Rules:

1. Do not remove third-party copyright notices.
2. Do not claim third-party dependencies are owned by ProChat.
3. Include dependency license notices in public distributions.
4. Keep dependency source/license links available in documentation.
5. Re-run the audit before every public release.

## Publishing checklist

Before publishing `prochat-os`:

- [ ] Replace any `MIT` package metadata for ProChat-owned packages.
- [ ] Add `LICENSE.md` for ProChat OS source-available terms.
- [ ] Add `COMMERCIAL-LICENSE.md` summary/contact file.
- [ ] Add `TRADEMARKS.md`.
- [ ] Generate `THIRD_PARTY_LICENSES.json` from the final dependency tree.
- [ ] Add a dependency audit CI step.
- [ ] Ensure no dependency has AGPL, GPL, SSPL, BUSL, Commons Clause, or unknown license unless intentionally approved.

## Current recommendation

Proceed with productization, but do not publish the current private repos directly. Extract the public code into a clean repo and run the final automated audit there.
