const { PDFDocument, rgb, StandardFonts } = require('pdf-lib');
const fs = require('fs').promises;
const path = require('path');

/**
 * PDFFinalizer - Handles "burning in" form data onto PDFs
 * 
 * This module takes form data and coordinates, then uses pdf-lib's drawing
 * capabilities to permanently write the data onto the PDF at the specified
 * locations, creating a flat, non-interactive PDF.
 */
class PDFFinalizer {
  constructor() {
    this.defaultFontSize = 12;
    this.defaultColor = rgb(0, 0, 0); // Black
    this.fieldPadding = 2;
  }

  /**
   * Finalize a PDF by burning in form data
   * @param {Buffer} originalPdfBuffer - Original PDF file buffer
   * @param {Array} formData - Array of form field data with coordinates
   * @param {Object} options - Finalization options
   * @returns {Promise<Buffer>} - Finalized PDF buffer
   */
  async finalizePDF(originalPdfBuffer, formData, options = {}) {
    const {
      fontSize = this.defaultFontSize,
      fontColor = this.defaultColor,
      backgroundColor = null,
      padding = this.fieldPadding,
      preserveOriginal = true
    } = options;

    try {
      console.log('PDFFinalizer: Starting PDF finalization...');
      console.log(`PDFFinalizer: Processing ${formData.length} form fields`);
      console.log('PDFFinalizer: Form data received:', formData.map(f => ({ 
        name: f.name, 
        type: f.type, 
        value: f.value,
        x: f.x,
        y: f.y,
        width: f.width,
        height: f.height
      })));

      // Load the original PDF
      const pdfDoc = await PDFDocument.load(originalPdfBuffer);
      const pages = pdfDoc.getPages();
      
      // Load default font
      const font = await pdfDoc.embedFont(StandardFonts.Helvetica);
      
      // Group form data by page
      const formDataByPage = this.groupFormDataByPage(formData);
      
      // Process each page
      for (const [pageNumber, pageFormData] of formDataByPage.entries()) {
        if (pageNumber < pages.length) {
          const page = pages[pageNumber];
          await this.drawFormDataOnPage(page, pageFormData, font, {
            fontSize,
            fontColor,
            backgroundColor,
            padding
          });
        }
      }

      // Save the finalized PDF
      const finalizedPdfBytes = await pdfDoc.save();
      console.log('PDFFinalizer: PDF finalization completed successfully');
      
      return finalizedPdfBytes;

    } catch (error) {
      console.error('PDFFinalizer: Error finalizing PDF:', error);
      throw new Error(`Failed to finalize PDF: ${error.message}`);
    }
  }

  /**
   * Group form data by page number
   * @param {Array} formData - Form data array
   * @returns {Map} - Map of page number to form data
   */
  groupFormDataByPage(formData) {
    const grouped = new Map();
    
    formData.forEach(field => {
      const pageNum = field.pageNumber || field.page || 1;
      if (!grouped.has(pageNum)) {
        grouped.set(pageNum, []);
      }
      grouped.get(pageNum).push(field);
    });
    
    return grouped;
  }

  /**
   * Draw form data on a specific page
   * @param {PDFPage} page - PDF page object
   * @param {Array} pageFormData - Form data for this page
   * @param {PDFFont} font - Font to use for text
   * @param {Object} options - Drawing options
   */
  async drawFormDataOnPage(page, pageFormData, font, options) {
    const { fontSize, fontColor, backgroundColor, padding } = options;
    const pageSize = page.getSize();
    
    console.log(`PDFFinalizer: Drawing ${pageFormData.length} fields on page`);

    pageFormData.forEach(field => {
      try {
        // Convert coordinates if needed (OCR coordinates might be in different units)
        const coords = this.convertCoordinates(field, pageSize);
        
        // Draw background if specified
        if (backgroundColor) {
          page.drawRectangle({
            x: coords.x - padding,
            y: coords.y - padding,
            width: coords.width + (padding * 2),
            height: coords.height + (padding * 2),
            color: backgroundColor,
            opacity: 0.1
          });
        }

        // Draw the field value based on type
        switch (field.type) {
          case 'text':
            this.drawTextField(page, field, coords, font, fontSize, fontColor);
            break;
          case 'checkbox':
            this.drawCheckboxField(page, field, coords, font, fontSize, fontColor);
            break;
          case 'radio':
            this.drawRadioField(page, field, coords, font, fontSize, fontColor);
            break;
          case 'dropdown':
            this.drawDropdownField(page, field, coords, font, fontSize, fontColor);
            break;
          case 'signature':
            this.drawSignatureField(page, field, coords, font, fontSize, fontColor);
            break;
          default:
            this.drawTextField(page, field, coords, font, fontSize, fontColor);
        }

      } catch (error) {
        console.error(`PDFFinalizer: Error drawing field ${field.name}:`, error);
        // Continue with other fields
      }
    });
  }

