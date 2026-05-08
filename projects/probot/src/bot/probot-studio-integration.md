# ProBot Studio Tab Integration: Video Orchestrator

**Date:** 2026-05-08  
**Task:** Consolidate Viral Flow and Video Orchestrator status in single Studio tab  
**Implementation:** Add new API endpoints + rendering functions to dashboard.ts

---

## Overview

The Studio tab currently shows Viral Flow (content strategy) status. This update adds Video Orchestrator (production pipeline) status to the same tab.

**New behavior:**
- Studio tab = "Production Studio" combining both Viral Flow + Video Orchestrator
- Tabs within the panel: "Content Strategy" (Viral Flow) | "Production Pipeline" (Video Orchestrator)
- No new external tab needed; consolidate within single Studio tab
- Both can run independently; each has its own API endpoint

---

## Implementation Steps

### 1. Add API Endpoints (dashboard.ts)

Add these new endpoints after the existing `/api/viral-flow/*` handlers (around line 3550):

```typescript
// ────── VIDEO ORCHESTRATOR STATUS ENDPOINT ──────
if (url === "/api/video-orchestrator/status") {
  try {
    const status = await getVideoOrchestratorStatus();
    res.writeHead(200, { "Content-Type": "application/json", "Cache-Control": "no-cache" });
    res.end(JSON.stringify(status));
  } catch (err) {
    console.error("[Video Orchestrator] Status endpoint error:", String(err));
    res.writeHead(500, { "Content-Type": "application/json" });
    res.end(JSON.stringify({
      error: "Failed to get video orchestrator status",
      detail: String(err),
      database_port: 5450,
      database_name: "video_orchestrator"
    }));
  }
  return;
}

if (url === "/api/video-orchestrator/health") {
  try {
    const health = await checkVideoOrchestratorHealth();
    res.writeHead(200, { "Content-Type": "application/json", "Cache-Control": "no-cache" });
    res.end(JSON.stringify(health));
  } catch (err) {
    console.error("[Video Orchestrator] Health endpoint error:", String(err));
    res.writeHead(500, { "Content-Type": "application/json" });
    res.end(JSON.stringify({
      status: "disconnected",
      reason: String(err)
    }));
  }
  return;
}
```

### 2. Add Status Fetcher Functions

Add these functions after the getViralFlowStatus() function (around line 3150):

```typescript
async function getVideoOrchestratorStatus(): Promise<Record<string, unknown>> {
  try {
    // Try to connect to PostgreSQL on port 5450
    // Using a simple health check query
    const result = await fetch("http://localhost:5450/api/health", { timeout: 3000 });
    
    if (!result.ok) {
      return {
        database_status: "unreachable",
        message: "Database health check failed",
        port: 5450
      };
    }

    // Parse database stats from health check
    const data = await result.json();
    
    return {
      database_status: data.status ?? "unknown",
      total_videos: data.total_videos ?? 0,
      total_accounts: data.total_accounts ?? 0,
      pending_jobs: data.pending_jobs ?? 0,
      running_jobs: data.running_jobs ?? 0,
      failed_jobs_7d: data.failed_jobs_7d ?? 0,
      completed_packages: data.completed_packages ?? 0,
      timestamp: data.timestamp ?? new Date().toISOString()
    };
  } catch (err) {
    return {
      database_status: "error",
      message: String(err),
      port: 5450
    };
  }
}

async function checkVideoOrchestratorHealth(): Promise<Record<string, unknown>> {
  try {
    // Check if Docker container is running
    const { stdout } = await execFileAsync("docker", [
      "ps",
      "--filter",
      "name=video-orchestrator-postgres",
      "--format",
      "{{.State}}"
    ]);
    
    const isRunning = stdout.trim() === "running";
    
    return {
      database_running: isRunning,
      port: 5450,
      service_name: "video-orchestrator",
      timestamp: new Date().toISOString()
    };
  } catch (err) {
    return {
      database_running: false,
      error: String(err)
    };
  }
}
```

### 3. Update Studio Tab HTML

Replace the current Studio tab HTML (around line 1704) with:

