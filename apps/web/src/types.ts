export type Filter = "all" | "active" | "completed";

export interface UserItem {
  id: number;
  username: string;
}

export interface CreatorItem {
  id: number;
  username: string;
}

export interface ProjectItem {
  id: number;
  name: string;
  userId?: number | null;
  creator?: CreatorItem | null;
  createdAt: string;
}

export interface TodoItem {
  id: number;
  title: string;
  completed: boolean;
  projectId: number | null;
  userId?: number | null;
  creator?: CreatorItem | null;
  createdAt: string;
}
