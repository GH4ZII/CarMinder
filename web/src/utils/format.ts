const EVENT_TYPE_LABELS: Record<string, string> = {
  oil_change: 'Oil Change',
  brake_service: 'Brake Service',
  tire_change: 'Tire Change',
  inspection: 'Inspection (EU)',
  repair: 'Repair',
  other: 'Other',
};

export function eventTypeLabel(type: string): string {
  return EVENT_TYPE_LABELS[type] ?? type.replace(/_/g, ' ');
}

export function urgencyColor(urgency: string): string {
  switch (urgency) {
    case 'overdue':
      return 'var(--color-error)';
    case 'soon':
      return 'var(--color-warning)';
    case 'ok':
      return 'var(--color-success)';
    default:
      return 'var(--color-text-muted)';
  }
}

export function urgencyLabel(urgency: string): string {
  switch (urgency) {
    case 'overdue':
      return 'Overdue';
    case 'soon':
      return 'Due Soon';
    case 'ok':
      return 'OK';
    default:
      return 'Unknown';
  }
}

export function formatDate(dateStr: string): string {
  const d = new Date(dateStr);
  return d.toLocaleDateString('en-GB', { day: 'numeric', month: 'short', year: 'numeric' });
}

export function formatCurrency(cents: number | null): string {
  if (cents == null) return '';
  return `${(cents / 100).toFixed(2)} kr`;
}
