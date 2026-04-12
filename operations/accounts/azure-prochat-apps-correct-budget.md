# PROCHAT-APPS Correct Budget Calculation (Excluding Premium SSD Only)

## All Services - PROCHAT-APPS (April 1-12, 2026 — 12 days)

| Service | Cost (EUR) |
|---|---|
| Virtual Machines (Dasv5) | €47.14 |
| Standard SSD (OS Disk) | €1.97 |
| Standard HDD (Backup staging) | €3.64 |
| Backup (Recovery Services) | €5.76 |
| Static IP Address | €1.17 |
| Bandwidth (inter-region) | €0.00 |
| Azure Monitor | €0.00 |
| **SUBTOTAL (excl. Premium SSD)** | **€59.68** |
| ~~Premium SSD (EXCLUDED)~~ | ~~€13.56~~ |
| ~~Restore Point Collections (EXCLUDED as backup is reduced)~~ | ~~€3.60~~ |

---

## Adjusted Costs with 1-Day Backup Retention (not 7-day)

When backup retention reduced from 7 days to 1 day, snapshots should decrease proportionally:
- **Backup cost reduction**: €5.76 / 7 ≈ **€0.82/month** (1-day retention)

**New monthly cost (excluding Premium SSD, with 1-day backup):**
- €47.14 + €1.97 + €3.64 + €0.82 + €1.17 = **€54.74/month**

---

## Year Budget Projection

**Today's date**: April 12, 2026  
**Days elapsed in 2026**: 102 days (Jan 31 + Feb 28 + Mar 31 + Apr 12)  
**Days remaining in 2026**: 263 days (Apr 18 + May 31 + Jun 30 + Jul 31 + Aug 31 + Sep 30 + Oct 31 + Nov 30 + Dec 31)  
**Months remaining**: 8 months + 18 days = **8.6 months**

**Grant budget remaining**: €2,000.00 (assuming annual, not monthly allocation)

**Cost for remaining period:**
- €54.74/month × 8.6 months = **€470.76**

**Budget status:**
- Remaining grant: €2,000.00
- Projected cost (Apr 13 - Dec 31): €470.76
- **Headroom: €1,529.24** ✅

---

## Reality Check

**Actual monthly burn rate**: €54.74 (excluding Premium SSD, with 1-day backup)

This is **well within** your €2,000 annual budget.

You can sustain PROCHAT-APPS indefinitely at this cost level.

---

## What's Actually Costing Money

1. **Virtual Machines (€47.14/month)** — the Dokploy VM runs 24/7
2. **Backup infrastructure (€0.82/month)** — 1-day instant recovery snapshots
3. **Storage (€5.61/month)** — OS disk + backup staging + HDD
4. **IP address (€1.17/month)** — static public IP
5. **Monitoring (€0.00)** — included in VM cost

**Premium SSD** (€13.46/month) — now detached, not in these costs

---

**Conclusion: You are WELL within budget at €470.76 for remaining 8.6 months.**

Last updated: 2026-04-12
