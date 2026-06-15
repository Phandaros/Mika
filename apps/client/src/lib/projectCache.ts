import type { InfiniteData } from "@tanstack/react-query";
import type { PortfolioProjectsResponse, Project, ProjectCustomFieldValue, UpdateProjectRequest } from "shared";
import { queryClient } from "./queryClient";
import { applyDerivedPortfolioFieldsLocally, applyProjectCustomFieldPatchesLocally } from "./portfolioFields";

export interface ProjectMutationContext {
  previousProjects: Project[] | undefined;
  previousProject: Project | undefined;
  previousPortfolioPages: Array<[readonly unknown[], InfiniteData<PortfolioProjectsResponse> | undefined]>;
}

function customFieldValueKey(field: ProjectCustomFieldValue): string | null {
  if (field.customFieldGid) {
    return `gid:${field.customFieldGid}`;
  }

  if (field.mikaKey) {
    return `mika:${field.mikaKey}`;
  }

  const label = field.customFieldName ?? field.mikaLabel;
  if (label) {
    return `label:${label.normalize("NFD").replace(/[\u0300-\u036f]/g, "").replace(/\s+/g, " ").trim().toLowerCase()}`;
  }

  if (field.id && !field.id.startsWith("pending:")) {
    return `id:${field.id}`;
  }

  return field.id ?? null;
}

function mergeCustomFieldValues(
  current: ProjectCustomFieldValue[] | undefined,
  incoming: ProjectCustomFieldValue[] | undefined
): ProjectCustomFieldValue[] {
  if (!incoming?.length) {
    return current ?? [];
  }

  const merged = new Map<string, ProjectCustomFieldValue>();
  for (const field of current ?? []) {
    const key = customFieldValueKey(field);
    if (key) {
      merged.set(key, field);
    }
  }

  for (const field of incoming) {
    const key = customFieldValueKey(field);
    if (key) {
      merged.set(key, field);
    }
  }

  return Array.from(merged.values());
}

export function findCachedProject(projectId: string): Project | undefined {
  const projectById = queryClient.getQueryData<Project>(["projects", projectId]);
  if (projectById) {
    return projectById;
  }

  const projects = queryClient.getQueryData<Project[]>(["projects"]);
  const fromList = projects?.find((project) => project.id === projectId);
  if (fromList) {
    return fromList;
  }

  const portfolioQueries = queryClient.getQueriesData<InfiniteData<PortfolioProjectsResponse>>({
    queryKey: ["projects", "portfolio"]
  });

  for (const [, data] of portfolioQueries) {
    if (!isPortfolioInfiniteData(data)) {
      continue;
    }

    const match = data.pages.flatMap((page) => page.projects ?? []).find((project) => project.id === projectId);
    if (match) {
      return match;
    }
  }

  return undefined;
}

export function patchProjectForOptimisticUpdate(project: Project, payload: UpdateProjectRequest): Project {
  // Preserve updatedAt during optimistic patch so list sort (e.g. updatedAt-desc) stays stable
  // until the server reconciles with the real timestamp in onSuccess.
  let nextProject: Project = { ...project };

  if (payload.name !== undefined) {
    nextProject.name = payload.name;
  }

  if (payload.description !== undefined) {
    nextProject.description = payload.description;
  }

  if (payload.platform !== undefined) {
    nextProject.platform = payload.platform;
  }

  if (payload.areaM2 !== undefined) {
    nextProject.areaM2 = payload.areaM2;
  }

  if (payload.status !== undefined) {
    nextProject.status = payload.status;
  }

  if (payload.startDate !== undefined) {
    nextProject.startDate = payload.startDate;
  }

  if (payload.endDate !== undefined) {
    nextProject.endDate = payload.endDate;
  }

  if (payload.builder !== undefined) {
    nextProject.builder = payload.builder;
    nextProject.client = payload.client ?? payload.builder;
  } else if (payload.client !== undefined) {
    nextProject.client = payload.client;
  }

  if (payload.customFieldValues?.length) {
    nextProject = applyProjectCustomFieldPatchesLocally(nextProject, payload.customFieldValues);
  }

  if (payload.areaM2 !== undefined) {
    nextProject = applyDerivedPortfolioFieldsLocally(nextProject);
  }

  return nextProject;
}

