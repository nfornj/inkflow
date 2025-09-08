import { PDFDocument } from "pdf-lib";

export type DetectedField = {
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
  source?: "acroform";
};

/**
 * Detect AcroForm fields and extract approximate widget rectangles.
 * Falls back to simple positioning if widget rectangles are not readable.
 */
export async function detectAcroFormFields(
  pdfBytes: Uint8Array
): Promise<DetectedField[]> {
  const pdfDoc = await PDFDocument.load(pdfBytes);
  const form = pdfDoc.getForm();
  const fields = form.getFields();

  const detected: DetectedField[] = fields.map((field, index) => {
    const fieldName = field.getName();
    const ctor = (field as any).constructor?.name as string;

    let type: DetectedField["type"] = "text";
    if (ctor === "PDFCheckBox") type = "checkbox";
    else if (ctor === "PDFRadioGroup") type = "radio";
    else if (ctor === "PDFDropdown") type = "dropdown";

    // Default fallback rectangle
    let x = 50;
    let y = 700 - index * 40;
    let width = type === "checkbox" ? 20 : 250;
    let height = type === "checkbox" ? 20 : 24;
    let pageNumber = 1;

    try {
      // Try reading widget rectangles from the internal dict
      const dict = (field as any).dict;
      const widgets = dict?.get?.("Kids") || dict?.get?.("Parent")?.get?.("Kids");

      if (Array.isArray(widgets) && widgets.length > 0) {
        const widget = widgets[0];
        const rect = widget?.get?.("Rect") || widget?.dict?.get?.("Rect");
        const apPage = widget?.get?.("P");
        if (apPage) {
          const pages = pdfDoc.getPages();
          pageNumber = Math.max(1, pages.indexOf(apPage) + 1) || 1;
        }

        if (Array.isArray(rect) && rect.length === 4) {
          const [x1, y1, x2, y2] = rect;
          x = Number(x1) || x;
          y = Number(y1) || y;
          width = Number(x2) - Number(x1) || width;
          height = Number(y2) - Number(y1) || height;
        }
      } else if (dict?.Rect) {
        const rect = dict.Rect;
        if (Array.isArray(rect) && rect.length === 4) {
          const [x1, y1, x2, y2] = rect;
          x = x1;
          y = y1;
          width = x2 - x1;
          height = y2 - y1;
        }
      }
    } catch {
      // keep fallback
    }

    return {
      id: `acroform_${index}`,
      name: fieldName,
      type,
      x: Math.max(10, x),
      y: Math.max(10, y),
      width: Math.max(30, width),
      height: Math.max(18, height),
      pageNumber,
      value: type === "checkbox" ? false : "",
      options: type === "dropdown" ? ["Option 1", "Option 2"] : undefined,
      confidence: 1.0,
      source: "acroform",
    };
  });

  return detected;
}


