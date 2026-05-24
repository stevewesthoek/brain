/**
 * Brain Console shadcn-ui Component Library
 *
 * shadcn-ui inspired component library for Obsidian plugin DOM strings.
 * All components output HTML strings with shadcn/Tailwind CSS classes and
 * Brain Console design tokens (CSS variables).
 *
 * Usage:
 *   const btn = Button({ label: 'Click me', variant: 'primary', onClick: () => {} });
 *   const card = Card({ title: 'Status', content: '...', statusBorder: 'ok' });
 */

// ── Button Component ──
interface ButtonProps {
  label: string;
  variant?: 'primary' | 'secondary' | 'outline' | 'ghost';
  disabled?: boolean;
  className?: string;
  onClick?: () => void;
  title?: string;
}

export function Button(props: ButtonProps): string {
  const {
    label,
    variant = 'primary',
    disabled = false,
    className = '',
    onClick,
    title,
  } = props;

  const variantClass = {
    primary: 'bc-button',
    secondary: 'bc-button secondary',
    outline: 'bc-button secondary',
    ghost: 'bc-button ghost',
  }[variant];

  const onClickAttr = onClick ? ` onclick="this.onclick()"` : '';
  const titleAttr = title ? ` title="${title}"` : '';
  const disabledAttr = disabled ? ' disabled' : '';

  return `<button class="${variantClass} ${className}" ${disabledAttr}${titleAttr}>${label}</button>`;
}

// ── Card Component ──
interface CardProps {
  title?: string;
  content: string;
  statusBorder?: 'ok' | 'warning' | 'error' | 'review' | 'preview' | 'disabled';
  className?: string;
}

export function Card(props: CardProps): string {
  const { title, content, statusBorder, className = '' } = props;

  const statusClass = statusBorder ? ` status-border ${statusBorder}` : '';

  let html = `<div class="bc-card${statusClass} ${className}">`;

  if (title) {
    html += `<div class="bc-text-card-title" style="margin-bottom: var(--bc-spacing-md);">${title}</div>`;
  }

  html += `<div class="bc-text-card-body">${content}</div></div>`;

  return html;
}

// ── Badge Component ──
interface BadgeProps {
  count: number | string;
  status?: 'ok' | 'warning' | 'error' | 'preview' | 'disabled';
  className?: string;
}

export function Badge(props: BadgeProps): string {
  const { count, status = 'ok', className = '' } = props;
  return `<span class="bc-badge ${status} ${className}">${count}</span>`;
}

// ── Progress Bar Component ──
interface ProgressProps {
  percent: number;
  status?: 'ok' | 'warning' | 'error';
  showLabel?: boolean;
  className?: string;
}

export function Progress(props: ProgressProps): string {
  const { percent, status = 'ok', showLabel = true, className = '' } = props;
  const clampedPercent = Math.min(100, Math.max(0, percent));

  let html = `<div class="bc-progress ${className}">`;
  html += `<div class="bc-progress-fill ${status}" style="width: ${clampedPercent}%;"></div>`;
  html += `</div>`;

  if (showLabel) {
    html += `<div style="font-size: var(--bc-font-label); color: var(--bc-text-secondary); margin-top: var(--bc-spacing-xs);">${clampedPercent}%</div>`;
  }

  return html;
}

// ── Tab Component ──
interface TabProps {
  label: string;
  isActive?: boolean;
  count?: number;
  onClick?: () => void;
  className?: string;
}

export function Tab(props: TabProps): string {
  const { label, isActive = false, count, onClick, className = '' } = props;

  const activeClass = isActive ? 'active' : '';
  const countHtml = count !== undefined ? ` <span class="bc-badge ok">${count}</span>` : '';

  return `<div class="bc-tab ${activeClass} ${className}">${label}${countHtml}</div>`;
}

// ── StatusPill Component ──
interface StatusPillProps {
  status: 'online' | 'degraded' | 'error' | 'review' | 'preview' | 'disabled' | 'ok' | 'warning';
  label: string;
  icon?: string;
  className?: string;
}

export function StatusPill(props: StatusPillProps): string {
  const { status, label, icon = '●', className = '' } = props;
  const mappedStatus = status === 'ok' ? 'online' : status === 'warning' ? 'degraded' : status;
  return `<div class="bc-status-pill ${mappedStatus} ${className}">${icon} ${label}</div>`;
}

// ── Table Component ──
interface TableRow {
  [key: string]: string | number | boolean;
}

interface TableProps {
  rows: TableRow[];
  columns: string[];
  columnLabels?: string[];
  className?: string;
}

export function Table(props: TableProps): string {
  const { rows, columns, columnLabels, className = '' } = props;

  let html = `<table class="bc-table ${className}"><thead><tr>`;

  for (let i = 0; i < columns.length; i++) {
    const label = columnLabels?.[i] || columns[i];
    html += `<th>${label}</th>`;
  }

  html += `</tr></thead><tbody>`;

  for (const row of rows) {
    html += `<tr>`;
    for (const col of columns) {
      html += `<td>${row[col] || '—'}</td>`;
    }
    html += `</tr>`;
  }

  html += `</tbody></table>`;

  return html;
}

// ── ActivityLog Component ──
interface LogEntry {
  timestamp: string;
  message: string;
  status?: 'ok' | 'warning' | 'error' | 'pending';
}

interface ActivityLogProps {
  entries: LogEntry[];
  maxEntries?: number;
  className?: string;
}

export function ActivityLog(props: ActivityLogProps): string {
  const { entries, maxEntries = 20, className = '' } = props;

  const displayEntries = entries.slice(0, maxEntries);

  let html = `<div class="bc-activity-log ${className}">`;

  for (const entry of displayEntries) {
    const statusClass = entry.status ? ` ${entry.status}` : '';
    html += `<div class="log-entry${statusClass}">${entry.timestamp} — ${entry.message}</div>`;
  }

  html += `</div>`;

  return html;
}

