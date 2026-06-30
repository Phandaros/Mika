import {
  BarChart2,
  Bell,
  CalendarDays,
  CalendarRange,
  CheckCircle2,
  ClipboardCheck,
  ClipboardList,
  FolderKanban,
  Home,
  KanbanSquare,
  LayoutGrid,
  ListTodo,
  LucideIcon,
  Plus,
  Users
} from "lucide-react";
import { useState } from "react";
import { NavLink, useLocation, useNavigate } from "react-router-dom";
import { Role } from "shared";
import logoUrl from "../../assets/logo.svg";
import { canManageTasks } from "../../lib/permissions";
import { cn } from "../../lib/utils";
import { useAuth } from "../../hooks/useAuth";
import { useUiStore } from "../../store/uiStore";
import { Popover, PopoverContent, PopoverTrigger } from "../ui/popover";

type SidebarNavItem = {
  to: string;
  label: string;
  icon: LucideIcon;
  minRole?: Role;
};

type SidebarNavSection = {
  title: string;
  items: SidebarNavItem[];
  minRole?: Role;
};

const roleWeight: Record<Role, number> = {
  [Role.INTERN]: 0,
  [Role.DESIGNER]: 1,
  [Role.COORDINATOR]: 2,
  [Role.ADMIN]: 3
};

const sidebarSections: SidebarNavSection[] = [
  {
    title: "Principal",
    items: [
      { to: "/", label: "Página inicial", icon: Home },
      { to: "/my-tasks", label: "Minhas tarefas", icon: CheckCircle2 },
      { to: "/notifications", label: "Notificações", icon: Bell },
      { to: "/weekly-reports/mine", label: "Meu relatório", icon: ClipboardList }
    ]
  },
  {
    title: "Projetos",
    items: [
      { to: "/projects", label: "Projetos ativos", icon: FolderKanban },
      { to: "/reviews", label: "Revisões", icon: ClipboardCheck, minRole: Role.COORDINATOR },
      { to: "/weekly-reports", label: "Relatórios semanais", icon: BarChart2, minRole: Role.COORDINATOR },
      { to: "/indicators", label: "Indicadores", icon: BarChart2, minRole: Role.COORDINATOR }
    ]
  },
  {
    title: "Vistas",
    minRole: Role.COORDINATOR,
    items: [
      { to: "/team-board", label: "Quadro do Time", icon: LayoutGrid, minRole: Role.COORDINATOR },
      { to: "/sprint/civil", label: "Civil - Sprint Board", icon: KanbanSquare, minRole: Role.COORDINATOR },
      { to: "/sprint/eletrico", label: "Elétrico - Sprint Board", icon: KanbanSquare, minRole: Role.COORDINATOR },
      { to: "/workloads/civil", label: "Workload Civil", icon: CalendarRange, minRole: Role.COORDINATOR },
      { to: "/workloads/eletrico", label: "Workload Elétrico", icon: CalendarRange, minRole: Role.COORDINATOR },
      { to: "/workloads/geral", label: "Workload Geral", icon: CalendarRange, minRole: Role.COORDINATOR }
    ]
  },
  {
    title: "Administração",
    minRole: Role.COORDINATOR,
    items: [
      { to: "/users", label: "Usuários", icon: Users, minRole: Role.COORDINATOR },
      { to: "/admin/calendar", label: "Calendário corporativo", icon: CalendarDays, minRole: Role.COORDINATOR }
    ]
  }
];

function hasMinRole(userRole: Role | undefined, minRole: Role | undefined): boolean {
  if (!minRole) {
    return true;
  }

  return Boolean(userRole && roleWeight[userRole] >= roleWeight[minRole]);
}

function visibleItems(userRole: Role | undefined, items: SidebarNavItem[]): SidebarNavItem[] {
  return items.filter((item) => hasMinRole(userRole, item.minRole));
}

export function Sidebar() {
  const sidebarOpen = useUiStore((state) => state.sidebarOpen);
  const openTaskCreate = useUiStore((state) => state.openTaskCreate);
  const { user } = useAuth();
  const canManage = canManageTasks(user);
  const navigate = useNavigate();
  const location = useLocation();
  const [createOpen, setCreateOpen] = useState(false);

  return (
    <aside
      className={cn(
        "fixed inset-y-0 left-0 z-30 flex w-60 shrink-0 flex-col border-r border-border-subtle bg-bg-1 transition-transform lg:static lg:translate-x-0",
        sidebarOpen ? "translate-x-0" : "-translate-x-full"
      )}
    >
      <div className="flex h-14 items-center gap-3 border-b border-border-subtle px-4">
        <img src={logoUrl} alt="Mika" className="h-9 w-auto" />
        {canManage ? <Popover open={createOpen} onOpenChange={setCreateOpen}>
          <PopoverTrigger asChild>
            <button
              type="button"
              className="ml-auto inline-flex h-8 items-center gap-1.5 rounded-full border border-border bg-surface-card px-3 text-xs font-semibold text-text-primary hover:bg-surface-hover"
            >
              <Plus size={15} />
              Criar
            </button>
          </PopoverTrigger>
          <PopoverContent align="end" className="w-64 p-2">
            <div className="grid gap-1">
              <button
                type="button"
                onClick={() => {
                  setCreateOpen(false);
                  openTaskCreate({ sectionScope: taskCreateScopeFromPath(location.pathname) });
                }}
                className="flex items-center gap-3 rounded-md px-3 py-2 text-left text-sm font-semibold text-text-primary transition hover:bg-surface-hover"
              >
                <ListTodo size={17} className="text-brand-orange" />
                Criar tarefa
              </button>
              <button
                type="button"
                onClick={() => {
                  setCreateOpen(false);
                  navigate("/projects?new=1");
                }}
                className="flex items-center gap-3 rounded-md px-3 py-2 text-left text-sm font-semibold text-text-primary transition hover:bg-surface-hover"
              >
                <FolderKanban size={17} className="text-brand-orange" />
                Criar projeto
              </button>
            </div>
          </PopoverContent>
        </Popover> : null}
      </div>
      <div className="min-h-0 flex-1 overflow-y-auto p-3">
        {sidebarSections.map((section) => {
          if (!hasMinRole(user?.role, section.minRole)) {
            return null;
          }

          const items = visibleItems(user?.role, section.items);
          if (items.length === 0) {
            return null;
          }

          return <SidebarSection key={section.title} title={section.title} items={items} />;
        })}
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

function taskCreateScopeFromPath(pathname: string): "civil" | "electrical" | "general" {
  if (pathname.includes("/eletrico")) {
    return "electrical";
  }

  if (pathname.includes("/civil")) {
    return "civil";
  }

  return "general";
}

function SidebarSection({ title, items }: { title: string; items: SidebarNavItem[] }) {
  return (
    <section className="mb-5">
      <div className="mb-2 px-2 text-xs font-bold text-text-primary">
        <span>{title}</span>
      </div>
      <div className="grid gap-1">
        {items.map((item) => {
          const Icon = item.icon;
          return (
            <NavLink
              key={item.to}
              to={item.to}
              className={({ isActive }) =>
                cn(
                  "flex h-8 min-w-0 items-center gap-3 rounded-md px-3 text-sm font-semibold transition",
                  isActive ? "bg-surface-hover text-text-primary" : "text-text-secondary hover:bg-surface-hover hover:text-text-primary"
                )
              }
            >
              <Icon size={18} className="shrink-0" />
              <span className="truncate">{item.label}</span>
            </NavLink>
          );
        })}
      </div>
    </section>
  );
}
