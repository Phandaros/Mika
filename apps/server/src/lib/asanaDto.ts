import { randomUUID } from "node:crypto";
import type { Prisma } from "../generated/prisma/client.js";
import { DisciplineStatus, DisciplineType, Priority, ProjectStatus } from "./enums.js";
import { publicTaskStatus } from "./taskStatus.js";

export const userSelect = {
  id: true,
  asanaGid: true,
  name: true,
  email: true,
  role: true,
  isActive: true,
  photo21x21: true,
  photo27x27: true,
  photo36x36: true,
  photo60x60: true,
  photo128x128: true,
  photoOriginal: true,
  createdAt: true,
  updatedAt: true
} satisfies Prisma.UserSelect;

export const taskInclude = {
  assignee: { select: userSelect },
  memberships: {
    include: {
      section: {
        include: {
          project: true
        }
      },
      project: true
    }
  },
  customFieldValues: {
    include: {
      customField: {
        include: {
          enumOptions: {
            where: { enabled: true },
            orderBy: [{ sortOrder: "asc" as const }, { name: "asc" as const }]
          }
        }
      },
      enumOption: true
    }
  },
  tags: {
    include: {
      tag: true
    }
  }
} satisfies Prisma.TaskInclude;

export const taskCustomFieldCatalogInclude = {
  enumOptions: {
    where: { enabled: true },
    orderBy: [{ sortOrder: "asc" as const }, { name: "asc" as const }]
  }
} satisfies Prisma.AsanaCustomFieldInclude;

export const projectInclude = {
  owner: { select: userSelect },
  team: true,
  workspace: true,
  sections: {
    include: {
      memberships: {
        include: {
          task: {
            include: taskInclude
          }
        }
      }
    },
    orderBy: { name: "asc" as const }
  },
  memberships: {
    include: {
      section: true,
      task: {
        include: taskInclude
      }
    }
  },
  customFieldSettings: {
    include: {
      customField: {
        include: {
          enumOptions: {
            orderBy: [{ sortOrder: "asc" as const }, { name: "asc" as const }]
          }
        }
      }
    },
    orderBy: { isImportant: "desc" as const }
  }
} satisfies Prisma.ProjectInclude;

type UserRecord = Prisma.UserGetPayload<{ select: typeof userSelect }>;
type TaskRecord = Prisma.TaskGetPayload<{ include: typeof taskInclude }>;
type ProjectRecord = Prisma.ProjectGetPayload<{ include: typeof projectInclude }>;
type SectionRecord = ProjectRecord["sections"][number];
export type TaskCustomFieldCatalog = Prisma.AsanaCustomFieldGetPayload<{ include: typeof taskCustomFieldCatalogInclude }>[];

function taskCustomFieldSortValue(field: Pick<TaskCustomFieldCatalog[number], "mikaSortOrder" | "name">): string {
  return `${String(field.mikaSortOrder ?? 9999).padStart(4, "0")}:${field.name.toLowerCase()}`;
}

export function sortTaskCustomFieldCatalog(catalog: TaskCustomFieldCatalog): TaskCustomFieldCatalog {
  return [...catalog].sort((a, b) => taskCustomFieldSortValue(a).localeCompare(taskCustomFieldSortValue(b)));
}

function normalizeEnumOptionName(name: string): string {
  return name.normalize("NFD").replace(/[\u0300-\u036f]/g, "").toLowerCase().trim();
}

function enumOptionDedupeKey(mikaKey: string | null, name: string): string {
  const normalized = normalizeEnumOptionName(name);
  if (mikaKey === "status" && normalized.startsWith("finalizad")) {
    return "finalizado";
  }

  return normalized;
}

function isPreferredEnumOption(candidateName: string, currentName: string): boolean {
  return normalizeEnumOptionName(candidateName) === "finalizado" && normalizeEnumOptionName(currentName) === "finalizada";
}

function dedupeEnumOptions(fields: TaskCustomFieldCatalog) {
  const options = new Map<string, { id: string; name: string; color: string | null }>();

  for (const field of fields) {
    for (const option of field.enumOptions) {
      const key = enumOptionDedupeKey(field.mikaKey, option.name);
      const current = options.get(key);
      if (!current || isPreferredEnumOption(option.name, current.name)) {
        options.set(key, { id: option.id, name: option.name, color: option.color });
      }
    }
  }

  return Array.from(options.values());
}

