# Brain Console Projection Integration Matrix

The matrix maps the existing Console and the intended Infinite Brain cockpit capabilities to Brain Core projection contracts.

| Existing Console feature | Required Brain Core projection | Status | Notes |
|---|---|---|---|
| Overview runtime status | `/projections/status`, `/projections/health` | needs adaptation | Existing UI uses `/infinite-brain/status`; add envelope-aware read path without removing the legacy view first. |
| Topology/system map | `/projections/topology` | ready at API / absent in Console | Console has reusable cards but no topology consumer. |
| Services | `/projections/services` | ready at API / absent in Console | Add only as a bounded read view. |
| Contract/capability visibility | `/projections/contracts`, `/projections/capabilities` | ready at API / absent in Console | Useful for diagnostics and freshness explanation. |
| Review inbox | `/projections/review` | ready at API / absent in Console | Read-only projection; decisions remain separate human-gated routes. |
| Ingestion state | `/projections/ingestion` | ready at API / absent in Console | Show provenance and empty/stale state, not ingestion controls. |
| Unified intelligence | `/projections/intelligence` | ready at API / absent in Console | Render attention/findings; do not infer importance in the browser. |
| Calibration | `/projections/calibration` | ready at API / absent in Console | Report-only operational signal. |
| Learning checkpoint | `/projections/learning` | ready at API / absent in Console | Report candidates, not roadmap decisions. |
| Evolution workflow | `/projections/evolution` | ready at API / absent in Console | Exposes workflow, approvals, readiness, and learning references. |
| Promotion state | `/projections/promotion` | ready at API / absent in Console | Never add a browser promotion action to this read path. |
| Prepared transactions | `/projections/transactions` | ready at API / absent in Console | Display prepared/blocked state and requirements only. |
| Receipts/verification | `/projections/receipts` | ready at API / absent in Console | Show evidence and rollback references; no receipt creation. |
| Proposal review and approval | Existing `/infinite-brain/proposals*` routes plus future projections | needs adaptation | Keep existing approval boundary; projections should reduce duplicated reads, not replace approval APIs. |
| Mind maintenance scheduler/report | `/scheduler/mind-steward/status`, `/api/mind-maintenance/latest` | existing legacy integration | Keep separate until an explicit contract migration is approved. |
| Infrastructure/local apps/video surfaces | Existing domain-specific Brain Core routes | ready / separate scope | Not part of P3.25.4A projection migration. |

## Consumption rule

Projection consumers must validate the `brain-core-projection-v1` envelope, render authority/provenance/freshness/availability/uncertainty, and distinguish empty or unavailable runtime state from a negative knowledge claim. Projection reads never approve, promote, execute, schedule, or mutate.
