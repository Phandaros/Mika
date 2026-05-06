import { create } from "zustand";

interface UiState {
  sidebarOpen: boolean;
  taskDetailId: string | null;
  toggleSidebar: () => void;
  setSidebarOpen: (open: boolean) => void;
  openTaskDetail: (taskId: string) => void;
  closeTaskDetail: () => void;
}

export const useUiStore = create<UiState>((set) => ({
  sidebarOpen: true,
  taskDetailId: null,
  toggleSidebar: () => set((state) => ({ sidebarOpen: !state.sidebarOpen })),
  setSidebarOpen: (open) => set({ sidebarOpen: open }),
  openTaskDetail: (taskId) => set({ taskDetailId: taskId }),
  closeTaskDetail: () => set({ taskDetailId: null })
}));
