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
    <div className="h-dvh overflow-hidden bg-bg-0 text-text-primary lg:flex">
      <Sidebar />
      <div className={cn("flex min-h-0 min-w-0 flex-1 flex-col", updater.showBanner && "pb-16 sm:pb-14")}>
        <Header updater={updater} />
        <main className="min-h-0 w-full min-w-0 max-w-full flex-1 overflow-y-auto overflow-x-hidden px-3 py-4 sm:px-6 lg:px-6">
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
