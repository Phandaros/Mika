import type { Project, User } from "shared";

export type MentionEntityType = "user" | "task" | "project";

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

function sectionsOf(project: Project) {
  return project.sections ?? project.disciplines ?? [];
}

function normalizeQuery(query: string): string {
  return query.trim().toLowerCase();
}

function matchesQuery(value: string, query: string): boolean {
  if (!query) {
    return true;
  }

  return value.toLowerCase().includes(query);
}

export function buildMentionMarkdown(item: Pick<MentionSuggestionItem, "id" | "label" | "type">): string {
  const safeLabel = item.label.replace(/[\[\]]/g, "");
  return `@[${safeLabel}](mk://${item.type}/${item.id})`;
}

export function parseMentionHref(href: string): { type: MentionEntityType; id: string } | null {
  const match = /^mk:\/\/(user|task|project)\/([^/?#]+)$/.exec(href);

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
  projects: Project[]
): MentionSuggestionItem[] {
  const normalizedQuery = normalizeQuery(query);
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
      if (b.affinity !== a.affinity) {
        return b.affinity - a.affinity;
      }

      return a.label.localeCompare(b.label, "pt-BR");
    })
    .slice(0, 12);
}