```html
<div class="tab-panel" id="tab-viral-flow">
  <div style="display: flex; flex-direction: column; height: 100%; gap: 16px;">
    <!-- Sub-tabs for Viral Flow vs Video Orchestrator -->
    <div style="display: flex; gap: 8px; padding: 12px; background: var(--subtle); border-radius: 6px;">
      <button class="studio-subtab active" data-subtab="content-strategy" style="flex: 1; padding: 8px; border: none; background: var(--accent); color: white; border-radius: 4px; cursor: pointer; font-weight: 600; font-size: 0.9em;">
        📚 Content Strategy
      </button>
      <button class="studio-subtab" data-subtab="production-pipeline" style="flex: 1; padding: 8px; border: 1px solid var(--border); background: transparent; color: var(--text); border-radius: 4px; cursor: pointer; font-weight: 600; font-size: 0.9em;">
        🎬 Production Pipeline
      </button>
    </div>
    
    <!-- Content Strategy Panel (Viral Flow) -->
    <div id="studio-content-strategy" class="studio-panel active" style="flex: 1; overflow-y: auto;">
      <div class="loading"><div class="spin"></div>Loading Content Strategy...</div>
    </div>
    
    <!-- Production Pipeline Panel (Video Orchestrator) -->
    <div id="studio-production-pipeline" class="studio-panel" style="flex: 1; overflow-y: auto;">
      <div class="loading"><div class="spin"></div>Loading Production Pipeline...</div>
    </div>
  </div>
</div>
```

### 4. Add Studio Sub-Tab Switching Logic

Add this JavaScript after the main tab-switching code (around line 1945):

```javascript
// Studio sub-tabs
document.querySelectorAll('.studio-subtab').forEach(btn => {
  btn.addEventListener('click', () => {
    document.querySelectorAll('.studio-subtab').forEach(b => {
      b.style.background = b === btn ? 'var(--accent)' : 'transparent';
      b.style.color = b === btn ? 'white' : 'var(--text)';
      b.style.border = b === btn ? 'none' : '1px solid var(--border)';
    });
    
    document.querySelectorAll('.studio-panel').forEach(p => {
      p.classList.toggle('active', p.id === 'studio-' + btn.dataset.subtab);
    });
    
    if (btn.dataset.subtab === 'content-strategy') {
      refreshViralFlowPanel();
    } else if (btn.dataset.subtab === 'production-pipeline') {
      refreshProductionPipelinePanel();
    }
  });
});
```

### 5. Add Video Orchestrator Rendering Function

Add this function after renderViralFlowStudio() (around line 1906):