export function toTaskCustomFieldDefinitionDtos(catalog: TaskCustomFieldCatalog) {
  const byKey = new Map<string, TaskCustomFieldCatalog>();

  for (const field of sortTaskCustomFieldCatalog(catalog).filter((item) => item.mikaTaskField && item.mikaKey)) {
    const key = field.mikaKey;
    if (!key) {
      continue;
    }

    byKey.set(key, [...(byKey.get(key) ?? []), field]);
  }

  return Array.from(byKey.entries()).map(([mikaKey, fields]) => {
    const primary = fields[0];
    return {
      id: primary?.id ?? mikaKey,
      asanaGid: primary?.asanaGid ?? mikaKey,
      isImportant: true,
      name: primary?.mikaLabel ?? primary?.name ?? mikaKey,
      description: primary?.description ?? null,
      type: primary?.type ?? "text",
      mikaKey,
      mikaLabel: primary?.mikaLabel ?? primary?.name ?? mikaKey,
      mikaSortOrder: primary?.mikaSortOrder ?? null,
      mikaTaskField: true,
      mikaListVisible: primary?.mikaListVisible ?? true,
      mikaDetailVisible: primary?.mikaDetailVisible ?? true,
      enumOptions: dedupeEnumOptions(fields).map((option) => ({
        id: option.id,
        asanaGid: option.id,
        name: option.name,
        color: option.color,
        enabled: true
      }))
    };
  });
}

export function makeLocalAsanaGid(prefix: string): string {
  return `local:${prefix}:${randomUUID()}`;
}

export function toPublicUser(user: UserRecord | null | undefined) {
  if (!user) {
    return null;
  }

  return {
    id: user.id,
    asanaGid: user.asanaGid,
    name: user.name,
    email: user.email,
    role: normalizeRole(user.role),
    avatarUrl: user.photo128x128 ?? user.photo60x60 ?? user.photo36x36 ?? user.photoOriginal,
    isActive: user.isActive,
    createdAt: user.createdAt,
    updatedAt: user.updatedAt
  };
}

export function normalizeRole(role: string): string {
  return ["ADMIN", "COORDINATOR", "DESIGNER", "INTERN"].includes(role) ? role : "DESIGNER";
}

export function normalizePriority(value: string | null | undefined): string {
  if (value && Object.values(Priority).includes(value as (typeof Priority)[keyof typeof Priority])) {
    return value;
  }

  return Priority.MEDIUM;
}

function dateOnlyString(value: string | null | undefined): string | null {
  return value ? value.slice(0, 10) : null;
}

function dateOnlyFromDate(value: Date | null | undefined): string | null {
  return value ? value.toISOString().slice(0, 10) : null;
}

function taskProjectDtos(task: TaskRecord) {
  const projects = new Map<string, {
    id: string;
    asanaGid: string;
    name: string;
    sectionId?: string;
    sectionName?: string;
  }>();

  for (const membership of task.memberships) {
    const project = membership.section?.project ?? membership.project;
    const asanaGid = project?.asanaGid ?? membership.projectGid;
    const name = project?.name ?? membership.projectName;

    if (!asanaGid || !name) {
      continue;
    }

    const current = projects.get(asanaGid);
    if (!current || (!current.sectionId && membership.section)) {
      projects.set(asanaGid, {
        id: project?.id ?? asanaGid,
        asanaGid,
        name,
        ...(membership.section
          ? {
              sectionId: membership.section.id,
              sectionName: membership.section.name
            }
          : membership.sectionName
            ? { sectionName: membership.sectionName }
            : {})
      });
    }
  }

  return [...projects.values()].sort((a, b) => a.name.localeCompare(b.name, "pt-BR"));
}

