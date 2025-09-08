import React from "react";

type Tool = "select" | "text" | "checkbox" | "signature";

interface EditorToolbarProps {
  activeTool: Tool;
  onToolChange: (tool: Tool) => void;
  onSave: () => void;
}

const buttonStyle: React.CSSProperties = {
  padding: "6px 8px",
  border: "1px solid #ccc",
  borderRadius: "6px",
  background: "white",
  cursor: "pointer",
  fontSize: "12px",
};

export const EditorToolbar: React.FC<EditorToolbarProps> = ({
  activeTool,
  onToolChange,
  onSave,
}) => {
  const tools: { key: Tool; label: string }[] = [
    { key: "select", label: "Select" },
    { key: "text", label: "Add Text" },
    { key: "checkbox", label: "Checkbox" },
    { key: "signature", label: "Signature" },
  ];

  return (
    <div
      style={{
        position: "absolute",
        top: 12,
        right: 12,
        display: "flex",
        gap: 8,
        zIndex: 1100,
        background: "rgba(255,255,255,0.9)",
        border: "1px solid #ddd",
        borderRadius: 8,
        padding: 8,
        boxShadow: "0 2px 6px rgba(0,0,0,0.15)",
      }}
    >
      {tools.map((t) => (
        <button
          key={t.key}
          onClick={() => onToolChange(t.key)}
          style={{
            ...buttonStyle,
            background: activeTool === t.key ? "#e6f0ff" : "white",
            borderColor: activeTool === t.key ? "#8ab4f8" : "#ccc",
          }}
        >
          {t.label}
        </button>
      ))}
      <button
        onClick={onSave}
        style={{ ...buttonStyle, background: "#007acc", color: "white" }}
      >
        Save
      </button>
    </div>
  );
};

export default EditorToolbar;
