#!/usr/bin/env node
/**
 * Google Ads Mutation Dashboard - React UI
 *
 * Components for viewing, approving, and rejecting mutations.
 * Real-time updates via WebSocket.
 *
 * Usage (in React app):
 *   import { MutationDashboard } from './dashboard-ui';
 *   <MutationDashboard apiUrl="http://localhost:3001/api" wsUrl="ws://localhost:3001" />
 */

import React, { useEffect, useState, useRef } from "react";

// Types
interface Mutation {
  id: number;
  mutation_type: string;
  resource_type: string;
  resource_id: string;
  status: "pending" | "approved" | "applied" | "rejected";
  impact: number;
  created_at: string;
  campaign_id: string;
  risk_score: {
    score: number;
    level: "low" | "medium" | "high" | "urgent";
    reasons: string[];
  };
  payload: any;
}

interface DashboardStats {
  total: number;
  pending: number;
  approved: number;
  applied: number;
  rejected: number;
}

interface MutationDashboardProps {
  apiUrl: string;
  wsUrl: string;
}

// ============================================================================
// MAIN COMPONENT
// ============================================================================

export const MutationDashboard: React.FC<MutationDashboardProps> = ({ apiUrl, wsUrl }) => {
  const [mutations, setMutations] = useState<Mutation[]>([]);
  const [stats, setStats] = useState<DashboardStats | null>(null);
  const [filter, setFilter] = useState<"pending" | "approved" | "applied" | "rejected">("pending");
  const [sort, setSort] = useState("id");
  const [loading, setLoading] = useState(true);
  const [selectedIds, setSelectedIds] = useState<number[]>([]);
  const [detailMutationId, setDetailMutationId] = useState<number | null>(null);
  const wsRef = useRef<WebSocket | null>(null);

  // Fetch mutations on filter/sort change
  useEffect(() => {
    fetchMutations();
  }, [filter, sort]);

  // Setup WebSocket connection
  useEffect(() => {
    const ws = new WebSocket(wsUrl);
    wsRef.current = ws;

    ws.onopen = () => {
      console.log("WebSocket connected");
      ws.send(JSON.stringify({ action: "subscribe", filters: { status: filter } }));
    };

    ws.onmessage = (event) => {
      try {
        const data = JSON.parse(event.data);
        if (data.event === "mutation_status_changed") {
          // Update local state
          setMutations((prev) =>
            prev.map((m) =>
              m.id === data.mutation_id ? { ...m, status: data.new_status } : m
            )
          );
          // Update stats
          fetchMutations();
        }
      } catch (err) {
        console.error("WebSocket message error:", err);
      }
    };

    ws.onerror = (err) => console.error("WebSocket error:", err);
    ws.onclose = () => console.log("WebSocket disconnected");

    return () => {
      ws.close();
    };
  }, [filter, wsUrl]);

  async function fetchMutations() {
    setLoading(true);
    try {
      const response = await fetch(
        `${apiUrl}/mutations?status=${filter}&sort=${sort}&order=desc&limit=100`
      );
      const data = await response.json();
      setMutations(data.mutations || []);
      setStats({
        total: data.total,
        pending: data.pending,
        approved: data.approved,
        applied: data.applied,
        rejected: data.rejected,
      });
    } catch (err) {
      console.error("Error fetching mutations:", err);
    } finally {
      setLoading(false);
    }
  }

  async function handleApprove(ids: number[]) {
    for (const id of ids) {
      try {
        const response = await fetch(`${apiUrl}/mutations/${id}/approve`, {
          method: "POST",
          headers: { "Content-Type": "application/json" },
          body: JSON.stringify({ reason: "Approved via dashboard" }),
        });

        if (!response.ok) {
          throw new Error(`HTTP ${response.status}`);
        }

        // Optimistic update
        setMutations((prev) =>
          prev.map((m) => (m.id === id ? { ...m, status: "approved" } : m))
        );
      } catch (err) {
        alert(`Failed to approve mutation ${id}: ${err}`);
      }
    }

    setSelectedIds([]);
  }

  async function handleReject(ids: number[]) {
    const reason = prompt("Rejection reason:");
    if (!reason) return;

    for (const id of ids) {
      try {
        const response = await fetch(`${apiUrl}/mutations/${id}/reject`, {
          method: "POST",
          headers: { "Content-Type": "application/json" },
          body: JSON.stringify({ reason }),
        });

        if (!response.ok) {
          throw new Error(`HTTP ${response.status}`);
        }

        setMutations((prev) =>
          prev.map((m) => (m.id === id ? { ...m, status: "rejected" } : m))
        );
      } catch (err) {
        alert(`Failed to reject mutation ${id}: ${err}`);
      }
    }

    setSelectedIds([]);
  }

  function toggleSelect(id: number) {
    setSelectedIds((prev) =>
      prev.includes(id) ? prev.filter((x) => x !== id) : [...prev, id]
    );
  }

  function toggleSelectAll() {
    if (selectedIds.length === mutations.length) {
      setSelectedIds([]);
    } else {
      setSelectedIds(mutations.map((m) => m.id));
    }
  }

  return (
    <div className="mutation-dashboard">
      <header className="dashboard-header">
        <h1>🚀 Google Ads Mutations Dashboard</h1>
        <p>Approve, reject, and monitor mutations in real-time</p>
      </header>

      {/* Stats Cards */}
      {stats && (
        <div className="stats-grid">
          <StatCard label="Total" value={stats.total} color="#666" />
          <StatCard label="Pending" value={stats.pending} color="#FFA500" />
          <StatCard label="Approved" value={stats.approved} color="#4CAF50" />
          <StatCard label="Applied" value={stats.applied} color="#2196F3" />
          <StatCard label="Rejected" value={stats.rejected} color="#F44336" />
        </div>
      )}

      {/* Controls */}
      <div className="controls">
        <div className="filter-group">
          <label>Filter:</label>
          <select value={filter} onChange={(e) => setFilter(e.target.value as any)}>
            <option value="pending">Pending</option>
            <option value="approved">Approved</option>
            <option value="applied">Applied</option>
            <option value="rejected">Rejected</option>
          </select>
        </div>

        <div className="sort-group">
          <label>Sort by:</label>
          <select value={sort} onChange={(e) => setSort(e.target.value)}>
            <option value="id">ID</option>
            <option value="impact">Impact</option>
            <option value="created_at">Created</option>
          </select>
        </div>

        {selectedIds.length > 0 && (
          <div className="batch-actions">
            <span>{selectedIds.length} selected</span>
            {filter === "pending" && (
              <>
                <button className="btn btn-approve" onClick={() => handleApprove(selectedIds)}>
                  ✓ Approve All
                </button>
                <button className="btn btn-reject" onClick={() => handleReject(selectedIds)}>
                  ✗ Reject All
                </button>
              </>
            )}
            <button className="btn btn-clear" onClick={() => setSelectedIds([])}>
              Clear
            </button>
          </div>
        )}
      </div>

      {/* Mutations Table */}
      {loading ? (
        <div className="loading">Loading mutations...</div>
      ) : mutations.length === 0 ? (
        <div className="empty-state">No {filter} mutations</div>
      ) : (
        <div className="table-container">
          <table className="mutations-table">
            <thead>
              <tr>
                <th className="checkbox-col">
                  <input
                    type="checkbox"
                    checked={selectedIds.length === mutations.length && mutations.length > 0}
                    onChange={toggleSelectAll}
                  />
                </th>
                <th>ID</th>
                <th>Type</th>
                <th>Impact</th>
                <th>Risk</th>
                <th>Created</th>
                <th>Actions</th>
              </tr>
            </thead>
            <tbody>
              {mutations.map((m) => (
                <MutationRow
                  key={m.id}
                  mutation={m}
                  selected={selectedIds.includes(m.id)}
                  onSelect={() => toggleSelect(m.id)}
                  onApprove={() => handleApprove([m.id])}
                  onReject={() => handleReject([m.id])}
                  onShowDetail={() => setDetailMutationId(m.id)}
                />
              ))}
            </tbody>
          </table>
        </div>
      )}

      {/* Detail Modal */}
      {detailMutationId && (
        <MutationDetailModal
          mutationId={detailMutationId}
          apiUrl={apiUrl}
          onClose={() => setDetailMutationId(null)}
          onApprove={() => handleApprove([detailMutationId])}
          onReject={() => handleReject([detailMutationId])}
        />
      )}
    </div>
  );
};