export function toTaskDto(
  task: TaskRecord,
  fallbackSection?: { id: string; name: string; projectId: string; projectName?: string | null },
  taskFieldCatalog?: TaskCustomFieldCatalog
) {
  const membership = task.memberships[0];
  const section = membership?.section;
  const project = section?.project ?? membership?.project;
  const disciplineId = fallbackSection?.id ?? section?.id ?? "";
  const disciplineName = fallbackSection?.name ?? section?.name ?? membership?.sectionName ?? "";
  const projectId = fallbackSection?.projectId ?? project?.id ?? membership?.projectGid ?? "";
  const projectName =
    fallbackSection?.projectName != null && fallbackSection.projectName !== ""
      ? fallbackSection.projectName
      : project && "name" in project && typeof (project as { name?: string }).name === "string"
        ? (project as { name: string }).name
        : undefined;

  const customFieldValues = taskFieldCatalog?.length
    ? taskCustomFieldsFromCatalog(task, taskFieldCatalog)
    : task.customFieldValues.map((row) => ({
        id: row.id,
        customFieldId: row.customFieldId,
        customFieldGid: row.customFieldGid,
        customFieldName: row.customFieldName ?? row.customField?.name ?? null,
        mikaKey: row.customField?.mikaKey ?? null,
        mikaLabel: row.customField?.mikaLabel ?? row.customField?.name ?? row.customFieldName ?? null,
        mikaSortOrder: row.customField?.mikaSortOrder ?? null,
        mikaListVisible: row.customField?.mikaListVisible ?? true,
        mikaDetailVisible: row.customField?.mikaDetailVisible ?? true,
        type: row.type,
        displayValue: row.displayValue,
        enumOptionName: row.enumOptionName ?? row.enumOption?.name ?? null,
        numberValue: row.numberValue,
        enumOptionColor: row.enumOptionColor ?? row.enumOption?.color ?? null,
        enumOptions: row.customField?.enumOptions?.map((option) => ({
          id: option.id,
          name: option.name,
          color: option.color
        }))
      }));

  return {
    id: task.id,
    asanaGid: task.asanaGid,
    disciplineId,
    title: task.name,
    description: task.notes,
    htmlDescription: task.htmlNotes,
    status: publicTaskStatus(task),
    priority: normalizePriority(task.priority),
    assigneeId: task.assignee?.id ?? null,
    assigneeGid: task.assigneeGid,
    creatorId: "",
    startDate: dateOnlyString(task.startOn),
    dueDate: dateOnlyString(task.dueOn) ?? dateOnlyFromDate(task.dueAt),
    estimatedDays: task.estimatedDays ?? null,
    platform: task.platform ?? null,
    taskDiscipline: task.discipline ?? null,
    estimatedTime: task.estimatedTime ?? null,
    maxDeadline: dateOnlyFromDate(task.maxDeadline),
    conclusionDays: task.conclusionDays ?? null,
    stage: task.stage ?? null,
    completed: task.completed,
    completedAt: task.completedAtAsana,
    createdAt: task.asanaCreatedAt ?? task.createdAt,
    updatedAt: task.asanaModifiedAt ?? task.updatedAt,
    assignee: toPublicUser(task.assignee),
    creator: undefined,
    comments: [],
    customFieldValues,
    tags: task.tags.map((item) => item.tag),
    projects: taskProjectDtos(task),
    discipline: {
      id: disciplineId,
      name: disciplineName,
      projectId,
      type: DisciplineType.OTHER,
      ...(projectName ? { projectName } : {})
    }
  };
}

