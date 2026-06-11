import { Fragment, useMemo, useState, useEffect, type ReactNode } from "react";
import { DragDropContext, Draggable, Droppable, type DropResult } from "@hello-pangea/dnd";
import { ArrowDownUp, CheckCircle2, Edit3, ExternalLink, Filter, Inbox, KanbanSquare, List, Plus, Search, X } from "lucide-react";
import { useParams, useSearchParams } from "react-router-dom";
import { Priority, TaskStatus, type DisciplineType, type Section, type Task, type UpdateTaskRequest, type User } from "shared";
import { ProjectForm } from "../components/project/ProjectForm";
import {
  DataTable,
  DataTableCell,
  DataTableContainer,
  DataTableGroupRow,
  DataTableHead,
  DataTableHeader,
  DataTableRow,
  EmptyCell,
  TruncatedCellValue
} from "../components/shared/DataTable";
import { EmptyState } from "../components/shared/EmptyState";
import { LoadingSpinner } from "../components/shared/LoadingSpinner";
import { ViewTab } from "../components/shared/ViewTab";
import { Avatar } from "../components/shared/Avatar";
import { CompletionStatusChip, DisciplineChip, PlatformChip, taskStatusLabels } from "../components/shared/Chip";
import { PriorityOptionPill, priorityColors, StatusOptionPill, taskStatusColors } from "../components/shared/statusVisuals";
import { TaskCard } from "../components/task/TaskCard";
import { TaskCardSkeleton } from "../components/task/TaskCardSkeleton";
import { TaskContextMenu } from "../components/task/TaskContextMenu";
import { TaskDetail } from "../components/task/TaskDetail";
import {
  EditableAssigneeField,
  EditableCompletionField,
  EditableDecimalField,
  EditableDisciplineField,
  EditableMaxDeadlineField,
  EditablePlatformField,
  EditableStageField,
  EditableStatusField
} from "../components/task/TaskInlineFields";
import { TaskStatusBadge } from "../components/task/TaskStatusBadge";
import { Button } from "../components/ui/button";
import { Input } from "../components/ui/input";
import { SearchableSelect } from "../components/ui/searchable-select";
import { useAuth } from "../hooks/useAuth";
import { useProject, useProjects } from "../hooks/useProjects";
import { useCreateTask, useUpdateTask, useUpdateTaskCompletion, useUpdateTaskStatus } from "../hooks/useTasks";
import { useUsers } from "../hooks/useUsers";
import { canCompleteTasks, canManageTasks } from "../lib/permissions";
import { cn, formatDateOnly } from "../lib/utils";
import { useUiStore } from "../store/uiStore";

type ProjectTab = "list" | "kanban";
type SortKey = "title" | "section" | "assignee" | "status" | "stage";
type CompletionFilter = "open" | "completed" | "all";
type TaskScope = "general" | "civil" | "electrical";

type TaskWithDiscipline = Task & {
  discipline: {
    id: string;
    name: string;
    projectId: string;
    type: DisciplineType;
  };
};

const columns: Array<{ status: TaskStatus; label: string }> = [
  { status: TaskStatus.TODO, label: "A FAZER" },
  { status: TaskStatus.ON_SCHEDULE, label: "NO CRONOGRAMA" },
  { status: TaskStatus.OVERDUE, label: "ATRASADO" },
  { status: TaskStatus.IN_PROGRESS, label: "EM ANDAMENTO" },
  { status: TaskStatus.AWAITING_REVIEW, label: "AGUARDANDO REVISÃO" },
  { status: TaskStatus.IN_ANALYSIS, label: "EM ANÁLISE" },
  { status: TaskStatus.AWAITING_DEFINITION, label: "AGUARDANDO DEFINIÇÃO" },
  { status: TaskStatus.FINISHED, label: "FINALIZADO" }
];

function tasksFromDisciplines(sections: Section[]): TaskWithDiscipline[] {
  return sections.flatMap((section) =>
    (section.tasks ?? []).map((task) => ({
      ...task,
      discipline: {
        id: section.id,
        name: section.name,
        projectId: section.projectId,
        type: section.type
      }
    }))
  );
}

