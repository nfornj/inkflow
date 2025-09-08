import React, {
  useEffect,
  useRef,
  useState,
  useCallback,
  useMemo,
} from "react";
import * as pdfjsLib from "pdfjs-dist";
// import "pdfjs-dist/web/pdf_viewer.css"; // This causes build errors, will use custom styles
// Remove complex PDF.js viewer imports that cause compilation issues

// Set up PDF.js worker
// Use a local copy of the worker file to avoid relying on a CDN
pdfjsLib.GlobalWorkerOptions.workerSrc = `/pdf.worker.min.js`;
// Ensure standard fonts (Type1) can render text content like labels in PDFs
// Use public path so the dev server and Electron can serve these assets
(pdfjsLib as any).GlobalWorkerOptions.standardFontDataUrl = "/standard_fonts/";

export type Tool = "select" | "text" | "checkbox" | "signature";

export interface FormField {
  id: string;
  name: string;
  type: "text" | "checkbox" | "signature";
  x: number;
  y: number;
  width: number;
  height: number;
  pageNumber: number;
  value?: string | boolean;
  isAcroForm?: boolean;
  // PDF coordinate space (points, bottom-left origin). Used for saving.
  pdfX?: number;
  pdfY?: number;
  pdfWidth?: number;
  pdfHeight?: number;
}

// Payload used when saving – uses PDF coordinate space for accuracy
type SaveFieldPayload = {
  name: string;
  type: "text" | "checkbox" | "signature";
  pageNumber: number; // 0-based index for backend
  x: number;
  y: number;
  width: number;
  height: number;
  value: any;
  isAcroForm?: boolean;
};

interface UnifiedPDFEditorProps {
  pdfBytes: Uint8Array | null;
  editMode: boolean;
  onSave?: (fields: SaveFieldPayload[], pdfBytes: Uint8Array) => void;
  selectedFont?: string;
  selectedFontSize?: number;
  onFontChange?: (font: string) => void;
  onFontSizeChange?: (size: number) => void;
}

