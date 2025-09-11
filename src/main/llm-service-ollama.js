/**
 * LLM Service - Core LLM inference engine for autofill suggestions
 * Phase 2 Implementation - Using Ollama for inference
 */

// Dynamic import for node-fetch (ES module)
let fetch;

class LLMService {
  constructor() {
    this.modelName = null;
    this.isLoaded = false;
    this.ollamaUrl = 'http://127.0.0.1:11434';
    this.performanceMetrics = {
      totalInferences: 0,
      averageLatency: 0,
      lastInferenceTime: 0,
      memoryUsage: 0
    };
    this.config = {
      temperature: 0.1,
      topP: 0.9,
      maxTokens: 1500,  // Increased for complete JSON responses
      contextLength: 4096
    };
    this.fetchInitialized = false;
  }

  /**
   * Initialize the fetch module (dynamic import for ES module compatibility)
   */
  async initializeFetch() {
    if (!this.fetchInitialized) {
      try {
        const fetchModule = await import('node-fetch');
        fetch = fetchModule.default;
        this.fetchInitialized = true;
        console.log('LLMService: node-fetch initialized successfully');
      } catch (error) {
        console.error('LLMService: Failed to initialize node-fetch:', error);
        throw new Error(`Failed to initialize fetch: ${error.message}`);
      }
    }
  }

  /**
   * Load a model in Ollama
   * @param {string} modelName - Name of the model to load (e.g., "llama3.2:latest")
   * @param {number} gpuLayers - Number of layers to offload to GPU (ignored for Ollama)
   * @returns {Promise<boolean>} - Success status
   */
  async loadModel(modelName, gpuLayers = 0) {
    try {
      console.log(`Loading Ollama model: ${modelName}`);
      
      // Check if Ollama is running
      const isRunning = await this.checkOllamaStatus();
      if (!isRunning) {
        throw new Error('Ollama service is not running');
      }

      // Check if model is available
      const isAvailable = await this.checkModelAvailability(modelName);
      if (!isAvailable) {
        throw new Error(`Model ${modelName} is not available in Ollama`);
      }

      this.modelName = modelName;
      this.isLoaded = true;
      
      console.log(`Ollama model loaded successfully: ${modelName}`);
      return true;
    } catch (error) {
      console.error(`Failed to load Ollama model: ${error.message}`);
      throw error;
    }
  }

  /**
   * Unload the current model from memory
   * @returns {Promise<boolean>} - Success status
   */
  async unloadModel() {
    try {
      this.modelName = null;
      this.isLoaded = false;
      console.log('Ollama model unloaded successfully');
      return true;
    } catch (error) {
      console.error('Failed to unload Ollama model:', error);
      return false;
    }
  }

  /**
   * Generate autofill suggestion based on context
   * @param {Object} context - Context object with user profile and field info
   * @returns {Promise<Object>} - Suggestion result
   */
  async generateSuggestion(context) {
    if (!this.isLoaded) {
      throw new Error('LLM model not loaded');
    }

    const startTime = Date.now();

    try {
      // Construct the prompt for autofill
      const prompt = this.constructAutofillPrompt(context);
      
      // Generate response using Ollama
      const response = await this.callOllama(prompt);

      const latency = Date.now() - startTime;
      this.logLatency('generateSuggestion', latency);
      
      return {
        success: true,
        suggestion: response,
        latency: latency,
        timestamp: new Date().toISOString()
      };

    } catch (error) {
      console.error('Error generating suggestion:', error);
      return {
        success: false,
        error: error.message,
        latency: Date.now() - startTime
      };
    }
  }

  /**
   * Check if model is loaded and ready
   * @returns {boolean} - Ready status
   */
  isReady() {
    return this.isLoaded && this.modelName;
  }

  /**
   * Get model information
   * @returns {Object} - Model info
   */
  getModelInfo() {
    if (!this.isLoaded) {
      return { error: 'Model not loaded' };
    }

    return {
      modelName: this.modelName,
      isLoaded: this.isLoaded,
      config: this.config,
      performance: this.performanceMetrics
    };
  }

  /**
   * Get current performance metrics
   * @returns {Object} - Performance metrics
   */
  getPerformanceMetrics() {
    return {
      ...this.performanceMetrics,
      isLoaded: this.isLoaded,
      modelName: this.modelName
    };
  }

