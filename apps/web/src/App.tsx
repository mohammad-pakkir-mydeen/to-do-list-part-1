import React, { useEffect, useState } from "react";
import { api } from "./lib/api";

export type Filter = "all" | "active" | "completed";

export interface TodoItem {
  id: number;
  title: string;
  completed: boolean;
  createdAt: string;
}

export function App() {
  const [todos, setTodos] = useState<TodoItem[]>([]);
  const [filter, setFilter] = useState<Filter>("all");
  const [inputTitle, setInputTitle] = useState("");
  const [editingId, setEditingId] = useState<number | null>(null);
  const [editingTitle, setEditingTitle] = useState("");
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState<string | null>(null);

  const fetchTodos = async () => {
    try {
      setLoading(true);
      setError(null);
      const { data, error: apiError } = await api.todos.get({
        query: { filter },
      });

      if (apiError) {
        setError("Failed to load todos from server.");
        return;
      }

      if (data) {
        setTodos(data as TodoItem[]);
      }
    } catch (err) {
      setError("Cannot reach the backend API. Is it running?");
    } finally {
      setLoading(false);
    }
  };

  useEffect(() => {
    fetchTodos();
  }, [filter]);

  const handleAddTodo = async (e: React.FormEvent) => {
    e.preventDefault();
    const trimmed = inputTitle.trim();
    if (!trimmed) return;

    try {
      const { data, error: apiError } = await api.todos.post({
        title: trimmed,
      });

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

  const handleStartEdit = (todo: TodoItem) => {
    setEditingId(todo.id);
    setEditingTitle(todo.title);
  };

  const handleSaveEdit = async (id: number) => {
    const trimmed = editingTitle.trim();
    if (!trimmed) {
      handleDeleteTodo(id);
      return;
    }

    try {
      const { error: apiError } = await api.todos({ id }).patch({
        title: trimmed,
      });

      if (apiError) {
        setError("Failed to update todo title.");
        return;
      }

      setEditingId(null);
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

  return (
    <div className="todo-app">
      <header className="header">
        <h1>todos</h1>
        <form onSubmit={handleAddTodo}>
          <input
            className="new-todo"
            placeholder="What needs to be done?"
            value={inputTitle}
            onChange={(e) => setInputTitle(e.target.value)}
            autoFocus
          />
        </form>
      </header>

      {error && <div className="error-banner">{error}</div>}

      <main className="main">
        {loading ? (
          <div className="loading-state">Loading todos...</div>
        ) : todos.length === 0 ? (
          <div className="empty-state">No todos found.</div>
        ) : (
          <ul className="todo-list">
            {todos.map((todo) => {
              const isEditing = editingId === todo.id;
              return (
                <li
                  key={todo.id}
                  className={`${todo.completed ? "completed" : ""} ${
                    isEditing ? "editing" : ""
                  }`}
                >
                  {isEditing ? (
                    <input
                      className="edit"
                      value={editingTitle}
                      onChange={(e) => setEditingTitle(e.target.value)}
                      onBlur={() => handleSaveEdit(todo.id)}
                      onKeyDown={(e) => {
                        if (e.key === "Enter") handleSaveEdit(todo.id);
                        if (e.key === "Escape") setEditingId(null);
                      }}
                      autoFocus
                    />
                  ) : (
                    <div className="view">
                      <input
                        className="toggle"
                        type="checkbox"
                        checked={todo.completed}
                        onChange={() => handleToggleComplete(todo)}
                      />
                      <label onDoubleClick={() => handleStartEdit(todo)}>
                        {todo.title}
                      </label>
                      <button
                        className="destroy"
                        onClick={() => handleDeleteTodo(todo.id)}
                        aria-label="Delete todo"
                      >
                        ×
                      </button>
                    </div>
                  )}
                </li>
              );
            })}
          </ul>
        )}
      </main>

      <footer className="footer">
        <span className="todo-count">
          <strong>{activeCount}</strong> {activeCount === 1 ? "item" : "items"} left
        </span>
        <ul className="filters">
          <li>
            <button
              className={filter === "all" ? "selected" : ""}
              onClick={() => setFilter("all")}
            >
              All
            </button>
          </li>
          <li>
            <button
              className={filter === "active" ? "selected" : ""}
              onClick={() => setFilter("active")}
            >
              Active
            </button>
          </li>
          <li>
            <button
              className={filter === "completed" ? "selected" : ""}
              onClick={() => setFilter("completed")}
            >
              Completed
            </button>
          </li>
        </ul>
        {completedCount > 0 && (
          <button className="clear-completed" onClick={handleClearCompleted}>
            Clear completed
          </button>
        )}
      </footer>
    </div>
  );
}