```javascript
function renderVideoOrchestratorStudio(status) {
  if (!status) return '<div class="nr-err">Failed to load video orchestrator status</div>';
  
  const {
    database_status,
    total_videos,
    total_accounts,
    pending_jobs,
    running_jobs,
    failed_jobs_7d,
    completed_packages,
    timestamp
  } = status;
  
  const dbHealthColor = database_status === 'healthy' ? 'var(--green)' : 
                        database_status === 'disconnected' ? 'var(--red)' :
                        'var(--yellow)';
  
  const now = new Date();
  const updateTime = timestamp ? new Date(timestamp) : now;
  const minAgo = Math.floor((now - updateTime) / 60000);
  const freshText = minAgo === 0 ? 'just now' : minAgo === 1 ? '1m ago' : minAgo + 'm ago';
  
  let html = '<div style="display: grid; grid-template-columns: repeat(3, 1fr); gap: 16px; padding: 20px;">';
  
  // Header
  html += '<div style="grid-column: 1/-1; display: flex; justify-content: space-between; align-items: center; padding: 12px 16px; background: var(--card); border-radius: 6px; border: 1px solid var(--border)">';
  html += '<div style="font-size: 0.9em; color: var(--muted)">Database: <strong style="color: ' + dbHealthColor + '">' + (database_status === 'healthy' ? '✓ Connected' : database_status === 'disconnected' ? '✗ Offline' : '⚠ Checking') + '</strong></div>';
  html += '<div style="font-size: 0.85em; color: var(--muted)">Last update: <strong>' + freshText + '</strong></div>';
  html += '<button onclick="refreshProductionPipelinePanel()" style="padding: 6px 12px; background: var(--accent); color: white; border: none; border-radius: 4px; cursor: pointer; font-size: 0.85em; font-weight: 600">🔄 Refresh</button>';
  html += '</div>';
  
  // Card 1: Pipeline Status
  html += '<div style="background: var(--card); border: 1px solid var(--border); border-radius: 8px; padding: 16px">';
  html += '<h3 style="margin: 0 0 12px 0; font-size: 0.95em; color: var(--text); font-weight: 600">📊 Pipeline Status</h3>';
  html += '<div style="font-size: 0.85em; line-height: 1.8">';
  html += '<div style="padding: 8px; margin-bottom: 6px; background: rgba(255,255,255,0.05); border-radius: 4px; color: var(--text)"><span style="color: var(--muted)">Total Videos:</span> <strong>' + total_videos + '</strong></div>';
  html += '<div style="padding: 8px; margin-bottom: 6px; background: rgba(255,255,255,0.05); border-radius: 4px; color: var(--text)"><span style="color: var(--muted)">Completed Packages:</span> <strong>' + completed_packages + '</strong></div>';
  html += '<div style="padding: 8px; background: rgba(255,255,255,0.05); border-radius: 4px; color: var(--text)"><span style="color: var(--muted)">Completion Rate:</span> <strong>' + (total_videos > 0 ? Math.round((completed_packages / total_videos) * 100) : 0) + '%</strong></div>';
  html += '</div></div>';
  
  // Card 2: Job Queue
  html += '<div style="background: var(--card); border: 1px solid var(--border); border-radius: 8px; padding: 16px">';
  html += '<h3 style="margin: 0 0 12px 0; font-size: 0.95em; color: var(--text); font-weight: 600">⚙️ Job Queue</h3>';
  html += '<div style="font-size: 0.85em; line-height: 1.8">';
  html += '<div style="padding: 8px; margin-bottom: 6px; background: rgba(52,211,153,0.15); border-radius: 4px; color: var(--text)"><span style="color: var(--muted)">Running:</span> <strong style="color: var(--green)">' + running_jobs + '</strong></div>';
  html += '<div style="padding: 8px; margin-bottom: 6px; background: rgba(124,90,240,0.15); border-radius: 4px; color: var(--text)"><span style="color: var(--muted)">Pending:</span> <strong style="color: var(--accent)">' + pending_jobs + '</strong></div>';
  html += '<div style="padding: 8px; background: rgba(239,68,68,0.15); border-radius: 4px; color: var(--text)"><span style="color: var(--muted)">Failed (7d):</span> <strong style="color: var(--red)">' + failed_jobs_7d + '</strong></div>';
  html += '</div></div>';
  
  // Card 3: Account Status
  html += '<div style="background: var(--card); border: 1px solid var(--border); border-radius: 8px; padding: 16px">';
  html += '<h3 style="margin: 0 0 12px 0; font-size: 0.95em; color: var(--text); font-weight: 600">📱 Accounts</h3>';
  html += '<div style="font-size: 0.85em; line-height: 1.8">';
  html += '<div style="padding: 8px; background: rgba(255,255,255,0.05); border-radius: 4px; color: var(--text)"><span style="color: var(--muted)">Connected Accounts:</span> <strong>' + total_accounts + '</strong></div>';
  html += '<p style="color: var(--muted); text-align: center; margin: 12px 0 0 0; font-size: 0.8em">Platforms: YouTube, TikTok, Instagram, LinkedIn, Facebook, Bluesky, X</p>';
  html += '</div></div>';
  
  // Footer
  html += '<div style="grid-column: 1/-1; padding: 12px 16px; background: var(--subtle); border-radius: 6px; border: 1px solid var(--border); font-size: 0.85em; color: var(--muted)">';
  html += '<strong style="color: var(--text)">Phase 2B Status:</strong> Local PostgreSQL production queue running. Manifests generated per production-package.schema.json. Manual fallback always available for all 9 platform targets.';
  html += '</div>';
  
  html += '</div>';
  
  return html;
}

async function refreshProductionPipelinePanel() {
  const panel = document.getElementById('studio-production-pipeline');
  if (!panel) return;
  
  panel.innerHTML = '<div class="loading"><div class="spin"></div>Loading Production Pipeline...</div>';
  
  try {
    const response = await fetch('/api/video-orchestrator/status');
    if (!response.ok) throw new Error(`HTTP ${response.status}`);
    
    const data = await response.json();
    panel.innerHTML = renderVideoOrchestratorStudio(data);
  } catch (err) {
    panel.innerHTML = '<div class="nr-err">Error: ' + esc(String(err)) + '</div>';
  }
}
```

