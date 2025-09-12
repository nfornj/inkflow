/**
 * MiniCPM-V Provider - Vision-Language Model
 * Specialized for OCR and visual form understanding
 */

const BaseLLMProvider = require('./base-provider');

class MiniCPMProvider extends BaseLLMProvider {
    constructor(config = {}) {
        super(config);
        this.modelName = config.modelName || 'minicpm-v:latest';
        this.ollamaUrl = config.ollamaUrl || 'http://127.0.0.1:11434';
        this.maxTokens = config.maxTokens || 2000;
        this.temperature = config.temperature || 0.1;
        this.visionMode = config.visionMode !== false; // Default to true
        this.imageResolution = config.imageResolution || 'high';
        this.fetch = null; // Will be initialized dynamically
    }

    /**
     * Get provider ID
     */
    getId() {
        return 'minicpm';
    }

    /**
     * Get display name
     */
    getDisplayName() {
        return 'MiniCPM-V 2.6 (Vision)';
    }

    /**
     * Get description
     */
    getDescription() {
        return 'MiniCPM-V 2.6 Vision-Language Model - Specialized for OCR, visual understanding, and form analysis';
    }

    /**
     * Get capabilities
     */
    getCapabilities() {
        return ['text_analysis', 'vision_analysis', 'ocr', 'form_detection', 'image_understanding', 'json_generation'];
    }

    /**
     * Initialize the provider
     */
    async initialize() {
        try {
            console.log('👁️ Initializing MiniCPM-V provider...');
            
            // Initialize fetch dynamically (ESM compatibility)
            if (!this.fetch) {
                const fetchModule = await import('node-fetch');
                this.fetch = fetchModule.default;
                console.log('✅ MiniCPM-V: node-fetch initialized successfully');
            }

            // Check if Ollama is running and model is available
            const isAvailable = await this.checkAvailability();
            if (!isAvailable) {
                console.log('⚠️ MiniCPM-V model not found, attempting to pull...');
                await this.pullModel();
            }

            // Load the model
            await this.loadModel();
            
            this.isInitialized = true;
            console.log('✅ MiniCPM-V provider initialized successfully');
            return true;
        } catch (error) {
            console.error('❌ Failed to initialize MiniCPM-V provider:', error);
            this.isInitialized = false;
            throw error;
        }
    }

    /**
     * Check if MiniCPM-V is available
     */
    async checkAvailability() {
        try {
            if (!this.fetch) {
                const fetchModule = await import('node-fetch');
                this.fetch = fetchModule.default;
            }

            const response = await this.fetch(`${this.ollamaUrl}/api/tags`, {
                method: 'GET',
                timeout: 5000
            });

            if (response.ok) {
                const data = await response.json();
                const hasModel = data.models?.some(model => 
                    model.name === this.modelName || 
                    model.name.startsWith('minicpm-v')
                );
                console.log(`👁️ MiniCPM-V availability check: Ollama running, Model ${this.modelName}: ${hasModel ? 'available' : 'not found'}`);
                return hasModel;
            }
            return false;
        } catch (error) {
            console.log('👁️ MiniCPM-V availability check: Ollama not available');
            return false;
        }
    }

    /**
     * Pull MiniCPM-V model from Ollama registry
     */
    async pullModel() {
        try {
            console.log(`👁️ Pulling MiniCPM-V model: ${this.modelName}`);
            console.log('⚠️ This may take several minutes for first-time setup...');
            
            const response = await this.fetch(`${this.ollamaUrl}/api/pull`, {
                method: 'POST',
                headers: {
                    'Content-Type': 'application/json',
                },
                body: JSON.stringify({
                    name: this.modelName
                }),
                timeout: 600000 // 10 minute timeout for model download
            });

            if (!response.ok) {
                throw new Error(`Failed to pull model: HTTP ${response.status}`);
            }

            console.log(`✅ MiniCPM-V model pulled successfully: ${this.modelName}`);
            return true;
        } catch (error) {
            console.error('❌ Failed to pull MiniCPM-V model:', error);
            throw error;
        }
    }

    /**
     * Load the MiniCPM-V model
     */
    async loadModel() {
        try {
            console.log(`👁️ Loading MiniCPM-V model: ${this.modelName}`);
            
            const response = await this.fetch(`${this.ollamaUrl}/api/generate`, {
                method: 'POST',
                headers: {
                    'Content-Type': 'application/json',
                },
                body: JSON.stringify({
                    model: this.modelName,
                    prompt: 'Hello, test initialization.',
                    stream: false,
                    options: {
                        num_predict: 1
                    }
                }),
                timeout: 60000
            });

            if (!response.ok) {
                throw new Error(`HTTP ${response.status}: ${response.statusText}`);
            }

            console.log(`✅ MiniCPM-V model loaded successfully: ${this.modelName}`);
            return true;
        } catch (error) {
            console.error('❌ Failed to load MiniCPM-V model:', error);
            throw error;
        }
    }

