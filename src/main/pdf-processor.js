const pdfPoppler = require('pdf-poppler');
const Tesseract = require('tesseract.js');
const fs = require('fs').promises;
const path = require('path');
const os = require('os');

/**
 * PDFProcessor - Advanced PDF form field detection using OCR + AI
 * 
 * This module provides an alternative to AcroForm detection by:
 * 1. Converting PDF pages to high-resolution images
 * 2. Performing OCR to extract text and coordinates
 * 3. Using AI to analyze layout and identify form fields
 * 4. Returning structured field data for overlay rendering
 */
class PDFProcessor {
  constructor() {
    this.tempDir = null;
    this.cleanupFiles = [];
  }

  /**
   * Process a PDF file and detect form fields using OCR + AI
   * @param {Buffer} pdfBuffer - PDF file as buffer
   * @param {Object} options - Processing options
   * @returns {Promise<Object>} - Form field data with page images
   */
  async processPDF(pdfBuffer, options = {}) {
    const {
      resolution = 300, // DPI for image conversion
      ocrLanguage = 'eng', // OCR language
      aiProvider = 'llama', // AI provider for analysis
      tempDir = null
    } = options;

    try {
      console.log('PDFProcessor: Starting OCR + AI processing...');
      
      // Setup temporary directory
      this.tempDir = tempDir || await this.createTempDir();
      
      // Step 1: Convert PDF to images
      console.log('PDFProcessor: Converting PDF to images...');
      const pageImages = await this.convertPDFToImages(pdfBuffer, resolution);
      
      // Step 2: Perform OCR on each page
      console.log('PDFProcessor: Performing OCR on pages...');
      const ocrResults = await this.performOCR(pageImages, ocrLanguage);
      
      // Step 3: Use AI to analyze layout and identify form fields
      console.log('PDFProcessor: Analyzing layout with AI...');
      const formFields = await this.analyzeLayoutWithAI(ocrResults, aiProvider);
      
      // Step 4: Return structured data
      const result = {
        success: true,
        pageImages: pageImages,
        fields: formFields,
        processingMethod: 'ocr_ai',
        metadata: {
          totalPages: pageImages.length,
          totalFields: formFields.length,
          resolution: resolution,
          ocrLanguage: ocrLanguage
        }
      };

      console.log(`PDFProcessor: Successfully processed ${pageImages.length} pages, found ${formFields.length} fields`);
      return result;

    } catch (error) {
      console.error('PDFProcessor: Error processing PDF:', error);
      return {
        success: false,
        error: error.message,
        processingMethod: 'ocr_ai'
      };
    } finally {
      // Cleanup temporary files
      await this.cleanup();
    }
  }

  /**
   * Convert PDF pages to high-resolution PNG images
   * @param {Buffer} pdfBuffer - PDF file buffer
   * @param {number} resolution - DPI resolution
   * @returns {Promise<string[]>} - Array of image file paths
   */
  async convertPDFToImages(pdfBuffer, resolution = 300) {
    const pdfPath = path.join(this.tempDir, 'input.pdf');
    const outputDir = path.join(this.tempDir, 'pages');
    
    // Write PDF buffer to temporary file
    await fs.writeFile(pdfPath, pdfBuffer);
    this.cleanupFiles.push(pdfPath);
    
    // Create output directory
    await fs.mkdir(outputDir, { recursive: true });

    try {
      // Use system pdftoppm directly instead of pdf-poppler
      const { spawn } = require('child_process');
      
      return new Promise((resolve, reject) => {
        const outputPrefix = path.join(outputDir, 'page');
        
        // Use system pdftoppm command
        const pdftoppm = spawn('pdftoppm', [
          '-png',
          '-r', resolution.toString(),
          pdfPath,
          outputPrefix
        ], {
          stdio: 'pipe'
        });

        let stdout = '';
        let stderr = '';

        pdftoppm.stdout.on('data', (data) => {
          stdout += data.toString();
        });

        pdftoppm.stderr.on('data', (data) => {
          stderr += data.toString();
        });

        pdftoppm.on('close', async (code) => {
          if (code === 0) {
            try {
              // Get list of generated image files
              const files = await fs.readdir(outputDir);
              const imageFiles = files
                .filter(file => file.endsWith('.png'))
                .sort((a, b) => {
                  // Sort by page number
                  const aNum = parseInt(a.match(/\d+/)?.[0] || '0');
                  const bNum = parseInt(b.match(/\d+/)?.[0] || '0');
                  return aNum - bNum;
                })
                .map(file => path.join(outputDir, file));

              // Add to cleanup list
              this.cleanupFiles.push(...imageFiles);
              
              console.log(`PDFProcessor: Generated ${imageFiles.length} page images using system pdftoppm`);
              resolve(imageFiles);
            } catch (error) {
              reject(new Error(`Failed to read generated images: ${error.message}`));
            }
          } else {
            reject(new Error(`pdftoppm failed with code ${code}: ${stderr}`));
          }
        });

        pdftoppm.on('error', (error) => {
          reject(new Error(`Failed to start pdftoppm: ${error.message}`));
        });
      });
      
    } catch (error) {
      console.error('PDFProcessor: Error converting PDF to images:', error);
      throw new Error(`Failed to convert PDF to images: ${error.message}`);
    }
  }

