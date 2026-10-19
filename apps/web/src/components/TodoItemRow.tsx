import React, { useState } from "react";
import type { TodoItem } from "../types";

interface TodoItemRowProps {
  todo: TodoItem;
  currentUserId: number;
  onToggleComplete: (todo: TodoItem) => void;
  onSetSharing: (todo: TodoItem, isShared: boolean) => void;
  onSaveEdit: (id: number, newTitle: string) => void;
  onDelete: (id: number) => void;
}

export function TodoItemRow({
  todo,
  currentUserId,
  onToggleComplete,
  onSetSharing,
  onSaveEdit,
  onDelete,
}: TodoItemRowProps) {
  const [isEditing, setIsEditing] = useState(false);
  const [editTitle, setEditTitle] = useState(todo.title);

  const handleStartEdit = () => {
    setIsEditing(true);
    setEditTitle(todo.title);
  };

  const handleSave = () => {
    const trimmed = editTitle.trim();
    if (!trimmed) {
      onDelete(todo.id);
    } else {
      onSaveEdit(todo.id, trimmed);
    }
    setIsEditing(false);
  };

  const handleKeyDown = (e: React.KeyboardEvent) => {
    if (e.key === "Enter") {
      handleSave();
    } else if (e.key === "Escape") {
      setIsEditing(false);
      setEditTitle(todo.title);
    }
  };

  return (
    <li
      className={`${todo.completed ? "completed" : ""} ${
        isEditing ? "editing" : ""
      }`}
    >
      {isEditing ? (
        <input
          className="edit"
          value={editTitle}
          onChange={(e) => setEditTitle(e.target.value)}
          onBlur={handleSave}
          onKeyDown={handleKeyDown}
          autoFocus
        />
      ) : (
        <div className="view">
          <input
            className="toggle"
            type="checkbox"
            checked={todo.completed}
            onChange={() => onToggleComplete(todo)}
          />
          <label onDoubleClick={handleStartEdit}>
            {todo.title}
            <small className="creator-label">
              Created by {todo.creator?.name ?? "Unknown"}
            </small>
            <small className="creator-label">
              {todo.isShared ? "Shared" : "Personal"}
            </small>
          </label>
          {todo.creator?.id === currentUserId && (
            <button
              className="todo-sharing-btn"
              type="button"
              title={todo.isShared ? "Make to-do personal" : "Share to-do"}
              onClick={() => onSetSharing(todo, !todo.isShared)}
            >
              {todo.isShared ? "Shared" : "Private"}
            </button>
          )}
          <button
            className="destroy"
            onClick={() => onDelete(todo.id)}
            aria-label="Delete todo"
          >
            ×
          </button>
        </div>
      )}
    </li>
  );
}