function mergeProjectSnapshot(current: Project | undefined, incoming: Project): Project {
  if (!current) {
    return incoming;
  }

  return {
    ...current,
    ...incoming,
    disciplines: incoming.disciplines ?? current.disciplines,
    sections: incoming.sections ?? current.sections,
    customFields: incoming.customFields?.length ? incoming.customFields : current.customFields,
    customFieldValues: mergeCustomFieldValues(current.customFieldValues, incoming.customFieldValues)
  };
}

function isPortfolioInfiniteData(data: unknown): data is InfiniteData<PortfolioProjectsResponse> {
  return (
    typeof data === "object" &&
    data !== null &&
    "pages" in data &&
    Array.isArray((data as InfiniteData<PortfolioProjectsResponse>).pages)
  );
}

function updatePortfolioInfiniteCaches(projectId: string, updatedProject: Project) {
  const portfolioQueries = queryClient.getQueriesData({
    queryKey: ["projects", "portfolio"]
  });

  for (const [queryKey, data] of portfolioQueries) {
    if (!isPortfolioInfiniteData(data)) {
      continue;
    }

    queryClient.setQueryData<InfiniteData<PortfolioProjectsResponse>>(queryKey, {
      ...data,
      pages: data.pages.map((page) => ({
        ...page,
        projects: (page.projects ?? []).map((project) =>
          project.id === projectId ? mergeProjectSnapshot(project, updatedProject) : project
        )
      }))
    });
  }
}

export function updateProjectInCaches(projectId: string, updatedProject: Project) {
  queryClient.setQueryData<Project[]>(["projects"], (projects) => {
    if (!projects) {
      return projects;
    }

    return projects.map((project) =>
      project.id === projectId ? mergeProjectSnapshot(project, updatedProject) : project
    );
  });

  queryClient.setQueryData<Project>(["projects", projectId], (currentProject) =>
    currentProject ? mergeProjectSnapshot(currentProject, updatedProject) : updatedProject
  );

  updatePortfolioInfiniteCaches(projectId, updatedProject);
}

export function restoreProjectCaches(context: ProjectMutationContext | undefined) {
  queryClient.setQueryData(["projects"], context?.previousProjects);

  if (context?.previousProject) {
    queryClient.setQueryData(["projects", context.previousProject.id], context.previousProject);
  }

  for (const [queryKey, previousData] of context?.previousPortfolioPages ?? []) {
    queryClient.setQueryData(queryKey, previousData);
  }
}

export async function prepareProjectMutation(projectId: string): Promise<ProjectMutationContext> {
  await Promise.all([
    queryClient.cancelQueries({ queryKey: ["projects"] }),
    queryClient.cancelQueries({ queryKey: ["projects", projectId] }),
    queryClient.cancelQueries({ queryKey: ["projects", "portfolio"] })
  ]);

  const portfolioQueries = queryClient.getQueriesData<InfiniteData<PortfolioProjectsResponse>>({
    queryKey: ["projects", "portfolio"]
  });

  return {
    previousProjects: queryClient.getQueryData<Project[]>(["projects"]),
    previousProject: queryClient.getQueryData<Project>(["projects", projectId]) ?? findCachedProject(projectId),
    previousPortfolioPages: portfolioQueries.map(([queryKey, data]) => [queryKey, data] as const)
  };
}

export async function runOptimisticProjectMutation(
  projectId: string,
  payload: UpdateProjectRequest
): Promise<ProjectMutationContext> {
  try {
    const context = await prepareProjectMutation(projectId);
    try {
      applyOptimisticProjectPatch(projectId, payload);
    } catch (error) {
      console.error("[projectCache] Falha ao aplicar patch otimista do projeto", error);
    }
    return context;
  } catch (error) {
    console.error("[projectCache] Falha ao preparar mutação do projeto", error);
    return {
      previousProjects: queryClient.getQueryData<Project[]>(["projects"]),
      previousProject: findCachedProject(projectId),
      previousPortfolioPages: []
    };
  }
}

export function applyOptimisticProjectPatch(projectId: string, payload: UpdateProjectRequest) {
  const currentProject = findCachedProject(projectId);
  if (!currentProject) {
    return;
  }

  updateProjectInCaches(projectId, patchProjectForOptimisticUpdate(currentProject, payload));
}
