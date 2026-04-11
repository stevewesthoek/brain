# Phase 4F: Approval Dashboard

Web-based UI for reviewing, approving, and rejecting mutations. Replaces manual Slack reactions with a dedicated dashboard — faster, clearer, audit-trail friendly.

## Overview

**Three components:**
1. **Mutation Queue View** — Pending mutations sorted by risk/impact
2. **Mutation Detail Modal** — Full context: payload, risk factors, audit trail
3. **Batch Operations** — Approve/reject multiple mutations at once
4. **Real-time Updates** — WebSocket or polling for live status

## Technology Stack

- **Frontend**: React (TypeScript) — same as ProBot
- **Backend**: Lightweight Express server or integrate into HTTP server
- **Real-time**: WebSockets (Socket.IO) or JSON polling
- **Database**: SQLite (same as CLI)
- **Auth**: None for MVP (localhost-only), extend with basic auth later

## Architecture

```
┌─────────────────────────────────────────────────────────┐
│                   Web Browser (localhost:3000)            │
│  ┌──────────────────────────────────────────────────┐   │
│  │  Mutation Dashboard                              │   │
│  │  - Pending mutations list                        │   │
│  │  - Real-time status (via WebSocket)              │   │
│  │  - Approve/Reject buttons                        │   │
│  │  - Detail modal with full context                │   │
│  │  - Batch operations                              │   │
│  └──────────────────────────────────────────────────┘   │
└─────────────────────────────────────────────────────────┘
         ↕ (fetch mutations, POST approve/reject)
┌─────────────────────────────────────────────────────────┐
│         Dashboard API Server (localhost:3001)            │
│  ┌──────────────────────────────────────────────────┐   │
│  │  GET  /api/mutations (pending/approved/applied)  │   │
│  │  POST /api/mutations/:id/approve                 │   │
│  │  POST /api/mutations/:id/reject                  │   │
│  │  GET  /api/mutations/:id/preview                 │   │
│  │  WebSocket /ws (real-time status)                │   │
│  └──────────────────────────────────────────────────┘   │
└─────────────────────────────────────────────────────────┘
         ↕ (read/update SQLite, trigger CLI)
┌─────────────────────────────────────────────────────────┐
│              SQLite Database                            │
│  - pending_mutations                                   │
│  - change_events                                       │
│  - campaigns, recommendations                          │
└─────────────────────────────────────────────────────────┘
```

## API Endpoints

### GET /api/mutations

Fetch mutations with filters.

**Query Parameters:**
```
?status=pending|approved|applied|rejected|failed
?sort=impact|risk|created_at
?order=asc|desc
?limit=50
?offset=0
```

**Response:**
```json
{
  "mutations": [
    {
      "id": 5,
      "mutation_type": "apply_recommendation",
      "resource_type": "recommendation",
      "resource_id": "5",
      "status": "pending",
      "impact": 850.00,
      "created_at": "2026-04-11T14:30:15Z",
      "risk_score": {
        "score": 45,
        "level": "medium",
        "reasons": ["Impact > $500"]
      },
      "payload": {...},
      "campaign_id": "123456"
    }
  ],
  "total": 12,
  "pending": 5,
  "approved": 3,
  "applied": 2,
  "rejected": 2
}
```

### GET /api/mutations/:id

Fetch single mutation with full context.

**Response:**
```json
{
  "mutation": {...},
  "audit_trail": [
    {
      "event_type": "recommendation_queued",
      "created_at": "2026-04-11T14:30:15Z",
      "details": {...}
    },
    {
      "event_type": "mutation_pending_escalation",
      "created_at": "2026-04-11T14:35:22Z",
      "details": {...}
    }
  ]
}
```

### POST /api/mutations/:id/approve

Approve a mutation.

**Request:**
```json
{
  "reason": "(optional) manual approval reason"
}
```

**Response:**
```json
{
  "success": true,
  "mutation_id": 5,
  "status": "approved",
  "updated_at": "2026-04-11T14:40:00Z"
}
```

### POST /api/mutations/:id/reject

Reject a mutation.

**Request:**
```json
{
  "reason": "Budget under target, hold for now"
}
```

**Response:**
```json
{
  "success": true,
  "mutation_id": 5,
  "status": "rejected",
  "reason": "Budget under target, hold for now",
  "updated_at": "2026-04-11T14:40:00Z"
}
```

### POST /api/mutations/:id/preview

Preview what the mutation will do (dry-run output).

**Response:**
```json
{
  "preview": "Would add negative keyword: 'bad keyword' to campaign 123",
  "dry_run_output": "...",
  "estimated_impact": 850.00
}
```

### POST /api/mutations/batch-approve

Approve multiple mutations.

**Request:**
```json
{
  "ids": [5, 6, 7],
  "reason": "Approved via dashboard batch operation"
}
```

