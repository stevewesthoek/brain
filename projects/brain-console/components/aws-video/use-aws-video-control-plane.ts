import { useQuery } from '@tanstack/react-query';
import { BRAIN_CORE_URL, brainCoreRequest } from '@/lib/braincore-client';
import { videoControlPlaneSchema, type VideoControlPlaneData } from '@/lib/braincore-schemas';

const CONTROL_PLANE_TIMEOUT_MS = 25_000;
const CONTROL_PLANE_REFETCH_INTERVAL = 5_000;

export { CONTROL_PLANE_TIMEOUT_MS as AWS_VIDEO_CONTROL_PLANE_TIMEOUT_MS };

function asRecord(value: unknown): Record<string, unknown> | null {
  return value && typeof value === 'object' ? value as Record<string, unknown> : null;
}

export function normalizeAwsVideoControlPlaneResponse(
  raw: unknown,
): VideoControlPlaneData | null {
  if (!raw) return null;
  const envelope = asRecord(raw);
  if (!envelope) return null;
  // Wrapped response: { ok: true, data: {...} }
  if (envelope.data && typeof envelope.data === 'object') {
    return asRecord(envelope.data) as VideoControlPlaneData;
  }
  // Direct data object (jobId present at root)
  if (typeof envelope.jobId === 'string') {
    return envelope as VideoControlPlaneData;
  }
  // Fallback: return as-is if it looks like a record
  return envelope as VideoControlPlaneData;
}

export interface AwsVideoControlPlaneResult {
  rawResponse: ReturnType<typeof videoControlPlaneSchema.parse> | null;
  data: VideoControlPlaneData | null;
  query: ReturnType<typeof useQuery<ReturnType<typeof videoControlPlaneSchema.parse>>>;
  status: string;
  isLoading: boolean;
  isError: boolean;
  errorMessage: string | null;
  isUsingPreviousData: boolean;
  fetchUrl: string | null;
  timeoutMs: number;
}

export function useAwsVideoControlPlane(
  jobId: string | null | undefined,
): AwsVideoControlPlaneResult {
  const query = useQuery({
    queryKey: ['aws-video-control-plane', jobId ?? null],
    queryFn: () =>
      brainCoreRequest(
        `/api/video-orchestrator/jobs/${encodeURIComponent(jobId ?? '')}/control-plane`,
        videoControlPlaneSchema,
        { timeoutMs: CONTROL_PLANE_TIMEOUT_MS },
      ),
    enabled: Boolean(jobId),
    staleTime: 10_000,
    refetchInterval: CONTROL_PLANE_REFETCH_INTERVAL,
    refetchIntervalInBackground: false,
    retry: 2,
    retryDelay: 1000,
    placeholderData: (prev, prevQuery) => {
      const prevJobId = (prevQuery?.queryKey as [string, string | null] | undefined)?.[1];
      if (prevJobId && prevJobId === jobId) return prev;
      return undefined;
    },
  });

  const rawResponse = query.data ?? null;
  const data = normalizeAwsVideoControlPlaneResponse(rawResponse);

  const err = query.error;
  const errMsg = err instanceof Error ? err.message : err ? String(err) : null;

  const fetchUrl = jobId
    ? `${BRAIN_CORE_URL}/api/video-orchestrator/jobs/${jobId}/control-plane`
    : null;

  return {
    rawResponse,
    data,
    query,
    status: query.status,
    isLoading: query.isLoading,
    isError: query.isError,
    errorMessage: errMsg,
    isUsingPreviousData: query.isPlaceholderData,
    fetchUrl,
    timeoutMs: CONTROL_PLANE_TIMEOUT_MS,
  };
}
