import React, { useState } from "react";
import type { TodoItem } from "../types";

interface TodoItemRowProps {
  todo: TodoItem;
  onToggleComplete: (todo: TodoItem) => void;
  onSaveEdit: (id: number, newTitle: string) => void;
  onDelete: (id: number) => void;
}

export function TodoItemRow({
  todo,
  onToggleComplete,
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
            {todo.creator && (
              <span className="creator-tag">by @{todo.creator.username}</span>
            )}
          </label>
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

