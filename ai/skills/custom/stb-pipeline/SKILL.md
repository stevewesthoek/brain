---
name: stb-pipeline
description: Says the Bible — monthly episode generation and pipeline execution. Use when generating new episodes (SSML writing, pipeline run, YouTube scheduling), checking what episodes are next, or managing the production backlog.
---

# Says the Bible — Production Pipeline

**Repo:** `/Users/Office/Repos/prochattools/web/says-the-bible`
**Output:** `/Users/Office/Repos/stevewesthoek/brain/projects/says-the-bible/production/`

---

## Current state

- Episodes **001–013** — fully produced and live on YouTube
- Episodes **014–040** — SSML ready, registered in run.mjs, and registered with the Office nightly scheduler
- **Next batch starts at 041**

---

## How the upload pipeline works

Episodes are generated in bulk, but YouTube enforces a **~10 videos/day channel cap** (separate from the API quota). The pipeline handles this automatically:

1. **SSML + episode files** are generated upfront (all at once, CPU-only)
2. **`npm run pipeline:schedule`** registers the STB batch with the Office nightly scheduler
3. The **Office nightly scheduler** starts at **3:00 AM local time** and runs `batch-run.mjs` first in the heavy batch lane
4. Already-uploaded episodes are **skipped automatically** (idempotent DB check)
5. You can **close the terminal completely** — the scheduler runs independently of Claude or any open session

**You never need to think about batching or timing. Run `pipeline:schedule` once, done.**

---

## Full monthly workflow

### Step 1 — Determine next episode number

```bash
ls /Users/Office/Repos/stevewesthoek/brain/projects/says-the-bible/production/episodes/
```

The highest-numbered file tells you where to start.

### Step 2 — Choose stories

Work from Genesis toward Revelation. Follow canon order loosely — Old Testament first, then New Testament.

**Already covered (001–040):**
- Genesis: Creation (001), Noah (002), Joseph (004), Abraham (012), Isaac (014), Jacob's Ladder (015), Jacob & Esau (016)
- Exodus: Moses (005), Burning Bush (017), Manna (018)
- Jonah (006)
- Joshua: Jordan Crossing (019), Jericho (020)
- Ruth: Ruth & Boaz (013)
- 1 Samuel: Hannah (021), Boy Samuel (022), David & Goliath (023)
- 1 Kings: Solomon's Wisdom (024), Elijah & Ravens (025), Still Small Voice (026)
- Psalms: Shepherd/Ps 23 (003), Rest (009), Protection/Ps 91 (010), Ps 46 (027), Ps 103 (028), Ps 121 (029), Ps 139 (030)
- Isaiah: Fear Not (031), Strength for the Weary (032)
- Daniel: Lions' Den (033), Fiery Furnace (034)
- Mark: The Storm (007)
- Luke: Nativity (008), Prodigal Son (035), Good Samaritan (036), Lost Sheep (039)
- John: Woman at the Well (037), Lazarus (038)
- Matthew: The Light/Sermon on the Mount (011), Feeding the Five Thousand (040)

**Good next sources:**
- Genesis — Rebekah, Joseph in detail, Tower of Babel
- Exodus — Passover night, law at Sinai, the tabernacle
- Numbers — pillar of cloud and fire
- Joshua — Rahab, Joshua's farewell
- 1 Samuel — David anointed, David and Jonathan
- 2 Samuel — David and Mephibosheth
- 1 Kings — Elijah at Horeb, Elijah taken up
- 2 Kings — Elisha and the widow's oil, Naaman healed
- Nehemiah — rebuilding the wall
- Esther — Esther's courage
- Job — God speaks from the whirlwind
- Psalms — Ps 4, 16, 23 (new angle), 27, 34, 62, 84, 131
- Proverbs — wisdom passages
- Isaiah — "Come to me, all who are weary" (Is 55), Immanuel (Is 7)
- Jeremiah — plans to prosper you (Jer 29)
- Lamentations — His mercies are new every morning (brief passage only)
- Zephaniah — He will quiet you with his love (Zeph 3)
- New Testament — the woman who lost her coin, the ten lepers, blind Bartimaeus, Zacchaeus, the good shepherd (John 10), abiding in the vine (John 15), the bread of life (John 6)

**Exclude:** Revelation, full Lamentations, Song of Songs, Ezekiel visions, Zechariah visions, violence-heavy chapters

**Rules:**
1. Same story, different angle is allowed — note the angle in the episode file
2. No exact duplicates (same slug + same framing)
3. Every episode is always 30 minutes
4. Sleep-appropriate tone: gentleness, provision, rest, trust, quiet courage

