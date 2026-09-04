import { BrainTaskDetail } from '@/components/brain-workspace';

export default async function BrainTaskDetailPage({ params }: { params: Promise<{ taskId: string }> }) {
  const { taskId } = await params;
  return <BrainTaskDetail taskId={decodeURIComponent(taskId)} />;
}