**Response:**
```json
{
  "success": true,
  "approved": [5, 6, 7],
  "failed": [],
  "count": 3
}
```

### WebSocket /ws

Real-time updates for mutation status changes.

**Client sends:**
```json
{"action": "subscribe", "filters": {"status": "pending"}}
```

**Server broadcasts:**
```json
{
  "event": "mutation_status_changed",
  "mutation_id": 5,
  "new_status": "approved",
  "updated_at": "2026-04-11T14:40:00Z"
}
```

## Dashboard UI Layout

### Main View

```
┌─────────────────────────────────────────────────────────┐
│  Google Ads Mutations Dashboard                         │
├─────────────────────────────────────────────────────────┤
│                                                         │
│  📊 Pipeline Summary                                   │
│  ┌──────────────┐  ┌──────────────┐  ┌──────────────┐ │
│  │ Pending   5  │  │ Approved  3  │  │ Applied   2  │ │
│  └──────────────┘  └──────────────┘  └──────────────┘ │
│                                                         │
│  🔍 Filter & Sort                                      │
│  Status: [All ▼] Risk: [All ▼] Sort: [Impact ▼]      │
│                                                         │
│  📋 Mutations List                                     │
│  ┌─────┬──────────────────────┬────────┬───────────┐  │
│  │ ID  │ Type                 │ Impact │ Risk      │  │
│  ├─────┼──────────────────────┼────────┼───────────┤  │
│  │ 5   │ apply_recommendation │ $850   │ 🟡 MEDIUM │  │
│  │ 6   │ add_neg_keywords     │ $120   │ 🟢 LOW    │  │
│  │ 7   │ apply_recommendation │$2,500  │ 🔴 URGENT │  │
│  └─────┴──────────────────────┴────────┴───────────┘  │
│                                                         │
└─────────────────────────────────────────────────────────┘
```

### Mutation Detail Modal

```
┌──────────────────────────────────────────────────────┐
│  Mutation Details (ID: 5)                        [×] │
├──────────────────────────────────────────────────────┤
│                                                      │
│  Type: apply_recommendation                         │
│  Status: pending                                    │
│  Impact: $850.00                                    │
│  Risk: 🟡 MEDIUM (45/100)                           │
│                                                      │
│  Risk Factors:                                      │
│  • Impact > $500                                    │
│  • Medium priority (manual review)                  │
│                                                      │
│  Resource:                                          │
│  • Type: recommendation                             │
│  • ID: 5                                            │
│  • Campaign: 123456                                 │
│                                                      │
│  Full Payload:                                      │
│  {                                                  │
│    "recommendation_type": "BID_ADJUSTMENT",         │
│    "priority": "MEDIUM",                            │
│    "description": "Increase bids on high CPA..."    │
│  }                                                  │
│                                                      │
│  Audit Trail:                                       │
│  • 2026-04-11 14:30 - Queued via CLI                │
│  • 2026-04-11 14:35 - Escalation triggered         │
│                                                      │
│  ┌─────────┬──────────┬──────────────┐              │
│  │ Preview │ Approve  │ Reject       │              │
│  └─────────┴──────────┴──────────────┘              │
│                                                      │
└──────────────────────────────────────────────────────┘
```

## Implementation

### Backend (Express.js)

```typescript
// tools/google-ads/dashboard-server.ts
import express from 'express';
import sqlite3 from 'sqlite3';
import { WebSocketServer } from 'ws';
import http from 'http';

const app = express();
const server = http.createServer(app);
const wss = new WebSocketServer({ server });

const DB_PATH = 'data/google-ads/google_ads.sqlite3';
const db = new sqlite3.Database(DB_PATH);

// GET /api/mutations
app.get('/api/mutations', (req, res) => {
  const { status = 'pending', sort = 'risk', order = 'desc', limit = 50, offset = 0 } = req.query;
  
  const query = `
    SELECT * FROM pending_mutations
    WHERE status = ?
    ORDER BY ${sort === 'impact' ? 'json_extract(payload, "$.impact_estimate")' : 'id'} ${order}
    LIMIT ? OFFSET ?
  `;
  
  db.all(query, [status, limit, offset], (err, rows) => {
    if (err) {
      res.status(500).json({ error: err.message });
      return;
    }
    
    res.json({
      mutations: rows.map(enrichMutation),
      total: rows.length,
    });
  });
});

// POST /api/mutations/:id/approve
app.post('/api/mutations/:id/approve', (req, res) => {
  const { id } = req.params;
  const { reason } = req.body;
  
  db.run(
    `UPDATE pending_mutations SET status = ?, updated_at = ? WHERE id = ?`,
    ['approved', new Date().toISOString(), id],
    function(err) {
      if (err) {
        res.status(500).json({ error: err.message });
        return;
      }
      
      // Broadcast via WebSocket
      broadcastMutationUpdate({ mutation_id: id, new_status: 'approved' });
      
      res.json({ success: true, mutation_id: id, status: 'approved' });
    }
  );
});

// WebSocket
wss.on('connection', (ws) => {
  ws.on('message', (message) => {
    const { action, filters } = JSON.parse(message);
    if (action === 'subscribe') {
      ws.filters = filters;
      ws.send(JSON.stringify({ event: 'subscribed', filters }));
    }
  });
});

function broadcastMutationUpdate(update) {
  wss.clients.forEach((client) => {
    if (client.filters?.status === update.new_status || !client.filters) {
      client.send(JSON.stringify({
        event: 'mutation_status_changed',
        ...update,
        updated_at: new Date().toISOString(),
      }));
    }
  });
}

server.listen(3001, () => console.log('Dashboard API on port 3001'));
```

