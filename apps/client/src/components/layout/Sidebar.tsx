import {
  BarChart3,
  Bell,
  CheckCircle2,
  Folder,
  FolderKanban,
  Home,
  Inbox,
  ListChecks,
  Plus,
  Search,
  Target,
  Users
} from "lucide-react";
import { NavLink } from "react-router-dom";
import { Role } from "shared";
import logoUrl from "../../assets/logo.svg";
import { cn } from "../../lib/utils";
import { useAuth } from "../../hooks/useAuth";
import { useUiStore } from "../../store/uiStore";

const navItems = [
  { to: "/", label: "Pagina inicial", icon: Home },
  { to: "/my-tasks", label: "Minhas tarefas", icon: CheckCircle2 },
  { to: "/projects", label: "Projetos Ativos", icon: FolderKanban },
  { to: "/users", label: "Usuarios", icon: Users, minRole: Role.COORDINATOR }
];

const favoriteItems = [
  { label: "Civil - Sprint Board", icon: ListChecks, color: "text-yellow-300" },
  { label: "Eletrico - Sprint Workload", icon: Folder, color: "text-yellow-200" },
  { label: "Relacao de Etapas - Civil", icon: BarChart3, color: "text-blue-400" },
  { label: "Tarefas (Prox. 2 Semanas)", icon: Search, color: "text-text-secondary" },
  { label: "MK Engenharia", icon: Target, color: "text-text-secondary" }
];

export function Sidebar() {
  const sidebarOpen = useUiStore((state) => state.sidebarOpen);
  const { user } = useAuth();
  const roleWeight: Record<Role, number> = {
    [Role.INTERN]: 0,
    [Role.DESIGNER]: 1,
    [Role.COORDINATOR]: 2,
    [Role.ADMIN]: 3
  };

  return (
    <aside
      className={cn(
        "fixed inset-y-0 left-0 z-30 flex w-60 flex-col border-r border-border bg-surface transition-transform lg:static lg:translate-x-0",
        sidebarOpen ? "translate-x-0" : "-translate-x-full"
      )}
    >
      <div className="flex h-14 items-center gap-3 border-b border-border px-4">
        <img src={logoUrl} alt="MK Projetos" className="h-9 w-auto" />
        <NavLink
          to="/projects?new=1"
          className="ml-auto inline-flex h-8 items-center gap-1.5 rounded-full border border-border bg-surface-card px-3 text-xs font-semibold text-text-primary hover:bg-surface-hover"
        >
          <Plus size={15} />
          Criar
        </NavLink>
      </div>
      <nav className="grid gap-1 border-b border-border p-3">
        {navItems
          .filter((item) => !item.minRole || (user && roleWeight[user.role] >= roleWeight[item.minRole]))
          .map((item) => {
            const Icon = item.icon;
            return (
              <NavLink
                key={item.to}
                to={item.to}
                className={({ isActive }) =>
                  cn(
                    "flex h-8 items-center gap-3 rounded-md px-3 text-sm font-semibold transition",
                    isActive ? "bg-surface-hover text-text-primary" : "text-text-secondary hover:bg-surface-hover hover:text-text-primary"
                  )
                }
              >
                <Icon size={18} />
                {item.label}
              </NavLink>
            );
          })}
        <NavLink to="/my-tasks" className="flex h-8 items-center gap-3 px-3 text-sm font-semibold text-text-secondary hover:bg-surface-hover hover:text-text-primary">
          <Inbox size={18} />
          Caixa de entrada
        </NavLink>
      </nav>
      <div className="min-h-0 flex-1 overflow-y-auto p-3">
        <SidebarSection title="Insights" items={[{ label: "Relatorios", icon: BarChart3, to: "/projects" }, { label: "Metas", icon: Target, to: "/" }]} />
        <SidebarSection title="Favoritos" items={favoriteItems} />
        <SidebarSection title="Projetos" items={[{ label: "Projetos Ativos", icon: FolderKanban, to: "/projects" }]} />
      </div>
      {user && roleWeight[user.role] >= roleWeight[Role.COORDINATOR] ? (
        <div className="border-t border-border p-4">
          <NavLink
            to="/users?new=1"
            className="flex h-9 w-full items-center justify-center gap-2 rounded-md border border-border text-sm font-semibold text-text-primary hover:bg-surface-hover"
          >
            <Bell size={15} />
            Convidar
          </NavLink>
        </div>
      ) : null}
    </aside>
  );
}

function SidebarSection({
  title,
  items
}: {
  title: string;
  items: Array<{ label: string; icon: typeof Home; color?: string; to?: string }>;
}) {
  return (
    <section className="mb-5">
      <div className="mb-2 flex items-center justify-between px-2 text-xs font-bold text-text-primary">
        <span>{title}</span>
        <Plus size={14} className="text-text-secondary" />
      </div>
      <div className="grid gap-1">
        {items.map((item) => {
          const Icon = item.icon;
          return (
            <NavLink
              key={item.label}
              to={item.to ?? "/my-tasks"}
              className="flex h-8 min-w-0 items-center gap-2 rounded-md px-2 text-left text-sm text-text-primary hover:bg-surface-hover"
            >
              <Icon size={16} className={item.color ?? "text-text-secondary"} />
              <span className="truncate">{item.label}</span>
            </NavLink>
          );
        })}
      </div>
    </section>
  );
}
