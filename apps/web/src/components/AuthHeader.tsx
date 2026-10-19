import React, { useState } from "react";
import type { UserItem } from "../types";

interface AuthHeaderProps {
  currentUser: UserItem | null;
  onLogin: (username: string, password: string) => Promise<{ success: boolean; error?: string }>;
  onRegister: (username: string, password: string) => Promise<{ success: boolean; error?: string }>;
  onLogout: () => Promise<void>;
}

export function AuthHeader({
  currentUser,
  onLogin,
  onRegister,
  onLogout,
}: AuthHeaderProps) {
  const [showModal, setShowModal] = useState<"login" | "register" | null>(null);
  const [username, setUsername] = useState("");
  const [password, setPassword] = useState("");
  const [formError, setFormError] = useState<string | null>(null);
  const [submitting, setSubmitting] = useState(false);

  const handleSubmit = async (e: React.FormEvent) => {
    e.preventDefault();
    setFormError(null);
    setSubmitting(true);

    try {
      const res =
        showModal === "login"
          ? await onLogin(username, password)
          : await onRegister(username, password);

      if (!res.success) {
        setFormError(res.error || "An error occurred");
      } else {
        setShowModal(null);
        setUsername("");
        setPassword("");
      }
    } finally {
      setSubmitting(false);
    }
  };

  return (
    <div className="auth-bar">
      {currentUser ? (
        <div className="auth-user-info">
          <span>
            Signed in as <strong>@{currentUser.username}</strong>
          </span>
          <button className="auth-btn-secondary" onClick={onLogout}>
            Sign Out
          </button>
        </div>
      ) : (
        <div className="auth-actions">
          <button
            className="auth-btn-secondary"
            onClick={() => {
              setShowModal("login");
              setFormError(null);
            }}
          >
            Sign In
          </button>
          <button
            className="auth-btn-primary"
            onClick={() => {
              setShowModal("register");
              setFormError(null);
            }}
          >
            Register
          </button>
        </div>
      )}

      {showModal && (
        <div className="modal-overlay">
          <div className="modal">
            <h3>{showModal === "login" ? "Sign In" : "Create Account"}</h3>
            {formError && <div className="error-banner">{formError}</div>}
            <form onSubmit={handleSubmit} className="auth-form">
              <input
                type="text"
                placeholder="Username"
                value={username}
                onChange={(e) => setUsername(e.target.value)}
                required
                autoFocus
              />
              <input
                type="password"
                placeholder={showModal === "register" ? "Password (min 6 chars)" : "Password"}
                value={password}
                onChange={(e) => setPassword(e.target.value)}
                required
              />
              <div className="modal-actions">
                <button
                  type="submit"
                  className="btn-danger"
                  disabled={submitting}
                >
                  {submitting
                    ? "Please wait..."
                    : showModal === "login"
                    ? "Sign In"
                    : "Register"}
                </button>
                <button
                  type="button"
                  className="btn-cancel"
                  onClick={() => setShowModal(null)}
                >
                  Cancel
                </button>
              </div>
            </form>
          </div>
        </div>
      )}
    </div>
  );
}
