import React from "react";
import "./ModernTodoList.css";

interface TodoItem {
  id: string;
  title: string;
  description?: string;
  completed: boolean;
  priority?: "high" | "medium" | "low";
}

interface TodoCategory {
  id: string;
  name: string;
  icon?: string;
  items: TodoItem[];
  completed: number;
  total: number;
}

interface ModernTodoListProps {
  categories: TodoCategory[];
  onItemToggle: (itemId: string) => void;
  onRunAll?: () => void;
  isLoading?: boolean;
  loadingMessage?: string;
  activeProvider?: string;
}

const ModernTodoList: React.FC<ModernTodoListProps> = ({
  categories,
  onItemToggle,
  onRunAll,
  isLoading = false,
  loadingMessage = "Analyzing document...",
  activeProvider = "LLM",
}) => {
  const totalItems = categories.reduce((sum, cat) => sum + cat.total, 0);
  const completedItems = categories.reduce(
    (sum, cat) => sum + cat.completed,
    0
  );

  return (
    <div className="modern-todo-container">
      {/* Header */}
      <div className="modern-todo-header">
        <div className="header-left">
          <span className="header-icon">∞</span>
          <span className="header-title">Agent Tasks</span>
          <span className="header-count">{isLoading ? "..." : totalItems}</span>
        </div>
        <button
          className="run-all-button"
          onClick={onRunAll}
          disabled={isLoading}
        >
          <span className="play-icon">▶</span>
          Run All
        </button>
      </div>

      {/* Content */}
      <div className="modern-todo-content">
        {isLoading ? (
          <div className="loading-state">
            <div className="loading-spinner">
              <div className="spinner-ring"></div>
              <div className="spinner-ring"></div>
              <div className="spinner-ring"></div>
            </div>
            <div className="loading-title">
              🤖 {activeProvider} Analyzing...
            </div>
            <div className="loading-subtitle">{loadingMessage}</div>
            <div className="loading-progress">
              <div className="progress-bar">
                <div className="progress-fill"></div>
              </div>
              <div className="progress-text">Detecting form fields...</div>
            </div>
          </div>
        ) : categories.length === 0 ? (
          <div className="empty-state">
            <div className="empty-icon">📝</div>
            <p className="empty-message">No tasks detected</p>
            <p className="empty-submessage">
              Load a form to see available tasks
            </p>
          </div>
        ) : (
          <div className="todo-categories">
            {categories.map((category) => (
              <div key={category.id} className="todo-category">
                {/* Category Header */}
                <div className="category-header">
                  <span className="category-icon">{category.icon || "📋"}</span>
                  <span className="category-name">{category.name}</span>
                  <span className="category-progress">
                    {category.completed}/{category.total}
                  </span>
                </div>

                {/* Category Items */}
                <div className="category-items">
                  {category.items.map((item) => (
                    <div
                      key={item.id}
                      className={`todo-item ${
                        item.completed ? "completed" : ""
                      }`}
                    >
                      <div className="item-checkbox-container">
                        <input
                          type="checkbox"
                          id={item.id}
                          checked={item.completed}
                          onChange={() => onItemToggle(item.id)}
                          className="item-checkbox"
                        />
                        <div className="checkbox-custom">
                          {item.completed && (
                            <span className="checkmark">✓</span>
                          )}
                        </div>
                      </div>

                      <div className="item-content">
                        <label htmlFor={item.id} className="item-title">
                          {item.title}
                        </label>
                        {item.description && (
                          <p className="item-description">{item.description}</p>
                        )}
                      </div>

                      {item.priority && (
                        <div
                          className={`priority-badge priority-${item.priority}`}
                        >
                          {item.priority}
                        </div>
                      )}
                    </div>
                  ))}
                </div>
              </div>
            ))}
          </div>
        )}
      </div>

      {/* Footer Progress */}
      {totalItems > 0 && (
        <div className="modern-todo-footer">
          <div className="progress-bar">
            <div
              className="progress-fill"
              style={{ width: `${(completedItems / totalItems) * 100}%` }}
            />
          </div>
          <div className="progress-text">
            {completedItems} of {totalItems} completed
          </div>
        </div>
      )}
    </div>
  );
};

export default ModernTodoList;