    /**
     * Call the LLM with text or vision input
     */
    async callLLM(prompt, options = {}) {
        if (!this.isInitialized) {
            throw new Error('MiniCPM-V provider not initialized');
        }

        // Force English responses for MiniCPM-V
        const englishPrompt = `Please respond in English only. ${prompt}`;
        
        const requestOptions = {
            model: this.modelName,
            prompt: englishPrompt,
            stream: false,
            options: {
                temperature: options.temperature || this.temperature,
                num_predict: options.maxTokens || this.maxTokens,
                top_p: options.topP || 0.9,
                repeat_penalty: 1.1
            }
        };

        // Add image if provided (for vision capabilities)
        if (options.images && Array.isArray(options.images)) {
            requestOptions.images = options.images;
            console.log(`👁️ MiniCPM-V: Processing ${options.images.length} image(s) with vision capabilities`);
        }

        try {
            console.log(`👁️ Calling MiniCPM-V model: ${this.modelName}`);
            
            const response = await this.fetch(`${this.ollamaUrl}/api/generate`, {
                method: 'POST',
                headers: {
                    'Content-Type': 'application/json',
                },
                body: JSON.stringify(requestOptions),
                timeout: options.timeout || 180000 // 3 minute timeout (vision models are slower)
            });

            if (!response.ok) {
                throw new Error(`HTTP ${response.status}: ${response.statusText}`);
            }

            const data = await response.json();
            
            if (!data.response) {
                throw new Error('No response from MiniCPM-V model');
            }

            console.log(`✅ MiniCPM-V response received (${data.response.length} chars)`);
            return data.response;
        } catch (error) {
            console.error('❌ MiniCPM-V API call failed:', error);
            throw error;
        }
    }

    /**
     * Analyze PDF pages with vision capabilities
     * @param {Array<string>} imageBase64Array - Array of base64 encoded images
     * @param {string} prompt - Analysis prompt
     * @param {Object} options - Additional options
     * @returns {Promise<string>} Analysis result
     */
    async analyzeImages(imageBase64Array, prompt, options = {}) {
        if (!this.visionMode) {
            throw new Error('Vision mode is disabled for this provider');
        }

        const visionPrompt = `Please respond in English only. ${prompt}

Please analyze the provided image(s) and extract all form fields, text content, and structural information. Focus on:
1. Text extraction (OCR)
2. Form field identification
3. Layout understanding
4. Field relationships

Provide a detailed analysis in the requested format. Respond only in English.`;

        return await this.callLLM(visionPrompt, {
            ...options,
            images: imageBase64Array,
            timeout: 240000 // 4 minute timeout for vision analysis
        });
    }

    /**
     * Get model information
     */
    getModelInfo() {
        return {
            ...super.getModelInfo(),
            modelName: this.modelName,
            ollamaUrl: this.ollamaUrl,
            visionMode: this.visionMode,
            parameters: {
                maxTokens: this.maxTokens,
                temperature: this.temperature,
                imageResolution: this.imageResolution
            },
            strengths: [
                'Advanced OCR capabilities',
                'Visual form understanding',
                'Layout analysis',
                'Multi-modal processing',
                'High accuracy text extraction'
            ],
            bestFor: [
                'Scanned documents',
                'Image-based forms',
                'Complex layouts',
                'OCR tasks',
                'Visual document analysis'
            ]
        };
    }

    /**
     * Convert PDF pages to images for vision analysis
     * @param {Uint8Array} pdfBytes - PDF file bytes
     * @returns {Promise<Array<string>>} Array of base64 encoded images
     */
    async convertPDFToImages(pdfBytes) {
        try {
            const pdf2pic = require('pdf2pic');
            const fs = require('fs');
            const path = require('path');
            const os = require('os');

            // Create temporary directory
            const tempDir = path.join(os.tmpdir(), `minicpm-pdf-${Date.now()}`);
            fs.mkdirSync(tempDir, { recursive: true });

            // Convert PDF to images
            const convert = pdf2pic.fromBuffer(pdfBytes, {
                density: this.imageResolution === 'high' ? 300 : 150,
                saveFilename: 'page',
                savePath: tempDir,
                format: 'png',
                width: 2000,
                height: 2000
            });

            const results = await convert.bulk(-1); // Convert all pages
            const imageBase64Array = [];

            // Convert images to base64
            for (const result of results) {
                if (result.path) {
                    const imageBuffer = fs.readFileSync(result.path);
                    const base64 = imageBuffer.toString('base64');
                    imageBase64Array.push(base64);
                }
            }

            // Cleanup temporary files
            fs.rmSync(tempDir, { recursive: true, force: true });

            console.log(`👁️ MiniCPM-V: Converted PDF to ${imageBase64Array.length} images`);
            return imageBase64Array;
        } catch (error) {
            console.error('❌ Failed to convert PDF to images:', error);
            throw error;
        }
    }

    /**
     * Cleanup resources
     */
    async cleanup() {
        console.log('🧹 Cleaning up MiniCPM-V provider...');
        await super.cleanup();
    }
}

module.exports = MiniCPMProvider;