// ============================================================================
// SUBCOMPONENTS
// ============================================================================

interface StatCardProps {
  label: string;
  value: number;
  color: string;
}

const StatCard: React.FC<StatCardProps> = ({ label, value, color }) => (
  <div className="stat-card" style={{ borderLeftColor: color }}>
    <div className="stat-label">{label}</div>
    <div className="stat-value">{value}</div>
  </div>
);

interface MutationRowProps {
  mutation: Mutation;
  selected: boolean;
  onSelect: () => void;
  onApprove: () => void;
  onReject: () => void;
  onShowDetail: () => void;
}

const MutationRow: React.FC<MutationRowProps> = ({
  mutation,
  selected,
  onSelect,
  onApprove,
  onReject,
  onShowDetail,
}) => {
  const riskColors = {
    low: "#4CAF50",
    medium: "#FFA500",
    high: "#FF6600",
    urgent: "#F44336",
  };

  const createdDate = new Date(mutation.created_at);
  const timeAgo = getTimeAgo(createdDate);

  return (
    <tr className={selected ? "selected" : ""}>
      <td className="checkbox-col">
        <input type="checkbox" checked={selected} onChange={onSelect} />
      </td>
      <td className="id-col">{mutation.id}</td>
      <td className="type-col">{mutation.mutation_type}</td>
      <td className="impact-col">${mutation.impact.toFixed(2)}</td>
      <td className="risk-col">
        <span
          className="risk-badge"
          style={{
            backgroundColor: riskColors[mutation.risk_score.level],
            color: "white",
            padding: "4px 8px",
            borderRadius: "4px",
            fontSize: "12px",
            fontWeight: "bold",
          }}
        >
          {mutation.risk_score.level.toUpperCase()} ({mutation.risk_score.score})
        </span>
      </td>
      <td className="created-col">{timeAgo}</td>
      <td className="actions-col">
        <button className="btn-small btn-view" onClick={onShowDetail}>
          View
        </button>
        {mutation.status === "pending" && (
          <>
            <button className="btn-small btn-approve" onClick={onApprove}>
              ✓
            </button>
            <button className="btn-small btn-reject" onClick={onReject}>
              ✗
            </button>
          </>
        )}
      </td>
    </tr>
  );
};

