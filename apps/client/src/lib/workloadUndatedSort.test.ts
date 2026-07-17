import { describe, expect, it } from "vitest";
import { TaskStatus } from "shared";
import { sortWorkloadUndatedTasks } from "./workloadUndatedSort";

type SortableTask = Parameters<typeof sortWorkloadUndatedTasks>[0][number];

function task(input: Partial<SortableTask> & Pick<SortableTask, "id">): SortableTask {
  return {
    id: input.id,
    title: input.title ?? input.id,
    status: input.status ?? TaskStatus.TODO,
    updatedAt: input.updatedAt ?? "2026-07-01T12:00:00.000Z",
    lastActivityAt: input.lastActivityAt
  };
}

describe("sortWorkloadUndatedTasks", () => {
  it("mantém todos os status ativos antes de aguardando definição", () => {
    const tasks = [
      task({ id: "waiting-new", status: TaskStatus.AWAITING_DEFINITION, updatedAt: "2026-07-10T12:00:00.000Z" }),
      task({ id: "todo-old", status: TaskStatus.TODO, updatedAt: "2026-07-01T12:00:00.000Z" }),
      task({ id: "progress-old", status: TaskStatus.IN_PROGRESS, updatedAt: "2026-06-01T12:00:00.000Z" })
    ];

    expect(sortWorkloadUndatedTasks(tasks).map(({ id }) => id)).toEqual([
      "todo-old",
      "progress-old",
      "waiting-new"
    ]);
  });

  it("ordena cada grupo pela atividade mais recente, incluindo comentário", () => {
    const tasks = [
      task({ id: "edited", updatedAt: "2026-07-08T12:00:00.000Z" }),
      task({
        id: "commented",
        updatedAt: "2026-07-01T12:00:00.000Z",
        lastActivityAt: "2026-07-09T12:00:00.000Z"
      }),
      task({ id: "waiting-old", status: TaskStatus.AWAITING_DEFINITION, updatedAt: "2026-07-02T12:00:00.000Z" }),
      task({ id: "waiting-new", status: TaskStatus.AWAITING_DEFINITION, updatedAt: "2026-07-07T12:00:00.000Z" })
    ];

    expect(sortWorkloadUndatedTasks(tasks).map(({ id }) => id)).toEqual([
      "commented",
      "edited",
      "waiting-new",
      "waiting-old"
    ]);
  });

  it("usa updatedAt como fallback sem atividade e desempata por título e id", () => {
    const tasks = [
      task({ id: "b", title: "Beta", updatedAt: "2026-07-05T12:00:00.000Z" }),
      task({ id: "z", title: "Álgebra", updatedAt: "2026-07-05T12:00:00.000Z" }),
      task({ id: "a", title: "Álgebra", updatedAt: "2026-07-05T12:00:00.000Z" }),
      task({ id: "recent", title: "Zulu", updatedAt: "2026-07-06T12:00:00.000Z" })
    ];

    expect(sortWorkloadUndatedTasks(tasks).map(({ id }) => id)).toEqual(["recent", "a", "z", "b"]);
  });
});