  /**
   * Convert field coordinates to PDF coordinates
   * @param {Object} field - Field data
   * @param {Object} pageSize - Page dimensions
   * @returns {Object} - Converted coordinates
   */
  convertCoordinates(field, pageSize) {
    // PDF coordinates start from bottom-left, but OCR coordinates might be from top-left
    
    let x = field.x || 0;
    let y = field.y || 0;
    let width = field.width || 200;
    let height = field.height || 25;

    // Check if this is an AcroForm field (already in PDF coordinates)
    if (field.isAcroForm) {
      // AcroForm coordinates are already in PDF coordinate system (bottom-left origin)
      console.log(`PDFFinalizer: Using AcroForm coordinates for ${field.name}: (${x}, ${y})`);
    } else {
      // OCR coordinates are typically top-left origin, convert to bottom-left
      if (y > pageSize.height / 2) {
        y = pageSize.height - y - height;
        console.log(`PDFFinalizer: Converted OCR coordinates for ${field.name}: (${x}, ${y})`);
      }
    }

    // Ensure coordinates are within page bounds
    x = Math.max(0, Math.min(x, pageSize.width - width));
    y = Math.max(0, Math.min(y, pageSize.height - height));

    console.log(`PDFFinalizer: Final coordinates for ${field.name}: (${x}, ${y}) on page ${pageSize.width}x${pageSize.height}`);
    return { x, y, width, height };
  }

  /**
   * Draw a text field
   * @param {PDFPage} page - PDF page
   * @param {Object} field - Field data
   * @param {Object} coords - Coordinates
   * @param {PDFFont} font - Font
   * @param {number} fontSize - Font size
   * @param {Color} fontColor - Font color
   */
  drawTextField(page, field, coords, font, fontSize, fontColor) {
    const value = field.value || '';
    console.log(`PDFFinalizer: Drawing text field "${field.name}" with value "${value}" at (${coords.x}, ${coords.y})`);
    if (!value) {
      console.log(`PDFFinalizer: Skipping field "${field.name}" - no value provided`);
      return;
    }

    // Draw text with word wrapping
    const textWidth = font.widthOfTextAtSize(value, fontSize);
    const maxWidth = coords.width - (this.fieldPadding * 2);
    
    if (textWidth <= maxWidth) {
      // Single line
      page.drawText(value, {
        x: coords.x + this.fieldPadding,
        y: coords.y + (coords.height - fontSize) / 2,
        size: fontSize,
        font: font,
        color: fontColor,
      });
    } else {
      // Multi-line text (simplified)
      const words = value.split(' ');
      let currentLine = '';
      let lineY = coords.y + coords.height - fontSize - this.fieldPadding;
      
      for (const word of words) {
        const testLine = currentLine + (currentLine ? ' ' : '') + word;
        const testWidth = font.widthOfTextAtSize(testLine, fontSize);
        
        if (testWidth <= maxWidth) {
          currentLine = testLine;
        } else {
          if (currentLine) {
            page.drawText(currentLine, {
              x: coords.x + this.fieldPadding,
              y: lineY,
              size: fontSize,
              font: font,
              color: fontColor,
            });
            lineY -= fontSize + 2;
            currentLine = word;
          }
        }
      }
      
      if (currentLine) {
        page.drawText(currentLine, {
          x: coords.x + this.fieldPadding,
          y: lineY,
          size: fontSize,
          font: font,
          color: fontColor,
        });
      }
    }
  }

  /**
   * Draw a checkbox field
   * @param {PDFPage} page - PDF page
   * @param {Object} field - Field data
   * @param {Object} coords - Coordinates
   * @param {PDFFont} font - Font
   * @param {number} fontSize - Font size
   * @param {Color} fontColor - Font color
   */
  drawCheckboxField(page, field, coords, font, fontSize, fontColor) {
    const isChecked = field.value === true || field.value === 'true' || field.value === 'checked';
    
    // Draw checkbox border
    page.drawRectangle({
      x: coords.x,
      y: coords.y,
      width: coords.height, // Square checkbox
      height: coords.height,
      borderColor: fontColor,
      borderWidth: 1,
    });

    if (isChecked) {
      // Draw checkmark using a simple "X" that's supported by standard fonts
      const checkSize = coords.height * 0.6;
      const centerX = coords.x + coords.height / 2;
      const centerY = coords.y + coords.height / 2;
      
      page.drawText('X', {
        x: centerX - checkSize / 2,
        y: centerY - checkSize / 2,
        size: checkSize,
        font: font,
        color: fontColor,
      });
    }
  }

