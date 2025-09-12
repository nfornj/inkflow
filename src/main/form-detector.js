/**
 * Form Detector - Multi-modal form detection orchestrator
 * Coordinates AcroForm, Visual, Layout, and Semantic analysis with LLM fallback
 */

const AcroFormDetector = require('./acroform-detector');
const VisualDetector = require('./visual-detector');
const LayoutAnalyzer = require('./layout-analyzer');
const SemanticValidator = require('./semantic-validator');

class FormDetector {
    constructor(llmFormAnalyzer = null) {
        this.name = 'Multi-Modal Form Detector';
        this.version = '2.0.0';
        
        // Initialize detection components
        this.acroformDetector = new AcroFormDetector();
        this.visualDetector = new VisualDetector();
        this.layoutAnalyzer = new LayoutAnalyzer();
        this.semanticValidator = new SemanticValidator();
        
        // LLM fallback (optional)
        this.llmFormAnalyzer = llmFormAnalyzer;
        
        // Performance thresholds
        this.thresholds = {
            acroformMinConfidence: 0.8,
            visualMinConfidence: 0.6,
            layoutMinConfidence: 0.5,
            overallMinConfidence: 0.4,
            maxProcessingTime: 15000 // 15 seconds
        };
        
        // Result cache for performance
        this.resultCache = new Map();
    }

