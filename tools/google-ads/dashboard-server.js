#!/usr/bin/env node
"use strict";
/**
 * Google Ads Mutation Dashboard API Server
 *
 * Provides REST API + WebSocket for real-time mutation status updates.
 * Serves React dashboard UI on port 3000.
 *
 * Usage:
 *   npx ts-node tools/google-ads/dashboard-server.ts
 *   # Or compiled:
 *   node tools/google-ads/dashboard-server.js
 */
var __importDefault = (this && this.__importDefault) || function (mod) {
    return (mod && mod.__esModule) ? mod : { "default": mod };
};
Object.defineProperty(exports, "__esModule", { value: true });
const express_1 = __importDefault(require("express"));
const sqlite3_1 = __importDefault(require("sqlite3"));
const ws_1 = require("ws");
const http_1 = __importDefault(require("http"));
const path_1 = __importDefault(require("path"));
const cors_1 = __importDefault(require("cors"));
const body_parser_1 = require("body-parser");
const app = (0, express_1.default)();
const server = http_1.default.createServer(app);
const wss = new ws_1.WebSocketServer({ server });
// Configuration
const PORT = process.env.PORT || 3001;
const DB_PATH = process.env.DB_PATH || path_1.default.join(__dirname, "../../data/google-ads/google_ads.sqlite3");
// Middleware
app.use((0, cors_1.default)());
app.use((0, body_parser_1.json)());
// Database connection with retry
let db;
const connectDB = () => {
    return new Promise((resolve, reject) => {
        db = new sqlite3_1.default.Database(DB_PATH, (err) => {
            if (err) {
                console.error(`Failed to connect to ${DB_PATH}:`, err);
                setTimeout(connectDB, 5000);
            }
            else {
                db.configure("busyTimeout", 5000);
                db.run("PRAGMA foreign_keys = ON");
                console.log(`Connected to database: ${DB_PATH}`);
                resolve(db);
            }
        });
    });
};
// WebSocket connections tracking
const wsClients = new Set();
// ============================================================================
// API ENDPOINTS
// ============================================================================
// GET /api/mutations - List mutations with filters
app.get("/api/mutations", (req, res) => {
    const { status = "pending", sort = "id", order = "desc", limit = "50", offset = "0" } = req.query;
    // Validate sort column to prevent SQL injection
    const allowedSorts = ["id", "impact", "created_at", "status"];
    const sortCol = allowedSorts.includes(sort || "") ? sort : "id";
    const orderVal = order === "asc" ? "ASC" : "DESC";
    const query = `
    SELECT
      id, mutation_type, resource_type, resource_id, status,
      json_extract(payload, '$.impact_estimate') as impact,
      created_at, campaign_id, payload
    FROM pending_mutations
    WHERE status = ?
    ORDER BY ${sortCol} ${orderVal}
    LIMIT ? OFFSET ?
  `;
    db.all(query, [status, parseInt(limit), parseInt(offset)], (err, rows) => {
        if (err) {
            res.status(500).json({ error: err.message });
            return;
        }
        // Enrich with risk scores (from cache if available)
        const mutations = rows.map((row) => ({
            ...row,
            impact: row.impact || 0,
            payload: JSON.parse(row.payload || "{}"),
            risk_score: calculateRiskScore(row),
        }));
        // Get summary stats
        db.get(`
      SELECT
        SUM(CASE WHEN status = 'pending' THEN 1 ELSE 0 END) as pending,
        SUM(CASE WHEN status = 'approved' THEN 1 ELSE 0 END) as approved,
        SUM(CASE WHEN status = 'applied' THEN 1 ELSE 0 END) as applied,
        SUM(CASE WHEN status = 'rejected' THEN 1 ELSE 0 END) as rejected,
        COUNT(*) as total
      FROM pending_mutations
      `, (err, stats) => {
            res.json({
                mutations,
                total: stats?.total || 0,
                pending: stats?.pending || 0,
                approved: stats?.approved || 0,
                applied: stats?.applied || 0,
                rejected: stats?.rejected || 0,
            });
        });
    });
});
// GET /api/mutations/:id - Get single mutation with audit trail
app.get("/api/mutations/:id", (req, res) => {
    const { id } = req.params;
    const mutationQuery = `
    SELECT * FROM pending_mutations WHERE id = ?
  `;
    db.get(mutationQuery, [id], (err, mutation) => {
        if (err) {
            res.status(500).json({ error: err.message });
            return;
        }
        if (!mutation) {
            res.status(404).json({ error: "Mutation not found" });
            return;
        }
        // Fetch audit trail
        const auditQuery = `
      SELECT change_type, details, created_at
      FROM change_events
      WHERE resource_type = 'mutation' AND resource_id = ?
      ORDER BY created_at DESC
    `;
        db.all(auditQuery, [id], (err, auditTrail) => {
            mutation.payload = JSON.parse(mutation.payload || "{}");
            mutation.risk_score = calculateRiskScore(mutation);
            mutation.audit_trail = auditTrail.map((row) => ({
                event_type: row.change_type,
                created_at: row.created_at,
                details: JSON.parse(row.details || "{}"),
            }));
            res.json({ mutation });
        });
    });
});
// POST /api/mutations/:id/approve - Approve mutation
app.post("/api/mutations/:id/approve", (req, res) => {
    const { id } = req.params;
    const { reason } = req.body;
    const now = new Date().toISOString();
    db.run(`UPDATE pending_mutations SET status = ?, updated_at = ? WHERE id = ?`, ["approved", now, id], function (err) {
        if (err) {
            res.status(500).json({ error: err.message });
            return;
        }
        // Log to change_events
        const today = new Date().toISOString().split("T")[0];
        db.run(`INSERT INTO change_events (change_date, change_type, resource_type, resource_id, details, created_at)
       VALUES (?, ?, ?, ?, ?, ?)`, [
            today,
            "mutation_approved_via_dashboard",
            "mutation",
            id,
            JSON.stringify({ approved_by: "dashboard", reason: reason || "" }),
            now,
        ], (err) => {
            if (err) {
                res.status(500).json({ error: err.message });
                return;
            }
            // Broadcast via WebSocket
            broadcastMutationUpdate({
                mutation_id: parseInt(id),
                new_status: "approved",
                updated_at: now,
            });
            res.json({ success: true, mutation_id: id, status: "approved" });
        });
    });
});
// POST /api/mutations/:id/reject - Reject mutation
app.post("/api/mutations/:id/reject", (req, res) => {
    const { id } = req.params;
    const { reason } = req.body;
    const now = new Date().toISOString();
    db.run(`UPDATE pending_mutations SET status = ?, updated_at = ? WHERE id = ?`, ["rejected", now, id], function (err) {
        if (err) {
            res.status(500).json({ error: err.message });
            return;
        }
        // Log to change_events
        const today = new Date().toISOString().split("T")[0];
        db.run(`INSERT INTO change_events (change_date, change_type, resource_type, resource_id, details, created_at)
       VALUES (?, ?, ?, ?, ?, ?)`, [
            today,
            "mutation_rejected_via_dashboard",
            "mutation",
            id,
            JSON.stringify({ rejected_by: "dashboard", reason: reason || "" }),
            now,
        ], (err) => {
            if (err) {
                res.status(500).json({ error: err.message });
                return;
            }
            // Broadcast via WebSocket
            broadcastMutationUpdate({
                mutation_id: parseInt(id),
                new_status: "rejected",
                updated_at: now,
            });
            res.json({ success: true, mutation_id: id, status: "rejected" });
        });
    });
});
// POST /api/mutations/:id/preview - Preview mutation effects
app.post("/api/mutations/:id/preview", (req, res) => {
    const { id } = req.params;
    db.get(`SELECT * FROM pending_mutations WHERE id = ?`, [id], (err, mutation) => {
        if (err) {
            res.status(500).json({ error: err.message });
            return;
        }
        if (!mutation) {
            res.status(404).json({ error: "Mutation not found" });
            return;
        }
        const payload = JSON.parse(mutation.payload || "{}");
        let preview = "";
        switch (mutation.mutation_type) {
            case "add_negative_keywords":
                preview = `Would add negative keyword: "${payload.keyword_text}" (${payload.match_type}) to campaign ${mutation.campaign_id}`;
                break;
            case "apply_recommendation":
                preview = `Would apply ${payload.recommendation_type} recommendation to campaign ${mutation.campaign_id}: ${payload.description}`;
                break;
            case "bid_adjustment":
                preview = `Would adjust bids by ${payload.adjustment}x for keywords matching "${payload.keyword_pattern}"`;
                break;
            default:
                preview = `Would execute ${mutation.mutation_type} on ${mutation.resource_type} ${mutation.resource_id}`;
        }
        res.json({
            preview,
            dry_run_output: "Dry-run (no changes made)",
            estimated_impact: payload.impact_estimate || 0,
            risk_level: calculateRiskScore(mutation).level,
        });
    });
});
// POST /api/mutations/batch-approve - Approve multiple mutations
app.post("/api/mutations/batch-approve", (req, res) => {
    const { ids, reason } = req.body;
    if (!Array.isArray(ids) || ids.length === 0) {
        res.status(400).json({ error: "ids must be a non-empty array" });
        return;
    }
    const now = new Date().toISOString();
    const today = now.split("T")[0];
    // Use transaction for atomic batch operation
    db.serialize(() => {
        db.run("BEGIN TRANSACTION");
        const placeholders = ids.map(() => "?").join(",");
        db.run(`UPDATE pending_mutations SET status = ?, updated_at = ? WHERE id IN (${placeholders})`, ["approved", now, ...ids], function (err) {
            if (err) {
                db.run("ROLLBACK");
                res.status(500).json({ error: err.message });
                return;
            }
            // Log each approval
            const stmt = db.prepare(`INSERT INTO change_events (change_date, change_type, resource_type, resource_id, details, created_at)
           VALUES (?, ?, ?, ?, ?, ?)`);
            ids.forEach((id) => {
                stmt.run([
                    today,
                    "mutation_batch_approved_via_dashboard",
                    "mutation",
                    id,
                    JSON.stringify({ reason: reason || "", approved_count: ids.length }),
                    now,
                ]);
            });
            stmt.finalize((err) => {
                if (err) {
                    db.run("ROLLBACK");
                    res.status(500).json({ error: err.message });
                }
                else {
                    db.run("COMMIT");
                    // Broadcast updates
                    ids.forEach((id) => {
                        broadcastMutationUpdate({
                            mutation_id: id,
                            new_status: "approved",
                            updated_at: now,
                        });
                    });
                    res.json({ success: true, approved: ids, failed: [], count: ids.length });
                }
            });
        });
    });
});
// POST /api/mutations/batch-reject - Reject multiple mutations
app.post("/api/mutations/batch-reject", (req, res) => {
    const { ids, reason } = req.body;
    if (!Array.isArray(ids) || ids.length === 0) {
        res.status(400).json({ error: "ids must be a non-empty array" });
        return;
    }
    const now = new Date().toISOString();
    const today = now.split("T")[0];
    db.serialize(() => {
        db.run("BEGIN TRANSACTION");
        const placeholders = ids.map(() => "?").join(",");
        db.run(`UPDATE pending_mutations SET status = ?, updated_at = ? WHERE id IN (${placeholders})`, ["rejected", now, ...ids], function (err) {
            if (err) {
                db.run("ROLLBACK");
                res.status(500).json({ error: err.message });
                return;
            }
            const stmt = db.prepare(`INSERT INTO change_events (change_date, change_type, resource_type, resource_id, details, created_at)
           VALUES (?, ?, ?, ?, ?, ?)`);
            ids.forEach((id) => {
                stmt.run([
                    today,
                    "mutation_batch_rejected_via_dashboard",
                    "mutation",
                    id,
                    JSON.stringify({ reason: reason || "", rejected_count: ids.length }),
                    now,
                ]);
            });
            stmt.finalize((err) => {
                if (err) {
                    db.run("ROLLBACK");
                    res.status(500).json({ error: err.message });
                }
                else {
                    db.run("COMMIT");
                    ids.forEach((id) => {
                        broadcastMutationUpdate({
                            mutation_id: id,
                            new_status: "rejected",
                            updated_at: now,
                        });
                    });
                    res.json({ success: true, rejected: ids, failed: [], count: ids.length });
                }
            });
        });
    });
});
// GET /api/health - Server health check
app.get("/api/health", (req, res) => {
    res.json({
        status: "ok",
        timestamp: new Date().toISOString(),
        database: "connected",
        websocket_clients: wsClients.size,
    });
});
// ============================================================================
// WebSocket
// ============================================================================
wss.on("connection", (ws) => {
    console.log("WebSocket client connected");
    wsClients.add(ws);
    ws.on("message", (message) => {
        try {
            const data = JSON.parse(message);
            if (data.action === "subscribe") {
                ws.filters = data.filters || {};
                ws.send(JSON.stringify({ event: "subscribed", filters: data.filters }));
            }
        }
        catch (err) {
            console.error("WebSocket message error:", err);
        }
    });
    ws.on("close", () => {
        wsClients.delete(ws);
        console.log("WebSocket client disconnected");
    });
    ws.on("error", (err) => {
        console.error("WebSocket error:", err);
    });
});
function broadcastMutationUpdate(update) {
    wsClients.forEach((client) => {
        if (client.readyState === 1) {
            // OPEN
            const filters = client.filters || {};
            if (!filters.status || filters.status === update.new_status) {
                client.send(JSON.stringify({
                    event: "mutation_status_changed",
                    ...update,
                }));
            }
        }
    });
}
// ============================================================================
// HELPER FUNCTIONS
// ============================================================================
function calculateRiskScore(mutation) {
    // Simplified risk scoring (full implementation in notifications.py)
    const payload = mutation.payload || {};
    const impact = payload.impact_estimate || 0;
    let score = 0;
    const reasons = [];
    if (impact > 1000) {
        score += 30;
        reasons.push(`High impact: $${impact.toFixed(2)}`);
    }
    if (impact > 500) {
        score += 15;
        reasons.push("Medium impact");
    }
    let level = "low";
    if (score >= 80)
        level = "urgent";
    else if (score >= 60)
        level = "high";
    else if (score >= 30)
        level = "medium";
    return { score: Math.min(score, 100), level, reasons };
}
// ============================================================================
// SERVER STARTUP
// ============================================================================
connectDB().then(() => {
    server.listen(PORT, () => {
        console.log(`\n🚀 Dashboard API Server`);
        console.log(`   API:       http://localhost:${PORT}/api`);
        console.log(`   WebSocket: ws://localhost:${PORT}`);
        console.log(`   Health:    http://localhost:${PORT}/api/health\n`);
    });
});
process.on("SIGINT", () => {
    console.log("\nShutting down...");
    wss.close();
    server.close();
    db.close();
    process.exit(0);
});
exports.default = app;
