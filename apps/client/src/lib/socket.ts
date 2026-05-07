import { io, type Socket } from "socket.io-client";
import type { Notification } from "shared";
import { getSocketBaseUrl } from "./runtimeConfig";

interface ServerToClientEvents {
  "notification:new": (notification: Notification) => void;
}

interface ClientToServerEvents {
  join: (userId: string) => void;
}

let notificationSocket: Socket<ServerToClientEvents, ClientToServerEvents> | null = null;

export function getNotificationSocket(): Socket<ServerToClientEvents, ClientToServerEvents> {
  if (!notificationSocket) {
    notificationSocket = io(`${getSocketBaseUrl()}/notifications`, {
      autoConnect: false,
      withCredentials: true
    });
  }

  return notificationSocket;
}

export function connectNotificationSocket(userId: string): void {
  const socket = getNotificationSocket();

  if (!socket.connected) {
    socket.connect();
  }

  socket.emit("join", userId);
}

export function disconnectNotificationSocket(): void {
  notificationSocket?.disconnect();
}