// ── Alert Component ──
interface AlertProps {
  title?: string;
  message: string;
  status: 'error' | 'warning' | 'success' | 'info';
  className?: string;
}

export function Alert(props: AlertProps): string {
  const { title, message, status, className = '' } = props;

  const statusColors = {
    error: '#ef4444',
    warning: '#facc15',
    success: '#4ade80',
    info: '#60a5fa',
  };

  let html = `<div style="padding: var(--bc-spacing-md); border-left: 4px solid ${statusColors[status]}; background-color: rgba(0, 0, 0, 0.2); border-radius: var(--bc-radius); ${className}">`;

  if (title) {
    html += `<div class="bc-text-card-title">${title}</div>`;
  }

  html += `<div class="bc-text-card-body" style="color: ${statusColors[status]};">${message}</div></div>`;

  return html;
}

// ── Input Component ──
interface InputProps {
  placeholder?: string;
  value?: string;
  type?: 'text' | 'password' | 'email' | 'number';
  className?: string;
  onChange?: (value: string) => void;
}

export function Input(props: InputProps): string {
  const {
    placeholder = '',
    value = '',
    type = 'text',
    className = '',
  } = props;

  return `<input
    type="${type}"
    placeholder="${placeholder}"
    value="${value}"
    class="bc-input ${className}"
    style="
      width: 100%;
      padding: var(--bc-spacing-sm) var(--bc-spacing-md);
      border: 1px solid var(--bc-border-default);
      border-radius: var(--bc-radius);
      background-color: var(--bc-bg-surface);
      color: var(--bc-text-primary);
      font-size: var(--bc-font-card-body);
    "
  />`;
}

// ── Select Component ──
interface SelectOption {
  value: string | number;
  label: string;
}

interface SelectProps {
  options: SelectOption[];
  value?: string | number;
  placeholder?: string;
  className?: string;
  onChange?: (value: string) => void;
}

export function Select(props: SelectProps): string {
  const { options, value, placeholder = 'Select...', className = '' } = props;

  let html = `<select
    class="bc-select ${className}"
    style="
      width: 100%;
      padding: var(--bc-spacing-sm) var(--bc-spacing-md);
      border: 1px solid var(--bc-border-default);
      border-radius: var(--bc-radius);
      background-color: var(--bc-bg-surface);
      color: var(--bc-text-primary);
      font-size: var(--bc-font-card-body);
    "
  >`;

  if (placeholder) {
    html += `<option value="">${placeholder}</option>`;
  }

  for (const opt of options) {
    const selected = opt.value === value ? ' selected' : '';
    html += `<option value="${opt.value}"${selected}>${opt.label}</option>`;
  }

  html += `</select>`;

  return html;
}

// ── Divider Component ──
interface DividerProps {
  className?: string;
}

export function Divider(props: DividerProps = {}): string {
  const { className = '' } = props;
  return `<div style="height: 1px; background-color: var(--bc-border-default); margin: var(--bc-spacing-md) 0;" class="${className}"></div>`;
}

// ── Spacer Component ──
interface SpacerProps {
  size?: 'xs' | 'sm' | 'md' | 'lg' | 'xl' | '2xl';
  className?: string;
}

export function Spacer(props: SpacerProps = {}): string {
  const { size = 'md', className = '' } = props;

  const sizeMap = {
    xs: '4px',
    sm: '8px',
    md: '12px',
    lg: '16px',
    xl: '20px',
    '2xl': '24px',
  };

  return `<div style="height: ${sizeMap[size]};" class="${className}"></div>`;
}

// ── Flex Container Component ──
interface FlexProps {
  direction?: 'row' | 'column';
  gap?: 'xs' | 'sm' | 'md' | 'lg' | 'xl' | '2xl';
  align?: 'start' | 'center' | 'end' | 'stretch';
  justify?: 'start' | 'center' | 'end' | 'between' | 'around' | 'evenly';
  children: string;
  className?: string;
}

export function Flex(props: FlexProps): string {
  const {
    direction = 'row',
    gap = 'md',
    align = 'start',
    justify = 'start',
    children,
    className = '',
  } = props;

  const gapMap = {
    xs: '4px',
    sm: '8px',
    md: '12px',
    lg: '16px',
    xl: '20px',
    '2xl': '24px',
  };

  const alignMap = {
    start: 'flex-start',
    center: 'center',
    end: 'flex-end',
    stretch: 'stretch',
  };

  const justifyMap = {
    start: 'flex-start',
    center: 'center',
    end: 'flex-end',
    between: 'space-between',
    around: 'space-around',
    evenly: 'space-evenly',
  };

  return `<div style="
    display: flex;
    flex-direction: ${direction};
    gap: ${gapMap[gap]};
    align-items: ${alignMap[align]};
    justify-content: ${justifyMap[justify]};
  " class="${className}">${children}</div>`;
}

// ── Grid Container Component ──
interface GridProps {
  columns?: number;
  gap?: 'xs' | 'sm' | 'md' | 'lg' | 'xl' | '2xl';
  children: string;
  className?: string;
}

export function Grid(props: GridProps): string {
  const { columns = 3, gap = 'md', children, className = '' } = props;

  const gapMap = {
    xs: '4px',
    sm: '8px',
    md: '12px',
    lg: '16px',
    xl: '20px',
    '2xl': '24px',
  };

  return `<div style="
    display: grid;
    grid-template-columns: repeat(${columns}, 1fr);
    gap: ${gapMap[gap]};
  " class="${className}">${children}</div>`;
}
