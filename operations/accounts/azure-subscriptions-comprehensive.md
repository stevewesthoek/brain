# Azure Subscriptions & Access Control — Complete Reference

## Overview

Two separate Azure AD tenants and non-profit grant subscriptions ($2,000 USD each annually) for Yeshua Academy infrastructure.

---

## Subscription 1: PROCHAT-APPS

### Basic Details

| Property | Value |
|---|---|
| **Subscription Name** | PROCHAT-APPS |
| **Subscription ID** | `1db6646e-69c0-4ee0-a4d5-53d40421a5a4` |
| **Tenant** | yeshuaacademypt.onmicrosoft.com |
| **Tenant ID** | `afab256a-cbf5-4aab-a7d1-f271bda38123` |
| **Owner Account** | steve@yeshuaacademypt.onmicrosoft.com |
| **Grant Type** | Non-Profit — $2,000 USD/year |
| **Portal Link** | https://portal.azure.com/#@yeshuaacademypt.onmicrosoft.com/resource/subscriptions/1db6646e-69c0-4ee0-a4d5-53d40421a5a4 |
| **Cost Management** | https://portal.azure.com/#view/Microsoft_Azure_CostManagement/CostAnalysisMenuBlade/subscriptionId/1db6646e-69c0-4ee0-a4d5-53d40421a5a4 |

### Primary Infrastructure

| Component | Details |
|---|---|
| **VM** | vm-dokploy (Standard_D4as_v5: 4 vCPU, 16 GiB RAM) — Docker/Kubernetes host in Spain Central |
| **OS Disk** | 30 GB StandardSSD — `/dev/sda` |
| **Data Disk** | 256 GB StandardSSD (downgraded from Premium on 2026-04-12) — `/dev/sdb`, mounted at `/mnt/data-dokploy` |
| **IP Address** | 1 static public IP (resource name: dokploy-ip or similar) |
| **Backup** | Recovery Services Vault (cloudpanel-dokploy-vault) with 1-day instant recovery snapshots, 7-day daily retention |

### Service Principal for Programmatic Access

**Name**: `claude-billing-prochat-apps`  
**Application ID**: `fd66920f-33ef-454e-bb83-0b0ec10f10bf`  
**Object ID**: `268c78a8-b900-40d3-9046-aac5ed28373e`  
**Tenant ID**: `afab256a-cbf5-4aab-a7d1-f271bda38123`  
**Credentials File**: `~/.config/azure-billing/prochat-apps.env`

**Assigned Roles (Subscription Level)**:
- ✅ **Contributor** — Full access to create, modify, delete resources (used for disk migration, backups, etc.)
- ✅ **Cost Management Reader** — Read cost data from Cost Management API
- ✅ **Billing Reader** — Read billing data

**Secret Expiry**: 2027-04-12 (created 2026-04-12, valid 1 year)

### Budget Status

| Metric | Value |
|---|---|
| Annual Grant | $2,000 USD = €1,840 EUR |
| YTD Spending (Jan 1 - Apr 12) | €424.33 |
| Remaining Budget | €1,415.67 |
| Actual Monthly Burn | ~€126.63/month (excluding Premium SSD) |
| Monthly Allowance | €163.85/month |
| Status | ✅ €37.22/month UNDER budget |
| Projected Year-End Balance | €321.56 remaining |

---

## Subscription 2: PROCHAT-DATA

### Basic Details

| Property | Value |
|---|---|
| **Subscription Name** | PROCHAT-DATA |
| **Subscription ID** | `6e99b82d-43e3-41cc-ad94-8733afeb2a7e` |
| **Tenant** | yeshuaacademy.onmicrosoft.com |
| **Tenant ID** | `290d8a41-0cbc-450b-9263-f018dc28165d` |
| **Owner Account** | admin@yeshuaacademy.onmicrosoft.com |
| **Grant Type** | Non-Profit — $2,000 USD/year |
| **Portal Link** | https://portal.azure.com/#@yeshuaacademy.onmicrosoft.com/resource/subscriptions/6e99b82d-43e3-41cc-ad94-8733afeb2a7e |
| **Cost Management** | https://portal.azure.com/#view/Microsoft_Azure_CostManagement/CostAnalysisMenuBlade/subscriptionId/6e99b82d-43e3-41cc-ad94-8733afeb2a7e |

### Primary Infrastructure

| Component | Details |
|---|---|
| **VM** | Supabase database server (Standard_D4as_v5) in Spain Central |
| **Database** | PostgreSQL 15+ managed by Supabase |
| **Disks** | Multiple managed disks for DB storage and OS |
| **Backup** | Recovery Services Vault with snapshots |
| **IP Address** | 1 static public IP for Supabase API endpoint |
| **Cognitive Services** | Azure Speech (Text-to-Speech) for TTS functionality |

### Service Principal for Programmatic Access

**Name**: `claude-billing-prochat-data`  
**Application ID**: `f0c7f3e8-4e19-42bf-8c57-3ae3580b5a43`  
**Object ID**: `86e66f47-48c8-4d4f-8fb5-e399bccbe011`  
**Tenant ID**: `290d8a41-0cbc-450b-9263-f018dc28165d`  
**Credentials File**: `~/.config/azure-billing/prochat-data.env`

**Assigned Roles (Subscription Level)**:
- ✅ **Contributor** — Full access to create, modify, delete resources
- ✅ **Cost Management Reader** — Read cost data from Cost Management API
- ✅ **Billing Reader** — Read billing data

