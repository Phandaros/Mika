import { FolderKanban, Home, Users } from "lucide-react";
import { NavLink } from "react-router-dom";
import { Role } from "shared";
import logoUrl from "../../assets/logo.svg";
import { useUiStore } from "../../store/uiStore";
import { cn } from "../../lib/utils";
import { useAuth } from "../../hooks/useAuth";

const navItems = [
  { to: "/", label: "Minhas tarefas", icon: Home },
  { to: "/projects", label: "Projetos Ativos", icon: FolderKanban },
  { to: "/users", label: "Usuários", icon: Users, minRole: Role.COORDINATOR }
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
        "fixed inset-y-0 left-0 z-30 w-72 border-r border-border bg-surface transition-transform lg:static lg:translate-x-0",
        sidebarOpen ? "translate-x-0" : "-translate-x-full"
      )}
    >
      <div className="flex h-20 items-center border-b border-border px-5">
        <img src={logoUrl} alt="MK Projetos" className="h-12 w-auto" />
      </div>
      <nav className="grid gap-1 p-4">
        {navItems.filter((item) => !item.minRole || (user && roleWeight[user.role] >= roleWeight[item.minRole])).map((item) => {
          const Icon = item.icon;
          return (
            <NavLink
              key={item.to}
              to={item.to}
              className={({ isActive }) =>
                cn(
                  "flex h-11 items-center gap-3 rounded-md px-3 text-sm font-semibold transition",
                  isActive
                    ? "bg-brand-orange text-brand-white"
                    : "text-text-secondary hover:bg-surface-hover hover:text-text-primary"
                )
              }
            >
              <Icon size={18} />
              {item.label}
            </NavLink>
          );
        })}
      </nav>
    </aside>
  );
}
