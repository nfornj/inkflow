const LLMService = require('./llm-service-ollama');

/**
 * LLM-powered form analyzer that replaces separate OCR processing
 * Uses existing PDF text extraction + LLM analysis for form detection
 */
class LLMFormAnalyzer {
    constructor() {
        console.log('LLMFormAnalyzer: Initializing...');
        try {
            this.llmService = new LLMService();
            this.modelInitialized = false;
            console.log('LLMFormAnalyzer: LLMService created successfully');
        } catch (error) {
            console.error('LLMFormAnalyzer: Failed to create LLMService:', error);
            throw error;
        }
    }

    /**
     * Initialize the LLM model
     */
    async initializeModel() {
        try {
            // Try to load llama3.2:latest (available in Ollama)
            const success = await this.llmService.loadModel('llama3.2:latest');
            if (success) {
                console.log('LLMFormAnalyzer: Model loaded successfully');
            } else {
                console.warn('LLMFormAnalyzer: Failed to load model, will try alternatives');
                // Try alternative models
                const alternatives = ['llama3.2:3b', 'mistral:latest', 'llama2:latest'];
                for (const model of alternatives) {
                    try {
                        const altSuccess = await this.llmService.loadModel(model);
                        if (altSuccess) {
                            console.log(`LLMFormAnalyzer: Loaded alternative model: ${model}`);
                            break;
                        }
                    } catch (error) {
                        console.log(`LLMFormAnalyzer: Failed to load ${model}, trying next...`);
                    }
                }
            }
        } catch (error) {
            console.error('LLMFormAnalyzer: Model initialization failed:', error);
            // Don't throw error, allow analyzer to work without model (will fail gracefully)
        }
    }

    /**
     * Analyze PDF content and generate structured form field data + todos
     * @param {string} pdfText - Extracted PDF text content
     * @param {Object} options - Analysis options
     * @returns {Promise<Object>} - Form analysis result with todos
     */
    async analyzePDFForForms(pdfText, options = {}) {
        const startTime = Date.now();

        try {
            console.log('LLMFormAnalyzer: Starting form analysis...');

            // Ensure model is loaded before analysis
            if (!this.modelInitialized) {
                console.log('LLMFormAnalyzer: Loading model before analysis...');
                await this.initializeModel();
                this.modelInitialized = true;
            }

            // Step 1: Detect form structure and fields
            const formStructure = await this.detectFormStructure(pdfText);

            // Step 2: Generate categorized todo list
            const todoList = await this.generateTodoList(formStructure);

            // Step 3: Create field mapping for UI interaction
            const fieldMapping = this.createFieldMapping(formStructure);

            const processingTime = Date.now() - startTime;

            return {
                success: true,
                formStructure,
                todoList,
                fieldMapping,
                metadata: {
                    processingTime,
                    totalSections: formStructure.sections.length,
                    totalFields: formStructure.fields.length,
                    requiredFields: formStructure.fields.filter(f => f.required).length,
                    method: 'llm_analysis'
                }
            };

        } catch (error) {
            console.error('LLMFormAnalyzer: Analysis failed:', error);
            return {
                success: false,
                error: error.message,
                fallbackData: this.generateFallbackTodos(pdfText)
            };
        }
    }

    /**
     * Use LLM to detect form structure from PDF text
     * @param {string} pdfText - PDF text content
     * @returns {Promise<Object>} - Detected form structure
     */
    async detectFormStructure(pdfText) {
        const prompt = this.createFormDetectionPrompt(pdfText);

        try {
            const response = await this.llmService.callOllama(prompt);
            const parsedResponse = this.parseFormStructureResponse(response);

            console.log(`Detected ${parsedResponse.sections.length} form sections with ${parsedResponse.fields.length} fields`);
            return parsedResponse;

        } catch (error) {
            console.error('Form structure detection failed:', error);
            throw new Error(`LLM form detection failed: ${error.message}`);
        }
    }

    /**
     * Generate structured todo list from form structure
     * @param {Object} formStructure - Detected form structure
     * @returns {Promise<Object>} - Generated todo list
     */
    async generateTodoList(formStructure) {
        const prompt = this.createTodoGenerationPrompt(formStructure);

        try {
            console.log('LLMFormAnalyzer: Generating todo list from form structure...');
            const response = await this.llmService.callOllama(prompt);
            console.log('LLMFormAnalyzer: Todo generation response length:', response.length);
            console.log('LLMFormAnalyzer: Todo response preview:', response.substring(0, 300) + '...');

            const todoList = this.parseTodoListResponse(response);

            console.log(`Generated ${todoList.categories.length} todo categories with ${todoList.summary?.totalItems || 'undefined'} items`);
            console.log('Todo categories:', todoList.categories.map(cat => ({ name: cat.name, itemCount: cat.items?.length || 0 })));
            return todoList;

        } catch (error) {
            console.error('Todo generation failed:', error);
            // Fallback to rule-based todo generation
            return this.generateFallbackTodos(formStructure);
        }
    }

