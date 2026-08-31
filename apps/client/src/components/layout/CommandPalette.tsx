import { Command } from "cmdk";
import { ArrowRight, FolderKanban, Home, LayoutList, Search, UserRound, Users } from "lucide-react";
import { type MouseEvent, type ReactNode, useEffect, useRef, useState } from "react";
import { useNavigate } from "react-router-dom";
import { Role } from "shared";
import { useAuth } from "../../hooks/useAuth";
import { useGlobalSearch } from "../../hooks/useGlobalSearch";
import { queryClient } from "../../lib/queryClient";
import { cn } from "../../lib/utils";
import { useUiStore } from "../../store/uiStore";
import { Dialog, DialogContent, DialogTitle } from "../ui/dialog";
import { SearchMatchContext } from "../shared/SearchMatchContext";

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
  const trimmedSearch = search.trim();
  const searchPath = `/search?q=${encodeURIComponent(trimmedSearch)}`;

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
        <DialogTitle className="sr-only">Busca global</DialogTitle>
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

              {trimmedSearch ? (
                <Command.Group heading="Pesquisar" className="px-1 py-1 [&_[cmdk-group-heading]]:px-2 [&_[cmdk-group-heading]]:py-1.5 [&_[cmdk-group-heading]]:text-xs [&_[cmdk-group-heading]]:font-semibold [&_[cmdk-group-heading]]:text-text-muted">
                  <CommandLinkItem
                    href={searchPath}
                    value={`Buscar por ${trimmedSearch}`}
                    onNavigate={() => go(searchPath)}
                    className="flex cursor-pointer items-center gap-2 rounded-md px-2 py-2 text-sm aria-selected:bg-surface-hover"
                  >
                    <Search size={16} className="text-brand-orange" />
                    <span className="min-w-0 flex-1 truncate">Buscar por "{trimmedSearch}"</span>
                    <ArrowRight size={15} className="text-text-muted" />
                  </CommandLinkItem>
                </Command.Group>
              ) : null}

              <Command.Group heading="Navegação" className="px-1 py-1 [&_[cmdk-group-heading]]:px-2 [&_[cmdk-group-heading]]:py-1.5 [&_[cmdk-group-heading]]:text-xs [&_[cmdk-group-heading]]:font-semibold [&_[cmdk-group-heading]]:text-text-muted">
                <CommandLinkItem
                  href="/"
                  onNavigate={() => go("/")}
                  className={cn(
                    "flex cursor-pointer items-center gap-2 rounded-md px-2 py-2 text-sm",
                    "aria-selected:bg-surface-hover aria-selected:text-text-primary"
                  )}
                >
                  <Home size={16} /> Início
                </CommandLinkItem>
                <CommandLinkItem
                  href="/projects"
                  onNavigate={() => go("/projects")}
                  className="flex cursor-pointer items-center gap-2 rounded-md px-2 py-2 text-sm aria-selected:bg-surface-hover"
                >
                  <FolderKanban size={16} /> Projetos
                </CommandLinkItem>
                <CommandLinkItem
                  href="/my-tasks"
                  onNavigate={() => go("/my-tasks")}
                  className="flex cursor-pointer items-center gap-2 rounded-md px-2 py-2 text-sm aria-selected:bg-surface-hover"
                >
                  <LayoutList size={16} /> Minhas tarefas
                </CommandLinkItem>
                {canUsers ? (
                  <CommandLinkItem
                    href="/users"
                    onNavigate={() => go("/users")}
                    className="flex cursor-pointer items-center gap-2 rounded-md px-2 py-2 text-sm aria-selected:bg-surface-hover"
                  >
                    <Users size={16} /> Usuários
                  </CommandLinkItem>
                ) : null}
              </Command.Group>

              <Command.Group
                heading="Projetos"
                className="px-1 py-1 [&_[cmdk-group-heading]]:px-2 [&_[cmdk-group-heading]]:py-1.5 [&_[cmdk-group-heading]]:text-xs [&_[cmdk-group-heading]]:font-semibold [&_[cmdk-group-heading]]:text-text-muted"
              >
                {projects.map((project) => (
                  <CommandLinkItem
                    key={project.id}
                    href={`/projects/${project.id}`}
                    value={project.name}
                    onNavigate={() => goProject(project.id)}
                    className="flex cursor-pointer items-center gap-2 rounded-md px-2 py-2 text-sm aria-selected:bg-surface-hover"
                  >
                    <FolderKanban size={16} className="text-text-muted" />
                    <span className="min-w-0 flex-1 truncate">{project.name}</span>
                    {project.client ? <span className="max-w-36 truncate text-xs text-text-muted">{project.client}</span> : null}
                  </CommandLinkItem>
                ))}
              </Command.Group>

              <Command.Group
                heading="Tarefas"
                className="px-1 py-1 [&_[cmdk-group-heading]]:px-2 [&_[cmdk-group-heading]]:py-1.5 [&_[cmdk-group-heading]]:text-xs [&_[cmdk-group-heading]]:font-semibold [&_[cmdk-group-heading]]:text-text-muted"
              >
                {taskItems.map((task) => {
                  const subtitle = `${task.projectName} - ${task.sectionName}`;
                  const taskPath = `/projects/${task.projectId}?task=${encodeURIComponent(task.id)}`;

                  return (
                    <CommandLinkItem
                      key={task.id}
                      href={taskPath}
                      value={`${task.title} ${subtitle}`}
                      onNavigate={() => goProject(task.projectId, task.id)}
                      className="flex cursor-pointer flex-col gap-0.5 rounded-md px-2 py-2 text-sm aria-selected:bg-surface-hover"
                    >
                      <span className="truncate font-medium">{task.title}</span>
                      <span className="truncate text-xs text-text-muted">{subtitle}</span>
                      {task.matchContext ? <SearchMatchContext context={task.matchContext} query={debouncedSearch} compact /> : null}
                    </CommandLinkItem>
                  );
                })}
              </Command.Group>

              <Command.Group
                heading="Pessoas"
                className="px-1 py-1 [&_[cmdk-group-heading]]:px-2 [&_[cmdk-group-heading]]:py-1.5 [&_[cmdk-group-heading]]:text-xs [&_[cmdk-group-heading]]:font-semibold [&_[cmdk-group-heading]]:text-text-muted"
              >
                {users.map((u) => (
                  <CommandLinkItem
                    key={u.id}
                    href={`/users/${u.id}`}
                    value={`${u.name} ${u.email}`}
                    onNavigate={() => go(`/users/${u.id}`)}
                    className="flex cursor-pointer items-center gap-2 rounded-md px-2 py-2 text-sm aria-selected:bg-surface-hover"
                  >
                    <UserRound size={16} className="text-text-muted" />
                    <span className="min-w-0 flex-1 truncate">{u.name}</span>
                    <span className="max-w-44 truncate text-xs text-text-muted">{u.email}</span>
                  </CommandLinkItem>
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

interface CommandLinkItemProps {
  children: ReactNode;
  className?: string;
  href: string;
  onNavigate: () => void;
  value?: string;
}

function CommandLinkItem({ children, className, href, onNavigate, value }: CommandLinkItemProps) {
  const skipNextSelect = useRef(false);

  function handleClick(event: MouseEvent<HTMLAnchorElement>) {
    const opensNewBrowsingContext = event.ctrlKey || event.metaKey || event.shiftKey || event.altKey;
    skipNextSelect.current = opensNewBrowsingContext;

    if (!opensNewBrowsingContext) {
      event.preventDefault();
    }
  }

  function handleSelect() {
    if (skipNextSelect.current) {
      skipNextSelect.current = false;
      return;
    }

    onNavigate();
  }

  return (
    <Command.Item asChild value={value} onSelect={handleSelect}>
      <a href={href} onClick={handleClick} className={className}>
        {children}
      </a>
    </Command.Item>
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
