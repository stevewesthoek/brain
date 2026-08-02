export type MindRegistryPathType = 'canonical-directory' | 'canonical-file' | 'compatibility-directory' | 'compatibility-file' | 'historical-directory' | 'future-target' | 'generated-output' | 'external-integration';
export interface MindRegistryPathEntry {
    pathId: string;
    type: MindRegistryPathType;
    literal?: string;
    pattern?: string;
    writePolicy: string;
    readPolicy: string;
    activeDefaultAllowed: boolean;
}
export declare function loadMindPathRegistry(): {
    registryVersion: string;
    entries: MindRegistryPathEntry[];
};
export declare function resolveCanonicalMindPath(pathId: string): string;
export declare function describeMindPath(token: string): MindRegistryPathEntry | null;
export declare function isRegisteredCompatibilityRead(token: string): boolean;
export declare function isCanonicalActivePath(token: string): boolean;
export declare function joinMindPath(rootPath: string, leaf: string): string;
