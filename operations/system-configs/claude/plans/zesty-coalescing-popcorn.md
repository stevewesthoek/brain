# Plan: Fix Google Ads DB path + Merge Mutations into Google Ads tab

## Context
ProBot dashboard has two issues:
1. Google Ads database path is wrong (`data/google-ads/google_ads.sqlite3`) — actual location is `operations/google-ads/data/google_ads.sqlite3`. This causes both the GA widget and the Mutations tab to show "database not found".
2. There are two separate tabs (Google Ads + Mutations) that both read from the same database. Merging them cleans up the UI.

**File:** `/Users/Office/Repos/stevewesthoek/brain/projects/probot/src/bot/dashboard.ts`
**Build:** `cd projects/probot && npm run build` (tsc → `dist/`) then restart the ProBot process.

---

## Changes

### 1. Fix DB path — 3 places (replace_all)
All three occurrences of:
```ts
path.join(os.homedir(), "Repos", "stevewesthoek", "brain", "data", "google-ads", "google_ads.sqlite3")
```
→ replace with:
```ts
path.join(os.homedir(), "Repos", "stevewesthoek", "brain", "operations", "google-ads", "data", "google_ads.sqlite3")
```
Affected lines: 715, 818, 2237. Use `replace_all: true` since the string is identical everywhere.

### 2. Delete Mutations tab button (line ~1541)
Remove:
```html
    <button class="tab-btn" data-tab="mutations">Mutations <span class="tab-count" id="cnt-mutations"></span></button>
```

### 3. Delete Mutations tab panel div (line ~1553)
Remove:
```html
  <div class="tab-panel" id="tab-mutations"></div>
```

### 4. Merge mutations render into Google Ads panel (lines ~2081–2089)
Current:
```js
const gaPending = d.googleAds && d.googleAds.pendingMutations ? d.googleAds.pendingMutations : 0;
document.getElementById('cnt-google-ads').textContent=gaPending?String(gaPending):'';
document.getElementById('tab-google-ads').innerHTML=renderGoogleAds(d.googleAds);
```
...and further down (lines 2087–2089):
```js
const mutCount=d.mutations&&d.mutations.mutations?d.mutations.mutations.length:0;
document.getElementById('cnt-mutations').textContent=mutCount?String(mutCount):'';
document.getElementById('tab-mutations').innerHTML=renderMutations(d.mutations);
```

Replace the three GA lines AND remove the three mutations lines, replacing with:
```js
const gaPending = d.googleAds && d.googleAds.pendingMutations ? d.googleAds.pendingMutations : 0;
document.getElementById('cnt-google-ads').textContent=gaPending?String(gaPending):'';
document.getElementById('tab-google-ads').innerHTML=renderGoogleAds(d.googleAds)+renderMutations(d.mutations);
```

---

## Build & Restart
```bash
cd /Users/Office/Repos/stevewesthoek/brain/projects/probot
npm run build
# Then kill and restart ProBot process (PID from: ps aux | grep probot)
```

ProBot runs as a macOS app (PID 10626). After build, use ProBot restart mechanism or reopen the app.

---

## Verification
1. Open ProBot dashboard → Google Ads tab should load without "database not found" error.
2. Scroll down in Google Ads tab — Pending Mutations table should appear below the metrics.
3. No "Mutations" tab button visible in the tab bar.
4. Mutation approve/reject/apply actions still work (API handler unchanged, just DB path fixed).
