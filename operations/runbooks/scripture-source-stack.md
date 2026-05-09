# Scripture Source Stack

**Status:** Active dormant capability  
**Last reviewed:** 2026-05-09  
**Primary skill:** `ai/skills/custom/scripture-sources/SKILL.md`  
**Used by:** `/bible-research`, `/research`, apologetics pipelines, Bible studies, sermons, Says the Bible workflows.

---

## Purpose

Brain needs a reliable source layer for Scripture and biblical-language research.

The goal is to support workflows that need to:

- quote Scripture accurately
- link to passages
- search Bible text
- compare translations
- retrieve Greek/Hebrew data
- consult Strong's-style lexical information
- map claims to Bible passages
- build source-backed apologetics responses
- support Bible stories, studies, sermons, and research notes

Users should not need to remember API names or source tools. `/bible-research` and `/research` should infer when Scripture source retrieval is needed.

---

## Recommended Source Architecture

Use a layered stack. No single source provides everything.

```text
Translation/passages/search
  → API.Bible or other licensed Bible APIs

Original language / Strong's / morphology
  → STEPBible-Data and other open datasets

Public links / study lookup
  → STEP Bible, Bible Hub, Bible Gateway, BibleProject, etc.

Commentary / theology / scholarship
  → acquired through /web, books, papers, and research repo sources
```

---

## API.Bible

Website:

```text
https://scripture.api.bible/
```

Best use:

- Bible passage retrieval
- Bible search
- translation access where licensed
- source metadata
- API-based verse lookup

Why it is useful:

- dedicated Bible API
- supports multiple Bibles/translations depending on access
- useful for direct retrieval and search workflows
- cleaner than scraping Bible websites

Limitations:

- requires API key
- translation availability depends on licensing
- not sufficient by itself for Greek/Hebrew/Strong's/morphology workflows
- quotation/display rights still matter
- API key must never be committed

Decision:

```text
Good primary candidate for passage/translation/search API.
Not sufficient as the whole Scripture research stack.
```

---

## Original-Language / Strong's Data

Preferred open-data candidate:

```text
STEPBible-Data
```

Best use:

- Greek/Hebrew lexical data
- Tyndale extended Strong's data
- morphology expansions
- original-language research support

Why it is useful:

- better fit for Greek/Hebrew and Strong's-style research than most verse APIs
- can be stored or referenced as durable research data if licensing allows
- useful for word studies and claims about biblical language

Limitations:

- requires local data integration or scripts
- lexical data still needs careful interpretation
- Strong's numbers are index aids, not final lexical authority

Decision:

```text
Use for original-language support and Strong's-style lexical lookup.
Do not let it replace contextual exegesis.
```

---

## Public Study Websites

Examples:

```text
STEPBible.org
Bible Hub
Bible Gateway
BibleStudyTools
BibleProject
```

Best use:

- public links
- translation comparison
- interlinear-style lookup
- topical discovery
- study context
- secondary explanations

Limitations:

- copyright restrictions
- site terms vary
- scraping may be disallowed or brittle
- not every page is scholarly or primary

Decision:

```text
Useful for links and supplementary lookup.
Do not rely on scraping copyrighted text as the main source layer.
```

---

## Copyright And Quotation Rules

Bible translations are often copyrighted.

Rules:

- Prefer public-domain or explicitly licensed translations for long quotations.
- For copyrighted translations, quote only within allowed limits.
- Always preserve translation/source attribution.
- Do not store large copyrighted Bible text dumps in the repo unless licensing allows it.
- Link to source passages when quotation length is not necessary.
- For internal research, still record translation and source metadata.

---

## Integration With Orchestrators

### `/bible-research`

Use `scripture-sources` when:

- direct Bible quotation is needed
- translation comparison is needed
- Greek/Hebrew/Strong's data is requested
- a Bible-support map is needed
- a Bible claim must be fact-checked

### `/research`

Use `scripture-sources` when:

- research includes Scripture claims
- apologetics arguments need Bible backing
- source-and-proof packs need Bible passages
- a case file needs Bible references tied to claims

### `/media-acquisition`

Use separately for video/audio sources. A Bible/apologetics proof pack may combine:

```text
scripture-sources → Bible passages
media-acquisition → video transcripts/timestamps
web/firecrawl → articles, papers, source pages
```

---

## Apologetics Proof Pack Pattern

For serious apologetics cases, create:

```text
source-and-proof-pack.md
bible-support-map.md
video-source-map.md
scientific-source-map.md
advisory-notes-for-steve.md
```

For each claim, record:

```yaml
claim_id:
steve_claim:
opponent_claim:
source_type: scripture | video | scientific | philosophical | historical | web | internal
sources:
  - title:
    author/source:
    url/path:
    access_date:
    quote_or_summary:
    supports:
    limitations:
confidence:
public_response_use:
internal_advisory_note:
```

---

## Setup Notes

API.Bible requires an API key outside the repo.

Recommended secret handling:

```text
local environment variable
password manager
machine-specific config outside Git
```

Never commit:

```text
API_BIBLE_KEY
OAuth tokens
cookies
client secrets
service account files
```

Possible environment variable:

```bash
export API_BIBLE_KEY="..."
```

No wrapper script exists yet. If Scripture API use becomes frequent, create a safe wrapper under `tools/` that:

- requires env var
- never logs the key
- records source metadata
- enforces output paths
- stores only allowed quotation lengths
- writes source records to the research repo

---

## Decision

Add `scripture-sources` as a dormant specialist skill in the research profile.

Do not add it to the default profile unless Scripture-source work becomes constant daily work.

Keep `/bible-research` as the method/exegesis layer and `scripture-sources` as the source retrieval layer.
