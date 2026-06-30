import { useInfiniteQuery, useMutation, useQueries, useQuery, type InfiniteData, type QueryKey } from "@tanstack/react-query";
import { addMonths, endOfMonth, format, startOfMonth } from "date-fns";
import { Priority, TaskStatus as TaskStatusValue } from "shared";
import type {
  CreateTaskRequest,
  Project,
  Task,
  TaskReview,
  TaskStatus,
  UpdateTaskRequest
} from "shared";
import { api } from "../lib/api";
import { queryClient } from "../lib/queryClient";
import { invalidateTeamBoardQueries, teamBoardQueryPredicate } from "./useTeamBoard";

interface TasksResponse {
  tasks: Task[];
}

interface SprintTasksResponse {
  tasks: Task[];
  nextCursor: string | null;
}

interface SprintSummaryResponse {
  total: number;
  active: number;
  completed: number;
  byStatus: Record<TaskStatus, number>;
}

interface TaskResponse {
  task: Task;
}

interface SendTaskToReviewResponse {
  task: Task;
  review: TaskReview;
}

interface SplitTaskResponse {
  tasks: Task[];
}

type UpdateTaskMutationContext = {
  previousTask: Task | undefined;
  previousProjects: Project[] | undefined;
  previousProjectId: string | undefined;
  previousProject: Project | undefined;
  previousSectionId: string | undefined;
  previousSectionTasks: Task[] | undefined;
  previousWorkloadQueries: Array<[QueryKey, Task[] | undefined]>;
  previousSprintBoardQueries: Array<[QueryKey, InfiniteData<SprintTasksResponse> | undefined]>;
  previousSprintBoardSummaries: Array<[QueryKey, SprintSummaryResponse | undefined]>;
};

export function useTaskById(taskId: string | null | undefined) {
  return useQuery({
    queryKey: ["task", taskId],
    queryFn: async () => {
      const response = await api.get<TaskResponse>(`/tasks/${taskId}`);
      return response.data.task;
    },
    enabled: Boolean(taskId)
  });
}

