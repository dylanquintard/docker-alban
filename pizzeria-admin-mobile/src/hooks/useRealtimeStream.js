import { useEffect, useRef } from "react";

export function useRealtimeStream({ enabled, streamUrl, onConnectionChange, onOrdersUpdated }) {
  const connectionRef = useRef(onConnectionChange);
  const ordersUpdatedRef = useRef(onOrdersUpdated);

  useEffect(() => {
    connectionRef.current = onConnectionChange;
  }, [onConnectionChange]);

  useEffect(() => {
    ordersUpdatedRef.current = onOrdersUpdated;
  }, [onOrdersUpdated]);

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

    source.onopen = () => connectionRef.current?.(true);
    source.onerror = () => connectionRef.current?.(false);
    source.addEventListener("orders:admin-updated", refreshOrders);

    return () => {
      source.removeEventListener("orders:admin-updated", refreshOrders);
      source.close();
      connectionRef.current?.(false);
    };
  }, [enabled, streamUrl]);
}