function taskCustomFieldsFromCatalog(task: TaskRecord, catalog: TaskCustomFieldCatalog) {
  const sortedCatalog = sortTaskCustomFieldCatalog(catalog).filter((field) => field.mikaTaskField && field.mikaKey);
  const groups = new Map<string, TaskCustomFieldCatalog>();

  for (const field of sortedCatalog) {
    const key = field.mikaKey;
    if (!key) {
      continue;
    }

    groups.set(key, [...(groups.get(key) ?? []), field]);
  }

  return Array.from(groups.entries()).map(([mikaKey, fields]) => {
    const primary = fields[0];
    const fieldIds = new Set(fields.map((field) => field.id));
    const existingRows = task.customFieldValues.filter((row) => row.customFieldId && fieldIds.has(row.customFieldId));
    const row = existingRows.find((item) => item.displayValue || item.enumOptionName || item.numberValue != null) ?? existingRows[0] ?? null;
    const enumOptions = dedupeEnumOptions(fields);

    return {
      id: row?.id ?? `mika:${mikaKey}`,
      customFieldId: row?.customFieldId ?? primary?.id ?? null,
      customFieldGid: row?.customFieldGid ?? primary?.asanaGid ?? null,
      customFieldName: primary?.mikaLabel ?? primary?.name ?? row?.customFieldName ?? null,
      mikaKey,
      mikaLabel: primary?.mikaLabel ?? primary?.name ?? row?.customFieldName ?? null,
      mikaSortOrder: primary?.mikaSortOrder ?? null,
      mikaListVisible: primary?.mikaListVisible ?? true,
      mikaDetailVisible: primary?.mikaDetailVisible ?? true,
      type: row?.type ?? primary?.type,
      displayValue: row?.displayValue ?? null,
      enumOptionName: row?.enumOptionName ?? row?.enumOption?.name ?? null,
      numberValue: row?.numberValue ?? null,
      enumOptionColor: row?.enumOptionColor ?? row?.enumOption?.color ?? null,
      enumOptions
    };
  });
}

export function toDisciplineDto(section: SectionRecord, projectId: string, taskFieldCatalog?: TaskCustomFieldCatalog) {
  const tasks = section.memberships
    .filter((membership) => !membership.task.parentId)
    .map((membership) =>
      toTaskDto(membership.task, {
        id: section.id,
        name: section.name,
        projectId
      }, taskFieldCatalog)
    );

  return {
    id: section.id,
    asanaGid: section.asanaGid,
    projectId,
    name: section.name,
    type: DisciplineType.OTHER,
    status: tasks.some((task) => !task.completed) ? DisciplineStatus.IN_PROGRESS : DisciplineStatus.COMPLETED,
    responsibleId: null,
    createdAt: section.asanaCreatedAt ?? section.createdAt,
    updatedAt: section.updatedAt,
    responsible: null,
    tasks
  };
}

export function toProjectDto(project: ProjectRecord, taskFieldCatalog?: TaskCustomFieldCatalog) {
  const disciplines = project.sections.map((section) => toDisciplineDto(section, project.id, taskFieldCatalog));

  return {
    id: project.id,
    asanaGid: project.asanaGid,
    name: project.name,
    description: project.notes ?? project.currentStatusText,
    htmlDescription: project.htmlNotes,
    client: project.builder ?? project.team?.name ?? project.workspace.name,
    platform: project.platform,
    builder: project.builder ?? project.team?.name ?? null,
    areaM2: project.areaM2,
    status: project.archived ? ProjectStatus.COMPLETED : ProjectStatus.ACTIVE,
    startDate: project.startOn,
    endDate: project.dueOn ?? project.dueDate,
    permalinkUrl: project.permalinkUrl,
    color: project.color,
    defaultView: project.defaultView,
    owner: toPublicUser(project.owner),
    customFields: project.customFieldSettings.map((setting) => ({
      id: setting.id,
      asanaGid: setting.asanaGid,
      isImportant: setting.isImportant,
      name: setting.customField.name,
      description: setting.customField.description,
      type: setting.customField.type,
      mikaKey: setting.customField.mikaKey,
      mikaLabel: setting.customField.mikaLabel,
      mikaSortOrder: setting.customField.mikaSortOrder,
      mikaTaskField: setting.customField.mikaTaskField,
      mikaListVisible: setting.customField.mikaListVisible,
      mikaDetailVisible: setting.customField.mikaDetailVisible,
      enumOptions: setting.customField.enumOptions.map((option) => ({
        id: option.id,
        asanaGid: option.asanaGid,
        name: option.name,
        color: option.color,
        enabled: option.enabled
      }))
    })),
    taskCustomFields: taskFieldCatalog ? toTaskCustomFieldDefinitionDtos(taskFieldCatalog) : undefined,
    createdAt: project.asanaCreatedAt ?? project.createdAt,
    updatedAt: project.asanaModifiedAt ?? project.updatedAt,
    disciplines,
    sections: disciplines
  };
}
