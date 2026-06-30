import { beforeEach, describe, expect, it, vi } from "vitest";
import JSZip from "jszip";

const prismaMock = vi.hoisted(() => ({
  task: {
    findMany: vi.fn()
  }
}));

vi.mock("./prisma.js", () => ({ prisma: prismaMock }));

import {
  compareMonthlyCompletedReportTasks,
  generateMonthlyCompletedReportDocx,
  getMonthlyCompletedReportData,
  monthlyCompletedTaskParagraphXml,
  monthlyCompletedTaskBulletLines,
  monthlyCompletedTaskSubtitle,
  monthlyCompletedTasksWhere,
  parseMonthlyCompletedReportPeriod
} from "./monthlyCompletedReport.js";

describe("monthly completed report period", () => {
  it("rejects invalid month values", () => {
    expect(parseMonthlyCompletedReportPeriod("2026-6")).toBeNull();
    expect(parseMonthlyCompletedReportPeriod("2026-13")).toBeNull();
  });

  it("builds the completed task filter from the selected month", () => {
    const period = parseMonthlyCompletedReportPeriod("2026-06");

    expect(period).not.toBeNull();
    expect(monthlyCompletedTasksWhere(period!)).toEqual({
      completed: true,
      completedAtAsana: {
        gte: period!.from,
        lte: period!.to
      }
    });
  });
});

