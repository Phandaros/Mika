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
