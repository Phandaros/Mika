import { LogOut, Menu } from "lucide-react";
import { useNavigate } from "react-router-dom";
import { useAuth } from "../../hooks/useAuth";
import { useUiStore } from "../../store/uiStore";
import { Avatar } from "../shared/Avatar";
import { Button } from "../ui/button";
import { NotificationBell } from "./NotificationBell";

export function Header() {
  const navigate = useNavigate();
  const { user, logout } = useAuth();
  const toggleSidebar = useUiStore((state) => state.toggleSidebar);

  async function handleLogout() {
    await logout();
    navigate("/login", { replace: true });
  }

  return (
    <header className="sticky top-0 z-20 flex h-16 items-center justify-between border-b border-border bg-brand-black/95 px-4 backdrop-blur">
      <div className="flex items-center gap-3">
        <Button variant="ghost" className="h-10 w-10 px-0 lg:hidden" onClick={toggleSidebar} title="Menu">
          <Menu size={20} />
        </Button>
        <div>
          <p className="text-xs font-semibold uppercase text-text-muted">MK Engenharia</p>
          <h1 className="text-lg font-bold text-text-primary">Projetos</h1>
        </div>
      </div>
      <div className="flex items-center gap-3">
        <NotificationBell />
        {user ? (
          <button
            type="button"
            onClick={() => navigate(`/users/${user.id}`)}
            className="hidden items-center gap-3 rounded-md px-2 py-1 text-left transition hover:bg-surface-hover sm:flex"
            title="Abrir meu usuário"
          >
            <Avatar name={user.name} imageUrl={user.avatarUrl} />
            <div className="text-right">
              <p className="text-sm font-semibold text-text-primary">{user.name}</p>
              <p className="text-xs text-text-secondary">{user.role}</p>
            </div>
          </button>
        ) : null}
        <Button variant="ghost" className="h-10 w-10 px-0" onClick={handleLogout} title="Sair">
          <LogOut size={18} />
        </Button>
      </div>
    </header>
  );
}
