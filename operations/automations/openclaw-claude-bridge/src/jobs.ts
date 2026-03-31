import { v4 as uuidv4 } from 'uuid';

export type JobStatus = 'pending' | 'running' | 'awaiting_confirmation' | 'done' | 'error';

export interface Job {
  id: string;
  sessionId: string;
  sessionKey?: string;
  agentId?: string;
  prompt: string;
  status: JobStatus;
  createdAt: Date;
  updatedAt: Date;
  result?: {
    output: string;
    timedOut: boolean;
    repo?: string | null;
  };
  confirmationContext?: {
    snapshot: string;
    question: string;
  };
}

const jobs = new Map<string, Job>();

export function createJob(params: Omit<Job, 'id' | 'status' | 'createdAt' | 'updatedAt'>): Job {
  const job: Job = {
    ...params,
    id: uuidv4(),
    status: 'pending',
    createdAt: new Date(),
    updatedAt: new Date(),
  };
  jobs.set(job.id, job);
  return job;
}

export function getJob(id: string): Job | undefined {
  return jobs.get(id);
}

export function updateJob(id: string, updates: Partial<Job>): Job | undefined {
  const job = jobs.get(id);
  if (!job) return undefined;
  const updated = { ...job, ...updates, updatedAt: new Date() };
  jobs.set(id, updated);
  return updated;
}

export function getActiveJobForSession(sessionId: string): Job | undefined {
  for (const job of jobs.values()) {
    if (
      job.sessionId === sessionId &&
      (job.status === 'running' || job.status === 'awaiting_confirmation')
    ) {
      return job;
    }
  }
  return undefined;
}

export function listJobs(): Job[] {
  return Array.from(jobs.values()).sort(
    (a, b) => b.createdAt.getTime() - a.createdAt.getTime()
  );
}
