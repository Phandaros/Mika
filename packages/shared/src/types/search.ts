export interface GlobalSearchProjectResult {
  id: string;
  name: string;
  client: string | null;
}

export interface GlobalSearchTaskResult {
  id: string;
  title: string;
  projectId: string;
  projectName: string;
  sectionName: string;
}

export interface GlobalSearchUserResult {
  id: string;
  name: string;
  email: string;
}

export interface GlobalSearchResponse {
  projects: GlobalSearchProjectResult[];
  tasks: GlobalSearchTaskResult[];
  users: GlobalSearchUserResult[];
}

export type AdvancedSearchType = "all" | "tasks" | "projects" | "users";

export type AdvancedSearchCompletion = "open" | "completed" | "all";

export interface AdvancedSearchTaskResult extends GlobalSearchTaskResult {
  status: import("./enums.js").TaskStatus;
  priority: import("./enums.js").Priority;
  assigneeId: string | null;
  assigneeName: string | null;
  dueDate: string | null;
  completed: boolean;
  updatedAt: string;
}

export interface AdvancedSearchProjectResult extends GlobalSearchProjectResult {
  status: import("./enums.js").ProjectStatus;
  platform: "CAD" | "BIM" | null;
  dueDate: string | null;
  updatedAt: string;
}

export interface AdvancedSearchUserResult extends GlobalSearchUserResult {
  role: import("./enums.js").Role;
}

export interface AdvancedSearchPage<TItem> {
  items: TItem[];
  total: number;
  page: number;
  limit: number;
}

export interface AdvancedSearchResponse {
  type: AdvancedSearchType;
  tasks: AdvancedSearchPage<AdvancedSearchTaskResult>;
  projects: AdvancedSearchPage<AdvancedSearchProjectResult>;
  users: AdvancedSearchPage<AdvancedSearchUserResult>;
}