    /**
     * Detect form fields using multi-modal approach
     * @param {Uint8Array} pdfBytes - PDF file bytes
     * @param {Object} options - Detection options
     * @returns {Promise<Object>} Comprehensive form analysis result
     */
    async detectFormFields(pdfBytes, options = {}) {
        const startTime = Date.now();
        const pdfSignature = this.computePdfSignature(pdfBytes);
        
        try {
            console.log('🚀 FormDetector: Starting multi-modal form detection...');
            console.log(`🚀 FormDetector: PDF signature: ${pdfSignature}`);
            
            // Check cache first
            if (this.resultCache.has(pdfSignature)) {
                console.log('📋 FormDetector: Returning cached result');
                const cached = this.resultCache.get(pdfSignature);
                cached.processingTime = Date.now() - startTime;
                cached.cached = true;
                return cached;
            }

            // Phase 1: AcroForm Detection (Primary Path)
            console.log('📋 Phase 1: AcroForm Detection...');
            const acroformResult = await this.runWithTimeout(
                () => this.acroformDetector.detectFields(pdfBytes),
                5000,
                'AcroForm detection'
            );

            // If AcroForm detection is successful and confident, use it
            if (acroformResult.success && 
                acroformResult.confidence >= this.thresholds.acroformMinConfidence &&
                acroformResult.fields.length > 0) {
                
                console.log(`✅ FormDetector: AcroForm path successful (${acroformResult.fields.length} fields)`);
                
                // Generate todos from AcroForm fields
                const todoList = this.acroformDetector.generateTodos(acroformResult.fields);
                
                const result = {
                    success: true,
                    method: 'acroform_primary',
                    confidence: acroformResult.confidence,
                    processingTime: Date.now() - startTime,
                    todoList,
                    formStructure: this.createFormStructure(acroformResult.fields, 'acroform'),
                    fieldMapping: this.createFieldMapping(acroformResult.fields),
                    metadata: {
                        detectionPath: 'acroform_primary',
                        fieldsDetected: acroformResult.fields.length,
                        ...acroformResult.metadata
                    }
                };
                
                // Cache result
                this.resultCache.set(pdfSignature, { ...result });
                
                return result;
            }

            console.log('📋 AcroForm detection insufficient, proceeding to visual analysis...');

            // Phase 2: Visual Detection (Secondary Path)
            console.log('👁️ Phase 2: Visual Element Detection...');
            const visualResult = await this.runWithTimeout(
                () => this.visualDetector.detectVisualElements(pdfBytes),
                8000,
                'Visual detection'
            );

            let allFields = [];
            
            // Add AcroForm fields if any were found
            if (acroformResult.success && acroformResult.fields.length > 0) {
                allFields.push(...acroformResult.fields);
            }

            // Phase 3: Layout Analysis (if visual elements found)
            if (visualResult.success && visualResult.elements.length > 0) {
                console.log('🗂️ Phase 3: Layout Analysis...');
                const layoutResult = await this.runWithTimeout(
                    () => this.layoutAnalyzer.analyzeLayout(pdfBytes, visualResult.elements),
                    5000,
                    'Layout analysis'
                );

                if (layoutResult.success && layoutResult.fields.length > 0) {
                    allFields.push(...layoutResult.fields);
                }
            }

            // Phase 4: Semantic Validation
            console.log('🧠 Phase 4: Semantic Validation...');
            const validationResult = await this.runWithTimeout(
                () => this.semanticValidator.validateFields(allFields),
                3000,
                'Semantic validation'
            );

            let finalFields = [];
            let finalConfidence = 0;
            let detectionMethod = 'multi_modal';

            if (validationResult.success && validationResult.fields.length > 0) {
                finalFields = validationResult.fields;
                finalConfidence = validationResult.confidence;
                
                console.log(`✅ FormDetector: Multi-modal detection successful (${finalFields.length} fields)`);
                
                // Check if we should use LLM fallback due to low field count or poor quality
                const hasLowQuality = this.hasLowQualityFields(finalFields);
                const shouldUseLLMFallback = this.llmFormAnalyzer && (
                    finalFields.length < 12 || // Too few fields detected (increased for comprehensive detection)
                    hasLowQuality // Poor quality field names detected
                );
                
                console.log(`🔍 FormDetector: Field count: ${finalFields.length}, Low quality: ${hasLowQuality}, Should use LLM: ${shouldUseLLMFallback}`);
                
                if (shouldUseLLMFallback) {
                    console.log('⚠️ FormDetector: Multi-modal results insufficient, proceeding to LLM fallback...');
                    // Don't return here, continue to LLM fallback section
                } else {
                    // Generate todos from validated fields
                    const todoList = this.semanticValidator.generateTodos(finalFields);
                    
                    const result = {
                        success: true,
                        method: detectionMethod,
                        confidence: finalConfidence,
                        processingTime: Date.now() - startTime,
                        todoList,
                        formStructure: this.createFormStructure(finalFields, detectionMethod),
                        fieldMapping: this.createFieldMapping(finalFields),
                        metadata: {
                            detectionPath: 'multi_modal_success',
                            acroformFields: acroformResult.fields?.length || 0,
                            visualElements: visualResult.elements?.length || 0,
                            finalFields: finalFields.length,
                            phases: {
                                acroform: acroformResult.success,
                                visual: visualResult.success,
                                layout: allFields.length > (acroformResult.fields?.length || 0),
                                semantic: validationResult.success
                            }
                        }
                    };
                    
                    // Cache result
                    this.resultCache.set(pdfSignature, { ...result });
                    
                    return result;
                }
            }

            // Phase 5: LLM Fallback (if available and other methods failed or quality is poor)
            if (this.llmFormAnalyzer) {
                console.log('🤖 Phase 5: LLM Fallback Analysis...');
                
                try {
                    const llmResult = await this.runLLMFallback(pdfBytes, options);
                    
                    if (llmResult.success && llmResult.todoList?.categories?.length > 0) {
                        console.log('✅ FormDetector: LLM fallback successful');
                        
                        const result = {
                            ...llmResult,
                            method: 'llm_fallback',
                            processingTime: Date.now() - startTime,
                            metadata: {
                                ...llmResult.metadata,
                                detectionPath: 'llm_fallback',
                                fallbackReason: 'insufficient_multi_modal_results'
                            }
                        };
                        
                        // Cache result
                        this.resultCache.set(pdfSignature, { ...result });
                        
                        return result;
                    }
                } catch (error) {
                    console.warn('⚠️ FormDetector: LLM fallback failed:', error);
                }
            }

            // Final fallback: Basic structure with minimal fields
            console.log('📋 FormDetector: Generating basic fallback result...');
            
            const fallbackResult = this.generateBasicFallback(allFields, startTime);
            
            // Cache result
            this.resultCache.set(pdfSignature, { ...fallbackResult });
            
            return fallbackResult;

        } catch (error) {
            console.error('❌ FormDetector: Detection failed:', error);
            
            const errorResult = {
                success: false,
                method: 'error',
                confidence: 0,
                processingTime: Date.now() - startTime,
                error: error.message,
                todoList: {
                    categories: [],
                    summary: {
                        totalItems: 0,
                        completedItems: 0,
                        progress: 0,
                        estimatedTotalTime: '0 minutes',
                        requiredItems: 0,
                        optionalItems: 0
                    }
                }
            };
            
            return errorResult;
        }
    }

