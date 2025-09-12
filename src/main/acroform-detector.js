/**
 * AcroForm Detector - Extracts interactive form fields from PDFs
 * This is the primary detection method for modern PDFs with embedded form fields
 */

const { PDFDocument } = require('pdf-lib');

class AcroFormDetector {
    constructor() {
        this.name = 'AcroForm Detector';
        this.version = '1.0.0';
    }

    /**
     * Detect interactive form fields in PDF
     * @param {Uint8Array} pdfBytes - PDF file bytes
     * @returns {Promise<Object>} Detection result with fields and metadata
     */
    async detectFields(pdfBytes) {
        const startTime = Date.now();
        
        try {
            console.log('🔍 AcroForm: Starting detection...');
            
            // Load PDF document
            const pdfDoc = await PDFDocument.load(pdfBytes);
            const form = pdfDoc.getForm();
            
            // Get all form fields
            const fields = form.getFields();
            
            if (fields.length === 0) {
                return {
                    success: true,
                    method: 'acroform',
                    confidence: 0,
                    fields: [],
                    processingTime: Date.now() - startTime,
                    message: 'No interactive form fields found'
                };
            }

            console.log(`🔍 AcroForm: Found ${fields.length} interactive fields`);

            // Process each field
            const detectedFields = [];
            
            for (let i = 0; i < fields.length; i++) {
                const field = fields[i];
                const fieldData = await this.processField(field, i);
                if (fieldData) {
                    detectedFields.push(fieldData);
                }
            }

            const processingTime = Date.now() - startTime;
            
            console.log(`✅ AcroForm: Detected ${detectedFields.length} valid fields in ${processingTime}ms`);

            return {
                success: true,
                method: 'acroform',
                confidence: 1.0, // AcroForm detection is 100% accurate
                fields: detectedFields,
                processingTime,
                metadata: {
                    totalFields: fields.length,
                    validFields: detectedFields.length,
                    hasInteractiveForm: true
                }
            };

        } catch (error) {
            console.error('❌ AcroForm detection failed:', error);
            return {
                success: false,
                method: 'acroform',
                confidence: 0,
                fields: [],
                processingTime: Date.now() - startTime,
                error: error.message
            };
        }
    }

    /**
     * Process individual form field
     * @param {Object} field - PDF form field
     * @param {number} index - Field index
     * @returns {Object|null} Processed field data
     */
    async processField(field, index) {
        try {
            const fieldName = field.getName();
            const fieldType = this.getFieldType(field);
            
            // Skip unnamed or invalid fields
            if (!fieldName || fieldName.trim() === '') {
                return null;
            }

            // Get field properties
            const isRequired = this.isFieldRequired(field);
            const defaultValue = this.getFieldDefaultValue(field);
            const tooltip = this.getFieldTooltip(field);
            
            // Generate field metadata
            const fieldData = {
                id: `acroform_${index}_${fieldName.replace(/[^a-zA-Z0-9]/g, '_')}`,
                name: this.cleanFieldName(fieldName),
                type: fieldType,
                source: 'acroform',
                required: isRequired,
                confidence: 1.0,
                position: {
                    page: 1, // AcroForm fields span across pages
                    method: 'acroform_extraction'
                },
                properties: {
                    originalName: fieldName,
                    defaultValue,
                    tooltip,
                    fieldType: field.constructor.name
                }
            };

            // Add type-specific properties
            this.addTypeSpecificProperties(field, fieldData);

            return fieldData;

        } catch (error) {
            console.warn(`⚠️ AcroForm: Failed to process field ${index}:`, error);
            return null;
        }
    }

    /**
     * Determine field type from PDF field
     * @param {Object} field - PDF form field
     * @returns {string} Standardized field type
     */
    getFieldType(field) {
        const constructor = field.constructor.name;
        
        switch (constructor) {
            case 'PDFTextField':
                return 'text';
            case 'PDFCheckBox':
                return 'checkbox';
            case 'PDFRadioGroup':
                return 'radio';
            case 'PDFDropdown':
                return 'select';
            case 'PDFOptionList':
                return 'list';
            case 'PDFButton':
                return 'button';
            case 'PDFSignature':
                return 'signature';
            default:
                return 'unknown';
        }
    }

    /**
     * Check if field is required
     * @param {Object} field - PDF form field
     * @returns {boolean} Whether field is required
     */
    isFieldRequired(field) {
        try {
            // Check field flags for required status
            if (typeof field.isRequired === 'function') {
                return field.isRequired();
            }
            
            // Fallback: check field name for required indicators
            const name = field.getName().toLowerCase();
            return name.includes('required') || name.includes('*');
            
        } catch (error) {
            return false;
        }
    }

    /**
     * Get field default value
     * @param {Object} field - PDF form field
     * @returns {string|null} Default value if any
     */
    getFieldDefaultValue(field) {
        try {
            if (typeof field.getText === 'function') {
                return field.getText() || null;
            }
            if (typeof field.isChecked === 'function') {
                return field.isChecked() ? 'checked' : 'unchecked';
            }
            return null;
        } catch (error) {
            return null;
        }
    }

    /**
     * Get field tooltip/help text
     * @param {Object} field - PDF form field
     * @returns {string|null} Tooltip text if any
     */
    getFieldTooltip(field) {
        try {
            // Try to get tooltip from field properties
            if (typeof field.getTooltip === 'function') {
                return field.getTooltip() || null;
            }
            return null;
        } catch (error) {
            return null;
        }
    }

