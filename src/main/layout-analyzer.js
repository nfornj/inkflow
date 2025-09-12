/**
 * Layout Analyzer - Maps text labels to nearby visual form elements
 * Provides spatial analysis and context understanding for form fields
 */

class LayoutAnalyzer {
    constructor() {
        this.name = 'Layout Analyzer';
        this.version = '1.0.0';
    }

    /**
     * Analyze document layout and map labels to form elements
     * @param {Uint8Array} pdfBytes - PDF file bytes
     * @param {Array} visualElements - Visual elements from visual detector
     * @returns {Promise<Object>} Layout analysis result
     */
    async analyzeLayout(pdfBytes, visualElements) {
        const startTime = Date.now();
        
        try {
            console.log('🔍 Layout: Starting layout analysis...');
            console.log(`🔍 Layout: Processing ${visualElements.length} visual elements`);

            // Extract text with positioning information
            const textBlocks = await this.extractTextWithPositions(pdfBytes);
            
            if (textBlocks.length === 0) {
                return {
                    success: true,
                    method: 'layout',
                    confidence: 0,
                    fields: [],
                    processingTime: Date.now() - startTime,
                    message: 'No text blocks found for layout analysis'
                };
            }

            console.log(`🔍 Layout: Found ${textBlocks.length} text blocks`);

            // Map labels to visual elements
            const mappedFields = this.mapLabelsToElements(textBlocks, visualElements);
            
            // Analyze document structure
            const documentStructure = this.analyzeDocumentStructure(textBlocks, mappedFields);
            
            const processingTime = Date.now() - startTime;
            const confidence = this.calculateLayoutConfidence(mappedFields, textBlocks, visualElements);
            
            console.log(`✅ Layout: Mapped ${mappedFields.length} fields in ${processingTime}ms (confidence: ${confidence})`);

            return {
                success: true,
                method: 'layout',
                confidence,
                fields: mappedFields,
                processingTime,
                documentStructure,
                metadata: {
                    textBlocks: textBlocks.length,
                    visualElements: visualElements.length,
                    mappedFields: mappedFields.length,
                    mappingRate: mappedFields.length / Math.max(visualElements.length, 1)
                }
            };

        } catch (error) {
            console.error('❌ Layout analysis failed:', error);
            return {
                success: false,
                method: 'layout',
                confidence: 0,
                fields: [],
                processingTime: Date.now() - startTime,
                error: error.message
            };
        }
    }

    /**
     * Extract text with positioning information from PDF
     * @param {Uint8Array} pdfBytes - PDF file bytes
     * @returns {Promise<Array>} Array of text blocks with positions
     */
    async extractTextWithPositions(pdfBytes) {
        try {
            // Use PDF.js to extract text with positioning
            const pdfjs = await import('pdfjs-dist/legacy/build/pdf.mjs');
            const pdf = await pdfjs.getDocument({ data: pdfBytes }).promise;
            
            const textBlocks = [];
            
            for (let pageNum = 1; pageNum <= Math.min(pdf.numPages, 3); pageNum++) {
                const page = await pdf.getPage(pageNum);
                const textContent = await page.getTextContent();
                
                // Process each text item
                textContent.items.forEach((item, index) => {
                    if (item.str && item.str.trim().length > 0) {
                        textBlocks.push({
                            id: `text_${pageNum}_${index}`,
                            text: item.str.trim(),
                            page: pageNum,
                            position: {
                                x: item.transform[4],
                                y: item.transform[5],
                                width: item.width,
                                height: item.height
                            },
                            fontSize: item.height,
                            fontName: item.fontName || 'unknown'
                        });
                    }
                });
            }
            
            return textBlocks;
            
        } catch (error) {
            console.error('❌ Text extraction with positions failed:', error);
            return [];
        }
    }

    /**
     * Map text labels to nearby visual elements
     * @param {Array} textBlocks - Text blocks with positions
     * @param {Array} visualElements - Visual form elements
     * @returns {Array} Array of mapped form fields
     */
    mapLabelsToElements(textBlocks, visualElements) {
        const mappedFields = [];
        
        // Group visual elements by page
        const elementsByPage = this.groupByPage(visualElements);
        const textByPage = this.groupByPage(textBlocks);
        
        // Process each page
        Object.keys(elementsByPage).forEach(pageNum => {
            const pageElements = elementsByPage[pageNum];
            const pageText = textByPage[pageNum] || [];
            
            // Map each visual element to nearby text
            pageElements.forEach(element => {
                const nearbyLabels = this.findNearbyLabels(element, pageText);
                
                if (nearbyLabels.length > 0) {
                    const bestLabel = this.selectBestLabel(nearbyLabels, element);
                    
                    if (bestLabel) {
                        const mappedField = this.createMappedField(element, bestLabel, nearbyLabels);
                        mappedFields.push(mappedField);
                    }
                }
            });
        });
        
        return mappedFields;
    }