  /**
   * Draw a radio button field
   * @param {PDFPage} page - PDF page
   * @param {Object} field - Field data
   * @param {Object} coords - Coordinates
   * @param {PDFFont} font - Font
   * @param {number} fontSize - Font size
   * @param {Color} fontColor - Font color
   */
  drawRadioField(page, field, coords, font, fontSize, fontColor) {
    const isSelected = field.value === field.name || field.value === 'true';
    
    // Draw radio button circle
    const radius = coords.height / 2;
    const centerX = coords.x + radius;
    const centerY = coords.y + radius;
    
    page.drawCircle({
      x: centerX,
      y: centerY,
      size: radius,
      borderColor: fontColor,
      borderWidth: 1,
    });

    if (isSelected) {
      // Draw filled circle
      page.drawCircle({
        x: centerX,
        y: centerY,
        size: radius * 0.5,
        color: fontColor,
      });
    }
  }

  /**
   * Draw a dropdown field
   * @param {PDFPage} page - PDF page
   * @param {Object} field - Field data
   * @param {Object} coords - Coordinates
   * @param {PDFFont} font - Font
   * @param {number} fontSize - Font size
   * @param {Color} fontColor - Font color
   */
  drawDropdownField(page, field, coords, font, fontSize, fontColor) {
    const value = field.value || '';
    
    // Draw dropdown border
    page.drawRectangle({
      x: coords.x,
      y: coords.y,
      width: coords.width,
      height: coords.height,
      borderColor: fontColor,
      borderWidth: 1,
    });

    // Draw selected value
    if (value) {
      page.drawText(value, {
        x: coords.x + this.fieldPadding,
        y: coords.y + (coords.height - fontSize) / 2,
        size: fontSize,
        font: font,
        color: fontColor,
      });
    }

    // Draw dropdown arrow
    const arrowSize = coords.height * 0.3;
    const arrowX = coords.x + coords.width - arrowSize - this.fieldPadding;
    const arrowY = coords.y + (coords.height - arrowSize) / 2;
    
    page.drawText('▼', {
      x: arrowX,
      y: arrowY,
      size: arrowSize,
      font: font,
      color: fontColor,
    });
  }

  /**
   * Draw a signature field
   * @param {PDFPage} page - PDF page
   * @param {Object} field - Field data
   * @param {Object} coords - Coordinates
   * @param {PDFFont} font - Font
   * @param {number} fontSize - Font size
   * @param {Color} fontColor - Font color
   */
  drawSignatureField(page, field, coords, font, fontSize, fontColor) {
    const value = field.value || '';
    
    // Draw signature border
    page.drawRectangle({
      x: coords.x,
      y: coords.y,
      width: coords.width,
      height: coords.height,
      borderColor: fontColor,
      borderWidth: 1,
      borderDashArray: [5, 5], // Dashed border for signature
    });

    if (value) {
      // Draw signature text
      page.drawText(value, {
        x: coords.x + this.fieldPadding,
        y: coords.y + (coords.height - fontSize) / 2,
        size: fontSize,
        font: font,
        color: fontColor,
      });
    } else {
      // Draw placeholder text
      page.drawText('Signature', {
        x: coords.x + this.fieldPadding,
        y: coords.y + (coords.height - fontSize) / 2,
        size: fontSize,
        font: font,
        color: rgb(0.5, 0.5, 0.5), // Gray placeholder
      });
    }
  }

  /**
   * Create a finalized PDF from form data and save it
   * @param {Buffer} originalPdfBuffer - Original PDF buffer
   * @param {Array} formData - Form data with coordinates
   * @param {string} outputPath - Output file path
   * @param {Object} options - Finalization options
   * @returns {Promise<string>} - Path to saved file
   */
  async finalizeAndSave(originalPdfBuffer, formData, outputPath, options = {}) {
    try {
      const finalizedPdfBytes = await this.finalizePDF(originalPdfBuffer, formData, options);
      await fs.writeFile(outputPath, finalizedPdfBytes);
      console.log(`PDFFinalizer: Finalized PDF saved to ${outputPath}`);
      return outputPath;
    } catch (error) {
      console.error('PDFFinalizer: Error saving finalized PDF:', error);
      throw error;
    }
  }

  /**
   * Validate form data structure
   * @param {Array} formData - Form data to validate
   * @returns {Object} - Validation result
   */
  validateFormData(formData) {
    if (!Array.isArray(formData)) {
      return { valid: false, error: 'Form data must be an array' };
    }

    for (let i = 0; i < formData.length; i++) {
      const field = formData[i];
      
      if (!field.name && !field.label) {
        return { valid: false, error: `Field ${i} missing name/label` };
      }
      
      if (typeof field.x !== 'number' || typeof field.y !== 'number') {
        return { valid: false, error: `Field ${i} missing valid coordinates` };
      }
      
      if (typeof field.width !== 'number' || typeof field.height !== 'number') {
        return { valid: false, error: `Field ${i} missing valid dimensions` };
      }
    }

    return { valid: true };
  }
}

module.exports = PDFFinalizer;