function taskSortValue(task: TaskWithDiscipline, key: SortKey): string {
  if (key === "section") {
    return task.discipline.name ?? "";
  }

  if (key === "stage") {
    return task.stage ?? "";
  }

  if (key === "assignee") {
    return task.assignee?.name ?? "";
  }

  if (key === "status") {
    return task.status;
  }

  return task.title ?? "";
}

export function ProjectDetailPage() {
  const { projectId } = useParams();
  const [searchParams, setSearchParams] = useSearchParams();
  const { data: project, isLoading, isFetching } = useProject(projectId);
  const updateTaskStatus = useUpdateTaskStatus(projectId ?? "");
  const updateTask = useUpdateTask(projectId ?? "");
  const updateTaskCompletion = useUpdateTaskCompletion(projectId ?? "");
  const [activeTab, setActiveTab] = useState<ProjectTab>("list");
  const [taskScope, setTaskScope] = useState<TaskScope>("general");
  const [statusFilter, setStatusFilter] = useState("all");
  const [completionFilter, setCompletionFilter] = useState<CompletionFilter>("open");
  const [assigneeFilter, setAssigneeFilter] = useState("all");
  const [priorityFilter, setPriorityFilter] = useState("all");
  const [sortKey, setSortKey] = useState<SortKey>("title");
  const [search, setSearch] = useState("");
  const [selectedTask, setSelectedTask] = useState<TaskWithDiscipline | null>(null);
  const [taskDetailOpenVersion, setTaskDetailOpenVersion] = useState(0);
  const [showProjectForm, setShowProjectForm] = useState(false);
  const openTaskCreate = useUiStore((state) => state.openTaskCreate);
  const { user } = useAuth();
  const canManage = canManageTasks(user);
  const canComplete = canCompleteTasks(user);

  const { data: users = [] } = useUsers();
  const { data: projects = [] } = useProjects();

  const disciplines = project?.sections ?? project?.disciplines ?? [];
  const allTasks = useMemo(() => tasksFromDisciplines(disciplines), [disciplines]);

  useEffect(() => {
    const taskId = searchParams.get("task");
    if (!taskId || allTasks.length === 0) {
      return;
    }
    const match = allTasks.find((t) => t.id === taskId);
    if (match) {
      setSelectedTask(match);
    }
  }, [searchParams, allTasks]);

  function closeTaskDetail() {
    setSelectedTask(null);
    const next = new URLSearchParams(searchParams);
    next.delete("task");
    setSearchParams(next, { replace: true });
  }

  function openTaskDetail(task: TaskWithDiscipline) {
    setTaskDetailOpenVersion((version) => version + 1);
    setSelectedTask(task);
    const next = new URLSearchParams(searchParams);
    next.set("task", task.id);
    setSearchParams(next, { replace: true });
  }

  function patchTask(task: TaskWithDiscipline, payload: UpdateTaskRequest) {
    void updateTask.mutateAsync({ id: task.id, payload });
  }

  function patchTaskCompletion(task: TaskWithDiscipline, completed: boolean) {
    void updateTaskCompletion.mutateAsync({ id: task.id, completed });
  }

  const scopedDisciplineIds = useMemo(() => {
    if (taskScope === "general") {
      return new Set<string>();
    }

    return new Set(disciplines.filter((discipline) => sectionScope(discipline) === taskScope).map((discipline) => discipline.id));
  }, [disciplines, taskScope]);

  const builderSuggestions = useMemo(
    () =>
      Array.from(
        new Set(projects.map((item) => item.builder?.trim()).filter((builder): builder is string => Boolean(builder)))
      ).sort((a, b) => a.localeCompare(b, "pt-BR")),
    [projects]
  );

  const disciplineFilteredTasks = useMemo(
    () => allTasks.filter((task) => scopedDisciplineIds.size === 0 || scopedDisciplineIds.has(task.discipline.id)),
    [allTasks, scopedDisciplineIds]
  );

  const visibleDisciplines =
    scopedDisciplineIds.size === 0
      ? disciplines
      : disciplines.filter((discipline) => scopedDisciplineIds.has(discipline.id));

  const visibleTasks = useMemo(() => {
    const normalizedSearch = search.trim().toLowerCase();

    return disciplineFilteredTasks
      .filter((task) => {
        if (completionFilter === "all") {
          return true;
        }

        return completionFilter === "completed" ? task.completed : !task.completed;
      })
      .filter((task) => statusFilter === "all" || task.status === statusFilter)
      .filter((task) => assigneeFilter === "all" || (assigneeFilter === "none" ? !task.assigneeId : task.assigneeId === assigneeFilter))
      .filter((task) => priorityFilter === "all" || task.priority === priorityFilter)
      .filter((task) => {
        if (!normalizedSearch) {
          return true;
        }

        return [task.title, task.discipline.name, task.description ?? ""]
          .join(" ")
          .toLowerCase()
          .includes(normalizedSearch);
      });
  }, [assigneeFilter, completionFilter, disciplineFilteredTasks, priorityFilter, search, statusFilter]);

  const listTasks = useMemo(
    () =>
      [...visibleTasks].sort((a, b) => taskSortValue(a, sortKey).localeCompare(taskSortValue(b, sortKey), "pt-BR")),
    [sortKey, visibleTasks]
  );

  function handleDragEnd(result: DropResult) {
    if (!canManage) {
      return;
    }

    if (!result.destination) {
      return;
    }

    const nextStatus = result.destination.droppableId as TaskStatus;

    if (nextStatus === result.source.droppableId || nextStatus === TaskStatus.OVERDUE) {
      return;
    }

    void updateTaskStatus.mutateAsync({ id: result.draggableId, status: nextStatus });
  }

  if (isLoading) {
    return <LoadingSpinner />;
  }

  if (!project || !projectId) {
    return <EmptyState title="Projeto não encontrado" />;
  }

  const taskFormDiscipline = visibleDisciplines[0] ?? disciplines[0] ?? null;
  const isTasksLoading = isFetching && !isLoading;

  const statusOptions = [
    { value: "all", label: "Todos status" },
    ...Object.values(TaskStatus).map((status) => ({
      value: status,
      label: taskStatusLabels[status],
      color: taskStatusColors[status],
      render: <StatusOptionPill label={taskStatusLabels[status]} color={taskStatusColors[status]} />
    }))
  ];
  const assigneeOptions = [
    { value: "all", label: "Todos responsáveis" },
    { value: "none", label: "Sem responsável" },
    ...users.map((item) => ({ value: item.id, label: item.name, description: item.email, avatarUrl: item.avatarUrl }))
  ];
  const priorityOptions = [
    { value: "all", label: "Todas prioridades" },
    ...Object.values(Priority).map((priority) => ({
      value: priority,
      label: priority,
      color: priorityColors[priority],
      render: <PriorityOptionPill priority={priority} />
    }))
  ];
  const completionOptions = [
    { value: "open", label: "Não concluídas" },
    { value: "completed", label: "Concluídas" },
    { value: "all", label: "Todas" }
  ];
  const sortOptions = [
    { value: "title", label: "Nome" },
    { value: "section", label: "Seção" },
    { value: "assignee", label: "Responsável" },
    { value: "status", label: "Status" },
    { value: "stage", label: "Etapa" }
  ];

  return (
    <div className="grid gap-0">
      <section>
        <div>
          <p className="text-sm font-semibold uppercase text-brand-orange">{project.builder ?? project.client ?? "Projeto Asana"}</p>
          <div className="mt-1 flex flex-wrap items-center gap-3">
            <h1 className="text-3xl font-bold text-text-primary">{project.name}</h1>
            {project.permalinkUrl ? (
              <a
                href={project.permalinkUrl}
                target="_blank"
                rel="noreferrer"
                className="inline-flex h-9 items-center gap-2 rounded-md border border-border px-3 text-sm font-semibold text-text-secondary transition hover:border-brand-orange hover:text-brand-orange"
              >
                <ExternalLink size={16} />
                Asana
              </a>
            ) : null}
          </div>
          <p className="mt-2 max-w-3xl text-sm text-text-secondary">{project.description ?? "Sem descrição cadastrada."}</p>
          <div className="mt-3 flex flex-wrap gap-2 text-xs font-semibold text-text-secondary">
            {project.owner?.name ? <span className="rounded-md border border-border px-2 py-1">Responsável: {project.owner.name}</span> : null}
            {project.defaultView ? <span className="rounded-md border border-border px-2 py-1">View: {project.defaultView}</span> : null}
            {project.asanaGid ? <span className="rounded-md border border-border px-2 py-1">GID: {project.asanaGid}</span> : null}
          </div>
        </div>
      </section>

      <section className="mt-6 border-b border-border pb-0">
        <div className="mb-3 flex flex-col justify-between gap-3 lg:flex-row lg:items-center">
          <div className="flex items-center gap-3">
            <h2 className="text-2xl font-bold text-text-primary">Tarefas</h2>
          </div>
          <div className="flex flex-wrap gap-2">
            <span className="rounded-md border border-border px-3 py-1 text-sm font-semibold text-text-secondary">
              {visibleTasks.length} de {disciplineFilteredTasks.length} tarefas
            </span>
          </div>
        </div>
        <div className="flex items-center gap-5 text-sm font-bold text-text-secondary">
          <ViewTab active={activeTab === "list"} icon={<List size={15} />} label="Lista" onClick={() => setActiveTab("list")} />
          <ViewTab active={activeTab === "kanban"} icon={<KanbanSquare size={15} />} label="Quadro" onClick={() => setActiveTab("kanban")} />
        </div>
      </section>

      <div className="flex flex-wrap items-center justify-between gap-3 border-b border-border py-3">
        <div className="flex flex-wrap items-center gap-2">
          {canManage ? (
            <>
              <Button
                className="h-8 bg-brand-orange hover:bg-orange-600"
                onClick={() => openTaskCreate({ projectId, sectionScope: taskScope })}
              >
                <Plus size={15} />
                Criar tarefa
              </Button>
              <Button variant="secondary" className="h-8" onClick={() => setShowProjectForm((current) => !current)}>
                <Edit3 size={15} />
                Editar projeto
              </Button>
            </>
          ) : null}
          <ScopePill active={taskScope === "general"} label="Geral" onClick={() => setTaskScope("general")} />
          <ScopePill active={taskScope === "civil"} label="Civil" onClick={() => setTaskScope("civil")} />
          <ScopePill active={taskScope === "electrical"} label="Elétrico" onClick={() => setTaskScope("electrical")} />
        </div>
        <div className="flex flex-wrap items-center gap-3 text-sm text-text-secondary">
          <label className="inline-flex items-center gap-1.5">
            <CheckCircle2 size={15} />
            <SearchableSelect
              value={completionFilter}
              options={completionOptions}
              triggerClassName="h-8 w-40"
              searchPlaceholder="Buscar conclusão..."
              onValueChange={(value) => setCompletionFilter(value as CompletionFilter)}
            />
          </label>
          <label className="inline-flex items-center gap-1.5">
            <Filter size={15} />
            <SearchableSelect
              value={statusFilter}
              options={statusOptions}
              triggerClassName="h-8 w-40"
              searchPlaceholder="Buscar status..."
              showSelectionIndicator={false}
              onValueChange={setStatusFilter}
            />
          </label>
          <SearchableSelect
            value={assigneeFilter}
            options={assigneeOptions}
            triggerClassName="h-8 w-44"
            searchPlaceholder="Buscar responsável..."
            contentClassName="w-[min(420px,calc(100vw-32px))]"
            onValueChange={setAssigneeFilter}
          />
          <SearchableSelect
            value={priorityFilter}
            options={priorityOptions}
            triggerClassName="h-8 w-40"
            searchPlaceholder="Buscar prioridade..."
            onValueChange={setPriorityFilter}
          />
          <label className="inline-flex items-center gap-1.5">
            <ArrowDownUp size={15} />
            <SearchableSelect
              value={sortKey}
              options={sortOptions}
              triggerClassName="h-8 w-36"
              searchPlaceholder="Buscar ordenação..."
              onValueChange={(value) => setSortKey(value as SortKey)}
            />
          </label>
          <label className="relative">
            <Search size={15} className="pointer-events-none absolute left-2 top-1/2 -translate-y-1/2" />
            <Input value={search} onChange={(event) => setSearch(event.target.value)} className="h-8 w-52 pl-8" placeholder="Buscar" />
          </label>
        </div>
      </div>

      {showProjectForm ? (
        <ProjectModal title="Editar projeto" onClose={() => setShowProjectForm(false)}>
          <ProjectForm
            project={project}
            builderSuggestions={builderSuggestions}
            onCancel={() => setShowProjectForm(false)}
            onSaved={() => setShowProjectForm(false)}
          />
        </ProjectModal>
      ) : null}

      <div className="min-w-0 pt-4">
        {activeTab === "kanban" ? (
          <KanbanView
            projectId={projectId}
            disciplineId={taskFormDiscipline?.id ?? null}
            tasks={visibleTasks}
            isLoading={isTasksLoading}
            onDragEnd={handleDragEnd}
            onOpenTask={openTaskDetail}
            canManage={canManage}
          />
        ) : null}
        {activeTab === "list" ? (
          <ListView
            disciplines={visibleDisciplines}
            tasks={listTasks}
            users={users}
            isLoading={isTasksLoading}
            canManage={canManage}
            canComplete={canComplete}
            onOpenTask={openTaskDetail}
            onPatchTask={patchTask}
            onPatchCompletion={patchTaskCompletion}
            projectId={projectId}
          />
        ) : null}
      </div>
      <TaskDetail task={selectedTask} onClose={closeTaskDetail} openVersion={taskDetailOpenVersion} />
    </div>
  );
}

