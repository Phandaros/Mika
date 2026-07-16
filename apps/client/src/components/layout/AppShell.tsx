import { useState } from "react";
import { Outlet } from "react-router-dom";
import type { Task } from "shared";
import { useAppHotkeys } from "../../hooks/useAppHotkeys";
import { useUpdater } from "../../hooks/useUpdater";
import { cn } from "../../lib/utils";
import { NotificationRealtimeBridge } from "../notification/NotificationRealtimeBridge";
import { TaskCreateSheet } from "../task/TaskCreateSheet";
import { TaskDetail } from "../task/TaskDetail";
import { UpdateBanner } from "../updater/UpdateBanner";
import { CommandPalette } from "./CommandPalette";
import { Header } from "./Header";
import { ShortcutsDialog } from "./ShortcutsDialog";
import { Sidebar } from "./Sidebar";

export function AppShell() {
  useAppHotkeys();
  const updater = useUpdater();
  const [createdTask, setCreatedTask] = useState<Task | null>(null);
  const [taskDetailOpenVersion, setTaskDetailOpenVersion] = useState(0);

  function openCreatedTask(task: Task) {
    setTaskDetailOpenVersion((version) => version + 1);
    setCreatedTask(task);
  }

  return (
    <div className="h-dvh overflow-hidden bg-bg-0 text-text-primary lg:flex">
      <Sidebar />
      <div className={cn("flex min-h-0 min-w-0 flex-1 flex-col", updater.showBanner && "pb-16 sm:pb-14")}>
        <Header updater={updater} />
        <main className="min-h-0 w-full min-w-0 max-w-full flex-1 overflow-y-auto overflow-x-hidden px-3 py-4 sm:px-6 lg:px-6">
          <Outlet />
        </main>
      </div>
      <TaskCreateSheet onCreated={openCreatedTask} />
      <TaskDetail
        task={createdTask}
        onClose={() => setCreatedTask(null)}
        openVersion={taskDetailOpenVersion}
        onOpenTask={openCreatedTask}
      />
      <NotificationRealtimeBridge />
      <CommandPalette />
      <ShortcutsDialog />
      <UpdateBanner updater={updater} />
    </div>
  );
}
