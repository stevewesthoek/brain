import type { MindContractDryRunResult, MindContractSnapshot, MindRouterJobId, MindRouterJobResult } from './contracts.js';
export declare const MIND_ROUTER_JOBS: MindRouterJobId[];
export declare function createDryRunResult(jobId: MindRouterJobId): MindRouterJobResult;
export declare function createAllDryRunResults(): MindRouterJobResult[];
export declare function createMindContractDryRunResult(snapshot: MindContractSnapshot): MindContractDryRunResult;