**Secret Expiry**: 2027-04-12 (created 2026-04-12, valid 1 year)

### Budget Status

| Metric | Value |
|---|---|
| Annual Grant | $2,000 USD = €1,840 EUR |
| YTD Spending (Jan 1 - Apr 12) | TBD (needs calculation) |
| Actual Monthly Burn | Includes TTS usage (variable) |
| Status | ⏳ To be assessed |

---

## Accessing Azure via CLI

### Authenticate to PROCHAT-APPS

```bash
source ~/.config/azure-billing/prochat-apps.env
az login --service-principal -u "$AZURE_CLIENT_ID" -p "$AZURE_CLIENT_SECRET" --tenant "$AZURE_TENANT_ID"
az account set --subscription "$AZURE_SUBSCRIPTION_ID"
```

### Authenticate to PROCHAT-DATA

```bash
source ~/.config/azure-billing/prochat-data.env
az login --service-principal -u "$AZURE_CLIENT_ID" -p "$AZURE_CLIENT_SECRET" --tenant "$AZURE_TENANT_ID"
az account set --subscription "$AZURE_SUBSCRIPTION_ID"
```

### Query Costs (Month-to-Date)

```bash
source ~/.config/azure-billing/prochat-apps.env
az login --service-principal -u "$AZURE_CLIENT_ID" -p "$AZURE_CLIENT_SECRET" --tenant "$AZURE_TENANT_ID" -o none
TOKEN=$(az account get-access-token --query accessToken -o tsv)
curl -s "https://management.azure.com/subscriptions/$AZURE_SUBSCRIPTION_ID/providers/Microsoft.CostManagement/query?api-version=2021-10-01" -X POST \
  -H "Authorization: Bearer $TOKEN" \
  -H "Content-Type: application/json" \
  -d '{
    "type": "Usage",
    "timeframe": "MonthToDate",
    "dataset": {
      "granularity": "Monthly",
      "aggregation": {
        "totalCost": {"name": "PreTaxCost", "function": "Sum"}
      },
      "grouping": [
        {"type": "Dimension", "name": "MeterCategory"},
        {"type": "Dimension", "name": "MeterSubcategory"}
      ]
    }
  }' | jq '.properties.rows[]'
```

---

## Important Notes & Learnings

### Disk Migration (PROCHAT-APPS, April 12, 2026)

**Problem**: Premium SSD data disk costing €13.46/month, VM+backup utilization high but stable.

**Solution**: Downgrade to Standard SSD while maintaining 1-day instant recovery snapshots.

**Process** (safe migration approach):
1. Create snapshot of Premium SSD (backup before migration)
2. Create new Standard SSD disk FROM the snapshot (preserves all data)
3. Stop VM
4. Detach old Premium SSD
5. Attach new Standard SSD
6. Start VM
7. Verify mount points and data integrity
8. Delete old Premium SSD after 7 days of stability monitoring

**Verification**:
- OS automatically mounts new disk using UUID (same as old disk)
- Dokploy auto-detected new disk location (`/mnt/data-dokploy`)
- All containers restarted and recovered data automatically
- No data loss, no downtime after boot stabilization

**Result**: €13.46/month savings → PROCHAT-APPS now €37.22/month UNDER budget

### Service Principal Permissions

**Both service principals require these roles on their respective subscriptions**:
1. **Contributor** — Needed to perform infrastructure changes (VMs, disks, backups)
2. **Cost Management Reader** — Needed to query cost data via Cost Management API
3. **Billing Reader** — Needed to query detailed billing information

**Why these three?**
- **Contributor** is broad but necessary for disk operations, VM management, backup policy changes
- **Cost Management Reader** (read-only) is required; Billing Reader adds fine-grained billing queries
- Just "Reader" role is insufficient for cost queries via the Cost Management API

**Important**: Permissions take 2-5 minutes to propagate after assignment in Azure Portal. If you see "AuthorizationFailed" after assigning roles, wait and retry.

### Grant Budget Management

**Critical Rules**:
1. **Each subscription has an independent $2,000 USD grant per calendar year**
2. **Must track spending monthly** — Azure bills monthly, and grant subscriptions finalize costs mid-cycle
3. **Costs are in EUR** — convert from USD when budgeting ($1 USD ≈ €0.92 EUR)
4. **Budget formula**:
   - Total spending YTD
   - Days elapsed so far
   - Days remaining in year
   - Budget remaining = ($2,000 in EUR) - YTD spending
   - Monthly allowance = Budget remaining ÷ (Days remaining ÷ 30.44)

---

## Credentials Location

| Subscription | Credentials File |
|---|---|
| PROCHAT-APPS | `~/.config/azure-billing/prochat-apps.env` |
| PROCHAT-DATA | `~/.config/azure-billing/prochat-data.env` |
| Index | `operations/accounts/credentials-index.md` (this repo) |
| Budget Tracking | `operations/accounts/azure-prochat-apps-correct-budget.md` |

---

## Next Steps

- [ ] Monitor PROCHAT-APPS Standard SSD performance for 7 days (iostat: %util should stay <50%)
- [ ] Delete old Premium SSD (`data-dokploy`) after stability confirmed
- [ ] Continue monthly budget tracking
- [ ] Assess PROCHAT-DATA TTS usage trends
- [ ] Rotate service principal secrets before 2027-04-12 expiry

Last updated: 2026-04-12 12:00 UTC
