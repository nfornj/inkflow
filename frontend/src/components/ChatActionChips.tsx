import React, { useEffect, useRef, useState } from "react";
import "./ChatActionChips.css";

type TodoItem = {
  id: string;
  title: string;
  category: string;
  done?: boolean;
};

type Props = {
  todoEnabled: boolean;
  pendingCount: number;
  loading?: boolean;
  active?: boolean;
  onTodoClick: () => void;
  todoItems?: TodoItem[];
};

export default function ChatActionChips({
  todoEnabled,
  pendingCount,
  loading = false,
  active = false,
  onTodoClick,
  todoItems = [],
}: Props) {
  const [open, setOpen] = useState(false);
  const rootRef = useRef<HTMLDivElement | null>(null);

  // Close on outside click
  useEffect(() => {
    const onDocClick = (e: MouseEvent) => {
      if (!rootRef.current) return;
      if (!rootRef.current.contains(e.target as Node)) setOpen(false);
    };
    document.addEventListener("mousedown", onDocClick);
    return () => document.removeEventListener("mousedown", onDocClick);
  }, []);

  // Use real todo items from OCR results
  const displayItems = todoItems.length > 0 ? todoItems : [];

  return (
    <div
      className="chat-action-chips"
      role="toolbar"
      aria-label="Chat actions"
      ref={rootRef}
    >
      <button
        className={`chip ${open ? "sliding" : ""} ${active ? "active" : ""}`}
        disabled={!todoEnabled}
        onClick={() => {
          onTodoClick?.();
          if (todoEnabled) setOpen((v) => !v);
        }}
        title={todoEnabled ? "Show Agent Tasks" : "Agent Tasks not available"}
      >
        <div className="chip-left">
          <span className="infinity-symbol">∞</span>
          <span className="chip-label">Agent Tasks</span>
        </div>
        <div className="chip-right">
          <span className="action-link selected">
            <span className="play-icon">▶</span>
            Run All
          </span>
        </div>
      </button>
      {open && (
        <div className="chip-popover" role="dialog" aria-label="Agent Tasks">
          <button
            className="popover-header"
            onClick={() => setOpen(false)}
            title="Hide Agent Tasks"
          >
            <div className="chip-left">
              <span className="infinity-symbol">∞</span>
              <span className="chip-label">Agent Tasks</span>
            </div>
            <div className="chip-right">
              <span className="action-link selected">
                <span className="play-icon">▶</span>
                Run All
              </span>
            </div>
          </button>
          <div className="popover-body">
            {displayItems.length === 0 ? (
              <div className="no-todos">
                <div className="no-todos-icon">📋</div>
                <div className="no-todos-text">No form fields detected</div>
                <div className="no-todos-subtext">
                  Load a PDF to see form fields
                </div>
              </div>
            ) : (
              displayItems.map((item, index) => (
                <div key={item.id} className="todo-item">
                  <label className="todo-checkbox">
                    <input
                      type="checkbox"
                      checked={item.done || false}
                      onChange={() => {
                        // Handle checkbox change - you can add this functionality later
                        console.log(`Toggled ${item.title}`);
                      }}
                    />
                    <span className="checkbox-custom"></span>
                  </label>
                  <div className="item-content">
                    <span className="item-title">{item.title}</span>
                    <span className="item-category">{item.category}</span>
                  </div>
                  <div className="item-icon">📝</div>
                </div>
              ))
            )}
          </div>
        </div>
      )}
    </div>
  );
}
