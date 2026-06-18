declare module 'node:fs' {
  export interface Stats {
    mode: number;
    isDirectory(): boolean;
    isFile(): boolean;
    isSymbolicLink(): boolean;
  }

  export function realpathSync(path: string): string;
  export function lstatSync(path: string): Stats;
  export function renameSync(oldPath: string, newPath: string): void;
  export function openSync(path: string, flags: string, mode?: number): number;
  export function closeSync(fd: number): void;
  export function fsyncSync(fd: number): void;
  export function writeFileSync(fd: number, data: string, encoding?: string): void;
  export function writeFileSync(path: string, data: string, options?: { flag?: string }): void;
}