### Step 3 — Assign slug, title, thumbnail title

**Slug format:** `NNN-book-story-30m` (e.g. `041-genesis-rebekah-30m`)

**YouTube title format:**
```
[Story Name] | Bible Bedtime Story | 30 Minutes
```

**Thumbnail title (Row 2):** Maximum 18 characters including spaces.
- Row 1: "Bible Bedtime Story" (fixed)
- Row 2: short episode title ← assign this
- Row 3: "Deep Sleep" (fixed)

Good: `Ruth & Boaz` (10), `Still Small Voice` (17), `The Burning Bush` (15)
Bad: `Elijah and the Still Small Voice` (32 — too long)

### Step 4 — Write episode .md file

Save to: `/Users/Office/Repos/stevewesthoek/brain/projects/says-the-bible/production/episodes/NNN-book-story.md`

Template:
```markdown
# [NNN] [YouTube Title]

**Slug:** NNN-book-story-30m
**Thumbnail title:** [≤18 chars]
**Bible passage:** [Primary passage(s)]
**Angle:** [What makes this retelling unique]
**Story beat summary:** [3–5 sentences: setup → tension → resolution → rest]
```

### Step 5 — Generate SSML (12 files per episode)

Save to: `/Users/Office/Repos/stevewesthoek/brain/projects/says-the-bible/production/ssml/stories/NNN_book_story/`

**Gold standard:** `006_jonah_whale/` — 12 files, use as the structural template.

#### 12-file structure

| File | Type | Description |
|------|------|-------------|
| `01-entry.ssml` | Entry | Opening narration, sets scene and tone |
| `02` – `07` | Narrative | Story units 1–6 (07 = highest tension) |
| `08-integration-a.ssml` | Integration | Declarative truth statements, gentle resolution |
| `09-integration-b.ssml` | Integration | Deepening rest invitation |
| `10-sleep-loop-wave1.ssml` | Sleep loop | 3× mantra repetition |
| `11-sleep-loop-wave2.ssml` | Sleep loop | 3× slower, more silence |
| `12-sleep-loop-wave3.ssml` | Sleep loop | 6× fully settled |

#### Prosody curve

| File | Rate | Pitch |
|------|------|-------|
| 01-entry | -10.00% | -2.00% |
| 02 | -10.25% | -2.25% |
| 03 | -10.50% | -2.50% |
| 04 | -10.75% | -2.60% |
| 05 | -11.00% | -2.75% |
| 06 | -11.50% | -2.90% |
| 07 | -11.75% | -3.10% |
| 08 | -13.00% | -3.40% |
| 09 | -13.50% | -3.60% |
| 10 | -14.50% | -4.00% |
| 11 | -15.00% | -4.00% |
| 12 | -15.50% | -4.00% |

#### Break time rules

- Narrative: 500ms/1000ms between lines; paragraph ends `1800ms`; unit end `3800ms`
- Integration: `1800ms` between statements; section end `9000ms`
- Wave 1: `1800ms` between lines; `3800ms` between repetitions
- Wave 2: `3800ms` between lines; `9000ms` between repetitions
- Wave 3: `9000ms` uniform — all lines and repetitions

#### SSML header (every file) — Azure Speech Studio format

```xml
<!--ID=B7267351-473F-409D-9765-754A8EBCDE05;Version=1|{"VoiceNameToIdMapItems":[{"Id":"f1b99834-fbfc-4d32-846d-c4dbd3050c19","Name":"Microsoft Server Speech Text to Speech Voice (en-GB, OllieMultilingualNeural)","ShortName":"en-GB-OllieMultilingualNeural","Locale":"en-GB","VoiceType":"StandardVoice"}]}-->
<!--ID=FCB40C2B-1F9F-4C26-B1A1-CF8E67BE07D1;Version=1|{"Files":{}}-->
<!--ID=5B95B1CC-2C7B-494F-B746-CF22A0E779B7;Version=1|{"Locales":{"en-US":{"AutoApplyCustomLexiconFiles":[{}]},"en-GB":{"AutoApplyCustomLexiconFiles":[{}]}}}-->
<speak xmlns="http://www.w3.org/2001/10/synthesis"
       xmlns:mstts="http://www.w3.org/2001/mstts"
       xmlns:emo="http://www.w3.org/2009/10/emotionml"
       version="1.0"
       xml:lang="en-GB">
  <voice name="en-GB-OllieMultilingualNeural">
    <prosody rate="[rate]%" pitch="[pitch]%">

      [content]

    </prosody>
  </voice>
</speak>
```

#### Sleep loop mantra (files 10–12)

