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
};

export default function ChatActionChips({
  todoEnabled,
  pendingCount,
  loading = false,
  active = false,
  onTodoClick,
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

  // Dummy data to mimic the screenshot
  const dummy: TodoItem[] = [
    { id: "1", title: "First Name", category: "Personal" },
    { id: "2", title: "Last Name", category: "Personal" },
    { id: "3", title: "Email Address", category: "Contact" },
    { id: "4", title: "Phone Number", category: "Contact" },
    { id: "5", title: "Current Employer", category: "Employment" },
    { id: "6", title: "Years of Experience", category: "Employment" },
  ];

  return (
    <div
      className="chat-action-chips"
      role="toolbar"
      aria-label="Chat actions"
      ref={rootRef}
    >
      <button
        className={`chip ${open || active ? "active" : ""}`}
        disabled={!todoEnabled}
        onClick={() => {
          onTodoClick?.();
          if (todoEnabled) setOpen((v) => !v);
        }}
        title={todoEnabled ? "Show Agent options" : "Agent not available"}
      >
        <div className="chip-left">
          <span className="infinity-symbol">∞</span>
          <span className="chip-label">Agent</span>
          <span className="shortcut">⌘I</span>
          <span className="caret">^</span>
        </div>
        <div className="chip-right">
          <button className="action-link">Undo All</button>
          <span className="separator">⌘⌫</span>
          <button className="action-link selected">Keep All</button>
          <span className="separator">⌘⏎</span>
        </div>
      </button>
      {open && (
        <div className="chip-popover" role="dialog" aria-label="Agent options">
          <div className="popover-header">
            <div className="header-left">
              <span className="collapse-icon">▼</span>
              <span className="item-count">{dummy.length} Fields</span>
            </div>
            <div className="header-right">
              <button className="action-link">Undo All</button>
              <span className="separator">⌘⌫</span>
              <button className="action-link selected">Keep All</button>
              <span className="separator">⌘⏎</span>
            </div>
          </div>
          <div className="popover-body">
            {dummy.map((d, index) => (
              <div key={d.id} className="todo-item">
                <div className="item-icon">📝</div>
                <div className="item-content">
                  <span className="item-title">{d.title}</span>
                  <span className="item-badge">+{index + 1}</span>
                </div>
              </div>
            ))}
          </div>
        </div>
      )}
    </div>
  );
}
