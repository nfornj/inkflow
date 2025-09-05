/**
 * LLM Service - Core LLM inference engine for autofill suggestions
 * Phase 2 Implementation - Using Ollama for inference
 */

const https = require('https');
const http = require('http');

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
      maxTokens: 100,
      contextLength: 4096
    };
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
    return new Promise((resolve) => {
      const url = new URL(`${this.ollamaUrl}/api/tags`);
      const options = {
        hostname: url.hostname,
        port: url.port || 80,
        path: url.pathname,
        method: 'GET',
        timeout: 5000
      };

      const req = http.request(options, (res) => {
        resolve(res.statusCode === 200);
      });

      req.on('error', (error) => {
        console.error('Ollama status check failed:', error);
        resolve(false);
      });

      req.on('timeout', () => {
        req.destroy();
        resolve(false);
      });

      req.end();
    });
  }

  /**
   * Check if a specific model is available in Ollama
   * @param {string} modelName - Model name to check
   * @returns {Promise<boolean>} - Model availability
   */
  async checkModelAvailability(modelName) {
    return new Promise((resolve) => {
      const url = new URL(`${this.ollamaUrl}/api/tags`);
      const options = {
        hostname: url.hostname,
        port: url.port || 80,
        path: url.pathname,
        method: 'GET',
        timeout: 5000
      };

      const req = http.request(options, (res) => {
        let data = '';
        res.on('data', (chunk) => {
          data += chunk;
        });
        res.on('end', () => {
          try {
            const jsonData = JSON.parse(data);
            const models = jsonData.models || [];
            const isAvailable = models.some(model => 
              model.name === modelName || 
              model.name.startsWith(modelName + ':')
            );
            resolve(isAvailable);
          } catch (error) {
            console.error('Model availability check failed:', error);
            resolve(false);
          }
        });
      });

      req.on('error', (error) => {
        console.error('Model availability check failed:', error);
        resolve(false);
      });

      req.on('timeout', () => {
        req.destroy();
        resolve(false);
      });

      req.end();
    });
  }

  /**
   * Call Ollama API for text generation
   * @param {string} prompt - Input prompt
   * @returns {Promise<string>} - Generated response
   */
  async callOllama(prompt) {
    return new Promise((resolve, reject) => {
      const url = new URL(`${this.ollamaUrl}/api/generate`);
      const postData = JSON.stringify({
        model: this.modelName,
        prompt: prompt,
        stream: false,
        options: {
          temperature: this.config.temperature,
          top_p: this.config.topP,
          num_predict: this.config.maxTokens
        }
      });

      const options = {
        hostname: url.hostname,
        port: url.port || 80,
        path: url.pathname,
        method: 'POST',
        headers: {
          'Content-Type': 'application/json',
          'Content-Length': Buffer.byteLength(postData)
        },
        timeout: 30000
      };

      const req = http.request(options, (res) => {
        let data = '';
        res.on('data', (chunk) => {
          data += chunk;
        });
        res.on('end', () => {
          try {
            const jsonData = JSON.parse(data);
            resolve(jsonData.response || '');
          } catch (error) {
            console.error('Ollama API call failed:', error);
            reject(error);
          }
        });
      });

      req.on('error', (error) => {
        console.error('Ollama API call failed:', error);
        reject(error);
      });

      req.on('timeout', () => {
        req.destroy();
        reject(new Error('Ollama API call timeout'));
      });

      req.write(postData);
      req.end();
    });
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
