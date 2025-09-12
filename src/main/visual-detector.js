/**
 * Visual Detector - Detects form elements using computer vision
 * Finds lines, boxes, checkboxes, and other visual form indicators
 */

const Jimp = require('jimp');
const pdf2pic = require('pdf2pic');
const fs = require('fs').promises;
const path = require('path');
const os = require('os');

class VisualDetector {
    constructor() {
        this.name = 'Visual Detector';
        this.version = '1.0.0';
        this.tempDir = path.join(os.tmpdir(), 'inkflow-visual-detection');
    }

    /**
     * Detect visual form elements in PDF
     * @param {Uint8Array} pdfBytes - PDF file bytes
     * @returns {Promise<Object>} Detection result with visual elements
     */
    async detectVisualElements(pdfBytes) {
        const startTime = Date.now();
        
        try {
            console.log('🔍 Visual: Starting visual element detection...');
            
            // Ensure temp directory exists
            await this.ensureTempDir();
            
            // Convert PDF to images
            const images = await this.pdfToImages(pdfBytes);
            
            if (images.length === 0) {
                return {
                    success: true,
                    method: 'visual',
                    confidence: 0,
                    elements: [],
                    processingTime: Date.now() - startTime,
                    message: 'No images generated from PDF'
                };
            }

            console.log(`🔍 Visual: Processing ${images.length} page images...`);

            // Detect form elements in each image
            const allElements = [];
            
            for (let i = 0; i < images.length; i++) {
                try {
                    const pageElements = await this.detectElementsInImage(images[i], i + 1);
                    if (pageElements && Array.isArray(pageElements)) {
                        allElements.push(...pageElements);
                    }
                } catch (error) {
                    console.log(`⚠️ Visual: Failed to process image ${images[i]}: ${error.message}`);
                    // Continue with other images instead of failing completely
                }
            }

            // Clean up temporary files
            await this.cleanup();

            const processingTime = Date.now() - startTime;
            const confidence = this.calculateOverallConfidence(allElements);
            
            console.log(`✅ Visual: Detected ${allElements.length} elements in ${processingTime}ms (confidence: ${confidence})`);

            return {
                success: true,
                method: 'visual',
                confidence,
                elements: allElements,
                processingTime,
                metadata: {
                    pagesProcessed: images.length,
                    elementsFound: allElements.length,
                    averageElementsPerPage: Math.round(allElements.length / images.length * 10) / 10
                }
            };

        } catch (error) {
            console.error('❌ Visual detection failed:', error);
            await this.cleanup();
            
            return {
                success: false,
                method: 'visual',
                confidence: 0,
                elements: [],
                processingTime: Date.now() - startTime,
                error: error.message
            };
        }
    }

    /**
     * Convert PDF to images for visual analysis
     * @param {Uint8Array} pdfBytes - PDF file bytes
     * @returns {Promise<Array>} Array of image file paths
     */
    async pdfToImages(pdfBytes) {
        try {
            // Save PDF to temporary file
            const tempPdfPath = path.join(this.tempDir, `temp_${Date.now()}.pdf`);
            await fs.writeFile(tempPdfPath, pdfBytes);

            // Configure pdf2pic
            const convert = pdf2pic.fromPath(tempPdfPath, {
                density: 200, // DPI for good quality
                saveFilename: 'page',
                savePath: this.tempDir,
                format: 'png',
                width: 1200,
                height: 1600
            });

            // Convert first 3 pages (most forms are on first few pages)
            const maxPages = 3;
            const results = await convert.bulk(-1, { responseType: 'image' });
            
            // Clean up PDF file
            await fs.unlink(tempPdfPath).catch(() => {});

            // Return paths to generated images
            return results.slice(0, maxPages).map(result => result.path);

        } catch (error) {
            console.error('❌ PDF to image conversion failed:', error);
            return [];
        }
    }

