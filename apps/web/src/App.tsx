import React, { useEffect, useState } from "react";
import { api } from "./lib/api";
import type { Filter, ProjectItem, TodoItem } from "./types";
import { ProjectSidebar } from "./components/ProjectSidebar";
import { TodoItemRow } from "./components/TodoItemRow";
import { TodoFooter } from "./components/TodoFooter";
import { DeleteProjectModal } from "./components/DeleteProjectModal";

export function App() {
  const [projects, setProjects] = useState<ProjectItem[]>([]);
  const [selectedProjectId, setSelectedProjectId] = useState<number | "inbox" | "all">("all");
  const [todos, setTodos] = useState<TodoItem[]>([]);
  const [filter, setFilter] = useState<Filter>("all");
  const [inputTitle, setInputTitle] = useState("");
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState<string | null>(null);
  const [deletingProject, setDeletingProject] = useState<ProjectItem | null>(null);

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
    fetchProjects();
  }, []);

  useEffect(() => {
    fetchTodos();
  }, [filter, selectedProjectId]);

  const handleCreateProject = async (name: string) => {
    try {
      const { data, error: apiError } = await api.projects.post({ name });
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
      const payload: { title: string; projectId?: number | null } = {
        title: trimmed,
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
        fetchTodos();
      }
    } catch {
      setError("Error creating todo.");
    }
  };

  const handleToggleComplete = async (todo: TodoItem) => {
    try {
      const { error: apiError } = await api.todos({ id: todo.id }).patch({
        completed: !todo.completed,
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

  const activeCount = todos.filter((t) => !t.completed).length;
  const completedCount = todos.filter((t) => t.completed).length;

  const currentProjectName =
    selectedProjectId === "all"
      ? "All Tasks"
      : selectedProjectId === "inbox"
      ? "Inbox"
      : projects.find((p) => p.id === selectedProjectId)?.name || "Project";

  return (
    <div className="layout">
      <ProjectSidebar
        projects={projects}
        selectedProjectId={selectedProjectId}
        onSelectProject={setSelectedProjectId}
        onCreateProject={handleCreateProject}
        onDeleteProjectClick={setDeletingProject}
      />

      <main className="todo-app">
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
                  onToggleComplete={handleToggleComplete}
                  onSaveEdit={handleSaveEdit}
                  onDelete={handleDeleteTodo}
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
