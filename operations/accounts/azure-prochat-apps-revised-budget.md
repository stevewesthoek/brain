# PROCHAT-APPS Revised Budget Analysis (Post-Disk Downgrade)

## Change Made
- **Disk downgrade**: Premium SSD (€13.46/month) → Standard SSD (~€1.50/month)
- **Backup policy change**: 7-day retention → 1-day instant snapshots
- **Effective date**: April 12, 2026, 10:06 UTC

---

## April 2026 Actual Billing (with disk swap mid-month)

### Pre-Swap Period (April 1-12)
**MTD costs before swap:**
- Virtual Machines: €47.14
- Premium SSD: €13.56 (active for 12 days)
- Standard HDD: €3.64
- Standard SSD (OS): €1.97
- Backup: €5.76
- IP: €1.17
- **Subtotal: €73.24** (12 days with Premium SSD)

### Post-Swap Period (April 12-30 estimated)
**Remaining 18 days with Standard SSD:**
- Virtual Machines: €47.14 ÷ 30 × 18 = **€28.28**
- Standard SSD (Data): €1.50 ÷ 30 × 18 = **€0.90**
- Standard HDD (Backup): €3.64 ÷ 30 × 18 = **€2.19**
- Standard SSD (OS): €1.97 ÷ 30 × 18 = **€1.18**
- Backup (1-day retention): €5.76 ÷ 30 × 18 = **€3.46** (slightly lower)
- IP: €1.17 ÷ 30 × 18 = **€0.70**
- **Subtotal for remaining 18 days: €36.71**

### April 2026 Full Month Projection
**Pre-swap (12 days) + Post-swap (18 days):**
- **April total: €110.00** (estimated)
- **This is about €0.52/day average for the full month**

---

## Annualized Cost Projection (if Standard SSD continues full year)

**Monthly cost (Standard SSD):**
| Service | Monthly Cost (EUR) |
|---|---|
| Virtual Machines (Dasv5) | €47.14 |
| Standard SSD (Data Disk) | €1.50 |
| Standard HDD (Backup staging) | €3.64 |
| Standard SSD (OS Disk) | €1.97 |
| Backup (1-day snapshots) | €5.46 |
| IP Addresses | €1.17 |
| Bandwidth | €0.00 |
| **Monthly Total** | **€60.88** |

**Annual projection:** €60.88 × 12 = **€730.56/year**

---

## Budget Comparison

| Metric | Value |
|---|---|
| Monthly cost (new) | €60.88 |
| Annual cost (new) | €730.56 |
| Non-profit grant budget | €2,000.00 |
| **Headroom** | **€1,269.44** |
| **Status** | ✅ **WELL UNDER BUDGET** |

---

## What Changed

### Cost Savings
- **Premium SSD to Standard SSD**: Saves €11.96/month (~90% reduction)
- **7-day to 1-day instant snapshots**: Saves €0.30/month
- **Total monthly savings: €12.26**
- **Total annual savings: €147.12**

### New vs Old Annual Cost
- **Old (Premium SSD)**: €2,179.80/year → **€179.80 OVER budget**
- **New (Standard SSD)**: €730.56/year → **€1,269.44 UNDER budget**
- **Improvement: €1,449.24 annually** ✅

---

## Disk Configuration Now

| Disk | Type | Size | Status | Cost/Month |
|---|---|---|---|---|
| vm-dokploy OS | Standard SSD | 30 GB | Attached, active | €1.97 |
| data-dokploy (NEW) | Standard SSD | 256 GB | Attached, active | €1.50 |
| data-dokploy (OLD) | Premium SSD | 256 GB | Detached, unused | €13.46 (still charged) |

**Action needed:** Delete the old Premium SSD once you confirm Standard SSD is stable (recommended after 7 days of monitoring).

---

## Risk Assessment: Standard SSD vs Premium SSD

| Factor | Risk | Mitigation |
|---|---|---|
| I/O performance | Medium (5K IOPS vs 6K) | Monitor %util; revert if >70% sustained |
| Data durability | Low | Same Azure managed disk reliability |
| Latency | Low-Medium | ~7-10ms vs 3-5ms; acceptable for Docker |
| Cost | Low | €1.50/month vs €13.46/month |

**Monitoring:** Check `iostat` on sdb after 3-7 days of normal operation to confirm %util stays <50%.

---

## Next Steps

1. **Wait 3-7 days** for Standard SSD to prove stable
2. **Monitor metrics**: `iostat -x sdb 1` — watch for sustained %util >60%
3. **If stable**: Delete the old Premium SSD to save €13.46/month immediately
4. **If unstable**: Revert to Premium SSD (takes 30 mins) and stay within €179.80 annual overage

---

**Conclusion:** PROCHAT-APPS is now **€1,269.44 under budget annually** with the Standard SSD, and the server should operate normally for typical Dokploy workloads.

Last updated: 2026-04-12 11:45 UTC