    /**
     * Group items by page number
     * @param {Array} items - Items with page property
     * @returns {Object} Items grouped by page
     */
    groupByPage(items) {
        const grouped = {};
        items.forEach(item => {
            const page = item.page || item.position?.page || 1;
            if (!grouped[page]) grouped[page] = [];
            grouped[page].push(item);
        });
        return grouped;
    }

    /**
     * Find text labels near a visual element
     * @param {Object} element - Visual form element
     * @param {Array} textBlocks - Text blocks on the same page
     * @returns {Array} Array of nearby labels with distances
     */
    findNearbyLabels(element, textBlocks) {
        const nearbyLabels = [];
        const elementPos = element.position;
        
        // Define search radius based on element size
        const searchRadius = Math.max(elementPos.width * 2, elementPos.height * 5, 100);
        
        textBlocks.forEach(textBlock => {
            const distance = this.calculateDistance(elementPos, textBlock.position);
            const relativePosition = this.getRelativePosition(elementPos, textBlock.position);
            
            // Only consider text within search radius
            if (distance <= searchRadius) {
                const labelScore = this.calculateLabelScore(textBlock, element, distance, relativePosition);
                
                if (labelScore > 0.1) { // Minimum threshold
                    nearbyLabels.push({
                        textBlock,
                        distance,
                        relativePosition,
                        score: labelScore
                    });
                }
            }
        });
        
        // Sort by score (best first)
        return nearbyLabels.sort((a, b) => b.score - a.score);
    }

    /**
     * Calculate distance between two positions
     * @param {Object} pos1 - First position
     * @param {Object} pos2 - Second position
     * @returns {number} Euclidean distance
     */
    calculateDistance(pos1, pos2) {
        const dx = (pos1.x + pos1.width / 2) - (pos2.x + pos2.width / 2);
        const dy = (pos1.y + pos1.height / 2) - (pos2.y + pos2.height / 2);
        return Math.sqrt(dx * dx + dy * dy);
    }

    /**
     * Get relative position of text to element
     * @param {Object} elementPos - Element position
     * @param {Object} textPos - Text position
     * @returns {string} Relative position (left, right, above, below)
     */
    getRelativePosition(elementPos, textPos) {
        const elementCenterX = elementPos.x + elementPos.width / 2;
        const elementCenterY = elementPos.y + elementPos.height / 2;
        const textCenterX = textPos.x + textPos.width / 2;
        const textCenterY = textPos.y + textPos.height / 2;
        
        const dx = textCenterX - elementCenterX;
        const dy = textCenterY - elementCenterY;
        
        if (Math.abs(dx) > Math.abs(dy)) {
            return dx < 0 ? 'left' : 'right';
        } else {
            return dy < 0 ? 'above' : 'below';
        }
    }

    /**
     * Calculate label score based on various factors
     * @param {Object} textBlock - Text block
     * @param {Object} element - Visual element
     * @param {number} distance - Distance between them
     * @param {string} relativePosition - Relative position
     * @returns {number} Label score (0-1)
     */
    calculateLabelScore(textBlock, element, distance, relativePosition) {
        let score = 0;
        
        // Distance factor (closer is better)
        const maxDistance = 200;
        const distanceFactor = Math.max(0, 1 - distance / maxDistance);
        score += distanceFactor * 0.4;
        
        // Position factor (left and above are preferred for labels)
        const positionFactors = {
            'left': 0.4,
            'above': 0.3,
            'right': 0.2,
            'below': 0.1
        };
        score += positionFactors[relativePosition] || 0;
        
        // Text content factor (form-like text is better)
        const contentFactor = this.calculateContentScore(textBlock.text);
        score += contentFactor * 0.3;
        
        // Font size factor (reasonable size labels)
        const fontSize = textBlock.fontSize || 12;
        if (fontSize >= 8 && fontSize <= 16) {
            score += 0.1;
        }
        
        // Alignment factor (horizontally aligned is good for left labels)
        if (relativePosition === 'left') {
            const verticalAlignment = this.calculateVerticalAlignment(element.position, textBlock.position);
            score += verticalAlignment * 0.2;
        }
        
        return Math.min(score, 1.0);
    }