    /**
     * Create form detection prompt for LLM
     * @param {string} pdfText - PDF text content
     * @returns {string} - Formatted prompt
     */
    createFormDetectionPrompt(pdfText) {
        return `You are an expert form analyzer. Analyze the following PDF text content and identify all form fields, sections, and their relationships.

PDF Content:
${pdfText}

Please analyze this content and identify:
1. Form sections (groups of related fields)
2. Individual form fields with their properties
3. Field types (text, email, phone, date, checkbox, etc.)
4. Required vs optional fields
5. Field relationships and dependencies

Respond with a JSON object in this exact format:
{
  "sections": [
    {
      "id": "section_1",
      "title": "Personal Information",
      "description": "Basic personal details",
      "priority": 1,
      "required": true,
      "fields": ["field_1", "field_2"]
    }
  ],
  "fields": [
    {
      "id": "field_1",
      "name": "Full Name",
      "type": "text",
      "section": "section_1",
      "required": true,
      "placeholder": "Enter your full legal name",
      "validation": "text",
      "confidence": 0.95,
      "position": {"page": 1, "approximate_location": "top-left"}
    }
  ],
  "metadata": {
    "form_type": "application|registration|survey|other",
    "estimated_completion_time": "15 minutes",
    "complexity": "low|medium|high"
  }
}

Focus on accuracy and completeness. Only include fields that are clearly identifiable as form inputs.`;
    }

    /**
     * Create todo generation prompt for LLM
     * @param {Object} formStructure - Detected form structure
     * @returns {string} - Formatted prompt
     */
    createTodoGenerationPrompt(formStructure) {
        return `You are a task organization expert. Based on the detected form structure, create an organized todo list that helps users efficiently complete the form.

Form Structure:
${JSON.stringify(formStructure, null, 2)}

Create a todo list that:
1. Groups related fields into logical categories
2. Prioritizes tasks by importance and dependencies
3. Provides helpful descriptions and tips
4. Estimates completion time for each task
5. Identifies required vs optional tasks

Respond with a JSON object in this exact format:
{
  "categories": [
    {
      "id": "cat_1",
      "name": "Personal Information",
      "icon": "👤",
      "description": "Basic personal details and identification",
      "priority": 1,
      "required": true,
      "estimatedTime": "3 minutes",
      "items": [
        {
          "id": "todo_1",
          "title": "Enter Full Name",
          "description": "Provide your legal name as it appears on official documents",
          "status": "pending",
          "priority": "high",
          "required": true,
          "estimatedTime": "30 seconds",
          "fieldIds": ["field_1"],
          "tips": ["Use your legal name", "Double-check spelling"],
          "completionAnimation": "checkmark"
        }
      ],
      "completed": 0,
      "total": 1,
      "progress": 0
    }
  ],
  "summary": {
    "totalItems": 10,
    "completedItems": 0,
    "progress": 0,
    "estimatedTotalTime": "15 minutes",
    "requiredItems": 7,
    "optionalItems": 3
  }
}

Make the todo list user-friendly and actionable.`;
    }