    /**
     * Run LLM fallback analysis
     * @param {Uint8Array} pdfBytes - PDF file bytes
     * @param {Object} options - Analysis options
     * @returns {Promise<Object>} LLM analysis result
     */
    async runLLMFallback(pdfBytes, options) {
        try {
            // Extract text for LLM analysis
            const pdfText = await this.extractPDFText(pdfBytes);
            
            if (!pdfText || pdfText.length < 50) {
                throw new Error('Insufficient text for LLM analysis');
            }

            // Call LLM analyzer
            const llmResult = await this.llmFormAnalyzer.analyzePDFForForms(pdfText, {
                ...options,
                fallbackMode: true,
                generateTodos: true
            });

            return llmResult;

        } catch (error) {
            console.error('❌ LLM fallback failed:', error);
            throw error;
        }
    }

    /**
     * Check if detected fields have low quality names (garbled text extraction)
     * @param {Array} fields - Detected fields
     * @returns {boolean} True if fields have poor quality
     */
    hasLowQualityFields(fields) {
        if (!fields || fields.length === 0) return false;
        
        const lowQualityPatterns = [
            /^fill\s+.{30,}/i, // Very long "Fill ..." names (reduced threshold)
            /^fill\s+same\s+as/i, // "Fill Same As ..." - not real fields
            /^fill\s+the\s+.{15,}/i, // "Fill The ..." with long descriptive text
            /^fill\s+you$/i, // Incomplete extractions
            /^fill\s+.*\?$/i, // Questions, not field names
            /^fill\s+.*\s+(and|is|are|the|will|may|can|should|would)\s*$/i, // Incomplete sentences
            /^fill\s+.*\s+(income|amount|benefit|return|tax|claim|enter|greater|less)\s+.*$/i, // Tax form descriptions
            /^fill\s+–\s+/i, // "Fill – ..." - descriptive text with dashes
            /^fill\s+.*\s+line\s+\d+/i, // "Fill ... line 1" - references to form lines
            /^fill\s+.*\s+(spouse|partner|employer|payer|certificate)/i, // Long descriptive phrases
            /\$[\d,]+/i, // Contains dollar amounts - likely descriptive text
            /\d{4,}/i, // Contains long numbers - likely descriptive
        ];
        
        let lowQualityCount = 0;
        
        for (const field of fields) {
            if (!field.name) continue;
            
            for (const pattern of lowQualityPatterns) {
                if (pattern.test(field.name)) {
                    lowQualityCount++;
                    console.log(`⚠️ FormDetector: Low quality field detected: "${field.name}"`);
                    break;
                }
            }
        }
        
        // If more than 30% of fields are low quality, use LLM fallback
        const lowQualityRatio = lowQualityCount / fields.length;
        console.log(`🔍 FormDetector: Quality analysis: ${lowQualityCount}/${fields.length} low quality fields (${Math.round(lowQualityRatio * 100)}%)`);
        
        if (lowQualityRatio > 0.2) {
            console.log(`⚠️ FormDetector: ${lowQualityCount}/${fields.length} fields are low quality (${Math.round(lowQualityRatio * 100)}%), triggering LLM fallback`);
            return true;
        }
        
        console.log(`✅ FormDetector: Quality acceptable (${Math.round(lowQualityRatio * 100)}% < 20%), continuing with multi-modal`);
        return false;
    }

