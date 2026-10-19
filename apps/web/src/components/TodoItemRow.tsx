import React, { useState } from "react";
import type { TodoItem } from "../types";
import { TodoComments } from "./TodoComments";

interface TodoItemRowProps {
  todo: TodoItem;
  currentUserId: number;
  isSubtask?: boolean;
  onToggleComplete: (todo: TodoItem) => void;
  onSetSharing: (todo: TodoItem, isShared: boolean) => void;
  onSaveEdit: (id: number, newTitle: string) => void;
  onDelete: (id: number) => void;
  onCreateSubtask: (parentId: number, title: string) => Promise<boolean>;
}

export function TodoItemRow({
  todo,
  currentUserId,
  isSubtask = false,
  onToggleComplete,
  onSetSharing,
  onSaveEdit,
  onDelete,
  onCreateSubtask,
}: TodoItemRowProps) {
  const [isEditing, setIsEditing] = useState(false);
  const [editTitle, setEditTitle] = useState(todo.title);
  const [showComments, setShowComments] = useState(false);
  const [showSubtaskForm, setShowSubtaskForm] = useState(false);
  const [subtaskTitle, setSubtaskTitle] = useState("");
  const subtasks = todo.subtasks ?? [];

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

  const handleCreateSubtask = async (event: React.FormEvent) => {
    event.preventDefault();
    const trimmed = subtaskTitle.trim();
    if (!trimmed) return;
    if (await onCreateSubtask(todo.id, trimmed)) {
      setSubtaskTitle("");
      setShowSubtaskForm(false);
    }
  };

  return (
    <li
      className={`todo-row ${isSubtask ? "subtask-row" : ""} ${todo.completed ? "completed" : ""} ${
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
          {!isSubtask && todo.creator?.id === currentUserId && (
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
      {!isEditing && (
        <div className="todo-extra">
          {!isSubtask && subtasks.length > 0 && (
            <span className="subtask-progress">
              {subtasks.filter((subtask) => subtask.completed).length}/
              {subtasks.length} done
            </span>
          )}
          {!isSubtask && (
            <button
              className="todo-action-btn"
              type="button"
              onClick={() => setShowSubtaskForm((visible) => !visible)}
            >
              {showSubtaskForm ? "Cancel subtask" : "+ Subtask"}
            </button>
          )}
          <button
            className="todo-action-btn"
            type="button"
            onClick={() => setShowComments((visible) => !visible)}
          >
            {showComments ? "Hide comments" : "Comments"}
          </button>
        </div>
      )}
      {!isSubtask && showSubtaskForm && (
        <form className="subtask-form" onSubmit={handleCreateSubtask}>
          <input
            value={subtaskTitle}
            maxLength={500}
            placeholder="Subtask title"
            onChange={(event) => setSubtaskTitle(event.target.value)}
            autoFocus
          />
          <button type="submit" disabled={!subtaskTitle.trim()}>
            Add
          </button>
        </form>
      )}
      {!isSubtask && subtasks.length > 0 && (
        <ul className="subtask-list">
          {subtasks.map((subtask) => (
            <TodoItemRow
              key={subtask.id}
              todo={subtask}
              currentUserId={currentUserId}
              isSubtask
              onToggleComplete={onToggleComplete}
              onSetSharing={onSetSharing}
              onSaveEdit={onSaveEdit}
              onDelete={onDelete}
              onCreateSubtask={onCreateSubtask}
            />
          ))}
        </ul>
      )}
      {showComments && (
        <TodoComments todoId={todo.id} currentUserId={currentUserId} />
      )}
    </li>
  );
}
