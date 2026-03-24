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

    const source = new window.EventSource(streamUrl, {
      withCredentials: true,
    });
    const refreshOrders = () => {
      ordersUpdatedRef.current?.();
    };
    const refreshTickets = () => {
      ticketsUpdatedRef.current?.();
    };
    const markConnected = () => {
      connectionRef.current?.(true);
    };

    source.onopen = markConnected;
    source.onerror = () => connectionRef.current?.(false);
    source.addEventListener("realtime:connected", markConnected);
    source.addEventListener("orders:admin-updated", refreshOrders);
    source.addEventListener("tickets:admin-updated", refreshTickets);

    return () => {
      source.removeEventListener("realtime:connected", markConnected);
      source.removeEventListener("orders:admin-updated", refreshOrders);
      source.removeEventListener("tickets:admin-updated", refreshTickets);
      source.close();
      connectionRef.current?.(false);
    };
  }, [enabled, streamUrl]);
}
