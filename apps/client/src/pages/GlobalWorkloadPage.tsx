import { useEffect, useState } from "react";
import { useSearchParams } from "react-router-dom";
import type { Task } from "shared";
import { ProjectWorkloadTimeline } from "../components/project/ProjectWorkloadTimeline";
import { TaskDetail } from "../components/task/TaskDetail";
import { useTaskById, useUpdateTask } from "../hooks/useTasks";
import { useUsers } from "../hooks/useUsers";

type GlobalWorkloadScope = "general" | "civil" | "electrical";

const titles: Record<GlobalWorkloadScope, string> = {
  general: "Workload Geral",
  civil: "Workload Civil",
  electrical: "Workload Elétrico"
};

const descriptions: Record<GlobalWorkloadScope, string> = {
  general: "Todas as tarefas com datas, de todos os projetos ativos.",
  civil: "Tarefas em disciplinas de instalações civis (hidráulico, sanitario, PPCI, etc.), todos os projetos.",
  electrical: "Tarefas em disciplinas elétricas (elétrico, SPDA, telecom, automação), todos os projetos."
};

export function GlobalWorkloadPage({ scope }: { scope: GlobalWorkloadScope }) {
  const [searchParams, setSearchParams] = useSearchParams();
  const taskIdFromUrl = searchParams.get("task");
  const { data: taskFromApi } = useTaskById(taskIdFromUrl);
  const [selectedTask, setSelectedTask] = useState<Task | null>(null);
  const [taskDetailOpenVersion, setTaskDetailOpenVersion] = useState(0);
  const { data: users = [] } = useUsers();
  const updateTask = useUpdateTask("");

  useEffect(() => {
    if (!taskIdFromUrl) {
      setSelectedTask(null);
      return;
    }

    if (taskFromApi?.id === taskIdFromUrl) {
      setSelectedTask(taskFromApi);
    }
  }, [taskIdFromUrl, taskFromApi]);

  function openTaskDetail(task: Task) {
    setTaskDetailOpenVersion((version) => version + 1);
    setSelectedTask(task);
    const next = new URLSearchParams(searchParams);
    next.set("task", task.id);
    setSearchParams(next, { replace: true });
  }

  function handleTimelineTaskUpdated(task: Task) {
    setSelectedTask((currentTask) =>
      currentTask?.id === task.id
        ? {
            ...currentTask,
            ...task,
            discipline: task.discipline ?? currentTask.discipline,
            comments: task.comments ?? currentTask.comments
          }
        : currentTask
    );
  }

  function closeTaskDetail() {
    setSelectedTask(null);
    const next = new URLSearchParams(searchParams);
    next.delete("task");
    setSearchParams(next, { replace: true });
  }

  return (
    <div className="grid min-w-0 gap-6">
      <header>
        <h1 className="text-2xl font-bold text-text-primary">{titles[scope]}</h1>
        <p className="mt-2 max-w-3xl text-sm text-text-secondary">{descriptions[scope]}</p>
      </header>

      <ProjectWorkloadTimeline
        mode="global"
        workloadScope={scope}
        users={users}
        isActive
        onOpenTask={openTaskDetail}
        onTaskUpdated={handleTimelineTaskUpdated}
        updateTask={updateTask}
      />
      <TaskDetail
        task={selectedTask}
        onClose={closeTaskDetail}
        onOpenTask={openTaskDetail}
        openVersion={taskDetailOpenVersion}
      />
    </div>
  );
}
