import React, { useEffect, useState } from "react";
import { api } from "../lib/api";
import type { TodoCommentItem } from "../types";

interface TodoCommentsProps {
  todoId: number;
  currentUserId: number;
}

export function TodoComments({ todoId, currentUserId }: TodoCommentsProps) {
  const [comments, setComments] = useState<TodoCommentItem[]>([]);
  const [body, setBody] = useState("");
  const [editingId, setEditingId] = useState<number | null>(null);
  const [editBody, setEditBody] = useState("");
  const [error, setError] = useState<string | null>(null);

  const loadComments = async () => {
    try {
      const { data, error: apiError } = await api
        .todos({ id: todoId })
        .comments.get();
      if (apiError) {
        setError("Could not load comments.");
        return;
      }
      setComments(data as TodoCommentItem[]);
    } catch {
      setError("Could not reach the server to load comments.");
    }
  };

  useEffect(() => {
    void loadComments();
  }, [todoId]);

  const handleCreate = async (event: React.FormEvent) => {
    event.preventDefault();
    const trimmed = body.trim();
    if (!trimmed) return;

    try {
      const { error: apiError } = await api
        .todos({ id: todoId })
        .comments.post({ body: trimmed });
      if (apiError) {
        setError("Could not add comment.");
        return;
      }
      setBody("");
      setError(null);
      await loadComments();
    } catch {
      setError("Could not reach the server to add the comment.");
    }
  };

  const handleSave = async (commentId: number) => {
    const trimmed = editBody.trim();
    if (!trimmed) return;
    try {
      const { error: apiError } = await api
        .todos({ id: todoId })
        .comments({ commentId })
        .patch({ body: trimmed });
      if (apiError) {
        setError("Could not update comment.");
        return;
      }
      setEditingId(null);
      setError(null);
      await loadComments();
    } catch {
      setError("Could not reach the server to update the comment.");
    }
  };

  const handleDelete = async (commentId: number) => {
    try {
      const { error: apiError } = await api
        .todos({ id: todoId })
        .comments({ commentId })
        .delete();
      if (apiError) {
        setError("Could not delete comment.");
        return;
      }
      setError(null);
      await loadComments();
    } catch {
      setError("Could not reach the server to delete the comment.");
    }
  };

  return (
    <section className="todo-comments" aria-label="Comments">
      {error && <p className="comment-error" role="alert">{error}</p>}
      {comments.length === 0 ? (
        <p className="no-comments">No comments yet.</p>
      ) : (
        <ul className="comment-list">
          {comments.map((comment) => (
            <li key={comment.id} className="comment">
              <div className="comment-heading">
                <strong>{comment.author.name}</strong>
                <time dateTime={comment.createdAt}>
                  {new Date(comment.updatedAt).toLocaleString()}
                </time>
              </div>
              {editingId === comment.id ? (
                <form
                  onSubmit={(event) => {
                    event.preventDefault();
                    void handleSave(comment.id);
                  }}
                >
                  <textarea
                    value={editBody}
                    maxLength={5000}
                    onChange={(event) => setEditBody(event.target.value)}
                    autoFocus
                  />
                  <button type="submit">Save</button>
                  <button type="button" onClick={() => setEditingId(null)}>
                    Cancel
                  </button>
                </form>
              ) : (
                <p>{comment.body}</p>
              )}
              {comment.userId === currentUserId && editingId !== comment.id && (
                <div className="comment-actions">
                  <button
                    type="button"
                    onClick={() => {
                      setEditingId(comment.id);
                      setEditBody(comment.body);
                    }}
                  >
                    Edit
                  </button>
                  <button
                    type="button"
                    onClick={() => void handleDelete(comment.id)}
                  >
                    Delete
                  </button>
                </div>
              )}
            </li>
          ))}
        </ul>
      )}
      <form className="comment-form" onSubmit={handleCreate}>
        <textarea
          value={body}
          maxLength={5000}
          placeholder="Write a comment..."
          onChange={(event) => setBody(event.target.value)}
          required
        />
        <button type="submit" disabled={!body.trim()}>
          Comment
        </button>
      </form>
    </section>
  );
}