    /**
     * Extract text from PDF for LLM analysis
     * @param {Uint8Array} pdfBytes - PDF file bytes
     * @returns {Promise<string>} Extracted text
     */
    async extractPDFText(pdfBytes) {
        try {
            // Use pdftotext as primary method (avoids DOMMatrix issues)
            const { spawn } = require('child_process');
            const fs = require('fs');
            const path = require('path');
            const os = require('os');
            
            return new Promise((resolve, reject) => {
                const tempFile = path.join(os.tmpdir(), `inkflow_pdf_${Date.now()}.pdf`);
                
                try {
                    fs.writeFileSync(tempFile, pdfBytes);
                    console.log('📄 Extracting text using pdftotext...');
                    
                    const pdftotext = spawn('pdftotext', [tempFile, '-'], {
                        stdio: ['pipe', 'pipe', 'pipe'],
                        timeout: 10000 // 10 second timeout
                    });
                    
                    let extractedText = '';
                    let errorOutput = '';
                    
                    pdftotext.stdout.on('data', (data) => {
                        extractedText += data.toString();
                    });
                    
                    pdftotext.stderr.on('data', (data) => {
                        errorOutput += data.toString();
                    });
                    
                    pdftotext.on('close', (code) => {
                        try {
                            fs.unlinkSync(tempFile);
                        } catch (e) {
                            // Ignore cleanup errors
                        }
                        
                        if (code === 0 && extractedText.length > 50) {
                            console.log('✅ PDF text extracted via pdftotext:', extractedText.length, 'characters');
                            resolve(extractedText.trim());
                        } else {
                            console.log('⚠️ pdftotext failed or insufficient text, using semantic fallback');
                            // Provide meaningful fallback text for LLM analysis
                            const fallbackText = `This document appears to be a form or structured document that requires completion. 
                            Based on the document structure, it likely contains fields for personal information, contact details, 
                            financial information, or other data entry requirements. Please review the document carefully and 
                            fill out all required fields with accurate information.`;
                            resolve(fallbackText);
                        }
                    });
                    
                    pdftotext.on('error', (error) => {
                        try {
                            fs.unlinkSync(tempFile);
                        } catch (e) {
                            // Ignore cleanup errors
                        }
                        console.log('⚠️ pdftotext not available, using semantic fallback');
                        // Provide meaningful fallback text for LLM analysis
                        const fallbackText = `This document appears to be a form or structured document that requires completion. 
                        Based on the document structure, it likely contains fields for personal information, contact details, 
                        financial information, or other data entry requirements. Please review the document carefully and 
                        fill out all required fields with accurate information.`;
                        resolve(fallbackText);
                    });
                    
                } catch (error) {
                    console.log('⚠️ Temp file creation failed, using semantic fallback');
                    const fallbackText = `This document appears to be a form or structured document that requires completion. 
                    Based on the document structure, it likely contains fields for personal information, contact details, 
                    financial information, or other data entry requirements. Please review the document carefully and 
                    fill out all required fields with accurate information.`;
                    resolve(fallbackText);
                }
            });
            
        } catch (error) {
            console.error('❌ PDF text extraction failed:', error);
            // Always provide meaningful text for LLM analysis
            return `This document appears to be a form or structured document that requires completion. 
            Based on the document structure, it likely contains fields for personal information, contact details, 
            financial information, or other data entry requirements. Please review the document carefully and 
            fill out all required fields with accurate information.`;
        }
    }

