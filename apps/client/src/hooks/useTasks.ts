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

function updateTaskInProjectCache(projectId: string, updatedTask: Task) {
  if (!projectId) {
    return;
  }

  queryClient.setQueryData<Project>(["projects", projectId], (currentProject) => {
    if (!currentProject?.disciplines) {
      return currentProject;
    }

    return {
      ...currentProject,
      disciplines: currentProject.disciplines.map((discipline) => ({
        ...discipline,
        tasks: discipline.tasks?.map((task) => (task.id === updatedTask.id ? mergeTask(task, updatedTask) : task))
      }))
    };
  });

  queryClient.setQueryData<Task[]>(["disciplines", updatedTask.disciplineId, "tasks"], (currentTasks) =>
    currentTasks?.map((task) => (task.id === updatedTask.id ? mergeTask(task, updatedTask) : task))
  );
}

export function useTasks(disciplineId: string | undefined) {
  return useQuery({
    queryKey: ["disciplines", disciplineId, "tasks"],
    enabled: Boolean(disciplineId),
    queryFn: async () => {
      const response = await api.get<TasksResponse>(`/disciplines/${disciplineId}/tasks`);
      return response.data.tasks;
    }
  });
}

export function useCreateTask(projectId: string, disciplineId: string) {
  return useMutation({
    mutationFn: async (payload: CreateTaskRequest) => {
      const response = await api.post<TaskResponse>(`/disciplines/${disciplineId}/tasks`, payload);
      return response.data.task;
    },
    onMutate: async (payload) => {
      await queryClient.cancelQueries({ queryKey: ["projects", projectId] });

      const previousProject = queryClient.getQueryData<Project>(["projects", projectId]);
      const optimisticTask: Task = {
        id: `optimistic-${Date.now()}`,
        disciplineId,
        title: payload.title,
        description: payload.description ?? null,
        status: payload.status ?? TaskStatusValue.BACKLOG,
        priority: payload.priority ?? Priority.MEDIUM,
        assigneeId: payload.assigneeId ?? null,
        creatorId: "",
        startDate: payload.startDate ?? null,
        dueDate: payload.dueDate ?? null,
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
            discipline.id === disciplineId
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
            discipline.id === disciplineId
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
      await queryClient.invalidateQueries({ queryKey: ["disciplines", disciplineId, "tasks"] });
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
