// @flow

export function toLocaleStringSupportsLocales() {
  try {
    new Date().toLocaleString("i");
  } catch (e) {
    return e instanceof RangeError;
  }
  return false;
}

export function formatLocaleDate(date: Date | number | string) {
  if (typeof date !== "object") {
    date = new Date(date);
  }
  if (!toLocaleStringSupportsLocales()) {
    return date.toLocaleDateString();
  }
  return date.toLocaleDateString(undefined, {
    year: "numeric",
    month: "short",
    day: "numeric",
  });
}

export function formatLocaleDateTime(date: Date | number | string) {
  if (typeof date !== "object") {
    date = new Date(date);
  }
  if (!toLocaleStringSupportsLocales()) {
    return date.toLocaleString();
  }
  return date.toLocaleString(undefined, {
    year: "numeric",
    month: "short",
    day: "numeric",
    hour: "numeric",
    minute: "numeric",
    second: undefined,
  });
}

export function formatLocaleTime(date: Date | number | string) {
  if (typeof date !== "object") {
    date = new Date(date);
  }
  if (!toLocaleStringSupportsLocales()) {
    return date.toLocaleTimeString();
  }
  return date.toLocaleTimeString(undefined, {
    hour: "numeric",
    minute: "numeric",
    second: undefined,
  });
}

// Whole-calendar-days between two dates (ignoring the time of day), positive
// when `then` is before `now`.
function calendarDaysAgo(then: Date, now: Date): number {
  const startOf = (d) =>
    new Date(d.getFullYear(), d.getMonth(), d.getDate()).getTime();
  const ms = startOf(now) - startOf(then);
  return Math.round(ms / (1000 * 60 * 60 * 24));
}

// A short calendar-day label for chat day separators: "Today", "Yesterday",
// "N days ago" for the past week, and a full date for anything older.
export function formatRelativeDay(date: Date | number | string) {
  if (typeof date !== "object") {
    date = new Date(date);
  }
  const days = calendarDaysAgo(date, new Date());
  if (days <= 0) {
    return "Today";
  }
  if (days === 1) {
    return "Yesterday";
  }
  if (days < 7) {
    return days + " days ago";
  }
  return formatLocaleDate(date);
}

export function timeAgo(date: Date, suffix?: string) {
  let then = date.valueOf();
  let now = Date.now();
  let seconds = Math.round(Math.abs(now - then) / 1000);

  suffix = suffix === undefined ? (then < now ? "ago" : "from now") : suffix;

  let content;
  let unit;

  if (seconds < 60) {
    return "just now";
  } else if (seconds < 60 * 60) {
    content = Math.round(seconds / 60);
    unit = "minute";
  } else if (seconds < 60 * 60 * 24) {
    content = Math.round(seconds / (60 * 60));
    unit = "hour";
  } else if (seconds < 60 * 60 * 24 * 7) {
    content = Math.round(seconds / (60 * 60 * 24));
    unit = "day";
  } else if (seconds < 60 * 60 * 24 * 30) {
    content = Math.round(seconds / (60 * 60 * 24 * 7));
    unit = "week";
  } else if (seconds < 60 * 60 * 24 * 365) {
    content = Math.round(seconds / (60 * 60 * 24 * 30));
    unit = "month";
  } else {
    content = Math.round(seconds / (60 * 60 * 24 * 365));
    unit = "year";
  }

  if (content !== 1) {
    unit += "s";
  }

  return content + " " + unit + " " + suffix;
}
