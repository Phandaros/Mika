import type { Server as HttpServer } from "node:http";
import { Server, type Namespace } from "socket.io";

let notificationsNamespace: Namespace | null = null;

export function initSocket(server: HttpServer, clientUrl: string): Server {
  const io = new Server(server, {
    cors: {
      origin: clientUrl,
      credentials: true
    }
  });

  notificationsNamespace = io.of("/notifications");

  notificationsNamespace.on("connection", (socket) => {
    socket.on("join", (userId: string) => {
      if (userId.trim().length > 0) {
        void socket.join(userId);
      }
    });
  });

  return io;
}

export function emitNotification(userId: string, notification: unknown): void {
  notificationsNamespace?.to(userId).emit("notification:new", notification);
}
