import React, { useState, useEffect, useRef } from "react";
import EditorToolbar from "./EditorToolbar";
import { detectAcroFormFields } from "../utils/formDetection";
import { PDFDocument } from "pdf-lib";

interface FormField {
  id: string;
  name: string;
  type: "text" | "checkbox" | "radio" | "dropdown" | "signature";
  x: number;
  y: number;
  width: number;
  height: number;
  pageNumber: number;
  value?: string | boolean;
  options?: string[];
  confidence?: number;
  source?: "acroform" | "ocr_ai" | "fallback_rules";
}

interface ProcessingResult {
  success: boolean;
  pageImages?: string[];
  fields?: FormField[];
  processingMethod?: string;
  metadata?: {
    totalPages: number;
    totalFields: number;
    resolution?: number;
    ocrLanguage?: string;
  };
  error?: string;
}

interface EnhancedFormOverlayProps {
  pdfBytes: Uint8Array;
  onFormDataChange?: (formData: Record<string, any>) => void;
  onSaveForm?: (formData: Record<string, any>) => void;
  processingMode?: "auto" | "acroform" | "ocr_ai";
  onProcessingModeChange?: (mode: string) => void;
}

const EnhancedFormOverlay: React.FC<EnhancedFormOverlayProps> = ({
  pdfBytes,
  onFormDataChange,
  onSaveForm,
  processingMode = "auto",
  onProcessingModeChange,
}) => {
  const [formFields, setFormFields] = useState<FormField[]>([]);
  const [formData, setFormData] = useState<Record<string, any>>({});
  const [isLoading, setIsLoading] = useState(false);
  const [currentMode, setCurrentMode] = useState<string>(processingMode);
  const [availableModes, setAvailableModes] = useState<string[]>(["acroform"]);
  const [processingResult, setProcessingResult] =
    useState<ProcessingResult | null>(null);
  const [pageImages, setPageImages] = useState<string[]>([]);
  const overlayRef = useRef<HTMLDivElement>(null);
  const [editorMode, setEditorMode] = useState<
    "none" | "add_text" | "add_checkbox" | "add_signature"
  >("none");

  console.log(
    "EnhancedFormOverlay: Component rendered with pdfBytes:",
    pdfBytes ? pdfBytes.length : "null"
  );

  // Check available processing modes on mount
  useEffect(() => {
    checkAvailableModes();
  }, []);

  // Process PDF when bytes change
  useEffect(() => {
    if (pdfBytes) {
      processPDF();
    }
  }, [pdfBytes, currentMode]);

  // Check which processing modes are available
  const checkAvailableModes = async () => {
    try {
      const modes = ["acroform"]; // AcroForm is always available

      // Check if OCR + AI processing is available
      if (window.electronAPI?.pdfProcessorCheckAvailability) {
        const result = await window.electronAPI.pdfProcessorCheckAvailability();
        if (result.success && result.data?.available) {
          modes.push("ocr_ai");
        }
      }

      setAvailableModes(modes);

      // Auto-select best mode
      if (processingMode === "auto") {
        const bestMode = modes.includes("acroform") ? "acroform" : modes[0];
        setCurrentMode(bestMode);
        onProcessingModeChange?.(bestMode);
      }
    } catch (error) {
      console.error(
        "EnhancedFormOverlay: Error checking available modes:",
        error
      );
    }
  };

  // Main PDF processing function
  const processPDF = async () => {
    try {
      setIsLoading(true);
      console.log(`EnhancedFormOverlay: Starting ${currentMode} processing...`);

      let result: ProcessingResult;

      if (currentMode === "acroform") {
        result = await processWithAcroForm();
      } else if (currentMode === "ocr_ai") {
        result = await processWithOCRAI();
      } else {
        throw new Error(`Unknown processing mode: ${currentMode}`);
      }

      setProcessingResult(result);

      if (result.success && result.fields) {
        setFormFields(result.fields);

        // Set page images if available (for OCR + AI mode)
        if (result.pageImages) {
          setPageImages(result.pageImages);
        }

        // Initialize form data
        const initialFormData: Record<string, any> = {};
        result.fields.forEach((field) => {
          initialFormData[field.name] = field.value;
        });
        setFormData(initialFormData);

        console.log(
          `EnhancedFormOverlay: ${currentMode} processing completed, found ${result.fields.length} fields`
        );
      } else {
        console.error("EnhancedFormOverlay: Processing failed:", result.error);
        setFormFields([]);
        setPageImages([]);
      }
    } catch (error) {
      console.error("EnhancedFormOverlay: Error processing PDF:", error);
      setFormFields([]);
      setPageImages([]);
    } finally {
      setIsLoading(false);
    }
  };

  // Process PDF using AcroForm detection (existing method)
  const processWithAcroForm = async (): Promise<ProcessingResult> => {
    try {
      const detected = await detectAcroFormFields(pdfBytes);
      return {
        success: true,
        fields: detected,
        processingMethod: "acroform",
        metadata: { totalPages: 1, totalFields: detected.length },
      };
    } catch (error) {
      console.error("EnhancedFormOverlay: AcroForm processing failed:", error);
      return {
        success: false,
        error: error instanceof Error ? error.message : String(error),
        processingMethod: "acroform",
      };
    }
  };

  // Process PDF using OCR + AI approach
  const processWithOCRAI = async (): Promise<ProcessingResult> => {
    try {
      if (!window.electronAPI?.pdfProcessorAnalyze) {
        throw new Error("OCR + AI processing not available");
      }

      // Convert Uint8Array for backend processing
      const pdfBuffer = new Uint8Array(pdfBytes);

      const result = await window.electronAPI.pdfProcessorAnalyze(pdfBuffer, {
        resolution: 300,
        ocrLanguage: "eng",
        aiProvider: "llama",
      });

      if (result.success && result.data?.fields) {
        // Convert backend field format to frontend format
        const fields: FormField[] = result.data.fields.map(
          (field: any, index: number) => ({
            id: field.id || `ocr_field_${index}`,
            name: field.label || `Field ${index + 1}`,
            type: field.type || "text",
            x: field.x || 0,
            y: field.y || 0,
            width: field.width || 200,
            height: field.height || 25,
            pageNumber: field.page || 1,
            value: field.type === "checkbox" ? false : "",
            options:
              field.type === "dropdown"
                ? ["Option 1", "Option 2", "Option 3"]
                : undefined,
            confidence: field.confidence || 0.8,
            source: field.source || "ocr_ai",
          })
        );

        return {
          success: true,
          pageImages: result.data.pageImages,
          fields,
          processingMethod: result.data.processingMethod || "ocr_ai",
          metadata: result.data.metadata,
        };
      } else {
        return {
          success: false,
          error: result.error,
          processingMethod: "ocr_ai",
        };
      }
    } catch (error) {
      console.error("EnhancedFormOverlay: OCR + AI processing failed:", error);
      return {
        success: false,
        error: error instanceof Error ? error.message : String(error),
        processingMethod: "ocr_ai",
      };
    }
  };

  // Handle form field changes
  const handleFieldChange = (fieldName: string, value: any) => {
    const newFormData = { ...formData, [fieldName]: value };
    setFormData(newFormData);
    onFormDataChange?.(newFormData);
  };

  // Handle click to add manual fields in freeform editor
  const handleOverlayClick = (e: React.MouseEvent<HTMLDivElement>) => {
    if (editorMode === "none") return;
    if (!overlayRef.current) return;

    const rect = overlayRef.current.getBoundingClientRect();
    const x = e.clientX - rect.left;
    const y = e.clientY - rect.top;

    const id = `manual_${Date.now()}`;

    if (editorMode === "add_text") {
      const newField: FormField = {
        id,
        name: `Text_${formFields.length + 1}`,
        type: "text",
        x: Math.max(10, x - 125),
        y: Math.max(10, y - 18),
        width: 250,
        height: 35,
        pageNumber: 1,
        value: "",
        source: "fallback_rules",
      };
      setFormFields((prev) => [...prev, newField]);
    } else if (editorMode === "add_checkbox") {
      const newField: FormField = {
        id,
        name: `Checkbox_${formFields.length + 1}`,
        type: "checkbox",
        x: Math.max(10, x - 10),
        y: Math.max(10, y - 10),
        width: 20,
        height: 20,
        pageNumber: 1,
        value: false,
        source: "fallback_rules",
      };
      setFormFields((prev) => [...prev, newField]);
    } else if (editorMode === "add_signature") {
      const newField: FormField = {
        id,
        name: `Signature_${formFields.length + 1}`,
        type: "signature",
        x: Math.max(10, x - 100),
        y: Math.max(10, y - 25),
        width: 200,
        height: 50,
        pageNumber: 1,
        value: "",
        source: "fallback_rules",
      };
      setFormFields((prev) => [...prev, newField]);
    }

    // Exit add mode after placing one element
    setEditorMode("none");
  };

  // Handle save form
  const handleSaveForm = async () => {
    try {
      // For AcroForm, delegate to parent (uses existing advanced save flow)
      if (currentMode === "acroform") {
        onSaveForm?.(formData);
        return;
      }

      // For OCR + AI mode, finalize via backend PDFFinalizer with coordinates
      if (!window.electronAPI?.pdfFinalizerFinalize) {
        alert("PDF finalization is not available in this build.");
        return;
      }

      const payload = formFields.map((field) => ({
        name: field.name,
        type: field.type,
        pageNumber: field.pageNumber,
        x: field.x,
        y: field.y,
        width: field.width,
        height: field.height,
        value: formData[field.name],
      }));

      const pdfBuffer = new Uint8Array(pdfBytes);
      const finalizeResult = await window.electronAPI.pdfFinalizerFinalize(
        pdfBuffer,
        payload,
        { fontSize: 12 }
      );

      if (!finalizeResult.success || !finalizeResult.data) {
        alert(
          `Failed to finalize PDF: ${finalizeResult.error || "Unknown error"}`
        );
        return;
      }

      const bytes = new Uint8Array(finalizeResult.data as any);
      const defaultName = "filled.pdf";
      const saveResult = await window.electronAPI.saveFileDialog(
        bytes,
        defaultName
      );
      if (!saveResult.success) {
        console.warn("Save canceled or failed.");
      }
    } catch (error) {
      console.error("EnhancedFormOverlay: Error saving form:", error);
      alert(
        `Error saving form: ${
          error instanceof Error ? error.message : String(error)
        }`
      );
    }
  };

  // Handle processing mode change
  const handleModeChange = (newMode: string) => {
    setCurrentMode(newMode);
    onProcessingModeChange?.(newMode);
  };

  // Render form field based on type
  const renderFormField = (field: FormField) => {
    const commonStyle: React.CSSProperties = {
      position: "absolute",
      left: `${field.x}px`,
      top: `${field.y}px`,
      width: `${field.width}px`,
      height: `${field.height}px`,
      zIndex: 1000,
      backgroundColor: "rgba(255, 255, 255, 0.95)",
      border: `2px solid ${
        field.source === "acroform" ? "#007acc" : "#28a745"
      }`,
      borderRadius: "4px",
      padding: "4px",
      fontSize: "12px",
      boxShadow: "0 2px 4px rgba(0,0,0,0.2)",
    };

    const labelStyle: React.CSSProperties = {
      position: "absolute",
      top: "-20px",
      left: "0",
      fontSize: "10px",
      color: field.source === "acroform" ? "#007acc" : "#28a745",
      fontWeight: "bold",
      backgroundColor: "rgba(255, 255, 255, 0.9)",
      padding: "2px 4px",
      borderRadius: "2px",
    };

    switch (field.type) {
      case "text":
        return (
          <div key={field.id} style={{ position: "relative" }}>
            <label style={labelStyle}>
              {field.name}{" "}
              {field.confidence && `(${Math.round(field.confidence * 100)}%)`}
            </label>
            <input
              type="text"
              value={formData[field.name] || ""}
              onChange={(e) => handleFieldChange(field.name, e.target.value)}
              placeholder={`Enter ${field.name}...`}
              style={commonStyle}
            />
          </div>
        );

      case "checkbox":
        return (
          <div key={field.id} style={{ position: "relative" }}>
            <label style={labelStyle}>
              {field.name}{" "}
              {field.confidence && `(${Math.round(field.confidence * 100)}%)`}
            </label>
            <input
              type="checkbox"
              checked={formData[field.name] || false}
              onChange={(e) => handleFieldChange(field.name, e.target.checked)}
              style={commonStyle}
            />
          </div>
        );

      case "radio":
        return (
          <div
            key={field.id}
            style={{ ...commonStyle, display: "flex", alignItems: "center" }}
          >
            <input
              type="radio"
              name={field.name}
              checked={formData[field.name] === field.name}
              onChange={() => handleFieldChange(field.name, field.name)}
              style={{ marginRight: "4px" }}
            />
            <label style={{ fontSize: "10px" }}>
              {field.name}{" "}
              {field.confidence && `(${Math.round(field.confidence * 100)}%)`}
            </label>
          </div>
        );

      case "dropdown":
        return (
          <div key={field.id} style={{ position: "relative" }}>
            <label style={labelStyle}>
              {field.name}{" "}
              {field.confidence && `(${Math.round(field.confidence * 100)}%)`}
            </label>
            <select
              value={formData[field.name] || ""}
              onChange={(e) => handleFieldChange(field.name, e.target.value)}
              style={commonStyle}
            >
              <option value="">Select {field.name}...</option>
              {field.options?.map((option, index) => (
                <option key={index} value={option}>
                  {option}
                </option>
              ))}
            </select>
          </div>
        );

      case "signature":
        return (
          <div key={field.id} style={{ position: "relative" }}>
            <label style={labelStyle}>
              {field.name}{" "}
              {field.confidence && `(${Math.round(field.confidence * 100)}%)`}
            </label>
            <div
              style={{
                ...commonStyle,
                backgroundColor: "rgba(240, 240, 240, 0.95)",
                display: "flex",
                alignItems: "center",
                justifyContent: "center",
                cursor: "pointer",
                borderStyle: "dashed",
              }}
              onClick={() => {
                // Handle signature input
                const signature = prompt("Enter signature text:");
                if (signature) {
                  handleFieldChange(field.name, signature);
                }
              }}
            >
              {formData[field.name] || "Click to sign"}
            </div>
          </div>
        );

      default:
        return null;
    }
  };

  if (isLoading) {
    return (
      <div
        style={{
          position: "absolute",
          top: "50%",
          left: "50%",
          transform: "translate(-50%, -50%)",
          zIndex: 1000,
          backgroundColor: "rgba(0, 0, 0, 0.8)",
          color: "white",
          padding: "20px",
          borderRadius: "8px",
          textAlign: "center",
        }}
      >
        <div>Processing PDF with {currentMode}...</div>
        <div style={{ fontSize: "12px", marginTop: "10px" }}>
          {currentMode === "ocr_ai" &&
            "This may take a few moments for OCR + AI analysis"}
        </div>
      </div>
    );
  }

  if (formFields.length === 0) {
    return (
      <div
        style={{
          position: "absolute",
          top: "50%",
          left: "50%",
          transform: "translate(-50%, -50%)",
          zIndex: 1000,
          backgroundColor: "rgba(255, 255, 255, 0.9)",
          padding: "20px",
          borderRadius: "8px",
          border: "2px solid #007acc",
          textAlign: "center",
          maxWidth: "400px",
        }}
      >
        <p>No form fields detected in this PDF</p>
        <p style={{ fontSize: "12px", color: "#666", marginTop: "10px" }}>
          Processing method: {currentMode}
        </p>
        {availableModes.length > 1 && (
          <div style={{ marginTop: "15px" }}>
            <p style={{ fontSize: "12px", color: "#666" }}>
              Try a different processing method:
            </p>
            <div style={{ marginTop: "10px" }}>
              {availableModes.map((mode) => (
                <button
                  key={mode}
                  onClick={() => handleModeChange(mode)}
                  style={{
                    margin: "5px",
                    padding: "5px 10px",
                    border: "1px solid #007acc",
                    borderRadius: "4px",
                    backgroundColor: mode === currentMode ? "#007acc" : "white",
                    color: mode === currentMode ? "white" : "#007acc",
                    cursor: "pointer",
                    fontSize: "12px",
                  }}
                >
                  {mode === "acroform" ? "Smart Fill" : "Visual Fill"}
                </button>
              ))}
            </div>
          </div>
        )}
      </div>
    );
  }

  return (
    <div
      ref={overlayRef}
      onClick={handleOverlayClick}
      style={{ position: "relative", width: "100%", height: "100%" }}
    >
      {/* Processing mode indicator */}
      <div
        style={{
          position: "absolute",
          top: "10px",
          left: "10px",
          zIndex: 1001,
          backgroundColor:
            currentMode === "acroform"
              ? "rgba(0, 122, 204, 0.9)"
              : "rgba(40, 167, 69, 0.9)",
          color: "white",
          padding: "8px 12px",
          borderRadius: "4px",
          fontSize: "12px",
        }}
      >
        {currentMode === "acroform" ? "Smart Fill" : "Visual Fill"}:{" "}
        {formFields.length} fields
        {processingResult?.metadata && (
          <div style={{ fontSize: "10px", marginTop: "2px" }}>
            {processingResult.metadata.totalPages} pages,{" "}
            {processingResult.metadata.totalFields} fields
          </div>
        )}
      </div>

      {/* Mode switcher */}
      {availableModes.length > 1 && (
        <div
          style={{
            position: "absolute",
            top: "10px",
            right: "80px",
            zIndex: 1001,
          }}
        >
          <select
            value={currentMode}
            onChange={(e) => handleModeChange(e.target.value)}
            style={{
              padding: "4px 8px",
              border: "1px solid #ccc",
              borderRadius: "4px",
              fontSize: "12px",
              backgroundColor: "white",
            }}
          >
            {availableModes.map((mode) => (
              <option key={mode} value={mode}>
                {mode === "acroform" ? "Smart Fill" : "Visual Fill"}
              </option>
            ))}
          </select>
        </div>
      )}

      {/* Floating toolbar */}
      <EditorToolbar
        activeTool={
          editorMode === "add_text"
            ? "text"
            : editorMode === "add_checkbox"
            ? "checkbox"
            : editorMode === "add_signature"
            ? "signature"
            : "select"
        }
        onToolChange={(tool) => {
          if (tool === "text") setEditorMode("add_text");
          else if (tool === "checkbox") setEditorMode("add_checkbox");
          else if (tool === "signature") setEditorMode("add_signature");
          else setEditorMode("none");
        }}
        onSave={handleSaveForm}
      />

      {/* Form fields overlay */}
      {formFields.map(renderFormField)}
    </div>
  );
};

export default EnhancedFormOverlay;
