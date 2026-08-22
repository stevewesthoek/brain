# Azure Complete Cost Breakdown — All Services

## dokploy-azure Subscription

### Month-to-Date (April 1-12, 2026) — 12 Days into Month

| Service Category | Subcategory | MTD Cost (EUR) | Daily Avg | Est. Full Month | Est. Annual |
|---|---|---|---|---|---|
| Virtual Machines | Dasv5 Series | €46.62 | €3.88/day | €116.56 | €1,398.72 |
| Storage | Premium SSD (Data Disk) | €13.46 | €1.12/day | €33.88 | €406.56 |
| Storage | Standard HDD (Backups) | €3.60 | €0.30/day | €9.07 | €108.84 |
| Storage | Standard SSD (OS Disk) | €1.95 | €0.16/day | €4.91 | €58.92 |
| Backup | Recovery Services Vault | €5.68 | €0.47/day | €14.31 | €171.72 |
| Virtual Network | Static IP Addresses | €1.16 | €0.10/day | €2.92 | €35.04 |
| Bandwidth | Inter-Region | €0.00000966 | €0.0000008/day | €0.00002 | €0.00024 |
| Azure Monitor | Monitoring/Alerts | €0.00 | €0.00 | €0.00 | €0.00 |
| **TOTAL** | — | **€72.47** | **€6.04/day** | **€181.65** | **€2,179.80** |

**Budget Status**: €2,179.80 annually = **€179.80 OVER** the €2,000 grant by 9%

---

## supabase-azure Subscription

### Month-to-Date (April 1-12, 2026) — 12 Days into Month

| Service Category | Subcategory | MTD Cost (EUR) | Daily Avg | Est. Full Month | Est. Annual |
|---|---|---|---|---|---|
| Virtual Machines | Dasv5 Series (Supabase) | €23.32 | €1.94/day | €58.80 | €705.60 |
| Foundry Tools | Azure Speech (Text-to-Speech) | €13.05 | €1.09/day | €32.88 | €394.56 |
| Backup | Recovery Services Vault | €14.88 | €1.24/day | €37.50 | €450.00 |
| Storage | Premium SSD (DB Disk) | €3.61 | €0.30/day | €9.11 | €109.32 |
| Storage | Standard HDD | €2.22 | €0.19/day | €5.59 | €67.08 |
| Storage | Standard SSD (OS Disk) | €1.49 | €0.12/day | €3.75 | €45.00 |
| Storage | Blob Storage | €0.00001 | €0.000001/day | €0.00002 | €0.00024 |
| Virtual Network | Static IP Addresses | €1.16 | €0.10/day | €2.92 | €35.04 |
| Bandwidth | Inter-Region | €0.0000036 | €0.0000003/day | €0.00001 | €0.00012 |
| Automation | Process Automation | €0.00 | €0.00 | €0.00 | €0.00 |
| **TOTAL** | — | **€59.74** | **€4.98/day** | **€150.55** | **€1,806.60** |

**Budget Status**: €1,806.60 annually = **€193.40 UNDER** the €2,000 grant ✅

---

## Combined Budget Analysis

| Metric | Value |
|---|---|
| dokploy-azure (Dokploy) Annual | €2,179.80 |
| supabase-azure (Supabase + TTS) Annual | €1,806.60 |
| **Combined Annual** | **€3,986.40** |
| Non-Profit Grant Budget | €2,000.00 |
| **OVERAGE** | **€1,986.40 (199% of budget)** |

### Per-Subscription Grant Allocation

If the €2,000 annual grant must be split between two subscriptions:

- **dokploy-azure gets €1,090** → €2,179.80 cost = **€1,089.80 overage**
- **supabase-azure gets €910** → €1,806.60 cost = **€896.60 overage**

**Both subscriptions exceed their pro-rata budget allocation.**

---

## Days Remaining & Budget Runway

### Current Month (April 2026)

- **Days elapsed**: 12 of 30 (40%)
- **Days remaining**: 18 (60%)

