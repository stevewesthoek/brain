export type AlertSeverity = 'info' | 'warning' | 'critical';

export interface Alert {
  id: string;
  severity: AlertSeverity;
  title: string;
  message: string;
  timestamp: string;
  resolved?: boolean;
  resolvedAt?: string;
}

// ---------------------------------------------------------------------------
// AlertChannel interface + built-in implementations
// ---------------------------------------------------------------------------

export interface AlertChannel {
  readonly name: string;
  send(alert: Alert): Promise<void>;
}

export class ConsoleAlertChannel implements AlertChannel {
  readonly name = 'console';

  async send(alert: Alert): Promise<void> {
    console.error(`[${alert.severity.toUpperCase()}] ${alert.title}: ${alert.message}`);
  }
}

export class SlackAlertChannel implements AlertChannel {
  readonly name = 'slack';
  private readonly webhookUrl: string;

  constructor(webhookUrl: string) {
    this.webhookUrl = webhookUrl;
  }

  async send(alert: Alert): Promise<void> {
    const color =
      alert.severity === 'critical'
        ? 'danger'
        : alert.severity === 'warning'
          ? 'warning'
          : 'good';

    const payload = {
      attachments: [
        {
          color,
          title: alert.title,
          text: alert.message,
          footer: `ID: ${alert.id}`,
          ts: Math.floor(new Date(alert.timestamp).getTime() / 1000),
        },
      ],
    };

    await fetch(this.webhookUrl, {
      method: 'POST',
      body: JSON.stringify(payload),
      headers: { 'Content-Type': 'application/json' },
    });
  }
}

// ---------------------------------------------------------------------------
// AlertManager
// ---------------------------------------------------------------------------

let alertSequence = 0;

export class AlertManager {
  private readonly alerts: Map<string, Alert> = new Map();
  private readonly channels: Map<AlertSeverity, AlertChannel[]> = new Map();

  registerChannel(severity: AlertSeverity, channel: AlertChannel): void {
    const existing = this.channels.get(severity);
    if (existing !== undefined) {
      existing.push(channel);
    } else {
      this.channels.set(severity, [channel]);
    }
  }

  async raiseAlert(severity: AlertSeverity, title: string, message: string): Promise<Alert> {
    alertSequence++;
    const alert: Alert = {
      id: `alert-${Date.now()}-${alertSequence}`,
      severity,
      title,
      message,
      timestamp: new Date().toISOString(),
    };

    this.alerts.set(alert.id, alert);

    const channels = this.channels.get(severity) ?? [];
    for (const channel of channels) {
      try {
        await channel.send(alert);
      } catch (error) {
        console.error(`[alerting] Failed to deliver alert via channel "${channel.name}":`, error);
      }
    }

    return alert;
  }

  async resolveAlert(alertId: string): Promise<boolean> {
    const alert = this.alerts.get(alertId);
    if (alert === undefined) {
      return false;
    }

    alert.resolved = true;
    alert.resolvedAt = new Date().toISOString();
    return true;
  }

  getActiveAlerts(): Alert[] {
    return Array.from(this.alerts.values()).filter(a => a.resolved !== true);
  }

  getAllAlerts(): Alert[] {
    return Array.from(this.alerts.values());
  }
}

// ---------------------------------------------------------------------------
// Shared singleton
// ---------------------------------------------------------------------------
export const defaultAlertManager = new AlertManager();
defaultAlertManager.registerChannel('critical', new ConsoleAlertChannel());
defaultAlertManager.registerChannel('warning', new ConsoleAlertChannel());
