import { describe, expect, it } from "vitest";
import { NotificationType } from "shared";
import {
  commentNotificationMessage,
  createAndEmitNotification,
  notificationPreview,
  notificationTaskStatusLabel
} from "./notify.js";

describe("notificationPreview", () => {
  it("remove markdown e preserva nomes de menções", () => {
    const content =
      "## **Protocolo** 135.459/2026&nbsp;\n- Revisar com @[Maria](mk://user/user-1)\n![planta](https://example.com/a.png)";

    expect(notificationPreview(content)).toBe("Protocolo 135.459/2026 Revisar com @Maria");
  });

  it("normaliza espaços e limita textos longos", () => {
    expect(notificationPreview("  texto   com\nquebras  ")).toBe("texto com quebras");
    expect(notificationPreview("123456789", 6)).toBe("12345…");
  });

  it("combina nome da tarefa e prévia", () => {
    expect(commentNotificationMessage("HID - Executivo", "**Aguardando** retorno")).toBe(
      "HID - Executivo: Aguardando retorno"
    );
  });

  it("converte status internos para labels de produto", () => {
    expect(notificationTaskStatusLabel("AWAITING_REVIEW")).toBe("Aguardando Revisão");
  });
});

describe("createAndEmitNotification", () => {
  it("suprime notificações humanas para o próprio ator", async () => {
    await expect(
      createAndEmitNotification({
        userId: "user-1",
        actorId: "user-1",
        type: NotificationType.TASK_ASSIGNED,
        message: "Tarefa"
      })
    ).resolves.toBeNull();
  });
});
