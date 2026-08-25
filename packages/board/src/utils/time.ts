const formatter = new Intl.RelativeTimeFormat('en', { numeric: 'auto' });

export function relativeTime(timestamp: number | string): string {
  const date =
    typeof timestamp === 'string' ? Date.parse(timestamp) : timestamp;
  const diffMs = date - Date.now();
  const absMs = Math.abs(diffMs);
  const minute = 60_000;
  const hour = minute * 60;
  const day = hour * 24;

  if (absMs < minute) {
    return 'just now';
  }

  if (absMs < hour) {
    return formatter.format(Math.round(diffMs / minute), 'minute');
  }

  if (absMs < day) {
    return formatter.format(Math.round(diffMs / hour), 'hour');
  }

  return formatter.format(Math.round(diffMs / day), 'day');
}

export function localDateTime(timestamp: string): string {
  const date = new Date(timestamp);
  if (Number.isNaN(date.getTime())) return timestamp;

  return date.toLocaleString(undefined, {
    dateStyle: 'medium',
    timeStyle: 'short',
  });
}
