import type { ProjectItem } from "../types";

interface DeleteProjectModalProps {
  project: ProjectItem;
  onConfirm: (deleteTodos: boolean) => void;
  onCancel: () => void;
}

export function DeleteProjectModal({
  project,
  onConfirm,
  onCancel,
}: DeleteProjectModalProps) {
  return (
    <div className="modal-overlay">
      <div className="modal">
        <h3>Delete Project "{project.name}"</h3>
        <p>What would you like to do with the to-dos in this project?</p>
        <div className="modal-actions">
          <button
            className="btn-danger"
            onClick={() => onConfirm(true)}
          >
            Delete project and its to-dos
          </button>
          <button
            className="btn-warning"
            onClick={() => onConfirm(false)}
          >
            Move to-dos to Inbox
          </button>
          <button className="btn-cancel" onClick={onCancel}>
            Cancel
          </button>
        </div>
      </div>
    </div>
  );
}

