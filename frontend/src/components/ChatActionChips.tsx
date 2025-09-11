import React, { useEffect, useRef, useState } from "react";
import "./ChatActionChips.css";
import { useLLMFormProcessor } from "../hooks/useLLMFormProcessor";

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
  pdfBytes?: Uint8Array; // For LLM processing
};

export default function ChatActionChips({
  todoEnabled,
  pendingCount,
  loading = false,
  active = false,
  onTodoClick,
  todoItems = [],
  pdfBytes,
}: Props) {
  const [open, setOpen] = useState(false);
  const rootRef = useRef<HTMLDivElement | null>(null);

  // LLM Form Processor integration
  const {
    isProcessing: llmProcessing,
    processPDFWithLLM,
    todoList: llmTodoList,
    updateTodoStatus,
    animationQueue,
    clearAnimationQueue,
  } = useLLMFormProcessor();

  // Close on outside click
  useEffect(() => {
    const onDocClick = (e: MouseEvent) => {
      if (!rootRef.current) return;
      if (!rootRef.current.contains(e.target as Node)) setOpen(false);
    };
    document.addEventListener("mousedown", onDocClick);
    return () => document.removeEventListener("mousedown", onDocClick);
  }, []);

  // Process PDF with LLM when pdfBytes are provided
  useEffect(() => {
    console.log("ChatActionChips: PDF processing check:", {
      hasPdfBytes: !!pdfBytes,
      pdfBytesLength: pdfBytes?.length,
      todoEnabled,
      llmProcessing,
    });

    // Send debug info to main process
    if (window.electronAPI?.debugLog) {
      window.electronAPI.debugLog(
        `ChatActionChips: PDF check - hasPdfBytes: ${!!pdfBytes}, length: ${
          pdfBytes?.length
        }, todoEnabled: ${todoEnabled}, llmProcessing: ${llmProcessing}`
      );
    }

    if (pdfBytes && pdfBytes.length > 0 && !llmProcessing) {
      console.log("Processing PDF with LLM for form detection...");
      if (window.electronAPI?.debugLog) {
        window.electronAPI.debugLog(
          "ChatActionChips: Starting PDF processing with LLM"
        );
      }
      console.log("🔥 ChatActionChips: About to call processPDFWithLLM function");
      const result = processPDFWithLLM(pdfBytes);
      console.log("🔥 ChatActionChips: processPDFWithLLM call result:", result);
    }
  }, [pdfBytes, todoEnabled, llmProcessing, processPDFWithLLM]);

  // Handle completion animations
  useEffect(() => {
    if (animationQueue.length > 0) {
      // Process animations with delay
      const timer = setTimeout(() => {
        clearAnimationQueue();
      }, 2000); // Clear animations after 2 seconds

      return () => clearTimeout(timer);
    }
  }, [animationQueue, clearAnimationQueue]);

  // Use LLM todo list if available, otherwise fallback to legacy todos
  const displayItems = llmTodoList?.categories || [];
  const hasLLMTodos = displayItems.length > 0;
  const legacyTodos = todoItems.length > 0 ? todoItems : [];

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
            {llmProcessing ? (
              <div className="processing-state">
                <div className="processing-icon">🔄</div>
                <div className="processing-text">Analyzing form with AI...</div>
                <div className="processing-subtext">
                  Detecting form fields and generating tasks
                </div>
              </div>
            ) : hasLLMTodos ? (
              // Render LLM-generated todos with categories
              displayItems.map((category) => (
                <div key={category.id} className="todo-category">
                  <div className="category-header">
                    <span className="category-icon">{category.icon}</span>
                    <span className="category-title">{category.name}</span>
                    <span className="category-progress">
                      {category.completed}/{category.total}
                    </span>
                  </div>
                  <div className="category-items">
                    {category.items.map((item) => (
                      <div
                        key={item.id}
                        className={`todo-item ${item.status} ${
                          animationQueue.find((a) => a.todoId === item.id)
                            ? "animating"
                            : ""
                        }`}
                      >
                        <label className="todo-checkbox">
                          <input
                            type="checkbox"
                            checked={item.status === "completed"}
                            onChange={() => {
                              const newStatus =
                                item.status === "completed"
                                  ? "pending"
                                  : "completed";
                              updateTodoStatus(item.id, newStatus);
                            }}
                          />
                          <span className="checkbox-custom">
                            {item.status === "completed" && (
                              <span className="checkmark">✓</span>
                            )}
                          </span>
                        </label>
                        <div className="item-content">
                          <span className="item-title">{item.title}</span>
                          <span className="item-description">
                            {item.description}
                          </span>
                          {item.required && (
                            <span className="required-badge">Required</span>
                          )}
                        </div>
                        <div className="item-meta">
                          <span className="item-time">
                            {item.estimatedTime}
                          </span>
                          <span
                            className={`item-priority priority-${item.priority}`}
                          >
                            {item.priority}
                          </span>
                        </div>
                      </div>
                    ))}
                  </div>
                </div>
              ))
            ) : legacyTodos.length > 0 ? (
              // Fallback to legacy todos
              legacyTodos.map((item, index) => (
                <div key={item.id} className="todo-item legacy">
                  <label className="todo-checkbox">
                    <input
                      type="checkbox"
                      checked={item.done || false}
                      onChange={() => {
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
            ) : (
              <div className="no-todos">
                <div className="no-todos-icon">📋</div>
                <div className="no-todos-text">No form fields detected</div>
                <div className="no-todos-subtext">
                  Load a PDF to see form fields
                </div>
              </div>
            )}
          </div>
        </div>
      )}
    </div>
  );
}
