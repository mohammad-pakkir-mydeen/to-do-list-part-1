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
  parentTodoId: number | null;
  createdAt: string;
  creator: CreatorItem | null;
  subtasks?: TodoItem[];
}

export interface TodoCommentItem {
  id: number;
  todoId: number;
  userId: number;
  body: string;
  createdAt: string;
  updatedAt: string;
  author: CreatorItem;
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