function KanbanView({
  projectId,
  disciplineId,
  tasks,
  isLoading,
  onDragEnd,
  onOpenTask,
  canManage
}: {
  projectId: string;
  disciplineId: string | null;
  tasks: TaskWithDiscipline[];
  isLoading: boolean;
  onDragEnd: (result: DropResult) => void;
  onOpenTask: (task: TaskWithDiscipline) => void;
  canManage: boolean;
}) {
  return (
    <DragDropContext onDragEnd={onDragEnd}>
      <div className="overflow-x-auto pb-3">
        <div className="flex min-w-max gap-4">
          {columns.map((column) => {
            const columnTasks = tasks.filter((task) => task.status === column.status);
            return (
              <KanbanColumn
                key={column.status}
                projectId={projectId}
                disciplineId={disciplineId}
                status={column.status}
                label={column.label}
                tasks={columnTasks}
                isLoading={isLoading}
                onOpenTask={onOpenTask}
                canManage={canManage}
              />
            );
          })}
        </div>
      </div>
    </DragDropContext>
  );
}

function ScopePill({ active, label, onClick }: { active: boolean; label: string; onClick: () => void }) {
  return (
    <button
      type="button"
      onClick={onClick}
      className={cn(
        "h-8 rounded-md px-3 text-sm font-semibold transition",
        active ? "bg-brand-orange/15 text-brand-orange" : "text-text-secondary hover:bg-surface-hover hover:text-text-primary"
      )}
    >
      {label}
    </button>
  );
}

