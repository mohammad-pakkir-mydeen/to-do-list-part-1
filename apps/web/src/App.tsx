import React, { useEffect, useState } from "react";
import { api } from "./lib/api";
import type { Filter, ProjectItem, TodoItem, UserItem } from "./types";
import { ProjectSidebar } from "./components/ProjectSidebar";
import { TodoItemRow } from "./components/TodoItemRow";
import { TodoFooter } from "./components/TodoFooter";
import { DeleteProjectModal } from "./components/DeleteProjectModal";
import { AuthScreen } from "./components/AuthScreen";

export function App() {
  const [currentUser, setCurrentUser] = useState<UserItem | null>(null);
  const [authLoading, setAuthLoading] = useState(true);
  const [authError, setAuthError] = useState<string | null>(null);
  const [projects, setProjects] = useState<ProjectItem[]>([]);
  const [selectedProjectId, setSelectedProjectId] = useState<number | "inbox" | "all">("all");
  const [todos, setTodos] = useState<TodoItem[]>([]);
  const [newTodoIsShared, setNewTodoIsShared] = useState(false);
  const [filter, setFilter] = useState<Filter>("all");
  const [inputTitle, setInputTitle] = useState("");
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState<string | null>(null);
  const [deletingProject, setDeletingProject] = useState<ProjectItem | null>(null);

  const getErrorMessage = (value: unknown, fallback: string) => {
    if (typeof value === "string") return value;
    if (typeof value === "object" && value !== null && "message" in value) {
      return typeof value.message === "string" ? value.message : fallback;
    }
    return fallback;
  };

  const handleLogin = async (email: string, password: string) => {
    try {
      const { data, error: apiError } = await api.auth.login.post({
        email,
        password,
      });
      if (apiError) {
        return {
          success: false,
          error: getErrorMessage(apiError.value, "Sign-in failed"),
        };
      }
      if (!data || !("user" in data) || !data.user) {
        return { success: false, error: "Unexpected sign-in response" };
      }

      setCurrentUser(data.user);
      setAuthError(null);
      setError(null);
      await fetchProjects();
      return { success: true };
    } catch {
      return { success: false, error: "Cannot reach the authentication service" };
    }
  };

  const handleSignup = async (name: string, email: string, password: string) => {
    try {
      const { data, error: apiError } = await api.auth.signup.post({
        name,
        email,
        password,
      });
      if (apiError) {
        return {
          success: false,
          error: getErrorMessage(apiError.value, "Sign-up failed"),
        };
      }
      return data && "user" in data
        ? { success: true }
        : { success: false, error: "Unexpected sign-up response" };
    } catch {
      return { success: false, error: "Cannot reach the authentication service" };
    }
  };

  const handleLogout = async () => {
    try {
      const { error: apiError } = await api.auth.logout.post();
      if (apiError) setAuthError("Could not confirm sign-out. Please try again.");
    } catch {
      setAuthError("Could not reach the server to sign out.");
    } finally {
      setCurrentUser(null);
      setProjects([]);
      setTodos([]);
      setError(null);
    }
  };

  const fetchProjects = async () => {
    try {
      const { data, error: apiError } = await api.projects.get();
      if (!apiError && data) {
        setProjects(data as ProjectItem[]);
      }
    } catch {
      setError("Failed to load projects.");
    }
  };

  const fetchTodos = async () => {
    try {
      setLoading(true);
      setError(null);

      const queryParams: { filter?: Filter; projectId?: string } = { filter };
      if (selectedProjectId === "inbox") {
        queryParams.projectId = "inbox";
      } else if (typeof selectedProjectId === "number") {
        queryParams.projectId = selectedProjectId.toString();
      }

      const { data, error: apiError } = await api.todos.get({
        query: queryParams,
      });

      if (apiError) {
        setError("Failed to load todos from server.");
        return;
      }

      if (data) {
        setTodos(data as TodoItem[]);
      }
    } catch {
      setError("Cannot reach the backend API. Is it running?");
    } finally {
      setLoading(false);
    }
  };

  useEffect(() => {
    let active = true;
    const restoreSession = async () => {
      try {
        const { data } = await api.auth.me.get();
        if (active && data && "user" in data && data.user) {
          setCurrentUser(data.user);
          await fetchProjects();
        }
      } catch {
        if (active) setCurrentUser(null);
      } finally {
        if (active) setAuthLoading(false);
      }
    };

    restoreSession();
    return () => {
      active = false;
    };
  }, []);

  useEffect(() => {
    if (currentUser) fetchTodos();
  }, [filter, selectedProjectId, currentUser]);

  const handleCreateProject = async (name: string, isShared: boolean) => {
    try {
      const { data, error: apiError } = await api.projects.post({ name, isShared });
      if (apiError) {
        setError("Failed to create project.");
        return;
      }
      if (data) {
        await fetchProjects();
        setSelectedProjectId((data as ProjectItem).id);
      }
    } catch {
      setError("Error creating project.");
    }
  };

  const handleSetProjectSharing = async (
    project: ProjectItem,
    isShared: boolean
  ) => {
    try {
      const { error: apiError } = await api.projects({ id: project.id }).patch({
        isShared,
      });
      if (apiError) {
        setError("Only the project owner can change its sharing setting.");
        return;
      }
      await fetchProjects();
      await fetchTodos();
    } catch {
      setError("Error updating project sharing.");
    }
  };

  const handleDeleteProject = async (deleteTodos: boolean) => {
    if (!deletingProject) return;

    try {
      const { error: apiError } = await api.projects({ id: deletingProject.id }).delete({
        query: { deleteTodos: deleteTodos ? "true" : "false" },
      });

      if (apiError) {
        setError("Failed to delete project.");
        return;
      }

      setDeletingProject(null);
      if (selectedProjectId === deletingProject.id) {
        setSelectedProjectId("all");
      }
      await fetchProjects();
      await fetchTodos();
    } catch {
      setError("Error deleting project.");
    }
  };

  const handleAddTodo = async (e: React.FormEvent) => {
    e.preventDefault();
    const trimmed = inputTitle.trim();
    if (!trimmed) return;

    try {
      const payload: {
        title: string;
        projectId?: number | null;
        isShared: boolean;
      } = {
        title: trimmed,
        isShared: newTodoIsShared,
      };

      if (typeof selectedProjectId === "number") {
        payload.projectId = selectedProjectId;
      }

      const { data, error: apiError } = await api.todos.post(payload);

      if (apiError) {
        setError("Failed to create todo.");
        return;
      }

      if (data) {
        setInputTitle("");
        setNewTodoIsShared(false);
        fetchTodos();
      }
    } catch {
      setError("Error creating todo.");
    }
  };

  const handleToggleComplete = async (todo: TodoItem) => {
    const completed = !todo.completed;
    const pendingSubtaskCount = (todo.subtasks ?? []).filter(
      (subtask) => !subtask.completed
    ).length;
    const completeSubtasks =
      completed &&
      pendingSubtaskCount > 0 &&
      window.confirm(
        `Complete the remaining ${pendingSubtaskCount} subtasks too?`
      );

    try {
      const { error: apiError } = await api.todos({ id: todo.id }).patch({
        completed,
        ...(completeSubtasks ? { completeSubtasks: true } : {}),
      });

      if (apiError) {
        setError("Failed to update todo status.");
        return;
      }

      fetchTodos();
    } catch {
      setError("Error updating todo.");
    }
  };

  const handleCreateSubtask = async (parentId: number, title: string) => {
    try {
      const { error: apiError } = await api.todos.post({
        title,
        parentTodoId: parentId,
      });
      if (apiError) {
        setError("Failed to create subtask.");
        return false;
      }
      await fetchTodos();
      return true;
    } catch {
      setError("Error creating subtask.");
      return false;
    }
  };

  const handleSetTodoSharing = async (todo: TodoItem, isShared: boolean) => {
    try {
      const { error: apiError } = await api.todos({ id: todo.id }).patch({
        isShared,
      });
      if (apiError) {
        setError("Failed to update to-do sharing.");
        return;
      }
      await fetchTodos();
    } catch {
      setError("Error updating to-do sharing.");
    }
  };

  const handleSaveEdit = async (id: number, newTitle: string) => {
    try {
      const { error: apiError } = await api.todos({ id }).patch({
        title: newTitle,
      });

      if (apiError) {
        setError("Failed to update todo title.");
        return;
      }

      fetchTodos();
    } catch {
      setError("Error saving edit.");
    }
  };

  const handleDeleteTodo = async (id: number) => {
    try {
      const { error: apiError } = await api.todos({ id }).delete();
      if (apiError) {
        setError("Failed to delete todo.");
        return;
      }
      fetchTodos();
    } catch {
      setError("Error deleting todo.");
    }
  };

  const handleClearCompleted = async () => {
    try {
      const { error: apiError } = await api.todos.completed.delete();
      if (apiError) {
        setError("Failed to clear completed todos.");
        return;
      }
      fetchTodos();
    } catch {
      setError("Error clearing completed todos.");
    }
  };

  const visibleTodos = todos.flatMap((todo) => [
    todo,
    ...(todo.subtasks ?? []),
  ]);
  const activeCount = visibleTodos.filter((todo) => !todo.completed).length;
  const completedCount = visibleTodos.filter((todo) => todo.completed).length;

  if (authLoading) {
    return <div className="loading-state auth-loading">Checking your session...</div>;
  }

  if (!currentUser) {
    return (
      <AuthScreen
        initialError={authError}
        onLogin={handleLogin}
        onSignup={handleSignup}
      />
    );
  }

  const currentProjectName =
    selectedProjectId === "all"
      ? "All Tasks"
      : selectedProjectId === "inbox"
      ? "Inbox"
      : projects.find((p) => p.id === selectedProjectId)?.name || "Project";
  const selectedProjectIsPersonal =
    typeof selectedProjectId === "number" &&
    projects.find((project) => project.id === selectedProjectId)?.isShared ===
      false;

  return (
    <div className="layout">
      <ProjectSidebar
        projects={projects}
        selectedProjectId={selectedProjectId}
        currentUserId={currentUser.id}
        onSelectProject={setSelectedProjectId}
        onCreateProject={handleCreateProject}
        onSetProjectSharing={handleSetProjectSharing}
        onDeleteProjectClick={setDeletingProject}
      />

      <main className="todo-app">
        <div className="signed-in-bar">
          <span>Signed in as <strong>{currentUser.name}</strong></span>
          <button type="button" onClick={handleLogout}>Sign out</button>
        </div>
        <header className="header">
          <h1>{currentProjectName}</h1>
          <form onSubmit={handleAddTodo}>
            <input
              className="new-todo"
              placeholder={
                typeof selectedProjectId === "number"
                  ? `Add task to ${currentProjectName}...`
                  : "What needs to be done?"
              }
              value={inputTitle}
              onChange={(e) => setInputTitle(e.target.value)}
              autoFocus
            />
            <label className="sharing-option todo-sharing-option">
              <input
                type="checkbox"
                checked={!selectedProjectIsPersonal && newTodoIsShared}
                disabled={selectedProjectIsPersonal}
                onChange={(event) => setNewTodoIsShared(event.target.checked)}
              />
              {selectedProjectIsPersonal
                ? "To-dos in personal projects are always personal"
                : "Share this to-do with everyone"}
            </label>
          </form>
        </header>

        {error && <div className="error-banner">{error}</div>}

        <section className="main">
          {loading ? (
            <div className="loading-state">Loading todos...</div>
          ) : todos.length === 0 ? (
            <div className="empty-state">No todos found.</div>
          ) : (
            <ul className="todo-list">
              {todos.map((todo) => (
                <TodoItemRow
                  key={todo.id}
                  todo={todo}
                  currentUserId={currentUser.id}
                  onToggleComplete={handleToggleComplete}
                  onSetSharing={handleSetTodoSharing}
                  onSaveEdit={handleSaveEdit}
                  onDelete={handleDeleteTodo}
                  onCreateSubtask={handleCreateSubtask}
                />
              ))}
            </ul>
          )}
        </section>

        <TodoFooter
          activeCount={activeCount}
          completedCount={completedCount}
          filter={filter}
          onFilterChange={setFilter}
          onClearCompleted={handleClearCompleted}
        />
      </main>

      {deletingProject && (
        <DeleteProjectModal
          project={deletingProject}
          onConfirm={handleDeleteProject}
          onCancel={() => setDeletingProject(null)}
        />
      )}
    </div>
  );
}
