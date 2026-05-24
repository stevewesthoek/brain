import { requestAction } from './actions.js';

type EmitEventRequest = {
  projectId: string;
  type: string;
  payload: Record<string, unknown>;
  actor: string;
};

type EmitEventResponse = {
  ok: boolean;
  approval?: { id: string; status: string };
  preview?: {
    event?: {
      id: string;
      projectId: string;
      type: string;
      payload: Record<string, unknown>;
      actor: string;
      at: string;
      status: string;
    };
  };
  error?: string;
};

type AcknowledgeEventRequest = {
  eventId: string;
  projectId: string;
};

type AcknowledgeEventResponse = {
  ok: boolean;
  approval?: { id: string; status: string };
  preview?: {
    event?: {
      id: string;
      projectId: string;
      acknowledgedAt: string;
      status: string;
    };
  };
  error?: string;
};

type SubscribeToEventsRequest = {
  projectId: string;
  eventTypes: string[];
  webhookId?: string;
};

type SubscribeToEventsResponse = {
  ok: boolean;
  approval?: { id: string; status: string };
  preview?: {
    subscription?: {
      id: string;
      projectId: string;
      eventTypes: string[];
      webhookId?: string;
      status: string;
      createdAt: string;
    };
  };
  error?: string;
};

type EventEntry = {
  id: string;
  projectId: string;
  type: string;
  payload: Record<string, unknown>;
  actor: string;
  at: string;
  status: string;
};

type Subscription = {
  id: string;
  projectId: string;
  eventTypes: string[];
  webhookId?: string;
  status: string;
  createdAt: string;
};

type ReadEventStreamResponse = {
  ok: boolean;
  events: EventEntry[];
  count: number;
  projectId?: string;
  error?: string;
};

type ReadEventHistoryResponse = {
  ok: boolean;
  events: EventEntry[];
  count: number;
  projectId?: string;
  error?: string;
};

type ReadActiveSubscriptionsResponse = {
  ok: boolean;
  subscriptions: Subscription[];
  count: number;
  projectId?: string;
  error?: string;
};

export function emitEventRequest(
  request: EmitEventRequest,
): EmitEventResponse {
  const errors: string[] = [];

  if (!request.projectId?.trim()) {
    errors.push('projectId is required');
  }
  if (!request.type?.trim()) {
    errors.push('type is required');
  }
  if (!request.payload || typeof request.payload !== 'object') {
    errors.push('payload is required');
  }
  if (!request.actor?.trim()) {
    errors.push('actor is required');
  }

  if (errors.length > 0) {
    return {
      ok: false,
      error: errors.join('; '),
    };
  }

  const result = requestAction('custom-event-emit');

  if (!result.accepted) {
    return {
      ok: false,
      error: result.message,
    };
  }

  const eventId = `event-${Date.now().toString(36)}-${Math.random().toString(36).slice(2, 8)}`;
  const now = new Date().toISOString();

  return {
    ok: true,
    ...(result.approval && {
      approval: {
        id: result.approval.id,
        status: result.approval.status,
      },
    }),
    preview: {
      event: {
        id: eventId,
        projectId: request.projectId,
        type: request.type,
        payload: request.payload,
        actor: request.actor,
        at: now,
        status: 'queued',
      },
    },
  };
}

export function acknowledgeEventRequest(
  request: AcknowledgeEventRequest,
): AcknowledgeEventResponse {
  const errors: string[] = [];

  if (!request.eventId?.trim()) {
    errors.push('eventId is required');
  }
  if (!request.projectId?.trim()) {
    errors.push('projectId is required');
  }

  if (errors.length > 0) {
    return {
      ok: false,
      error: errors.join('; '),
    };
  }

  const result = requestAction('custom-event-acknowledge');

  if (!result.accepted) {
    return {
      ok: false,
      error: result.message,
    };
  }

  const now = new Date().toISOString();

  return {
    ok: true,
    ...(result.approval && {
      approval: {
        id: result.approval.id,
        status: result.approval.status,
      },
    }),
    preview: {
      event: {
        id: request.eventId,
        projectId: request.projectId,
        acknowledgedAt: now,
        status: 'acknowledged',
      },
    },
  };
}

export function subscribeToEventsRequest(
  request: SubscribeToEventsRequest,
): SubscribeToEventsResponse {
  const errors: string[] = [];

  if (!request.projectId?.trim()) {
    errors.push('projectId is required');
  }
  if (!Array.isArray(request.eventTypes) || request.eventTypes.length === 0) {
    errors.push('eventTypes must be a non-empty array');
  }

  if (errors.length > 0) {
    return {
      ok: false,
      error: errors.join('; '),
    };
  }

  const result = requestAction('custom-event-subscribe');

  if (!result.accepted) {
    return {
      ok: false,
      error: result.message,
    };
  }

  const subscriptionId = `sub-${Date.now().toString(36)}-${Math.random().toString(36).slice(2, 8)}`;
  const now = new Date().toISOString();

  const sub: Subscription = {
    id: subscriptionId,
    projectId: request.projectId,
    eventTypes: request.eventTypes,
    status: 'active',
    createdAt: now,
  };

  if (request.webhookId !== undefined) {
    sub.webhookId = request.webhookId;
  }

  return {
    ok: true,
    ...(result.approval && {
      approval: {
        id: result.approval.id,
        status: result.approval.status,
      },
    }),
    preview: {
      subscription: sub,
    },
  };
}

export function readEventStream(
  projectId: string,
  limit?: number,
  since?: string,
): ReadEventStreamResponse {
  const errors: string[] = [];
  const finalLimit = limit ?? 50;

  if (!projectId?.trim()) {
    errors.push('projectId is required');
  }
  if (finalLimit < 1 || finalLimit > 500) {
    errors.push('limit must be between 1 and 500');
  }

  if (errors.length > 0) {
    return {
      ok: false,
      events: [],
      count: 0,
      error: errors.join('; '),
    };
  }

  return {
    ok: true,
    events: [],
    count: 0,
    projectId,
  };
}

export function readEventHistory(
  projectId: string,
  eventType?: string,
  limit?: number,
): ReadEventHistoryResponse {
  const errors: string[] = [];
  const finalLimit = limit ?? 50;

  if (!projectId?.trim()) {
    errors.push('projectId is required');
  }
  if (finalLimit < 1 || finalLimit > 500) {
    errors.push('limit must be between 1 and 500');
  }

  if (errors.length > 0) {
    return {
      ok: false,
      events: [],
      count: 0,
      error: errors.join('; '),
    };
  }

  return {
    ok: true,
    events: [],
    count: 0,
    projectId,
  };
}

export function readActiveSubscriptions(
  projectId: string,
): ReadActiveSubscriptionsResponse {
  const errors: string[] = [];

  if (!projectId?.trim()) {
    errors.push('projectId is required');
  }

  if (errors.length > 0) {
    return {
      ok: false,
      subscriptions: [],
      count: 0,
      error: errors.join('; '),
    };
  }

  return {
    ok: true,
    subscriptions: [],
    count: 0,
    projectId,
  };
}