  /**
   * Check if Ollama service is running
   * @returns {Promise<boolean>} - Service status
   */
  async checkOllamaStatus() {
    try {
      // Ensure fetch is initialized
      await this.initializeFetch();
      
      const response = await fetch(`${this.ollamaUrl}/api/tags`, {
        method: 'GET',
        timeout: 5000
      });
      return response.ok;
    } catch (error) {
      console.error('Ollama status check failed:', error);
      return false;
    }
  }

  /**
   * Check if a specific model is available in Ollama
   * @param {string} modelName - Model name to check
   * @returns {Promise<boolean>} - Model availability
   */
  async checkModelAvailability(modelName) {
    try {
      // Ensure fetch is initialized
      await this.initializeFetch();
      
      const response = await fetch(`${this.ollamaUrl}/api/tags`, {
        method: 'GET',
        timeout: 5000
      });
      
      if (!response.ok) {
        return false;
      }

      const data = await response.json();
      const models = data.models || [];
      
      return models.some(model => 
        model.name === modelName || 
        model.name.startsWith(modelName + ':')
      );
    } catch (error) {
      console.error('Model availability check failed:', error);
      return false;
    }
  }

  /**
   * Call Ollama API for text generation
   * @param {string} prompt - Input prompt
   * @returns {Promise<string>} - Generated response
   */
  async callOllama(prompt) {
    try {
      // Ensure fetch is initialized
      await this.initializeFetch();
      
      const response = await fetch(`${this.ollamaUrl}/api/generate`, {
        method: 'POST',
        headers: {
          'Content-Type': 'application/json'
        },
        body: JSON.stringify({
          model: this.modelName,
          prompt: prompt,
          stream: false,
          options: {
            temperature: this.config.temperature,
            top_p: this.config.topP,
            num_predict: this.config.maxTokens
          }
        }),
        timeout: 30000
      });

      if (!response.ok) {
        throw new Error(`Ollama API error: ${response.status} - ${response.statusText}`);
      }

      const data = await response.json();
      return data.response || '';
    } catch (error) {
      console.error('Ollama API call failed:', error);
      throw error;
    }
  }

  /**
   * Construct autofill prompt from context
   * @param {Object} context - Context object
   * @returns {string} - Formatted prompt
   */
  constructAutofillPrompt(context) {
    const { user_profile, system_context, autofill_context } = context;
    
    let prompt = `You are an intelligent autofill assistant. Based on the user's profile and context, suggest appropriate values for form fields.

User Profile:
- Name: ${user_profile.name || 'Not provided'}
- Email: ${user_profile.email || 'Not provided'}
- Phone: ${user_profile.phone || 'Not provided'}
- Address: ${user_profile.address ? JSON.stringify(user_profile.address) : 'Not provided'}
- Company: ${user_profile.company || 'Not provided'}

System Context:
- Locale: ${system_context.locale || 'en-US'}
- Country: ${system_context.country || 'US'}
- Current Date: ${system_context.current_date || new Date().toISOString().split('T')[0]}

Field Context:
- Field Type: ${autofill_context.field_type || 'text'}
- Field Name: ${autofill_context.field_name || 'Unknown'}
- Field Importance: ${autofill_context.field_importance || 'medium'}
- Required: ${autofill_context.required || false}

Please provide a JSON response with the following format:
{
  "success": true,
  "suggestion": "suggested_value",
  "confidence": 0.95,
  "source": "profile|related_field|fallback|llm",
  "reasoning": "Brief explanation of why this suggestion was made"
}

If no good suggestion can be made, return:
{
  "success": false,
  "suggestion": null,
  "reasoning": "Explanation of why no suggestion could be made"
}`;

    return prompt;
  }

  /**
   * Log inference latency for performance monitoring
   * @param {string} operation - Operation name
   * @param {number} duration - Duration in milliseconds
   */
  logLatency(operation, duration) {
    this.performanceMetrics.totalInferences++;
    this.performanceMetrics.lastInferenceTime = duration;
    
    // Calculate running average
    const total = this.performanceMetrics.averageLatency * (this.performanceMetrics.totalInferences - 1) + duration;
    this.performanceMetrics.averageLatency = total / this.performanceMetrics.totalInferences;
    
    console.log(`${operation} completed in ${duration}ms (avg: ${Math.round(this.performanceMetrics.averageLatency)}ms)`);
  }
}

module.exports = LLMService;

