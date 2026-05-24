export interface DateRange {
  preset: 'today' | 'week' | 'month' | 'custom';
  startDate: string; // ISO 8601
  endDate: string;   // ISO 8601
}

export interface VOContextState {
  projectId: string | null;
  accountId: string | null;
  platformTargets: string[]; // platform IDs, e.g., ['youtube', 'facebook']
  pipelineProfileId: string | null;
  dateRange: DateRange;
}

export interface VOContextActions {
  setProjectId: (projectId: string | null) => void;
  setAccountId: (accountId: string | null) => void;
  setPlatformTargets: (platforms: string[]) => void;
  setPipelineProfileId: (profileId: string | null) => void;
  setDateRange: (range: DateRange) => void;
  reset: () => void;
}

export type VOContextType = VOContextState & VOContextActions;

export const DEFAULT_DATE_RANGE: DateRange = {
  preset: 'week',
  startDate: new Date(Date.now() - 7 * 24 * 60 * 60 * 1000).toISOString().split('T')[0],
  endDate: new Date().toISOString().split('T')[0],
};
