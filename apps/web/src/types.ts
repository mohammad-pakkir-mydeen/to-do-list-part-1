export type Filter = "all" | "active" | "completed";

export interface ProjectItem {
  id: number;
  name: string;
  createdAt: string;
}

export interface TodoItem {
  id: number;
  title: string;
  completed: boolean;
  projectId: number | null;
  createdAt: string;
}

