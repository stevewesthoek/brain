import { BrainTaskDetail } from '@/components/brain-workspace';

export default async function BrainTaskDetailPage({
  params,
  searchParams,
}: {
  params: Promise<{ taskId: string }>;
  searchParams: Promise<{ context?: string; evidence?: string }>;
}) {
  const [{ taskId }, query] = await Promise.all([params, searchParams]);
  return (
    <BrainTaskDetail
      taskId={decodeURIComponent(taskId)}
      selectedContextId={query.context}
      selectedEvidenceId={query.evidence}
    />
  );
}
