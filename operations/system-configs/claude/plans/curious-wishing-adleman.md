# Product Strategy: Portuguese Learning App
**Context:** Steve lives in Portugal, married to a Portuguese person, needs to speak for daily life and business. Beginner with basics. 30-45 min/day. European Portuguese (mainland) only. Free tech only, CLI-friendly, local AI (M1 Mac mini). Simple web UI.

---

## 1. The Strategic Insight

Most language learning apps assume you need to *simulate* immersion. Steve doesn't. He already has:
- A native speaker at home (his wife)
- Business conversations in Portuguese happening now
- Daily street-level Portuguese (shops, restaurants, neighbors)
- A living language lab running 24/7

**This changes the product entirely.** The app is not a language tutor. It is a **precision bridge tool**: it takes Steve from "basics" to "fluent enough for real life, right here, right now."

The competition is not Duolingo. The competition is his wife trying to explain words while cooking dinner.

---

## 2. Methodology Filter (from 10 down to 3)

From the research, only 3 methodologies apply to Steve's specific context:

### ✅ Keep: Spaced Repetition (SRS)
**Why it fits:** 30-45 min/day = no room for wasted study. SRS automates the right words at the right time. Most efficient method for vocabulary retention.
**Application:** 15-20 min daily SRS session, European Portuguese word families, audio included.

### ✅ Keep: Comprehensible Input (Krashen)
**Why it fits:** Steve hears Portuguese all day. The app gives him structured input slightly above his level so that exposure converts into acquisition. Without this, immersion just washes over you without sticking.
**Application:** 10-15 min/day of curated European Portuguese audio (RTP, podcasts, YouTube) at A1-A2 level.

### ✅ Keep: Contextual / Situational Vocabulary
**Why it fits:** Steve doesn't need generic travel phrases. He needs words for his actual life — home conversations with his wife, business meetings, grocery shopping in Lisbon, the doctor, the bank.
**Application:** Vocabulary organized by real situations (home/family, work/business, daily errands, social settings).

### ❌ Removed methodologies and why:
- **Language Exchange Connector** — He lives with a native speaker. He has this.
- **Community Features** — He has real-world Portuguese community.
- **Memory Palaces (Wyner)** — Powerful but adds complexity. Worth revisiting Phase 2.
- **Pronunciation Waveform Analysis** — He hears European Portuguese all day. Over-engineering for MVP.
- **In-app Video Calling** — Already has this via his life context.
- **Immersion Tools** — He IS immersed. App doesn't need to simulate it.
- **AI Conversation Chatbot** — Phase 2 with Ollama (free, local M1), not MVP.
- **Brazilian Portuguese anything** — Hard excluded. European Portuguese only in all content, audio, and examples.

---

## 3. Product Vision

**Name (working):** `fala` — Portuguese for "speak"

**What it is:**
A precision vocabulary and listening tool designed for an immersed beginner. 
30-40 minutes a day. No fluff. Exactly what to do today, every day.

**What it does:**
1. Teaches you the 500-1,000 most common European Portuguese words via SRS
2. Organizes vocabulary by the real situations you encounter daily
3. Suggests 10-15 min of real European Portuguese content each day
4. Tracks your progress to keep momentum

**What it is NOT:**
- Not a full-featured app for everyone
- Not a classroom replacement
- Not a Brazilian Portuguese tool
- Not a social platform

---

## 4. Hard Technical Constraints

| Constraint | Decision |
|------------|----------|
| **No paid services** | Everything free or open-source |
| **Local AI** | Ollama on M1 (Phase 2) — no OpenAI/Anthropic costs |
| **CLI-friendly** | Backend has a CLI interface; dev workflow is CLI-first |
| **Runs on M1 Mac** | Local stack only; no cloud dependencies for core features |
| **Interface** | Simple web UI served locally (localhost), mobile-friendly |

---

## 5. Free Tech Stack

| Layer | Tool | Notes |
|-------|------|-------|
| **SRS Algorithm** | FSRS (open-source, Python) | Most modern algorithm; we implement it ourselves (500 lines Python). No Anki dependency. |
| **Backend** | Python + FastAPI | Lightweight, CLI-friendly, runs on M1 |
| **Database** | SQLite | Zero-config, local, no server |
| **Frontend** | HTML/CSS/JS (vanilla or minimal framework) | No React overhead for MVP |
| **Audio (TTS)** | Piper TTS — European Portuguese voice | Free, local, offline, M1-compatible |
| **Content Feed** | RSS/scraping from RTP, free podcasts | No API costs |
| **AI (Phase 2)** | Ollama + Mistral 7B or Llama 3.1 8B | Free, runs well on M1 Mac mini |
| **Dev CLI** | Python Click | Seed vocab, reset deck, export progress |

**No cloud. No subscriptions. No API keys for core features.**

---

## 6. MVP Feature Set (Ruthlessly Minimal)

### Feature 1: Smart SRS Deck — *the core*
- 500 most common European Portuguese words (pre-loaded)
- Each card: PT word → audio (Piper TTS) → English meaning
- FSRS algorithm: tells you exactly which cards to review today
- Contextual tags: `home`, `work`, `daily-errands`, `social`
- Session cap: 15-20 min max. App stops pushing after daily quota.

