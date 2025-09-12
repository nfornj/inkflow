import React, { useEffect, useRef, useState } from "react";
import "./ChatActionChips.css";
import { useLLMFormProcessor } from "../hooks/useLLMFormProcessor";
import ModernTodoList from "./ModernTodoList";

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
  // Prevent repeated analyses and UI flicker
  const lastPdfSignatureRef = useRef<string | null>(null);
  const analyzingRef = useRef<boolean>(false);
  const [activeProvider, setActiveProvider] = useState<string>("LLM");

  const computePdfSignature = (bytes?: Uint8Array): string | null => {
    if (!bytes || bytes.length === 0) return null;
    const len = bytes.length;
    // Use first 16 bytes as a lightweight signature plus total length
    const sampleSize = Math.min(16, len);
    let head = "";
    for (let i = 0; i < sampleSize; i++) head += bytes[i].toString(16);
    return `${len}:${head}`;
  };

  // LLM Form Processor integration
  const {
    isProcessing: llmProcessing,
    processPDFWithLLM,
    resetAnalysis,
    todoList: llmTodoList,
    updateTodoStatus,
    animationQueue,
    clearAnimationQueue,
  } = useLLMFormProcessor();

  // Fetch active provider on mount
  useEffect(() => {
    const fetchActiveProvider = async () => {
      if (window.electronAPI?.getLLMProviders) {
        try {
          const result = await window.electronAPI.getLLMProviders();
          if (result.success && result.providers) {
            const activeProviderData = result.providers.find(
              (p: any) => p.active
            );
            if (activeProviderData) {
              setActiveProvider(activeProviderData.name);
            }
          }
        } catch (error) {
          console.error("Failed to fetch active provider:", error);
        }
      }
    };

    fetchActiveProvider();
  }, []);

  // Close on outside click
  useEffect(() => {
    const onDocClick = (e: MouseEvent) => {
      if (!rootRef.current) return;
      if (!rootRef.current.contains(e.target as Node)) setOpen(false);
    };
    document.addEventListener("mousedown", onDocClick);
    return () => document.removeEventListener("mousedown", onDocClick);
  }, []);

  // Reset analysis when pdf changes (tab switch or new upload)
  useEffect(() => {
    resetAnalysis();
    lastPdfSignatureRef.current = null;
  }, [pdfBytes, resetAnalysis]);

  // Process PDF with LLM when a NEW pdfBytes buffer is provided
  useEffect(() => {
    console.log("ChatActionChips: PDF processing check:", {
      hasPdfBytes: !!pdfBytes,
      pdfBytesLength: pdfBytes?.length,
      todoEnabled,
    });

    // Send debug info to main process
    if (window.electronAPI?.debugLog) {
      window.electronAPI.debugLog(
        `ChatActionChips: PDF check - hasPdfBytes: ${!!pdfBytes}, length: ${
          pdfBytes?.length
        }, todoEnabled: ${todoEnabled}, llmProcessing: ${llmProcessing}`
      );
    }

    const signature = computePdfSignature(pdfBytes);

    // Only trigger when we have a new PDF signature and we're not already analyzing
    if (
      todoEnabled &&
      pdfBytes &&
      pdfBytes.length > 0 &&
      signature &&
      lastPdfSignatureRef.current !== signature &&
      !analyzingRef.current
    ) {
      console.log("Processing PDF with LLM for form detection...");
      if (window.electronAPI?.debugLog) {
        window.electronAPI.debugLog(
          "ChatActionChips: Starting PDF processing with LLM"
        );
      }
      console.log(
        "🔥 ChatActionChips: About to call processPDFWithLLM function"
      );

      // Properly handle the async call
      analyzingRef.current = true;
      processPDFWithLLM(pdfBytes)
        .then((result) => {
          console.log(
            "🔥 ChatActionChips: processPDFWithLLM completed with result:",
            result
          );
          if (window.electronAPI?.debugLog) {
            window.electronAPI.debugLog(
              `ChatActionChips: processPDFWithLLM completed: ${result}`
            );
          }
          // Mark this PDF as processed successfully
          lastPdfSignatureRef.current = signature;
        })
        .catch((error) => {
          console.error("🚨 ChatActionChips: processPDFWithLLM failed:", error);
          if (window.electronAPI?.debugLog) {
            window.electronAPI.debugLog(
              `ChatActionChips: processPDFWithLLM failed: ${error}`
            );
          }
        })
        .finally(() => {
          analyzingRef.current = false;
        });
    }
    // Note: deliberately exclude llmProcessing to avoid re-trigger flicker
  }, [pdfBytes, todoEnabled, processPDFWithLLM]);

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

  // Always show analyzer results only; if none, show empty state
  const finalDisplayItems = displayItems;
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
          {llmProcessing && !hasLLMTodos ? (
            <div className="processing-state">
              <div className="processing-icon">🔄</div>
              <div className="processing-text">Analyzing form with AI...</div>
              <div className="processing-subtext">
                Detecting form fields and generating tasks
              </div>
            </div>
          ) : (
            <ModernTodoList
              categories={finalDisplayItems.map((category: any) => ({
                id: category.id,
                name: category.name,
                icon: category.icon,
                items: category.items.map((item: any) => ({
                  id: item.id,
                  title: item.title,
                  description: item.description,
                  completed: item.status === "completed",
                  priority: item.priority as "high" | "medium" | "low",
                })),
                completed: category.completed,
                total: category.total,
              }))}
              isLoading={llmProcessing}
              loadingMessage={`Analyzing document with ${activeProvider}...`}
              activeProvider={activeProvider}
              onItemToggle={(itemId) => {
                console.log("🔥 Todo item toggled:", itemId);
                // Find the item and toggle its status
                const item = finalDisplayItems
                  .flatMap((cat: any) => cat.items)
                  .find((item: any) => item.id === itemId);
                if (item) {
                  const newStatus =
                    item.status === "completed" ? "pending" : "completed";
                  console.log(
                    "🔥 Updating todo status:",
                    itemId,
                    "to",
                    newStatus
                  );
                  if (hasLLMTodos) {
                    updateTodoStatus(itemId, newStatus);
                  }
                }
              }}
              onRunAll={() => {
                console.log("🔥 Run all tasks clicked");
                // Implement run all functionality
              }}
            />
          )}
        </div>
      )}
    </div>
  );
}
