import React, { useRef, useState } from "react";

interface AuthScreenProps {
  initialError?: string | null;
  onLogin: (
    email: string,
    password: string
  ) => Promise<{ success: boolean; error?: string }>;
  onSignup: (
    name: string,
    email: string,
    password: string
  ) => Promise<{ success: boolean; error?: string }>;
}

export function AuthScreen({ initialError, onLogin, onSignup }: AuthScreenProps) {
  const [mode, setMode] = useState<"login" | "signup">("login");
  const [name, setName] = useState("");
  const [email, setEmail] = useState("");
  const [password, setPassword] = useState("");
  const [error, setError] = useState<string | null>(null);
  const [notice, setNotice] = useState<string | null>(null);
  const [submitting, setSubmitting] = useState(false);
  const submissionInProgress = useRef(false);

  const switchMode = (nextMode: "login" | "signup") => {
    setMode(nextMode);
    setError(null);
    setNotice(null);
  };

  const handleSubmit = async (event: React.FormEvent) => {
    event.preventDefault();
    if (submissionInProgress.current) return;
    submissionInProgress.current = true;
    setError(null);
    setNotice(null);
    setSubmitting(true);

    try {
      const result =
        mode === "signup"
          ? await onSignup(name, email, password)
          : await onLogin(email, password);

      if (!result.success) {
        setError(result.error || "Authentication failed");
        return;
      }

      if (mode === "signup") {
        setMode("login");
        setPassword("");
        setNotice("Account created. Sign in with your email and password.");
      }
    } finally {
      submissionInProgress.current = false;
      setSubmitting(false);
    }
  };

  return (
    <main className="auth-screen">
      <section className="auth-card">
        <h1>{mode === "login" ? "Welcome back" : "Create your account"}</h1>
        <p className="auth-intro">
          {mode === "login"
            ? "Sign in to continue to your to-do list."
            : "Sign up to organize your to-dos and projects."}
        </p>

        {notice && <div className="auth-notice">{notice}</div>}
        {(error || initialError) && (
          <div className="error-banner" role="alert">{error || initialError}</div>
        )}

        <form className="auth-form" onSubmit={handleSubmit}>
          {mode === "signup" && (
            <label>
              Name
              <input
                type="text"
                autoComplete="name"
                value={name}
                onChange={(event) => setName(event.target.value)}
                required
                maxLength={100}
              />
            </label>
          )}
          <label>
            Email
            <input
              type="email"
              autoComplete="email"
              value={email}
              onChange={(event) => setEmail(event.target.value)}
              required
              maxLength={254}
            />
          </label>
          <label>
            Password
            <input
              type="password"
              autoComplete={mode === "signup" ? "new-password" : "current-password"}
              value={password}
              onChange={(event) => setPassword(event.target.value)}
              required
              minLength={mode === "signup" ? 8 : 1}
              maxLength={1024}
            />
          </label>
          <button type="submit" disabled={submitting}>
            {submitting
              ? "Please wait..."
              : mode === "login"
              ? "Sign in"
              : "Create account"}
          </button>
        </form>

        <p className="auth-switch">
          {mode === "login" ? "Need an account?" : "Already registered?"}{" "}
          <button
            type="button"
            onClick={() => switchMode(mode === "login" ? "signup" : "login")}
          >
            {mode === "login" ? "Sign up" : "Sign in"}
          </button>
        </p>
      </section>
    </main>
  );
}
