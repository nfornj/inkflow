/**
 * Llama Provider - Ollama Integration
 * Wraps existing Llama 3.2 functionality in the provider pattern
 */

const BaseLLMProvider = require('./base-provider');

class LlamaProvider extends BaseLLMProvider {
    constructor(config = {}) {
        super(config);
        this.modelName = config.modelName || 'llama3.2:latest';
        this.ollamaUrl = config.ollamaUrl || 'http://127.0.0.1:11434';
        this.maxTokens = config.maxTokens || 1500;
        this.temperature = config.temperature || 0.1;
        this.fetch = null; // Will be initialized dynamically
    }

    /**
     * Get provider ID
     */
    getId() {
        return 'llama';
    }

    /**
     * Get display name
     */
    getDisplayName() {
        return 'Llama 3.2 (Ollama)';
    }

    /**
     * Get description
     */
    getDescription() {
        return 'Meta\'s Llama 3.2 model via Ollama - Excellent for text analysis and form understanding';
    }

    /**
     * Get capabilities
     */
    getCapabilities() {
        return ['text_analysis', 'form_detection', 'json_generation', 'multilingual'];
    }

    /**
     * Initialize the provider
     */
    async initialize() {
        try {
            console.log('🦙 Initializing Llama provider...');
            
            // Initialize fetch dynamically (ESM compatibility)
            if (!this.fetch) {
                const fetchModule = await import('node-fetch');
                this.fetch = fetchModule.default;
                console.log('✅ Llama: node-fetch initialized successfully');
            }

            // Check if Ollama is running
            const isAvailable = await this.checkAvailability();
            if (!isAvailable) {
                throw new Error('Ollama service is not available');
            }

            // Load the model
            await this.loadModel();
            
            this.isInitialized = true;
            console.log('✅ Llama provider initialized successfully');
            return true;
        } catch (error) {
            console.error('❌ Failed to initialize Llama provider:', error);
            this.isInitialized = false;
            throw error;
        }
    }

    /**
     * Check if Ollama is available
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
                const hasModel = data.models?.some(model => model.name === this.modelName);
                console.log(`🦙 Llama availability check: Ollama running, Model ${this.modelName}: ${hasModel ? 'available' : 'not found'}`);
                return hasModel;
            }
            return false;
        } catch (error) {
            console.log('🦙 Llama availability check: Ollama not available');
            return false;
        }
    }

    /**
     * Load the Llama model
     */
    async loadModel() {
        try {
            console.log(`🦙 Loading Ollama model: ${this.modelName}`);
            
            const response = await this.fetch(`${this.ollamaUrl}/api/generate`, {
                method: 'POST',
                headers: {
                    'Content-Type': 'application/json',
                },
                body: JSON.stringify({
                    model: this.modelName,
                    prompt: 'Hello',
                    stream: false,
                    options: {
                        num_predict: 1
                    }
                }),
                timeout: 30000
            });

            if (!response.ok) {
                throw new Error(`HTTP ${response.status}: ${response.statusText}`);
            }

            console.log(`✅ Ollama model loaded successfully: ${this.modelName}`);
            return true;
        } catch (error) {
            console.error('❌ Failed to load Ollama model:', error);
            throw error;
        }
    }

    /**
     * Call the LLM
     */
    async callLLM(prompt, options = {}) {
        if (!this.isInitialized) {
            throw new Error('Llama provider not initialized');
        }

        const requestOptions = {
            model: this.modelName,
            prompt: prompt,
            stream: false,
            options: {
                temperature: options.temperature || this.temperature,
                num_predict: options.maxTokens || this.maxTokens,
                top_p: options.topP || 0.9,
                repeat_penalty: 1.1
            }
        };

        try {
            console.log(`🦙 Calling Llama model: ${this.modelName}`);
            
            const response = await this.fetch(`${this.ollamaUrl}/api/generate`, {
                method: 'POST',
                headers: {
                    'Content-Type': 'application/json',
                },
                body: JSON.stringify(requestOptions),
                timeout: options.timeout || 120000 // 2 minute timeout
            });

            if (!response.ok) {
                throw new Error(`HTTP ${response.status}: ${response.statusText}`);
            }

            const data = await response.json();
            
            if (!data.response) {
                throw new Error('No response from Llama model');
            }

            console.log(`✅ Llama response received (${data.response.length} chars)`);
            return data.response;
        } catch (error) {
            console.error('❌ Llama API call failed:', error);
            throw error;
        }
    }

    /**
     * Get model information
     */
    getModelInfo() {
        return {
            ...super.getModelInfo(),
            modelName: this.modelName,
            ollamaUrl: this.ollamaUrl,
            parameters: {
                maxTokens: this.maxTokens,
                temperature: this.temperature
            },
            strengths: [
                'Excellent text understanding',
                'Fast response times',
                'Good JSON generation',
                'Multilingual support'
            ],
            bestFor: [
                'Form field detection',
                'Text analysis',
                'Structured data extraction'
            ]
        };
    }

    /**
     * Cleanup resources
     */
    async cleanup() {
        console.log('🧹 Cleaning up Llama provider...');
        await super.cleanup();
    }
}

module.exports = LlamaProvider;