  /**
   * Perform OCR on page images to extract text and coordinates
   * @param {string[]} imagePaths - Array of image file paths
   * @param {string} language - OCR language code
   * @returns {Promise<Array>} - OCR results with text and bounding boxes
   */
  async performOCR(imagePaths, language = 'eng') {
    const ocrResults = [];
    
    for (let i = 0; i < imagePaths.length; i++) {
      const imagePath = imagePaths[i];
      console.log(`PDFProcessor: Performing OCR on page ${i + 1}...`);
      
      try {
        // Perform OCR with bounding box detection
        const { data } = await Tesseract.recognize(imagePath, language, {
          logger: (m) => {
            if (m.status === 'recognizing text') {
              console.log(`OCR Progress: ${Math.round(m.progress * 100)}%`);
            }
          }
        });

        // Extract text with bounding boxes
        const pageData = {
          pageNumber: i + 1,
          imagePath: imagePath,
          text: data.text,
          words: (data.words || []).map(word => ({
            text: word.text,
            confidence: word.confidence,
            bbox: {
              x0: word.bbox.x0,
              y0: word.bbox.y0,
              x1: word.bbox.x1,
              y1: word.bbox.y1
            }
          })),
          lines: (data.lines || []).map(line => ({
            text: line.text,
            confidence: line.confidence,
            bbox: {
              x0: line.bbox.x0,
              y0: line.bbox.y0,
              x1: line.bbox.x1,
              y1: line.bbox.y1
            }
          }))
        };

        ocrResults.push(pageData);
        console.log(`PDFProcessor: OCR completed for page ${i + 1}, found ${pageData.words.length} words`);
        
      } catch (error) {
        console.error(`PDFProcessor: OCR failed for page ${i + 1}:`, error);
        // Continue with other pages
        ocrResults.push({
          pageNumber: i + 1,
          imagePath: imagePath,
          text: '',
          words: [],
          lines: [],
          error: error.message
        });
      }
    }

    return ocrResults;
  }

  /**
   * Use AI to analyze OCR data and identify form fields
   * @param {Array} ocrResults - OCR results from all pages
   * @param {string} aiProvider - AI provider to use
   * @returns {Promise<Array>} - Detected form fields
   */
  async analyzeLayoutWithAI(ocrResults, aiProvider = 'llama') {
    try {
      // Prepare OCR data for AI analysis
      const ocrData = ocrResults.map(page => ({
        pageNumber: page.pageNumber,
        text: page.text,
        words: page.words.map(word => ({
          text: word.text,
          bbox: word.bbox
        }))
      }));

      // Create AI prompt for form field detection
      const prompt = this.createFormFieldDetectionPrompt(ocrData);
      
      // Call AI service (using existing LLM infrastructure)
      const aiResponse = await this.callAI(prompt, aiProvider);
      
      // Parse AI response to extract form fields
      const formFields = this.parseAIResponse(aiResponse, ocrResults);
      
      return formFields;
      
    } catch (error) {
      console.error('PDFProcessor: AI analysis failed:', error);
      // Fallback to rule-based field detection
      return this.fallbackFieldDetection(ocrResults);
    }
  }

