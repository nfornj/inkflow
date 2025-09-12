/**
 * Semantic Validator - Validates and categorizes detected form fields
 * Filters out false positives and enhances field metadata
 */

class SemanticValidator {
    constructor() {
        this.name = 'Semantic Validator';
        this.version = '1.0.0';
        
        // Field type patterns for validation
        this.fieldPatterns = {
            name: /\b(name|first|last|middle|full|given|surname|family)\b/i,
            email: /\b(email|e-mail|mail|electronic)\b/i,
            phone: /\b(phone|tel|telephone|mobile|cell|contact|number)\b/i,
            address: /\b(address|street|road|avenue|lane|drive|place|apt|apartment|suite|unit)\b/i,
            city: /\b(city|town|municipality|locality)\b/i,
            state: /\b(state|province|region|territory)\b/i,
            zip: /\b(zip|postal|code|postcode)\b/i,
            date: /\b(date|birth|dob|born|day|month|year|time)\b/i,
            age: /\b(age|years|old)\b/i,
            gender: /\b(gender|sex|male|female|m\/f)\b/i,
            occupation: /\b(occupation|job|work|profession|career|title|position)\b/i,
            employer: /\b(employer|company|organization|business|firm)\b/i,
            income: /\b(income|salary|wage|earnings|pay|compensation)\b/i,
            ssn: /\b(ssn|social|security|number|sin|insurance)\b/i,
            signature: /\b(sign|signature|initial|acknowledge|agree|consent)\b/i,
            checkbox: /\b(check|select|choose|mark|tick|yes|no|agree|consent)\b/i
        };
        
        // Invalid field indicators
        this.invalidPatterns = [
            /^\d+$/, // Numbers only
            /^page\s+\d+/i, // Page numbers
            /^total|^sum|^amount\s*:/i, // Calculated values
            /^instructions?/i, // Instructions
            /^note|^please|^important/i, // Notes
            /^section|^part|^chapter/i, // Section headers
            /^form\s+\d+/i, // Form numbers
            /^version|^rev|^date\s*:/i, // Document metadata
            /^office\s+use/i, // Office use only
            /^do\s+not\s+write/i // Do not write areas
        ];
        
        // Field categories for organization
        this.categories = {
            personal: {
                name: 'Personal Information',
                icon: '👤',
                priority: 1,
                fields: ['name', 'date', 'age', 'gender', 'ssn']
            },
            contact: {
                name: 'Contact Information',
                icon: '📞',
                priority: 2,
                fields: ['email', 'phone', 'address', 'city', 'state', 'zip']
            },
            employment: {
                name: 'Employment Information',
                icon: '💼',
                priority: 3,
                fields: ['occupation', 'employer', 'income']
            },
            signature: {
                name: 'Signatures & Agreements',
                icon: '✍️',
                priority: 4,
                fields: ['signature', 'checkbox']
            },
            other: {
                name: 'Other Information',
                icon: '📋',
                priority: 5,
                fields: []
            }
        };
    }

    /**
     * Validate and enhance detected form fields
     * @param {Array} detectedFields - Fields from various detection methods
     * @returns {Object} Validation result with enhanced fields
     */
    validateFields(detectedFields) {
        const startTime = Date.now();
        
        try {
            console.log(`🔍 Semantic: Validating ${detectedFields.length} detected fields...`);
            
            // Filter out invalid fields
            const validFields = detectedFields.filter(field => this.isValidField(field));
            console.log(`🔍 Semantic: ${validFields.length} fields passed initial validation`);
            
            // Enhance field metadata
            const enhancedFields = validFields.map(field => this.enhanceField(field));
            
            // Remove duplicates
            const deduplicatedFields = this.deduplicateFields(enhancedFields);
            console.log(`🔍 Semantic: ${deduplicatedFields.length} fields after deduplication`);
            
            // Categorize fields
            const categorizedFields = this.categorizeFields(deduplicatedFields);
            
            // Calculate confidence scores
            const finalFields = categorizedFields.map(field => this.adjustConfidence(field));
            
            const processingTime = Date.now() - startTime;
            const overallConfidence = this.calculateOverallConfidence(finalFields);
            
            console.log(`✅ Semantic: Validated ${finalFields.length} fields in ${processingTime}ms (confidence: ${overallConfidence})`);
            
            return {
                success: true,
                method: 'semantic_validation',
                confidence: overallConfidence,
                fields: finalFields,
                processingTime,
                metadata: {
                    originalFields: detectedFields.length,
                    validFields: validFields.length,
                    finalFields: finalFields.length,
                    filterRate: 1 - (finalFields.length / Math.max(detectedFields.length, 1))
                }
            };
            
        } catch (error) {
            console.error('❌ Semantic validation failed:', error);
            return {
                success: false,
                method: 'semantic_validation',
                confidence: 0,
                fields: [],
                processingTime: Date.now() - startTime,
                error: error.message
            };
        }
    }

