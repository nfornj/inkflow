/**
 * Qwen2.5-VL Provider - Multimodal vision-language model for OCR
 * Specialized provider for multimodal tasks including OCR, vision, and form detection
 */

const BaseLLMProvider = require('./base-provider');
const fetch = require('node-fetch').default || require('node-fetch');
const fs = require('fs').promises;

class QwenVLProvider extends BaseLLMProvider {
    constructor(config = {}) {
        super(config);
        this.modelName = config.modelName || 'qwen2.5vl:latest';
        this.apiUrl = config.apiUrl || 'http://127.0.0.1:11434';
        this.maxRetries = config.maxRetries || 3;
        this.timeout = config.timeout || 120000; // 2 minutes for vision tasks
        this.supportsVision = true;
        this.supportsMultimodal = true;
    }

    /**
     * Initialize the Qwen2.5-VL provider
     * @returns {Promise<boolean>} Success status
     */
    async initialize() {
        try {
            console.log('QwenVLProvider: Initializing...');
            
            // Check if Ollama is running
            const healthCheck = await fetch(`${this.apiUrl}/api/tags`, { 
                timeout: 5000 
            });
            
            if (!healthCheck.ok) {
                throw new Error(`Ollama not available: ${healthCheck.status}`);
            }
            
            // Check if model is available
            const models = await healthCheck.json();
            const modelAvailable = models.models?.some(m => 
                m.name.includes('qwen2.5-vl') || m.name.includes('qwen')
            );
            
            if (!modelAvailable) {
                console.log('QwenVLProvider: Model not found, attempting to pull...');
                await this.pullModel();
            }
            
            // Test model with a simple request
            const testResponse = await this.testModel();
            if (!testResponse) {
                throw new Error('Model test failed');
            }
            
            this.isInitialized = true;
            this.modelInfo = {
                name: this.modelName,
                type: 'multimodal',
                capabilities: ['vision', 'ocr', 'text_generation', 'form_detection'],
                contextLength: 32768
            };
            
            console.log('QwenVLProvider: Initialized successfully');
            return true;
            
        } catch (error) {
            console.error('QwenVLProvider: Initialization failed:', error);
            this.isInitialized = false;
            return false;
        }
    }

    /**
     * Pull the Qwen2.5-VL model if not available
     */
    async pullModel() {
        try {
            console.log('QwenVLProvider: Pulling model...');
            
            const response = await fetch(`${this.apiUrl}/api/pull`, {
                method: 'POST',
                headers: { 'Content-Type': 'application/json' },
                body: JSON.stringify({ name: this.modelName })
            });
            
            if (!response.ok) {
                throw new Error(`Failed to pull model: ${response.status}`);
            }
            
            console.log('QwenVLProvider: Model pulled successfully');
            
        } catch (error) {
            console.error('QwenVLProvider: Failed to pull model:', error);
            throw error;
        }
    }

    /**
     * Test the model with a simple request
     */
    async testModel() {
        try {
            const response = await fetch(`${this.apiUrl}/api/generate`, {
                method: 'POST',
                headers: { 'Content-Type': 'application/json' },
                body: JSON.stringify({
                    model: this.modelName,
                    prompt: 'Hello, can you see this?',
                    stream: false
                }),
                timeout: 30000
            });
            
            if (!response.ok) {
                return false;
            }
            
            const result = await response.json();
            return result && result.response;
            
        } catch (error) {
            console.error('QwenVLProvider: Model test failed:', error);
            return false;
        }
    }

    /**
     * Check if the provider is available
     * @returns {Promise<boolean>} Availability status
     */
    async isAvailable() {
        if (!this.isInitialized) {
            return false;
        }
        
        try {
            const response = await fetch(`${this.apiUrl}/api/tags`, { 
                timeout: 5000 
            });
            return response.ok;
        } catch {
            return false;
        }
    }

    /**
     * Process an image with OCR capabilities
     * @param {Buffer|string} imageData - Image buffer or base64 string
     * @param {string} prompt - Processing prompt
     * @param {Object} options - Processing options
     * @returns {Promise<Object>} OCR results
     */
    async processImage(imageData, prompt, options = {}) {
        const startTime = Date.now();
        
        try {
            this.performanceStats.totalRequests++;
            
            // Convert image to base64 if needed
            let base64Image;
            if (Buffer.isBuffer(imageData)) {
                base64Image = imageData.toString('base64');
            } else if (typeof imageData === 'string') {
                // Assume it's already base64
                base64Image = imageData.replace(/^data:image\/[a-z]+;base64,/, '');
            } else {
                throw new Error('Invalid image data format');
            }

            const requestPayload = {
                model: this.modelName,
                prompt: prompt,
                images: [base64Image],
                stream: false,
                options: {
                    temperature: options.temperature || 0.1,
                    top_p: options.top_p || 0.9,
                    ...options
                }
            };

            const response = await fetch(`${this.apiUrl}/api/generate`, {
                method: 'POST',
                headers: { 'Content-Type': 'application/json' },
                body: JSON.stringify(requestPayload),
                timeout: this.timeout
            });

            if (!response.ok) {
                throw new Error(`API request failed: ${response.status} ${response.statusText}`);
            }

            const result = await response.json();
            
            if (!result || !result.response) {
                throw new Error('Invalid response from model');
            }

            // Update performance stats
            const responseTime = Date.now() - startTime;
            this.performanceStats.successfulRequests++;
            this.performanceStats.lastResponseTime = responseTime;
            this.performanceStats.averageResponseTime = 
                (this.performanceStats.averageResponseTime * (this.performanceStats.successfulRequests - 1) + responseTime) / 
                this.performanceStats.successfulRequests;

            return {
                success: true,
                text: result.response,
                processingTime: responseTime,
                model: this.modelName
            };

        } catch (error) {
            this.performanceStats.errorCount++;
            console.error('QwenVLProvider: Image processing failed:', error);
            
            return {
                success: false,
                error: error.message,
                processingTime: Date.now() - startTime
            };
        }
    }

