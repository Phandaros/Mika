import { useState } from "react";
import { format } from "date-fns";
import { ptBR } from "date-fns/locale/pt-BR";
import { FolderKanban } from "lucide-react";
import {
  Panel,
  PanelLink,
  ProjectAttentionGrid,
  ProjectGridSkeleton
} from "../components/home/HomeDashboardParts";
import { PersonalHomeSections } from "../components/home/PersonalHomeSections";
import { TaskDetail } from "../components/task/TaskDetail";
import { useAuth } from "../hooks/useAuth";
import { useHomeDashboard } from "../hooks/useHomeDashboard";
import { useTaskById } from "../hooks/useTasks";

function greetingLabel(): string {
  const h = new Date().getHours();
  if (h < 12) {
    return "Bom dia";
  }
  if (h < 18) {
    return "Boa tarde";
  }
  return "Boa noite";
}

export function DashboardPage() {
  const { user } = useAuth();
  const { data, isLoading, isError } = useHomeDashboard();
  const [selectedTaskId, setSelectedTaskId] = useState<string | null>(null);
  const [taskDetailOpenVersion, setTaskDetailOpenVersion] = useState(0);
  const { data: selectedTask } = useTaskById(selectedTaskId);

  function openTask(taskId: string | null) {
    if (!taskId) {
      return;
    }

    setSelectedTaskId(taskId);
    setTaskDetailOpenVersion((version) => version + 1);
  }

  if (isError) {
    return (
      <div className="mx-auto max-w-[1200px]">
        <section className="rounded-md border border-[--color-border] bg-[--bg-2] p-5">
          <h1 className="text-[20px] font-semibold text-[--color-text-primary]">Não foi possível carregar a página inicial</h1>
          <p className="mt-2 text-[13px] text-[--color-text-secondary]">Tente atualizar a página em alguns instantes.</p>
        </section>
      </div>
    );
  }

  return (
    <div className="mx-auto grid max-w-[1200px] gap-4">
      <header className="rounded-md border border-[--color-border] bg-[--bg-2] px-5 py-4">
        <div className="min-w-0">
          <p className="text-[12px] font-medium text-[--color-text-secondary]">
            {format(new Date(), "EEEE, d 'de' MMMM", { locale: ptBR })}
          </p>
          <h1 className="mt-1 truncate text-[20px] font-semibold text-[--color-text-primary]">
            {greetingLabel()}, {firstName(user?.name ?? "usuário")}
          </h1>
        </div>
      </header>

      <PersonalHomeSections
        data={data}
        isLoading={isLoading}
        onOpenTask={openTask}
        tasksLinkTo="/my-tasks"
        tasksLinkLabel="Abrir minhas tarefas"
        showRecentActivity
        recentActivity={data?.recentActivity}
      />

      <Panel
        title="Projetos ativos em atenção"
        icon={<FolderKanban size={16} />}
        action={<PanelLink to="/projects">Ver projetos</PanelLink>}
      >
        {isLoading ? <ProjectGridSkeleton /> : <ProjectAttentionGrid projects={data?.activeProjects ?? []} />}
      </Panel>

      <TaskDetail
        task={selectedTask ?? null}
        onClose={() => setSelectedTaskId(null)}
        onOpenTask={(task) => openTask(task.id)}
        openVersion={taskDetailOpenVersion}
      />
    </div>
  );
}

function firstName(name: string): string {
  return name.split(" ")[0] ?? name;
}
