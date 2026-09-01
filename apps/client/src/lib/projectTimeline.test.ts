import { describe, expect, it } from "vitest";
import { TaskStatus, type ProjectTimelineEventDto } from "shared";
import {
  anchoredTimelineScrollLeft,
  centeredTimelineScrollLeft,
  fitTimelineScale,
  nextTimelineScale,
  packTimelineLanes,
  projectTimelineRange,
  taskTimelineGeometry,
  timelineMonthBands,
  timelineHeaderDensity,
  timelineWeekBoundaries,
  validTimelineDateOnly,
  type TimelineTask
} from "./projectTimeline";

function task(overrides: Partial<TimelineTask> = {}): TimelineTask {
  return {
    id: "task-1",
    title: "Projeto executivo",
    disciplineId: "section-1",
    startDate: "2026-08-01",
    dueDate: null,
    completedAt: null,
    completed: false,
    status: TaskStatus.IN_PROGRESS,
    ...overrides
  };
}

describe("projectTimeline", () => {
  it("termina tarefas abertas em hoje e concluídas na conclusão", () => {
    expect(taskTimelineGeometry(task(), "2026-08-31")).toMatchObject({
      kind: "bar",
      startDate: "2026-08-01",
      endDate: "2026-08-31"
    });
    expect(taskTimelineGeometry(task({ completed: true, completedAt: "2026-08-20T18:00:00.000Z" }), "2026-08-31"))
      .toMatchObject({ kind: "bar", endDate: "2026-08-20" });
  });

  it("usa a entrega como tarefa de um dia quando não há início", () => {
    expect(taskTimelineGeometry(task({ startDate: null, dueDate: "2026-09-10" }), "2026-08-31"))
      .toMatchObject({ kind: "bar", startDate: "2026-09-10", endDate: "2026-09-10" });
    expect(taskTimelineGeometry(task({ startDate: "2026-02-30", dueDate: "2026-09-10" }), "2026-08-31"))
      .toMatchObject({ kind: "bar", startDate: "2026-09-10" });
    expect(taskTimelineGeometry(task({ startDate: null, dueDate: null }), "2026-08-31")).toBeNull();
    expect(taskTimelineGeometry(task({ startDate: null, dueDate: "2026-02-30" }), "2026-08-31")).toBeNull();
  });

  it("cria marcadores futuros ou defensivos para tarefas com início", () => {
    expect(taskTimelineGeometry(task({ startDate: "2026-09-10" }), "2026-08-31"))
      .toMatchObject({ kind: "future-marker", startDate: "2026-09-10" });
    expect(taskTimelineGeometry(task({ completed: true, completedAt: null }), "2026-08-31"))
      .toMatchObject({ kind: "defensive-marker", warning: "Tarefa concluída sem data de conclusão" });
    expect(taskTimelineGeometry(task({ completed: true, completedAt: "2026-02-30" }), "2026-08-31"))
      .toMatchObject({ kind: "defensive-marker", warning: "Tarefa concluída com data de conclusão inválida" });
    expect(validTimelineDateOnly("2026-02-30")).toBeNull();
  });

  it("inclui tarefas, eventos, hoje e margem no período", () => {
    const geometry = taskTimelineGeometry(task(), "2026-08-31");
    const event = { eventDate: "2026-09-20" } as ProjectTimelineEventDto;
    expect(projectTimelineRange(geometry ? [geometry] : [], [event], "2026-08-31", 7)).toEqual({
      from: "2026-07-25",
      to: "2026-09-27",
      dayCount: 65
    });
  });

  it("empacota intervalos que se sobrepõem em lanes distintas", () => {
    const packed = packTimelineLanes(
      [
        { id: "a", start: 0, end: 4 },
        { id: "b", start: 2, end: 3 },
        { id: "c", start: 5, end: 8 }
      ],
      (item) => ({ startIndex: item.start, endIndex: item.end })
    );
    expect(packed.map(({ item, lane }) => [item.id, lane])).toEqual([
      ["a", 0],
      ["b", 1],
      ["c", 0]
    ]);
  });

  it("ajusta e ancora o zoom", () => {
    expect(fitTimelineScale(960, 120)).toBe(8);
    expect(fitTimelineScale(960, 10)).toBe(48);
    expect(nextTimelineScale(8, "in", 8)).toBe(10);
    expect(nextTimelineScale(8, "out", 8)).toBe(8);
    expect(anchoredTimelineScrollLeft(300, 200, 10, 20)).toBe(800);
    expect(centeredTimelineScrollLeft(30, 960, 44)).toBe(862);
    expect(timelineHeaderDensity(44)).toBe("day");
    expect(timelineHeaderDensity(20)).toBe("week");
    expect(timelineHeaderDensity(8)).toBe("week");
    expect(timelineHeaderDensity(4)).toBe("month");
  });

  it("divide o calendário em meses e limites semanais reais", () => {
    expect(timelineMonthBands("2026-01-29", 10)).toEqual([
      {
        id: "month-24312",
        startIndex: 0,
        dayCount: 3,
        alternate: true,
        startsAtBoundary: false
      },
      {
        id: "month-24313",
        startIndex: 3,
        dayCount: 7,
        alternate: false,
        startsAtBoundary: true
      }
    ]);
    expect(timelineWeekBoundaries("2026-01-29", 10)).toEqual([4]);
  });
});
