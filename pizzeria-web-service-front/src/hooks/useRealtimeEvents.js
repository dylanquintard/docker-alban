import { useEffect, useRef } from "react";
import { REALTIME_STREAM_URL } from "../config/env";

const SUPPORTED_EVENTS = [
  "realtime:connected",
  "orders:admin-updated",
  "orders:user-updated",
  "timeslots:updated",
  "locations:updated",
  "cart:updated",
];

function parseEventData(rawData) {
  if (!rawData) return {};
  try {
    return JSON.parse(rawData);
  } catch (_err) {
    return {};
  }
}

export function useRealtimeEvents({ enabled, onEvent, onConnectionChange }) {
  const eventHandlerRef = useRef(onEvent);
  const connectionHandlerRef = useRef(onConnectionChange);

  useEffect(() => {
    eventHandlerRef.current = onEvent;
  }, [onEvent]);

  useEffect(() => {
    connectionHandlerRef.current = onConnectionChange;
  }, [onConnectionChange]);

  useEffect(() => {
    if (!enabled || typeof window === "undefined" || typeof window.EventSource === "undefined") {
      connectionHandlerRef.current?.(false);
      return undefined;
    }

    const stream = new window.EventSource(REALTIME_STREAM_URL, {
      withCredentials: true,
    });

    const listeners = [];

    stream.onopen = () => {
      connectionHandlerRef.current?.(true);
    };

    stream.onerror = () => {
      connectionHandlerRef.current?.(false);
    };

    for (const eventName of SUPPORTED_EVENTS) {
      const listener = (event) => {
        eventHandlerRef.current?.(eventName, parseEventData(event?.data));
      };
      listeners.push({ eventName, listener });
      stream.addEventListener(eventName, listener);
    }

    return () => {
      stream.onopen = null;
      stream.onerror = null;
      for (const { eventName, listener } of listeners) {
        stream.removeEventListener(eventName, listener);
      }
      stream.close();
      connectionHandlerRef.current?.(false);
    };
  }, [enabled]);
}