5–6 short declarative lines rooted in the story's theme. Always ends with a "You can rest" variation.

Example (Jonah wave 1, 3 repetitions):
```xml
The sea is still.<break time="1800ms"/>
You are held.<break time="1800ms"/>
Mercy is here.<break time="1800ms"/>
You are safe.<break time="1800ms"/>
You can rest.<break time="3800ms"/>
```

### Step 6 — Register in run.mjs

Add the new episodes to `SLUG_TO_SSML_FOLDER` and `STORY_METADATA` in:
`/Users/Office/Repos/prochattools/web/says-the-bible/scripts/pipeline/run.mjs`

```javascript
// In SLUG_TO_SSML_FOLDER:
'041-genesis-rebekah-30m': '041_genesis_rebekah',

// In STORY_METADATA:
'041-genesis-rebekah-30m': {
  youtubeTitle:   'Rebekah | Bible Bedtime Story | 30 Minutes',
  thumbnailTitle: 'Rebekah',            // ≤18 chars
  bookRef:        'the book of Genesis',
  storyShort:     'Rebekah',
  storyDetail:    'Rebekah, chosen by God as wife for Isaac through a servant\'s faithful journey...',
  narrativeArc:   'It begins with Abraham\'s servant departing for a distant land...',
  storyTags:      ['rebekah bible story', 'isaac and rebekah', 'genesis sleep', ...],
},
```

### Step 7 — Register the nightly batch

After all SSML is generated and run.mjs is updated, register the batch with the Office nightly scheduler with one command:

```bash
cd /Users/Office/Repos/prochattools/web/says-the-bible
npm run pipeline:schedule -- --slugs 041-genesis-rebekah-30m,042-...,043-...
```

This writes the STB batch configuration used by the Office nightly scheduler, which starts at **3:00 AM local time**. The nightly batch:
- Runs `batch-run.mjs` with all the slugs
- Uploads up to 10 videos per day (YouTube's channel-level cap)
- Skips already-uploaded episodes automatically
- Stops cleanly when today's limit is reached, resumes tomorrow
- Logs everything to `/tmp/stb-pipeline-batch.log`

**After running `pipeline:schedule`, you can close the terminal. The Mac handles everything through the centralized nightly scheduler.**

Monitor progress anytime:
```bash
tail -f /tmp/stb-pipeline-batch.log
```

Disable the nightly batch (if needed):
```bash
rm -f ~/.local/state/office-scheduler/stb-pipeline-batch.env
```

### Step 8 — Verify on YouTube Studio

1. YouTube Studio → Content → Scheduled
2. Confirm each video shows "Scheduled: [date] at 6:00 PM"
3. Spot-check the first few: thumbnail correct, title correct, not made for kids

---

## Monthly checklist

- [ ] Last episode number noted → next batch starts at NNN
- [ ] Stories selected (Bible order, no exact duplicates, sleep-appropriate)
- [ ] All episode `.md` files written in `production/episodes/`
- [ ] All SSML sets generated (12 files each) in `production/ssml/stories/`
- [ ] `run.mjs` updated — `SLUG_TO_SSML_FOLDER` and `STORY_METADATA`
- [ ] `npm run pipeline:schedule -- --slugs ...` run → nightly scheduler registration updated
- [ ] YouTube Studio: videos appearing as Scheduled over the following days
- [ ] `episodes/` folder committed to brain repo

---

## Troubleshooting

**Resume a timed-out Azure TTS job:**
```bash
cd /Users/Office/Repos/prochattools/web/says-the-bible
npm run pipeline:run -- --slug NNN-slug-30m --job-id <azure-job-id> --skip-ssml-gen
```

**Retry upload only (video already rendered, just upload failed):**
```bash
npm run pipeline:run -- --slug NNN-slug-30m --skip-audio
```

**Render without uploading (test audio/video):**
```bash
npm run pipeline:run:no-upload -- --slug NNN-slug-30m
```

---

## Key paths

| What | Path |
|------|------|
| Pipeline repo | `/Users/Office/Repos/prochattools/web/says-the-bible` |
| Episodes | `production/episodes/` |
| SSML stories | `production/ssml/stories/` |
| Output (audio/video) | `production/output/` |
| Assets (noise, fonts, template) | `production/input/assets/` |
| Pipeline orchestrator | `scripts/pipeline/run.mjs` |
| Batch runner | `scripts/pipeline/batch-run.mjs` |
| Nightly scheduler registrar | `scripts/pipeline/install-cron.mjs` |
| Batch log | `/tmp/stb-pipeline-batch.log` |
| SSML gold standard | `production/ssml/stories/006_jonah_whale/` |
