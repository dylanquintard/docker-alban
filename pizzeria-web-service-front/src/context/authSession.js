export const AUTH_LAST_ACTIVITY_KEY = "pizzeria_auth_last_activity_v1";
export const INACTIVITY_TIMEOUT_MS = 3 * 24 * 60 * 60 * 1000;
export const ACTIVITY_WRITE_THROTTLE_MS = 30 * 1000;

function toFiniteNumber(value) {
  if (value === null || value === undefined) return null;
  if (typeof value === "string" && value.trim() === "") return null;
  const numeric = Number(value);
  return Number.isFinite(numeric) ? numeric : null;
}

function normalizeTimestamp(value) {
  const numeric = toFiniteNumber(value);
  if (numeric === null) return null;
  return Math.max(0, Math.floor(numeric));
}

function getBrowserStorage() {
  if (typeof window === "undefined") return null;
  return window.localStorage;
}

export function readLastActivity(storage = getBrowserStorage()) {
  if (!storage) return null;
  const raw = storage.getItem(AUTH_LAST_ACTIVITY_KEY);
  return normalizeTimestamp(raw);
}

export function writeLastActivity(timestamp = Date.now(), storage = getBrowserStorage()) {
  if (!storage) return null;
  const normalized = normalizeTimestamp(timestamp);
  if (normalized === null) return null;
  storage.setItem(AUTH_LAST_ACTIVITY_KEY, String(normalized));
  return normalized;
}

export function clearLastActivity(storage = getBrowserStorage()) {
  if (!storage) return;
  storage.removeItem(AUTH_LAST_ACTIVITY_KEY);
}

export function isSessionInactive(lastActivityAt, now = Date.now(), timeoutMs = INACTIVITY_TIMEOUT_MS) {
  const activityTs = normalizeTimestamp(lastActivityAt);
  const nowTs = normalizeTimestamp(now);
  const threshold = normalizeTimestamp(timeoutMs) ?? INACTIVITY_TIMEOUT_MS;
  if (activityTs === null || nowTs === null) return false;
  return nowTs - activityTs >= threshold;
}

export function shouldWriteActivity(lastWrittenAt, now = Date.now(), throttleMs = ACTIVITY_WRITE_THROTTLE_MS) {
  const previous = normalizeTimestamp(lastWrittenAt);
  const nowTs = normalizeTimestamp(now);
  const minDelta = normalizeTimestamp(throttleMs) ?? ACTIVITY_WRITE_THROTTLE_MS;
  if (nowTs === null) return false;
  if (previous === null) return true;
  return nowTs - previous >= minDelta;
}
