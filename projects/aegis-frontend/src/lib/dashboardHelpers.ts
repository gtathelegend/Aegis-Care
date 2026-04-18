export const makeInitials = (value: string) =>
  value
    .split(/\s+/)
    .filter(Boolean)
    .map((part) => part[0] ?? '')
    .join('')
    .slice(0, 2)
    .toUpperCase();

export const normalizeText = (value: string) => value.trim().toLowerCase();

export const parseTimelineValue = (value: string) => {
  if (!value) return 0;

  const lowered = value.toLowerCase();
  if (lowered === 'yesterday') return Date.now() - 24 * 60 * 60 * 1000;

  const relativeMatch = lowered.match(/^(\d+)\s*([hm])\s*ago$/);
  if (relativeMatch) {
    const amount = Number(relativeMatch[1]);
    const unit = relativeMatch[2];
    const multiplier = unit === 'h' ? 60 * 60 * 1000 : 60 * 1000;
    return Date.now() - amount * multiplier;
  }

  const parsed = Date.parse(value.replace(/\s*·\s*/g, ', '));
  return Number.isNaN(parsed) ? 0 : parsed;
};

export const sortByTimeline = <T,>(items: T[], getValue: (item: T) => string) =>
  [...items].sort((left, right) => parseTimelineValue(getValue(right)) - parseTimelineValue(getValue(left)));

export const uniqueCount = <T,>(items: T[], getValue: (item: T) => string) => new Set(items.map(getValue)).size;
