const LLMService = require('./llm-service-ollama');

/**
 * LLM-powered form analyzer that replaces separate OCR processing
 * Uses existing PDF text extraction + LLM analysis for form detection
 */
class LLMFormAnalyzer {
    constructor(providerManager = null) {
        console.log('LLMFormAnalyzer: Initializing...');
        try {
            this.providerManager = providerManager;
            this.llmService = new LLMService(); // Legacy service for backward compatibility
            this.modelInitialized = false;
            console.log('LLMFormAnalyzer: LLMService created successfully');
        } catch (error) {
            console.error('LLMFormAnalyzer: Failed to create LLMService:', error);
            throw error;
        }
    }

    /**
     * Set the provider manager (for runtime updates)
     * @param {LLMProviderManager} providerManager - Provider manager instance
     */
    setProviderManager(providerManager) {
        this.providerManager = providerManager;
    }

    /**
     * Call LLM using provider manager or fallback to legacy service
     * @param {string} prompt - The prompt to send
     * @param {Object} options - Additional options
     * @returns {Promise<string>} LLM response
     */
    async callLLM(prompt, options = {}) {
        // Use provider manager if available
        if (this.providerManager) {
            try {
                return await this.providerManager.callLLM(prompt, options);
            } catch (error) {
                console.error('Provider manager call failed, falling back to legacy service:', error);
            }
        }

        // Fallback to legacy service
        if (this.llmService) {
            return await this.llmService.callOllama(prompt);
        }

        throw new Error('No LLM service available');
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
            const response = await this.callLLM(prompt);
            const parsedResponse = this.parseFormStructureResponse(response);

            console.log(`Detected ${parsedResponse.sections.length} form sections with ${parsedResponse.fields.length} fields`);
            return parsedResponse;

        } catch (error) {
            console.error('Form structure detection failed:', error);
            throw new Error(`LLM form detection failed: ${error.message}`);
        }
    }

  /**
   * Unified analysis: detect form structure AND generate todos in single LLM call
   * @param {string} pdfText - PDF text content
   * @param {Object} options - Analysis options
   * @returns {Promise<Object>} - Combined form structure and todo list
   */
  async analyzePDFForFormsAndTodos(pdfText, options = {}) {
    const startTime = Date.now();
    
    try {
      console.log('LLMFormAnalyzer: Starting unified form analysis...');
      
      // Ensure model is loaded before analysis
      if (!this.modelInitialized) {
        console.log('LLMFormAnalyzer: Loading model before unified analysis...');
        await this.initializeModel();
        this.modelInitialized = true;
      }
      
      // Single LLM call for both form detection and todo generation
      const unifiedPrompt = this.createUnifiedAnalysisPrompt(pdfText);
      const response = await this.callLLM(unifiedPrompt);
      
      console.log('LLMFormAnalyzer: Unified response length:', response.length);
      console.log('LLMFormAnalyzer: Unified response preview:', response.substring(0, 300) + '...');
      
      const parsedResult = this.parseUnifiedResponse(response);
      
      // Create field mapping for UI interaction
      const fieldMapping = this.createFieldMapping(parsedResult.formStructure);
      
      const processingTime = Date.now() - startTime;
      console.log(`Unified LLM analysis completed in ${processingTime}ms`);
      console.log(`Detected ${parsedResult.formStructure.sections.length} form sections with ${parsedResult.formStructure.fields.length} fields`);
      console.log(`Generated ${parsedResult.todoList.categories.length} todo categories with ${parsedResult.todoList.summary.totalItems} items`);
      
      return {
        success: true,
        formStructure: parsedResult.formStructure,
        todoList: parsedResult.todoList,
        fieldMapping,
        metadata: {
          processingTime,
          totalSections: parsedResult.formStructure.sections.length,
          totalFields: parsedResult.formStructure.fields.length,
          requiredFields: parsedResult.formStructure.fields.filter(f => f.required).length,
          method: 'unified_analysis',
          singlePass: true
        }
      };
      
    } catch (error) {
      console.error('LLMFormAnalyzer: Unified analysis failed:', error);
      console.log('LLMFormAnalyzer: Falling back to dual-pass analysis...');
      
      try {
        // Fallback to legacy dual-pass method
        const formStructure = await this.detectFormStructure(pdfText);
        const todoList = await this.generateTodoList(formStructure);
        const fieldMapping = this.createFieldMapping(formStructure);
        
        const processingTime = Date.now() - startTime;
        console.log(`Fallback dual-pass analysis completed in ${processingTime}ms`);
        
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
            method: 'fallback_dual_pass',
            singlePass: false,
            fallbackReason: error.message
          }
        };
      } catch (fallbackError) {
        console.error('LLMFormAnalyzer: Fallback analysis also failed:', fallbackError);
        return {
          success: false,
          error: `Unified analysis failed: ${error.message}. Fallback failed: ${fallbackError.message}`,
          fallbackData: this.generateFallbackTodos(pdfText)
        };
      }
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
            const response = await this.callLLM(prompt);
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
   * Create unified analysis prompt for both form detection and todo generation
   * @param {string} pdfText - PDF text content
   * @returns {string} - Formatted unified prompt
   */
  createUnifiedAnalysisPrompt(pdfText) {
    return `You are an expert form analyzer. Analyze this PDF content and provide BOTH form structure analysis AND todo list generation in a single response.

PDF Content:
${pdfText}

Return a JSON object with this EXACT structure:
{
  "formStructure": {
    "sections": [
      {
        "id": "section_1",
        "title": "Section Name",
        "description": "Section description",
        "priority": 1,
        "required": true,
        "fields": ["field_1", "field_2"]
      }
    ],
    "fields": [
      {
        "id": "field_1",
        "name": "Field Name",
        "type": "text",
        "section": "section_1",
        "required": true,
        "placeholder": "Enter your information",
        "validation": "validation rules",
        "confidence": 0.95,
        "position": {
          "page": 1,
          "approximate_location": "top-left"
        }
      }
    ],
    "metadata": {
      "form_type": "application",
      "estimated_completion_time": "10 minutes",
      "complexity": "medium"
    }
  },
  "todoList": {
    "categories": [
      {
        "id": "cat_1",
        "name": "Personal Information",
        "icon": "👤",
        "description": "Basic personal details and identification",
        "priority": 1,
        "required": true,
        "estimatedTime": "5 minutes",
        "items": [
          {
            "id": "item_1",
            "title": "Fill Full Name",
            "description": "Enter your complete legal name",
            "fieldId": "field_1",
            "required": true,
            "priority": "high",
            "estimatedTime": "1 minute",
            "status": "pending",
            "category": "cat_1"
          }
        ],
        "completed": 0,
        "total": 1,
        "progress": 0
      }
    ],
    "summary": {
      "totalItems": 5,
      "completedItems": 0,
      "progress": 0,
      "estimatedTotalTime": "10 minutes",
      "requiredItems": 3
    }
  }
}

Instructions:
1. Analyze the PDF content to identify form fields, sections, and structure
2. Create organized todo categories based on logical groupings of fields
3. Generate specific todo items for each field that needs to be filled
4. Ensure field IDs match between formStructure.fields and todoList items
5. Use appropriate icons for categories (👤 for personal info, 📞 for contact, etc.)
6. Set realistic time estimates and priorities
7. Return ONLY the JSON object, no additional text or markdown formatting
8. CRITICAL: Ensure all JSON arrays and objects are properly closed with no trailing commas
9. Validate JSON syntax before responding

Important: The response must be valid JSON that can be parsed directly. Double-check for trailing commas and proper bracket closure.`;
  }

  /**
   * Create form detection prompt for LLM
   * @param {string} pdfText - PDF text content
   * @returns {string} - Formatted prompt
   */
  createFormDetectionPrompt(pdfText) {
        return `You are an expert form analyzer specializing in flattened/scanned PDF forms. Analyze the following PDF text content and identify ALL form fields that need to be filled out.

PDF Content:
${pdfText}

FORM FIELD DETECTION PATTERNS:
Look for these indicators of fillable fields:
1. **Underlines/Blanks**: Text like "Name: ___________" or "Address: _______"
2. **Checkboxes**: "[ ]" or "☐" followed by options
3. **Labels with colons**: "Email:", "Phone:", "Date:", "Amount:"
4. **Numbered items**: "1. Name", "2. Address", "3. Phone"
5. **Table structures**: Rows/columns that need data entry
6. **Signature lines**: "Signature:", "Date signed:", "Witness:"
7. **Amount fields**: "$_____", "Total: $", "Amount: CAD $"
8. **Date fields**: "Date: ___/___/___", "MM/DD/YYYY", "Date of Birth:"
9. **Yes/No questions**: "Are you...? Yes [ ] No [ ]"
10. **Multiple choice**: Options with checkboxes or circles
11. **Text areas**: Large blank spaces for descriptions/comments
12. **Required asterisks**: Fields marked with "*" or "(required)"

COMPREHENSIVE ANALYSIS INSTRUCTIONS:
- Scan the ENTIRE document text thoroughly
- Look for ANY text that suggests user input is needed
- Include fields even if they seem minor (initials, dates, etc.)
- Group related fields into logical sections
- Identify field types based on context and labels
- Mark fields as required if indicated by asterisks, "required", or legal necessity

Respond with a JSON object in this exact format:
{
  "sections": [
    {
      "id": "section_1",
      "title": "Personal Information",
      "description": "Basic personal details",
      "priority": 1,
      "required": true,
      "fields": ["field_1", "field_2", "field_3"]
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
    "form_type": "application|registration|survey|tax|legal|other",
    "estimated_completion_time": "15 minutes",
    "complexity": "low|medium|high",
    "total_fields_detected": 0
  }
}

CRITICAL: Be thorough and comprehensive. Include ALL fields that require user input, no matter how small. Better to include too many than miss important fields.`;
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

CRITICAL REQUIREMENTS:
- Include EVERY SINGLE field from the form structure as a todo item
- Do not skip or omit any fields, even if they seem minor
- Each field should have its own specific todo item
- Group related fields into logical categories
- Ensure the total number of todo items matches the number of detected fields

TODO TITLE GUIDELINES:
- Use clean, simple field names WITHOUT "Fill" or "Enter" prefixes
- Examples: "Full Name" (not "Fill Full Name"), "Email Address" (not "Enter Email")
- Use proper capitalization and clear, concise language
- Make titles user-friendly and professional

Create a todo list that:
1. Groups related fields into logical categories
2. Prioritizes tasks by importance and dependencies
3. Provides helpful descriptions and tips for each specific field
4. Estimates completion time for each task
5. Identifies required vs optional tasks
6. Creates one todo item per form field (1:1 mapping)
7. Uses clean, meaningful titles without action verbs

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
          "title": "Full Name",
          "description": "Enter your legal name as it appears on official documents",
          "status": "pending",
          "priority": "high",
          "required": true,
          "estimatedTime": "30 seconds",
          "fieldIds": ["field_1"],
          "tips": ["Use your legal name exactly as shown on ID", "Double-check spelling"],
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
   * Parse unified LLM response for both form structure and todo list
   * @param {string} response - LLM unified response
   * @returns {Object} - Parsed form structure and todo list
   */
  parseUnifiedResponse(response) {
    try {
      console.log('LLMFormAnalyzer: Parsing unified response...');
      console.log('Raw unified response length:', response.length);
      console.log('Raw unified response preview:', response.substring(0, 500) + '...');
      
      // Extract JSON from response (handle potential markdown formatting)
      let jsonString = response;
      
      // Try to extract JSON from markdown code blocks first
      const codeBlockMatch = response.match(/```(?:json)?\s*(\{[\s\S]*?\})\s*```/);
      if (codeBlockMatch) {
        jsonString = codeBlockMatch[1];
        console.log('Found unified JSON in code block');
      } else {
        // Fallback to finding JSON object
        const jsonMatch = response.match(/\{[\s\S]*\}/);
        if (jsonMatch) {
          jsonString = jsonMatch[0];
        } else {
          throw new Error('No JSON found in unified LLM response');
        }
      }
      
      console.log('Extracted unified JSON preview:', jsonString.substring(0, 300) + '...');
      console.log('Full unified JSON length:', jsonString.length);
      
      // Try to parse JSON with better error handling
      let parsed;
      try {
        parsed = JSON.parse(jsonString);
      } catch (parseError) {
        console.error('Unified JSON parse error:', parseError.message);
        console.error('Problematic unified JSON:', jsonString);
        
        // Try to fix common JSON issues
        let fixedJson = jsonString
          .replace(/,\s*}/g, '}')  // Remove trailing commas in objects
          .replace(/,\s*]/g, ']')  // Remove trailing commas in arrays
          .replace(/([{,]\s*)(\w+):/g, '$1"$2":') // Add quotes to unquoted keys
          .replace(/}\s*,\s*]/g, '}]') // Fix object-array comma issues
          .replace(/]\s*,\s*}/g, ']}') // Fix array-object comma issues
          .replace(/,\s*,/g, ',') // Remove duplicate commas
          .replace(/:\s*,/g, ': null,'); // Fix missing values
        
        console.log('Attempting to parse fixed unified JSON...');
        parsed = JSON.parse(fixedJson);
      }
      
      // Validate unified structure
      if (!parsed.formStructure || !parsed.todoList) {
        throw new Error('Invalid unified response format - missing formStructure or todoList');
      }
      
      if (!parsed.formStructure.sections || !parsed.formStructure.fields) {
        throw new Error('Invalid form structure format in unified response');
      }
      
      if (!parsed.todoList.categories) {
        throw new Error('Invalid todo list format in unified response');
      }
      
      // Ensure summary exists
      if (!parsed.todoList.summary) {
        const totalItems = parsed.todoList.categories.reduce((sum, cat) => sum + (cat.items?.length || 0), 0);
        parsed.todoList.summary = {
          totalItems,
          completedItems: 0,
          progress: 0,
          estimatedTotalTime: '10 minutes',
          requiredItems: totalItems
        };
      }
      
      console.log('Unified response parsed successfully:', {
        formSections: parsed.formStructure.sections.length,
        formFields: parsed.formStructure.fields.length,
        todoCategories: parsed.todoList.categories.length,
        todoItems: parsed.todoList.summary.totalItems
      });
      
      return {
        formStructure: {
          sections: parsed.formStructure.sections || [],
          fields: parsed.formStructure.fields || [],
          metadata: parsed.formStructure.metadata || {
            form_type: 'unknown',
            estimated_completion_time: '10 minutes',
            complexity: 'medium'
          }
        },
        todoList: {
          categories: parsed.todoList.categories || [],
          summary: parsed.todoList.summary
        }
      };
      
    } catch (error) {
      console.error('Failed to parse unified response:', error);
      throw new Error(`Unified response parsing failed: ${error.message}`);
    }
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
            console.log('Raw form structure response preview:', response.substring(0, 500) + '...');
            
            // Generate fallback form structure instead of throwing error
            console.log('Generating fallback form structure...');
            return this.generateFallbackFormStructure(response);
        }
    }

    /**
     * Parse LLM response for todo list
     * @param {string} response - LLM response
     * @returns {Object} - Parsed todo list
     */
    parseTodoListResponse(response) {
        try {
            // Try multiple JSON extraction methods
            let jsonString = null;
            
            // Method 1: Look for JSON in code blocks
            const codeBlockMatch = response.match(/```(?:json)?\s*(\{[\s\S]*?\})\s*```/);
            if (codeBlockMatch) {
                jsonString = codeBlockMatch[1];
                console.log('Found JSON in code block');
            } else {
                // Method 2: Look for the largest JSON object
                const jsonMatch = response.match(/\{[\s\S]*\}/);
                if (jsonMatch) {
                    jsonString = jsonMatch[0];
                    console.log('Found JSON in response');
                }
            }
            
            if (!jsonString) {
                throw new Error('No JSON found in todo response');
            }

            // Clean up common JSON issues
            jsonString = jsonString
                .replace(/,\s*}/g, '}')  // Remove trailing commas before }
                .replace(/,\s*]/g, ']')  // Remove trailing commas before ]
                .replace(/\n/g, ' ')     // Remove newlines that might break JSON
                .replace(/\s+/g, ' ')    // Normalize whitespace
                .trim();

            console.log('Attempting to parse cleaned JSON...');
            const parsed = JSON.parse(jsonString);

            if (!parsed.categories || !Array.isArray(parsed.categories)) {
                throw new Error('Invalid todo list format - no valid categories array');
            }

            // Validate and clean categories
            const validCategories = parsed.categories.filter(cat => 
                cat && cat.name && Array.isArray(cat.items) && cat.items.length > 0
            );

            if (validCategories.length === 0) {
                throw new Error('No valid categories with items found');
            }

            const totalItems = validCategories.reduce((sum, cat) => sum + (cat.items?.length || 0), 0);
            console.log(`✅ Successfully parsed ${validCategories.length} categories with ${totalItems} total items`);

            return {
                categories: validCategories,
                summary: parsed.summary || {
                    totalItems: totalItems,
                    completedItems: 0,
                    progress: 0,
                    estimatedTotalTime: '15 minutes'
                }
            };

        } catch (error) {
            console.error('Failed to parse todo response:', error);
            console.log('Raw todo response preview:', response.substring(0, 500) + '...');
            
            // Generate fallback todos instead of throwing error
            console.log('Generating fallback todos...');
            return this.generateFallbackTodos(response);
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
        console.log('Generating smart fallback todos from LLM response...');

        // Try to extract field information from the malformed LLM response
        const smartTodos = this.extractTodosFromText(input);
        
        if (smartTodos.length > 1) {
            console.log(`✅ Extracted ${smartTodos.length} todos from LLM response text`);
            return {
                categories: [
                    {
                        id: 'extracted_1',
                        name: 'Form Fields',
                        icon: '📝',
                        description: 'Fields detected from document analysis',
                        priority: 1,
                        required: true,
                        estimatedTime: '15 minutes',
                        items: smartTodos,
                        completed: 0,
                        total: smartTodos.length,
                        progress: 0
                    }
                ],
                summary: {
                    totalItems: smartTodos.length,
                    completedItems: 0,
                    progress: 0,
                    estimatedTotalTime: '15 minutes',
                    requiredItems: smartTodos.length,
                    optionalItems: 0
                }
            };
        }

        // Final fallback if extraction fails
        console.log('Using basic fallback todo');
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
     * Generate fallback form structure when JSON parsing fails
     * @param {string} response - LLM response text
     * @returns {Object} Fallback form structure
     */
    generateFallbackFormStructure(response) {
        console.log('Extracting form fields from malformed LLM response...');
        
        // Extract field information from the response text
        const fields = [];
        const fieldPatterns = [
            /"name":\s*"([^"]+)"/g,
            /"id":\s*"field_\d+",\s*"name":\s*"([^"]+)"/g,
            /Fill\s+([A-Z][a-z\s]+)/g,
            /Enter\s+([A-Z][a-z\s]+)/g,
            /Provide\s+([A-Z][a-z\s]+)/g
        ];
        
        const foundFields = new Set();
        
        fieldPatterns.forEach(pattern => {
            let match;
            while ((match = pattern.exec(response)) !== null) {
                const fieldName = match[1].trim();
                if (fieldName.length > 2 && fieldName.length < 50) {
                    foundFields.add(fieldName);
                }
            }
        });
        
        // Create field objects
        Array.from(foundFields).forEach((fieldName, index) => {
            fields.push({
                id: `field_${index + 1}`,
                name: fieldName,
                type: this.inferFieldType(fieldName),
                section: 'section_1',
                required: true,
                confidence: 0.8,
                position: { page: 1, approximate_location: 'unknown' }
            });
        });
        
        // If no fields found, create generic ones
        if (fields.length === 0) {
            fields.push({
                id: 'field_1',
                name: 'Form Field',
                type: 'text',
                section: 'section_1',
                required: true,
                confidence: 0.5,
                position: { page: 1, approximate_location: 'unknown' }
            });
        }
        
        console.log(`✅ Extracted ${fields.length} fields from malformed response`);
        
        return {
            sections: [
                {
                    id: 'section_1',
                    title: 'Form Fields',
                    description: 'Fields detected from document analysis',
                    priority: 1,
                    required: true,
                    fields: fields.map(f => f.id)
                }
            ],
            fields: fields,
            metadata: {
                form_type: 'extracted',
                estimated_completion_time: '10 minutes',
                complexity: 'medium',
                extraction_method: 'text_parsing'
            }
        };
    }

    /**
     * Infer field type from field name
     * @param {string} fieldName - Field name
     * @returns {string} Inferred field type
     */
    inferFieldType(fieldName) {
        const name = fieldName.toLowerCase();
        if (name.includes('email')) return 'email';
        if (name.includes('phone') || name.includes('tel')) return 'phone';
        if (name.includes('date') || name.includes('birth')) return 'date';
        if (name.includes('address')) return 'address';
        if (name.includes('name')) return 'text';
        if (name.includes('signature')) return 'signature';
        return 'text';
    }

    /**
     * Extract todo items from LLM response text when JSON parsing fails
     * @param {string} text - LLM response text
     * @returns {Array} Array of todo items
     */
    extractTodosFromText(text) {
        const todos = [];
        
        // Look for field names in the response
        const fieldPatterns = [
            /"name":\s*"([^"]+)"/g,
            /"title":\s*"([^"]+)"/g,
            /Fill\s+([A-Z][a-z\s]+)/g,
            /Enter\s+([A-Z][a-z\s]+)/g,
            /Provide\s+([A-Z][a-z\s]+)/g
        ];
        
        const foundFields = new Set();
        
        fieldPatterns.forEach(pattern => {
            let match;
            while ((match = pattern.exec(text)) !== null) {
                const fieldName = match[1].trim();
                if (fieldName.length > 2 && fieldName.length < 50) {
                    foundFields.add(fieldName);
                }
            }
        });
        
        // Convert to todo items with meaningful titles
        Array.from(foundFields).forEach((fieldName, index) => {
            const cleanTitle = this.generateMeaningfulTitle(fieldName);
            const cleanDescription = this.generateMeaningfulDescription(fieldName);
            
            todos.push({
                id: `extracted_todo_${index + 1}`,
                title: cleanTitle,
                description: cleanDescription,
                status: 'pending',
                priority: 'medium',
                required: true,
                estimatedTime: '1 minute',
                fieldIds: [],
                tips: [this.generateHelpfulTip(fieldName)],
                completionAnimation: 'checkmark'
            });
        });
        
        return todos;
    }

    /**
     * Generate meaningful title from field name
     * @param {string} fieldName - Raw field name
     * @returns {string} Clean, meaningful title
     */
    generateMeaningfulTitle(fieldName) {
        // Remove "Fill" prefix and clean up
        let title = fieldName.replace(/^fill\s+/i, '').trim();
        
        // Handle common field patterns
        const titleMappings = {
            'full name': 'Full Name',
            'first name': 'First Name', 
            'last name': 'Last Name',
            'middle name': 'Middle Name',
            'social insurance number': 'Social Insurance Number',
            'sin': 'Social Insurance Number',
            'address': 'Mailing Address',
            'street address': 'Street Address',
            'postal code': 'Postal Code',
            'zip code': 'Postal Code',
            'phone number': 'Phone Number',
            'telephone': 'Phone Number',
            'email address': 'Email Address',
            'email': 'Email Address',
            'date of birth': 'Date of Birth',
            'birth date': 'Date of Birth',
            'signature': 'Signature',
            'basic personal amount': 'Basic Personal Amount',
            'spouse income': 'Spouse Income',
            'employment income': 'Employment Income',
            'net income': 'Net Income'
        };
        
        // Check for exact matches
        const lowerTitle = title.toLowerCase();
        if (titleMappings[lowerTitle]) {
            return titleMappings[lowerTitle];
        }
        
        // Clean up and capitalize properly
        title = title
            .replace(/\b\w/g, l => l.toUpperCase()) // Capitalize first letter of each word
            .replace(/\s+/g, ' ') // Normalize spaces
            .trim();
            
        return title;
    }

    /**
     * Generate meaningful description from field name
     * @param {string} fieldName - Raw field name
     * @returns {string} Helpful description
     */
    generateMeaningfulDescription(fieldName) {
        const lowerName = fieldName.toLowerCase();
        
        if (lowerName.includes('name')) {
            return 'Enter your legal name as it appears on official documents';
        }
        if (lowerName.includes('social insurance') || lowerName.includes('sin')) {
            return 'Provide your 9-digit Social Insurance Number';
        }
        if (lowerName.includes('address')) {
            return 'Enter your complete mailing address';
        }
        if (lowerName.includes('postal') || lowerName.includes('zip')) {
            return 'Enter your postal code (e.g., K1A 0A6)';
        }
        if (lowerName.includes('phone') || lowerName.includes('telephone')) {
            return 'Provide your contact phone number';
        }
        if (lowerName.includes('email')) {
            return 'Enter your email address for correspondence';
        }
        if (lowerName.includes('date') || lowerName.includes('birth')) {
            return 'Select or enter the date (YYYY-MM-DD format)';
        }
        if (lowerName.includes('signature')) {
            return 'Sign the document electronically or by hand';
        }
        if (lowerName.includes('income') || lowerName.includes('amount')) {
            return 'Enter the monetary amount (numbers only)';
        }
        
        // Generic description
        const cleanName = fieldName.replace(/^fill\s+/i, '').toLowerCase();
        return `Complete the ${cleanName} field with accurate information`;
    }

    /**
     * Generate helpful tip for field
     * @param {string} fieldName - Raw field name
     * @returns {string} Helpful tip
     */
    generateHelpfulTip(fieldName) {
        const lowerName = fieldName.toLowerCase();
        
        if (lowerName.includes('name')) {
            return 'Use your legal name exactly as shown on ID';
        }
        if (lowerName.includes('social insurance') || lowerName.includes('sin')) {
            return 'Format: 123-456-789 (no spaces or dashes required)';
        }
        if (lowerName.includes('postal')) {
            return 'Canadian format: A1A 1A1';
        }
        if (lowerName.includes('phone')) {
            return 'Include area code: (123) 456-7890';
        }
        if (lowerName.includes('email')) {
            return 'Use a valid email you check regularly';
        }
        if (lowerName.includes('date')) {
            return 'Use YYYY-MM-DD format or date picker';
        }
        if (lowerName.includes('income') || lowerName.includes('amount')) {
            return 'Enter numbers only, no dollar signs or commas';
        }
        
        return 'Double-check your entry for accuracy';
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
