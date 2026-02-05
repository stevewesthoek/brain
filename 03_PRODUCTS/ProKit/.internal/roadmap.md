# ProKit Roadmap

Lightweight list of next improvements and experiments.

## Now
- Tighten the ProKit vs marketing-layer boundary (ensure core stays lean).
- Add minimal automated checks for deploy gate scripts (shellcheck + basic smoke tests).
- Improve Prisma generator config to avoid deprecation warnings (explicit output path).

## Next
- Optional Clerk Organizations/workspaces module (behind a feature flag).
- Optional staging tenant pattern (separate slug + schema) with the same deploy gate.

## Later
- Formalize a "core-only dependency set" so derived products can remove marketing deps safely.
- Support multiple tenants per app (true multi-tenancy) as an optional module.
