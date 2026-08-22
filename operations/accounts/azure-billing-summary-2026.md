# Azure Billing Summary 2026

## Actual Costs — April 2026 (Month-to-Date)

### dokploy-azure Subscription
*Billing Period: 2026-04-01 to 2026-04-12 (partial month)*

| Resource Type | Cost (EUR) | Annualized |
|---|---|---|
| Virtual Machines (Dokploy VM) | €46.62 | €559.44 |
| Disks (Data + OS) | €15.41 | €184.92 |
| Restore Point Collections (Backups) | €3.60 | €43.20 |
| Public IP Addresses | €1.16 | €13.86 |
| Recovery Services Vault | €5.68 | €68.10 |
| **Subtotal** | **€72.47** | **€869.52** |

**Annualized (€869.52 ÷ 12 = €72.46/month)** — Under grant limit ✅

---

### supabase-azure Subscription
*Billing Period: 2026-04-01 to 2026-04-12 (partial month)*

| Resource Type | Cost (EUR) | Annualized |
|---|---|---|
| Cognitive Services (Text-to-Speech) | €13.05 | €156.60 |
| Virtual Machines (Supabase) | €23.32 | €279.84 |
| Disks | €5.10 | €61.20 |
| Snapshots | €0.25 | €3.00 |
| Restore Point Collections | €1.96 | €23.52 |
| Public IP Addresses | €1.16 | €13.86 |
| Recovery Services Vault | €14.88 | €178.56 |
| Storage Accounts | €0.00 | €0.00 |
| **Subtotal** | **€59.72** | **€716.58** |

**Annualized (€716.58 ÷ 12 = €59.72/month)** — Under grant limit ✅

---

## Combined Budget Analysis

| Item | Monthly | Annualized |
|---|---|---|
| dokploy-azure | €72.46 | €869.52 |
| supabase-azure | €59.72 | €716.58 |
| **Total Current** | **€132.18** | **€1,586.10** |
| **Non-Profit Grant Budget** | — | **€2,000.00** |
| **Headroom** | — | **€413.90** |

**Status: ✅ Well within budget. Both subscriptions are sustainable.**

---

## Breakdown by Service

### dokploy-azure: Dokploy Deployment Infrastructure
- **Compute**: Standard_D4as_v5 VM in Spain Central (~€46.62/month)
- **Storage**: 256 GB Premium P15 data disk + 30 GB StandardSSD OS disk (~€15.41/month)
- **Reliability**: Automated backups + restore points + vault (~€9.28/month)
- **Networking**: Static public IP (~€1.16/month)

### supabase-azure: Supabase + TTS Services
- **Compute**: Supabase PostgreSQL VM (~€23.32/month)
- **AI/ML**: Text-to-Speech Cognitive Services (~€13.05/month)
- **Storage**: Database disks + snapshots (~€5.35/month)
- **Reliability**: Backups + vault (~€16.84/month)
- **Networking**: Static public IP (~€1.16/month)

---

## Feasibility: ProKit Staging on Existing Infrastructure

Based on current utilization:
- **dokploy-azure Dokploy**: 63% disk used (after cleanup), 2.2 GB min RAM available
- **supabase-azure Supabase**: Costs €59.72/month, with €413.90 annual headroom

**Recommendation**: ProKit staging can be deployed **without exceeding the non-profit grant budget**, but disk pressure on the Dokploy server remains. Options:

1. **Add to Supabase VM** (€0 additional cost) — sufficient CPU/RAM, minimal storage impact
2. **Add to Dokploy VM** (€0 additional cost) — same Kubernetes cluster, but disk cleanup required first
3. **New staging VM** (~€50-80/month) — would require grant budget increase or new funding

**Current status**: All infrastructure is sustainable at current spending levels ($1,586.10/year vs. $2,000 grant). No upgrades needed in 2026.

---

## Notes

- Costs are based on actual April 2026 MTD billing from Azure Cost Management API
- Grant subscriptions finalize costs mid-month; these figures are estimates
- Network egress not itemized in consumption API but typically <1% of total
- All costs in EUR (Spain Central region pricing)
- Estimates assume stable resource utilization through 2026

Last updated: 2026-04-12