#### dokploy-azure
- **MTD spend**: €72.47
- **Daily rate**: €6.04/day
- **Projected April total**: €181.65
- **Grant allocation (monthly)**: €181.65/12 = €15.14/month
- **April will exceed monthly allocation by**: €181.65 - €15.14 = **€166.51**

#### supabase-azure
- **MTD spend**: €59.74
- **Daily rate**: €4.98/day
- **Projected April total**: €150.55
- **Grant allocation (monthly)**: €150.55/12 = €12.55/month
- **April will exceed monthly allocation by**: €150.55 - €12.55 = **€138.00**

### Remaining Budget for Rest of Year

**If both subscriptions continue at current burn rate:**

| Subscription | Jan-Apr YTD | Monthly Avg | Months Left | Projected Rest of Year | Total Annual | Overage |
|---|---|---|---|---|---|---|
| dokploy-azure | €72.47 | €181.65 | 8 | €1,453.20 | €1,525.67 (4 mo) | exceeds budget |
| supabase-azure | €59.74 | €150.55 | 8 | €1,204.40 | €1,264.14 (4 mo) | **OK** ✅ |

---

## What's Costing Money (Service Breakdown)

### dokploy-azure — Dokploy Infrastructure

1. **Virtual Machines: €46.62/month**
   - 1x Standard_D4as_v5 in Spain Central
   - 4 vCPU, 16 GiB RAM, AMD EPYC Processors
   - Running continuously

2. **Storage — Disks: €19.01/month**
   - Premium SSD (256 GB P15 data disk): €13.46/month
   - Standard SSD (30 GB OS disk): €1.95/month
   - Standard HDD (backup staging): €3.60/month

3. **Backup & Recovery: €5.68/month**
   - Recovery Services Vault with snapshots/restore points

4. **Networking: €1.16/month**
   - 1 static public IP address

5. **Bandwidth: €0.00 (negligible)**
   - Inter-region replication/egress

**Total: €72.47/month**

### supabase-azure — Supabase Database + TTS

1. **Virtual Machines: €23.32/month**
   - 1x Standard_D4as_v5 in Spain Central (Supabase server)
   - Same spec as Dokploy VM but lower utilization

2. **Azure Speech Services (TTS): €13.05/month**
   - Text-to-Speech API usage
   - Foundry Tools / Cognitive Services
   - **This is your variable cost that grows with usage**

3. **Backup & Recovery: €14.88/month**
   - Recovery Services Vault for database backups
   - Higher cost than dokploy-azure because database criticality

4. **Storage — Disks: €7.32/month**
   - Premium SSD (database disk): €3.61/month
   - Standard HDD (backup): €2.22/month
   - Standard SSD (OS): €1.49/month

5. **Networking: €1.16/month**
   - 1 static public IP address

6. **Blob Storage: €0.00 (negligible)**
   - Minimal usage

**Total: €59.74/month**

---

## Key Findings

1. **You are 199% over budget annually** when combining both subscriptions (€3,986.40 vs €2,000 grant)
2. **Egress/Bandwidth is negligible** (~€0 for both)
3. **TTS is your variable cost driver** on supabase-azure (€13.05/month currently)
4. **Backup costs are high**: Combined €20.56/month (28% of total spend)
5. **Both VMs run 24/7** at €69.94/month combined
6. **dokploy-azure exceeds budget**, supabase-azure is within budget individually

---

## What Must Change for 2026

To stay within the €2,000 annual grant:
- **Option 1**: Reduce dokploy-azure VM size (€20-30/month savings)
- **Option 2**: Reduce backup retention (€10-15/month savings)
- **Option 3**: Pause TTS during off-peak (€5-10/month savings)
- **Option 4**: Request larger grant or find additional funding (€1,986.40 shortfall)
- **Option 5**: Hybrid — combination of above

---

## Question: What is ProKit?

I don't have clarity on what "ProKit staging" or "ProKit data costs" refers to. Is this:
- A product/service you offer?
- A client or deployment?
- A database tier?
- Something else?

Please clarify so I can assess whether staging it would fit within remaining budget.

Last updated: 2026-04-12
