import React, { useEffect, useState, useRef, useCallback } from "react";
import * as pdfjsLib from "pdfjs-dist";

// Configure PDF.js worker (will be overridden by App.tsx configuration)
// pdfjsLib.GlobalWorkerOptions.workerSrc = `//cdnjs.cloudflare.com/ajax/libs/pdf.js/${pdfjsLib.version}/pdf.worker.min.js`;

interface FormField {
  id: string;
  name: string;
  type: "text" | "checkbox" | "signature";
  pageNumber: number;
  x: number;
  y: number;
  width: number;
  height: number;
  value: any;
  isAcroForm?: boolean;
}

interface UnifiedContentViewerProps {
  isActive: boolean;
  onFormFieldsDetected?: (fields: FormField[]) => void;
  onSave?: (fields: FormField[], pdfData?: Uint8Array) => void;
  selectedFont?: string;
  selectedFontSize?: number;
}

const UnifiedContentViewer: React.FC<UnifiedContentViewerProps> = ({
  isActive,
  onFormFieldsDetected,
  onSave,
  selectedFont = "Helvetica",
  selectedFontSize = 14,
}) => {
  const overlayRef = useRef<HTMLDivElement>(null);
  const [contentType, setContentType] = useState<"web" | "pdf" | null>(null);
  const [isLoading, setIsLoading] = useState(false);
  const [currentUrl, setCurrentUrl] = useState<string>("");
  const [formFields, setFormFields] = useState<FormField[]>([]);
  const [formData, setFormData] = useState<Record<string, any>>({});
  const [editMode, setEditMode] = useState(false);
  const [pdfData, setPdfData] = useState<Uint8Array | null>(null);
  const [browserViewBounds, setBrowserViewBounds] = useState<{
    x: number;
    y: number;
    width: number;
    height: number;
  } | null>(null);
  const [pdfScale, setPdfScale] = useState(1.0);

  // Initialize unified content event listeners
  useEffect(() => {
    if (!window.electronAPI) return;

    // Listen for content loading events
    const handleContentLoading = (data: {
      id: string;
      loading: boolean;
      contentType: string;
    }) => {
      console.log("🔄 Unified content loading:", data);
      setIsLoading(data.loading);
      if (data.loading) {
        setContentType(data.contentType as "web" | "pdf");
      }
    };

    // Listen for content loaded events
    const handleContentLoaded = (data: {
      id: string;
      url: string;
      contentType: string;
      title: string;
      bounds?: { x: number; y: number; width: number; height: number };
    }) => {
      console.log("✅ Unified content loaded:", data);
      setIsLoading(false);
      setCurrentUrl(data.url);
      setContentType(data.contentType as "web" | "pdf");

      // Store BrowserView bounds for overlay alignment
      if (data.bounds) {
        setBrowserViewBounds(data.bounds);
      }

      // Clear previous form data when switching content
      setFormFields([]);
      setFormData({});
      setEditMode(false);
    };

    // Listen for content errors
    const handleContentError = (data: {
      id: string;
      error: string;
      contentType: string;
    }) => {
      console.error("❌ Unified content error:", data);
      setIsLoading(false);
    };

    // Listen for PDF detection
    const handlePdfDetected = async (data: {
      id: string;
      url: string;
      bounds?: { x: number; y: number; width: number; height: number };
      scale?: number;
    }) => {
      console.log("📝 PDF detected, enabling form overlay:", data);
      setContentType("pdf");

      // Store positioning info for overlay alignment
      if (data.bounds) {
        setBrowserViewBounds(data.bounds);
      }
      if (data.scale) {
        setPdfScale(data.scale);
      }

      // Enable form detection for PDFs
      if (data.url.startsWith("file://") || data.url.includes("tmp")) {
        try {
          // For local PDF files, we need to read the file to detect forms
          await detectPdfForms(data.url);
        } catch (error) {
          console.error("Error detecting PDF forms:", error);
        }
      }
    };

    // Set up event listeners
    window.electronAPI.onUnifiedContentLoading(handleContentLoading);
    window.electronAPI.onUnifiedContentLoaded(handleContentLoaded);
    window.electronAPI.onUnifiedContentError(handleContentError);
    window.electronAPI.onPdfDetected(handlePdfDetected);

    return () => {
      // Clean up listeners
      window.electronAPI?.removeAllListeners("unified-content-loading");
      window.electronAPI?.removeAllListeners("unified-content-loaded");
      window.electronAPI?.removeAllListeners("unified-content-error");
      window.electronAPI?.removeAllListeners("pdf-detected");
    };
  }, []);

  // Detect PDF forms using PDF.js
  const detectPdfForms = useCallback(
    async (pdfUrl: string) => {
      try {
        console.log("🔍 Detecting forms in PDF:", pdfUrl);

        // For file:// URLs, we need to fetch the file differently
        let pdfBytes: Uint8Array;

        if (pdfUrl.startsWith("file://")) {
          // This is a local file, we'll need to read it through Electron
          const response = await fetch(pdfUrl);
          const arrayBuffer = await response.arrayBuffer();
          pdfBytes = new Uint8Array(arrayBuffer);
        } else {
          // This is a regular URL
          const response = await fetch(pdfUrl);
          const arrayBuffer = await response.arrayBuffer();
          pdfBytes = new Uint8Array(arrayBuffer);
        }

        setPdfData(pdfBytes);

        // Load PDF with PDF.js
        const pdf = await pdfjsLib.getDocument({ data: pdfBytes }).promise;
        const detectedFields: FormField[] = [];

        // Check each page for form fields
        for (let pageNum = 1; pageNum <= pdf.numPages; pageNum++) {
          const page = await pdf.getPage(pageNum);
          const annotations = await page.getAnnotations();

          annotations.forEach((annotation: any, index: number) => {
            if (annotation.subtype === "Widget") {
              const field: FormField = {
                id: `field_${pageNum}_${index}`,
                name: annotation.fieldName || `field_${pageNum}_${index}`,
                type: getFieldType(annotation),
                pageNumber: pageNum,
                x: annotation.rect[0],
                y: annotation.rect[1],
                width: annotation.rect[2] - annotation.rect[0],
                height: annotation.rect[3] - annotation.rect[1],
                value: annotation.fieldValue || "",
                isAcroForm: true,
              };
              detectedFields.push(field);
            }
          });
        }

        console.log(`📝 Detected ${detectedFields.length} form fields`);
        setFormFields(detectedFields);

        // Initialize form data
        const initialData: Record<string, any> = {};
        detectedFields.forEach((field) => {
          initialData[field.id] =
            field.value || (field.type === "checkbox" ? false : "");
        });
        setFormData(initialData);

        // Notify parent component
        if (onFormFieldsDetected) {
          onFormFieldsDetected(detectedFields);
        }

        // Enable edit mode for PDFs with forms
        if (detectedFields.length > 0) {
          setEditMode(true);
        }
      } catch (error) {
        console.error("Error detecting PDF forms:", error);
      }
    },
    [onFormFieldsDetected]
  );

  // Helper function to determine field type
  const getFieldType = (annotation: any): "text" | "checkbox" | "signature" => {
    if (annotation.checkBox) return "checkbox";
    if (annotation.fieldType === "Sig") return "signature";
    return "text";
  };

  // Handle form field changes
  const handleFieldChange = (fieldId: string, value: any) => {
    setFormData((prev) => ({
      ...prev,
      [fieldId]: value,
    }));
  };

  // Handle save operation
  const handleSave = async () => {
    if (!pdfData || formFields.length === 0) {
      console.warn("No PDF data or form fields to save");
      return;
    }

    // Prepare form data for saving
    const fieldsWithData = formFields.map((field) => ({
      ...field,
      value: formData[field.id] || field.value,
    }));

    if (onSave) {
      onSave(fieldsWithData, pdfData);
    }
  };

  // Render form overlay for PDF content
  const renderFormOverlay = () => {
    if (
      contentType !== "pdf" ||
      !editMode ||
      formFields.length === 0 ||
      !browserViewBounds
    ) {
      return null;
    }

    // Calculate the offset and scale for proper alignment with BrowserView
    const offsetX = browserViewBounds.x;
    const offsetY = browserViewBounds.y;
    const viewScale = pdfScale;

    return (
      <div
        ref={overlayRef}
        className="form-overlay"
        style={{
          position: "fixed", // Use fixed positioning to align with BrowserView
          left: offsetX,
          top: offsetY,
          width: browserViewBounds.width,
          height: browserViewBounds.height,
          pointerEvents: "none",
          zIndex: 1000,
        }}
      >
        {formFields.map((field) => (
          <div
            key={field.id}
            style={{
              position: "absolute",
              left: `${field.x * viewScale}px`,
              top: `${field.y * viewScale}px`,
              width: `${field.width * viewScale}px`,
              height: `${field.height * viewScale}px`,
              pointerEvents: "auto",
            }}
          >
            {field.type === "checkbox" ? (
              <input
                type="checkbox"
                checked={formData[field.id] || false}
                onChange={(e) => handleFieldChange(field.id, e.target.checked)}
                style={{
                  width: "100%",
                  height: "100%",
                }}
              />
            ) : (
              <input
                type="text"
                value={formData[field.id] || ""}
                onChange={(e) => handleFieldChange(field.id, e.target.value)}
                placeholder={field.name}
                style={{
                  width: "100%",
                  height: "100%",
                  border: "2px solid #007acc",
                  borderRadius: "4px",
                  padding: "4px",
                  fontSize: `${selectedFontSize}px`,
                  fontFamily: selectedFont,
                  backgroundColor: "rgba(255, 255, 255, 0.9)",
                }}
              />
            )}
          </div>
        ))}
      </div>
    );
  };

  if (!isActive) {
    return null;
  }

  return (
    <div
      className="unified-content-viewer"
      style={{ position: "relative", width: "100%", height: "100%" }}
    >
      {/* Loading indicator */}
      {isLoading && (
        <div
          style={{
            position: "absolute",
            top: "50%",
            left: "50%",
            transform: "translate(-50%, -50%)",
            zIndex: 2000,
            background: "rgba(255, 255, 255, 0.9)",
            padding: "20px",
            borderRadius: "8px",
            boxShadow: "0 4px 12px rgba(0, 0, 0, 0.15)",
          }}
        >
          <div>Loading {contentType}...</div>
        </div>
      )}

      {/* Form overlay for PDF editing */}
      {renderFormOverlay()}

      {/* PDF editing controls */}
      {contentType === "pdf" && editMode && formFields.length > 0 && (
        <div
          style={{
            position: "absolute",
            top: "10px",
            right: "10px",
            zIndex: 1001,
            background: "white",
            padding: "10px",
            borderRadius: "8px",
            boxShadow: "0 2px 8px rgba(0, 0, 0, 0.15)",
          }}
        >
          <button
            onClick={handleSave}
            style={{
              background: "#007acc",
              color: "white",
              border: "none",
              padding: "8px 16px",
              borderRadius: "4px",
              cursor: "pointer",
            }}
          >
            Save PDF
          </button>
          <div style={{ marginTop: "8px", fontSize: "12px", color: "#666" }}>
            {formFields.length} fields detected
          </div>
        </div>
      )}

      {/* Content info */}
      {currentUrl && (
        <div
          style={{
            position: "absolute",
            bottom: "10px",
            left: "10px",
            zIndex: 1001,
            background: "rgba(0, 0, 0, 0.7)",
            color: "white",
            padding: "4px 8px",
            borderRadius: "4px",
            fontSize: "12px",
            maxWidth: "300px",
            overflow: "hidden",
            textOverflow: "ellipsis",
            whiteSpace: "nowrap",
          }}
        >
          {contentType?.toUpperCase()}: {currentUrl}
        </div>
      )}
    </div>
  );
};

export default UnifiedContentViewer;
