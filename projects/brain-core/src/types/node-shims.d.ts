declare module 'node:child_process' {
  export interface SpawnSyncReturns<T> {
    status: number | null;
    signal: string | null;
    stdout: T;
    stderr: T;
    error?: Error;
  }

  export function spawnSync(
    command: string,
    args?: string[],
    options?: {
      cwd?: string;
      env?: Record<string, string | undefined>;
      encoding?: 'utf8';
      timeout?: number;
    },
  ): SpawnSyncReturns<string>;
}

declare module 'node:child_process' {
  export interface SpawnSyncReturns<T> {
    status: number | null;
    stdout: T;
    stderr: T;
    error?: Error;
  }

  export function spawnSync(
    command: string,
    args?: string[],
    options?: { cwd?: string; env?: Record<string, string | undefined>; encoding?: 'utf8' },
  ): SpawnSyncReturns<string>;
}

declare module 'node:fs' {
  export interface Dirent {
    name: string;
    isFile(): boolean;
    isDirectory(): boolean;
  }

  export interface Stats {
    mtime: Date;
  }

  export function existsSync(path: string): boolean;
  export function readdirSync(path: string, options: { withFileTypes: true }): Dirent[];
  export function statSync(path: string): Stats;
  export function mkdirSync(path: string, options?: { recursive?: boolean }): void;
  export function writeFileSync(path: string, data: string): void;
  export function appendFileSync(path: string, data: string): void;
  export function readFileSync(path: string, encoding: 'utf8'): string;
  export function rmSync(path: string, options?: { recursive?: boolean; force?: boolean }): void;

  const fs: {
    existsSync: typeof existsSync;
    readdirSync: typeof readdirSync;
    statSync: typeof statSync;
    mkdirSync: typeof mkdirSync;
    writeFileSync: typeof writeFileSync;
    appendFileSync: typeof appendFileSync;
    readFileSync: typeof readFileSync;
    rmSync: typeof rmSync;
  };

  export default fs;
}

declare module 'node:path' {
  export function dirname(path: string): string;
  export function join(...paths: string[]): string;
  export function resolve(...paths: string[]): string;
  export function relative(from: string, to: string): string;

  const path: {
    dirname: typeof dirname;
    join: typeof join;
    resolve: typeof resolve;
    relative: typeof relative;
  };

  export default path;
}

declare module 'node:http' {
  export interface IncomingMessage {
    method?: string;
    url?: string;
    socket: {
      remoteAddress?: string;
    };
  }

  export interface ServerResponse {
    writeHead(statusCode: number, headers?: Record<string, string>): void;
    end(chunk?: string): void;
  }

  export interface Server {
    once(event: 'error', listener: (error: Error) => void): this;
    once(event: 'listening', listener: () => void): this;
    off(event: 'error', listener: (error: Error) => void): this;
    off(event: 'listening', listener: () => void): this;
    listen(port: number, host: string): this;
    close(callback?: (error?: Error) => void): void;
  }

  export function createServer(
    listener: (request: IncomingMessage, response: ServerResponse) => void,
  ): Server;

  const http: {
    createServer: typeof createServer;
  };

  export default http;
}

declare module 'node:os' {
  export function hostname(): string;
  export function homedir(): string;

  const os: {
    hostname: typeof hostname;
    homedir: typeof homedir;
  };

  export default os;
}

declare module 'node:test' {
  type TestCallback = () => void | Promise<void>;
  export default function test(name: string, callback: TestCallback): void;
}

declare module 'node:assert/strict' {
  export function equal(actual: unknown, expected: unknown, message?: string): void;

  const assert: {
    equal: typeof equal;
  };

  export default assert;
}

declare const process: {
  env: Record<string, string | undefined>;
  exit(code?: number): never;
  cwd(): string;
  once(event: 'SIGINT' | 'SIGTERM', listener: () => void): void;
};
