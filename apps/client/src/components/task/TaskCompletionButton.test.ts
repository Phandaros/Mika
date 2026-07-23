import { createElement } from "react";
import { renderToStaticMarkup } from "react-dom/server";
import { describe, expect, it, vi } from "vitest";
import { TaskCompletionButton } from "./TaskCompletionButton";

describe("TaskCompletionButton", () => {
  it("renders an accessible disabled spinner while completion is saving", () => {
    const markup = renderToStaticMarkup(
      createElement(TaskCompletionButton, { completed: false, loading: true, onToggle: vi.fn() })
    );

    expect(markup).toContain('aria-busy="true"');
    expect(markup).toContain('aria-label="Salvando conclusão da tarefa"');
    expect(markup).toContain('title="Salvando..."');
    expect(markup).toContain("disabled");
    expect(markup).toContain("animate-spin");
  });

  it("describes the inverse action for a completed task", () => {
    const markup = renderToStaticMarkup(
      createElement(TaskCompletionButton, { completed: true, onToggle: vi.fn() })
    );

    expect(markup).toContain('aria-label="Reabrir tarefa"');
    expect(markup).toContain('title="Reabrir tarefa"');
    expect(markup).toContain("text-emerald-400");
  });
});
