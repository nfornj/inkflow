import React, { useState, useEffect, useRef } from "react";
import { PDFDocument } from "pdf-lib";

interface FormField {
  id: string;
  name: string;
  type: "text" | "checkbox" | "radio" | "dropdown";
  x: number;
  y: number;
  width: number;
  height: number;
  pageNumber: number;
  value?: string | boolean;
  options?: string[];
}

interface FormOverlayProps {
  pdfBytes: Uint8Array;
  onFormDataChange?: (formData: Record<string, any>) => void;
  onSaveForm?: (formData: Record<string, any>) => void;
}

const FormOverlay: React.FC<FormOverlayProps> = ({
  pdfBytes,
  onFormDataChange,
  onSaveForm,
}) => {
  const [formFields, setFormFields] = useState<FormField[]>([]);
  const [formData, setFormData] = useState<Record<string, any>>({});
  const [isLoading, setIsLoading] = useState(false);
  const overlayRef = useRef<HTMLDivElement>(null);

  console.log(
    "FormOverlay: Component rendered with pdfBytes:",
    pdfBytes ? pdfBytes.length : "null"
  );

  // Detect form fields in PDF
  useEffect(() => {
    const detectFormFields = async () => {
      try {
        setIsLoading(true);
        console.log("FormOverlay: Starting field detection...");
        console.log(
          "FormOverlay: PDF bytes length:",
          pdfBytes ? pdfBytes.length : "null"
        );

        if (!pdfBytes) {
          console.log("FormOverlay: No PDF bytes provided");
          setIsLoading(false);
          return;
        }

        const pdfDoc = await PDFDocument.load(pdfBytes);
        const form = pdfDoc.getForm();
        const fields = form.getFields();

        console.log(`FormOverlay: Found ${fields.length} form fields in PDF`);

        const detectedFields: FormField[] = [];

        fields.forEach((field, index) => {
          const fieldName = field.getName();
          const fieldType = field.constructor.name;

          console.log(`Field ${index}: ${fieldName} (${fieldType})`);

          // Map PDF field types to our types
          let type: FormField["type"] = "text";
          if (fieldType === "PDFCheckBox") {
            type = "checkbox";
          } else if (fieldType === "PDFRadioGroup") {
            type = "radio";
          } else if (fieldType === "PDFDropdown") {
            type = "dropdown";
          }

          // Smart positioning based on field name and type
          let x = 50;
          let y = 100 + index * 50; // Stack vertically with more spacing
          let width = type === "checkbox" ? 20 : 250;
          let height = type === "checkbox" ? 20 : 35;

          // Try to extract position from field if available
          try {
            const fieldDict = (field as any).dict;
            if (fieldDict && fieldDict.Rect) {
              const rect = fieldDict.Rect;
              if (Array.isArray(rect) && rect.length === 4) {
                // PDF coordinates: [x1, y1, x2, y2] where y1 is bottom, y2 is top
                const [x1, y1, x2, y2] = rect;
                x = x1;
                y = y1; // Use bottom coordinate
                width = x2 - x1;
                height = y2 - y1;
                console.log(
                  `Field ${fieldName} position: x=${x}, y=${y}, w=${width}, h=${height}`
                );
              }
            }
          } catch (posError) {
            console.log(
              `Could not extract position for field ${fieldName}, using smart positioning`
            );

            // Smart positioning based on field name patterns
            const fieldNameLower = fieldName.toLowerCase();

            // Common field positioning patterns
            if (
              fieldNameLower.includes("name") ||
              fieldNameLower.includes("fullname")
            ) {
              y = 120;
            } else if (fieldNameLower.includes("email")) {
              y = 170;
            } else if (fieldNameLower.includes("phone")) {
              y = 220;
            } else if (fieldNameLower.includes("address")) {
              y = 270;
            } else if (fieldNameLower.includes("city")) {
              y = 320;
            } else if (
              fieldNameLower.includes("state") ||
              fieldNameLower.includes("province")
            ) {
              y = 370;
            } else if (
              fieldNameLower.includes("postal") ||
              fieldNameLower.includes("zip")
            ) {
              y = 420;
            } else if (fieldNameLower.includes("country")) {
              y = 470;
            } else if (
              fieldNameLower.includes("comment") ||
              fieldNameLower.includes("message")
            ) {
              y = 520;
              height = 80; // Make text areas taller
            } else if (
              fieldNameLower.includes("newsletter") ||
              fieldNameLower.includes("subscribe")
            ) {
              y = 120;
              x = 400; // Position checkboxes to the right
            } else if (
              fieldNameLower.includes("terms") ||
              fieldNameLower.includes("agree")
            ) {
              y = 170;
              x = 400;
            } else if (
              fieldNameLower.includes("gender") ||
              fieldNameLower.includes("sex")
            ) {
              y = 220;
              x = 400;
            } else if (
              fieldNameLower.includes("rating") ||
              fieldNameLower.includes("recommend")
            ) {
              y = 270;
              x = 400;
            }

            // Adjust width based on type
            if (type === "checkbox") {
              width = 20;
              height = 20;
            } else if (type === "radio") {
              width = 150;
              height = 30;
            } else if (type === "dropdown") {
              width = 200;
              height = 35;
            } else {
              width = 250;
              height = 35;
            }
          }

          const fieldId = `field_${index}`;
          const fieldData: FormField = {
            id: fieldId,
            name: fieldName,
            type,
            x: Math.max(10, x), // Ensure minimum position
            y: Math.max(10, y),
            width: Math.max(50, width),
            height: Math.max(20, height),
            pageNumber: 1,
            value: type === "checkbox" ? false : "",
            options:
              type === "dropdown"
                ? ["Option 1", "Option 2", "Option 3"]
                : undefined,
          };

          detectedFields.push(fieldData);
        });

        console.log(`Created ${detectedFields.length} form field overlays`);
        setFormFields(detectedFields);

        // Initialize form data
        const initialFormData: Record<string, any> = {};
        detectedFields.forEach((field) => {
          initialFormData[field.name] = field.value;
        });
        setFormData(initialFormData);
      } catch (error) {
        console.error("FormOverlay: Error detecting form fields:", error);
        if (error instanceof Error) {
          console.error("FormOverlay: Error details:", error.message);
          console.error("FormOverlay: Error stack:", error.stack);
        } else {
          console.error("FormOverlay: Unknown error type:", typeof error);
        }
      } finally {
        setIsLoading(false);
      }
    };

    if (pdfBytes) {
      detectFormFields();
    }
  }, [pdfBytes]);

  // Handle form field changes
  const handleFieldChange = (fieldName: string, value: any) => {
    const newFormData = { ...formData, [fieldName]: value };
    setFormData(newFormData);
    onFormDataChange?.(newFormData);
  };

  // Handle save form
  const handleSaveForm = () => {
    onSaveForm?.(formData);
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
      border: "2px solid #007acc",
      borderRadius: "4px",
      padding: "4px",
      fontSize: "12px",
      boxShadow: "0 2px 4px rgba(0,0,0,0.2)",
    };

    switch (field.type) {
      case "text":
        return (
          <div key={field.id} style={{ position: "relative" }}>
            <label
              style={{
                position: "absolute",
                top: "-20px",
                left: "0",
                fontSize: "10px",
                color: "#007acc",
                fontWeight: "bold",
                backgroundColor: "rgba(255, 255, 255, 0.9)",
                padding: "2px 4px",
                borderRadius: "2px",
              }}
            >
              {field.name}
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
            <label
              style={{
                position: "absolute",
                top: "-20px",
                left: "0",
                fontSize: "10px",
                color: "#007acc",
                fontWeight: "bold",
                backgroundColor: "rgba(255, 255, 255, 0.9)",
                padding: "2px 4px",
                borderRadius: "2px",
              }}
            >
              {field.name}
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
            <label style={{ fontSize: "10px" }}>{field.name}</label>
          </div>
        );

      case "dropdown":
        return (
          <div key={field.id} style={{ position: "relative" }}>
            <label
              style={{
                position: "absolute",
                top: "-20px",
                left: "0",
                fontSize: "10px",
                color: "#007acc",
                fontWeight: "bold",
                backgroundColor: "rgba(255, 255, 255, 0.9)",
                padding: "2px 4px",
                borderRadius: "2px",
              }}
            >
              {field.name}
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
        }}
      >
        Detecting form fields...
      </div>
    );
  }

  if (formFields.length === 0) {
    console.log("FormOverlay: No form fields detected, showing error message");
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
        }}
      >
        <p>No form fields detected in this PDF</p>
        <p style={{ fontSize: "12px", color: "#666" }}>
          Make sure the PDF contains fillable form fields
        </p>
        <p style={{ fontSize: "10px", color: "#999" }}>
          Debug: PDF bytes length: {pdfBytes ? pdfBytes.length : "null"}
        </p>
      </div>
    );
  }

  return (
    <div
      ref={overlayRef}
      style={{ position: "relative", width: "100%", height: "100%" }}
    >
      {/* Debug info */}
      <div
        style={{
          position: "absolute",
          top: "10px",
          left: "10px",
          zIndex: 1001,
          backgroundColor: "rgba(0, 122, 204, 0.9)",
          color: "white",
          padding: "8px 12px",
          borderRadius: "4px",
          fontSize: "12px",
        }}
      >
        Form Mode: {formFields.length} fields detected
      </div>

      {/* Form fields overlay */}
      {formFields.map(renderFormField)}

      {/* Save button */}
      <button
        onClick={handleSaveForm}
        style={{
          position: "absolute",
          top: "10px",
          right: "10px",
          zIndex: 1001,
          backgroundColor: "#007acc",
          color: "white",
          border: "none",
          borderRadius: "4px",
          padding: "8px 16px",
          cursor: "pointer",
          fontSize: "12px",
        }}
      >
        Save Form
      </button>
    </div>
  );
};

export default FormOverlay;
