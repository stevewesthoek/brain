# MRU0-P3.26 Operational Friction Log

Only observed friction is recorded here. No diagnosis or implementation authorization is implied.

| ID | Evidence | Impact | Confidence | Current disposition |
|---|---|---|---|---|
| P3.26-F1 | 11 real inbox items produced 11 `new` workflow items and no terminal decisions | Human review requires an explicit operator session before the queue becomes useful beyond detection | High | Immediate bounded usability review |
| P3.26-F2 | Calibration reported `missing_provenance_items=11` after ingestion and workflow projection | Calibration may over-report workflow friction or under-represent propagated evidence references | High | Immediate contract/evidence reconciliation |
| P3.26-F3 | The daily workflow requires separate operator commands for ingestion, briefing, workflow, daily loop, and calibration | Repeated manual steps increase operational friction | High | Documentation/usage simplification candidate |
| P3.26-F4 | No real terminal review decisions were recorded in this observation window | Accepted/rejected/deferred/archived usability remains unmeasured with real decisions | High | Requires a human-directed next usage window |

No stale-source, duplicate-source, or ingestion-failure friction was observed in this pass.
