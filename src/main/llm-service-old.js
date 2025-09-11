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
      maxTokens: 100,
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
   * Load a GGUF model into memory
   * @param {string} modelPath - Path to the GGUF model file
   * @param {number} gpuLayers - Number of layers to offload to GPU
   * @returns {Promise<boolean>} - Success status
   */
  async loadModel(modelPath, gpuLayers = 0) {
    try {
      // Load node-llama-cpp first
      await this.loadLlamaCpp();
      
      console.log(`Loading LLM model: ${modelPath}`);
      console.log(`GPU layers: ${gpuLayers}`);

      // Check if model file exists
      if (!await fs.pathExists(modelPath)) {
        throw new Error(`Model file not found: ${modelPath}`);
      }

      // Get file size for memory estimation
      const stats = await fs.stat(modelPath);
      const fileSizeMB = Math.round(stats.size / (1024 * 1024));
      console.log(`Model file size: ${fileSizeMB}MB`);

      // Load model with configuration
      this.model = new LlamaModel({
        modelPath: modelPath,
        gpuLayers: gpuLayers,
        contextLength: this.config.contextLength,
        useMlock: true, // Lock model in memory for better performance
        useMmap: true   // Memory map for efficient loading
      });

      // Create context with optimized settings
      this.context = new LlamaContext({
        model: this.model,
        contextLength: this.config.contextLength,
        batchSize: 512, // Optimize for autofill tasks
        threads: this.getOptimalThreadCount()
      });

      // Create chat session with autofill-specific system prompt
      this.session = new LlamaChatSession({
        context: this.context,
        systemPrompt: this.getSystemPrompt()
      });

      this.isLoaded = true;
      this.config.gpuLayers = gpuLayers;
      this.performanceMetrics.memoryUsage = fileSizeMB;

      console.log('LLM model loaded successfully');
      console.log(`Memory usage: ${fileSizeMB}MB, GPU layers: ${gpuLayers}`);
      return true;

    } catch (error) {
      console.error('Failed to load LLM model:', error);
      this.isLoaded = false;
      return false;
    }
  }

  /**
   * Unload the current model from memory
   * @returns {Promise<boolean>} - Success status
   */
  async unloadModel() {
    try {
      if (this.session) {
        this.session.dispose();
        this.session = null;
      }
      if (this.context) {
        this.context.dispose();
        this.context = null;
      }
      if (this.model) {
        this.model.dispose();
        this.model = null;
      }

      this.isLoaded = false;
      console.log('LLM model unloaded successfully');
      return true;

    } catch (error) {
      console.error('Failed to unload LLM model:', error);
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

    // Ensure node-llama-cpp is loaded
    await this.loadLlamaCpp();

    const startTime = Date.now();

    try {
      // Construct the prompt for autofill
      const prompt = this.constructAutofillPrompt(context);
      
      // Generate response using the chat session
      const response = await this.session.prompt(prompt, {
        temperature: this.config.temperature,
        topP: this.config.topP,
        maxTokens: this.config.maxTokens,
        stopSequences: ['\n\n', 'User:', 'Assistant:']
      });

      // Parse the JSON response
      const result = this.parseAutofillResponse(response);
      
      const latency = Date.now() - startTime;
      this.logLatency('generateSuggestion', latency);
      
      return {
        ...result,
        latency: latency,
        timestamp: new Date().toISOString()
      };

    } catch (error) {
      console.error('Failed to generate suggestion:', error);
      
      // Fallback to simple heuristics if LLM fails
      const fallbackResult = this.generateFallbackSuggestion(context);
      const latency = Date.now() - startTime;
      this.logLatency('generateSuggestion_fallback', latency);
      
      return {
        ...fallbackResult,
        latency: latency,
        timestamp: new Date().toISOString(),
        fallback: true
      };
    }
  }

  /**
   * Get current performance metrics
   * @returns {Object} - Performance metrics
   */
  getPerformanceMetrics() {
    return {
      ...this.performanceMetrics,
      isLoaded: this.isLoaded,
      gpuLayers: this.config.gpuLayers,
      contextLength: this.config.contextLength
    };
  }

  /**
   * Log inference latency for performance monitoring
   * @param {string} operation - Operation name
   * @param {number} duration - Duration in milliseconds
   */
  logLatency(operation, duration) {
    this.performanceMetrics.totalInferences++;
    this.performanceMetrics.lastInferenceTime = duration;
    
    // Update average latency
    const total = this.performanceMetrics.averageLatency * (this.performanceMetrics.totalInferences - 1);
    this.performanceMetrics.averageLatency = (total + duration) / this.performanceMetrics.totalInferences;

    console.log(`LLM ${operation} completed in ${duration}ms`);
  }

  /**
   * Check if model is loaded and ready
   * @returns {boolean} - Ready status
   */
  isReady() {
    return this.isLoaded && this.llamaCppLoaded && this.model && this.context && this.session;
  }

  /**
   * Get model information
   * @returns {Object} - Model info
   */
  getModelInfo() {
    if (!this.isLoaded) {
      return null;
    }

    return {
      isLoaded: this.isLoaded,
      gpuLayers: this.config.gpuLayers,
      contextLength: this.config.contextLength,
      temperature: this.config.temperature,
      topP: this.config.topP,
      maxTokens: this.config.maxTokens
    };
  }

  /**
   * Construct autofill prompt from context
   * @param {Object} context - Context object
   * @returns {string} - Formatted prompt
   */
  constructAutofillPrompt(context) {
    const { user_profile, system_context, field_context } = context;
    
    const prompt = `User Profile: ${JSON.stringify(user_profile, null, 2)}
System Context: ${JSON.stringify(system_context, null, 2)}
Field Context: ${JSON.stringify(field_context, null, 2)}

Based on the user profile and field context, provide a JSON response with either:
- {"suggestion": "value"} if you can suggest a value
- {"question": "What is your [field]?"} if you need more information
- {"suggestion": null} if no suggestion is possible

Response:`;

    return prompt;
  }

  /**
   * Parse LLM response for autofill
   * @param {string} response - Raw LLM response
   * @returns {Object} - Parsed result
   */
  parseAutofillResponse(response) {
    try {
      // Try to extract JSON from response
      const jsonMatch = response.match(/\{[\s\S]*\}/);
      if (jsonMatch) {
        const parsed = JSON.parse(jsonMatch[0]);
        return {
          suggestion: parsed.suggestion || null,
          question: parsed.question || null
        };
      }
      
      // Fallback: try to parse the entire response as JSON
      const parsed = JSON.parse(response);
      return {
        suggestion: parsed.suggestion || null,
        question: parsed.question || null
      };
      
    } catch (error) {
      console.warn('Failed to parse LLM response as JSON:', error);
      
      // Fallback: return a question if response contains text
      if (response.trim().length > 0) {
        return {
          suggestion: null,
          question: `What is your ${this.inferFieldName(response)}?`
        };
      }
      
      return {
        suggestion: null,
        question: null
      };
    }
  }

  /**
   * Generate fallback suggestion using simple heuristics
   * @param {Object} context - Context object
   * @returns {Object} - Fallback result
   */
  generateFallbackSuggestion(context) {
    const { user_profile, field_context } = context;
    const fieldName = field_context?.field_name?.toLowerCase() || '';
    const fieldType = field_context?.field_type?.toLowerCase() || '';
    
    // Simple field matching
    if (fieldName.includes('name') || fieldType === 'name') {
      return {
        suggestion: user_profile.name || null,
        question: user_profile.name ? null : "What is your full name?"
      };
    }
    
    if (fieldName.includes('email') || fieldType === 'email') {
      return {
        suggestion: user_profile.email || null,
        question: user_profile.email ? null : "What is your email address?"
      };
    }
    
    if (fieldName.includes('phone') || fieldType === 'phone') {
      return {
        suggestion: user_profile.phone || null,
        question: user_profile.phone ? null : "What is your phone number?"
      };
    }
    
    if (fieldName.includes('city') || fieldType === 'city') {
      return {
        suggestion: user_profile.address?.city || null,
        question: user_profile.address?.city ? null : "What city do you live in?"
      };
    }
    
    if (fieldName.includes('province') || fieldType === 'province') {
      return {
        suggestion: user_profile.address?.province || null,
        question: user_profile.address?.province ? null : "What province do you live in?"
      };
    }
    
    if (fieldName.includes('postal') || fieldType === 'postal_code') {
      return {
        suggestion: user_profile.address?.postal_code || null,
        question: user_profile.address?.postal_code ? null : "What is your postal code?"
      };
    }
    
    if (fieldName.includes('country') || fieldType === 'country') {
      return {
        suggestion: user_profile.address?.country || 'Canada',
        question: null
      };
    }
    
    // Default fallback
    return {
      suggestion: null,
      question: `What is your ${fieldName || 'information'}?`
    };
  }

  /**
   * Get system prompt for autofill
   * @returns {string} - System prompt
   */
  getSystemPrompt() {
    return `You are a silent, efficient autofill assistant. Your task is to analyze the user's profile and system context to suggest the single most relevant value for the current form field. The user's locale is Canada (en-CA).

RULES:
- NEVER respond with conversational text
- If the field is a date field, and the user profile has no specific date, you may suggest the current date
- If you find a matching value, return JSON: {"suggestion": "your_suggested_value"}
- If you need more information, return JSON: {"question": "What is your [inferred_field_name]?"}
- If the context is un-fillable, return: {"suggestion": null}
- Always return valid JSON only
- Be precise and concise in suggestions
- Use Canadian formatting (e.g., postal codes, phone numbers)`;
  }

  /**
   * Get optimal thread count for current system
   * @returns {number} - Thread count
   */
  getOptimalThreadCount() {
    const cpuCount = require('os').cpus().length;
    // Use 75% of available cores, minimum 2, maximum 8
    return Math.max(2, Math.min(8, Math.floor(cpuCount * 0.75)));
  }

  /**
   * Infer field name from response text
   * @param {string} text - Response text
   * @returns {string} - Inferred field name
   */
  inferFieldName(text) {
    const lowerText = text.toLowerCase();
    
    if (lowerText.includes('name')) return 'name';
    if (lowerText.includes('email')) return 'email address';
    if (lowerText.includes('phone')) return 'phone number';
    if (lowerText.includes('address')) return 'address';
    if (lowerText.includes('city')) return 'city';
    if (lowerText.includes('province')) return 'province';
    if (lowerText.includes('postal')) return 'postal code';
    if (lowerText.includes('country')) return 'country';
    
    return 'information';
  }
}

module.exports = LLMService;