function KanbanColumn({
  projectId,
  disciplineId,
  status,
  label,
  tasks,
  isLoading,
  onOpenTask,
  canManage
}: {
  projectId: string;
  disciplineId: string | null;
  status: TaskStatus;
  label: string;
  tasks: TaskWithDiscipline[];
  isLoading: boolean;
  onOpenTask: (task: TaskWithDiscipline) => void;
  canManage: boolean;
}) {
  const [isAdding, setIsAdding] = useState(false);
  const [title, setTitle] = useState("");
  const createTask = useCreateTask(projectId, disciplineId ?? "");
  const canCreateInColumn = status !== TaskStatus.OVERDUE;

  async function submitTask() {
    const trimmedTitle = title.trim();

    if (!canManage || !disciplineId || !canCreateInColumn || trimmedTitle.length < 2) {
      return;
    }

    await createTask.mutateAsync({ title: trimmedTitle, status });
    setTitle("");
    setIsAdding(false);
  }

  return (
    <Droppable droppableId={status}>
      {(provided, snapshot) => (
        <section
          ref={provided.innerRef}
          {...provided.droppableProps}
          className={cn(
            "flex min-h-[520px] w-72 flex-none flex-col rounded-md border border-border bg-surface p-3 transition",
            snapshot.isDraggingOver ? "border-brand-orange" : ""
          )}
        >
          <div className="mb-3 flex items-center justify-between">
            <h2 className="text-sm font-bold text-text-primary">{label}</h2>
            <span className="rounded-md bg-surface-card px-2 py-1 text-xs text-text-secondary">{tasks.length}</span>
          </div>
          <div className="grid flex-1 content-start gap-3">
            {isLoading ? (
              <>
                <TaskCardSkeleton />
                <TaskCardSkeleton />
                <TaskCardSkeleton />
              </>
            ) : (
              <>
                {tasks.map((task, index) => (
                  <Draggable draggableId={task.id} index={index} key={task.id} isDragDisabled={!canManage}>
                    {(dragProvided, dragSnapshot) => (
                      <div
                        ref={dragProvided.innerRef}
                        {...dragProvided.draggableProps}
                        {...dragProvided.dragHandleProps}
                        className={cn(dragSnapshot.isDragging ? "opacity-80" : "")}
                      >
                        <TaskCard task={task} disciplineName={task.discipline.name} onOpen={onOpenTask} />
                      </div>
                    )}
                  </Draggable>
                ))}
                {tasks.length === 0 ? <EmptyState icon={<Inbox size={28} />} title="Nenhuma tarefa aqui" /> : null}
              </>
            )}
            {provided.placeholder}
          </div>
          {canManage ? (
            <div className="mt-3 border-t border-border pt-3">
              {isAdding ? (
                <Input
                  value={title}
                  onChange={(event) => setTitle(event.target.value)}
                  onKeyDown={(event) => {
                    if (event.key === "Escape") {
                      setTitle("");
                      setIsAdding(false);
                    }

                    if (event.key === "Enter") {
                      event.preventDefault();
                      void submitTask();
                    }
                  }}
                  placeholder="Titulo da tarefa"
                  disabled={!disciplineId || !canCreateInColumn || createTask.isPending}
                  autoFocus
                />
              ) : (
                <Button
                  variant="ghost"
                  className="w-full justify-start px-2"
                  onClick={() => setIsAdding(true)}
                  disabled={!disciplineId || !canCreateInColumn}
                >
                  <Plus size={16} />
                  Adicionar tarefa
                </Button>
              )}
            </div>
          ) : null}
        </section>
      )}
    </Droppable>
  );
}

