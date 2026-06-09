import { create } from "zustand";

interface UiState {
  sidebarOpen: boolean;
  commandPaletteOpen: boolean;
  shortcutsDialogOpen: boolean;
  taskCreateOpen: boolean;
  taskCreateDefaults: {
    projectId?: string;
    sectionId?: string;
    assigneeId?: string | null;
    startDate?: string | null;
    dueDate?: string | null;
    sectionScope?: "civil" | "electrical" | "general";
  };
  toggleSidebar: () => void;
  setSidebarOpen: (open: boolean) => void;
  setCommandPaletteOpen: (open: boolean) => void;
  setShortcutsDialogOpen: (open: boolean) => void;
  openTaskCreate: (defaults?: {
    projectId?: string;
    sectionId?: string;
    assigneeId?: string | null;
    startDate?: string | null;
    dueDate?: string | null;
    sectionScope?: "civil" | "electrical" | "general";
  }) => void;
  setTaskCreateOpen: (open: boolean) => void;
}

export const useUiStore = create<UiState>((set) => ({
  sidebarOpen: true,
  commandPaletteOpen: false,
  shortcutsDialogOpen: false,
  taskCreateOpen: false,
  taskCreateDefaults: {},
  toggleSidebar: () => set((state) => ({ sidebarOpen: !state.sidebarOpen })),
  setSidebarOpen: (open) => set({ sidebarOpen: open }),
  setCommandPaletteOpen: (open) => set({ commandPaletteOpen: open }),
  setShortcutsDialogOpen: (open) => set({ shortcutsDialogOpen: open }),
  openTaskCreate: (defaults = {}) => set({ taskCreateOpen: true, taskCreateDefaults: defaults }),
  setTaskCreateOpen: (open) => set({ taskCreateOpen: open })
}));
