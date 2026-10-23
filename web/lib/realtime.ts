"use client";
import { useEffect, useRef } from "react";
import { io, Socket } from "socket.io-client";
import { getToken, silentRefresh } from "@/lib/api";

// Live updates from the backend. The server address comes from NEXT_PUBLIC_REALTIME_URL
// (defaults to the local backend). Connections are checked with the access token, so when
// a connection is refused we refresh the token and try again.
let socket: Socket | null = null;

export function getSocket(): Socket | null {
  if (typeof window === "undefined") return null;
  const token = getToken();
  if (!token) return null;
  if (socket) {
    socket.auth = { token };
    if (!socket.connected) socket.connect();
    return socket;
  }
  const url = process.env.NEXT_PUBLIC_REALTIME_URL || (typeof window !== "undefined" ? window.location.origin : "http://localhost:5000");
  socket = io(url, { auth: { token }, transports: ["websocket", "polling"], reconnection: true });
  socket.on("connect_error", async () => {
    const ok = await silentRefresh();
    if (ok && socket) {
      socket.auth = { token: getToken() };
      socket.connect();
    }
  });
  return socket;
}

// Runs handler whenever the server sends this event.
export function useLive(event: string, handler: (payload: any) => void) {
  const ref = useRef(handler);
  ref.current = handler;
  useEffect(() => {
    const s = getSocket();
    if (!s) return;
    const fn = (p: any) => ref.current(p);
    s.on(event, fn);
    return () => {
      s.off(event, fn);
    };
  }, [event]);
}