    /**
     * Parse LLM response for form structure
     * @param {string} response - LLM response
     * @returns {Object} - Parsed form structure
     */
    parseFormStructureResponse(response) {
        try {
            console.log('LLMFormAnalyzer: Parsing form structure response...');
            console.log('Raw LLM response length:', response.length);
            console.log('Raw LLM response preview:', response.substring(0, 500) + '...');

            // Extract JSON from response (handle potential markdown formatting)
            let jsonString = response;

            // Try to extract JSON from markdown code blocks first
            const codeBlockMatch = response.match(/```(?:json)?\s*(\{[\s\S]*?\})\s*```/);
            if (codeBlockMatch) {
                jsonString = codeBlockMatch[1];
                console.log('Found JSON in code block');
            } else {
                // Fallback to finding JSON object
                const jsonMatch = response.match(/\{[\s\S]*\}/);
                if (jsonMatch) {
                    jsonString = jsonMatch[0];
                } else {
                    throw new Error('No JSON found in LLM response');
                }
            }

            console.log('Extracted JSON preview:', jsonString.substring(0, 300) + '...');
            console.log('Full JSON length:', jsonString.length);

            // Try to parse JSON with better error handling
            let parsed;
            try {
                parsed = JSON.parse(jsonString);
            } catch (parseError) {
                console.error('JSON parse error:', parseError.message);
                console.error('Problematic JSON:', jsonString);

                // Try to fix common JSON issues
                let fixedJson = jsonString
                    .replace(/,\s*}/g, '}')  // Remove trailing commas
                    .replace(/,\s*]/g, ']')  // Remove trailing commas in arrays
                    .replace(/([{,]\s*)(\w+):/g, '$1"$2":'); // Add quotes to unquoted keys

                console.log('Attempting to parse fixed JSON...');
                parsed = JSON.parse(fixedJson);
            }

            // Validate structure
            if (!parsed.sections || !parsed.fields) {
                throw new Error('Invalid form structure format');
            }

            return {
                sections: parsed.sections || [],
                fields: parsed.fields || [],
                metadata: parsed.metadata || {}
            };

        } catch (error) {
            console.error('Failed to parse form structure response:', error);
            throw new Error(`Response parsing failed: ${error.message}`);
        }
    }

    /**
     * Parse LLM response for todo list
     * @param {string} response - LLM response
     * @returns {Object} - Parsed todo list
     */
    parseTodoListResponse(response) {
        try {
            const jsonMatch = response.match(/\{[\s\S]*\}/);
            if (!jsonMatch) {
                throw new Error('No JSON found in todo response');
            }

            const parsed = JSON.parse(jsonMatch[0]);

            if (!parsed.categories) {
                throw new Error('Invalid todo list format');
            }

            return {
                categories: parsed.categories || [],
                summary: parsed.summary || {
                    totalItems: 0,
                    completedItems: 0,
                    progress: 0,
                    estimatedTotalTime: '0 minutes'
                }
            };

        } catch (error) {
            console.error('Failed to parse todo response:', error);
            throw new Error(`Todo parsing failed: ${error.message}`);
        }
    }

    /**
     * Create field mapping for UI interaction
     * @param {Object} formStructure - Form structure
     * @returns {Object} - Field mapping
     */
    createFieldMapping(formStructure) {
        const mapping = {};

        formStructure.fields.forEach(field => {
            mapping[field.id] = {
                name: field.name,
                type: field.type,
                section: field.section,
                required: field.required,
                position: field.position,
                validation: field.validation
            };
        });

        return mapping;
    }

    /**
     * Generate fallback todos when LLM analysis fails
     * @param {string|Object} input - PDF text or form structure
     * @returns {Object} - Fallback todo list
     */
    generateFallbackTodos(input) {
        console.log('Generating fallback todos...');

        return {
            categories: [
                {
                    id: 'fallback_1',
                    name: 'Form Completion',
                    icon: '📝',
                    description: 'Complete the detected form fields',
                    priority: 1,
                    required: true,
                    estimatedTime: '10 minutes',
                    items: [
                        {
                            id: 'fallback_todo_1',
                            title: 'Review and Complete Form',
                            description: 'Manually review the PDF and complete all visible form fields',
                            status: 'pending',
                            priority: 'medium',
                            required: true,
                            estimatedTime: '10 minutes',
                            fieldIds: [],
                            tips: ['Review each page carefully', 'Fill required fields first'],
                            completionAnimation: 'checkmark'
                        }
                    ],
                    completed: 0,
                    total: 1,
                    progress: 0
                }
            ],
            summary: {
                totalItems: 1,
                completedItems: 0,
                progress: 0,
                estimatedTotalTime: '10 minutes',
                requiredItems: 1,
                optionalItems: 0
            }
        };
    }

    /**
     * Update todo item status with animation trigger
     * @param {string} todoId - Todo item ID
     * @param {string} status - New status
     * @param {Object} todoList - Current todo list
     * @returns {Object} - Updated todo list with animation data
     */
    updateTodoStatus(todoId, status, todoList) {
        const updatedList = JSON.parse(JSON.stringify(todoList)); // Deep clone

        for (const category of updatedList.categories) {
            const item = category.items.find(item => item.id === todoId);
            if (item) {
                const oldStatus = item.status;
                item.status = status;

                // Trigger completion animation
                if (oldStatus !== 'completed' && status === 'completed') {
                    item.animationTrigger = {
                        type: 'completion',
                        timestamp: Date.now(),
                        animation: item.completionAnimation || 'checkmark'
                    };
                }

                // Update category progress
                category.completed = category.items.filter(i => i.status === 'completed').length;
                category.progress = Math.round((category.completed / category.total) * 100);

                break;
            }
        }

        // Update overall progress
        updatedList.summary.completedItems = updatedList.categories
            .reduce((sum, cat) => sum + cat.completed, 0);
        updatedList.summary.progress = Math.round(
            (updatedList.summary.completedItems / updatedList.summary.totalItems) * 100
        );

        return updatedList;
    }
}

module.exports = { LLMFormAnalyzer };