    /**
     * Detect form elements in a single image
     * @param {string} imagePath - Path to image file
     * @param {number} pageNumber - Page number
     * @returns {Promise<Array>} Array of detected elements
     */
    async detectElementsInImage(imagePath, pageNumber) {
        try {
            // Check if image file exists
            const fs = require('fs');
            if (!fs.existsSync(imagePath)) {
                console.log(`⚠️ Visual: Image file not found: ${imagePath}`);
                return [];
            }

            // Load image with Jimp
            const image = await Jimp.read(imagePath);
            if (!image) {
                console.log(`⚠️ Visual: Failed to load image: ${imagePath}`);
                return [];
            }
            
            const elements = [];

            // Convert to grayscale for better edge detection
            const grayImage = image.clone().greyscale();

            // Detect different types of form elements
            const lines = await this.detectHorizontalLines(grayImage, pageNumber);
            const boxes = await this.detectRectangles(grayImage, pageNumber);
            const checkboxes = await this.detectCheckboxes(grayImage, pageNumber);

            elements.push(...lines, ...boxes, ...checkboxes);

            // Clean up image file
            try {
                const fs = require('fs').promises;
                await fs.unlink(imagePath);
            } catch (error) {
                // Ignore cleanup errors
            }

            return elements;

        } catch (error) {
            console.warn(`⚠️ Visual: Failed to process image ${imagePath}:`, error);
            return [];
        }
    }

    /**
     * Detect horizontal lines (signature lines, underscores)
     * @param {Object} image - Jimp image object
     * @param {number} pageNumber - Page number
     * @returns {Promise<Array>} Array of detected lines
     */
    async detectHorizontalLines(image, pageNumber) {
        const elements = [];
        const width = image.bitmap.width;
        const height = image.bitmap.height;
        
        try {
            // Scan for horizontal lines
            for (let y = 0; y < height; y += 5) { // Sample every 5 pixels for performance
                let lineStart = null;
                let lineLength = 0;
                
                for (let x = 0; x < width; x++) {
                    const pixel = Jimp.intToRGBA(image.getPixelColor(x, y));
                    const brightness = (pixel.r + pixel.g + pixel.b) / 3;
                    
                    // Dark pixel (potential line)
                    if (brightness < 100) {
                        if (lineStart === null) {
                            lineStart = x;
                            lineLength = 1;
                        } else {
                            lineLength++;
                        }
                    } else {
                        // End of potential line
                        if (lineStart !== null && lineLength > 50) { // Minimum line length
                            elements.push({
                                type: 'line',
                                subtype: 'horizontal',
                                confidence: this.calculateLineConfidence(lineLength, y, height),
                                position: {
                                    page: pageNumber,
                                    x: lineStart,
                                    y: y,
                                    width: lineLength,
                                    height: 2
                                },
                                properties: {
                                    length: lineLength,
                                    thickness: 2,
                                    purpose: 'signature_or_input'
                                }
                            });
                        }
                        lineStart = null;
                        lineLength = 0;
                    }
                }
            }

        } catch (error) {
            console.warn('⚠️ Visual: Line detection failed:', error);
        }

        return elements;
    }

    /**
     * Detect rectangular boxes (input fields)
     * @param {Object} image - Jimp image object
     * @param {number} pageNumber - Page number
     * @returns {Promise<Array>} Array of detected rectangles
     */
    async detectRectangles(image, pageNumber) {
        const elements = [];
        const width = image.bitmap.width;
        const height = image.bitmap.height;
        
        try {
            // Simple edge detection for rectangles
            const edges = await this.detectEdges(image);
            
            // Find rectangular patterns
            const rectangles = this.findRectangularPatterns(edges, width, height);
            
            rectangles.forEach((rect, index) => {
                if (this.isLikelyFormField(rect)) {
                    elements.push({
                        type: 'box',
                        subtype: 'input_field',
                        confidence: this.calculateBoxConfidence(rect),
                        position: {
                            page: pageNumber,
                            x: rect.x,
                            y: rect.y,
                            width: rect.width,
                            height: rect.height
                        },
                        properties: {
                            area: rect.width * rect.height,
                            aspectRatio: rect.width / rect.height,
                            purpose: 'text_input'
                        }
                    });
                }
            });

        } catch (error) {
            console.warn('⚠️ Visual: Rectangle detection failed:', error);
        }

        return elements;
    }

    /**
     * Detect checkboxes and radio buttons
     * @param {Object} image - Jimp image object
     * @param {number} pageNumber - Page number
     * @returns {Promise<Array>} Array of detected checkboxes
     */
    async detectCheckboxes(image, pageNumber) {
        const elements = [];
        const width = image.bitmap.width;
        const height = image.bitmap.height;
        
        try {
            // Look for small square patterns
            for (let y = 0; y < height - 20; y += 10) {
                for (let x = 0; x < width - 20; x += 10) {
                    const square = this.analyzeSquareRegion(image, x, y, 15);
                    
                    if (square.isCheckbox) {
                        elements.push({
                            type: 'checkbox',
                            subtype: square.checked ? 'checked' : 'unchecked',
                            confidence: square.confidence,
                            position: {
                                page: pageNumber,
                                x: x,
                                y: y,
                                width: 15,
                                height: 15
                            },
                            properties: {
                                checked: square.checked,
                                purpose: 'selection'
                            }
                        });
                    }
                }
            }

        } catch (error) {
            console.warn('⚠️ Visual: Checkbox detection failed:', error);
        }

        return elements;
    }