    /**
     * Check if a field is valid (not a false positive)
     * @param {Object} field - Form field to validate
     * @returns {boolean} Whether field is valid
     */
    isValidField(field) {
        if (!field || !field.name) return false;
        
        const fieldName = field.name.toLowerCase();
        
        // Check against invalid patterns
        for (const pattern of this.invalidPatterns) {
            if (pattern.test(fieldName)) {
                console.log(`🚫 Semantic: Rejected field "${field.name}" (matches invalid pattern: ${pattern})`);
                return false;
            }
        }
        
        // Minimum name length
        if (fieldName.length < 2) {
            console.log(`🚫 Semantic: Rejected field "${field.name}" (too short)`);
            return false;
        }
        
        // Reject garbled/poor quality field names
        const qualityPatterns = [
            /^fill\s+.{20,}/i, // "Fill For Routine Eye Examinations, Contact And" - too long and garbled
            /^fill\s+same\s+as/i, // "Fill Same As Medical Plans" - not a real field
            /^fill\s+the\s+.{15,}/i, // "Fill The Vision Care Plan Provides Coverage" - descriptive text, not field
            /^fill\s+you$/i, // "Fill You" - incomplete/garbled
            /^fill\s+.*\?$/i, // "Fill The Cost?" - questions, not fields
            /^fill\s+.*\s+and\s*$/i, // "Fill For Routine Eye Examinations, Contact And" - incomplete
            /^fill\s+.*\s+is\s*$/i, // "Fill Comprehensive Medical Coverage Is" - incomplete sentence
            /\s{3,}/g, // Multiple consecutive spaces indicate poor text extraction
        ];
        
        for (const pattern of qualityPatterns) {
            if (pattern.test(field.name)) {
                console.log(`🚫 Semantic: Rejected field "${field.name}" (poor quality/garbled text)`);
                return false;
            }
        }
        
        // Must have reasonable confidence
        if (field.confidence < 0.1) {
            console.log(`🚫 Semantic: Rejected field "${field.name}" (low confidence: ${field.confidence})`);
            return false;
        }
        
        return true;
    }

    /**
     * Enhance field with additional metadata
     * @param {Object} field - Form field to enhance
     * @returns {Object} Enhanced field
     */
    enhanceField(field) {
        const enhanced = { ...field };
        
        // Determine semantic field type
        enhanced.semanticType = this.determineSemanticType(field.name);
        
        // Add validation rules
        enhanced.validation = this.getValidationRules(enhanced.semanticType);
        
        // Add input hints
        enhanced.inputHints = this.getInputHints(enhanced.semanticType);
        
        // Determine priority
        enhanced.priority = this.determinePriority(enhanced.semanticType, field.required);
        
        // Add estimated completion time
        enhanced.estimatedTime = this.estimateCompletionTime(enhanced.semanticType);
        
        return enhanced;
    }

    /**
     * Determine semantic type of field based on name
     * @param {string} fieldName - Field name
     * @returns {string} Semantic type
     */
    determineSemanticType(fieldName) {
        const lowerName = fieldName.toLowerCase();
        
        for (const [type, pattern] of Object.entries(this.fieldPatterns)) {
            if (pattern.test(lowerName)) {
                return type;
            }
        }
        
        return 'text'; // Default type
    }