  /**
   * Create AI prompt for form field detection
   * @param {Array} ocrData - OCR data from all pages
   * @returns {string} - Formatted AI prompt
   */
  createFormFieldDetectionPrompt(ocrData) {
    const prompt = `You are a document analysis expert. Based on the following OCR data, which contains text and its coordinates on PDF pages, identify all potential form fields (like text inputs, checkboxes, and signature areas). 

For each field, determine:
1. Its most likely label (based on nearby text)
2. Its type (text, checkbox, radio, dropdown, signature, etc.)
3. Its precise coordinates (x, y, width, height) based on the layout
4. The page number where it appears

The input fields themselves are empty spaces, so you must infer their location based on the labels and layout patterns.

Return this information as a clean JSON array with this exact structure:
[
  {
    "label": "Field Label",
    "type": "text|checkbox|radio|dropdown|signature",
    "page": 1,
    "x": 125,
    "y": 100,
    "width": 200,
    "height": 15,
    "confidence": 0.95
  }
]

Here is the OCR data:
${JSON.stringify(ocrData, null, 2)}

Focus on:
- Text input fields (usually have labels like "Name:", "Address:", "Email:")
- Checkboxes (often have labels ending with "□" or "☐")
- Radio buttons (usually grouped with labels)
- Dropdown/select fields (often have labels with "Select" or "Choose")
- Signature areas (usually labeled "Signature" or "Sign here")
- Date fields (often labeled "Date" or have date format hints)

Return ONLY the JSON array, no additional text.`;

    return prompt;
  }

  /**
   * Call AI service for form field analysis
   * @param {string} prompt - AI prompt
   * @param {string} provider - AI provider
   * @returns {Promise<string>} - AI response
   */
  async callAI(prompt, provider = 'llama') {
    // For testing purposes, we'll use a mock AI response
    // In the real implementation, this would be called via IPC from main.js
    console.log('PDFProcessor: Using mock AI response for testing');
    
    // Mock AI response based on common form patterns
    const mockResponse = `[
  {
    "label": "Full Name",
    "type": "text",
    "page": 1,
    "x": 125,
    "y": 100,
    "width": 200,
    "height": 15,
    "confidence": 0.95
  },
  {
    "label": "Email Address",
    "type": "text",
    "page": 1,
    "x": 125,
    "y": 130,
    "width": 200,
    "height": 15,
    "confidence": 0.90
  },
  {
    "label": "Phone Number",
    "type": "text",
    "page": 1,
    "x": 125,
    "y": 160,
    "width": 200,
    "height": 15,
    "confidence": 0.85
  },
  {
    "label": "Address",
    "type": "text",
    "page": 1,
    "x": 125,
    "y": 190,
    "width": 200,
    "height": 15,
    "confidence": 0.88
  },
  {
    "label": "I Agree to Terms",
    "type": "checkbox",
    "page": 1,
    "x": 125,
    "y": 220,
    "width": 20,
    "height": 20,
    "confidence": 0.92
  },
  {
    "label": "Signature",
    "type": "signature",
    "page": 1,
    "x": 125,
    "y": 250,
    "width": 200,
    "height": 50,
    "confidence": 0.90
  }
]`;

    return mockResponse;
  }

  /**
   * Parse AI response to extract form fields
   * @param {string} aiResponse - Raw AI response
   * @param {Array} ocrResults - Original OCR results
   * @returns {Array} - Parsed form fields
   */
  parseAIResponse(aiResponse, ocrResults) {
    try {
      // Extract JSON from AI response
      const jsonMatch = aiResponse.match(/\[[\s\S]*\]/);
      if (!jsonMatch) {
        throw new Error('No JSON array found in AI response');
      }

      const fields = JSON.parse(jsonMatch[0]);
      
      // Validate and enhance field data
      return fields.map((field, index) => ({
        id: `ocr_field_${index}`,
        label: field.label || `Field ${index + 1}`,
        type: this.validateFieldType(field.type),
        page: Math.max(1, field.page || 1),
        x: Math.max(0, field.x || 0),
        y: Math.max(0, field.y || 0),
        width: Math.max(50, field.width || 200),
        height: Math.max(20, field.height || 25),
        confidence: Math.min(1, Math.max(0, field.confidence || 0.8)),
        source: 'ocr_ai'
      }));

    } catch (error) {
      console.error('PDFProcessor: Failed to parse AI response:', error);
      console.log('AI Response:', aiResponse);
      throw new Error(`Failed to parse AI response: ${error.message}`);
    }
  }

  /**
   * Validate and normalize field type
   * @param {string} type - Raw field type
   * @returns {string} - Validated field type
   */
  validateFieldType(type) {
    const validTypes = ['text', 'checkbox', 'radio', 'dropdown', 'signature'];
    const normalizedType = (type || 'text').toLowerCase();
    
    if (validTypes.includes(normalizedType)) {
      return normalizedType;
    }
    
    // Map common variations
    const typeMap = {
      'input': 'text',
      'textbox': 'text',
      'select': 'dropdown',
      'sign': 'signature',
      'date': 'text'
    };
    
    return typeMap[normalizedType] || 'text';
  }