    /**
     * Clean and normalize field name
     * @param {string} name - Raw field name
     * @returns {string} Cleaned field name
     */
    cleanFieldName(name) {
        return name
            .replace(/[_\-\.]/g, ' ')
            .replace(/([a-z])([A-Z])/g, '$1 $2')
            .replace(/\s+/g, ' ')
            .trim()
            .replace(/\b\w/g, l => l.toUpperCase());
    }

    /**
     * Add type-specific properties to field data
     * @param {Object} field - PDF form field
     * @param {Object} fieldData - Field data object to enhance
     */
    addTypeSpecificProperties(field, fieldData) {
        try {
            const fieldType = fieldData.type;

            switch (fieldType) {
                case 'text':
                    if (typeof field.getMaxLength === 'function') {
                        fieldData.properties.maxLength = field.getMaxLength();
                    }
                    if (typeof field.isMultiline === 'function') {
                        fieldData.properties.multiline = field.isMultiline();
                    }
                    if (typeof field.isPassword === 'function') {
                        fieldData.properties.password = field.isPassword();
                    }
                    break;

                case 'select':
                case 'list':
                    if (typeof field.getOptions === 'function') {
                        fieldData.properties.options = field.getOptions();
                    }
                    break;

                case 'radio':
                    if (typeof field.getOptions === 'function') {
                        fieldData.properties.options = field.getOptions();
                    }
                    if (typeof field.getSelected === 'function') {
                        fieldData.properties.selected = field.getSelected();
                    }
                    break;

                case 'checkbox':
                    if (typeof field.isChecked === 'function') {
                        fieldData.properties.checked = field.isChecked();
                    }
                    break;
            }
        } catch (error) {
            console.warn('⚠️ AcroForm: Failed to add type-specific properties:', error);
        }
    }

    /**
     * Generate categorized todo items from detected fields
     * @param {Array} fields - Detected form fields
     * @returns {Object} Categorized todo structure
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
        const categories = this.categorizeFields(fields);
        
        // Generate todo items for each category
        const todoCategories = categories.map(category => {
            const items = category.fields.map(field => ({
                id: field.id,
                title: `Fill ${field.name}`,
                description: this.generateFieldDescription(field),
                completed: false,
                priority: field.required ? 'high' : 'medium',
                fieldType: field.type,
                confidence: field.confidence
            }));

            return {
                id: category.id,
                name: category.name,
                icon: category.icon,
                items,
                completed: 0,
                total: items.length
            };
        });

        const totalItems = todoCategories.reduce((sum, cat) => sum + cat.total, 0);
        const requiredItems = fields.filter(f => f.required).length;

        return {
            categories: todoCategories,
            summary: {
                totalItems,
                completedItems: 0,
                progress: 0,
                estimatedTotalTime: `${Math.ceil(totalItems * 0.5)} minutes`,
                requiredItems,
                optionalItems: totalItems - requiredItems
            }
        };
    }

    /**
     * Categorize fields into logical groups
     * @param {Array} fields - Form fields
     * @returns {Array} Field categories
     */
    categorizeFields(fields) {
        const categories = {
            personal: { name: 'Personal Information', icon: '👤', fields: [] },
            contact: { name: 'Contact Information', icon: '📞', fields: [] },
            address: { name: 'Address Information', icon: '🏠', fields: [] },
            financial: { name: 'Financial Information', icon: '💰', fields: [] },
            employment: { name: 'Employment Information', icon: '💼', fields: [] },
            signature: { name: 'Signatures & Agreements', icon: '✍️', fields: [] },
            other: { name: 'Other Information', icon: '📋', fields: [] }
        };

        // Categorize each field
        fields.forEach(field => {
            const category = this.determineFieldCategory(field);
            if (categories[category]) {
                categories[category].fields.push(field);
            }
        });

        // Convert to array and filter empty categories
        return Object.keys(categories)
            .map(key => ({
                id: key,
                ...categories[key]
            }))
            .filter(cat => cat.fields.length > 0);
    }

    /**
     * Determine which category a field belongs to
     * @param {Object} field - Form field
     * @returns {string} Category key
     */
    determineFieldCategory(field) {
        const name = field.name.toLowerCase();
        const originalName = field.properties.originalName?.toLowerCase() || '';
        const combined = `${name} ${originalName}`;

        // Personal information
        if (/\b(name|first|last|middle|initial|birth|age|gender|sex)\b/.test(combined)) {
            return 'personal';
        }

        // Contact information
        if (/\b(phone|email|mobile|cell|contact|fax|telephone)\b/.test(combined)) {
            return 'contact';
        }

        // Address information
        if (/\b(address|street|city|state|zip|postal|country|province)\b/.test(combined)) {
            return 'address';
        }

        // Financial information
        if (/\b(income|salary|tax|ssn|sin|account|bank|financial|amount|payment)\b/.test(combined)) {
            return 'financial';
        }

        // Employment information
        if (/\b(employer|job|work|occupation|company|position|title|employment)\b/.test(combined)) {
            return 'employment';
        }

        // Signature fields
        if (field.type === 'signature' || /\b(sign|signature|agree|consent|acknowledge)\b/.test(combined)) {
            return 'signature';
        }

        return 'other';
    }

    /**
     * Generate description for a field
     * @param {Object} field - Form field
     * @returns {string} Field description
     */
    generateFieldDescription(field) {
        const baseDesc = `Enter your ${field.name.toLowerCase()}`;
        
        if (field.properties.tooltip) {
            return field.properties.tooltip;
        }

        if (field.required) {
            return `${baseDesc} (required)`;
        }

        if (field.properties.maxLength) {
            return `${baseDesc} (max ${field.properties.maxLength} characters)`;
        }

        return baseDesc;
    }
}

module.exports = AcroFormDetector;
