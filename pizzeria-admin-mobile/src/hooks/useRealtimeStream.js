import { useEffect, useRef } from "react";

export function useRealtimeStream({
  enabled,
  streamUrl,
  onConnectionChange,
  onOrdersUpdated,
  onTicketsUpdated,
}) {
  const connectionRef = useRef(onConnectionChange);
  const ordersUpdatedRef = useRef(onOrdersUpdated);
  const ticketsUpdatedRef = useRef(onTicketsUpdated);
  const lastAliveAtRef = useRef(0);
  const offlineTimerRef = useRef(null);

  useEffect(() => {
    connectionRef.current = onConnectionChange;
  }, [onConnectionChange]);

  useEffect(() => {
    ordersUpdatedRef.current = onOrdersUpdated;
  }, [onOrdersUpdated]);

  useEffect(() => {
    ticketsUpdatedRef.current = onTicketsUpdated;
  }, [onTicketsUpdated]);

  useEffect(() => {
    if (!enabled || typeof window === "undefined" || typeof window.EventSource === "undefined") {
      connectionRef.current?.(false);
      return undefined;
    }

    const markAlive = () => {
      lastAliveAtRef.current = Date.now();
      connectionRef.current?.(true);
      if (offlineTimerRef.current) {
        window.clearTimeout(offlineTimerRef.current);
        offlineTimerRef.current = null;
      }
      offlineTimerRef.current = window.setTimeout(() => {
        const elapsed = Date.now() - lastAliveAtRef.current;
        if (elapsed >= 35_000) {
          connectionRef.current?.(false);
        }
      }, 35_000);
    };

    const source = new window.EventSource(streamUrl, {
      withCredentials: true,
    });
    const refreshOrders = () => {
      markAlive();
      ordersUpdatedRef.current?.();
    };
    const refreshTickets = () => {
      markAlive();
      ticketsUpdatedRef.current?.();
    };
    const markConnected = () => {
      markAlive();
    };
    const handleHeartbeat = () => {
      markAlive();
    };
    const handleError = () => {
      const elapsed = Date.now() - lastAliveAtRef.current;
      if (elapsed >= 10_000) {
        connectionRef.current?.(false);
      }
    };

    source.onopen = markConnected;
    source.onerror = handleError;
    source.addEventListener("realtime:connected", markConnected);
    source.addEventListener("heartbeat", handleHeartbeat);
    source.addEventListener("orders:admin-updated", refreshOrders);
    source.addEventListener("tickets:admin-updated", refreshTickets);

    return () => {
      if (offlineTimerRef.current) {
        window.clearTimeout(offlineTimerRef.current);
        offlineTimerRef.current = null;
      }
      source.removeEventListener("realtime:connected", markConnected);
      source.removeEventListener("heartbeat", handleHeartbeat);
      source.removeEventListener("orders:admin-updated", refreshOrders);
      source.removeEventListener("tickets:admin-updated", refreshTickets);
      source.close();
      connectionRef.current?.(false);
    };
  }, [enabled, streamUrl]);
}
