export function addDays(date: Date, days: number) {
  const copy = new Date(date);
  copy.setDate(copy.getDate() + days);
  return copy;
}

export function toDateInputValue(date: Date) {
  const copy = new Date(date);
  copy.setMinutes(copy.getMinutes() - copy.getTimezoneOffset());
  return copy.toISOString().slice(0, 10);
}

export function nextWeekendDate(day: "sat" | "sun", from = new Date()) {
  const date = new Date(from);
  const targetDay = day === "sun" ? 0 : 6;
  while (date.getDay() !== targetDay) {
    date.setDate(date.getDate() + 1);
  }
  return toDateInputValue(date);
}

export function formatMonthDay(date: Date) {
  return new Intl.DateTimeFormat("ja-JP", {
    month: "numeric",
    day: "numeric",
  }).format(date);
}

export function formatWeekday(dateValue: string) {
  return new Intl.DateTimeFormat("ja-JP", {
    month: "numeric",
    day: "numeric",
    weekday: "short",
  }).format(new Date(`${dateValue}T00:00:00`));
}

export function isWeekendDate(dateValue: string) {
  const day = new Date(`${dateValue}T00:00:00`).getDay();
  return day === 0 || day === 6;
}

export function weekendKeyForDate(dateValue: string) {
  const date = new Date(`${dateValue}T00:00:00`);
  const saturday = new Date(date);
  if (saturday.getDay() === 0) {
    saturday.setDate(saturday.getDate() - 1);
  }
  return toDateInputValue(saturday);
}

export function getWeekendCutoffDate(today = new Date()) {
  const date = new Date(today);
  const day = date.getDay();

  if (day === 6) {
    return toDateInputValue(date);
  }

  if (day === 0) {
    return toDateInputValue(addDays(date, -1));
  }

  return nextWeekendDate("sat", date);
}

export function isExpiredWeekendDate(dateValue: string) {
  return dateValue < getWeekendCutoffDate();
}

export function getWeekendRangeLabel() {
  const saturday = new Date(nextWeekendDate("sat"));
  const sunday = new Date(nextWeekendDate("sun"));
  return `次の週末: ${formatMonthDay(saturday)} - ${formatMonthDay(sunday)}`;
}
