import { beforeEach, describe, expect, it, vi } from "vitest";
import { NotificationType, type Notification, type Task } from "shared";

vi.mock("./api", () => ({
  api: {
    get: vi.fn()
  }
}));

import { api } from "./api";
import {
  normalizeLegacyNotificationText,
  notificationActorName,
  notificationPresentation,
  openNotificationDestination
} from "./notifications";

const baseNotification: Notification = {
  id: "notification-1",
  userId: "user-1",
  type: NotificationType.COMMENT_ADDED,
  title: "Novo comentário",
  message: "Tarefa: **Revisar** com [Maria](mk://user/user-2)",
  read: false,
  taskId: "task-1",
  actor: { id: "user-2", name: "Maria", avatarUrl: null },
  createdAt: "2026-06-18T12:00:00.000Z"
};

beforeEach(() => {
  vi.clearAllMocks();
});

describe("notification presentation", () => {
  it("mapeia tipos conhecidos e mantém fallback para tipos legados", () => {
    expect(notificationPresentation(NotificationType.COMMENT_ADDED).action).toBe("comentou em uma tarefa");
    expect(notificationPresentation("LEGACY").action).toBe("enviou uma notificação");
  });

  it("limpa markdown e mojibake legado", () => {
    expect(normalizeLegacyNotificationText("Novo comentÃ¡rio: **Revisar** com [Maria](mk://user/u1)&nbsp;")).toBe(
      "Novo comentário: Revisar com @Maria"
    );
  });

  it("normaliza títulos e status antigos", () => {
    expect(normalizeLegacyNotificationText("Tarefa atribuida a voce: INPROGRESS")).toBe(
      "Tarefa atribuída a você: Em andamento"
    );
  });

  it("prioriza o nome do ator e usa o título como fallback", () => {
    expect(notificationActorName(baseNotification)).toBe("Maria");
    expect(notificationActorName({ ...baseNotification, actor: null })).toBe("Novo comentário");
  });
});

describe("openNotificationDestination", () => {
  it("abre relatório semanal sem consultar tarefa", async () => {
    const navigate = vi.fn();
    const getSpy = vi.spyOn(api, "get");

    await expect(
      openNotificationDestination(
        { ...baseNotification, type: NotificationType.WEEKLY_REPORT_DUE, taskId: null },
        navigate
      )
    ).resolves.toBe(true);

    expect(navigate).toHaveBeenCalledWith("/weekly-reports/mine");
    expect(getSpy).not.toHaveBeenCalled();
  });

  it("abre a tarefa no projeto relacionado", async () => {
    const navigate = vi.fn();
    vi.spyOn(api, "get").mockResolvedValue({
      data: {
        task: {
          id: "task-1",
          projects: [{ id: "project-1", name: "Edifício", sectionName: "HID" }]
        } as Task
      }
    });

    await expect(openNotificationDestination(baseNotification, navigate)).resolves.toBe(true);
    expect(navigate).toHaveBeenCalledWith("/projects/project-1?task=task-1");
  });

  it("retorna falso quando a tarefa não está mais disponível", async () => {
    vi.spyOn(api, "get").mockRejectedValue(new Error("not found"));

    await expect(openNotificationDestination(baseNotification, vi.fn())).resolves.toBe(false);
  });
});
