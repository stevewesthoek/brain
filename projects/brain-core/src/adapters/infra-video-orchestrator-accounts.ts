import pg from 'pg';
import { execFile as nodeExecFile } from 'node:child_process';
import { promisify } from 'node:util';

const execFile = promisify(nodeExecFile);

// ── Types ─────────────────────────────────────────────────────────────────────

export interface InfraVOAccount {
  accountId: string;
  accountHandle: string;
  platform: string;
  accountStatus: string;  // 'active' | 'inactive' | 'suspended'
  authMethod: string;     // 'manual' | 'oauth2' | 'api_key'
}

export interface InfraVOAccountsResponse {
  ok: boolean;
  accounts: InfraVOAccount[];
  totalCount: number;
  byPlatform: Record<string, number>;
  error?: string;
}

export interface InfraVOAuthStatusAccount {
  handle: string;
  platform: string;
  authMethod: string;
  oauthReady: boolean;
  tokenExpiry: string | null;
}

export interface InfraVOAuthStatusResponse {
  ok: boolean;
  accounts: InfraVOAuthStatusAccount[];
  error?: string;
}

export interface InfraVOAuthMethodUpdateResponse {
  ok: boolean;
  account?: InfraVOAccount;
  error?: string;
  code?: 'invalid_auth_method' | 'account_not_found' | 'db_unreachable';
}

// ── Lazy pool ─────────────────────────────────────────────────────────────────

let _pool: pg.Pool | null = null;
let _keychainReader: ((accountHandle: string) => Promise<{ hasToken: boolean; expiresAtIso: string | null }>) | null = null;

function getPool(): pg.Pool {
  if (!_pool) {
    _pool = new pg.Pool({
      host: '127.0.0.1',
      port: 5450,
      database: 'video_orchestrator',
      user: 'postgres',
      password: 'postgres',
      max: 3,
      idleTimeoutMillis: 30000,
      connectionTimeoutMillis: 5000,
    });
    _pool.on('error', () => {
      // Pool error — connection will be retried on next request
    });
  }
  return _pool;
}

// ── Test helper (not for production use) ──────────────────────────────────────

export function _injectPoolForTesting(pool: pg.Pool | null): void {
  _pool = pool;
}

export function _injectKeychainReaderForTesting(
  reader: ((accountHandle: string) => Promise<{ hasToken: boolean; expiresAtIso: string | null }>) | null,
): void {
  _keychainReader = reader;
}

// ── Query helpers ─────────────────────────────────────────────────────────────

async function queryWithTimeout<T extends pg.QueryResultRow>(
  pool: pg.Pool,
  sql: string,
  params?: unknown[],
): Promise<pg.QueryResult<T>> {
  const client = await pool.connect();
  try {
    return await client.query<T>(sql, params);
  } finally {
    client.release();
  }
}

// ── Main function ─────────────────────────────────────────────────────────────

export async function getInfraVOAccounts(): Promise<InfraVOAccountsResponse> {
  const pool = getPool();

  try {
    const result = await queryWithTimeout<{
      account_id: string;
      account_handle: string;
      platform: string;
      account_status: string;
      auth_method: string;
    }>(
      pool,
      `SELECT account_id, account_handle, platform, account_status, auth_method
       FROM accounts
       ORDER BY platform, account_handle`,
    );

    const accounts: InfraVOAccount[] = result.rows.map((row) => ({
      accountId: row.account_id,
      accountHandle: row.account_handle,
      platform: row.platform,
      accountStatus: row.account_status,
      authMethod: row.auth_method,
    }));

    const byPlatform: Record<string, number> = {};
    for (const account of accounts) {
      byPlatform[account.platform] = (byPlatform[account.platform] ?? 0) + 1;
    }

    return {
      ok: true,
      accounts,
      totalCount: accounts.length,
      byPlatform,
    };
  } catch {
    return {
      ok: false,
      accounts: [],
      totalCount: 0,
      byPlatform: {},
      error: 'VO DB unreachable',
    };
  }
}

export async function getInfraVOAuthStatus(): Promise<InfraVOAuthStatusResponse> {
  const accountsResult = await getInfraVOAccounts();
  if (!accountsResult.ok) {
    return {
      ok: false,
      accounts: [],
      error: accountsResult.error ?? 'VO DB unreachable',
    };
  }

  const accounts = await Promise.all(accountsResult.accounts.map(async (account) => {
    if (account.authMethod !== 'oauth2') {
      return {
        handle: account.accountHandle,
        platform: account.platform,
        authMethod: account.authMethod,
        oauthReady: false,
        tokenExpiry: null,
      };
    }

    const token = await readOAuthTokenMetadata(account.accountHandle);
    return {
      handle: account.accountHandle,
      platform: account.platform,
      authMethod: account.authMethod,
      oauthReady: token.hasToken,
      tokenExpiry: token.expiresAtIso,
    };
  }));

  return {
    ok: true,
    accounts,
  };
}

export async function updateInfraVOAccountAuthMethod(
  handle: string,
  authMethod: string,
): Promise<InfraVOAuthMethodUpdateResponse> {
  const normalizedHandle = handle.trim();
  const normalizedAuthMethod = authMethod.trim();
  if (!['manual', 'oauth2', 'api_key'].includes(normalizedAuthMethod)) {
    return {
      ok: false,
      code: 'invalid_auth_method',
      error: 'auth_method must be one of manual, oauth2, api_key',
    };
  }
  if (normalizedHandle.length === 0) {
    return {
      ok: false,
      code: 'account_not_found',
      error: 'VO account not found',
    };
  }

  const pool = getPool();
  try {
    const result = await queryWithTimeout<{
      account_id: string;
      account_handle: string;
      platform: string;
      account_status: string;
      auth_method: string;
    }>(
      pool,
      `UPDATE accounts
       SET auth_method = $1, updated_at = now()
       WHERE account_handle = $2
       RETURNING account_id, account_handle, platform, account_status, auth_method`,
      [normalizedAuthMethod, normalizedHandle],
    );

    const row = result.rows[0];
    if (!row) {
      return {
        ok: false,
        code: 'account_not_found',
        error: 'VO account not found',
      };
    }

    return {
      ok: true,
      account: {
        accountId: row.account_id,
        accountHandle: row.account_handle,
        platform: row.platform,
        accountStatus: row.account_status,
        authMethod: row.auth_method,
      },
    };
  } catch {
    return {
      ok: false,
      code: 'db_unreachable',
      error: 'VO DB unreachable',
    };
  }
}

async function readOAuthTokenMetadata(accountHandle: string): Promise<{ hasToken: boolean; expiresAtIso: string | null }> {
  if (_keychainReader) return _keychainReader(accountHandle);

  try {
    const { stdout } = await execFile('security', [
      'find-generic-password',
      '-s',
      'video-orchestrator',
      '-a',
      `yt-oauth-${accountHandle}`,
      '-w',
    ], { timeout: 3000, maxBuffer: 32_768 });
    const parsed = JSON.parse(stdout.trim()) as { expires_at?: unknown };
    const expiresAt = typeof parsed.expires_at === 'number' ? parsed.expires_at : 0;
    const expiresAtIso = expiresAt > 0 ? new Date(expiresAt * 1000).toISOString() : null;
    return {
      hasToken: true,
      expiresAtIso,
    };
  } catch {
    return {
      hasToken: false,
      expiresAtIso: null,
    };
  }
}
