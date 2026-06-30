import fs from "node:fs/promises";
import path from "node:path";
import { fileURLToPath } from "node:url";
import { endOfMonth, format, startOfMonth } from "date-fns";
import { ptBR } from "date-fns/locale";
import JSZip from "jszip";
import type { Prisma } from "../generated/prisma/client.js";
import { prisma } from "./prisma.js";

const unassignedUserId = "__unassigned__";
const dash = "\u2014";
const templatePath = path.resolve(
  path.dirname(fileURLToPath(import.meta.url)),
  "../../templates/monthly-completed-report-template.docx"
);

const completedTaskInclude = {
  assignee: {
    select: {
      id: true,
      name: true,
      role: true
    }
  },
  memberships: {
    include: {
      section: {
        include: {
          project: true
        }
      },
      project: true
    }
  }
} satisfies Prisma.TaskInclude;

type CompletedTaskRecord = Prisma.TaskGetPayload<{ include: typeof completedTaskInclude }>;

export interface MonthlyCompletedReportPeriod {
  month: string;
  from: Date;
  to: Date;
  label: string;
}

export interface MonthlyCompletedReportTask {
  id: string;
  title: string;
  projectName: string | null;
  estimatedDays: number | null;
  conclusionDays: number | null;
  startDate: string | null;
  dueDate: string | null;
}

export interface MonthlyCompletedReportGroup {
  userId: string | null;
  userName: string;
  userRole: string | null;
  tasks: MonthlyCompletedReportTask[];
}

export interface MonthlyCompletedReportData {
  period: MonthlyCompletedReportPeriod;
  generatedAt: Date;
  groups: MonthlyCompletedReportGroup[];
  totalTasks: number;
}

export function parseMonthlyCompletedReportPeriod(month: string): MonthlyCompletedReportPeriod | null {
  if (!/^\d{4}-(0[1-9]|1[0-2])$/.test(month)) {
    return null;
  }

  const [yearText, monthText] = month.split("-");
  const year = Number(yearText);
  const monthIndex = Number(monthText) - 1;
  const baseDate = new Date(year, monthIndex, 1);

  return {
    month,
    from: startOfMonth(baseDate),
    to: endOfMonth(baseDate),
    label: format(baseDate, "MMMM 'de' yyyy", { locale: ptBR })
  };
}

export function monthlyCompletedTasksWhere(
  period: MonthlyCompletedReportPeriod
): Prisma.TaskWhereInput {
  return {
    completed: true,
    completedAtAsana: {
      gte: period.from,
      lte: period.to
    }
  };
}

function taskProjectName(task: CompletedTaskRecord): string | null {
  const membership = task.memberships[0];
  const project = membership?.section?.project ?? membership?.project;

  return project?.name ?? membership?.projectName ?? null;
}

function dateOnly(value: string | Date | null | undefined): string | null {
  if (!value) {
    return null;
  }

  if (value instanceof Date) {
    return format(value, "dd/MM/yyyy");
  }

  return format(new Date(`${value.slice(0, 10)}T12:00:00`), "dd/MM/yyyy");
}

function compactDate(value: string | null): string {
  return value ? value.slice(0, 5) : dash;
}

function text(value: string | null | undefined): string {
  return value?.trim() || dash;
}

function taskSortDate(value: string | null): string {
  if (!value) {
    return "9999-12-31";
  }

  const [day, month, year] = value.split("/");
  if (!day || !month || !year) {
    return value;
  }

  return `${year}-${month}-${day}`;
}

