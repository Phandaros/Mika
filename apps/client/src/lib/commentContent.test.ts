import { AxiosError, type AxiosResponse } from "axios";
import { describe, expect, it } from "vitest";
import { commentErrorMessage, findUnsupportedMarkdown } from "./commentContent";

function apiError(status: number, error?: string): AxiosError {
  const response = { status, data: error ? { error } : {} } as AxiosResponse;
  return new AxiosError("falhou", undefined, undefined, undefined, response);
}

describe("findUnsupportedMarkdown", () => {
  it("detects tables", () => {
    expect(findUnsupportedMarkdown("| A | B |\n|---|---|\n| 1 | 2 |")).toEqual({ table: true, html: false });
  });

  it("detects raw html", () => {
    expect(findUnsupportedMarkdown("texto <b>forte</b>")).toEqual({ table: false, html: true });
  });

  it("ignores markdown supported by the editor", () => {
    expect(findUnsupportedMarkdown("**negrito** e `<b>` e 2 < 3 > 1\n\n- item")).toBeNull();
  });
});

describe("commentErrorMessage", () => {
  it("uses the server message", () => {
    expect(commentErrorMessage(apiError(403, "Sem permissão"), "padrão")).toBe("Sem permissão");
  });

  it("translates a missing comment", () => {
    expect(commentErrorMessage(apiError(404, "Comment not found"), "padrão")).toBe("Este comentário não existe mais.");
  });

  it("explains a connection failure", () => {
    expect(commentErrorMessage(new AxiosError("Network Error"), "Seu texto continua no editor.")).toBe(
      "Sem conexão com o servidor. Seu texto continua no editor."
    );
  });
});
