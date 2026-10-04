export function nextDailyTime(now, hour, minute = 0) {
  const next = new Date(now);
  next.setUTCHours(hour, minute, 0, 0);
  if (next.getTime() <= now) next.setUTCDate(next.getUTCDate() + 1);
  return next.getTime();
}

export function countdown(until, now) {
  const seconds = Math.max(0, Math.ceil((until - now) / 1000));
  const parts = [Math.floor(seconds / 3600), Math.floor(seconds / 60) % 60, seconds % 60];
  return parts.map((value) => String(value).padStart(2, "0")).join(":");
}