### 6. Update Tab Click Handler

Modify the existing tab-switching code (around line 1933) to load both Viral Flow and Video Orchestrator:

```javascript
if(b.dataset.tab==='viral-flow'){
  const panel=document.getElementById('tab-viral-flow');
  if(panel){
    // Load both Viral Flow and Video Orchestrator
    // Viral Flow on first load
    fetch('/api/viral-flow/status')
      .then(r=>r.json())
      .then(data => {
        const vsPanel = document.getElementById('studio-content-strategy');
        if (vsPanel) vsPanel.innerHTML = renderViralFlowStudio(data);
      })
      .catch(e => {
        const vsPanel = document.getElementById('studio-content-strategy');
        if (vsPanel) vsPanel.innerHTML = '<div class="nr-err">Error: ' + esc(String(e)) + '</div>';
      });
    
    // Video Orchestrator on first load
    fetch('/api/video-orchestrator/status')
      .then(r=>r.json())
      .then(data => {
        const voPanel = document.getElementById('studio-production-pipeline');
        if (voPanel) voPanel.innerHTML = renderVideoOrchestratorStudio(data);
      })
      .catch(e => {
        const voPanel = document.getElementById('studio-production-pipeline');
        if (voPanel) voPanel.innerHTML = '<div class="nr-err">Error: ' + esc(String(e)) + '</div>';
      });
  }
}
```

---

## Database Connection Implementation

For the actual database health check, you'll need to implement a lightweight query to PostgreSQL:

### Option A: Simple HTTP Health Endpoint (Recommended)

The `/api/video-orchestrator/health` endpoint (already added above) checks if the database Docker container is running. For actual database queries, wrap a simple node-postgres client:

```typescript
import pg from 'pg';

async function getVideoOrchestratorStatus(): Promise<Record<string, unknown>> {
  const client = new pg.Client({
    host: 'localhost',
    port: 5450,
    user: 'postgres',
    password: 'postgres',
    database: 'video_orchestrator',
  });
  
  try {
    await client.connect();
    const result = await client.query(`SELECT check_database_health() as health`);
    const health = result.rows[0]?.health ?? { status: 'unknown' };
    await client.end();
    return health;
  } catch (err) {
    return {
      database_status: 'error',
      message: String(err),
      port: 5450
    };
  }
}
```

### Option B: Query-Based Status (If Connection Available)

```sql
SELECT 
  'healthy' as status,
  COUNT(DISTINCT video_id) as total_videos,
  (SELECT COUNT(*) FROM accounts) as total_accounts,
  (SELECT COUNT(*) FROM jobs WHERE job_status = 'pending') as pending_jobs,
  (SELECT COUNT(*) FROM jobs WHERE job_status = 'running') as running_jobs,
  (SELECT COUNT(*) FROM jobs WHERE job_status = 'failed' AND created_at > NOW() - INTERVAL '7 days') as failed_jobs_7d,
  (SELECT COUNT(*) FROM production_packages WHERE package_status = 'complete') as completed_packages,
  NOW() as timestamp
FROM videos;
```

---

## CSS Styles to Add

If not already present, add these styles to the dashboard CSS:

```css
.studio-panel {
  display: none;
}

.studio-panel.active {
  display: block;
}

.studio-subtab {
  transition: all 0.2s ease;
}

.studio-subtab:hover {
  opacity: 0.9;
}
```

---

## Testing Checklist

- [ ] Database is running on localhost:5450
- [ ] Studio tab loads without errors
- [ ] "Content Strategy" tab shows Viral Flow data
- [ ] "Production Pipeline" tab shows Video Orchestrator status
- [ ] Refresh buttons work
- [ ] Sub-tab switching updates content
- [ ] All 4 cards render correctly
- [ ] Footer text displays clearly

---

## Files Modified

- `projects/probot/src/bot/dashboard.ts` — Add endpoints, functions, HTML, JS

---

## Status

Integration ready for implementation. All code snippets provided. Requires:
1. Adding database client library (if using direct queries)
2. Copying code into dashboard.ts at specified line numbers
3. Database health query available from `check_database_health()` function in schema

