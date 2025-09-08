import * as pdfjsLib from 'pdfjs-dist';

export type DetectedField = {
  id: string;
  name: string;
  type: 'text' | 'checkbox' | 'radio' | 'dropdown' | 'signature';
  x: number; y: number; width: number; height: number;
  pageNumber: number; value?: string | boolean; options?: string[]; source: 'acroform';
};

export async function detectWidgetsPdfJs(pdfBytes: Uint8Array): Promise<DetectedField[]> {
  // Create a copy to prevent ArrayBuffer detachment issues
  const bytesCopy = new Uint8Array(pdfBytes);
  const doc = await (pdfjsLib as any).getDocument({ data: bytesCopy }).promise;
  const result: DetectedField[] = [];

  for (let pageNumber = 1; pageNumber <= doc.numPages; pageNumber++) {
    const page = await doc.getPage(pageNumber);
    const viewport = page.getViewport({ scale: 1 });
    const annots = await page.getAnnotations({ intent: 'display' });

    for (const a of annots) {
      if ((a as any).subtype !== 'Widget') continue;
      const fieldType = (a as any).fieldType; // 'Tx'|'Btn'|'Ch'
      let type: DetectedField['type'] = 'text';
      if (fieldType === 'Btn') {
        if ((a as any).checkBox) type = 'checkbox';
        else if ((a as any).radioButton) type = 'radio';
      } else if (fieldType === 'Ch') {
        type = 'dropdown';
      }

      const rect = viewport.convertToViewportRectangle((a as any).rect);
      const x = Math.min(rect[0], rect[2]);
      const yTop = Math.min(rect[1], rect[3]);
      const w = Math.abs(rect[2] - rect[0]);
      const h = Math.abs(rect[3] - rect[1]);
      const y = viewport.height - yTop - h;

      result.push({
        id: `${(a as any).id || (a as any).fieldName || 'field'}_${pageNumber}`,
        name: (a as any).fieldName || 'Field',
        type,
        x, y, width: w, height: h,
        pageNumber,
        value: type === 'checkbox' ? false : '',
        source: 'acroform',
      });
    }
  }

  return result;
}