### Feature 2: Situational Phrase Packs
- Phrases organized by real situations Steve faces:
  - "At home with family" (30 phrases)
  - "In a business meeting" (30 phrases)
  - "Daily errands (store, post office, pharmacy)" (30 phrases)
  - "Social / small talk" (30 phrases)
- Phrases are SRS-card compatible (feed into the same deck)
- Audio via Piper TTS for each phrase

### Feature 3: Daily Content Suggestion
- App suggests 1 piece of European Portuguese content per day (10-15 min)
- Curated static list to start: RTP Notícias clips, Portuguese podcasts, easy YouTube
- Tagged by difficulty (A1 / A2 / B1)
- No streaming engine — just a well-curated rotating list

### Feature 4: Progress Dashboard
- Cards mastered today / streak / total words learned
- % of the 500-word foundation completed
- "Sentences you can now say" estimate (motivational)
- Daily session status: Done ✅ / Not yet

---

## 7. What We Explicitly Leave Out of MVP

| Feature | Why excluded |
|---------|--------------|
| In-app video calls | Not needed — Steve has this via his life |
| AI chatbot | Phase 2 only (Ollama local); adds complexity |
| Community/social | Adds infra; not needed |
| Pronunciation analysis | Overengineering for someone already hearing the language daily |
| Grammar lessons | Deliberate — grammar emerges from input + SRS |
| Advanced analytics | Simple streak + word count is enough for now |
| Brazilian content | Hard excluded |

---

## 8. Development Phases

### Phase 1: Foundation (MVP) — Weeks 1-3
**Goal:** Functional SRS + situational phrases + daily session structure

Tasks:
1. Seed European Portuguese vocabulary dataset (500 words + audio)
2. Implement FSRS algorithm in Python
3. Build SRS card interface (web)
4. Build situational phrase packs
5. Build daily session flow (start → review → done)
6. Build progress dashboard
7. Set up Piper TTS for audio generation
8. CLI commands: seed, reset, export, status

Deliverable: A working daily study app.

### Phase 2: Intelligence — Weeks 4-6
**Goal:** Add local AI conversation practice + content feed

Tasks:
1. Integrate Ollama (Mistral 7B) for Portuguese conversation practice
2. Build chat interface (EU PT only, grammar correction mode)
3. Build European Portuguese content feed (RTP RSS + podcast list)
4. Add vocabulary expansion (500 → 1,000 words)
5. Add content difficulty tagging

Deliverable: AI conversation partner + curated content library.

### Phase 3: Polish & Business Portuguese — Weeks 7-8
**Goal:** Tune for business context, refine UX, export/share

Tasks:
1. Business vocabulary pack (60+ phrases for meetings, calls, email)
2. "Today's session" email/notification option
3. Export deck to Anki format (for power users)
4. Mobile-responsive UI polish
5. Autoresearch loop setup (new vocabulary suggestions based on usage gaps)

Deliverable: Production-ready personal learning tool.

---

## 9. European Portuguese-Specific Content Sources (Free)

| Source | Type | Cost | Notes |
|--------|------|------|-------|
| RTP (rtp.pt) | TV/radio/news | Free | Public broadcaster, legal, A2-B2 |
| Rádio Renascença | Podcast/radio | Free | Great for listening |
| Practice Portuguese (podcast) | Podcast | Free tier | Built for EU PT specifically |
| Coisas de Portugueses (YouTube) | YouTube | Free | Natural casual EU PT |
| A Vida em Português (YouTube) | YouTube | Free | Expat learning EU PT |
| Portuguese With Carla | YouTube | Free | EU PT, clear speech, A1-B1 |
| Subtitled Portuguese films | YouTube/RTP | Free | With PT subtitles, not English |

---

## 10. Success Metrics (Measurable)

- **Week 2:** Complete 100 SRS cards with ≥80% retention rate
- **Week 4:** Hold a 5-minute unscripted conversation at home without reverting to English
- **Week 8:** 400 words in active SRS deck with ≥85% retention
- **Week 12:** Can navigate a full business meeting understanding 80%+
- **Long-term:** When your wife says something, you understand it before she finishes the sentence

---

## 11. Files to Create

```
fala/                           # App root
├── backend/
│   ├── main.py                 # FastAPI app
│   ├── srs.py                  # FSRS algorithm
│   ├── models.py               # SQLite models
│   ├── routes/
│   │   ├── deck.py             # Card review API
│   │   ├── progress.py         # Progress API
│   │   └── content.py          # Content feed API
│   ├── data/
│   │   ├── vocab_eu_pt.json    # 500 EU Portuguese words
│   │   ├── phrases_home.json   # Situational phrases
│   │   ├── phrases_work.json
│   │   ├── phrases_errands.json
│   │   └── content_feed.json   # Curated content list
│   └── cli.py                  # CLI: seed, reset, export, status
├── frontend/
│   ├── index.html              # Dashboard
│   ├── deck.html               # SRS card review
│   ├── phrases.html            # Browse phrase packs
│   └── static/
│       ├── style.css
│       └── app.js
├── audio/                      # Generated via Piper TTS
├── requirements.txt
└── README.md
```

---

## 12. Autoresearch Integration (Phase 3)

Once the app is running:
- `/autoresearch` will analyze which vocabulary categories have lowest retention
- Suggest new phrase packs based on Steve's gaps
- Suggest new European Portuguese content sources
- Feed improvements back into the deck automatically

---

## Decisions Needed Before Build

None. Constraints are clear. Ready to execute Phase 1.
