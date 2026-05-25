import { Command } from "cmdk";
import { FolderKanban, Home, LayoutList, Search, UserRound, Users } from "lucide-react";
import { useEffect, useMemo, useState } from "react";
import { useNavigate } from "react-router-dom";
import { Role } from "shared";
import { useAuth } from "../../hooks/useAuth";
import { useProjects } from "../../hooks/useProjects";
import { useUsers } from "../../hooks/useUsers";
import { cn } from "../../lib/utils";
import { useUiStore } from "../../store/uiStore";
import { Dialog, DialogContent } from "../ui/dialog";

function sectionsOf(project: { sections?: unknown[]; disciplines?: unknown[] }) {
  return project.sections ?? project.disciplines ?? [];
}

export function CommandPalette() {
  const navigate = useNavigate();
  const { user } = useAuth();
  const open = useUiStore((s) => s.commandPaletteOpen);
  const setOpen = useUiStore((s) => s.setCommandPaletteOpen);
  const [search, setSearch] = useState("");
  const { data: projects = [], isFetching } = useProjects();
  const { data: users = [] } = useUsers();

  useEffect(() => {
    if (!open) {
      setSearch("");
    }
  }, [open]);

  const taskItems = useMemo(() => {
    const out: Array<{ id: string; title: string; projectId: string; subtitle: string }> = [];
    for (const project of projects) {
      const secs = sectionsOf(project) as Array<{ name: string; tasks?: Array<{ id: string; title: string }> }>;
      for (const sec of secs) {
        for (const task of sec.tasks ?? []) {
          out.push({
            id: task.id,
            title: task.title,
            projectId: project.id,
            subtitle: `${project.name} · ${sec.name}`
          });
        }
      }
    }
    return out;
  }, [projects]);

  const canUsers = user?.role === Role.ADMIN || user?.role === Role.COORDINATOR;

  function go(path: string) {
    setOpen(false);
    navigate(path);
  }

  return (
    <Dialog open={open} onOpenChange={setOpen}>
      <DialogContent className="max-w-xl overflow-hidden p-0" hideClose>
        <Command
          className="rounded-lg border-0 bg-surface-card text-text-primary"
          label="Comando rapido"
          shouldFilter={false}
        >
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
            {isFetching ? (
              <div className="px-3 py-6 text-center text-sm text-text-secondary">Carregando...</div>
            ) : (
              <>
                <Command.Empty className="px-3 py-6 text-center text-sm text-text-secondary">Nenhum resultado.</Command.Empty>

                <Command.Group heading="Navegacao" className="px-1 py-1 [&_[cmdk-group-heading]]:px-2 [&_[cmdk-group-heading]]:py-1.5 [&_[cmdk-group-heading]]:text-xs [&_[cmdk-group-heading]]:font-semibold [&_[cmdk-group-heading]]:text-text-muted">
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
                      <Users size={16} /> Usuarios
                    </Command.Item>
                  ) : null}
                </Command.Group>

                <Command.Group
                  heading="Projetos"
                  className="px-1 py-1 [&_[cmdk-group-heading]]:px-2 [&_[cmdk-group-heading]]:py-1.5 [&_[cmdk-group-heading]]:text-xs [&_[cmdk-group-heading]]:font-semibold [&_[cmdk-group-heading]]:text-text-muted"
                >
                  {projects
                    .filter((p) => !search.trim() || p.name.toLowerCase().includes(search.trim().toLowerCase()))
                    .slice(0, 12)
                    .map((project) => (
                      <Command.Item
                        key={project.id}
                        value={project.name}
                        onSelect={() => go(`/projects/${project.id}`)}
                        className="flex cursor-pointer items-center gap-2 rounded-md px-2 py-2 text-sm aria-selected:bg-surface-hover"
                      >
                        <FolderKanban size={16} className="text-text-muted" />
                        <span className="truncate">{project.name}</span>
                      </Command.Item>
                    ))}
                </Command.Group>

                <Command.Group
                  heading="Tarefas"
                  className="px-1 py-1 [&_[cmdk-group-heading]]:px-2 [&_[cmdk-group-heading]]:py-1.5 [&_[cmdk-group-heading]]:text-xs [&_[cmdk-group-heading]]:font-semibold [&_[cmdk-group-heading]]:text-text-muted"
                >
                  {taskItems
                    .filter(
                      (t) =>
                        !search.trim() ||
                        t.title.toLowerCase().includes(search.trim().toLowerCase()) ||
                        t.subtitle.toLowerCase().includes(search.trim().toLowerCase())
                    )
                    .slice(0, 20)
                    .map((task) => (
                      <Command.Item
                        key={task.id}
                        value={`${task.title} ${task.subtitle}`}
                        onSelect={() => go(`/projects/${task.projectId}?task=${encodeURIComponent(task.id)}`)}
                        className="flex cursor-pointer flex-col gap-0.5 rounded-md px-2 py-2 text-sm aria-selected:bg-surface-hover"
                      >
                        <span className="truncate font-medium">{task.title}</span>
                        <span className="truncate text-xs text-text-muted">{task.subtitle}</span>
                      </Command.Item>
                    ))}
                </Command.Group>

                <Command.Group
                  heading="Pessoas"
                  className="px-1 py-1 [&_[cmdk-group-heading]]:px-2 [&_[cmdk-group-heading]]:py-1.5 [&_[cmdk-group-heading]]:text-xs [&_[cmdk-group-heading]]:font-semibold [&_[cmdk-group-heading]]:text-text-muted"
                >
                  {users
                    .filter((u) => !search.trim() || u.name.toLowerCase().includes(search.trim().toLowerCase()))
                    .slice(0, 12)
                    .map((u) => (
                      <Command.Item
                        key={u.id}
                        value={u.name}
                        onSelect={() => go(`/users/${u.id}`)}
                        className="flex cursor-pointer items-center gap-2 rounded-md px-2 py-2 text-sm aria-selected:bg-surface-hover"
                      >
                        <UserRound size={16} className="text-text-muted" />
                        <span className="truncate">{u.name}</span>
                      </Command.Item>
                    ))}
                </Command.Group>
              </>
            )}
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