    /**
     * Generate basic fallback result
     * @param {Array} allFields - All detected fields
     * @param {number} startTime - Start time
     * @returns {Object} Basic fallback result
     */
    generateBasicFallback(allFields, startTime) {
        console.log('📋 FormDetector: Creating basic fallback with minimal structure...');
        
        // Create basic categories if we have some fields
        const categories = [];
        
        if (allFields.length > 0) {
            categories.push({
                id: 'detected_fields',
                name: 'Detected Form Fields',
                icon: '📝',
                items: allFields.slice(0, 10).map((field, index) => ({
                    id: `fallback_${index}`,
                    title: `Fill ${field.name || 'Field'}`,
                    description: `Complete this form field`,
                    completed: false,
                    priority: 'medium',
                    confidence: field.confidence || 0.5
                })),
                completed: 0,
                total: Math.min(allFields.length, 10)
            });
        } else {
            // Absolute minimal fallback
            categories.push({
                id: 'general_form',
                name: 'Form Completion',
                icon: '📋',
                items: [
                    {
                        id: 'review_form',
                        title: 'Review Form',
                        description: 'Manually review and complete the form',
                        completed: false,
                        priority: 'medium',
                        confidence: 0.3
                    }
                ],
                completed: 0,
                total: 1
            });
        }

        const totalItems = categories.reduce((sum, cat) => sum + cat.total, 0);

        return {
            success: true,
            method: 'basic_fallback',
            confidence: 0.3,
            processingTime: Date.now() - startTime,
            todoList: {
                categories,
                summary: {
                    totalItems,
                    completedItems: 0,
                    progress: 0,
                    estimatedTotalTime: `${Math.ceil(totalItems * 0.5)} minutes`,
                    requiredItems: 0,
                    optionalItems: totalItems
                }
            },
            formStructure: {
                sections: [],
                fields: allFields,
                metadata: {
                    form_type: 'unknown',
                    estimated_completion_time: `${Math.ceil(totalItems * 0.5)} minutes`,
                    complexity: 'unknown'
                }
            },
            fieldMapping: {},
            metadata: {
                detectionPath: 'basic_fallback',
                fieldsDetected: allFields.length,
                fallbackReason: 'insufficient_detection_results'
            }
        };
    }

    /**
     * Create form structure from detected fields
     * @param {Array} fields - Detected form fields
     * @param {string} method - Detection method
     * @returns {Object} Form structure
     */
    createFormStructure(fields, method) {
        // Group fields by category or page
        const sections = [];
        const fieldsByCategory = {};
        
        fields.forEach(field => {
            const category = field.category || field.categoryId || 'general';
            if (!fieldsByCategory[category]) {
                fieldsByCategory[category] = [];
            }
            fieldsByCategory[category].push(field.id);
        });

        // Create sections from categories
        Object.entries(fieldsByCategory).forEach(([category, fieldIds]) => {
            sections.push({
                id: category,
                title: category.replace(/_/g, ' ').replace(/\b\w/g, l => l.toUpperCase()),
                description: `Fields related to ${category}`,
                priority: 1,
                required: fieldIds.some(id => {
                    const field = fields.find(f => f.id === id);
                    return field?.required;
                }),
                fields: fieldIds
            });
        });

        return {
            sections,
            fields: fields.map(field => ({
                id: field.id,
                name: field.name,
                type: field.type || field.semanticType || 'text',
                section: field.category || field.categoryId || 'general',
                required: field.required || false,
                placeholder: field.inputHints?.placeholder,
                validation: field.validation,
                confidence: field.confidence,
                position: {
                    page: field.position?.page || 1,
                    approximate_location: this.describePosition(field.position)
                }
            })),
            metadata: {
                form_type: this.inferFormType(fields),
                estimated_completion_time: this.estimateTotalTime(fields),
                complexity: this.assessComplexity(fields)
            }
        };
    }

    /**
     * Create field mapping for form filling
     * @param {Array} fields - Detected form fields
     * @returns {Object} Field mapping
     */
    createFieldMapping(fields) {
        const mapping = {};
        
        fields.forEach(field => {
            mapping[field.id] = {
                name: field.name,
                type: field.type || field.semanticType || 'text',
                position: field.position,
                validation: field.validation,
                inputHints: field.inputHints,
                required: field.required || false
            };
        });
        
        return mapping;
    }

