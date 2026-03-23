import {
  ACTIVITY_WRITE_THROTTLE_MS,
  AUTH_LAST_ACTIVITY_KEY,
  INACTIVITY_TIMEOUT_MS,
  clearLastActivity,
  isSessionInactive,
  readLastActivity,
  shouldWriteActivity,
  writeLastActivity,
} from "./authSession";

describe("authSession utilities", () => {
  beforeEach(() => {
    window.localStorage.clear();
  });

  it("stores and reads last activity timestamp", () => {
    const timestamp = 1710000000000;
    writeLastActivity(timestamp);

    expect(window.localStorage.getItem(AUTH_LAST_ACTIVITY_KEY)).toBe(String(timestamp));
    expect(readLastActivity()).toBe(timestamp);
  });

  it("clears last activity timestamp", () => {
    writeLastActivity(1710000000000);
    clearLastActivity();

    expect(readLastActivity()).toBeNull();
  });

  it("marks session inactive when inactivity reaches 3 days", () => {
    const lastActivity = 1000;
    const now = lastActivity + INACTIVITY_TIMEOUT_MS;

    expect(isSessionInactive(lastActivity, now)).toBe(true);
    expect(isSessionInactive(lastActivity, now - 1)).toBe(false);
  });

  it("throttles activity writes", () => {
    const lastWrite = 5000;
    const notEnoughDelay = lastWrite + ACTIVITY_WRITE_THROTTLE_MS - 1;
    const enoughDelay = lastWrite + ACTIVITY_WRITE_THROTTLE_MS;

    expect(shouldWriteActivity(lastWrite, notEnoughDelay)).toBe(false);
    expect(shouldWriteActivity(lastWrite, enoughDelay)).toBe(true);
  });
});
