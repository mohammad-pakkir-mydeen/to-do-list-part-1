import React, { useState } from "react";
import type { ProjectItem } from "../types";

interface ProjectSidebarProps {
  projects: ProjectItem[];
  selectedProjectId: number | "inbox" | "all";
  currentUserId: number;
  onSelectProject: (id: number | "inbox" | "all") => void;
  onCreateProject: (name: string, isShared: boolean) => Promise<void>;
  onSetProjectSharing: (project: ProjectItem, isShared: boolean) => Promise<void>;
  onDeleteProjectClick: (project: ProjectItem) => void;
}

export function ProjectSidebar({
  projects,
  selectedProjectId,
  currentUserId,
  onSelectProject,
  onCreateProject,
  onSetProjectSharing,
  onDeleteProjectClick,
}: ProjectSidebarProps) {
  const [showInput, setShowInput] = useState(false);
  const [name, setName] = useState("");
  const [isShared, setIsShared] = useState(false);

  const handleSubmit = async (e: React.FormEvent) => {
    e.preventDefault();
    const trimmed = name.trim();
    if (!trimmed) return;
    await onCreateProject(trimmed, isShared);
    setName("");
    setIsShared(false);
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
            <span>
              {proj.name}
              <small className="creator-label">
                Created by {proj.creator?.name ?? "Unknown"}
              </small>
              <small className="creator-label">
                {proj.isShared ? "Shared" : "Personal"}
              </small>
            </span>
            {proj.userId === currentUserId && (
              <button
                className="project-sharing-btn"
                type="button"
                title={proj.isShared ? "Make project personal" : "Share project"}
                onClick={(event) => {
                  event.stopPropagation();
                  onSetProjectSharing(proj, !proj.isShared);
                }}
              >
                {proj.isShared ? "Shared" : "Private"}
              </button>
            )}
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
          <label className="sharing-option">
            <input
              type="checkbox"
              checked={isShared}
              onChange={(event) => setIsShared(event.target.checked)}
            />
            Share this project with everyone
          </label>
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
