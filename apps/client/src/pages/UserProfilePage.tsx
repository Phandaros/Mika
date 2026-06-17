import { useState } from "react";
import { useParams } from "react-router-dom";
import { useQuery } from "@tanstack/react-query";
import { Role, type User } from "shared";
import { PersonalHomeSections } from "../components/home/PersonalHomeSections";
import { Avatar } from "../components/shared/Avatar";
import { LoadingSpinner } from "../components/shared/LoadingSpinner";
import { TaskDetail } from "../components/task/TaskDetail";
import { useAuth } from "../hooks/useAuth";
import { useTaskById } from "../hooks/useTasks";
import { useUserHomeDashboard } from "../hooks/useUserHomeDashboard";
import { api } from "../lib/api";

interface UserResponse {
  user: User;
}

function isCoordinatorOrAdmin(role: Role | undefined): boolean {
  return role === Role.ADMIN || role === Role.COORDINATOR;
}

export function UserProfilePage() {
  const { userId } = useParams();
  const { user: viewer } = useAuth();
  const canViewHome = isCoordinatorOrAdmin(viewer?.role);
  const { data: user, isLoading } = useQuery({
    queryKey: ["users", userId],
    enabled: Boolean(userId),
    queryFn: async () => {
      const response = await api.get<UserResponse>(`/users/${userId}`);
      return response.data.user;
    }
  });
  const {
    data: homeData,
    isLoading: isHomeLoading,
    isError: isHomeError
  } = useUserHomeDashboard(userId, canViewHome);
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

  if (isLoading) {
    return <LoadingSpinner />;
  }

  if (!user) {
    return <div className="text-text-secondary">Usuário não encontrado.</div>;
  }

  return (
    <div className="mx-auto max-w-[1200px]">
      <div className="rounded-md border border-border bg-surface-card p-6">
        <div className="flex items-center gap-4">
          <Avatar name={user.name} imageUrl={user.avatarUrl} className="h-16 w-16 text-lg" />
          <div>
            <p className="text-sm font-semibold uppercase text-brand-orange">{roleLabel(user.role)}</p>
            <h1 className="mt-1 text-3xl font-bold text-text-primary">{user.name}</h1>
            <p className="mt-1 text-text-secondary">{user.email}</p>
          </div>
        </div>
        <div className="mt-6 grid gap-4 sm:grid-cols-3">
          <div className="rounded-md border border-border bg-brand-black p-4">
            <p className="text-xs font-semibold uppercase text-text-muted">Status</p>
            <p className="mt-2 font-semibold text-text-primary">{user.isActive ? "Ativo" : "Inativo"}</p>
          </div>
          <div className="rounded-md border border-border bg-brand-black p-4">
            <p className="text-xs font-semibold uppercase text-text-muted">Criado em</p>
            <p className="mt-2 font-semibold text-text-primary">{new Date(user.createdAt).toLocaleDateString("pt-BR")}</p>
          </div>
          <div className="rounded-md border border-border bg-brand-black p-4">
            <p className="text-xs font-semibold uppercase text-text-muted">Atualizado em</p>
            <p className="mt-2 font-semibold text-text-primary">{new Date(user.updatedAt).toLocaleDateString("pt-BR")}</p>
          </div>
        </div>
      </div>

      {canViewHome ? (
        isHomeError ? (
          <section className="mt-4 rounded-md border border-[--color-border] bg-[--bg-2] p-5">
            <h2 className="text-[16px] font-semibold text-[--color-text-primary]">Não foi possível carregar a visão de trabalho</h2>
            <p className="mt-2 text-[13px] text-[--color-text-secondary]">Tente atualizar a página em alguns instantes.</p>
          </section>
        ) : (
          <div className="mt-4">
            <PersonalHomeSections
            data={homeData}
            isLoading={isHomeLoading}
            onOpenTask={openTask}
            tasksLinkTo={`/my-tasks?userId=${user.id}`}
            tasksLinkLabel="Ver todas as tarefas"
            tasksPanelTitle="Tarefas atribuídas"
            weeklyReportsLinkTo={`/weekly-reports?userId=${user.id}`}
            weeklyReportTitle="Relatório semanal"
            />
          </div>
        )
      ) : null}

      <TaskDetail
        task={selectedTask ?? null}
        onClose={() => setSelectedTaskId(null)}
        onOpenTask={(task) => openTask(task.id)}
        openVersion={taskDetailOpenVersion}
      />
    </div>
  );
}

function roleLabel(role: Role): string {
  const labels: Record<Role, string> = {
    [Role.ADMIN]: "Gerente",
    [Role.COORDINATOR]: "Coordenador",
    [Role.DESIGNER]: "Projetista",
    [Role.INTERN]: "Estagiário"
  };

  return labels[role];
}
