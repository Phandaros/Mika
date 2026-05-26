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
let notificationSocketBaseUrl = "";

export function getNotificationSocket(): Socket<ServerToClientEvents, ClientToServerEvents> {
  const baseUrl = getSocketBaseUrl();

  if (notificationSocket && notificationSocketBaseUrl !== baseUrl) {
    notificationSocket.disconnect();
    notificationSocket = null;
  }

  if (!notificationSocket) {
    notificationSocketBaseUrl = baseUrl;
    notificationSocket = io(`${baseUrl}/notifications`, {
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

export function resetNotificationSocket(): void {
  notificationSocket?.disconnect();
  notificationSocket = null;
  notificationSocketBaseUrl = "";
}