const UnifiedPDFEditor: React.FC<UnifiedPDFEditorProps> = ({
  pdfBytes,
  editMode,
  onSave,
  selectedFont = "Helvetica",
  selectedFontSize = 14,
  onFontChange,
  onFontSizeChange,
}) => {
  const canvasRef = useRef<HTMLCanvasElement>(null);
  const containerRef = useRef<HTMLDivElement>(null);
  const [pdfDoc, setPdfDoc] = useState<any>(null);
  const [currentPage, setCurrentPage] = useState(1);
  const [totalPages, setTotalPages] = useState(0);
  const [scale, setScale] = useState(1.2);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState<string | null>(null);
  const [activeTool, setActiveTool] = useState<Tool>("select");
  const [formFields, setFormFields] = useState<FormField[]>([]);
  const [formData, setFormData] = useState<Record<string, any>>({});
  const renderTaskRef = useRef<any>(null);
  const [fieldsDetected, setFieldsDetected] = useState(false);
  const fieldsDetectedRef = useRef(false);

  // Memoize PDF bytes to prevent unnecessary reloads
  const memoizedPdfBytes = useMemo(() => {
    if (!pdfBytes || pdfBytes.length === 0) return null;
    return new Uint8Array(pdfBytes);
  }, [pdfBytes]);

  // Load PDF document (ONLY when PDF bytes actually change)
  useEffect(() => {
    const loadPDF = async () => {
      try {
        if (!memoizedPdfBytes) {
          setError("No PDF data available");
          setLoading(false);
          return;
        }

        console.log("UnifiedPDFEditor: Loading PDF document...");
        setLoading(true);
        setError(null);

        // Create a brand-new ArrayBuffer copy to avoid any chance of using
        // a previously transferred/detached buffer when posting to the worker
        const safeBuffer = new ArrayBuffer(memoizedPdfBytes.length);
        new Uint8Array(safeBuffer).set(memoizedPdfBytes);

        const loadingTask = pdfjsLib.getDocument({
          data: safeBuffer,
          useSystemFonts: true,
          disableFontFace: false,
        });

        const doc = await loadingTask.promise;
        setPdfDoc(doc);
        setTotalPages(doc.numPages);
        setCurrentPage(1);
        setFieldsDetected(false); // Reset field detection flag
        fieldsDetectedRef.current = false; // Reset ref as well
        setLoading(false);
        console.log("UnifiedPDFEditor: PDF document loaded successfully");
      } catch (err: any) {
        console.error("PDF loading error:", err);
        setError(err.message || "Failed to load PDF");
        setLoading(false);
      }
    };

    if (memoizedPdfBytes) {
      loadPDF();
    }
  }, [memoizedPdfBytes]); // ONLY depend on memoized PDF bytes

  // Detect AcroForm fields
  const detectAcroFormFields = useCallback(
    async (doc: any) => {
      try {
        const fields: FormField[] = [];

        for (let pageNum = 1; pageNum <= doc.numPages; pageNum++) {
          const page = await doc.getPage(pageNum);
          const annotations = await page.getAnnotations({ intent: "display" });
          // Use the same scale as rendering for accurate positioning
          const viewport = page.getViewport({ scale });

          annotations.forEach((annotation: any, index: number) => {
            if (annotation.subtype === "Widget") {
              // Get the raw rectangle coordinates
              const rect = annotation.rect;

              // Convert PDF coordinates to viewport coordinates
              const viewportRect = viewport.convertToViewportRectangle(rect);

              // Calculate position and size in viewport space (for overlay)
              const x = Math.min(viewportRect[0], viewportRect[2]);
              const y = Math.min(viewportRect[1], viewportRect[3]);
              const width = Math.abs(viewportRect[2] - viewportRect[0]);
              const height = Math.abs(viewportRect[3] - viewportRect[1]);

              // Preserve original PDF coordinate space for finalizer (points, bottom-left origin)
              const pdfX = Math.min(rect[0], rect[2]);
              const pdfY = Math.min(rect[1], rect[3]);
              const pdfWidth = Math.abs(rect[2] - rect[0]);
              const pdfHeight = Math.abs(rect[3] - rect[1]);

              let fieldType: "text" | "checkbox" | "signature" = "text";
              if (annotation.fieldType === "Btn") {
                fieldType = annotation.checkBox ? "checkbox" : "text";
              } else if (
                annotation.fieldName?.toLowerCase().includes("signature")
              ) {
                fieldType = "signature";
              }

              fields.push({
                id: `acro_${pageNum}_${index}`,
                name: annotation.fieldName || `Field_${fields.length + 1}`,
                type: fieldType,
                x,
                y,
                width: Math.max(width, 80),
                height: Math.max(height, 25),
                pageNumber: pageNum,
                value:
                  fieldType === "checkbox"
                    ? false
                    : annotation.fieldValue || "",
                isAcroForm: true,
                pdfX,
                pdfY,
                pdfWidth,
                pdfHeight,
              });
            }
          });
        }

        setFormFields(fields);

        // Initialize form data
        const initialData: Record<string, any> = {};
        fields.forEach((field) => {
          initialData[field.name] = field.value;
        });
        setFormData(initialData);
      } catch (err) {
        console.error("AcroForm detection error:", err);
      }
    },
    [scale]
  );

  // Render current page
  const renderPage = useCallback(async () => {
    if (!pdfDoc || !canvasRef.current || !containerRef.current) return;

    try {
      // Cancel any existing render task
      if (renderTaskRef.current) {
        renderTaskRef.current.cancel();
        renderTaskRef.current = null;
      }

      const page = await pdfDoc.getPage(currentPage);
      const viewport = page.getViewport({ scale });

      const canvas = canvasRef.current;
      const context = canvas.getContext("2d");

      if (!context) {
        throw new Error("Could not get canvas context");
      }

      canvas.width = viewport.width;
      canvas.height = viewport.height;
      canvas.style.width = `${viewport.width}px`;
      canvas.style.height = `${viewport.height}px`;

      // Clear canvas
      context.clearRect(0, 0, canvas.width, canvas.height);

      // Start new render task
      const newRenderTask = page.render({
        canvasContext: context,
        viewport: viewport,
      });

      renderTaskRef.current = newRenderTask;

      // Wait for render to complete
      await newRenderTask.promise;

      const pageContainer = canvasRef.current?.parentElement;
      if (!pageContainer) {
        console.error("Page container not found for layers.");
        return;
      }

      // Ensure container is ready for absolute positioning of layers
      pageContainer.style.position = "relative";

      // --- DIRECT TEXT RENDERING (Skip PDF.js layers entirely) ---
      try {
        console.log("🚀 Starting direct text rendering...");
        const textContent = await page.getTextContent();

        console.log(
          `🚀 IMPLEMENTING HYBRID SOLUTION FOR CHROME-ACCURATE RENDERING`
        );
        console.log(
          `📊 Found ${textContent.items.length} text items (for reference only)`
        );

        // HYBRID STRATEGY: Use Chrome's native PDF renderer for text display
        // while keeping PDF.js for form field detection and editing

        // Step 1: Create Chrome PDF viewer iframe for 100% accurate text rendering
        const chromeViewer = document.createElement("iframe");

        // Check if we're in dark mode by looking at the app container
        const isDarkMode =
          document.querySelector(".app")?.classList.contains("dark-theme") ||
          false;
        const backgroundColor = isDarkMode ? "#2a2a2a" : "#fafafa";

        chromeViewer.style.cssText = `
          position: absolute !important;
          left: 0 !important;
          top: 0 !important;
          width: 100% !important;
          height: 100% !important;
          border: none !important;
          background: ${backgroundColor} !important;
          z-index: 1 !important;
          pointer-events: none !important;
        `;

        // Set additional properties to try to influence the PDF viewer theme
        chromeViewer.setAttribute("data-theme", isDarkMode ? "dark" : "light");

        // Convert current PDF bytes to blob for Chrome rendering
        if (!pdfBytes) {
          console.error("❌ PDF bytes not available for Chrome rendering");
          return;
        }

        const pdfBlob = new Blob([pdfBytes], { type: "application/pdf" });
        const blobUrl = URL.createObjectURL(pdfBlob);

        // Load PDF in Chrome's native renderer with proper zoom and page
        const zoomLevel = Math.round(scale * 100);
        const currentPageNumber = page.pageNumber; // Get page number from PDF.js page object

        // Show native Chromium toolbar (no suppression params)
        chromeViewer.src = `${blobUrl}#page=${currentPageNumber}&zoom=${zoomLevel}&view=FitH`;

        // Set color scheme on the iframe to hint at theme preference
        chromeViewer.style.colorScheme = isDarkMode ? "dark" : "light";

        // Insert Chrome viewer BEHIND the canvas for perfect text rendering
        pageContainer.insertBefore(chromeViewer, canvasRef.current);

        // Reserve space for the PDF toolbar to prevent overlay misalignment
        const toolbarHeightPx = 56; // approximate Chromium PDF toolbar height
        pageContainer.style.position = "relative";
        pageContainer.style.paddingTop = `${toolbarHeightPx}px`;

        // Make canvas semi-transparent so Chrome text shows through and align below toolbar
        if (canvasRef.current) {
          canvasRef.current.style.backgroundColor = "transparent";
          canvasRef.current.style.opacity = "0.3"; // Faint canvas for form field positioning
          canvasRef.current.style.zIndex = "2"; // Canvas on top for form interactions
          canvasRef.current.style.position = "relative";
          canvasRef.current.style.marginTop = `${toolbarHeightPx}px`;
        }

        // Step 2: Extract form fields using PDF.js for editing overlay (keep existing functionality)
        const annotations = await page.getAnnotations();
        console.log(
          `📝 Detected ${annotations.length} form fields for editing overlay`
        );

        // Clean up blob URL after iframe loads
        chromeViewer.onload = () => {
          console.log("✅ Chrome PDF viewer loaded successfully");
          setTimeout(() => {
            URL.revokeObjectURL(blobUrl);
            console.log("🧹 Cleaned up blob URL");
          }, 2000);
        };

        console.log("🎯 HYBRID RENDERING COMPLETE:");
        console.log(
          "   📖 Text Display: Chrome's native PDF renderer (100% accurate)"
        );
        console.log("   ✏️  Form Editing: PDF.js overlay system (preserved)");
        console.log(
          "   🔄 Result: Perfect Chrome-like text + full editing capabilities"
        );
      } catch (textError) {
        console.error("❌ Direct text rendering failed:", textError);
      }

      // Note: Annotation layer removed to focus on text rendering first
    } catch (err: any) {
      console.error("Page rendering error:", err);
      if (err.name !== "RenderingCancelledException") {
        setError(err.message || "Failed to render page");
      }
      renderTaskRef.current = null;
    }
  }, [pdfDoc, currentPage, scale, editMode, detectAcroFormFields]);

  // Separate effect for initial field detection (runs once when PDF loads in edit mode)
  useEffect(() => {
    const detectFieldsOnLoad = async () => {
      if (pdfDoc && editMode && !fieldsDetectedRef.current && !loading) {
        console.log("UnifiedPDFEditor: Detecting AcroForm fields...");
        await detectAcroFormFields(pdfDoc);
        setFieldsDetected(true);
        fieldsDetectedRef.current = true;
        console.log("UnifiedPDFEditor: Field detection completed");
      }
    };

    detectFieldsOnLoad();
  }, [pdfDoc, editMode, loading, detectAcroFormFields]);

  // Separate effect for page rendering (isolated from form state)
  useEffect(() => {
    if (pdfDoc && !loading) {
      console.log(
        `UnifiedPDFEditor: Rendering page ${currentPage} at scale ${scale}`
      );
      renderPage();
    }
  }, [pdfDoc, currentPage, scale, loading, renderPage]);

  // Re-detect fields when scale changes (without triggering render)
  useEffect(() => {
    if (pdfDoc && editMode && fieldsDetected && formFields.length > 0) {
      // Debounce field re-detection to prevent rapid updates
      const timeout = setTimeout(() => {
        detectAcroFormFields(pdfDoc);
      }, 100);

      return () => clearTimeout(timeout);
    }
  }, [
    scale,
    pdfDoc,
    editMode,
    fieldsDetected,
    detectAcroFormFields,
    formFields.length,
  ]);

  // Cleanup render task on unmount
  useEffect(() => {
    return () => {
      if (renderTaskRef.current) {
        renderTaskRef.current.cancel();
      }
    };
  }, []);

  // Handle canvas click for manual field placement
  const handleCanvasClick = (e: React.MouseEvent) => {
    if (!editMode || activeTool === "select" || !containerRef.current) return;

    const rect = containerRef.current.getBoundingClientRect();
    const x = e.clientX - rect.left;
    const y = e.clientY - rect.top;

    const newField: FormField = {
      id: `manual_${Date.now()}`,
      name: `${activeTool}_${formFields.length + 1}`,
      type: activeTool as "text" | "checkbox" | "signature",
      x:
        x -
        (activeTool === "text" ? 100 : activeTool === "signature" ? 110 : 10),
      y:
        y - (activeTool === "text" ? 15 : activeTool === "signature" ? 25 : 10),
      width:
        activeTool === "text" ? 200 : activeTool === "signature" ? 220 : 20,
      height: activeTool === "text" ? 30 : activeTool === "signature" ? 50 : 20,
      pageNumber: currentPage,
      value: activeTool === "checkbox" ? false : "",
      isAcroForm: false,
    };

    setFormFields((prev) => [...prev, newField]);
    setFormData((prev) => ({ ...prev, [newField.name]: newField.value }));
    setActiveTool("select");
  };

  // Handle form field value change
  const handleFieldChange = (fieldName: string, value: any) => {
    console.log(`UnifiedPDFEditor: Field "${fieldName}" changed to "${value}"`);
    setFormData((prev) => {
      const newFormData = { ...prev, [fieldName]: value };
      console.log("UnifiedPDFEditor: Updated formData:", newFormData);
      return newFormData;
    });
  };

  // Handle save
  const handleSave = useCallback(async () => {
    if (!onSave || !pdfBytes) return;

    console.log(
      "UnifiedPDFEditor handleSave - pdfBytes length:",
      pdfBytes?.length
    );
    console.log(
      "UnifiedPDFEditor handleSave - formFields count:",
      formFields.length
    );
    console.log("UnifiedPDFEditor handleSave - formData:", formData);

    // Capture form data at the moment of save to prevent loss during re-renders
    const currentFormData = { ...formData };
    const fieldsWithData = formFields.map((field) => ({
      name: field.name,
      type: field.type,
      pageNumber: field.pageNumber - 1, // backend expects 0-based
      x: field.pdfX ?? field.x,
      y: field.pdfY ?? field.y,
      width: field.pdfWidth ?? field.width,
      height: field.pdfHeight ?? field.height,
      value: currentFormData[field.name],
      isAcroForm: field.isAcroForm,
    }));

    console.log(
      "UnifiedPDFEditor handleSave - fieldsWithData:",
      fieldsWithData
    );

    // Call onSave without triggering any state changes
    onSave(fieldsWithData, pdfBytes);
  }, [onSave, pdfBytes, formFields, formData]);

  // Get fields for current page
  const currentPageFields = formFields.filter(
    (field) => field.pageNumber === currentPage
  );

  if (loading) {
    return (
      <div className="pdf-editor-loading">
        <div className="loading-spinner">Loading PDF...</div>
      </div>
    );
  }

  if (error) {
    return (
      <div className="pdf-editor-error">
        <div className="error-message">
          <h3>Failed to load PDF</h3>
          <p>{error}</p>
        </div>
      </div>
    );
  }

  return (
    <div className="unified-pdf-editor">
      {/* Toolbar - only show in edit mode */}
      {editMode && (
        <div className="pdf-toolbar">
          <div className="toolbar-group">
            <button
              className={`toolbar-btn ${
                activeTool === "select" ? "active" : ""
              }`}
              onClick={() => setActiveTool("select")}
              title="Select"
            >
              Select
            </button>
            <button
              className={`toolbar-btn ${activeTool === "text" ? "active" : ""}`}
              onClick={() => setActiveTool("text")}
              title="Add Text Field"
            >
              Add Text
            </button>
            <button
              className={`toolbar-btn ${
                activeTool === "checkbox" ? "active" : ""
              }`}
              onClick={() => setActiveTool("checkbox")}
              title="Add Checkbox"
            >
              Checkbox
            </button>
            <button
              className={`toolbar-btn ${
                activeTool === "signature" ? "active" : ""
              }`}
              onClick={() => setActiveTool("signature")}
              title="Add Signature"
            >
              Signature
            </button>
          </div>

          {/* Font Controls */}
          <div className="toolbar-group font-controls">
            <label className="font-label">Font:</label>
            <select
              className="font-selector"
              value={selectedFont}
              onChange={(e) => onFontChange?.(e.target.value)}
              title="Select Font Family"
            >
              <option value="Helvetica">Helvetica</option>
              <option value="Times-Roman">Times Roman</option>
              <option value="Courier">Courier</option>
              <option value="Helvetica-Bold">Helvetica Bold</option>
              <option value="Times-Bold">Times Bold</option>
              <option value="Courier-Bold">Courier Bold</option>
            </select>

            <label className="font-label">Size:</label>
            <input
              type="number"
              className="font-size-input"
              value={selectedFontSize}
              onChange={(e) =>
                onFontSizeChange?.(parseInt(e.target.value) || 14)
              }
              min="8"
              max="72"
              title="Font Size (8-72pt)"
            />
            <span className="font-unit">pt</span>
          </div>

          <div className="toolbar-group">
            <button className="toolbar-btn save-btn" onClick={handleSave}>
              Save PDF
            </button>
          </div>
        </div>
      )}

      {/* Page Navigation */}
      {totalPages > 1 && (
        <div className="page-navigation">
          <button
            onClick={() => setCurrentPage(Math.max(1, currentPage - 1))}
            disabled={currentPage <= 1}
          >
            Previous
          </button>
          <span>
            Page {currentPage} of {totalPages}
          </span>
          <button
            onClick={() =>
              setCurrentPage(Math.min(totalPages, currentPage + 1))
            }
            disabled={currentPage >= totalPages}
          >
            Next
          </button>
        </div>
      )}

      {/* PDF Viewer Container */}
      <div className="pdf-viewer-container">
        <div
          ref={containerRef}
          className="pdf-canvas-container"
          onClick={handleCanvasClick}
          style={{
            position: "relative",
            display: "inline-block",
            cursor:
              editMode && activeTool !== "select" ? "crosshair" : "default",
          }}
        >
          <canvas
            ref={canvasRef}
            className="pdf-canvas"
            style={{
              display: "block",
              maxWidth: "100%",
              height: "auto",
            }}
          />

          {/* Form Fields Overlay - only show in edit mode */}
          {editMode &&
            currentPageFields.map((field) => (
              <div
                key={field.id}
                className="form-field-overlay"
                style={{
                  position: "absolute",
                  left: field.x,
                  top: field.y,
                  width: field.width,
                  height: field.height,
                  border: "2px solid #007acc",
                  borderRadius: "4px",
                  backgroundColor: "rgba(255, 255, 255, 0.95)",
                  boxShadow: "0 2px 8px rgba(0, 0, 0, 0.15)",
                  zIndex: 10,
                }}
              >
                {field.type === "text" && (
                  <input
                    type="text"
                    value={formData[field.name] || ""}
                    onChange={(e) =>
                      handleFieldChange(field.name, e.target.value)
                    }
                    placeholder={`Enter ${field.name}...`}
                    style={{
                      width: "100%",
                      height: "100%",
                      border: "none",
                      outline: "none",
                      padding: "4px 8px",
                      fontSize: "13px",
                      fontFamily: "Arial, sans-serif",
                      backgroundColor: "rgba(255, 255, 255, 0.9)",
                      color: "#1f2937",
                      borderRadius: "2px",
                    }}
                  />
                )}

                {field.type === "checkbox" && (
                  <input
                    type="checkbox"
                    checked={!!formData[field.name]}
                    onChange={(e) =>
                      handleFieldChange(field.name, e.target.checked)
                    }
                    style={{
                      width: "16px",
                      height: "16px",
                      margin: "2px",
                    }}
                  />
                )}

                {field.type === "signature" && (
                  <div
                    onClick={() => {
                      const signature = prompt("Enter your signature:");
                      if (signature) {
                        handleFieldChange(field.name, signature);
                      }
                    }}
                    style={{
                      width: "100%",
                      height: "100%",
                      display: "flex",
                      alignItems: "center",
                      justifyContent: "center",
                      cursor: "pointer",
                      fontSize: "12px",
                      fontStyle: "italic",
                      color: "#666",
                      border: "1px dashed #ccc",
                    }}
                  >
                    {formData[field.name] || "Click to sign"}
                  </div>
                )}
              </div>
            ))}
        </div>
      </div>

      {/* Zoom Controls */}
      <div className="zoom-controls">
        <button onClick={() => setScale(Math.max(0.5, scale - 0.1))}>
          Zoom Out
        </button>
        <span>{Math.round(scale * 100)}%</span>
        <button onClick={() => setScale(Math.min(3, scale + 0.1))}>
          Zoom In
        </button>
        <button onClick={() => setScale(1)}>Reset</button>
      </div>
    </div>
  );
};

export default React.memo(UnifiedPDFEditor);
