import { describe, expect, it } from "vitest";

import {
  ORDER_PREP_WINDOW_MS,
  buildFailedTicketNotification,
  buildOrderPrepNotification,
} from "./notificationUtils";

describe("buildOrderPrepNotification", () => {
  it("returns a notification for active orders within 30 minutes", () => {
    const now = new Date("2026-03-24T18:00:00.000Z");
    const notification = buildOrderPrepNotification(
      {
        id: 17,
        status: "COMPLETED",
        timeSlot: {
          startTime: "2026-03-24T18:30:00.000Z",
          location: { name: "Hayange" },
        },
      },
      now
    );

    expect(notification).toMatchObject({
      key: "order-prep:17:2026-03-24T18:30:00.000Z",
      title: "Commande #17 - A PREPARER",
      body: "Heure de retrait : 19:30 · Hayange",
    });
  });

  it("skips orders outside of the prep window or already processed", () => {
    const now = new Date("2026-03-24T18:00:00.000Z");

    expect(
      buildOrderPrepNotification(
        {
          id: 18,
          status: "VALIDATE",
          timeSlot: { startTime: "2026-03-24T18:20:00.000Z" },
        },
        now
      )
    ).toBeNull();

    expect(
      buildOrderPrepNotification(
        {
          id: 19,
          status: "COMPLETED",
          timeSlot: {
            startTime: new Date(now.getTime() + ORDER_PREP_WINDOW_MS + 60_000).toISOString(),
          },
        },
        now
      )
    ).toBeNull();
  });
});

describe("buildFailedTicketNotification", () => {
  it("returns the expected ticket failure notification payload", () => {
    expect(
      buildFailedTicketNotification({
        id: "job_42",
        status: "FAILED",
        orderId: 17,
        printer: { code: "front" },
        lastErrorMessage: "Paper out",
      })
    ).toMatchObject({
      key: "ticket-failed:job_42",
      title: "IMPRESSION TICKET ECHEC #17",
      body: "Imprimante front · Paper out",
    });
  });

  it("ignores non failed tickets", () => {
    expect(
      buildFailedTicketNotification({
        id: "job_43",
        status: "PRINTED",
        orderId: 18,
      })
    ).toBeNull();
  });
});
