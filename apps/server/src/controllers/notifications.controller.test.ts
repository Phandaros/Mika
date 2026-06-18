import type { NextFunction, Request, Response } from "express";
import { beforeEach, describe, expect, it, vi } from "vitest";

const prismaMock = vi.hoisted(() => ({
  notification: {
    count: vi.fn(),
    findMany: vi.fn(),
    updateMany: vi.fn(),
    findFirstOrThrow: vi.fn()
  }
}));

vi.mock("../lib/prisma.js", () => ({ prisma: prismaMock }));
vi.mock("../middleware/auth.js", () => ({
  getAuthUser: () => ({ id: "user-1" })
}));
vi.mock("../lib/notify.js", () => ({
  notificationInclude: { actor: true },
  notificationToPayload: (notification: { id: string }) => ({ id: notification.id })
}));

import {
  listNotifications,
  markNotificationRead
} from "./notifications.controller.js";

function responseMock() {
  return {
    json: vi.fn()
  } as unknown as Response;
}

const nextMock = vi.fn() as NextFunction;

describe("notifications controller", () => {
  beforeEach(() => {
    vi.clearAllMocks();
  });

  it("pagina, filtra e retorna o contador global de não lidas", async () => {
    prismaMock.notification.count.mockResolvedValueOnce(12).mockResolvedValueOnce(4);
    prismaMock.notification.findMany.mockResolvedValue([{ id: "notification-1" }]);
    const res = responseMock();

    await listNotifications(
      {
        query: { page: "2", limit: "5", read: "false", type: "COMMENT_ADDED" }
      } as unknown as Request,
      res,
      nextMock
    );

    expect(prismaMock.notification.findMany).toHaveBeenCalledWith(
      expect.objectContaining({
        where: { userId: "user-1", read: false, type: "COMMENT_ADDED" },
        skip: 5,
        take: 5
      })
    );
    expect(res.json).toHaveBeenCalledWith({
      notifications: [{ id: "notification-1" }],
      page: 2,
      limit: 5,
      total: 12,
      totalPages: 3,
      unreadCount: 4
    });
  });

  it("permite marcar uma notificação como não lida", async () => {
    prismaMock.notification.updateMany.mockResolvedValue({ count: 1 });
    prismaMock.notification.findFirstOrThrow.mockResolvedValue({ id: "notification-1" });
    const res = responseMock();

    await markNotificationRead(
      {
        params: { id: "notification-1" },
        body: { read: false }
      } as unknown as Request,
      res,
      nextMock
    );

    expect(prismaMock.notification.updateMany).toHaveBeenCalledWith({
      where: { id: "notification-1", userId: "user-1" },
      data: { read: false }
    });
    expect(nextMock).not.toHaveBeenCalled();
  });
});
