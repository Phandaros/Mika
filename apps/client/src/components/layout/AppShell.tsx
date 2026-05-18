import { Outlet } from "react-router-dom";
import { useAppHotkeys } from "../../hooks/useAppHotkeys";
import { TaskCreateSheet } from "../task/TaskCreateSheet";
import { CommandPalette } from "./CommandPalette";
import { Header } from "./Header";
import { ShortcutsDialog } from "./ShortcutsDialog";
import { Sidebar } from "./Sidebar";

export function AppShell() {
  useAppHotkeys();

  return (
    <div className="min-h-screen bg-bg-0 text-text-primary lg:flex">
      <Sidebar />
      <div className="min-w-0 flex-1">
        <Header />
        <main className="w-full min-w-0 max-w-full overflow-x-hidden px-3 py-4 sm:px-6 lg:px-6">
          <Outlet />
        </main>
      </div>
      <TaskCreateSheet />
      <CommandPalette />
      <ShortcutsDialog />
    </div>
  );
}