    /**
     * Calculate content score based on text content
     * @param {string} text - Text content
     * @returns {number} Content score (0-1)
     */
    calculateContentScore(text) {
        const lowerText = text.toLowerCase();
        let score = 0;
        
        // Form field keywords
        const formKeywords = [
            'name', 'first', 'last', 'email', 'phone', 'address', 'city', 'state', 'zip',
            'date', 'birth', 'age', 'gender', 'occupation', 'employer', 'income', 'signature',
            'sign', 'initial', 'check', 'select', 'choose', 'enter', 'fill', 'complete'
        ];
        
        // Check for form keywords
        const hasFormKeyword = formKeywords.some(keyword => lowerText.includes(keyword));
        if (hasFormKeyword) score += 0.5;
        
        // Check for colon (common in labels)
        if (text.includes(':')) score += 0.3;
        
        // Check for reasonable length (not too short or long)
        if (text.length >= 3 && text.length <= 50) score += 0.2;
        
        // Penalize numbers-only text (less likely to be labels)
        if (/^\d+$/.test(text)) score -= 0.3;
        
        // Penalize very common words that are unlikely labels
        const commonWords = ['the', 'and', 'or', 'but', 'in', 'on', 'at', 'to', 'for', 'of', 'with', 'by'];
        if (commonWords.includes(lowerText)) score -= 0.2;
        
        return Math.max(score, 0);
    }

    /**
     * Calculate vertical alignment between element and text
     * @param {Object} elementPos - Element position
     * @param {Object} textPos - Text position
     * @returns {number} Alignment score (0-1)
     */
    calculateVerticalAlignment(elementPos, textPos) {
        const elementCenterY = elementPos.y + elementPos.height / 2;
        const textCenterY = textPos.y + textPos.height / 2;
        const verticalOffset = Math.abs(elementCenterY - textCenterY);
        const maxOffset = Math.max(elementPos.height, textPos.height);
        
        return Math.max(0, 1 - verticalOffset / maxOffset);
    }

    /**
     * Select the best label from nearby candidates
     * @param {Array} nearbyLabels - Array of nearby labels with scores
     * @param {Object} element - Visual element
     * @returns {Object|null} Best label or null
     */
    selectBestLabel(nearbyLabels, element) {
        if (nearbyLabels.length === 0) return null;
        
        // Return the highest scoring label
        const bestLabel = nearbyLabels[0];
        
        // Minimum score threshold
        if (bestLabel.score < 0.3) return null;
        
        return bestLabel;
    }

    /**
     * Create a mapped field from element and label
     * @param {Object} element - Visual element
     * @param {Object} bestLabel - Best matching label
     * @param {Array} allLabels - All nearby labels
     * @returns {Object} Mapped field object
     */
    createMappedField(element, bestLabel, allLabels) {
        const textBlock = bestLabel.textBlock;
        
        return {
            id: `layout_${element.type}_${textBlock.id}`,
            name: this.cleanFieldName(textBlock.text),
            type: this.inferFieldType(textBlock.text, element.type),
            source: 'layout_mapping',
            confidence: bestLabel.score,
            required: this.inferRequired(textBlock.text),
            position: {
                page: element.position.page,
                element: element.position,
                label: textBlock.position,
                relationship: bestLabel.relativePosition
            },
            properties: {
                originalLabel: textBlock.text,
                elementType: element.type,
                elementSubtype: element.subtype,
                labelDistance: bestLabel.distance,
                alternativeLabels: allLabels.slice(1, 3).map(l => l.textBlock.text) // Top 2 alternatives
            }
        };
    }

    /**
     * Clean and normalize field name from label text
     * @param {string} text - Raw label text
     * @returns {string} Cleaned field name
     */
    cleanFieldName(text) {
        return text
            .replace(/[:\*\(\)\[\]]/g, '') // Remove special characters
            .replace(/\s+/g, ' ') // Normalize whitespace
            .trim()
            .replace(/\b\w/g, l => l.toUpperCase()); // Title case
    }

