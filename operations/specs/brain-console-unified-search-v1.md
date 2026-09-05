# Brain Console Unified Search v1

Brain Console search is a bounded read-only projection owned by Brain Core.

## Contract

`GET http://127.0.0.1:4877/search?q=<query>` returns `brain-unified-search-v1`.
Each result contains a stable `id`, result `type`, title, short subtitle, source,
freshness (`CURRENT`, `STALE`, `DEGRADED`, or `UNAVAILABLE`), and either a stable
Console `href` or an Obsidian deep link. Packet and note bodies are never returned.

The projection indexes task summaries and context/evidence references, scheduler
jobs, runtime report summaries, services/local apps, capabilities, and a fixed
registry of high-value Obsidian notes. It does not crawl the Brain repository or
vault during a query. Core refreshes the bounded in-memory projection on a short
TTL and reports partial source failures explicitly.

The Console contributes its own static route catalog synchronously, then merges
remote Core results after a small debounce. Core unavailable therefore does not
disable route navigation.

## Safety

Search is navigational and read-only. It does not execute shell commands, restart
services, request scheduler runs, mutate providers, or expose secrets, raw logs,
credentials, or unrestricted Mind content.