function ListView({
  disciplines,
  tasks,
  users,
  isLoading,
  canManage,
  canComplete,
  onOpenTask,
  onPatchTask,
  onPatchCompletion,
  projectId
}: {
  disciplines: Section[];
  tasks: TaskWithDiscipline[];
  users: User[];
  isLoading: boolean;
  canManage: boolean;
  canComplete: boolean;
  onOpenTask: (task: TaskWithDiscipline) => void;
  onPatchTask: (task: TaskWithDiscipline, payload: UpdateTaskRequest) => void;
  onPatchCompletion: (task: TaskWithDiscipline, completed: boolean) => void;
  projectId: string;
}) {
  const groupedTasks = groupTasksByScope(tasks);
  const columnCount = 10;

  if (isLoading) {
    return (
      <div className="grid gap-3 md:grid-cols-3">
        <TaskCardSkeleton />
        <TaskCardSkeleton />
        <TaskCardSkeleton />
      </div>
    );
  }

  return (
    <div className="grid gap-4">
      <DataTableContainer>
        <DataTable minWidth="1100px" data-testid="project-list-table">
          <colgroup>
            <col className="w-[320px]" />
            <col className="w-[140px]" />
            <col className="w-[150px]" />
            <col className="w-[90px]" />
            <col className="w-[100px]" />
            <col className="w-[120px]" />
            <col className="w-[120px]" />
            <col className="w-[90px]" />
            <col className="w-[90px]" />
            <col className="w-[80px]" />
          </colgroup>
          <DataTableHead>
            <tr className="border-b border-[--color-border]">
              <DataTableHeader>Tarefa</DataTableHeader>
              <DataTableHeader>Responsável</DataTableHeader>
              <DataTableHeader>Status</DataTableHeader>
              <DataTableHeader align="center">Plataforma</DataTableHeader>
              <DataTableHeader align="center">Disciplina</DataTableHeader>
              <DataTableHeader align="center">Status Conclusão</DataTableHeader>
              <DataTableHeader>Prazo Máximo</DataTableHeader>
              <DataTableHeader align="right">Dias Estimados</DataTableHeader>
              <DataTableHeader align="right">Dias Conclusão</DataTableHeader>
              <DataTableHeader>Etapa</DataTableHeader>
            </tr>
          </DataTableHead>
          <tbody>
            {groupedTasks.map((group) => (
              <Fragment key={group.scope}>
                <DataTableGroupRow colSpan={columnCount} label={group.label} count={group.tasks.length} />
                {group.tasks.length === 0 ? (
                  <tr className="border-b border-[--color-border-subtle]">
                    <td colSpan={columnCount} className="px-3 py-2 text-[13px] text-[--color-text-muted]">
                      Nenhuma tarefa nesta seção.
                    </td>
                  </tr>
                ) : (
                  group.tasks.map((task) => (
                    <TaskContextMenu
                      key={task.id}
                      task={task}
                      projectId={projectId}
                      onOpen={onOpenTask}
                      fallbackLinkPath={`/projects/${projectId}`}
                    >
                      <DataTableRow className={cn(task.completed ? "opacity-70" : "")}>
                        <DataTableCell className="max-w-0 overflow-hidden">
                          <button
                            type="button"
                            onClick={() => onOpenTask(task)}
                            title={task.title}
                            className={cn(
                              "block w-full truncate text-left font-medium hover:text-brand-orange",
                              task.completed ? "text-text-muted" : "text-text-primary"
                            )}
                          >
                            {task.title || <EmptyCell />}
                          </button>
                        </DataTableCell>
                        <DataTableCell>
                          {canManage ? (
                            <EditableAssigneeField
                              users={users}
                              assigneeId={task.assigneeId}
                              variant="table"
                              onSave={(assigneeId) => onPatchTask(task, { assigneeId })}
                            />
                          ) : task.assignee ? (
                            <span className="flex min-w-0 items-center gap-1.5">
                              <Avatar name={task.assignee.name} imageUrl={task.assignee.avatarUrl} className="h-5 w-5 shrink-0" />
                              <span className="truncate">{task.assignee.name}</span>
                            </span>
                          ) : (
                            <EmptyCell />
                          )}
                        </DataTableCell>
                        <DataTableCell>
                          {canManage ? (
                            <EditableStatusField task={task} variant="table" onSave={(status) => onPatchTask(task, { status })} />
                          ) : (
                            <TaskStatusBadge status={task.status} />
                          )}
                        </DataTableCell>
                        <DataTableCell align="center">
                          {canManage ? (
                            <EditablePlatformField
                              value={task.platform}
                              variant="table"
                              onSave={(platform) => onPatchTask(task, { platform })}
                            />
                          ) : task.platform ? (
                            <PlatformChip platform={task.platform} />
                          ) : (
                            <EmptyCell />
                          )}
                        </DataTableCell>
                        <DataTableCell align="center">
                          {canManage ? (
                            <EditableDisciplineField
                              value={task.taskDiscipline}
                              variant="table"
                              onSave={(taskDiscipline) => onPatchTask(task, { taskDiscipline })}
                            />
                          ) : task.taskDiscipline ? (
                            <DisciplineChip discipline={task.taskDiscipline} />
                          ) : (
                            <EmptyCell />
                          )}
                        </DataTableCell>
                        <DataTableCell align="center">
                          {canManage || canComplete ? (
                            <EditableCompletionField
                              completed={task.completed}
                              variant="table"
                              onSave={(completed) => onPatchCompletion(task, completed)}
                            />
                          ) : (
                            <CompletionStatusChip completed={task.completed} />
                          )}
                        </DataTableCell>
                        <DataTableCell>
                          {canManage ? (
                            <EditableMaxDeadlineField
                              value={task.maxDeadline}
                              variant="table"
                              onSave={(maxDeadline) => onPatchTask(task, { maxDeadline })}
                            />
                          ) : task.maxDeadline ? (
                            <span>{formatDateOnly(task.maxDeadline, "dd/MM/yyyy")}</span>
                          ) : (
                            <EmptyCell />
                          )}
                        </DataTableCell>
                        <DataTableCell align="right" className="font-mono text-[12px]">
                          {canManage ? (
                            <EditableDecimalField
                              value={task.estimatedTime}
                              variant="table"
                              onSave={(estimatedTime) => onPatchTask(task, { estimatedTime, estimatedDays: estimatedTime })}
                            />
                          ) : task.estimatedTime == null ? (
                            <EmptyCell />
                          ) : (
                            <span>{formatDecimalDisplay(task.estimatedTime)}</span>
                          )}
                        </DataTableCell>
                        <DataTableCell align="right" className="font-mono text-[12px]">
                          {canManage ? (
                            <EditableDecimalField
                              value={task.conclusionDays}
                              variant="table"
                              onSave={(conclusionDays) => onPatchTask(task, { conclusionDays })}
                            />
                          ) : task.conclusionDays == null ? (
                            <EmptyCell />
                          ) : (
                            <span>{formatDecimalDisplay(task.conclusionDays)}</span>
                          )}
                        </DataTableCell>
                        <DataTableCell>
                          {canManage ? (
                            <EditableStageField
                              value={task.stage}
                              stageField={null}
                              variant="table"
                              onSave={(stage) => onPatchTask(task, { stage })}
                            />
                          ) : (
                            <TruncatedCellValue value={task.stage} />
                          )}
                        </DataTableCell>
                      </DataTableRow>
                    </TaskContextMenu>
                  ))
                )}
              </Fragment>
            ))}
          </tbody>
        </DataTable>
      </DataTableContainer>
      {disciplines.length === 0 ? <EmptyState title="Nenhuma disciplina selecionada no projeto" /> : null}
    </div>
  );
}

