import { Outlet } from "react-router-dom";
import { useAppHotkeys } from "../../hooks/useAppHotkeys";
import { useUpdater } from "../../hooks/useUpdater";
import { cn } from "../../lib/utils";
import { TaskCreateSheet } from "../task/TaskCreateSheet";
import { UpdateBanner } from "../updater/UpdateBanner";
import { CommandPalette } from "./CommandPalette";
import { Header } from "./Header";
import { ShortcutsDialog } from "./ShortcutsDialog";
import { Sidebar } from "./Sidebar";

export function AppShell() {
  useAppHotkeys();
  const updater = useUpdater();

  return (
    <div className={cn("min-h-screen bg-bg-0 text-text-primary lg:flex", updater.showBanner && "pb-16 sm:pb-14")}>
      <Sidebar />
      <div className="min-w-0 flex-1">
        <Header updater={updater} />
        <main className="w-full min-w-0 max-w-full overflow-x-hidden px-3 py-4 sm:px-6 lg:px-6">
          <Outlet />
        </main>
      </div>
      <TaskCreateSheet />
      <CommandPalette />
      <ShortcutsDialog />
      <UpdateBanner updater={updater} />
    </div>
  );
}
