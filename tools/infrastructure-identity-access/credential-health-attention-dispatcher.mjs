import { execFile } from 'node:child_process';
import { promisify } from 'node:util';

const execFileAsync = promisify(execFile);
const OSASCRIPT = '/usr/bin/osascript';

function safeText(value, max = 512) {
  return typeof value === 'string' && value.length > 0 && value.length <= max && !/[\u0000-\u001f\u007f]/.test(value) ? value : '';
}
function messageFor(item) {
  const payload = item?.payload ?? {};
  return safeText(`${payload.severity ?? 'unknown'} credential health: ${payload.conditionCode ?? 'unknown'} (${payload.transition ?? 'update'}) for ${payload.resourceId ?? 'unknown'}`, 1024);
}

function titleFor(item) {
  return item?.type === 'recovery' ? 'Brain credential recovered' : item?.type === 'daily-digest' ? 'Brain credential health digest' : 'Brain credential health alert';
}

async function sendMacOSNotification(item) {
  const message = item?.type === 'daily-digest'
    ? safeText(`Open incidents: ${item.openIncidentCount}; items: ${item.items?.length ?? 0}`, 256)
    : messageFor(item);
  const title = titleFor(item);
  const script = 'on run argv\n display notification (item 1 of argv) with title (item 2 of argv)\nend run';
  await execFileAsync(OSASCRIPT, ['-e', script, message, title], {
    cwd: '/',
    env: { PATH: '/usr/bin:/bin:/usr/sbin:/sbin' },
    timeout: 10000,
    maxBuffer: 16 * 1024,
  });
  return { delivered: true, channel: 'macos-user-notification' };
}

export async function dispatchCredentialAttention(plan, { notify = false, sender = sendMacOSNotification } = {}) {
  const items = [
    ...(plan?.immediate ?? []),
    ...(plan?.digest ? [plan.digest] : []),
  ];
  if (!notify || items.length === 0) return { requested: notify, attempted: 0, delivered: 0, failures: [], items: [] };
  const results = [];
  for (const item of items) {
    try {
      const result = await sender(item);
      results.push({ type: item.type, status: 'delivered', channel: result?.channel ?? 'injected' });
    } catch (error) {
      results.push({ type: item.type, status: 'failed', reason: 'notification_delivery_failed' });
    }
  }
  return {
    requested: true,
    attempted: items.length,
    delivered: results.filter((entry) => entry.status === 'delivered').length,
    failures: results.filter((entry) => entry.status === 'failed').length,
    items: results,
  };
}
