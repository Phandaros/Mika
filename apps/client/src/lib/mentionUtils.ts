import type { Project, User } from "shared";

export type MentionProject = Pick<Project, "id" | "name"> & {
  sections?: Array<{ name: string; tasks?: Array<{ id: string; title: string }> }>;
  disciplines?: Array<{ name: string; tasks?: Array<{ id: string; title: string }> }>;
};

export type MentionMeetingMinute = {
  id: string;
  projectId: string;
  title: string;
  meetingDate?: string;
};

export type MentionSearchTask = {
  id: string;
  title: string;
  projectId: string;
  projectName: string;
  sectionName: string;
};

export type MentionEntityType = "user" | "task" | "project" | "meeting-minute";

export interface MentionSuggestionItem {
  id: string;
  label: string;
  type: MentionEntityType;
  subtitle?: string;
  affinity: number;
}

export interface MentionContext {
  projectId: string;
  taskId: string;
}

function sectionsOf(project: MentionProject) {
  return project.sections ?? project.disciplines ?? [];
}

const TYPE_ORDER: Record<MentionEntityType, number> = {
  user: 0,
  project: 1,
  task: 2,
  "meeting-minute": 3
};

const MARKDOWN_MENTION_PATTERN = /(^|[^!])@?\[([^\]]+)\]\(mk:\/\/(user|task|project|meeting-minute)\/([^)]+)\)/g;
const TIPTAP_MENTION_PATTERN = /\[@\s+([^\]]*)\]/g;

function normalizeSearchText(value: string): string {
  return value
    .normalize("NFD")
    .replace(/[\u0300-\u036f]/g, "")
    .toLowerCase()
    .replace(/[[\]]/g, "")
    .replace(/[^\p{L}\p{N}]+/gu, " ")
    .replace(/\s+/g, " ")
    .trim();
}

function matchesQuery(value: string, query: string): boolean {
  if (!query) {
    return true;
  }

  return normalizeSearchText(value).includes(normalizeSearchText(query));
}

export function buildMentionMarkdown(item: Pick<MentionSuggestionItem, "id" | "label" | "type">): string {
  const safeLabel = item.label.replace(/[[\]]/g, "");
  return `@[${safeLabel}](mk://${item.type}/${item.id})`;
}

function escapeMentionAttribute(value: string): string {
  return value.replace(/&/g, "&amp;").replace(/"/g, "&quot;");
}

function unescapeMentionAttribute(value: string): string {
  return value.replace(/&quot;/g, '"').replace(/&amp;/g, "&");
}

function parseMentionAttributes(value: string): Record<string, string> {
  const attrs: Record<string, string> = {};
  const pattern = /(\w+)=(?:"([^"]*)"|'([^']*)')/g;
  let match = pattern.exec(value);

  while (match) {
    const key = match[1];
    if (key) {
      attrs[key] = unescapeMentionAttribute(match[2] ?? match[3] ?? "");
    }
    match = pattern.exec(value);
  }

  return attrs;
}

export function markdownMentionsToEditorContent(content: string): string {
  return content.replace(MARKDOWN_MENTION_PATTERN, (_match, prefix: string, label: string, type: MentionEntityType, id: string) => {
    const entityId = `${type}/${id}`;
    return `${prefix}[@ id="${escapeMentionAttribute(entityId)}" label="${escapeMentionAttribute(label)}"]`;
  });
}

export function editorMentionsToMarkdown(content: string): string {
  return content.replace(TIPTAP_MENTION_PATTERN, (match, attrString: string) => {
    const attrs = parseMentionAttributes(attrString);
    const idParts = attrs.id?.split("/");
    const type = idParts?.[0] as MentionEntityType | undefined;
    const id = idParts?.slice(1).join("/");

    if (!type || !id || !["user", "task", "project", "meeting-minute"].includes(type)) {
      return match;
    }

    return buildMentionMarkdown({
      id,
      label: attrs.label ?? id,
      type
    });
  });
}

/** Removes the saved @ marker before ReactMarkdown so MentionLink renders exactly one visual @. */
export function normalizeMentionContentForRender(content: string): string {
  return content.replace(MARKDOWN_MENTION_PATTERN, (_match, prefix: string, label: string, type: MentionEntityType, id: string) => {
    return `${prefix}[${label}](mk://${type}/${id})`;
  });
}

export function parseMentionHref(href: string): { type: MentionEntityType; id: string } | null {
  const match = /^mk:\/\/(user|task|project|meeting-minute)\/([^/?#]+)$/.exec(href);

  if (!match) {
    return null;
  }

  const id = match[2];

  if (!id) {
    return null;
  }

  return {
    type: match[1] as MentionEntityType,
    id
  };
}

export function buildMentionSuggestions(
  query: string,
  context: MentionContext,
  users: User[],
  projects: MentionProject[],
  meetingMinutes: MentionMeetingMinute[] = [],
  searchTasks: MentionSearchTask[] = []
): MentionSuggestionItem[] {
  const normalizedQuery = query.trim();
  const items: MentionSuggestionItem[] = [];

  for (const user of users) {
    if (!matchesQuery(user.name, normalizedQuery)) {
      continue;
    }

    items.push({
      id: user.id,
      label: user.name,
      type: "user",
      subtitle: user.email ?? undefined,
      affinity: 0
    });
  }

  for (const project of projects) {
    if (matchesQuery(project.name, normalizedQuery)) {
      items.push({
        id: project.id,
        label: project.name,
        type: "project",
        subtitle: "Projeto",
        affinity: project.id === context.projectId ? 2 : 0
      });
    }

    const sections = sectionsOf(project) as Array<{
      name: string;
      tasks?: Array<{ id: string; title: string }>;
    }>;

    for (const section of sections) {
      for (const task of section.tasks ?? []) {
        if (!matchesQuery(task.title, normalizedQuery)) {
          continue;
        }

        const sameProject = project.id === context.projectId;
        items.push({
          id: task.id,
          label: task.title,
          type: "task",
          subtitle: `${project.name} · ${section.name}`,
          affinity: sameProject ? 3 : 1
        });
      }
    }
  }

  for (const task of searchTasks) {
    if (!matchesQuery(task.title, normalizedQuery)) {
      continue;
    }

    const sameProject = task.projectId === context.projectId;
    items.push({
      id: task.id,
      label: task.title,
      type: "task",
      subtitle: `${task.projectName} · ${task.sectionName}`,
      affinity: sameProject ? 3 : 1
    });
  }

  for (const minute of meetingMinutes) {
    if (minute.projectId !== context.projectId || !matchesQuery(minute.title, normalizedQuery)) {
      continue;
    }

    items.push({
      id: minute.id,
      label: minute.title,
      type: "meeting-minute",
      subtitle: minute.meetingDate ? `Ata de reunião · ${minute.meetingDate.slice(0, 10)}` : "Ata de reunião",
      affinity: 4
    });
  }

  const deduped = new Map<string, MentionSuggestionItem>();

  for (const item of items) {
    const key = `${item.type}:${item.id}`;
    const existing = deduped.get(key);

    if (!existing || item.affinity > existing.affinity) {
      deduped.set(key, item);
    }
  }

  return [...deduped.values()]
    .sort((a, b) => {
      const typeDiff = TYPE_ORDER[a.type] - TYPE_ORDER[b.type];

      if (typeDiff !== 0) {
        return typeDiff;
      }

      if (b.affinity !== a.affinity) {
        return b.affinity - a.affinity;
      }

      return a.label.localeCompare(b.label, "pt-BR");
    })
    .slice(0, 12);
}