function mergeTask(currentTask: Task, updatedTask: Task): Task {
  const discipline =
    currentTask.discipline && updatedTask.discipline
      ? {
          ...currentTask.discipline,
          ...updatedTask.discipline,
          type: updatedTask.discipline.type ?? currentTask.discipline.type
        }
      : updatedTask.discipline ?? currentTask.discipline;

  return {
    ...currentTask,
    ...updatedTask,
    ...(discipline ? { discipline } : {}),
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
  queryClient.setQueryData<Task>(["task", updatedTask.id], (currentTask) =>
    currentTask ? mergeTask(currentTask, updatedTask) : updatedTask
  );

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

  queryClient.setQueriesData<Task[]>(
    { predicate: workloadQueryPredicate },
    (currentTasks) => currentTasks?.map((task) => (task.id === updatedTask.id ? mergeTask(task, updatedTask) : task))
  );
}

function workloadQueryPredicate(query: { queryKey: QueryKey }): boolean {
  return (
    Array.isArray(query.queryKey) &&
    (query.queryKey[0] === "projectWorkloadTasks" || query.queryKey[0] === "globalWorkloadTasks")
  );
}

function sprintBoardQueryPredicate(query: { queryKey: QueryKey }): boolean {
  return Array.isArray(query.queryKey) && (query.queryKey[0] === "sprintBoardTasks" || query.queryKey[0] === "sprintBoardSummary");
}

function sprintBoardTasksQueryPredicate(query: { queryKey: QueryKey }): boolean {
  return Array.isArray(query.queryKey) && query.queryKey[0] === "sprintBoardTasks";
}

function sprintBoardSummaryQueryPredicate(query: { queryKey: QueryKey }): boolean {
  return Array.isArray(query.queryKey) && query.queryKey[0] === "sprintBoardSummary";
}

function invalidateWorkloadTaskQueries(projectId?: string) {
  void queryClient.invalidateQueries({
    predicate: (query) => {
      if (!Array.isArray(query.queryKey)) {
        return false;
      }

      if (query.queryKey[0] === "globalWorkloadTasks") {
        return true;
      }

      return query.queryKey[0] === "projectWorkloadTasks" && (!projectId || query.queryKey[1] === projectId);
    }
  });
}

function invalidateSprintBoardTaskQueries(refetchType: "active" | "inactive" | "all" | "none" = "active") {
  void queryClient.invalidateQueries({ predicate: sprintBoardQueryPredicate, refetchType });
}

function invalidateHomeDashboardQuery() {
  void queryClient.invalidateQueries({ queryKey: ["activity", "home"] });
}

function invalidateMyTasksQuery() {
  void queryClient.invalidateQueries({ queryKey: ["tasks", "mine"] });
}

function updateSprintBoardTaskCaches(updatedTask: Task): Set<string> {
  const sprintBoardQueries = queryClient.getQueriesData<InfiniteData<SprintTasksResponse>>({
    predicate: sprintBoardTasksQueryPredicate
  });
  const touchedScopes = new Set<string>();

  for (const [queryKey, data] of sprintBoardQueries) {
    if (!data || !Array.isArray(queryKey)) {
      continue;
    }

    const hasTask = data.pages.some((page) => page.tasks.some((task) => task.id === updatedTask.id));
    if (hasTask && typeof queryKey[1] === "string") {
      touchedScopes.add(queryKey[1]);
    }
  }

  for (const [queryKey] of sprintBoardQueries) {
    if (!Array.isArray(queryKey)) {
      continue;
    }

    const scope = queryKey[1];
    const status = queryKey[2];
    const shouldContainTask = typeof scope === "string" && touchedScopes.has(scope) && status === updatedTask.status;

    queryClient.setQueryData<InfiniteData<SprintTasksResponse>>(queryKey, (currentData) => {
      if (!currentData) {
        return currentData;
      }

      const pages = currentData.pages.map((page) => ({
        ...page,
        tasks: page.tasks.filter((task) => task.id !== updatedTask.id)
      }));

      if (shouldContainTask) {
        const firstPage = pages[0] ?? { tasks: [], nextCursor: null };
        pages[0] = {
          ...firstPage,
          tasks: [updatedTask, ...firstPage.tasks]
        };
      }

      return {
        ...currentData,
        pages
      };
    });
  }

  return touchedScopes;
}

function updateSprintBoardSummaryCaches(scopes: Set<string>, previousStatus: TaskStatus | undefined, nextStatus: TaskStatus) {
  if (!previousStatus || previousStatus === nextStatus || scopes.size === 0) {
    return;
  }

  for (const [queryKey] of queryClient.getQueriesData<SprintSummaryResponse>({ predicate: sprintBoardSummaryQueryPredicate })) {
    if (!Array.isArray(queryKey) || typeof queryKey[1] !== "string" || !scopes.has(queryKey[1])) {
      continue;
    }

    queryClient.setQueryData<SprintSummaryResponse>(queryKey, (currentSummary) => {
      if (!currentSummary) {
        return currentSummary;
      }

      return {
        ...currentSummary,
        byStatus: {
          ...currentSummary.byStatus,
          [previousStatus]: Math.max((currentSummary.byStatus[previousStatus] ?? 0) - 1, 0),
          [nextStatus]: (currentSummary.byStatus[nextStatus] ?? 0) + 1
        }
      };
    });
  }
}

function patchTaskForOptimisticUpdate(task: Task, payload: UpdateTaskRequest): Task {
  return {
    ...task,
    ...(payload.title !== undefined ? { title: payload.title } : {}),
    ...(payload.description !== undefined ? { description: payload.description } : {}),
    ...(payload.status !== undefined ? { status: payload.status } : {}),
    ...(payload.priority !== undefined ? { priority: payload.priority } : {}),
    ...(payload.assigneeId !== undefined ? { assigneeId: payload.assigneeId } : {}),
    ...(payload.startDate !== undefined ? { startDate: payload.startDate } : {}),
    ...(payload.dueDate !== undefined ? { dueDate: payload.dueDate } : {}),
    ...(payload.estimatedDays !== undefined ? { estimatedDays: payload.estimatedDays } : {}),
    ...(payload.platform !== undefined ? { platform: payload.platform } : {}),
    ...(payload.taskDiscipline !== undefined ? { taskDiscipline: payload.taskDiscipline } : {}),
    ...(payload.estimatedTime !== undefined ? { estimatedTime: payload.estimatedTime } : {}),
    ...(payload.maxDeadline !== undefined ? { maxDeadline: payload.maxDeadline } : {}),
    ...(payload.conclusionDays !== undefined ? { conclusionDays: payload.conclusionDays } : {}),
    ...(payload.stage !== undefined ? { stage: payload.stage } : {}),
    ...(payload.projectIds !== undefined
      ? { projects: task.projects?.filter((project) => payload.projectIds?.includes(project.id)) }
      : {}),
  };
}

function findCachedTask(taskId: string): Task | undefined {
  const taskById = queryClient.getQueryData<Task>(["task", taskId]);
  if (taskById) {
    return taskById;
  }

  const workloadQueries = queryClient.getQueriesData<Task[]>({ predicate: workloadQueryPredicate });
  for (const [, tasks] of workloadQueries) {
    const task = tasks?.find((item) => item.id === taskId);
    if (task) {
      return task;
    }
  }

  const sprintBoardQueries = queryClient.getQueriesData<InfiniteData<SprintTasksResponse>>({ predicate: sprintBoardTasksQueryPredicate });
  for (const [, data] of sprintBoardQueries) {
    for (const page of data?.pages ?? []) {
      const task = page.tasks.find((item) => item.id === taskId);
      if (task) {
        return task;
      }
    }
  }

  const projects = queryClient.getQueryData<Project[]>(["projects"]);
  for (const project of projects ?? []) {
    const task = (project.sections ?? project.disciplines ?? [])
      .flatMap((section) => section.tasks ?? [])
      .find((item) => item.id === taskId);
    if (task) {
      return task;
    }
  }

  return undefined;
}

type WorkloadMonthChunk = {
  key: string;
  from: string;
  to: string;
};

function parseYmdToLocalNoon(ymd: string): Date {
  const parts = ymd.split("-").map(Number);
  const y = parts[0] ?? 0;
  const m = parts[1] ?? 1;
  const d = parts[2] ?? 1;
  return new Date(y, m - 1, d, 12, 0, 0, 0);
}

function workloadMonthChunks(from: string, to: string): WorkloadMonthChunk[] {
  if (!from || !to) {
    return [];
  }

  const startYmd = from <= to ? from : to;
  const endYmd = from <= to ? to : from;
  const endMonth = startOfMonth(parseYmdToLocalNoon(endYmd));
  const chunks: WorkloadMonthChunk[] = [];
  let cursor = startOfMonth(parseYmdToLocalNoon(startYmd));

  while (cursor <= endMonth) {
    chunks.push({
      key: format(cursor, "yyyy-MM"),
      from: format(cursor, "yyyy-MM-dd"),
      to: format(endOfMonth(cursor), "yyyy-MM-dd")
    });
    cursor = addMonths(cursor, 1);
  }

  return chunks;
}

function mergeTasksById(taskLists: Array<Task[] | undefined>): Task[] {
  const map = new Map<string, Task>();

  for (const tasks of taskLists) {
    for (const task of tasks ?? []) {
      const current = map.get(task.id);
      map.set(task.id, current ? mergeTask(current, task) : task);
    }
  }

  return [...map.values()];
}

function isUndatedTask(task: Task): boolean {
  return !task.startDate && !task.dueDate && task.status !== TaskStatusValue.BACKLOG;
}

export function useProjectWorkloadTasks(projectId: string | undefined, from: string, to: string, enabled: boolean) {
  return useQuery({
    queryKey: ["projectWorkloadTasks", projectId, from, to],
    enabled: Boolean(projectId) && enabled && Boolean(from) && Boolean(to),
    queryFn: async () => {
      const response = await api.get<TasksResponse>(`/projects/${projectId}/workload-tasks`, {
        params: { from, to, includeUndated: "true" }
      });
      return response.data.tasks;
    }
  });
}

export function useProjectWorkloadTaskChunks(projectId: string | undefined, from: string, to: string, enabled: boolean) {
  const chunks = workloadMonthChunks(from, to);
  const undatedQuery = useQuery({
    queryKey: ["projectWorkloadTasks", projectId, "undated"],
    enabled: Boolean(projectId) && enabled,
    queryFn: async () => {
      const response = await api.get<TasksResponse>(`/projects/${projectId}/workload-tasks`, {
        params: { from: "1970-01-01", to: "1970-01-01", includeUndated: "true" }
      });
      return response.data.tasks.filter(isUndatedTask);
    }
  });
  const results = useQueries({
    queries: chunks.map((chunk) => ({
      queryKey: ["projectWorkloadTasks", projectId, "month", chunk.key],
      enabled: Boolean(projectId) && enabled && Boolean(chunk.from) && Boolean(chunk.to),
      queryFn: async () => {
        const response = await api.get<TasksResponse>(`/projects/${projectId}/workload-tasks`, {
          params: { from: chunk.from, to: chunk.to, includeUndated: "false" }
        });
        return response.data.tasks;
      }
    }))
  });

  return {
    data: mergeTasksById([undatedQuery.data, ...results.map((result) => result.data)]),
    isLoading: enabled && (undatedQuery.isLoading || results.some((result) => result.isLoading)),
    isFetching: enabled && (undatedQuery.isFetching || results.some((result) => result.isFetching))
  };
}

export function useGlobalWorkloadTasks(
  scope: "general" | "civil" | "electrical",
  from: string,
  to: string,
  enabled: boolean
) {
  return useQuery({
    queryKey: ["globalWorkloadTasks", scope, from, to],
    enabled: enabled && Boolean(from) && Boolean(to),
    queryFn: async () => {
      const response = await api.get<TasksResponse>("/workload/tasks", {
        params: { from, to, scope, includeUndated: "true" }
      });
      return response.data.tasks;
    }
  });
}

export function useGlobalWorkloadTaskChunks(
  scope: "general" | "civil" | "electrical",
  from: string,
  to: string,
  enabled: boolean
) {
  const chunks = workloadMonthChunks(from, to);
  const undatedQuery = useQuery({
    queryKey: ["globalWorkloadTasks", scope, "undated"],
    enabled,
    queryFn: async () => {
      const response = await api.get<TasksResponse>("/workload/tasks", {
        params: { from: "1970-01-01", to: "1970-01-01", scope, includeUndated: "true" }
      });
      return response.data.tasks.filter(isUndatedTask);
    }
  });
  const results = useQueries({
    queries: chunks.map((chunk) => ({
      queryKey: ["globalWorkloadTasks", scope, "month", chunk.key],
      enabled: enabled && Boolean(chunk.from) && Boolean(chunk.to),
      queryFn: async () => {
        const response = await api.get<TasksResponse>("/workload/tasks", {
          params: { from: chunk.from, to: chunk.to, scope, includeUndated: "false" }
        });
        return response.data.tasks;
      }
    }))
  });

  return {
    data: mergeTasksById([undatedQuery.data, ...results.map((result) => result.data)]),
    isLoading: enabled && (undatedQuery.isLoading || results.some((result) => result.isLoading)),
    isFetching: enabled && (undatedQuery.isFetching || results.some((result) => result.isFetching))
  };
}

export function useSprintBoardSummary(scope: "civil" | "electrical") {
  return useQuery({
    queryKey: ["sprintBoardSummary", scope],
    queryFn: async () => {
      const response = await api.get<SprintSummaryResponse>("/sprint/summary", {
        params: { scope }
      });
      return response.data;
    }
  });
}

export function useSprintBoardColumnTasks(scope: "civil" | "electrical", status: TaskStatus) {
  return useInfiniteQuery({
    queryKey: ["sprintBoardTasks", scope, status],
    initialPageParam: undefined as string | undefined,
    queryFn: async ({ pageParam }) => {
      const response = await api.get<SprintTasksResponse>("/sprint/tasks", {
        params: { scope, status, cursor: pageParam }
      });
      return response.data;
    },
    getNextPageParam: (lastPage) => lastPage.nextCursor ?? undefined
  });
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
      if (!sectionId) {
        throw new Error("A tarefa precisa ter uma seção");
      }

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
        status: payload.status ?? TaskStatusValue.TODO,
        priority: payload.priority ?? Priority.MEDIUM,
        assigneeId: payload.assigneeId ?? null,
        creatorId: "",
        startDate: payload.startDate ?? null,
        dueDate: payload.dueDate ?? null,
        estimatedDays: payload.estimatedDays ?? null,
        platform: payload.platform ?? null,
        taskDiscipline: payload.taskDiscipline ?? null,
        estimatedTime: payload.estimatedTime ?? null,
        maxDeadline: payload.maxDeadline ?? null,
        conclusionDays: payload.conclusionDays ?? null,
        stage: payload.stage ?? null,
        completed: false,
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
      if (projectId) {
        await queryClient.invalidateQueries({ queryKey: ["projects", projectId] });
      }
      if (sectionId) {
        await queryClient.invalidateQueries({ queryKey: ["sections", sectionId, "tasks"] });
      }
      invalidateWorkloadTaskQueries(projectId);
      invalidateSprintBoardTaskQueries();
      invalidateHomeDashboardQuery();
      invalidateMyTasksQuery();
    }
  });
}