interface MutationDetailModalProps {
  mutationId: number;
  apiUrl: string;
  onClose: () => void;
  onApprove: () => void;
  onReject: () => void;
}

const MutationDetailModal: React.FC<MutationDetailModalProps> = ({
  mutationId,
  apiUrl,
  onClose,
  onApprove,
  onReject,
}) => {
  const [mutation, setMutation] = useState<any>(null);
  const [auditTrail, setAuditTrail] = useState<any[]>([]);
  const [loading, setLoading] = useState(true);

  useEffect(() => {
    const fetchDetail = async () => {
      try {
        const response = await fetch(`${apiUrl}/mutations/${mutationId}`);
        const data = await response.json();
        setMutation(data.mutation);
        setAuditTrail(data.mutation.audit_trail || []);
      } catch (err) {
        console.error("Error fetching mutation detail:", err);
      } finally {
        setLoading(false);
      }
    };

    fetchDetail();
  }, [mutationId, apiUrl]);

  if (loading) return <div className="modal-overlay"><div className="modal">Loading...</div></div>;
  if (!mutation) return null;

  const riskColors = {
    low: "#4CAF50",
    medium: "#FFA500",
    high: "#FF6600",
    urgent: "#F44336",
  };

  return (
    <div className="modal-overlay" onClick={onClose}>
      <div className="modal" onClick={(e) => e.stopPropagation()}>
        <div className="modal-header">
          <h2>Mutation #{mutation.id}</h2>
          <button className="modal-close" onClick={onClose}>
            ×
          </button>
        </div>

        <div className="modal-body">
          <div className="detail-section">
            <h3>Details</h3>
            <div className="detail-grid">
              <div className="detail-item">
                <span className="label">Type:</span>
                <span className="value">{mutation.mutation_type}</span>
              </div>
              <div className="detail-item">
                <span className="label">Status:</span>
                <span className="value">{mutation.status}</span>
              </div>
              <div className="detail-item">
                <span className="label">Impact:</span>
                <span className="value">${mutation.impact?.toFixed(2) || "N/A"}</span>
              </div>
              <div className="detail-item">
                <span className="label">Risk Level:</span>
                <span
                  className="value"
                  style={{
                    backgroundColor: riskColors[mutation.risk_score?.level] || "#999",
                    color: "white",
                    padding: "4px 8px",
                    borderRadius: "4px",
                    fontWeight: "bold",
                  }}
                >
                  {mutation.risk_score?.level?.toUpperCase()} ({mutation.risk_score?.score})
                </span>
              </div>
            </div>
          </div>

          {mutation.risk_score?.reasons && (
            <div className="detail-section">
              <h3>Risk Factors</h3>
              <ul className="risk-reasons">
                {mutation.risk_score.reasons.map((reason: string, idx: number) => (
                  <li key={idx}>• {reason}</li>
                ))}
              </ul>
            </div>
          )}

          <div className="detail-section">
            <h3>Resource</h3>
            <div className="detail-grid">
              <div className="detail-item">
                <span className="label">Type:</span>
                <span className="value">{mutation.resource_type}</span>
              </div>
              <div className="detail-item">
                <span className="label">ID:</span>
                <span className="value">{mutation.resource_id}</span>
              </div>
              <div className="detail-item">
                <span className="label">Campaign:</span>
                <span className="value">{mutation.campaign_id || "Account-level"}</span>
              </div>
            </div>
          </div>

          <div className="detail-section">
            <h3>Payload</h3>
            <pre className="payload-json">{JSON.stringify(mutation.payload, null, 2)}</pre>
          </div>

          {auditTrail.length > 0 && (
            <div className="detail-section">
              <h3>Audit Trail</h3>
              <div className="audit-trail">
                {auditTrail.map((event: any, idx: number) => (
                  <div key={idx} className="audit-entry">
                    <span className="audit-time">{new Date(event.created_at).toLocaleString()}</span>
                    <span className="audit-type">{event.event_type}</span>
                    {event.details?.reason && <span className="audit-reason">{event.details.reason}</span>}
                  </div>
                ))}
              </div>
            </div>
          )}
        </div>

        {mutation.status === "pending" && (
          <div className="modal-footer">
            <button className="btn btn-reject" onClick={onReject}>
              ✗ Reject
            </button>
            <button className="btn btn-approve" onClick={onApprove}>
              ✓ Approve
            </button>
          </div>
        )}
      </div>
    </div>
  );
};

