import { Command } from "cmdk";
import { FolderKanban, Home, LayoutList, Search, UserRound, Users } from "lucide-react";
import { useEffect, useState } from "react";
import { useNavigate } from "react-router-dom";
import { Role } from "shared";
import { useAuth } from "../../hooks/useAuth";
import { useGlobalSearch } from "../../hooks/useGlobalSearch";
import { queryClient } from "../../lib/queryClient";
import { cn } from "../../lib/utils";
import { useUiStore } from "../../store/uiStore";
import { Dialog, DialogContent } from "../ui/dialog";

export function CommandPalette() {
  const navigate = useNavigate();
  const { user } = useAuth();
  const open = useUiStore((s) => s.commandPaletteOpen);
  const setOpen = useUiStore((s) => s.setCommandPaletteOpen);
  const [search, setSearch] = useState("");
  const debouncedSearch = useDebouncedValue(search, 200);
  const { data, isError, isFetching } = useGlobalSearch(debouncedSearch, open);
  const projects = data?.projects ?? [];
  const taskItems = data?.tasks ?? [];
  const users = data?.users ?? [];
  const canUsers = user?.role === Role.ADMIN || user?.role === Role.COORDINATOR;
  const hasDynamicResults = projects.length > 0 || taskItems.length > 0 || users.length > 0;

  useEffect(() => {
    if (!open) {
      setSearch("");
    }
  }, [open]);

  function go(path: string) {
    setOpen(false);
    navigate(path);
  }

  function goProject(projectId: string, taskId?: string) {
    queryClient.removeQueries({ queryKey: ["projects", projectId], exact: true });
    setOpen(false);
    navigate(`/projects/${projectId}${taskId ? `?task=${encodeURIComponent(taskId)}` : ""}`);
  }

  return (
    <Dialog open={open} onOpenChange={setOpen}>
      <DialogContent className="max-w-xl overflow-hidden p-0" hideClose>
        <Command className="rounded-lg border-0 bg-surface-card text-text-primary" label="Comando rapido" shouldFilter={false}>
          <div className="flex items-center gap-2 border-b border-border px-3">
            <Search size={16} className="shrink-0 text-text-muted" />
            <Command.Input
              value={search}
              onValueChange={setSearch}
              placeholder="Buscar projetos, tarefas, pessoas..."
              className="h-12 w-full bg-transparent text-sm outline-none placeholder:text-text-muted"
            />
          </div>
          <Command.List className="max-h-[min(60vh,420px)] overflow-y-auto p-2">
            <>
              <Command.Empty className="px-3 py-6 text-center text-sm text-text-secondary">Nenhum resultado.</Command.Empty>

              <Command.Group heading="Navegação" className="px-1 py-1 [&_[cmdk-group-heading]]:px-2 [&_[cmdk-group-heading]]:py-1.5 [&_[cmdk-group-heading]]:text-xs [&_[cmdk-group-heading]]:font-semibold [&_[cmdk-group-heading]]:text-text-muted">
                <Command.Item
                  onSelect={() => go("/")}
                  className={cn(
                    "flex cursor-pointer items-center gap-2 rounded-md px-2 py-2 text-sm",
                    "aria-selected:bg-surface-hover aria-selected:text-text-primary"
                  )}
                >
                  <Home size={16} /> Início
                </Command.Item>
                <Command.Item
                  onSelect={() => go("/projects")}
                  className="flex cursor-pointer items-center gap-2 rounded-md px-2 py-2 text-sm aria-selected:bg-surface-hover"
                >
                  <FolderKanban size={16} /> Projetos
                </Command.Item>
                <Command.Item
                  onSelect={() => go("/my-tasks")}
                  className="flex cursor-pointer items-center gap-2 rounded-md px-2 py-2 text-sm aria-selected:bg-surface-hover"
                >
                  <LayoutList size={16} /> Minhas tarefas
                </Command.Item>
                {canUsers ? (
                  <Command.Item
                    onSelect={() => go("/users")}
                    className="flex cursor-pointer items-center gap-2 rounded-md px-2 py-2 text-sm aria-selected:bg-surface-hover"
                  >
                    <Users size={16} /> Usuários
                  </Command.Item>
                ) : null}
              </Command.Group>

              <Command.Group
                heading="Projetos"
                className="px-1 py-1 [&_[cmdk-group-heading]]:px-2 [&_[cmdk-group-heading]]:py-1.5 [&_[cmdk-group-heading]]:text-xs [&_[cmdk-group-heading]]:font-semibold [&_[cmdk-group-heading]]:text-text-muted"
              >
                {projects.map((project) => (
                  <Command.Item
                    key={project.id}
                    value={project.name}
                    onSelect={() => goProject(project.id)}
                    className="flex cursor-pointer items-center gap-2 rounded-md px-2 py-2 text-sm aria-selected:bg-surface-hover"
                  >
                    <FolderKanban size={16} className="text-text-muted" />
                    <span className="min-w-0 flex-1 truncate">{project.name}</span>
                    {project.client ? <span className="max-w-36 truncate text-xs text-text-muted">{project.client}</span> : null}
                  </Command.Item>
                ))}
              </Command.Group>

              <Command.Group
                heading="Tarefas"
                className="px-1 py-1 [&_[cmdk-group-heading]]:px-2 [&_[cmdk-group-heading]]:py-1.5 [&_[cmdk-group-heading]]:text-xs [&_[cmdk-group-heading]]:font-semibold [&_[cmdk-group-heading]]:text-text-muted"
              >
                {taskItems.map((task) => {
                  const subtitle = `${task.projectName} - ${task.sectionName}`;

                  return (
                    <Command.Item
                      key={task.id}
                      value={`${task.title} ${subtitle}`}
                      onSelect={() => goProject(task.projectId, task.id)}
                      className="flex cursor-pointer flex-col gap-0.5 rounded-md px-2 py-2 text-sm aria-selected:bg-surface-hover"
                    >
                      <span className="truncate font-medium">{task.title}</span>
                      <span className="truncate text-xs text-text-muted">{subtitle}</span>
                    </Command.Item>
                  );
                })}
              </Command.Group>

              <Command.Group
                heading="Pessoas"
                className="px-1 py-1 [&_[cmdk-group-heading]]:px-2 [&_[cmdk-group-heading]]:py-1.5 [&_[cmdk-group-heading]]:text-xs [&_[cmdk-group-heading]]:font-semibold [&_[cmdk-group-heading]]:text-text-muted"
              >
                {users.map((u) => (
                  <Command.Item
                    key={u.id}
                    value={`${u.name} ${u.email}`}
                    onSelect={() => go(`/users/${u.id}`)}
                    className="flex cursor-pointer items-center gap-2 rounded-md px-2 py-2 text-sm aria-selected:bg-surface-hover"
                  >
                    <UserRound size={16} className="text-text-muted" />
                    <span className="min-w-0 flex-1 truncate">{u.name}</span>
                    <span className="max-w-44 truncate text-xs text-text-muted">{u.email}</span>
                  </Command.Item>
                ))}
              </Command.Group>

              {isFetching ? (
                <div className="px-3 py-5 text-center text-sm text-text-secondary">Carregando...</div>
              ) : isError ? (
                <div className="px-3 py-5 text-center text-sm text-text-secondary">Não foi possível carregar a busca.</div>
              ) : !hasDynamicResults ? (
                <div className="px-3 py-5 text-center text-sm text-text-secondary">
                  Nenhum projeto, tarefa ou pessoa encontrado.
                </div>
              ) : null}
            </>
          </Command.List>
          <div className="border-t border-border px-3 py-2 text-[11px] text-text-muted">
            <kbd className="rounded border border-border bg-surface-hover px-1">Esc</kbd> fechar ·{" "}
            <kbd className="rounded border border-border bg-surface-hover px-1">?</kbd> atalhos
          </div>
        </Command>
      </DialogContent>
    </Dialog>
  );
}

function useDebouncedValue(value: string, delayMs: number) {
  const [debouncedValue, setDebouncedValue] = useState(value);

  useEffect(() => {
    const timeoutId = window.setTimeout(() => setDebouncedValue(value), delayMs);
    return () => window.clearTimeout(timeoutId);
  }, [delayMs, value]);

  return debouncedValue;
}
