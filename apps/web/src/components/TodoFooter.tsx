import type { Filter } from "../types";

interface TodoFooterProps {
  activeCount: number;
  completedCount: number;
  filter: Filter;
  onFilterChange: (filter: Filter) => void;
  onClearCompleted: () => void;
}

export function TodoFooter({
  activeCount,
  completedCount,
  filter,
  onFilterChange,
  onClearCompleted,
}: TodoFooterProps) {
  return (
    <footer className="footer">
      <span className="todo-count">
        <strong>{activeCount}</strong> {activeCount === 1 ? "item" : "items"} left
      </span>
      <ul className="filters">
        <li>
          <button
            className={filter === "all" ? "selected" : ""}
            onClick={() => onFilterChange("all")}
          >
            All
          </button>
        </li>
        <li>
          <button
            className={filter === "active" ? "selected" : ""}
            onClick={() => onFilterChange("active")}
          >
            Active
          </button>
        </li>
        <li>
          <button
            className={filter === "completed" ? "selected" : ""}
            onClick={() => onFilterChange("completed")}
          >
            Completed
          </button>
        </li>
      </ul>
      {completedCount > 0 && (
        <button className="clear-completed" onClick={onClearCompleted}>
          Clear completed
        </button>
      )}
    </footer>
  );
}

