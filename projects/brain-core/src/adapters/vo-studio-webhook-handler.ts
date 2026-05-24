import { requestAction } from './actions.js';

type ProcessWebhookEventRequest = {
  webhookId: string;
  projectId: string;
  platform: string;
  eventType: string;
  payload: Record<string, unknown>;
  signature?: string;
};

type ProcessWebhookEventResponse = {
  ok: boolean;
  approval?: { id: string; status: string };
  preview?: {
    delivery?: {
      id: string;
      webhookId: string;
      projectId: string;
      platform: string;
      eventType: string;
      payload: Record<string, unknown>;
      signature?: string;
      receivedAt: string;
      status: string;
    };
  };
  error?: string;
};

type VerifyWebhookSignatureRequest = {
  webhookId: string;
  projectId: string;
  secret: string;
  signature: string;
  rawBody: string;
};

type VerifyWebhookSignatureResponse = {
  ok: boolean;
  approval?: { id: string; status: string };
  preview?: {
    verification?: {
      webhookId: string;
      projectId: string;
      status: string;
      verifiedAt: string;
    };
  };
  error?: string;
};

type RouteEventRequest = {
  projectId: string;
  platform: string;
  platformEventType: string;
};

type RouteEventResponse = {
  ok: boolean;
  approval?: { id: string; status: string };
  preview?: {
    routing?: {
      projectId: string;
      platform: string;
      platformEventType: string;
      internalEventType: string;
      status: string;
      mappedAt: string;
    };
  };
  error?: string;
};

type WebhookDelivery = {
  id: string;
  webhookId: string;
  projectId: string;
  platform: string;
  eventType: string;
  payload: Record<string, unknown>;
  status: string;
  receivedAt: string;
};

type ReadWebhookDeliveriesResponse = {
  ok: boolean;
  deliveries: WebhookDelivery[];
  count: number;
  webhookId?: string;
  projectId?: string;
  error?: string;
};

type PlatformEventMapping = {
  platform: string;
  platformEventType: string;
  internalEventType: string;
};

type ReadPlatformEventMappingResponse = {
  ok: boolean;
  mappings: PlatformEventMapping[];
  count: number;
  platform?: string;
  error?: string;
};

export function processWebhookEventRequest(
  request: ProcessWebhookEventRequest,
): ProcessWebhookEventResponse {
  const errors: string[] = [];

  if (!request.webhookId?.trim()) {
    errors.push('webhookId is required');
  }
  if (!request.projectId?.trim()) {
    errors.push('projectId is required');
  }
  if (!request.platform?.trim()) {
    errors.push('platform is required');
  }
  if (!request.eventType?.trim()) {
    errors.push('eventType is required');
  }
  if (!request.payload || typeof request.payload !== 'object') {
    errors.push('payload is required');
  }

  if (errors.length > 0) {
    return {
      ok: false,
      error: errors.join('; '),
    };
  }

  const result = requestAction('custom-webhook-receive');

  if (!result.accepted) {
    return {
      ok: false,
      error: result.message,
    };
  }

  const deliveryId = `delivery-${Date.now().toString(36)}-${Math.random().toString(36).slice(2, 8)}`;
  const now = new Date().toISOString();

  const delivery: {
    id: string;
    webhookId: string;
    projectId: string;
    platform: string;
    eventType: string;
    payload: Record<string, unknown>;
    signature?: string;
    receivedAt: string;
    status: string;
  } = {
    id: deliveryId,
    webhookId: request.webhookId,
    projectId: request.projectId,
    platform: request.platform,
    eventType: request.eventType,
    payload: request.payload,
    receivedAt: now,
    status: 'received',
  };

  if (request.signature !== undefined) {
    delivery.signature = request.signature;
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
      delivery,
    },
  };
}

export function verifyWebhookSignatureRequest(
  request: VerifyWebhookSignatureRequest,
): VerifyWebhookSignatureResponse {
  const errors: string[] = [];

  if (!request.webhookId?.trim()) {
    errors.push('webhookId is required');
  }
  if (!request.projectId?.trim()) {
    errors.push('projectId is required');
  }
  if (!request.secret?.trim()) {
    errors.push('secret is required');
  }
  if (!request.signature?.trim()) {
    errors.push('signature is required');
  }
  if (!request.rawBody?.trim()) {
    errors.push('rawBody is required');
  }

  if (errors.length > 0) {
    return {
      ok: false,
      error: errors.join('; '),
    };
  }

  const result = requestAction('custom-webhook-verify');

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
      verification: {
        webhookId: request.webhookId,
        projectId: request.projectId,
        status: 'verified',
        verifiedAt: now,
      },
    },
  };
}

function mapPlatformEventType(platform: string, eventType: string): string {
  if (platform.startsWith('youtube') || platform === 'youtube-shorts') {
    return `publish.${eventType.split('.')[1] ?? 'video'}`;
  }
  if (platform === 'tiktok') {
    return `publish.${eventType.split('.')[1] ?? 'video'}`;
  }
  if (eventType.startsWith('approval.')) {
    return eventType;
  }
  return `package.${eventType.split('.')[1] ?? 'event'}`;
}

export function routeEventRequest(
  request: RouteEventRequest,
): RouteEventResponse {
  const errors: string[] = [];

  if (!request.projectId?.trim()) {
    errors.push('projectId is required');
  }
  if (!request.platform?.trim()) {
    errors.push('platform is required');
  }
  if (!request.platformEventType?.trim()) {
    errors.push('platformEventType is required');
  }

  if (errors.length > 0) {
    return {
      ok: false,
      error: errors.join('; '),
    };
  }

  const result = requestAction('custom-event-route');

  if (!result.accepted) {
    return {
      ok: false,
      error: result.message,
    };
  }

  const internalEventType = mapPlatformEventType(request.platform, request.platformEventType);
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
      routing: {
        projectId: request.projectId,
        platform: request.platform,
        platformEventType: request.platformEventType,
        internalEventType,
        status: 'mapped',
        mappedAt: now,
      },
    },
  };
}

export function readWebhookDeliveries(
  webhookId: string,
  projectId: string,
  limit?: number,
): ReadWebhookDeliveriesResponse {
  const errors: string[] = [];
  const finalLimit = limit ?? 50;

  if (!webhookId?.trim()) {
    errors.push('webhookId is required');
  }
  if (!projectId?.trim()) {
    errors.push('projectId is required');
  }
  if (finalLimit < 1 || finalLimit > 500) {
    errors.push('limit must be between 1 and 500');
  }

  if (errors.length > 0) {
    return {
      ok: false,
      deliveries: [],
      count: 0,
      error: errors.join('; '),
    };
  }

  return {
    ok: true,
    deliveries: [],
    count: 0,
    webhookId,
    projectId,
  };
}

export function readPlatformEventMapping(
  platform: string,
): ReadPlatformEventMappingResponse {
  const errors: string[] = [];

  if (!platform?.trim()) {
    errors.push('platform is required');
  }

  if (errors.length > 0) {
    return {
      ok: false,
      mappings: [],
      count: 0,
      error: errors.join('; '),
    };
  }

  return {
    ok: true,
    mappings: [],
    count: 0,
    platform,
  };
}
