import { useMutation, useQuery } from "@tanstack/react-query";
import { Priority, TaskStatus as TaskStatusValue } from "shared";
import type {
  CreateTaskRequest,
  Project,
  Task,
  TaskStatus,
  UpdateTaskRequest
} from "shared";
import { api } from "../lib/api";
import { queryClient } from "../lib/queryClient";

interface TasksResponse {
  tasks: Task[];
}

interface TaskResponse {
  task: Task;
}

function mergeTask(currentTask: Task, updatedTask: Task): Task {
  return {
    ...currentTask,
    ...updatedTask,
    discipline: updatedTask.discipline ?? currentTask.discipline,
    comments: updatedTask.comments ?? currentTask.comments
  };
}

function mapDisciplinesWithUpdatedTask(
  disciplines: Project["disciplines"] | Project["sections"] | undefined,
  updatedTask: Task
) {
  if (!disciplines) {
    return undefined;
  }

  return disciplines.map((discipline) => ({
    ...discipline,
    tasks: discipline.tasks?.map((task) => (task.id === updatedTask.id ? mergeTask(task, updatedTask) : task))
  }));
}

function patchProjectWithUpdatedTask(project: Project, updatedTask: Task): Project {
  return {
    ...project,
    disciplines: mapDisciplinesWithUpdatedTask(project.disciplines, updatedTask) ?? project.disciplines,
    sections: mapDisciplinesWithUpdatedTask(project.sections, updatedTask) ?? project.sections
  };
}

function updateProjectsListCache(updatedTask: Task) {
  queryClient.setQueryData<Project[]>(["projects"], (projects) => {
    if (!projects) {
      return projects;
    }

    return projects.map((project) => {
      const inProject = [project.disciplines, project.sections].some((arr) =>
        arr?.some((discipline) => discipline.tasks?.some((task) => task.id === updatedTask.id))
      );

      return inProject ? patchProjectWithUpdatedTask(project, updatedTask) : project;
    });
  });
}

function updateTaskInProjectCache(projectId: string, updatedTask: Task) {
  const resolvedProjectId = projectId || updatedTask.discipline?.projectId;

  updateProjectsListCache(updatedTask);

  if (resolvedProjectId) {
    queryClient.setQueryData<Project>(["projects", resolvedProjectId], (currentProject) => {
      if (!currentProject) {
        return currentProject;
      }

      return patchProjectWithUpdatedTask(currentProject, updatedTask);
    });
  }

  queryClient.setQueryData<Task[]>(["sections", updatedTask.disciplineId, "tasks"], (currentTasks) =>
    currentTasks?.map((task) => (task.id === updatedTask.id ? mergeTask(task, updatedTask) : task))
  );
}

export function useTasks(sectionId: string | undefined) {
  return useQuery({
    queryKey: ["sections", sectionId, "tasks"],
    enabled: Boolean(sectionId),
    queryFn: async () => {
      const response = await api.get<TasksResponse>(`/sections/${sectionId}/tasks`);
      return response.data.tasks;
    }
  });
}

export function useCreateTask(projectId: string, sectionId: string) {
  return useMutation({
    mutationFn: async (payload: CreateTaskRequest) => {
      const response = await api.post<TaskResponse>(`/sections/${sectionId}/tasks`, payload);
      return response.data.task;
    },
    onMutate: async (payload) => {
      await queryClient.cancelQueries({ queryKey: ["projects", projectId] });

      const previousProject = queryClient.getQueryData<Project>(["projects", projectId]);
      const optimisticTask: Task = {
        id: `optimistic-${Date.now()}`,
        disciplineId: sectionId,
        title: payload.title,
        description: payload.description ?? null,
        status: payload.status ?? TaskStatusValue.BACKLOG,
        priority: payload.priority ?? Priority.MEDIUM,
        assigneeId: payload.assigneeId ?? null,
        creatorId: "",
        startDate: payload.startDate ?? null,
        dueDate: payload.dueDate ?? null,
        completed: payload.completed ?? false,
        completedAt: null,
        createdAt: new Date().toISOString(),
        updatedAt: new Date().toISOString(),
        assignee: null
      };

      queryClient.setQueryData<Project>(["projects", projectId], (currentProject) => {
        if (!currentProject) {
          return currentProject;
        }

        return {
          ...currentProject,
          disciplines: currentProject.disciplines?.map((discipline) =>
            discipline.id === sectionId
              ? { ...discipline, tasks: [optimisticTask, ...(discipline.tasks ?? [])] }
              : discipline
          )
        };
      });

      return { previousProject, optimisticTaskId: optimisticTask.id };
    },
    onError: (_error, _payload, context) => {
      if (context?.previousProject) {
        queryClient.setQueryData(["projects", projectId], context.previousProject);
      }
    },
    onSuccess: (createdTask, _payload, context) => {
      queryClient.setQueryData<Project>(["projects", projectId], (currentProject) => {
        if (!currentProject) {
          return currentProject;
        }

        return {
          ...currentProject,
          disciplines: currentProject.disciplines?.map((discipline) =>
            discipline.id === sectionId
              ? {
                  ...discipline,
                  tasks: (discipline.tasks ?? []).map((task) =>
                    task.id === context?.optimisticTaskId ? createdTask : task
                  )
                }
              : discipline
          )
        };
      });
    },
    onSettled: async () => {
      await queryClient.invalidateQueries({ queryKey: ["projects", projectId] });
      await queryClient.invalidateQueries({ queryKey: ["sections", sectionId, "tasks"] });
    }
  });
}

export function useUpdateTask(projectId: string) {
  return useMutation({
    mutationFn: async ({ id, payload }: { id: string; payload: UpdateTaskRequest }) => {
      const response = await api.patch<TaskResponse>(`/tasks/${id}`, payload);
      return response.data.task;
    },
    onSuccess: (updatedTask) => {
      updateTaskInProjectCache(projectId, updatedTask);
    },
    onSettled: async () => {
      if (!projectId) {
        await queryClient.invalidateQueries({ queryKey: ["projects"] });
      }
    }
  });
}

export function useUpdateTaskStatus(projectId: string) {
  return useMutation({
    mutationFn: async ({ id, status }: { id: string; status: TaskStatus }) => {
      const response = await api.patch<TaskResponse>(`/tasks/${id}/status`, { status });
      return response.data.task;
    },
    onSuccess: (updatedTask) => {
      updateTaskInProjectCache(projectId, updatedTask);
    }
  });
}

export function useUpdateTaskCompletion(projectId: string) {
  return useMutation({
    mutationFn: async ({ id, completed }: { id: string; completed: boolean }) => {
      const response = await api.patch<TaskResponse>(`/tasks/${id}/completed`, { completed });
      return response.data.task;
    },
    onSuccess: (updatedTask) => {
      updateTaskInProjectCache(projectId, updatedTask);
    }
  });
}
