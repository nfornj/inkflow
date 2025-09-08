import React, { useEffect, useRef, useState } from "react";
import * as pdfjsLib from "pdfjs-dist";
import "pdfjs-dist/build/pdf.worker.entry";
import { detectWidgetsPdfJs, DetectedField } from "./detect/detectWidgetsPdfJs";
import EditorToolbar from "../components/EditorToolbar";

try {
  // Use CDN worker to avoid blank canvas if bundler path fails
  (
    pdfjsLib as any
  ).GlobalWorkerOptions.workerSrc = `https://cdnjs.cloudflare.com/ajax/libs/pdf.js/${
    (pdfjsLib as any).version
  }/pdf.worker.min.js`;
} catch {}

export default function NewPdfEditor({ pdfBytes }: { pdfBytes: Uint8Array }) {
  const canvasRef = useRef<HTMLCanvasElement>(null);
  const containerRef = useRef<HTMLDivElement>(null);
  const [scale, setScale] = useState(1.25);
  const [page, setPage] = useState<any>(null);
  const [doc, setDoc] = useState<any>(null);
  const [fields, setFields] = useState<DetectedField[]>([]);
  const [formData, setFormData] = useState<Record<string, any>>({});
  const [tool, setTool] = useState<
    "select" | "text" | "checkbox" | "signature"
  >("select");
  const handleToolChange = (t: "select" | "text" | "checkbox" | "signature") =>
    setTool(t);
  const [loadError, setLoadError] = useState<string | null>(null);

  useEffect(() => {
    (async () => {
      // Clone bytes to avoid detached ArrayBuffer issues from upstream sources
      const bytesCopy = new Uint8Array(pdfBytes);
      const loadingTask = (pdfjsLib as any).getDocument({
        data: bytesCopy,
        disableWorker: false,
      });
      const d = await loadingTask.promise;
      setDoc(d);
      const p = await d.getPage(1);
      setPage(p);
      const detected = await detectWidgetsPdfJs(bytesCopy);
      setFields(detected);
      setFormData(
        Object.fromEntries(
          detected.map((f) => [
            f.name,
            f.value ?? (f.type === "checkbox" ? false : ""),
          ])
        )
      );
    })().catch((err) => {
      console.error("NewPdfEditor: load error", err);
      setLoadError(err?.message || String(err));
    });
  }, [pdfBytes]);

  // Compute scale to fit container width
  useEffect(() => {
    if (!page || !containerRef.current) return;
    try {
      const v1 = page.getViewport({ scale: 1 });
      const containerWidth = Math.max(
        600,
        containerRef.current.clientWidth || 0
      );
      const nextScale = containerWidth / v1.width;
      setScale(nextScale);
    } catch (err) {
      console.error("NewPdfEditor: scale compute error", err);
    }
  }, [page]);

  useEffect(() => {
    if (!page || !canvasRef.current) return;
    const viewport = page.getViewport({ scale });
    const canvas = canvasRef.current;
    const ctx = canvas.getContext("2d")!;
    canvas.width = viewport.width;
    canvas.height = viewport.height;
    canvas.style.width = `${viewport.width}px`;
    canvas.style.height = `${viewport.height}px`;
    page.render({ canvasContext: ctx, viewport }).promise.catch((err: any) => {
      console.error("NewPdfEditor: render error", err);
      setLoadError(err?.message || String(err));
    });
  }, [page, scale]);

  const placeManual = (e: React.MouseEvent) => {
    if (tool === "select") return;
    const rect = containerRef.current!.getBoundingClientRect();
    const x = e.clientX - rect.left;
    const y = e.clientY - rect.top;
    const id = `manual_${Date.now()}`;
    const field: DetectedField =
      tool === "text"
        ? {
            id,
            name: `Text_${fields.length + 1}`,
            type: "text",
            x: x - 140,
            y: y - 19,
            width: 280,
            height: 38,
            pageNumber: 1,
            source: "acroform",
          }
        : tool === "checkbox"
        ? {
            id,
            name: `Checkbox_${fields.length + 1}`,
            type: "checkbox",
            x: x - 10,
            y: y - 10,
            width: 20,
            height: 20,
            pageNumber: 1,
            source: "acroform",
          }
        : {
            id,
            name: `Signature_${fields.length + 1}`,
            type: "signature",
            x: x - 110,
            y: y - 28,
            width: 220,
            height: 56,
            pageNumber: 1,
            source: "acroform",
          };
    setFields((prev) => [...prev, field]);
    setTool("select");
  };

  const save = async () => {
    const payload = fields.map((f) => ({
      name: f.name,
      type: f.type,
      pageNumber: f.pageNumber,
      x: f.x,
      y: f.y,
      width: f.width,
      height: f.height,
      value: formData[f.name],
    }));
    const buffer = new Uint8Array(pdfBytes);
    if (!window.electronAPI?.pdfFinalizerFinalize) {
      alert("PDF finalizer API not available");
      return;
    }
    const res = await window.electronAPI.pdfFinalizerFinalize(buffer, payload, {
      fontSize: 13,
    });
    if (!res.success || !res.data) {
      alert(`Failed to save: ${res.error || "Unknown error"}`);
      return;
    }
    const bytes = new Uint8Array(res.data as any);
    await window.electronAPI.saveFileDialog(bytes, "filled.pdf");
  };

  return (
    <div
      style={{
        position: "relative",
        width: "100%",
        height: "100%",
        overflow: "auto",
        display: "flex",
        justifyContent: "center",
        alignItems: "flex-start",
        background: "#f4f5f7",
        paddingTop: 24,
      }}
    >
      <div
        ref={containerRef}
        onClick={placeManual}
        style={{
          position: "relative",
          display: "inline-block",
          minWidth: 800,
          minHeight: 600,
          background: "#fff",
        }}
      >
        <canvas
          ref={canvasRef}
          style={{ display: "block", background: "#fff" }}
        />
        {loadError && (
          <div
            style={{
              position: "absolute",
              top: 16,
              left: 16,
              background: "#fee",
              color: "#900",
              padding: 8,
              border: "1px solid #f99",
              borderRadius: 6,
              zIndex: 5,
            }}
          >
            Failed to load PDF: {loadError}
          </div>
        )}
        {fields.map((f) => (
          <div
            key={f.id}
            style={{
              position: "absolute",
              left: f.x,
              top: f.y,
              width: f.width,
              height: f.height,
              background: "rgba(255,255,255,0.96)",
              border: "2px solid #7D89FF",
              borderRadius: 6,
              boxShadow: "0 2px 6px rgba(0,0,0,0.12)",
              padding: 4,
              boxSizing: "border-box",
            }}
          >
            {f.type === "text" && (
              <input
                style={{
                  width: "100%",
                  height: "100%",
                  border: "none",
                  outline: "none",
                  background: "transparent",
                  fontFamily: "Helvetica, Arial, sans-serif",
                  fontSize: 13,
                }}
                value={formData[f.name] || ""}
                onChange={(e) =>
                  setFormData({ ...formData, [f.name]: e.target.value })
                }
                placeholder={`Enter ${f.name}...`}
              />
            )}
            {f.type === "checkbox" && (
              <input
                type="checkbox"
                checked={!!formData[f.name]}
                onChange={(e) =>
                  setFormData({ ...formData, [f.name]: e.target.checked })
                }
                style={{ width: 16, height: 16 }}
              />
            )}
            {f.type === "signature" && (
              <div
                onClick={() => {
                  const s = prompt("Enter signature text");
                  if (s) setFormData({ ...formData, [f.name]: s });
                }}
                style={{
                  width: "100%",
                  height: "100%",
                  display: "flex",
                  alignItems: "center",
                  justifyContent: "center",
                  border: "1px dashed #999",
                  cursor: "pointer",
                  fontFamily: "Helvetica, Arial, sans-serif",
                }}
              >
                {formData[f.name] || "Click to sign"}
              </div>
            )}
          </div>
        ))}
      </div>
      <EditorToolbar
        activeTool={tool}
        onToolChange={handleToolChange}
        onSave={save}
      />
    </div>
  );
}
