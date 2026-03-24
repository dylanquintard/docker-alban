import { describe, expect, it, vi } from "vitest";

import {
  isStandaloneDisplay,
  supportsWebPush,
  urlBase64ToUint8Array,
} from "./pushUtils";

describe("urlBase64ToUint8Array", () => {
  it("converts URL-safe base64 to Uint8Array", () => {
    const bytes = urlBase64ToUint8Array("SGVsbG8");
    expect(Array.from(bytes)).toEqual([72, 101, 108, 108, 111]);
  });
});

describe("isStandaloneDisplay", () => {
  it("returns true when display mode is standalone", () => {
    vi.stubGlobal("window", {
      matchMedia: vi.fn().mockReturnValue({ matches: true }),
      navigator: { standalone: false },
    });

    expect(isStandaloneDisplay()).toBe(true);
  });
});

describe("supportsWebPush", () => {
  it("returns false when the browser is not secure", () => {
    vi.stubGlobal("window", {
      isSecureContext: false,
      Notification: function Notification() {},
      PushManager: function PushManager() {},
    });
    vi.stubGlobal("navigator", {
      serviceWorker: {},
    });

    expect(supportsWebPush()).toBe(false);
  });
});