    /**
     * Infer field type from label text and element type
     * @param {string} labelText - Label text
     * @param {string} elementType - Visual element type
     * @returns {string} Inferred field type
     */
    inferFieldType(labelText, elementType) {
        const lowerText = labelText.toLowerCase();
        
        // Use element type as base
        if (elementType === 'checkbox') return 'checkbox';
        if (elementType === 'line' && lowerText.includes('sign')) return 'signature';
        
        // Infer from label content
        if (/\b(email|e-mail)\b/.test(lowerText)) return 'email';
        if (/\b(phone|tel|mobile|cell)\b/.test(lowerText)) return 'phone';
        if (/\b(date|birth|dob)\b/.test(lowerText)) return 'date';
        if (/\b(number|#|num)\b/.test(lowerText)) return 'number';
        if (/\b(address|street|city|state|zip|postal)\b/.test(lowerText)) return 'address';
        if (/\b(name|first|last|middle)\b/.test(lowerText)) return 'text';
        if (/\b(sign|signature|initial)\b/.test(lowerText)) return 'signature';
        
        // Default based on element type
        return elementType === 'box' ? 'text' : elementType;
    }

    /**
     * Infer if field is required from label text
     * @param {string} labelText - Label text
     * @returns {boolean} Whether field appears required
     */
    inferRequired(labelText) {
        return labelText.includes('*') || 
               labelText.toLowerCase().includes('required') ||
               labelText.toLowerCase().includes('mandatory');
    }

    /**
     * Analyze document structure
     * @param {Array} textBlocks - All text blocks
     * @param {Array} mappedFields - Mapped form fields
     * @returns {Object} Document structure analysis
     */
    analyzeDocumentStructure(textBlocks, mappedFields) {
        // Find potential section headers (larger text, positioned above fields)
        const headers = textBlocks.filter(block => {
            const fontSize = block.fontSize || 12;
            return fontSize > 14 && block.text.length > 5;
        });
        
        // Group fields by proximity to headers
        const sections = this.groupFieldsByHeaders(headers, mappedFields);
        
        return {
            headers: headers.length,
            sections: sections.length,
            averageFieldsPerSection: sections.length > 0 ? 
                mappedFields.length / sections.length : mappedFields.length,
            documentType: this.inferDocumentType(textBlocks, mappedFields)
        };
    }

    /**
     * Group fields by nearby section headers
     * @param {Array} headers - Section headers
     * @param {Array} fields - Form fields
     * @returns {Array} Array of sections with fields
     */
    groupFieldsByHeaders(headers, fields) {
        const sections = [];
        
        headers.forEach(header => {
            const sectionFields = fields.filter(field => {
                const distance = this.calculateDistance(header.position, field.position.element);
                return distance < 300; // Fields within 300 pixels of header
            });
            
            if (sectionFields.length > 0) {
                sections.push({
                    header: header.text,
                    fields: sectionFields,
                    position: header.position
                });
            }
        });
        
        return sections;
    }

    /**
     * Infer document type from content
     * @param {Array} textBlocks - All text blocks
     * @param {Array} fields - Form fields
     * @returns {string} Inferred document type
     */
    inferDocumentType(textBlocks, fields) {
        const allText = textBlocks.map(b => b.text.toLowerCase()).join(' ');
        
        if (allText.includes('application') || allText.includes('apply')) return 'application';
        if (allText.includes('tax') || allText.includes('income')) return 'tax_form';
        if (allText.includes('bank') || allText.includes('account')) return 'banking';
        if (allText.includes('insurance') || allText.includes('policy')) return 'insurance';
        if (allText.includes('medical') || allText.includes('health')) return 'medical';
        if (allText.includes('employment') || allText.includes('job')) return 'employment';
        if (allText.includes('agreement') || allText.includes('contract')) return 'legal';
        
        return 'general_form';
    }

    /**
     * Calculate overall layout confidence
     * @param {Array} mappedFields - Mapped fields
     * @param {Array} textBlocks - Text blocks
     * @param {Array} visualElements - Visual elements
     * @returns {number} Overall confidence score
     */
    calculateLayoutConfidence(mappedFields, textBlocks, visualElements) {
        if (mappedFields.length === 0) return 0;
        
        // Average field confidence
        const avgFieldConfidence = mappedFields.reduce((sum, field) => sum + field.confidence, 0) / mappedFields.length;
        
        // Mapping rate (how many visual elements got mapped)
        const mappingRate = mappedFields.length / Math.max(visualElements.length, 1);
        
        // Text coverage (how much text was used as labels)
        const usedTextBlocks = new Set(mappedFields.map(f => f.properties.originalLabel));
        const textUsageRate = usedTextBlocks.size / Math.max(textBlocks.length, 1);
        
        // Combine factors
        const confidence = (avgFieldConfidence * 0.5) + (mappingRate * 0.3) + (textUsageRate * 0.2);
        
        return Math.min(confidence, 1.0);
    }
}

module.exports = LayoutAnalyzer;
