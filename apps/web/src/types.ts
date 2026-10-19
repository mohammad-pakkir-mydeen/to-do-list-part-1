export type Filter = "all" | "active" | "completed";

export interface ProjectItem {
  id: number;
  name: string;
  userId: number | null;
  isShared: boolean;
  createdAt: string;
  creator: CreatorItem | null;
}

export interface TodoItem {
  id: number;
  title: string;
  completed: boolean;
  projectId: number | null;
  isShared: boolean;
  createdAt: string;
  creator: CreatorItem | null;
}

export interface CreatorItem {
  id: number;
  name: string;
  email: string | null;
}

export interface UserItem {
  id: number;
  name: string;
  email: string;
}