describe("monthly completed report data", () => {
  beforeEach(() => {
    prismaMock.task.findMany.mockReset();
  });

  it("groups completed tasks by assignee and keeps unassigned tasks visible", async () => {
    prismaMock.task.findMany.mockResolvedValue([
      taskRecord({
        id: "task-1",
        name: "Compatibilizar pavimento",
        assignee: { id: "user-1", name: "Ana Coordenadora", role: "COORDINATOR" },
        memberships: [membership("Edificio Norte")]
      }),
      taskRecord({
        id: "task-2",
        name: "Revisar memoria",
        assignee: null,
        memberships: [membership("Edificio Sul")]
      })
    ]);

    const data = await getMonthlyCompletedReportData("2026-06");

    expect(prismaMock.task.findMany).toHaveBeenCalledWith(expect.objectContaining({
      where: {
        completed: true,
        completedAtAsana: {
          gte: expect.any(Date),
          lte: expect.any(Date)
        }
      }
    }));
    expect(data?.totalTasks).toBe(2);
    expect(data?.groups.map((group) => group.userName)).toEqual(["Ana Coordenadora", "Sem respons\u00e1vel"]);
    expect(data?.groups[0]?.tasks[0]).toMatchObject({
      title: "Compatibilizar pavimento",
      projectName: "Edificio Norte",
      estimatedDays: 3,
      conclusionDays: 2,
      startDate: "01/06/2026",
      dueDate: "05/06/2026"
    });
  });

  it("formats task blocks as compact bullets", () => {
    const task = {
      id: "task-1",
      title: "HID - Executivo",
      projectName: "BRISA ATLANTICA",
      estimatedDays: 10,
      conclusionDays: 2,
      startDate: "01/06/2026",
      dueDate: "02/06/2026"
    };

    expect(monthlyCompletedTaskSubtitle(task)).toBe("BRISA ATLANTICA / HID - Executivo");
    expect(monthlyCompletedTaskBulletLines(task)).toEqual([
      "Descri\u00e7\u00e3o:",
      "In\u00edcio / Entrega: 01/06 - 02/06"
    ]);
  });

  it("keeps empty task fields visible in bullet blocks", () => {
    expect(monthlyCompletedTaskSubtitle({
      id: "task-empty",
      title: "Tarefa sem projeto",
      projectName: null,
      estimatedDays: null,
      conclusionDays: null,
      startDate: null,
      dueDate: null
    })).toBe("\u2014 / Tarefa sem projeto");
    expect(monthlyCompletedTaskBulletLines({
      id: "task-empty",
      title: "Tarefa sem datas",
      projectName: null,
      estimatedDays: null,
      conclusionDays: null,
      startDate: null,
      dueDate: null
    })).toEqual([
      "Descri\u00e7\u00e3o:",
      "In\u00edcio / Entrega: \u2014 - \u2014"
    ]);
  });

  it("renders template style ids and bold labels in generated task XML", () => {
    const xml = monthlyCompletedTaskParagraphXml({
      id: "task-xml",
      title: "HID - Executivo",
      projectName: "BRISA ATLANTICA",
      estimatedDays: null,
      conclusionDays: null,
      startDate: "01/06/2026",
      dueDate: "02/06/2026"
    }).join("");

    expect(xml).toContain('w:pStyle w:val="L-TtuloProjeto"');
    expect(xml).toContain('w:pStyle w:val="L-Bullet"');
    expect(xml).toContain("<w:b/>");
    expect(xml).toContain("Descri\u00e7\u00e3o:");
    expect(xml).toContain("In\u00edcio / Entrega:");
    expect(xml).not.toContain("Dias Estimados");
  });

  it("sorts task blocks by start date, due date, project, then title with undated tasks last", () => {
    const tasks = [
      reportTask({ id: "no-date", title: "Sem data", startDate: null, dueDate: null }),
      reportTask({ id: "second-due", title: "B", projectName: "Alpha", startDate: "03/06/2026", dueDate: "05/06/2026" }),
      reportTask({ id: "first-due", title: "C", projectName: "Alpha", startDate: "03/06/2026", dueDate: "04/06/2026" }),
      reportTask({ id: "first-start", title: "D", projectName: "Beta", startDate: "01/06/2026", dueDate: "10/06/2026" }),
      reportTask({ id: "project-sort", title: "A", projectName: "Aardvark", startDate: "03/06/2026", dueDate: "04/06/2026" })
    ];

    expect([...tasks].sort(compareMonthlyCompletedReportTasks).map((task) => task.id)).toEqual([
      "first-start",
      "project-sort",
      "first-due",
      "second-due",
      "no-date"
    ]);
  });

  it("returns a docx buffer based on the stored template", async () => {
    const period = parseMonthlyCompletedReportPeriod("2026-06");

    expect(period).not.toBeNull();

    const buffer = await generateMonthlyCompletedReportDocx({
      period: period!,
      generatedAt: new Date("2026-06-29T12:00:00.000Z"),
      totalTasks: 1,
      groups: [
        {
          userId: "user-1",
          userName: "Ana Coordenadora",
          userRole: "COORDINATOR",
          tasks: [
            {
              id: "task-1",
              title: "HID - Executivo",
              projectName: "BRISA ATLANTICA",
              estimatedDays: null,
              conclusionDays: null,
              startDate: "01/06/2026",
              dueDate: "02/06/2026"
            }
          ]
        }
      ]
    });

    expect(buffer.subarray(0, 2).toString("utf8")).toBe("PK");
    const zip = await JSZip.loadAsync(buffer);
    const documentXml = await zip.file("word/document.xml")?.async("string");

    expect(documentXml).toContain('w:pStyle w:val="Ttulo2"');
    expect(documentXml).toContain('w:pStyle w:val="L-TtuloProjeto"');
    expect(documentXml).toContain('w:pStyle w:val="L-Bullet"');
    expect(documentXml).toContain("Ana Coordenadora");
    expect(documentXml).toContain("BRISA ATLANTICA / HID - Executivo");
    expect(documentXml).toContain("Descri\u00e7\u00e3o:");
    expect(documentXml).toContain("In\u00edcio / Entrega:");
    expect(documentXml).toContain("<w:b/>");
    expect(documentXml).not.toContain("Dias Estimados");
  });
});

function membership(projectName: string) {
  return {
    projectName,
    section: {
      project: {
        name: projectName
      }
    },
    project: null
  };
}

function reportTask(overrides: {
  id: string;
  title: string;
  projectName?: string | null;
  startDate?: string | null;
  dueDate?: string | null;
}) {
  return {
    id: overrides.id,
    title: overrides.title,
    projectName: overrides.projectName ?? "Projeto",
    estimatedDays: null,
    conclusionDays: null,
    startDate: "startDate" in overrides ? (overrides.startDate ?? null) : "01/06/2026",
    dueDate: "dueDate" in overrides ? (overrides.dueDate ?? null) : "01/06/2026"
  };
}

function taskRecord(overrides: {
  id: string;
  name: string;
  assignee: { id: string; name: string; role: string } | null;
  memberships: ReturnType<typeof membership>[];
}) {
  return {
    id: overrides.id,
    name: overrides.name,
    completed: true,
    completedAtAsana: new Date("2026-06-10T12:00:00.000Z"),
    startOn: "2026-06-01",
    dueOn: "2026-06-05",
    dueAt: null,
    estimatedDays: 3,
    estimatedTime: null,
    conclusionDays: 2,
    assignee: overrides.assignee,
    memberships: overrides.memberships
  };
}