function formatDecimalDisplay(value: number): string {
  return Number.isInteger(value) ? String(value) : value.toFixed(2).replace(/0+$/, "").replace(/\.$/, "");
}

function groupTasksByScope(tasks: TaskWithDiscipline[]) {
  const groups: Array<{ scope: TaskScope; label: string; tasks: TaskWithDiscipline[] }> = [
    { scope: "general", label: "Geral", tasks: [] },
    { scope: "civil", label: "Civil", tasks: [] },
    { scope: "electrical", label: "Elétrico", tasks: [] }
  ];

  for (const task of tasks) {
    const scope = sectionScope(task.discipline);
    const group = groups.find((item) => item.scope === scope) ?? groups[0];
    group?.tasks.push(task);
  }

  return groups;
}

function ProjectModal({ title, children, onClose }: { title: string; children: ReactNode; onClose: () => void }) {
  return (
    <div className="fixed inset-0 z-50 flex items-center justify-center bg-brand-black/80 p-4 backdrop-blur-sm" onMouseDown={onClose}>
      <section
        className="max-h-[90vh] w-full max-w-3xl overflow-y-auto rounded-md border border-border bg-surface p-5 shadow-2xl"
        onMouseDown={(event) => event.stopPropagation()}
      >
        <div className="mb-5 flex items-center justify-between">
          <h2 className="text-xl font-bold text-text-primary">{title}</h2>
          <Button variant="ghost" className="h-9 w-9 px-0" onClick={onClose} title="Fechar">
            <X size={18} />
          </Button>
        </div>
        {children}
      </section>
    </div>
  );
}

function sectionScope(section: Pick<Section, "name">): TaskScope {
  const normalizedName = section.name.normalize("NFD").replace(/[\u0300-\u036f]/g, "").toLowerCase();
  if (normalizedName === "eletrico") {
    return "electrical";
  }

  if (normalizedName === "civil") {
    return "civil";
  }

  return "general";
}
