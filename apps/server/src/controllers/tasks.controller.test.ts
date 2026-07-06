import type { NextFunction, Request, Response } from "express";
import { beforeEach, describe, expect, it, vi } from "vitest";
import { AppError } from "../middleware/errorHandler.js";

const txMock = vi.hoisted(() => ({
  task: {
    findUnique: vi.fn(),
    delete: vi.fn(),
    update: vi.fn()
  },
  weeklyReportItem: {
    deleteMany: vi.fn(),
    findFirst: vi.fn()
  }
}));

const prismaMock = vi.hoisted(() => ({
  $transaction: vi.fn(async (callback: (tx: typeof txMock) => unknown) => callback(txMock))
}));

vi.mock("../lib/prisma.js", () => ({ prisma: prismaMock }));

import { deleteTask } from "./tasks.controller.js";

function responseMock() {
  return {
    status: vi.fn().mockReturnThis(),
    send: vi.fn()
  } as unknown as Response;
}

function requestMock(id = "task-1") {
  return {
    params: { id },
    authUser: {
      id: "user-1",
      email: "user@example.com",
      name: "User",
      role: "COORDINATOR"
    }
  } as unknown as Request;
}

describe("deleteTask", () => {
  beforeEach(() => {
    vi.clearAllMocks();
    txMock.task.findUnique.mockResolvedValue({ id: "task-1", deletedAt: null });
    txMock.weeklyReportItem.deleteMany.mockResolvedValue({ count: 0 });
    txMock.weeklyReportItem.findFirst.mockResolvedValue(null);
  });

  it("exclui fisicamente tarefa sem relatório submetido", async () => {
    const res = responseMock();
    const next = vi.fn() as NextFunction;

    await deleteTask(requestMock(), res, next);

    expect(txMock.weeklyReportItem.deleteMany).toHaveBeenCalledWith({
      where: {
        taskId: "task-1",
        report: { status: { in: ["PENDING", "LATE"] } }
      }
    });
    expect(txMock.task.delete).toHaveBeenCalledWith({ where: { id: "task-1" } });
    expect(txMock.task.update).not.toHaveBeenCalled();
    expect(res.status).toHaveBeenCalledWith(204);
    expect(res.send).toHaveBeenCalled();
    expect(next).not.toHaveBeenCalled();
  });

  it("remove itens abertos antes de excluir tarefa sem relatório submetido", async () => {
    txMock.weeklyReportItem.deleteMany.mockResolvedValue({ count: 2 });
    const res = responseMock();
    const next = vi.fn() as NextFunction;

    await deleteTask(requestMock(), res, next);

    expect(txMock.weeklyReportItem.deleteMany).toHaveBeenCalled();
    expect(txMock.task.delete).toHaveBeenCalledWith({ where: { id: "task-1" } });
    expect(txMock.task.update).not.toHaveBeenCalled();
    expect(res.status).toHaveBeenCalledWith(204);
  });

  it("marca soft delete quando há relatório submetido", async () => {
    txMock.weeklyReportItem.findFirst.mockResolvedValue({ id: "submitted-item-1" });
    const res = responseMock();
    const next = vi.fn() as NextFunction;

    await deleteTask(requestMock(), res, next);

    expect(txMock.task.delete).not.toHaveBeenCalled();
    expect(txMock.task.update).toHaveBeenCalledWith({
      where: { id: "task-1" },
      data: {
        deletedAt: expect.any(Date),
        deletedByUserId: "user-1"
      }
    });
    expect(res.status).toHaveBeenCalledWith(204);
  });

  it("retorna 404 quando a tarefa não existe ou já está excluída", async () => {
    txMock.task.findUnique.mockResolvedValue({ id: "task-1", deletedAt: new Date() });
    const res = responseMock();
    const next = vi.fn() as NextFunction;

    await deleteTask(requestMock(), res, next);

    expect(txMock.task.delete).not.toHaveBeenCalled();
    expect(next).toHaveBeenCalledWith(expect.any(AppError));
    const error = vi.mocked(next).mock.calls[0]?.[0] as unknown as AppError;
    expect(error.statusCode).toBe(404);
  });
});