export function useCreateTaskInSection() {
  return useMutation({
    mutationFn: async ({ sectionId, payload }: { projectId: string; sectionId: string; payload: CreateTaskRequest }) => {
      if (!sectionId) {
        throw new Error("A tarefa precisa ter uma seção");
      }

      const response = await api.post<TaskResponse>(`/sections/${sectionId}/tasks`, payload);
      return response.data.task;
    },
    onSuccess: async (createdTask, variables) => {
      if (variables.projectId) {
        await queryClient.invalidateQueries({ queryKey: ["projects", variables.projectId] });
      }
      await queryClient.invalidateQueries({ queryKey: ["sections", variables.sectionId, "tasks"] });
      invalidateWorkloadTaskQueries(variables.projectId);
      invalidateSprintBoardTaskQueries();
      invalidateHomeDashboardQuery();
      invalidateMyTasksQuery();
      updateTaskInProjectCache(variables.projectId, createdTask);
      updateSprintBoardTaskCaches(createdTask);
    }
  });
}

export function useUpdateTask(projectId: string) {
  return useMutation({
    mutationFn: async ({ id, payload }: { id: string; payload: UpdateTaskRequest }) => {
      const response = await api.patch<TaskResponse>(`/tasks/${id}`, payload);
      return response.data.task;
    },
    onMutate: ({ id, payload }) => {
      const currentTask = findCachedTask(id);
      const optimisticTask = currentTask ? patchTaskForOptimisticUpdate(currentTask, payload) : undefined;
      const resolvedProjectId = projectId || optimisticTask?.discipline?.projectId || currentTask?.discipline?.projectId;
      const sectionId = optimisticTask?.disciplineId ?? currentTask?.disciplineId;
      const context: UpdateTaskMutationContext = {
        previousTask: queryClient.getQueryData<Task>(["task", id]),
        previousProjects: queryClient.getQueryData<Project[]>(["projects"]),
        previousProjectId: resolvedProjectId,
        previousProject: resolvedProjectId ? queryClient.getQueryData<Project>(["projects", resolvedProjectId]) : undefined,
        previousSectionId: sectionId,
        previousSectionTasks: sectionId ? queryClient.getQueryData<Task[]>(["sections", sectionId, "tasks"]) : undefined,
        previousWorkloadQueries: queryClient.getQueriesData<Task[]>({ predicate: workloadQueryPredicate }),
        previousSprintBoardQueries: queryClient.getQueriesData<InfiniteData<SprintTasksResponse>>({
          predicate: sprintBoardTasksQueryPredicate
        }),
        previousSprintBoardSummaries: queryClient.getQueriesData<SprintSummaryResponse>({
          predicate: sprintBoardSummaryQueryPredicate
        })
      };

      void queryClient.cancelQueries({
        predicate: (query) =>
          workloadQueryPredicate(query) ||
          sprintBoardQueryPredicate(query) ||
          teamBoardQueryPredicate(query) ||
          (Array.isArray(query.queryKey) &&
            (query.queryKey[0] === "projects" || (query.queryKey[0] === "task" && query.queryKey[1] === id)))
      });

      if (optimisticTask) {
        updateTaskInProjectCache(resolvedProjectId ?? projectId, optimisticTask);
        const touchedSprintScopes = updateSprintBoardTaskCaches(optimisticTask);
        updateSprintBoardSummaryCaches(touchedSprintScopes, currentTask?.status, optimisticTask.status);
      }

      return context;
    },
    onError: (_error, variables, context) => {
      queryClient.setQueryData(["task", variables.id], context?.previousTask);
      queryClient.setQueryData(["projects"], context?.previousProjects);

      if (context?.previousProjectId) {
        queryClient.setQueryData(["projects", context.previousProjectId], context.previousProject);
      }

      if (context?.previousSectionId) {
        queryClient.setQueryData(["sections", context.previousSectionId, "tasks"], context.previousSectionTasks);
      }

      for (const [queryKey, data] of context?.previousWorkloadQueries ?? []) {
        queryClient.setQueryData(queryKey, data);
      }

      for (const [queryKey, data] of context?.previousSprintBoardQueries ?? []) {
        queryClient.setQueryData(queryKey, data);
      }

      for (const [queryKey, data] of context?.previousSprintBoardSummaries ?? []) {
        queryClient.setQueryData(queryKey, data);
      }
    },
    onSuccess: (updatedTask) => {
      updateTaskInProjectCache(projectId, updatedTask);
      updateSprintBoardTaskCaches(updatedTask);
      invalidateWorkloadTaskQueries(projectId);
      invalidateSprintBoardTaskQueries("inactive");
      invalidateTeamBoardQueries();
      invalidateHomeDashboardQuery();
      invalidateMyTasksQuery();
      void queryClient.invalidateQueries({ queryKey: ["tasks", updatedTask.id, "history"] });
    },
    onSettled: async (_data, _error, variables) => {
      if (!projectId || variables.payload.projectIds !== undefined || variables.payload.projectMemberships !== undefined) {
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
    onMutate: ({ id, status }) => {
      const currentTask = findCachedTask(id);
      const optimisticTask = currentTask ? { ...currentTask, status } : undefined;
      const resolvedProjectId = projectId || optimisticTask?.discipline?.projectId || currentTask?.discipline?.projectId;
      const sectionId = optimisticTask?.disciplineId ?? currentTask?.disciplineId;
      const context: UpdateTaskMutationContext = {
        previousTask: queryClient.getQueryData<Task>(["task", id]),
        previousProjects: queryClient.getQueryData<Project[]>(["projects"]),
        previousProjectId: resolvedProjectId,
        previousProject: resolvedProjectId ? queryClient.getQueryData<Project>(["projects", resolvedProjectId]) : undefined,
        previousSectionId: sectionId,
        previousSectionTasks: sectionId ? queryClient.getQueryData<Task[]>(["sections", sectionId, "tasks"]) : undefined,
        previousWorkloadQueries: queryClient.getQueriesData<Task[]>({ predicate: workloadQueryPredicate }),
        previousSprintBoardQueries: queryClient.getQueriesData<InfiniteData<SprintTasksResponse>>({
          predicate: sprintBoardTasksQueryPredicate
        }),
        previousSprintBoardSummaries: queryClient.getQueriesData<SprintSummaryResponse>({
          predicate: sprintBoardSummaryQueryPredicate
        })
      };

      void queryClient.cancelQueries({
        predicate: (query) =>
          workloadQueryPredicate(query) ||
          sprintBoardQueryPredicate(query) ||
          teamBoardQueryPredicate(query) ||
          (Array.isArray(query.queryKey) &&
            (query.queryKey[0] === "projects" || (query.queryKey[0] === "task" && query.queryKey[1] === id)))
      });

      if (optimisticTask) {
        updateTaskInProjectCache(resolvedProjectId ?? projectId, optimisticTask);
        const touchedSprintScopes = updateSprintBoardTaskCaches(optimisticTask);
        updateSprintBoardSummaryCaches(touchedSprintScopes, currentTask?.status, status);
      }

      return context;
    },
    onError: (_error, variables, context) => {
      queryClient.setQueryData(["task", variables.id], context?.previousTask);
      queryClient.setQueryData(["projects"], context?.previousProjects);

      if (context?.previousProjectId) {
        queryClient.setQueryData(["projects", context.previousProjectId], context.previousProject);
      }

      if (context?.previousSectionId) {
        queryClient.setQueryData(["sections", context.previousSectionId, "tasks"], context.previousSectionTasks);
      }

      for (const [queryKey, data] of context?.previousWorkloadQueries ?? []) {
        queryClient.setQueryData(queryKey, data);
      }

      for (const [queryKey, data] of context?.previousSprintBoardQueries ?? []) {
        queryClient.setQueryData(queryKey, data);
      }

      for (const [queryKey, data] of context?.previousSprintBoardSummaries ?? []) {
        queryClient.setQueryData(queryKey, data);
      }
    },
    onSuccess: (updatedTask) => {
      updateTaskInProjectCache(projectId, updatedTask);
      updateSprintBoardTaskCaches(updatedTask);
      invalidateWorkloadTaskQueries(projectId);
      invalidateSprintBoardTaskQueries("inactive");
      invalidateTeamBoardQueries();
      invalidateHomeDashboardQuery();
      invalidateMyTasksQuery();
      void queryClient.invalidateQueries({ queryKey: ["tasks", updatedTask.id, "history"] });
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
      invalidateWorkloadTaskQueries(projectId);
      invalidateSprintBoardTaskQueries();
      invalidateTeamBoardQueries();
      invalidateHomeDashboardQuery();
      invalidateMyTasksQuery();
      void queryClient.invalidateQueries({ queryKey: ["tasks", updatedTask.id, "history"] });
    }
  });
}

export function useSendTaskToReview(projectId: string) {
  return useMutation({
    mutationFn: async ({ taskId, reviewerId }: { taskId: string; reviewerId: string }) => {
      const response = await api.post<SendTaskToReviewResponse>(`/tasks/${taskId}/send-to-review`, { reviewerId });
      return response.data;
    },
    onSuccess: ({ task }) => {
      updateTaskInProjectCache(projectId, task);
      updateSprintBoardTaskCaches(task);
      invalidateWorkloadTaskQueries(projectId);
      invalidateSprintBoardTaskQueries();
      invalidateTeamBoardQueries();
      invalidateHomeDashboardQuery();
      invalidateMyTasksQuery();
      void queryClient.invalidateQueries({ queryKey: ["reviews"] });
      void queryClient.invalidateQueries({ queryKey: ["tasks", task.id, "history"] });
    }
  });
}

export function useSplitTask(projectId: string) {
  return useMutation({
    mutationFn: async (taskId: string) => {
      const response = await api.post<SplitTaskResponse>(`/tasks/${taskId}/split`);
      return response.data.tasks;
    },
    onSuccess: async (tasks) => {
      const sectionIds = new Set<string>();

      for (const task of tasks) {
        updateTaskInProjectCache(projectId, task);
        updateSprintBoardTaskCaches(task);
        if (task.disciplineId) {
          sectionIds.add(task.disciplineId);
        }
        void queryClient.invalidateQueries({ queryKey: ["tasks", task.id, "history"] });
      }

      if (projectId) {
        await queryClient.invalidateQueries({ queryKey: ["projects", projectId] });
      }

      await queryClient.invalidateQueries({ queryKey: ["projects"] });

      for (const sectionId of sectionIds) {
        await queryClient.invalidateQueries({ queryKey: ["sections", sectionId, "tasks"] });
      }

      invalidateWorkloadTaskQueries(projectId);
      invalidateSprintBoardTaskQueries();
      invalidateTeamBoardQueries();
      invalidateHomeDashboardQuery();
      invalidateMyTasksQuery();
    }
  });
}

function cloneCacheValue<T>(value: T | undefined): T | undefined {
  if (value === undefined) {
    return undefined;
  }

  return JSON.parse(JSON.stringify(value)) as T;
}

export type TaskCacheSnapshot = {
  projects: Project[] | undefined;
  projectById: Array<[string, Project | undefined]>;
  sectionTasks: Array<[string, Task[] | undefined]>;
  workloadQueries: Array<[QueryKey, Task[] | undefined]>;
  sprintQueries: Array<[QueryKey, InfiniteData<SprintTasksResponse> | undefined]>;
  sprintSummaries: Array<[QueryKey, SprintSummaryResponse | undefined]>;
  taskById: Task | undefined;
};

export function snapshotTaskCaches(taskId: string): TaskCacheSnapshot {
  const task = findCachedTask(taskId);
  const resolvedProjectId = task?.discipline?.projectId;
  const projectById: Array<[string, Project | undefined]> = resolvedProjectId
    ? [[resolvedProjectId, cloneCacheValue(queryClient.getQueryData<Project>(["projects", resolvedProjectId]))]]
    : [];
  const sectionTasks: Array<[string, Task[] | undefined]> = task?.disciplineId
    ? [[task.disciplineId, cloneCacheValue(queryClient.getQueryData<Task[]>(["sections", task.disciplineId, "tasks"]))]]
    : [];

  return {
    projects: cloneCacheValue(queryClient.getQueryData<Project[]>(["projects"])),
    projectById,
    sectionTasks,
    workloadQueries: queryClient
      .getQueriesData<Task[]>({ predicate: workloadQueryPredicate })
      .map(([queryKey, data]) => [queryKey, cloneCacheValue(data)] as [QueryKey, Task[] | undefined]),
    sprintQueries: queryClient
      .getQueriesData<InfiniteData<SprintTasksResponse>>({ predicate: sprintBoardTasksQueryPredicate })
      .map(([queryKey, data]) => [queryKey, cloneCacheValue(data)] as [QueryKey, InfiniteData<SprintTasksResponse> | undefined]),
    sprintSummaries: queryClient
      .getQueriesData<SprintSummaryResponse>({ predicate: sprintBoardSummaryQueryPredicate })
      .map(([queryKey, data]) => [queryKey, cloneCacheValue(data)] as [QueryKey, SprintSummaryResponse | undefined]),
    taskById: cloneCacheValue(queryClient.getQueryData<Task>(["task", taskId]))
  };
}

export function restoreTaskCachesSnapshot(snapshot: TaskCacheSnapshot) {
  queryClient.setQueryData(["projects"], snapshot.projects);

  for (const [projectId, project] of snapshot.projectById) {
    queryClient.setQueryData(["projects", projectId], project);
  }

  for (const [sectionId, tasks] of snapshot.sectionTasks) {
    queryClient.setQueryData(["sections", sectionId, "tasks"], tasks);
  }

  for (const [queryKey, data] of snapshot.workloadQueries) {
    queryClient.setQueryData(queryKey, data);
  }

  for (const [queryKey, data] of snapshot.sprintQueries) {
    queryClient.setQueryData(queryKey, data);
  }

  for (const [queryKey, data] of snapshot.sprintSummaries) {
    queryClient.setQueryData(queryKey, data);
  }

  if (snapshot.taskById) {
    queryClient.setQueryData(["task", snapshot.taskById.id], snapshot.taskById);
  }
}

export function optimisticallyRemoveTaskFromCaches(taskId: string, projectId?: string) {
  queryClient.removeQueries({ queryKey: ["task", taskId] });
  queryClient.setQueryData<Project[]>(["projects"], (projects) =>
    projects?.map((project) => ({
      ...project,
      disciplines: project.disciplines?.map((discipline) => ({
        ...discipline,
        tasks: discipline.tasks?.filter((task) => task.id !== taskId)
      })),
      sections: project.sections?.map((section) => ({
        ...section,
        tasks: section.tasks?.filter((task) => task.id !== taskId)
      }))
    }))
  );

  if (projectId) {
    queryClient.setQueryData<Project>(["projects", projectId], (currentProject) => {
      if (!currentProject) {
        return currentProject;
      }

      return {
        ...currentProject,
        disciplines: currentProject.disciplines?.map((discipline) => ({
          ...discipline,
          tasks: discipline.tasks?.filter((task) => task.id !== taskId)
        })),
        sections: currentProject.sections?.map((section) => ({
          ...section,
          tasks: section.tasks?.filter((task) => task.id !== taskId)
        }))
      };
    });
  }

  queryClient.setQueriesData<Task[]>({ predicate: workloadQueryPredicate }, (tasks) =>
    tasks?.filter((task) => task.id !== taskId)
  );

  queryClient.setQueriesData<InfiniteData<SprintTasksResponse>>({ predicate: sprintBoardTasksQueryPredicate }, (currentData) => {
    if (!currentData) {
      return currentData;
    }

    return {
      ...currentData,
      pages: currentData.pages.map((page) => ({
        ...page,
        tasks: page.tasks.filter((task) => task.id !== taskId)
      }))
    };
  });
}

export function useDeleteTask(projectId?: string) {
  return useMutation({
    mutationFn: async (taskId: string) => {
      await api.delete(`/tasks/${taskId}`);
      return taskId;
    },
    onSuccess: (taskId) => {
      optimisticallyRemoveTaskFromCaches(taskId, projectId);
      invalidateWorkloadTaskQueries(projectId);
      invalidateSprintBoardTaskQueries();
      invalidateTeamBoardQueries();
      invalidateHomeDashboardQuery();
      invalidateMyTasksQuery();
    }
  });
}