### Frontend (React)

```typescript
// projects/google-ads-dashboard/src/components/MutationList.tsx
import React, { useEffect, useState } from 'react';
import { useMutationWebSocket } from '../hooks/useMutationWebSocket';

export function MutationList() {
  const [mutations, setMutations] = useState([]);
  const [filter, setFilter] = useState('pending');
  const ws = useMutationWebSocket(filter);

  useEffect(() => {
    // Fetch initial mutations
    fetch(`/api/mutations?status=${filter}`)
      .then(r => r.json())
      .then(data => setMutations(data.mutations));
  }, [filter]);

  useEffect(() => {
    // Listen for real-time updates
    ws?.on('mutation_status_changed', (update) => {
      setMutations(prev =>
        prev.map(m =>
          m.id === update.mutation_id
            ? { ...m, status: update.new_status }
            : m
        )
      );
    });
  }, [ws]);

  return (
    <div>
      <h1>Google Ads Mutations</h1>
      
      <div className="filters">
        <select value={filter} onChange={e => setFilter(e.target.value)}>
          <option value="pending">Pending</option>
          <option value="approved">Approved</option>
          <option value="applied">Applied</option>
          <option value="rejected">Rejected</option>
        </select>
      </div>

      <table>
        <thead>
          <tr>
            <th>ID</th>
            <th>Type</th>
            <th>Impact</th>
            <th>Risk</th>
            <th>Actions</th>
          </tr>
        </thead>
        <tbody>
          {mutations.map(m => (
            <MutationRow key={m.id} mutation={m} />
          ))}
        </tbody>
      </table>
    </div>
  );
}

function MutationRow({ mutation }) {
  const [showDetail, setShowDetail] = useState(false);

  return (
    <>
      <tr>
        <td>{mutation.id}</td>
        <td>{mutation.mutation_type}</td>
        <td>${mutation.impact?.toFixed(2)}</td>
        <td className={`risk-${mutation.risk_score?.level}`}>
          {mutation.risk_score?.level?.toUpperCase()}
        </td>
        <td>
          <button onClick={() => setShowDetail(true)}>View</button>
          {mutation.status === 'pending' && (
            <>
              <button onClick={() => approveMutation(mutation.id)}>Approve</button>
              <button onClick={() => rejectMutation(mutation.id)}>Reject</button>
            </>
          )}
        </td>
      </tr>

      {showDetail && (
        <MutationDetailModal mutation={mutation} onClose={() => setShowDetail(false)} />
      )}
    </>
  );
}

async function approveMutation(id) {
  await fetch(`/api/mutations/${id}/approve`, {
    method: 'POST',
    body: JSON.stringify({ reason: 'Approved via dashboard' }),
    headers: { 'Content-Type': 'application/json' },
  });
}

async function rejectMutation(id) {
  const reason = prompt('Rejection reason:');
  if (reason) {
    await fetch(`/api/mutations/${id}/reject`, {
      method: 'POST',
      body: JSON.stringify({ reason }),
      headers: { 'Content-Type': 'application/json' },
    });
  }
}
```

## Deployment

### Option A: Standalone Service

```bash
# Install dependencies
npm install express sqlite3 ws typescript

# Build
npx tsc tools/google-ads/dashboard-server.ts

# Run
node tools/google-ads/dashboard-server.js
# Listens on http://localhost:3001
```

### Option B: Integrate into ProBot

Add mutations dashboard tab to existing ProBot dashboard:
- Reuse existing React setup
- Share SQLite connection
- Deploy together

## Integration with CLI

CLI remains unchanged — dashboard reads/writes same SQLite tables.

Dashboard POST approve/reject calls HTTP server (`localhost:8001`) or updates SQLite directly.

## Next Phase (4G): Analytics

Track mutation impact vs predicted:
- Store actual results post-application
- Compare to risk_score.reasons
- Identify patterns (e.g., "HIGH priority recommendations have 85% success rate")

---

**Status**: 🚀 Ready for implementation  
**Complexity**: Medium (React + Express + WebSocket)  
**Time Estimate**: 4-6 hours  
**Risk**: Low (read/write same SQLite as CLI)
