import React, { useState } from "react";
import type { ProjectItem } from "../types";

interface ProjectSidebarProps {
  projects: ProjectItem[];
  selectedProjectId: number | "inbox" | "all";
  onSelectProject: (id: number | "inbox" | "all") => void;
  onCreateProject: (name: string) => Promise<void>;
  onDeleteProjectClick: (project: ProjectItem) => void;
}

export function ProjectSidebar({
  projects,
  selectedProjectId,
  onSelectProject,
  onCreateProject,
  onDeleteProjectClick,
}: ProjectSidebarProps) {
  const [showInput, setShowInput] = useState(false);
  const [name, setName] = useState("");

  const handleSubmit = async (e: React.FormEvent) => {
    e.preventDefault();
    const trimmed = name.trim();
    if (!trimmed) return;
    await onCreateProject(trimmed);
    setName("");
    setShowInput(false);
  };

  return (
    <aside className="sidebar">
      <h2>Projects</h2>
      <ul className="project-list">
        <li
          className={selectedProjectId === "all" ? "active" : ""}
          onClick={() => onSelectProject("all")}
        >
          📁 All Tasks
        </li>
        <li
          className={selectedProjectId === "inbox" ? "active" : ""}
          onClick={() => onSelectProject("inbox")}
        >
          📥 Inbox
        </li>
        {projects.map((proj) => (
          <li
            key={proj.id}
            className={selectedProjectId === proj.id ? "active" : ""}
            onClick={() => onSelectProject(proj.id)}
          >
            <span>{proj.name}</span>
            <button
              className="delete-proj-btn"
              title="Delete project"
              onClick={(e) => {
                e.stopPropagation();
                onDeleteProjectClick(proj);
              }}
            >
              ×
            </button>
          </li>
        ))}
      </ul>

      {showInput ? (
        <form onSubmit={handleSubmit} className="new-project-form">
          <input
            type="text"
            placeholder="Project name"
            value={name}
            onChange={(e) => setName(e.target.value)}
            autoFocus
          />
          <div className="form-actions">
            <button type="submit">Add</button>
            <button type="button" onClick={() => setShowInput(false)}>
              Cancel
            </button>
          </div>
        </form>
      ) : (
        <button
          className="add-project-btn"
          onClick={() => setShowInput(true)}
        >
          + New Project
        </button>
      )}
    </aside>
  );
}

