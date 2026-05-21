# CLAUDE.md — brain-console-obsidian

## Deploy pipeline — THREE steps, always in this exact order

```bash
npm run build && npm run package && npm run install:active-vault
```

Then restart Obsidian to load the new plugin:

```bash
pkill -x "Obsidian" && sleep 2 && open -a Obsidian
```

**What each step does:**
- `npm run build` — compiles TypeScript → `dist/main.js` only. Nothing is deployed.
- `npm run package` — copies `dist/ → release/`, strips stale markers. This is the actual deployment source.
- `npm run install:active-vault` — copies `release/` files to the vault plugin directory.

**Never** run only `npm run build` and call it done. **Never** skip `package`. The `release/` directory is what gets installed, not `dist/`.

## The one vault location

Obsidian loads the plugin from exactly **one place**:

```
/Users/Office/Repos/stevewesthoek/mind/.obsidian/plugins/brain-console
```

The install script (`scripts/install-active-vault.mjs`) is hardcoded to this path. Do not change it to scan for vaults — scanning caused duplicate installs to ghost directories and stale version bugs.

The vault path is confirmed in:
```
~/Library/Application Support/obsidian/obsidian.json
```

## Version naming

`BRAIN_CONSOLE_BUILD_ID` in `src/main.ts` is the version string shown in the UI header.

Format: `v{major}.{minor}` — e.g. `v2.0`, `v2.1`, `v3.0`

| Change size | Example |
|---|---|
| Small iteration | v2.0 → v2.1 |
| Bigger feature | v2.0 → v2.2 |
| Major overhaul | v2.x → v3.0 |

**When you change the version, update ALL THREE places:**
1. `BRAIN_CONSOLE_BUILD_ID` in `src/main.ts`
2. `currentMarker` in `scripts/package.mjs`
3. `expectedMarker` in `scripts/install-active-vault.mjs`

Also add the old version string to `staleMarkers` in `scripts/package.mjs` so it gets scrubbed from old installs.

## Why there was a ghost vault (never repeat this)

At some point `/Users/Office/mind/.obsidian/plugins/brain-console` was created as an empty ghost directory — no vault content, just the plugin folder. The old install script scanned all of `/Users/Office` looking for plugin directories and found both the ghost and the real vault. It deployed to both. The ghost always ended up with the stale build. This caused the repeating "stale version" bug.

**Fix applied:** The ghost was deleted. The install script now hardcodes the single correct vault path. No scanning, no discovery.

## Architecture

- Obsidian plugin (TypeScript, esbuild)
- Connects to Brain Core HTTP API at `http://localhost:4877`
- `src/main.ts` — plugin entry point, registers the view, sets `window.BRAIN_CONSOLE_BUILD_ID`
- `src/view.ts` — all UI rendering. Contains `loadBrainConsoleViewState()` which fires 131 parallel endpoint fetches
- `src/client.ts` — all HTTP fetch functions and TypeScript interfaces

## Critical: Promise.allSettled alignment

`loadBrainConsoleViewState()` in `view.ts` has a single `Promise.allSettled([...131 calls...])`. The result is destructured positionally — variable N maps to promise N. If the counts are off, variables at the end land on the wrong values (usually `undefined`).

**Always verify after touching the promise array or destructuring:**

```bash
python3 -c "
import re
with open('src/view.ts') as f: content = f.read()
pm = re.search(r'await Promise\.allSettled\(\[(.*?)\]\s*\);', content, re.DOTALL)
promises = [e.strip() for e in pm.group(1).split('\n') if e.strip() and not e.strip().startswith('//')]
dm = re.search(r'const \[(.+?)\] = settledValues', content, re.DOTALL)
dvars = [v.strip() for v in dm.group(1).split(',')]
ok = len(promises) == len(dvars)
print(f'Promises: {len(promises)}, Destructured: {len(dvars)}', '✓' if ok else '✗ MISALIGNED')
"
```

**Currently: 135 promises, 135 destructured vars, padding set to 135.**

**Symptom of misalignment:** `svc ?` and `db ?` show in every app card, or worse — a JavaScript ReferenceError on load like `videoControlledExecutionSecondApprovalPolicy is not defined`.

Past bugs:
- May 2026: 4 functions (`ProviderImplementationReadinessDashboardSummary`, `ProviderImplementationApprovalPacket`, `ProviderApprovalPacketConsoleReviewSummary`, `ProviderPlanningSurfaceIndex`) were imported and used in state but missing from the Promise.allSettled array. This pushed `localAppsOrchestratorDef` 4 slots off. Fix: add them to the promise array after `ProviderImplementationPhaseStartGate`.
- Wrong fix attempted: removing those 4 from the destructuring caused a ReferenceError crash on load because they were still referenced in state.
- Always fix misalignment by adding missing promises, never by removing destructured vars.

## What drives svc/db in app cards

`svc N` and `db yes/no` come from `state.localAppsOrchestrator.definitions`:
- `definition.services.length` → `svc N`
- `Boolean(definition.database)` → `db yes/no`

This data is fetched from `/local-apps/orchestrator`. If `localAppsOrchestrator` is `undefined` in state, both show `?`. Root cause is always the Promise alignment issue above.

## Commands

```bash
# Full deploy (always use this)
npm run build && npm run package && npm run install:active-vault

# Restart Obsidian to load new plugin
pkill -x "Obsidian" && sleep 2 && open -a Obsidian

# Type check only
npm run typecheck

# Verify promise/destructuring alignment
python3 -c "import re; ..."  # see above
```