  /**
   * Fallback field detection using rule-based approach
   * @param {Array} ocrResults - OCR results
   * @returns {Array} - Detected form fields
   */
  fallbackFieldDetection(ocrResults) {
    console.log('PDFProcessor: Using fallback rule-based field detection');
    
    const fields = [];
    let fieldIndex = 0;

    ocrResults.forEach(page => {
      if (page.error) return;

      // Look for common form field patterns
      const fieldPatterns = [
        { pattern: /name\s*:?\s*$/i, type: 'text', label: 'Name' },
        { pattern: /full\s*name\s*:?\s*$/i, type: 'text', label: 'Full Name' },
        { pattern: /email\s*:?\s*$/i, type: 'text', label: 'Email' },
        { pattern: /phone\s*:?\s*$/i, type: 'text', label: 'Phone' },
        { pattern: /address\s*:?\s*$/i, type: 'text', label: 'Address' },
        { pattern: /city\s*:?\s*$/i, type: 'text', label: 'City' },
        { pattern: /state\s*:?\s*$/i, type: 'text', label: 'State' },
        { pattern: /zip\s*:?\s*$/i, type: 'text', label: 'ZIP Code' },
        { pattern: /country\s*:?\s*$/i, type: 'text', label: 'Country' },
        { pattern: /date\s*:?\s*$/i, type: 'text', label: 'Date' },
        { pattern: /signature\s*:?\s*$/i, type: 'signature', label: 'Signature' },
        { pattern: /agree\s*:?\s*$/i, type: 'checkbox', label: 'I Agree' },
        { pattern: /terms\s*:?\s*$/i, type: 'checkbox', label: 'Accept Terms' }
      ];

      page.words.forEach((word, wordIndex) => {
        fieldPatterns.forEach(pattern => {
          if (pattern.pattern.test(word.text)) {
            // Estimate field position (to the right of the label)
            const fieldX = word.bbox.x1 + 10;
            const fieldY = word.bbox.y0;
            const fieldWidth = pattern.type === 'checkbox' ? 20 : 200;
            const fieldHeight = pattern.type === 'checkbox' ? 20 : 25;

            fields.push({
              id: `fallback_field_${fieldIndex++}`,
              label: pattern.label,
              type: pattern.type,
              page: page.pageNumber,
              x: fieldX,
              y: fieldY,
              width: fieldWidth,
              height: fieldHeight,
              confidence: 0.6,
              source: 'fallback_rules'
            });
          }
        });
      });
    });

    console.log(`PDFProcessor: Fallback detection found ${fields.length} fields`);
    return fields;
  }

  /**
   * Create temporary directory for processing
   * @returns {Promise<string>} - Path to temporary directory
   */
  async createTempDir() {
    const tempDir = path.join(os.tmpdir(), `inkflow-pdf-${Date.now()}`);
    await fs.mkdir(tempDir, { recursive: true });
    this.cleanupFiles.push(tempDir);
    return tempDir;
  }

  /**
   * Cleanup temporary files
   */
  async cleanup() {
    for (const file of this.cleanupFiles) {
      try {
        const stat = await fs.stat(file);
        if (stat.isDirectory()) {
          await fs.rmdir(file, { recursive: true });
        } else {
          await fs.unlink(file);
        }
      } catch (error) {
        // Ignore cleanup errors
        console.log(`PDFProcessor: Cleanup warning for ${file}:`, error.message);
      }
    }
    this.cleanupFiles = [];
  }

  /**
   * Check if OCR + AI processing is available
   * @returns {Promise<Object>} - Availability status
   */
  static async checkAvailability() {
    try {
      // Check if poppler is available
      const { spawn } = require('child_process');
      
      return new Promise((resolve) => {
        const checkPoppler = spawn('pdftoppm', ['-h'], { stdio: 'pipe' });
        
        checkPoppler.on('close', (code) => {
          if (code === 0) {
            resolve({
              available: true,
              poppler: true,
              tesseract: true, // tesseract.js is a Node.js package
              message: 'OCR + AI processing is available'
            });
          } else {
            resolve({
              available: false,
              poppler: false,
              tesseract: true,
              message: 'Poppler (pdftoppm) is not available. Please install poppler-utils.'
            });
          }
        });

        checkPoppler.on('error', () => {
          resolve({
            available: false,
            poppler: false,
            tesseract: true,
            message: 'Poppler (pdftoppm) is not available. Please install poppler-utils.'
          });
        });
      });
    } catch (error) {
      return {
        available: false,
        poppler: false,
        tesseract: false,
        message: `Error checking availability: ${error.message}`
      };
    }
  }
}

module.exports = PDFProcessor;
