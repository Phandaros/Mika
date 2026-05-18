import { randomUUID } from "node:crypto";
import type { Prisma } from "../generated/prisma/client.js";
import { DisciplineStatus, DisciplineType, Priority, ProjectStatus, TaskStatus } from "./enums.js";

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
      section: true,
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
type MembershipRecord = ProjectRecord["memberships"][number];

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

export function normalizeStatus(task: Pick<TaskRecord, "completed" | "localStatus" | "assigneeStatus">): string {
  if (task.localStatus && Object.values(TaskStatus).includes(task.localStatus as (typeof TaskStatus)[keyof typeof TaskStatus])) {
    return task.localStatus;
  }

  if (task.assigneeStatus === "upcoming") {
    return TaskStatus.TODO;
  }

  if (task.assigneeStatus === "later") {
    return TaskStatus.BACKLOG;
  }

  return TaskStatus.TODO;
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

export function toTaskDto(
  task: TaskRecord,
  fallbackSection?: { id: string; name: string; projectId: string; projectName?: string | null }
) {
  const membership = task.memberships[0];
  const section = membership?.section;
  const project = membership?.project;
  const disciplineId = fallbackSection?.id ?? section?.id ?? "uncategorized";
  const disciplineName = fallbackSection?.name ?? section?.name ?? membership?.sectionName ?? "Sem secao";
  const projectId = fallbackSection?.projectId ?? project?.id ?? membership?.projectGid ?? "";
  const projectName =
    fallbackSection?.projectName != null && fallbackSection.projectName !== ""
      ? fallbackSection.projectName
      : project && "name" in project && typeof (project as { name?: string }).name === "string"
        ? (project as { name: string }).name
        : undefined;

  return {
    id: task.id,
    asanaGid: task.asanaGid,
    disciplineId,
    title: task.name,
    description: task.notes,
    htmlDescription: task.htmlNotes,
    status: normalizeStatus(task),
    priority: normalizePriority(task.priority),
    assigneeId: task.assignee?.id ?? null,
    assigneeGid: task.assigneeGid,
    creatorId: "",
    startDate: dateOnlyString(task.startOn),
    dueDate: dateOnlyString(task.dueOn) ?? dateOnlyFromDate(task.dueAt),
    estimatedDays: task.estimatedDays ?? null,
    completed: task.completed,
    completedAt: task.completedAtAsana,
    createdAt: task.asanaCreatedAt ?? task.createdAt,
    updatedAt: task.asanaModifiedAt ?? task.updatedAt,
    assignee: toPublicUser(task.assignee),
    creator: undefined,
    comments: [],
    customFieldValues: task.customFieldValues.map((row) => ({
      id: row.id,
      customFieldName: row.customFieldName ?? row.customField?.name ?? null,
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
    })),
    tags: task.tags.map((item) => item.tag),
    discipline: {
      id: disciplineId,
      name: disciplineName,
      projectId,
      type: DisciplineType.OTHER,
      ...(projectName ? { projectName } : {})
    }
  };
}

export function toDisciplineDto(section: SectionRecord, projectId: string) {
  const tasks = section.memberships
    .filter((membership) => !membership.task.parentId)
    .map((membership) =>
      toTaskDto(membership.task, {
        id: section.id,
        name: section.name,
        projectId
      })
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

export function toProjectDto(project: ProjectRecord) {
  const disciplines = project.sections.map((section) => toDisciplineDto(section, project.id));
  const sectionIds = new Set(project.sections.map((section) => section.id));
  const looseMemberships = project.memberships.filter(
    (membership): membership is MembershipRecord & { task: TaskRecord } =>
      Boolean(membership.task) && (!membership.section || !sectionIds.has(membership.section.id))
  );

  if (looseMemberships.length > 0) {
    disciplines.push({
      id: `project-${project.id}-uncategorized`,
      asanaGid: `local:section:uncategorized:${project.id}`,
      projectId: project.id,
      name: "Sem secao",
      type: DisciplineType.OTHER,
      status: DisciplineStatus.IN_PROGRESS,
      responsibleId: null,
      createdAt: project.createdAt,
      updatedAt: project.updatedAt,
      responsible: null,
      tasks: looseMemberships.map((membership) =>
        toTaskDto(membership.task, {
          id: `project-${project.id}-uncategorized`,
          name: "Sem secao",
          projectId: project.id
        })
      )
    });
  }

  return {
    id: project.id,
    asanaGid: project.asanaGid,
    name: project.name,
    description: project.notes ?? project.currentStatusText,
    htmlDescription: project.htmlNotes,
    client: project.team?.name ?? project.workspace.name,
    platform: null,
    builder: project.team?.name ?? null,
    areaM2: null,
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
      enumOptions: setting.customField.enumOptions.map((option) => ({
        id: option.id,
        asanaGid: option.asanaGid,
        name: option.name,
        color: option.color,
        enabled: option.enabled
      }))
    })),
    createdAt: project.asanaCreatedAt ?? project.createdAt,
    updatedAt: project.asanaModifiedAt ?? project.updatedAt,
    disciplines,
    sections: disciplines
  };
}