    /**
     * Describe field position in human-readable format
     * @param {Object} position - Field position
     * @returns {string} Position description
     */
    describePosition(position) {
        if (!position) return 'unknown';
        
        const page = position.page || 1;
        let location = `page ${page}`;
        
        if (position.element || position.x !== undefined) {
            const pos = position.element || position;
            const x = pos.x || 0;
            const y = pos.y || 0;
            
            // Rough position description
            const horizontal = x < 200 ? 'left' : x > 400 ? 'right' : 'center';
            const vertical = y < 200 ? 'top' : y > 400 ? 'bottom' : 'middle';
            
            location += `, ${vertical} ${horizontal}`;
        }
        
        return location;
    }

    /**
     * Infer form type from detected fields
     * @param {Array} fields - Detected form fields
     * @returns {string} Inferred form type
     */
    inferFormType(fields) {
        const fieldNames = fields.map(f => f.name?.toLowerCase() || '').join(' ');
        
        if (fieldNames.includes('tax') || fieldNames.includes('income')) return 'tax_form';
        if (fieldNames.includes('application') || fieldNames.includes('apply')) return 'application';
        if (fieldNames.includes('bank') || fieldNames.includes('account')) return 'banking';
        if (fieldNames.includes('insurance')) return 'insurance';
        if (fieldNames.includes('medical') || fieldNames.includes('health')) return 'medical';
        if (fieldNames.includes('employment') || fieldNames.includes('job')) return 'employment';
        
        return 'general_form';
    }

    /**
     * Estimate total completion time
     * @param {Array} fields - Detected form fields
     * @returns {string} Estimated time
     */
    estimateTotalTime(fields) {
        const totalSeconds = fields.reduce((sum, field) => {
            const timeStr = field.estimatedTime || '30 seconds';
            const seconds = parseInt(timeStr) || 30;
            return sum + seconds;
        }, 0);
        
        const minutes = Math.ceil(totalSeconds / 60);
        return `${minutes} minutes`;
    }

    /**
     * Assess form complexity
     * @param {Array} fields - Detected form fields
     * @returns {string} Complexity level
     */
    assessComplexity(fields) {
        const fieldCount = fields.length;
        const requiredFields = fields.filter(f => f.required).length;
        const uniqueTypes = new Set(fields.map(f => f.type || f.semanticType)).size;
        
        if (fieldCount > 20 || requiredFields > 10 || uniqueTypes > 8) return 'high';
        if (fieldCount > 10 || requiredFields > 5 || uniqueTypes > 5) return 'medium';
        return 'low';
    }

    /**
     * Run operation with timeout
     * @param {Function} operation - Operation to run
     * @param {number} timeout - Timeout in milliseconds
     * @param {string} name - Operation name for logging
     * @returns {Promise<Object>} Operation result
     */
    async runWithTimeout(operation, timeout, name) {
        try {
            return await Promise.race([
                operation(),
                new Promise((_, reject) => 
                    setTimeout(() => reject(new Error(`${name} timeout`)), timeout)
                )
            ]);
        } catch (error) {
            console.warn(`⚠️ ${name} failed:`, error.message);
            return { success: false, error: error.message, fields: [], elements: [] };
        }
    }

    /**
     * Compute PDF signature for caching
     * @param {Uint8Array} pdfBytes - PDF file bytes
     * @returns {string} PDF signature
     */
    computePdfSignature(pdfBytes) {
        // Simple hash based on file size and first/last bytes
        const size = pdfBytes.length;
        const first = pdfBytes.slice(0, 100);
        const last = pdfBytes.slice(-100);
        
        let hash = size;
        for (let i = 0; i < first.length; i++) {
            hash = ((hash << 5) - hash + first[i]) & 0xffffffff;
        }
        for (let i = 0; i < last.length; i++) {
            hash = ((hash << 5) - hash + last[i]) & 0xffffffff;
        }
        
        return `pdf_${Math.abs(hash).toString(16)}`;
    }

    /**
     * Clear result cache
     */
    clearCache() {
        this.resultCache.clear();
    }

    /**
     * Get cache statistics
     * @returns {Object} Cache statistics
     */
    getCacheStats() {
        return {
            size: this.resultCache.size,
            keys: Array.from(this.resultCache.keys())
        };
    }
}

module.exports = FormDetector;
