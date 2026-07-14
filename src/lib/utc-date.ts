const UTC_DATE_KEY_PATTERN = /^\d{4}-\d{2}-\d{2}$/;

export function toUtcDateKey(date: Date): string {
  if (Number.isNaN(date.getTime())) {
    throw new RangeError("Expected a valid date");
  }

  return date.toISOString().slice(0, 10);
}

export function addUtcDays(dateKey: string, days: number): string {
  if (!Number.isInteger(days)) {
    throw new RangeError("Expected a whole number of days");
  }

  if (!UTC_DATE_KEY_PATTERN.test(dateKey)) {
    throw new RangeError("Expected an ISO UTC date key");
  }

  const date = new Date(`${dateKey}T00:00:00.000Z`);

  if (toUtcDateKey(date) !== dateKey) {
    throw new RangeError("Expected a valid ISO UTC date key");
  }

  date.setUTCDate(date.getUTCDate() + days);

  return toUtcDateKey(date);
}