    /**
     * Get validation rules for field type
     * @param {string} semanticType - Semantic field type
     * @returns {Object} Validation rules
     */
    getValidationRules(semanticType) {
        const rules = {
            name: { minLength: 1, maxLength: 100, pattern: /^[a-zA-Z\s\-'\.]+$/ },
            email: { pattern: /^[^\s@]+@[^\s@]+\.[^\s@]+$/ },
            phone: { pattern: /^[\+]?[\d\s\-\(\)\.]+$/, minLength: 10 },
            date: { pattern: /^\d{1,2}\/\d{1,2}\/\d{4}$|^\d{4}-\d{2}-\d{2}$/ },
            age: { pattern: /^\d{1,3}$/, min: 0, max: 150 },
            zip: { pattern: /^\d{5}(-\d{4})?$|^[A-Z]\d[A-Z]\s?\d[A-Z]\d$/ },
            ssn: { pattern: /^\d{3}-\d{2}-\d{4}$|^\d{9}$/ },
            text: { minLength: 1, maxLength: 500 }
        };
        
        return rules[semanticType] || rules.text;
    }

    /**
     * Get input hints for field type
     * @param {string} semanticType - Semantic field type
     * @returns {Object} Input hints
     */
    getInputHints(semanticType) {
        const hints = {
            name: { placeholder: 'Enter your full name', example: 'John Smith' },
            email: { placeholder: 'Enter your email address', example: 'john@example.com' },
            phone: { placeholder: 'Enter your phone number', example: '(555) 123-4567' },
            address: { placeholder: 'Enter your street address', example: '123 Main St' },
            city: { placeholder: 'Enter your city', example: 'New York' },
            state: { placeholder: 'Enter your state/province', example: 'NY' },
            zip: { placeholder: 'Enter your postal code', example: '12345' },
            date: { placeholder: 'MM/DD/YYYY', example: '01/15/1990' },
            age: { placeholder: 'Enter your age', example: '25' },
            ssn: { placeholder: 'XXX-XX-XXXX', example: '123-45-6789' },
            signature: { placeholder: 'Sign here', example: 'Your signature' },
            text: { placeholder: 'Enter text', example: 'Text input' }
        };
        
        return hints[semanticType] || hints.text;
    }

    /**
     * Determine field priority
     * @param {string} semanticType - Semantic field type
     * @param {boolean} required - Whether field is required
     * @returns {string} Priority level
     */
    determinePriority(semanticType, required) {
        if (required) return 'high';
        
        const highPriorityTypes = ['name', 'email', 'signature'];
        const mediumPriorityTypes = ['phone', 'address', 'date'];
        
        if (highPriorityTypes.includes(semanticType)) return 'high';
        if (mediumPriorityTypes.includes(semanticType)) return 'medium';
        
        return 'low';
    }

    /**
     * Estimate completion time for field type
     * @param {string} semanticType - Semantic field type
     * @returns {string} Estimated time
     */
    estimateCompletionTime(semanticType) {
        const times = {
            name: '30 seconds',
            email: '20 seconds',
            phone: '25 seconds',
            address: '45 seconds',
            city: '15 seconds',
            state: '10 seconds',
            zip: '15 seconds',
            date: '20 seconds',
            age: '10 seconds',
            ssn: '30 seconds',
            signature: '60 seconds',
            checkbox: '5 seconds',
            text: '30 seconds'
        };
        
        return times[semanticType] || '30 seconds';
    }

    /**
     * Remove duplicate fields
     * @param {Array} fields - Array of fields
     * @returns {Array} Deduplicated fields
     */
    deduplicateFields(fields) {
        const seen = new Map();
        const deduplicated = [];
        
        fields.forEach(field => {
            // Create a key based on name and position
            const key = this.createDeduplicationKey(field);
            
            if (!seen.has(key)) {
                seen.set(key, field);
                deduplicated.push(field);
            } else {
                // Keep the field with higher confidence
                const existing = seen.get(key);
                if (field.confidence > existing.confidence) {
                    // Replace existing field
                    const index = deduplicated.indexOf(existing);
                    deduplicated[index] = field;
                    seen.set(key, field);
                }
            }
        });
        
        return deduplicated;
    }

    /**
     * Create deduplication key for field
     * @param {Object} field - Form field
     * @returns {string} Deduplication key
     */
    createDeduplicationKey(field) {
        const normalizedName = field.name.toLowerCase().replace(/\s+/g, '');
        const page = field.position?.page || 1;
        
        // Include approximate position to avoid merging distant fields with same name
        let positionKey = '';
        if (field.position?.element || field.position?.x !== undefined) {
            const pos = field.position.element || field.position;
            const gridX = Math.floor((pos.x || 0) / 100); // 100px grid
            const gridY = Math.floor((pos.y || 0) / 100);
            positionKey = `_${gridX}_${gridY}`;
        }
        
        return `${normalizedName}_${page}${positionKey}`;
    }

    /**
     * Categorize fields into logical groups
     * @param {Array} fields - Array of fields
     * @returns {Array} Fields with category information
     */
    categorizeFields(fields) {
        return fields.map(field => {
            const category = this.determineCategory(field.semanticType);
            
            return {
                ...field,
                category: category.name,
                categoryId: this.getCategoryId(category.name),
                categoryIcon: category.icon,
                categoryPriority: category.priority
            };
        });
    }

    /**
     * Determine which category a field belongs to
     * @param {string} semanticType - Semantic field type
     * @returns {Object} Category information
     */
    determineCategory(semanticType) {
        for (const [categoryId, category] of Object.entries(this.categories)) {
            if (category.fields.includes(semanticType)) {
                return category;
            }
        }
        
        return this.categories.other;
    }

    /**
     * Get category ID from category name
     * @param {string} categoryName - Category name
     * @returns {string} Category ID
     */
    getCategoryId(categoryName) {
        for (const [id, category] of Object.entries(this.categories)) {
            if (category.name === categoryName) {
                return id;
            }
        }
        return 'other';
    }

    /**
     * Adjust field confidence based on semantic analysis
     * @param {Object} field - Form field
     * @returns {Object} Field with adjusted confidence
     */
    adjustConfidence(field) {
        let confidence = field.confidence;
        
        // Boost confidence for well-recognized field types
        if (field.semanticType !== 'text') {
            confidence *= 1.2;
        }
        
        // Boost confidence for required fields
        if (field.required) {
            confidence *= 1.1;
        }
        
        // Boost confidence for high-priority fields
        if (field.priority === 'high') {
            confidence *= 1.1;
        }
        
        // Penalize very generic names
        const genericNames = ['field', 'input', 'text', 'value', 'data'];
        if (genericNames.some(name => field.name.toLowerCase().includes(name))) {
            confidence *= 0.8;
        }
        
        return {
            ...field,
            confidence: Math.min(confidence, 1.0)
        };
    }

    /**
     * Calculate overall confidence for all validated fields
     * @param {Array} fields - Validated fields
     * @returns {number} Overall confidence score
     */
    calculateOverallConfidence(fields) {
        if (fields.length === 0) return 0;
        
        // Average field confidence
        const avgConfidence = fields.reduce((sum, field) => sum + field.confidence, 0) / fields.length;
        
        // Bonus for having multiple high-confidence fields
        const highConfidenceFields = fields.filter(f => f.confidence > 0.8).length;
        const confidenceBonus = Math.min(highConfidenceFields / 10, 0.2);
        
        // Bonus for having diverse field types
        const uniqueTypes = new Set(fields.map(f => f.semanticType)).size;
        const diversityBonus = Math.min(uniqueTypes / 10, 0.1);
        
        return Math.min(avgConfidence + confidenceBonus + diversityBonus, 1.0);
    }

    /**
     * Generate todo items from validated fields
     * @param {Array} fields - Validated form fields
     * @returns {Object} Todo structure organized by categories
     */
    generateTodos(fields) {
        if (!fields || fields.length === 0) {
            return {
                categories: [],
                summary: {
                    totalItems: 0,
                    completedItems: 0,
                    progress: 0,
                    estimatedTotalTime: '0 minutes',
                    requiredItems: 0,
                    optionalItems: 0
                }
            };
        }

        // Group fields by category
        const fieldsByCategory = this.groupFieldsByCategory(fields);
        
        // Create todo categories
        const todoCategories = Object.entries(fieldsByCategory).map(([categoryId, categoryFields]) => {
            const categoryInfo = this.categories[categoryId];
            
            const items = categoryFields.map(field => ({
                id: field.id,
                title: `Fill ${field.name}`,
                description: this.generateFieldDescription(field),
                completed: false,
                priority: field.priority,
                fieldType: field.semanticType,
                confidence: field.confidence,
                estimatedTime: field.estimatedTime,
                inputHints: field.inputHints,
                validation: field.validation
            }));

            return {
                id: categoryId,
                name: categoryInfo.name,
                icon: categoryInfo.icon,
                items,
                completed: 0,
                total: items.length,
                priority: categoryInfo.priority
            };
        });

        // Sort categories by priority
        todoCategories.sort((a, b) => a.priority - b.priority);

        const totalItems = todoCategories.reduce((sum, cat) => sum + cat.total, 0);
        const requiredItems = fields.filter(f => f.required).length;
        const totalTime = fields.reduce((sum, f) => sum + parseInt(f.estimatedTime), 0);

        return {
            categories: todoCategories,
            summary: {
                totalItems,
                completedItems: 0,
                progress: 0,
                estimatedTotalTime: `${Math.ceil(totalTime / 60)} minutes`,
                requiredItems,
                optionalItems: totalItems - requiredItems
            }
        };
    }

    /**
     * Group fields by category
     * @param {Array} fields - Form fields
     * @returns {Object} Fields grouped by category ID
     */
    groupFieldsByCategory(fields) {
        const grouped = {};
        
        fields.forEach(field => {
            const categoryId = field.categoryId || 'other';
            if (!grouped[categoryId]) {
                grouped[categoryId] = [];
            }
            grouped[categoryId].push(field);
        });
        
        return grouped;
    }

    /**
     * Generate description for a field
     * @param {Object} field - Form field
     * @returns {string} Field description
     */
    generateFieldDescription(field) {
        let description = field.inputHints?.placeholder || `Enter your ${field.name.toLowerCase()}`;
        
        if (field.required) {
            description += ' (required)';
        }
        
        if (field.validation?.maxLength) {
            description += ` (max ${field.validation.maxLength} characters)`;
        }
        
        return description;
    }
}

module.exports = SemanticValidator;
