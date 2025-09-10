import React, { useState, useCallback } from "react";
import { TodoCategory, TodoItem } from "../utils/todoGenerator";
import {
  CheckIcon,
  CircleIcon,
  ClockIcon,
  LightningBoltIcon,
  ChevronDownIcon,
  ChevronRightIcon,
  InfoCircledIcon,
  StarFilledIcon,
  TimerIcon,
  ReloadIcon,
} from "@radix-ui/react-icons";
import "./FormTodoList.css";

interface FormTodoListProps {
  categories: TodoCategory[];
  totalItems: number;
  completedItems: number;
  progress: number;
  estimatedTotalTime: string;
  nextAction?: TodoItem;
  onItemClick: (todoId: string, item: TodoItem) => void;
  onItemStatusChange: (todoId: string, status: TodoItem["status"]) => void;
  onRefresh?: () => void;
  isProcessing?: boolean;
}

const FormTodoList: React.FC<FormTodoListProps> = ({
  categories,
  totalItems,
  completedItems,
  progress,
  estimatedTotalTime,
  nextAction,
  onItemClick,
  onItemStatusChange,
  onRefresh,
  isProcessing = false,
}) => {
  const [expandedCategories, setExpandedCategories] = useState<Set<string>>(
    new Set()
  );
  const [showTips, setShowTips] = useState<Set<string>>(new Set());

  const toggleCategory = useCallback((categoryName: string) => {
    setExpandedCategories((prev) => {
      const newSet = new Set(prev);
      if (newSet.has(categoryName)) {
        newSet.delete(categoryName);
      } else {
        newSet.add(categoryName);
      }
      return newSet;
    });
  }, []);

  const toggleTips = useCallback((itemId: string) => {
    setShowTips((prev) => {
      const newSet = new Set(prev);
      if (newSet.has(itemId)) {
        newSet.delete(itemId);
      } else {
        newSet.add(itemId);
      }
      return newSet;
    });
  }, []);

  const handleStatusToggle = useCallback(
    (item: TodoItem, event: React.MouseEvent) => {
      event.stopPropagation();
      const newStatus = item.status === "completed" ? "pending" : "completed";
      onItemStatusChange(item.id, newStatus);
    },
    [onItemStatusChange]
  );

  const getStatusIcon = (status: TodoItem["status"]) => {
    switch (status) {
      case "completed":
        return <CheckIcon className="status-icon status-completed" />;
      case "in_progress":
        return (
          <ReloadIcon className="status-icon status-in-progress spinning" />
        );
      case "skipped":
        return <CircleIcon className="status-icon status-skipped" />;
      default:
        return <CircleIcon className="status-icon status-pending" />;
    }
  };

  const getPriorityIcon = (priority: TodoItem["priority"]) => {
    switch (priority) {
      case "high":
        return <LightningBoltIcon className="priority-icon priority-high" />;
      case "medium":
        return <StarFilledIcon className="priority-icon priority-medium" />;
      default:
        return null;
    }
  };

  if (isProcessing) {
    return (
      <div className="form-todo-list processing">
        <div className="processing-header">
          <ReloadIcon className="spinning" />
          <h3>Analyzing Form Fields...</h3>
          <p>Using AI to identify fillable fields in your PDF</p>
        </div>
      </div>
    );
  }

  if (categories.length === 0) {
    return (
      <div className="form-todo-list empty">
        <div className="empty-state">
          <CircleIcon className="empty-icon" />
          <h3>No Form Fields Detected</h3>
          <p>This PDF doesn't appear to contain fillable form fields.</p>
          {onRefresh && (
            <button className="refresh-btn" onClick={onRefresh}>
              <ReloadIcon />
              Scan Again
            </button>
          )}
        </div>
      </div>
    );
  }

  return (
    <div className="form-todo-list">
      {/* Header with progress */}
      <div className="todo-header">
        <div className="header-title">
          <h3>Form Completion</h3>
          <div className="header-stats">
            <span className="progress-text">
              {completedItems} of {totalItems} completed
            </span>
            <div className="estimated-time">
              <TimerIcon />
              <span>{estimatedTotalTime} remaining</span>
            </div>
          </div>
        </div>

        <div className="progress-bar">
          <div className="progress-fill" style={{ width: `${progress}%` }} />
          <span className="progress-percentage">{progress}%</span>
        </div>
      </div>

      {/* Next Action Highlight */}
      {nextAction && (
        <div
          className="next-action"
          onClick={() => onItemClick(nextAction.id, nextAction)}
        >
          <div className="next-action-header">
            <LightningBoltIcon className="next-action-icon" />
            <span>Up Next</span>
          </div>
          <div className="next-action-content">
            <h4>{nextAction.title}</h4>
            <p>{nextAction.description}</p>
            <div className="next-action-meta">
              <span className="time-estimate">
                <ClockIcon />
                {nextAction.estimatedTime}
              </span>
              {nextAction.required && (
                <span className="required-badge">Required</span>
              )}
            </div>
          </div>
        </div>
      )}

      {/* Categories */}
      <div className="todo-categories">
        {categories.map((category) => {
          const isExpanded = expandedCategories.has(category.name);
          const hasItems = category.items.length > 0;

          return (
            <div key={category.name} className="todo-category">
              <div
                className="category-header"
                onClick={() => hasItems && toggleCategory(category.name)}
              >
                <div className="category-title">
                  <span className="category-icon">{category.icon}</span>
                  <div className="category-info">
                    <h4>{category.name}</h4>
                    <p>{category.description}</p>
                  </div>
                </div>
                <div className="category-meta">
                  <span className="category-progress">
                    {category.completed}/{category.total}
                  </span>
                  {hasItems && (
                    <button className="expand-btn">
                      {isExpanded ? <ChevronDownIcon /> : <ChevronRightIcon />}
                    </button>
                  )}
                </div>
              </div>

              {isExpanded && hasItems && (
                <div className="category-items">
                  {category.items.map((item) => (
                    <div key={item.id} className="todo-item-container">
                      <div
                        className={`todo-item ${item.status} priority-${item.priority}`}
                        onClick={() => onItemClick(item.id, item)}
                      >
                        <div className="item-content">
                          <div className="item-header">
                            <button
                              className="status-btn"
                              onClick={(e) => handleStatusToggle(item, e)}
                              title={`Mark as ${
                                item.status === "completed"
                                  ? "pending"
                                  : "completed"
                              }`}
                            >
                              {getStatusIcon(item.status)}
                            </button>
                            <div className="item-info">
                              <h5>{item.title}</h5>
                              <p>{item.description}</p>
                            </div>
                            <div className="item-meta">
                              {getPriorityIcon(item.priority)}
                              <span className="time-estimate">
                                <ClockIcon />
                                {item.estimatedTime}
                              </span>
                              {item.required && (
                                <span className="required-badge">Required</span>
                              )}
                            </div>
                          </div>

                          {item.formFields.length > 1 && (
                            <div className="field-count">
                              {item.formFields.length} fields
                            </div>
                          )}
                        </div>

                        {item.tips && item.tips.length > 0 && (
                          <button
                            className="tips-btn"
                            onClick={(e) => {
                              e.stopPropagation();
                              toggleTips(item.id);
                            }}
                            title="Show tips"
                          >
                            <InfoCircledIcon />
                          </button>
                        )}
                      </div>

                      {showTips.has(item.id) && item.tips && (
                        <div className="item-tips">
                          <div className="tips-header">
                            <InfoCircledIcon />
                            <span>Tips for completion:</span>
                          </div>
                          <ul>
                            {item.tips.map((tip, index) => (
                              <li key={index}>{tip}</li>
                            ))}
                          </ul>
                        </div>
                      )}
                    </div>
                  ))}
                </div>
              )}
            </div>
          );
        })}
      </div>

      {/* Footer Actions */}
      <div className="todo-footer">
        {onRefresh && (
          <button className="secondary-btn" onClick={onRefresh}>
            <ReloadIcon />
            Rescan Form
          </button>
        )}
        <div className="footer-progress">
          <div className="completion-ring">
            <svg viewBox="0 0 36 36" className="circular-chart">
              <path
                className="circle-bg"
                d="M18 2.0845
                  a 15.9155 15.9155 0 0 1 0 31.831
                  a 15.9155 15.9155 0 0 1 0 -31.831"
              />
              <path
                className="circle"
                strokeDasharray={`${progress}, 100`}
                d="M18 2.0845
                  a 15.9155 15.9155 0 0 1 0 31.831
                  a 15.9155 15.9155 0 0 1 0 -31.831"
              />
            </svg>
            <div className="percentage">{progress}%</div>
          </div>
        </div>
      </div>
    </div>
  );
};

export default FormTodoList;