function escapeXml(value: string): string {
  return value
    .replace(/&/g, "&amp;")
    .replace(/</g, "&lt;")
    .replace(/>/g, "&gt;")
    .replace(/"/g, "&quot;")
    .replace(/'/g, "&apos;");
}

export function compareMonthlyCompletedReportTasks(
  left: MonthlyCompletedReportTask,
  right: MonthlyCompletedReportTask
): number {
  return taskSortDate(left.startDate).localeCompare(taskSortDate(right.startDate)) ||
    taskSortDate(left.dueDate).localeCompare(taskSortDate(right.dueDate)) ||
    text(left.projectName).localeCompare(text(right.projectName), "pt-BR") ||
    left.title.localeCompare(right.title, "pt-BR");
}

function groupTasks(tasks: CompletedTaskRecord[]): MonthlyCompletedReportGroup[] {
  const groups = new Map<string, MonthlyCompletedReportGroup>();

  for (const task of tasks) {
    const userKey = task.assignee?.id ?? unassignedUserId;
    const current = groups.get(userKey) ?? {
      userId: task.assignee?.id ?? null,
      userName: task.assignee?.name ?? "Sem respons\u00e1vel",
      userRole: task.assignee?.role ?? null,
      tasks: []
    };

    current.tasks.push({
      id: task.id,
      title: task.name,
      projectName: taskProjectName(task),
      estimatedDays: task.estimatedDays ?? task.estimatedTime ?? null,
      conclusionDays: task.conclusionDays ?? null,
      startDate: dateOnly(task.startOn),
      dueDate: dateOnly(task.dueOn) ?? dateOnly(task.dueAt)
    });
    groups.set(userKey, current);
  }

  return [...groups.values()]
    .map((group) => ({
      ...group,
      tasks: group.tasks.sort(compareMonthlyCompletedReportTasks)
    }))
    .sort((left, right) => {
      if (left.userId === null && right.userId !== null) {
        return 1;
      }

      if (left.userId !== null && right.userId === null) {
        return -1;
      }

      return left.userName.localeCompare(right.userName, "pt-BR");
    });
}

export async function getMonthlyCompletedReportData(month: string): Promise<MonthlyCompletedReportData | null> {
  const period = parseMonthlyCompletedReportPeriod(month);

  if (!period) {
    return null;
  }

  const tasks = await prisma.task.findMany({
    where: monthlyCompletedTasksWhere(period),
    include: completedTaskInclude,
    orderBy: [
      { assignee: { name: "asc" } },
      { name: "asc" }
    ]
  });

  const groups = groupTasks(tasks);

  return {
    period,
    generatedAt: new Date(),
    groups,
    totalTasks: tasks.length
  };
}

export function monthlyCompletedTaskSubtitle(task: MonthlyCompletedReportTask): string {
  return `${text(task.projectName)} / ${task.title}`;
}

export function monthlyCompletedTaskBulletLines(task: MonthlyCompletedReportTask): string[] {
  return [
    "Descri\u00e7\u00e3o:",
    `In\u00edcio / Entrega: ${compactDate(task.startDate)} - ${compactDate(task.dueDate)}`
  ];
}

function textRun(value: string, options: { bold?: boolean; preserveSpace?: boolean } = {}): string {
  const space = options.preserveSpace ? ' xml:space="preserve"' : "";
  const bold = options.bold ? "<w:rPr><w:b/></w:rPr>" : "";
  return `<w:r>${bold}<w:t${space}>${escapeXml(value)}</w:t></w:r>`;
}

function paragraphXml(styleId: string, runs: string[]): string {
  return `<w:p><w:pPr><w:pStyle w:val="${styleId}"/></w:pPr>${runs.join("")}</w:p>`;
}

function emptyParagraphXml(): string {
  return "<w:p/>";
}

export function monthlyCompletedTaskParagraphXml(task: MonthlyCompletedReportTask): string[] {
  return [
    paragraphXml("L-TtuloProjeto", [textRun(monthlyCompletedTaskSubtitle(task), { bold: true })]),
    paragraphXml("L-Bullet", [
      textRun("Descri\u00e7\u00e3o:", { bold: true }),
      textRun(" ", { preserveSpace: true })
    ]),
    paragraphXml("L-Bullet", [
      textRun("In\u00edcio / Entrega:", { bold: true }),
      textRun(` ${compactDate(task.startDate)} - ${compactDate(task.dueDate)}`, { preserveSpace: true })
    ]),
    emptyParagraphXml()
  ];
}

function reportBodyXml(data: MonthlyCompletedReportData): string {
  if (data.groups.length === 0) {
    return paragraphXml("L-Bullet", [textRun("Nenhuma tarefa conclu\u00edda no per\u00edodo selecionado.")]);
  }

  return data.groups
    .flatMap((group) => [
      paragraphXml("Ttulo2", [
        textRun(group.userName, { bold: true }),
        textRun(` (${group.tasks.length})`, { preserveSpace: true })
      ]),
      ...group.tasks.flatMap((task) => monthlyCompletedTaskParagraphXml(task))
    ])
    .join("");
}

function replaceDocumentBody(documentXml: string, bodyXml: string): string {
  const sectionPropertiesMatch = documentXml.match(/<w:sectPr[\s\S]*?<\/w:sectPr>\s*(?=<\/w:body>)/);
  const sectionProperties = sectionPropertiesMatch?.[0] ?? "";
  return documentXml.replace(/<w:body>[\s\S]*<\/w:body>/, `<w:body>${bodyXml}${sectionProperties}</w:body>`);
}

export async function generateMonthlyCompletedReportDocx(data: MonthlyCompletedReportData): Promise<Buffer> {
  const template = await fs.readFile(templatePath);
  const zip = await JSZip.loadAsync(template);
  const documentFile = zip.file("word/document.xml");

  if (!documentFile) {
    throw new Error("Template do relat\u00f3rio mensal n\u00e3o possui word/document.xml");
  }

  const documentXml = await documentFile.async("string");
  zip.file("word/document.xml", replaceDocumentBody(documentXml, reportBodyXml(data)));

  return zip.generateAsync({
    type: "nodebuffer",
    compression: "DEFLATE"
  });
}
