import * as pdfjsLib from 'pdfjs-dist';
import Tesseract, { createWorker } from 'tesseract.js';

export interface TextRegion {
  text: string;
  bbox: {
    x0: number;
    y0: number;
    x1: number;
    y1: number;
  };
  confidence: number;
  page: number;
}

export interface ExtractedPageData {
  pageNumber: number;
  width: number;
  height: number;
  textRegions: TextRegion[];
  fullText: string;
}

export interface PDFExtractionResult {
  pages: ExtractedPageData[];
  totalPages: number;
  processingTime: number;
  success: boolean;
  error?: string;
}

export class PDFTextExtractor {
  private worker: Tesseract.Worker | null = null;
  private isInitialized = false;

  async initialize(): Promise<void> {
    if (this.isInitialized) return;

    try {
      console.log('Initializing Tesseract.js worker...');
      
      // Create Tesseract worker
      this.worker = await createWorker('eng', 1, {
        logger: (m) => {
          console.log(`Tesseract: ${m.status} - ${m.progress ? Math.round(m.progress * 100) + '%' : ''}`);
        },
      });
      
      console.log('Tesseract worker created successfully');

      // Test the worker with a simple image
      try {
        console.log('Testing Tesseract worker...');
        const testResult = await this.worker.recognize('data:image/png;base64,iVBORw0KGgoAAAANSUhEUgAAAAEAAAABCAYAAAAfFcSJAAAADUlEQVR42mNkYPhfDwAChwGA60e6kgAAAABJRU5ErkJggg==');
        console.log('Tesseract worker test successful:', testResult.data.text);
      } catch (testError) {
        console.error('Tesseract worker test failed:', testError);
        throw new Error(`Tesseract worker test failed: ${testError instanceof Error ? testError.message : 'Unknown error'}`);
      }

      // Configure Tesseract for better form field detection
      try {
        await this.worker.setParameters({
          tessedit_char_whitelist: 'ABCDEFGHIJKLMNOPQRSTUVWXYZabcdefghijklmnopqrstuvwxyz0123456789.,!?@#$%&*()[]{}:;-_+=|\\/"\'~` \t\n',
          tessedit_pageseg_mode: '6' as any, // Uniform block of text
          preserve_interword_spaces: '1',
        });
        console.log('Tesseract parameters configured successfully');
      } catch (paramError) {
        console.warn('Failed to set Tesseract parameters, using defaults:', paramError);
        // Continue with default parameters - this is not critical
      }

      this.isInitialized = true;
      console.log('PDF Text Extractor initialized successfully');
    } catch (error) {
      console.error('Failed to initialize PDF Text Extractor:', error);
      this.isInitialized = false;
      this.worker = null;
      
      // Create a more helpful error message
      let errorMessage = 'OCR initialization failed';
      if (error instanceof Error) {
        if (error.message.includes('network') || error.message.includes('fetch')) {
          errorMessage = 'OCR initialization failed: Network error. Please check your internet connection.';
        } else if (error.message.includes('worker')) {
          errorMessage = 'OCR initialization failed: Web Worker error. This may be due to browser restrictions.';
        } else {
          errorMessage = `OCR initialization failed: ${error.message}`;
        }
      }
      
      throw new Error(errorMessage);
    }
  }

  async extractTextFromPDF(pdfBytes: Uint8Array): Promise<PDFExtractionResult> {
    const startTime = Date.now();

    try {
      if (!this.isInitialized) {
        await this.initialize();
      }

      if (!this.worker) {
        throw new Error('Tesseract worker not initialized');
      }

      // Load PDF document
      const pdfDocument = await pdfjsLib.getDocument({ data: pdfBytes }).promise;
      const totalPages = pdfDocument.numPages;
      const pages: ExtractedPageData[] = [];

      console.log(`Starting OCR processing for ${totalPages} pages...`);

      // Process each page
      for (let pageNum = 1; pageNum <= totalPages; pageNum++) {
        try {
          const pageData = await this.extractTextFromPage(pdfDocument, pageNum);
          pages.push(pageData);
          console.log(`Completed OCR for page ${pageNum}/${totalPages}`);
        } catch (pageError) {
          console.error(`Error processing page ${pageNum}:`, pageError);
          // Continue processing other pages
          pages.push({
            pageNumber: pageNum,
            width: 0,
            height: 0,
            textRegions: [],
            fullText: '',
          });
        }
      }

      const processingTime = Date.now() - startTime;
      console.log(`\n=== OVERALL OCR PROCESSING SUMMARY ===`);
      console.log(`Total pages processed: ${totalPages}`);
      console.log(`Total processing time: ${processingTime}ms`);
      console.log(`Average time per page: ${Math.round(processingTime / totalPages)}ms`);
      
      // Calculate total statistics
      const totalWords = pages.reduce((sum, page) => sum + page.textRegions.length, 0);
      const totalText = pages.map(page => page.fullText).join(' ').trim();
      const avgConfidence = pages.reduce((sum, page) => {
        const pageConfidence = page.textRegions.reduce((pageSum, region) => pageSum + region.confidence, 0);
        return sum + (page.textRegions.length > 0 ? pageConfidence / page.textRegions.length : 0);
      }, 0) / totalPages;
      
      console.log(`Total words extracted: ${totalWords}`);
      console.log(`Average confidence: ${avgConfidence.toFixed(2)}%`);
      console.log(`Total extracted text length: ${totalText.length} characters`);
      console.log(`Full extracted text: "${totalText}"`);
      console.log(`=== END OCR PROCESSING SUMMARY ===\n`);

      return {
        pages,
        totalPages,
        processingTime,
        success: true,
      };
    } catch (error) {
      console.error('PDF text extraction failed:', error);
      return {
        pages: [],
        totalPages: 0,
        processingTime: Date.now() - startTime,
        success: false,
        error: error instanceof Error ? error.message : 'Unknown error',
      };
    }
  }