    /**
     * Simple edge detection
     * @param {Object} image - Jimp image object
     * @returns {Array} 2D array of edge strengths
     */
    async detectEdges(image) {
        const width = image.bitmap.width;
        const height = image.bitmap.height;
        const edges = [];

        for (let y = 1; y < height - 1; y++) {
            edges[y] = [];
            for (let x = 1; x < width - 1; x++) {
                // Simple Sobel operator
                const tl = Jimp.intToRGBA(image.getPixelColor(x - 1, y - 1)).r;
                const tm = Jimp.intToRGBA(image.getPixelColor(x, y - 1)).r;
                const tr = Jimp.intToRGBA(image.getPixelColor(x + 1, y - 1)).r;
                const ml = Jimp.intToRGBA(image.getPixelColor(x - 1, y)).r;
                const mr = Jimp.intToRGBA(image.getPixelColor(x + 1, y)).r;
                const bl = Jimp.intToRGBA(image.getPixelColor(x - 1, y + 1)).r;
                const bm = Jimp.intToRGBA(image.getPixelColor(x, y + 1)).r;
                const br = Jimp.intToRGBA(image.getPixelColor(x + 1, y + 1)).r;

                const gx = (tr + 2 * mr + br) - (tl + 2 * ml + bl);
                const gy = (bl + 2 * bm + br) - (tl + 2 * tm + tr);
                
                edges[y][x] = Math.sqrt(gx * gx + gy * gy);
            }
        }

        return edges;
    }

    /**
     * Find rectangular patterns in edge data
     * @param {Array} edges - 2D edge array
     * @param {number} width - Image width
     * @param {number} height - Image height
     * @returns {Array} Array of rectangle objects
     */
    findRectangularPatterns(edges, width, height) {
        const rectangles = [];
        
        // Simple rectangle detection (can be enhanced)
        for (let y = 10; y < height - 30; y += 20) {
            for (let x = 10; x < width - 50; x += 20) {
                const rect = this.analyzeRectangularRegion(edges, x, y, 100, 25);
                if (rect.isRectangle) {
                    rectangles.push({
                        x: x,
                        y: y,
                        width: rect.width,
                        height: rect.height,
                        confidence: rect.confidence
                    });
                }
            }
        }

        return rectangles;
    }

    /**
     * Analyze a region for rectangular patterns
     * @param {Array} edges - Edge data
     * @param {number} x - X coordinate
     * @param {number} y - Y coordinate
     * @param {number} maxWidth - Maximum width to check
     * @param {number} maxHeight - Maximum height to check
     * @returns {Object} Rectangle analysis result
     */
    analyzeRectangularRegion(edges, x, y, maxWidth, maxHeight) {
        try {
            // Look for strong horizontal and vertical edges
            let topEdge = 0, bottomEdge = 0, leftEdge = 0, rightEdge = 0;
            
            // Check top and bottom edges
            for (let i = 0; i < maxWidth && x + i < edges[0]?.length; i++) {
                if (edges[y] && edges[y][x + i] > 50) topEdge++;
                if (edges[y + maxHeight] && edges[y + maxHeight][x + i] > 50) bottomEdge++;
            }
            
            // Check left and right edges
            for (let i = 0; i < maxHeight && y + i < edges.length; i++) {
                if (edges[y + i] && edges[y + i][x] > 50) leftEdge++;
                if (edges[y + i] && edges[y + i][x + maxWidth] > 50) rightEdge++;
            }
            
            const edgeStrength = (topEdge + bottomEdge + leftEdge + rightEdge) / (2 * (maxWidth + maxHeight));
            
            return {
                isRectangle: edgeStrength > 0.3,
                width: maxWidth,
                height: maxHeight,
                confidence: Math.min(edgeStrength * 2, 1.0)
            };
            
        } catch (error) {
            return { isRectangle: false, confidence: 0 };
        }
    }

