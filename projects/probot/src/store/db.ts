import fs from "node:fs";
import path from "node:path";
import Database from "better-sqlite3";

export interface ApprovalRecord {
  id: string;
  kind: string;
  payloadJson: string;
  status: "pending" | "approved" | "rejected" | "expired";
  createdAt: string;
  expiresAt: string;
}

export interface ApprovalStore {
  create(kind: string, payload: unknown, expiresAt: string): string;
  get(id: string): ApprovalRecord | undefined;
  list(status?: ApprovalRecord["status"], limit?: number): ApprovalRecord[];
  updateStatus(id: string, status: ApprovalRecord["status"]): void;
  log(kind: string, payload: unknown): void;
}

export function openDatabase(dataDir: string): Database.Database {
  fs.mkdirSync(dataDir, { recursive: true });
  const dbPath = path.join(dataDir, "probot.db");
  const db = new Database(dbPath);
  db.pragma("journal_mode = WAL");

  db.exec(`
    create table if not exists approvals (
      id text primary key,
      kind text not null,
      payload_json text not null,
      status text not null,
      created_at text not null,
      expires_at text not null
    );

    create table if not exists events (
      id integer primary key autoincrement,
      kind text not null,
      payload_json text not null,
      created_at text not null
    );
  `);

  return db;
}

function createId(): string {
  return `${Date.now().toString(36)}-${Math.random().toString(36).slice(2, 10)}`;
}

export function createApprovalStore(db: Database.Database): ApprovalStore {
  const insertApproval = db.prepare(`
    insert into approvals (id, kind, payload_json, status, created_at, expires_at)
    values (@id, @kind, @payload_json, @status, @created_at, @expires_at)
  `);

  const selectApproval = db.prepare(`
    select id, kind, payload_json as payloadJson, status, created_at as createdAt, expires_at as expiresAt
    from approvals
    where id = ?
  `);

  const updateApproval = db.prepare(`
    update approvals
    set status = ?
    where id = ?
  `);

  const listApprovalsByStatus = db.prepare(`
    select id, kind, payload_json as payloadJson, status, created_at as createdAt, expires_at as expiresAt
    from approvals
    where status = ?
    order by created_at desc
    limit ?
  `);

  const listApprovals = db.prepare(`
    select id, kind, payload_json as payloadJson, status, created_at as createdAt, expires_at as expiresAt
    from approvals
    order by created_at desc
    limit ?
  `);

  const insertEvent = db.prepare(`
    insert into events (kind, payload_json, created_at)
    values (?, ?, ?)
  `);

  return {
    create(kind, payload, expiresAt) {
      const id = createId();
      insertApproval.run({
        id,
        kind,
        payload_json: JSON.stringify(payload),
        status: "pending",
        created_at: new Date().toISOString(),
        expires_at: expiresAt,
      });
      return id;
    },
    get(id) {
      return selectApproval.get(id) as ApprovalRecord | undefined;
    },
    list(status, limit = 10) {
      if (status) {
        return listApprovalsByStatus.all(status, limit) as ApprovalRecord[];
      }
      return listApprovals.all(limit) as ApprovalRecord[];
    },
    updateStatus(id, status) {
      updateApproval.run(status, id);
    },
    log(kind, payload) {
      insertEvent.run(kind, JSON.stringify(payload), new Date().toISOString());
    },
  };
}
