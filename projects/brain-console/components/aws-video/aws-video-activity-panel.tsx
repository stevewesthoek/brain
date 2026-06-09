'use client';

import { timeAgo } from '@/lib/utils';
import { StatusBadge } from '@/components/status-badge';

interface TimelineEvent {
  step?: string;
  status?: string;
  timestamp?: string | null;
  message?: string;
}

interface AwsVideoActivityPanelProps {
  timelineEvents: TimelineEvent[];
  activity: string[];
}

export function AwsVideoActivityPanel({ timelineEvents, activity }: AwsVideoActivityPanelProps) {
  return (
    <div className="grid split-panels">
      <article className="card">
        <div className="card-title">Timeline</div>
        <div className="timeline">
          {timelineEvents.map((event, index) => (
            <div className="timeline-item" key={`${event.step}-${index}`}>
              <div className="split">
                <strong>{event.step}</strong>
                <StatusBadge status={event.status} />
              </div>
              <div className="meta">{event.timestamp ? timeAgo(event.timestamp) : 'unknown time'}</div>
              <p>{event.message}</p>
            </div>
          ))}
          {timelineEvents.length === 0 ? <p>No timeline events.</p> : null}
        </div>
      </article>
      <article className="card">
        <div className="card-title">Activity</div>
        <div className="stack">
          {activity.map((item) => (
            <div className="meta no-margin" key={item}>{item}</div>
          ))}
          {activity.length === 0 ? <p>No local dashboard activity yet.</p> : null}
        </div>
      </article>
    </div>
  );
}