    /**
     * Generate text completion
     * @param {string} prompt - Input prompt
     * @param {Object} options - Generation options
     * @returns {Promise<Object>} Generated text
     */
    async generateText(prompt, options = {}) {
        const startTime = Date.now();
        
        try {
            this.performanceStats.totalRequests++;

            const response = await fetch(`${this.apiUrl}/api/generate`, {
                method: 'POST',
                headers: { 'Content-Type': 'application/json' },
                body: JSON.stringify({
                    model: this.modelName,
                    prompt: prompt,
                    stream: false,
                    options: {
                        temperature: options.temperature || 0.3,
                        top_p: options.top_p || 0.9,
                        max_tokens: options.max_tokens || 2048,
                        ...options
                    }
                }),
                timeout: this.timeout
            });

            if (!response.ok) {
                throw new Error(`API request failed: ${response.status}`);
            }

            const result = await response.json();

            // Update performance stats
            const responseTime = Date.now() - startTime;
            this.performanceStats.successfulRequests++;
            this.performanceStats.lastResponseTime = responseTime;
            this.performanceStats.averageResponseTime = 
                (this.performanceStats.averageResponseTime * (this.performanceStats.successfulRequests - 1) + responseTime) / 
                this.performanceStats.successfulRequests;

            return {
                success: true,
                text: result.response,
                processingTime: responseTime,
                model: this.modelName
            };

        } catch (error) {
            this.performanceStats.errorCount++;
            console.error('QwenVLProvider: Text generation failed:', error);
            
            return {
                success: false,
                error: error.message,
                processingTime: Date.now() - startTime
            };
        }
    }

    /**
     * Specialized OCR processing for form fields
     * @param {Buffer|string} imageData - Image to process
     * @param {Object} options - OCR options
     * @returns {Promise<Object>} Structured OCR results
     */
    async extractFormFields(imageData, options = {}) {
        const ocrPrompt = `Please analyze this image and extract all visible text along with form field information. 

For each text element you find, provide:
1. The exact text content
2. Approximate coordinates (as percentages of image dimensions)  
3. Whether it appears to be a label, input field, checkbox, or other form element
4. Any relationships between labels and input fields

Format your response as JSON with this structure:
{
  "text_elements": [
    {
      "text": "exact text content",
      "x": percentage_x,
      "y": percentage_y, 
      "width": percentage_width,
      "height": percentage_height,
      "type": "label|input|checkbox|radio|select|button|text",
      "confidence": 0.0-1.0
    }
  ],
  "form_fields": [
    {
      "label": "field label if found",
      "type": "text|checkbox|radio|select|textarea",
      "x": percentage_x,
      "y": percentage_y,
      "width": percentage_width, 
      "height": percentage_height,
      "required": true|false
    }
  ]
}

Analyze the image carefully and provide accurate coordinates and text extraction.`;

        const result = await this.processImage(imageData, ocrPrompt, {
            temperature: 0.1,
            ...options
        });

        if (!result.success) {
            return result;
        }

        try {
            // Try to parse JSON response
            const jsonMatch = result.text.match(/\{[\s\S]*\}/);
            if (jsonMatch) {
                const parsedData = JSON.parse(jsonMatch[0]);
                return {
                    success: true,
                    data: parsedData,
                    rawText: result.text,
                    processingTime: result.processingTime,
                    model: result.model
                };
            } else {
                // Fallback to raw text if JSON parsing fails
                return {
                    success: true,
                    data: {
                        text_elements: [],
                        form_fields: [],
                        raw_text: result.text
                    },
                    rawText: result.text,
                    processingTime: result.processingTime,
                    model: result.model
                };
            }
        } catch (parseError) {
            console.error('QwenVLProvider: Failed to parse JSON response:', parseError);
            return {
                success: true,
                data: {
                    text_elements: [],
                    form_fields: [],
                    raw_text: result.text
                },
                rawText: result.text,
                processingTime: result.processingTime,
                model: result.model
            };
        }
    }

    /**
     * Get provider information
     * @returns {Object} Provider info
     */
    getInfo() {
        return {
            name: 'QwenVL',
            version: '2.5',
            type: 'multimodal',
            capabilities: ['vision', 'ocr', 'text_generation', 'form_detection'],
            isInitialized: this.isInitialized,
            modelInfo: this.modelInfo,
            performanceStats: this.performanceStats
        };
    }
}

module.exports = QwenVLProvider;
