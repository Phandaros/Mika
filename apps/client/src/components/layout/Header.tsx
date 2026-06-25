import { ChevronLeft, ChevronRight, LogOut, Menu, RefreshCw, Search } from "lucide-react";
import { type FormEvent, useState } from "react";
import { useNavigate } from "react-router-dom";
import { useAuth } from "../../hooks/useAuth";
import type { UpdaterState } from "../../hooks/useUpdater";
import { useUiStore } from "../../store/uiStore";
import { Avatar } from "../shared/Avatar";
import { Button } from "../ui/button";
import { NotificationBell } from "./NotificationBell";

interface HeaderProps {
  updater: UpdaterState;
}

export function Header({ updater }: HeaderProps) {
  const navigate = useNavigate();
  const { user, logout } = useAuth();
  const toggleSidebar = useUiStore((state) => state.toggleSidebar);
  const setCommandPaletteOpen = useUiStore((state) => state.setCommandPaletteOpen);
  const [search, setSearch] = useState("");

  async function handleLogout() {
    await logout();
    navigate("/login", { replace: true });
  }

  function handleSearchSubmit(event: FormEvent<HTMLFormElement>) {
    event.preventDefault();
    const trimmedSearch = search.trim();

    if (!trimmedSearch) {
      return;
    }

    navigate(`/search?q=${encodeURIComponent(trimmedSearch)}`);
  }

  return (
    <header className="sticky top-0 z-20 flex h-14 items-center justify-between border-b border-border-subtle bg-bg-1/90 px-4 backdrop-blur-md">
      <div className="flex items-center gap-3">
        <Button variant="ghost" className="h-9 w-9 px-0 lg:hidden" onClick={toggleSidebar} title="Menu">
          <Menu size={20} />
        </Button>
        <div className="hidden items-center gap-1 text-text-secondary md:flex">
          <Button variant="ghost" className="h-8 w-8 px-0" onClick={() => navigate(-1)} title="Voltar">
            <ChevronLeft size={17} />
          </Button>
          <Button variant="ghost" className="h-8 w-8 px-0" onClick={() => navigate(1)} title="Avancar">
            <ChevronRight size={17} />
          </Button>
        </div>
        <Button
          type="button"
          variant="ghost"
          className="hidden h-9 items-center gap-2 rounded-md border border-border-subtle bg-bg-2 px-3 text-sm text-text-secondary hover:bg-surface-hover hover:text-text-primary md:inline-flex"
          onClick={() => setCommandPaletteOpen(true)}
          title="Paleta de comandos"
        >
          <Search size={16} />
          <span className="max-w-[min(28vw,320px)] truncate text-left">Buscar ou saltar...</span>
          <kbd className="ml-1 hidden rounded border border-border bg-bg-3 px-1.5 font-mono text-[10px] text-text-muted lg:inline">⌘K</kbd>
        </Button>
        <form className="relative w-[min(44vw,540px)] min-w-48 md:hidden" onSubmit={handleSearchSubmit}>
          <Search size={16} className="pointer-events-none absolute left-3 top-1/2 -translate-y-1/2 text-text-secondary" />
          <input
            value={search}
            onChange={(event) => setSearch(event.target.value)}
            className="h-9 w-full rounded-full border border-border-subtle bg-bg-2 pl-9 pr-4 text-sm text-text-primary outline-none placeholder:text-text-muted focus:border-border focus:bg-bg-3"
            placeholder="Buscar"
          />
        </form>
      </div>
      <div className="flex items-center gap-2">
        {updater.isElectron ? (
          <Button
            variant="ghost"
            className="h-9 w-9 px-0"
            onClick={updater.checkNow}
            disabled={updater.status === "checking"}
            title={updater.status === "checking" ? "Verificando atualizacoes" : "Verificar atualizacoes"}
          >
            <RefreshCw size={17} className={updater.status === "checking" ? "animate-spin" : undefined} />
          </Button>
        ) : null}
        <NotificationBell />
        {user ? (
          <button
            type="button"
            onClick={() => navigate(`/users/${user.id}`)}
            className="hidden items-center gap-2 rounded-md px-2 py-1 text-left transition hover:bg-surface-hover sm:flex"
            title="Abrir meu usuario"
          >
            <Avatar name={user.name} imageUrl={user.avatarUrl} className="h-8 w-8" />
          </button>
        ) : null}
        <Button variant="ghost" className="h-9 w-9 px-0" onClick={handleLogout} title="Sair">
          <LogOut size={18} />
        </Button>
      </div>
    </header>
  );
}
