import type { Project, UpdateProjectRequest } from "shared";
import { queryClient } from "./queryClient";

export interface ProjectMutationContext {
  previousProjects: Project[] | undefined;
  previousProject: Project | undefined;
}

export function findCachedProject(projectId: string): Project | undefined {
  const projectById = queryClient.getQueryData<Project>(["projects", projectId]);
  if (projectById) {
    return projectById;
  }

  const projects = queryClient.getQueryData<Project[]>(["projects"]);
  return projects?.find((project) => project.id === projectId);
}

export function patchProjectForOptimisticUpdate(project: Project, payload: UpdateProjectRequest): Project {
  // Preserve updatedAt during optimistic patch so list sort (e.g. updatedAt-desc) stays stable
  // until the server reconciles with the real timestamp in onSuccess.
  const nextProject: Project = { ...project };

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
    sections: incoming.sections ?? current.sections
  };
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
}

export function restoreProjectCaches(context: ProjectMutationContext | undefined) {
  queryClient.setQueryData(["projects"], context?.previousProjects);

  if (context?.previousProject) {
    queryClient.setQueryData(["projects", context.previousProject.id], context.previousProject);
  }
}

export async function prepareProjectMutation(projectId: string): Promise<ProjectMutationContext> {
  await queryClient.cancelQueries({ queryKey: ["projects"] });
  await queryClient.cancelQueries({ queryKey: ["projects", projectId] });

  return {
    previousProjects: queryClient.getQueryData<Project[]>(["projects"]),
    previousProject: queryClient.getQueryData<Project>(["projects", projectId]) ?? findCachedProject(projectId)
  };
}

export function applyOptimisticProjectPatch(projectId: string, payload: UpdateProjectRequest) {
  const currentProject = findCachedProject(projectId);
  if (!currentProject) {
    return;
  }

  updateProjectInCaches(projectId, patchProjectForOptimisticUpdate(currentProject, payload));
}