    /**
     * Analyze a square region for checkbox patterns
     * @param {Object} image - Jimp image object
     * @param {number} x - X coordinate
     * @param {number} y - Y coordinate
     * @param {number} size - Square size
     * @returns {Object} Checkbox analysis result
     */
    analyzeSquareRegion(image, x, y, size) {
        try {
            let darkPixels = 0;
            let totalPixels = 0;
            let edgePixels = 0;
            
            for (let dy = 0; dy < size; dy++) {
                for (let dx = 0; dx < size; dx++) {
                    const px = x + dx;
                    const py = y + dy;
                    
                    if (px >= image.bitmap.width || py >= image.bitmap.height) continue;
                    
                    const pixel = Jimp.intToRGBA(image.getPixelColor(px, py));
                    const brightness = (pixel.r + pixel.g + pixel.b) / 3;
                    
                    totalPixels++;
                    if (brightness < 100) darkPixels++;
                    
                    // Check if it's an edge pixel
                    if (dx === 0 || dy === 0 || dx === size - 1 || dy === size - 1) {
                        if (brightness < 100) edgePixels++;
                    }
                }
            }
            
            const darkRatio = darkPixels / totalPixels;
            const edgeRatio = edgePixels / (4 * size - 4); // Perimeter pixels
            
            // Checkbox criteria: moderate dark pixels, strong edges
            const isCheckbox = edgeRatio > 0.4 && darkRatio > 0.2 && darkRatio < 0.8;
            const checked = darkRatio > 0.5; // More dark pixels = likely checked
            
            return {
                isCheckbox,
                checked,
                confidence: isCheckbox ? Math.min(edgeRatio + darkRatio * 0.5, 1.0) : 0
            };
            
        } catch (error) {
            return { isCheckbox: false, checked: false, confidence: 0 };
        }
    }

    /**
     * Check if a rectangle is likely a form field
     * @param {Object} rect - Rectangle object
     * @returns {boolean} Whether it's likely a form field
     */
    isLikelyFormField(rect) {
        const aspectRatio = rect.width / rect.height;
        const area = rect.width * rect.height;
        
        // Form fields are typically:
        // - Rectangular (aspect ratio > 2)
        // - Not too small or too large
        // - Reasonable height (10-50 pixels)
        
        return aspectRatio > 2 && 
               aspectRatio < 20 && 
               area > 500 && 
               area < 50000 &&
               rect.height > 10 && 
               rect.height < 50;
    }

    /**
     * Calculate confidence for line detection
     * @param {number} length - Line length
     * @param {number} y - Y position
     * @param {number} imageHeight - Total image height
     * @returns {number} Confidence score
     */
    calculateLineConfidence(length, y, imageHeight) {
        // Longer lines are more confident
        let confidence = Math.min(length / 200, 1.0);
        
        // Lines in the middle/bottom of page are more likely form fields
        const relativeY = y / imageHeight;
        if (relativeY > 0.3 && relativeY < 0.9) {
            confidence *= 1.2;
        }
        
        return Math.min(confidence, 1.0);
    }

    /**
     * Calculate confidence for box detection
     * @param {Object} rect - Rectangle object
     * @returns {number} Confidence score
     */
    calculateBoxConfidence(rect) {
        let confidence = rect.confidence || 0.5;
        
        // Adjust based on size and aspect ratio
        const aspectRatio = rect.width / rect.height;
        if (aspectRatio > 3 && aspectRatio < 10) {
            confidence *= 1.3; // Good aspect ratio for input fields
        }
        
        return Math.min(confidence, 1.0);
    }

    /**
     * Calculate overall confidence for all detected elements
     * @param {Array} elements - Detected elements
     * @returns {number} Overall confidence score
     */
    calculateOverallConfidence(elements) {
        if (elements.length === 0) return 0;
        
        const avgConfidence = elements.reduce((sum, el) => sum + el.confidence, 0) / elements.length;
        const countBonus = Math.min(elements.length / 10, 0.3); // Bonus for more elements
        
        return Math.min(avgConfidence + countBonus, 1.0);
    }

    /**
     * Ensure temporary directory exists
     */
    async ensureTempDir() {
        try {
            await fs.mkdir(this.tempDir, { recursive: true });
        } catch (error) {
            console.warn('⚠️ Visual: Failed to create temp directory:', error);
        }
    }

    /**
     * Clean up temporary files
     */
    async cleanup() {
        try {
            const files = await fs.readdir(this.tempDir);
            for (const file of files) {
                await fs.unlink(path.join(this.tempDir, file)).catch(() => {});
            }
        } catch (error) {
            // Ignore cleanup errors
        }
    }
}

module.exports = VisualDetector;