  private async extractTextFromPage(pdfDocument: any, pageNum: number): Promise<ExtractedPageData> {
    if (!this.worker) {
      throw new Error('Tesseract worker not available');
    }

    // Get PDF page
    const page = await pdfDocument.getPage(pageNum);
    const viewport = page.getViewport({ scale: 2.0 }); // Higher scale for better OCR

    // Create canvas to render PDF page
    const canvas = document.createElement('canvas');
    const context = canvas.getContext('2d');
    if (!context) {
      throw new Error('Failed to create canvas context');
    }

    canvas.width = viewport.width;
    canvas.height = viewport.height;

    // Render PDF page to canvas
    await page.render({
      canvasContext: context,
      viewport: viewport,
    }).promise;

    // Convert canvas to image data
    const imageData = canvas.toDataURL('image/png');

    // Perform OCR
    console.log(`Starting OCR recognition for page ${pageNum}...`);
    console.log(`Canvas dimensions: ${canvas.width}x${canvas.height}`);
    console.log(`Image data length: ${imageData.length} characters`);
    
    let data;
    try {
      const result = await this.worker.recognize(imageData);
      data = result.data;
      console.log(`OCR recognition completed for page ${pageNum}`);
    } catch (ocrError) {
      console.error(`OCR recognition failed for page ${pageNum}:`, ocrError);
      throw new Error(`OCR recognition failed: ${ocrError instanceof Error ? ocrError.message : 'Unknown error'}`);
    }

    // Process OCR results
    const textRegions: TextRegion[] = [];
    
    // Type assertion for Tesseract.js data structure
    const ocrData = data as any;
    const words = ocrData.words || [];

    console.log(`\n=== OCR EXTRACTION RESULTS FOR PAGE ${pageNum} ===`);
    console.log(`Total words detected: ${words.length}`);
    console.log(`Full text extracted: "${data.text || ''}"`);
    console.log(`Text confidence: ${data.confidence || 'N/A'}`);
    
    // Log all words with their details
    console.log('\n--- Individual Word Details ---');
    words.forEach((word: any, index: number) => {
      console.log(`Word ${index + 1}:`, {
        text: `"${word.text || ''}"`,
        confidence: word.confidence || 0,
        bbox: word.bbox || { x0: 0, y0: 0, x1: 0, y1: 0 },
        block_num: word.block_num || 'N/A',
        par_num: word.par_num || 'N/A',
        line_num: word.line_num || 'N/A',
        word_num: word.word_num || 'N/A'
      });
    });

    // Filter and process high-confidence words
    let highConfidenceCount = 0;
    for (const word of words) {
      if (word.text?.trim() && word.confidence > 30) { // Filter low-confidence words
        highConfidenceCount++;
        textRegions.push({
          text: word.text,
          bbox: {
            x0: word.bbox?.x0 || 0,
            y0: word.bbox?.y0 || 0,
            x1: word.bbox?.x1 || 0,
            y1: word.bbox?.y1 || 0,
          },
          confidence: word.confidence || 0,
          page: pageNum,
        });
      }
    }

    console.log(`\n--- Filtered Results ---`);
    console.log(`High-confidence words (>30%): ${highConfidenceCount}`);
    console.log(`Text regions created: ${textRegions.length}`);
    
    // Log the final text regions
    console.log('\n--- Final Text Regions ---');
    textRegions.forEach((region, index) => {
      console.log(`Region ${index + 1}:`, {
        text: `"${region.text}"`,
        confidence: region.confidence,
        bbox: region.bbox,
        page: region.page
      });
    });
    
    console.log(`=== END OCR RESULTS FOR PAGE ${pageNum} ===\n`);

    return {
      pageNumber: pageNum,
      width: viewport.width,
      height: viewport.height,
      textRegions,
      fullText: data.text || '',
    };
  }

  async terminate(): Promise<void> {
    if (this.worker) {
      await this.worker.terminate();
      this.worker = null;
      this.isInitialized = false;
      console.log('PDF Text Extractor terminated');
    }
  }

  // Utility method to get text in a specific region
  getTextInRegion(
    pageData: ExtractedPageData,
    x: number,
    y: number,
    width: number,
    height: number
  ): string[] {
    const texts: string[] = [];

    for (const region of pageData.textRegions) {
      // Check if text region overlaps with specified area
      if (
        region.bbox.x0 >= x &&
        region.bbox.y0 >= y &&
        region.bbox.x1 <= x + width &&
        region.bbox.y1 <= y + height
      ) {
        texts.push(region.text);
      }
    }

    return texts;
  }

  // Get all text regions that contain specific keywords
  findTextRegionsWithKeywords(
    pageData: ExtractedPageData,
    keywords: string[]
  ): TextRegion[] {
    const matches: TextRegion[] = [];

    for (const region of pageData.textRegions) {
      const text = region.text.toLowerCase();
      for (const keyword of keywords) {
        if (text.includes(keyword.toLowerCase())) {
          matches.push(region);
          break; // Avoid duplicates
        }
      }
    }

    return matches;
  }
}

// Singleton instance for reuse
let extractorInstance: PDFTextExtractor | null = null;

export async function getPDFTextExtractor(): Promise<PDFTextExtractor> {
  if (!extractorInstance) {
    extractorInstance = new PDFTextExtractor();
    await extractorInstance.initialize();
  }
  return extractorInstance;
}

// Cleanup function
export function cleanupPDFTextExtractor(): void {
  if (extractorInstance) {
    extractorInstance.terminate();
    extractorInstance = null;
  }
}