// ============================================================================
// UTILITIES
// ============================================================================

function getTimeAgo(date: Date): string {
  const seconds = Math.floor((new Date().getTime() - date.getTime()) / 1000);
  if (seconds < 60) return `${seconds}s ago`;
  if (seconds < 3600) return `${Math.floor(seconds / 60)}m ago`;
  if (seconds < 86400) return `${Math.floor(seconds / 3600)}h ago`;
  return `${Math.floor(seconds / 86400)}d ago`;
}

// ============================================================================
// STYLES (CSS-in-JS or import from CSS file)
// ============================================================================

export const dashboardStyles = `
  .mutation-dashboard {
    font-family: -apple-system, BlinkMacSystemFont, 'Segoe UI', Roboto, sans-serif;
    padding: 20px;
    background: #f5f5f5;
    min-height: 100vh;
  }

  .dashboard-header {
    margin-bottom: 30px;
  }

  .dashboard-header h1 {
    margin: 0;
    font-size: 32px;
    color: #333;
  }

  .dashboard-header p {
    margin: 8px 0 0;
    color: #666;
    font-size: 16px;
  }

  .stats-grid {
    display: grid;
    grid-template-columns: repeat(auto-fit, minmax(150px, 1fr));
    gap: 16px;
    margin-bottom: 30px;
  }

  .stat-card {
    background: white;
    padding: 20px;
    border-radius: 8px;
    border-left: 4px solid;
    box-shadow: 0 2px 4px rgba(0, 0, 0, 0.1);
  }

  .stat-label {
    font-size: 12px;
    color: #999;
    font-weight: 600;
    text-transform: uppercase;
    margin-bottom: 8px;
  }

  .stat-value {
    font-size: 28px;
    font-weight: 700;
    color: #333;
  }

  .controls {
    background: white;
    padding: 16px;
    border-radius: 8px;
    margin-bottom: 20px;
    display: flex;
    gap: 16px;
    align-items: center;
    flex-wrap: wrap;
  }

  .filter-group,
  .sort-group {
    display: flex;
    gap: 8px;
    align-items: center;
  }

  .filter-group label,
  .sort-group label {
    font-weight: 600;
    color: #666;
  }

  .filter-group select,
  .sort-group select {
    padding: 8px 12px;
    border: 1px solid #ddd;
    border-radius: 4px;
    font-size: 14px;
    cursor: pointer;
  }

  .batch-actions {
    display: flex;
    gap: 8px;
    align-items: center;
    margin-left: auto;
  }

  .batch-actions span {
    color: #666;
    font-weight: 600;
  }

  .btn {
    padding: 10px 16px;
    border: none;
    border-radius: 4px;
    font-size: 14px;
    font-weight: 600;
    cursor: pointer;
    transition: all 0.2s;
  }

  .btn-approve {
    background: #4CAF50;
    color: white;
  }

  .btn-approve:hover {
    background: #45a049;
  }

  .btn-reject {
    background: #F44336;
    color: white;
  }

  .btn-reject:hover {
    background: #da190b;
  }

  .btn-clear {
    background: #999;
    color: white;
  }

  .btn-clear:hover {
    background: #888;
  }

  .btn-small {
    padding: 4px 8px;
    font-size: 12px;
    margin-left: 4px;
  }

  .btn-view {
    background: #2196F3;
    color: white;
  }

  .btn-view:hover {
    background: #0b7dda;
  }

  .table-container {
    background: white;
    border-radius: 8px;
    overflow: hidden;
    box-shadow: 0 2px 4px rgba(0, 0, 0, 0.1);
  }

  .mutations-table {
    width: 100%;
    border-collapse: collapse;
    font-size: 14px;
  }

  .mutations-table thead {
    background: #f9f9f9;
    border-bottom: 2px solid #e0e0e0;
  }

  .mutations-table th {
    padding: 12px 16px;
    text-align: left;
    font-weight: 600;
    color: #666;
  }

  .mutations-table td {
    padding: 12px 16px;
    border-bottom: 1px solid #f0f0f0;
  }

  .mutations-table tbody tr:hover {
    background: #fafafa;
  }

  .mutations-table tbody tr.selected {
    background: #e3f2fd;
  }

  .checkbox-col {
    width: 40px;
  }

  .id-col {
    width: 50px;
    font-weight: 600;
  }

  .type-col {
    width: 180px;
  }

  .impact-col {
    width: 90px;
    text-align: right;
  }

  .risk-col {
    width: 110px;
  }

  .created-col {
    width: 100px;
    font-size: 12px;
    color: #999;
  }

  .actions-col {
    width: 120px;
    text-align: center;
  }

  .loading,
  .empty-state {
    background: white;
    padding: 40px;
    border-radius: 8px;
    text-align: center;
    color: #999;
    font-size: 16px;
  }

  .modal-overlay {
    position: fixed;
    top: 0;
    left: 0;
    right: 0;
    bottom: 0;
    background: rgba(0, 0, 0, 0.5);
    display: flex;
    align-items: center;
    justify-content: center;
    z-index: 1000;
  }

  .modal {
    background: white;
    border-radius: 8px;
    max-width: 600px;
    width: 90%;
    max-height: 90vh;
    display: flex;
    flex-direction: column;
    box-shadow: 0 4px 16px rgba(0, 0, 0, 0.2);
  }

  .modal-header {
    display: flex;
    justify-content: space-between;
    align-items: center;
    padding: 20px;
    border-bottom: 1px solid #e0e0e0;
  }

  .modal-header h2 {
    margin: 0;
    font-size: 20px;
  }

  .modal-close {
    background: none;
    border: none;
    font-size: 28px;
    cursor: pointer;
    color: #999;
  }

  .modal-body {
    overflow-y: auto;
    flex: 1;
    padding: 20px;
  }

  .detail-section {
    margin-bottom: 24px;
  }

  .detail-section h3 {
    margin: 0 0 12px;
    font-size: 14px;
    font-weight: 600;
    color: #666;
    text-transform: uppercase;
    letter-spacing: 0.5px;
  }

  .detail-grid {
    display: grid;
    gap: 12px;
  }

  .detail-item {
    display: flex;
    gap: 12px;
  }

  .detail-item .label {
    font-weight: 600;
    color: #666;
    min-width: 100px;
  }

  .detail-item .value {
    color: #333;
    word-break: break-all;
  }

  .risk-reasons {
    list-style: none;
    padding: 0;
    margin: 0;
  }

  .risk-reasons li {
    padding: 8px 0;
    color: #666;
  }

  .payload-json {
    background: #f5f5f5;
    padding: 12px;
    border-radius: 4px;
    overflow-x: auto;
    font-size: 12px;
    line-height: 1.5;
    color: #333;
    margin: 0;
  }

  .audit-trail {
    border-left: 2px solid #e0e0e0;
    padding-left: 16px;
  }

  .audit-entry {
    display: flex;
    gap: 12px;
    align-items: center;
    padding: 8px 0;
    font-size: 13px;
  }

  .audit-time {
    color: #999;
    min-width: 140px;
    font-size: 12px;
  }

  .audit-type {
    background: #f0f0f0;
    padding: 2px 8px;
    border-radius: 3px;
    font-weight: 600;
    color: #666;
  }

  .audit-reason {
    color: #666;
    font-size: 12px;
  }

  .modal-footer {
    display: flex;
    gap: 12px;
    padding: 20px;
    border-top: 1px solid #e0e0e0;
    justify-content: flex-end;
  }
`;
