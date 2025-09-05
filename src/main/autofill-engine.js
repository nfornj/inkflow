/**
 * Autofill Engine - Coordinates LLM service, model manager, and profile manager
 * Phase 6 Implementation - Placeholder for now
 */

const LLMService = require('./llm-service');
const ModelManager = require('./model-manager');
const ProfileManager = require('./profile-manager');
const HardwareDetector = require('./hardware-detector');
const PerformanceMonitor = require('./performance-monitor');
const PromptManager = require('./prompt-manager');
const path = require('path');

class AutofillEngine {
  constructor() {
    this.llmService = new LLMService();
    this.modelManager = new ModelManager();
    this.profileManager = new ProfileManager();
    this.hardwareDetector = new HardwareDetector();
    this.performanceMonitor = new PerformanceMonitor();
    this.promptManager = new PromptManager();
    this.isInitialized = false;
    this.currentModel = null;
    this.idleTimeout = null;
    this.idleTimeoutDuration = 30 * 60 * 1000; // 30 minutes
    this.systemSpecs = null;
    this.performanceMetrics = {
      totalSuggestions: 0,
      successfulSuggestions: 0,
      averageLatency: 0,
      lastSuggestionTime: 0,
      errorRate: 0
    };
  }

  /**
   * Initialize the autofill engine
   * @returns {Promise<boolean>} - Success status
   */
  async initialize() {
    try {
      console.log('Initializing Autofill Engine...');

      // Detect system hardware
      console.log('Detecting system hardware...');
      this.systemSpecs = await this.hardwareDetector.detectSystemSpecs();
      
      // Check minimum requirements
      const requirementsCheck = this.hardwareDetector.checkMinimumRequirements(this.systemSpecs);
      if (!requirementsCheck.meetsMinimum) {
        console.warn('System does not meet minimum requirements:', requirementsCheck.checks);
        // Continue anyway, but log warning
      }

      // Initialize model manager
      const modelManagerReady = await this.modelManager.initialize();
      if (!modelManagerReady) {
        throw new Error('Failed to initialize Model Manager');
      }

      // Initialize profile manager (no async init needed)
      console.log('Profile Manager ready');

      // Initialize performance monitor
      const performanceReady = await this.performanceMonitor.initialize();
      if (!performanceReady) {
        console.warn('Performance Monitor initialization failed, continuing without monitoring');
      }

      // Get recommended model based on hardware
      const recommendedModel = this.modelManager.getRecommendedModel({
        ramGB: this.systemSpecs.totalMemoryGB,
        hasGPU: this.systemSpecs.gpu?.hasGPU || false
      });

      if (recommendedModel) {
        console.log(`Loading recommended model: ${recommendedModel.modelName}`);
        await this.loadModel(recommendedModel.id);
      } else {
        // Fallback to default model
        const defaultModel = this.modelManager.getDefaultModel();
        if (defaultModel) {
          console.log(`Loading default model: ${defaultModel.modelName}`);
          await this.loadModel(defaultModel.id);
        }
      }

      this.isInitialized = true;
      console.log('Autofill Engine initialized successfully');
      console.log(`System specs: ${this.systemSpecs.totalMemoryGB}GB RAM, ${this.systemSpecs.cpuCount} cores, GPU: ${this.systemSpecs.gpu?.hasGPU ? 'Yes' : 'No'}`);
      return true;

    } catch (error) {
      console.error('Failed to initialize Autofill Engine:', error);
      this.isInitialized = false;
      return false;
    }
  }

  /**
   * Load a model for autofill suggestions
   * @param {string} modelId - Model identifier
   * @returns {Promise<boolean>} - Success status
   */
  async loadModel(modelId) {
    try {
      console.log(`Loading model: ${modelId}`);

      // Check if model is downloaded
      const isDownloaded = await this.modelManager.isModelDownloaded(modelId);
      if (!isDownloaded) {
        console.log(`Model ${modelId} not downloaded, downloading...`);
        await this.modelManager.downloadModel(modelId);
      }

      // Verify model integrity
      const isVerified = await this.modelManager.verifyModel(modelId);
      if (!isVerified) {
        throw new Error(`Model ${modelId} verification failed`);
      }

      // Get model configuration
      const model = this.modelManager.getModel(modelId);
      
      // Extract Ollama model name from download URL
      let ollamaModelName = model.downloadUrl;
      if (ollamaModelName.startsWith('ollama://')) {
        ollamaModelName = ollamaModelName.replace('ollama://', '');
      } else {
        // Fallback to model ID if not an Ollama URL
        ollamaModelName = modelId;
      }
      
      // Calculate optimal GPU layers based on hardware (for reference)
      let gpuLayers = 0;
      if (model.gpuRecommended && this.systemSpecs?.gpu?.hasGPU) {
        gpuLayers = this.hardwareDetector.getOptimalGPULayers(
          this.systemSpecs.gpu, 
          model.gpuLayers
        );
        console.log(`GPU acceleration available: ${gpuLayers} layers (max: ${model.gpuLayers})`);
      }
      
      // Load model into LLM service (Ollama model name)
      const loaded = await this.llmService.loadModel(ollamaModelName, gpuLayers);
      
      if (loaded) {
        this.currentModel = modelId;
        this.resetIdleTimeout();
        console.log(`Model ${modelId} loaded successfully`);
        return true;
      } else {
        throw new Error(`Failed to load model ${modelId}`);
      }

    } catch (error) {
      console.error(`Failed to load model ${modelId}:`, error);
      return false;
    }
  }

  /**
   * Generate autofill suggestion for a field
   * @param {Object} fieldContext - Field context information
   * @returns {Promise<Object>} - Suggestion result
   */
  async generateSuggestion(fieldContext) {
    if (!this.isInitialized) {
      throw new Error('Autofill Engine not initialized');
    }

    if (!this.llmService.isReady()) {
      throw new Error('LLM service not ready');
    }

    const startTime = Date.now();
    this.performanceMetrics.totalSuggestions++;

    try {
      // Generate context for LLM
      const context = await this.profileManager.generateContext(fieldContext);
      
      // Generate prompt using prompt manager
      const prompt = this.promptManager.generateAutofillPrompt(
        context, 
        fieldContext.field_type, 
        fieldContext
      );
      
      // Generate suggestion using LLM with prompt
      const result = await this.llmService.generateSuggestion(prompt);
      
      // Parse the response using prompt manager
      let parsedResult = result;
      if (result.success && result.suggestion) {
        parsedResult = this.promptManager.parseResponse(result.suggestion, 'suggestion');
        if (!parsedResult.success) {
          // Fallback to original result if parsing fails
          parsedResult = result;
        }
      }
      
      // Update performance metrics
      const latency = Date.now() - startTime;
      this.performanceMetrics.lastSuggestionTime = latency;
      this.performanceMetrics.successfulSuggestions++;
      
      // Update average latency
      const total = this.performanceMetrics.averageLatency * (this.performanceMetrics.totalSuggestions - 1);
      this.performanceMetrics.averageLatency = (total + latency) / this.performanceMetrics.totalSuggestions;
      
      // Update error rate
      this.performanceMetrics.errorRate = 
        (this.performanceMetrics.totalSuggestions - this.performanceMetrics.successfulSuggestions) / 
        this.performanceMetrics.totalSuggestions;
      
      // Record in performance monitor
      this.performanceMonitor.recordRequest(latency, true, {
        fieldType: fieldContext.field_type,
        fieldName: fieldContext.field_name,
        hasSuggestion: !!result.suggestion,
        hasQuestion: !!result.question
      });
      
      // Reset idle timeout
      this.resetIdleTimeout();
      
      console.log(`Suggestion generated in ${latency}ms (avg: ${Math.round(this.performanceMetrics.averageLatency)}ms)`);
      
      return {
        ...parsedResult,
        performance: {
          latency: latency,
          averageLatency: this.performanceMetrics.averageLatency,
          successRate: this.performanceMetrics.successfulSuggestions / this.performanceMetrics.totalSuggestions
        }
      };

    } catch (error) {
      console.error('Failed to generate suggestion:', error);
      
      // Update error metrics
      const latency = Date.now() - startTime;
      this.performanceMetrics.lastSuggestionTime = latency;
      this.performanceMetrics.errorRate = 
        (this.performanceMetrics.totalSuggestions - this.performanceMetrics.successfulSuggestions) / 
        this.performanceMetrics.totalSuggestions;
      
      // Record error in performance monitor
      this.performanceMonitor.recordRequest(latency, false, {
        fieldType: fieldContext.field_type,
        fieldName: fieldContext.field_name,
        error: error.message
      });
      
      throw error;
    }
  }

  /**
   * Generate question for missing information
   * @param {Object} fieldContext - Field context
   * @returns {Promise<Object>} - Question result
   */
  async generateQuestion(fieldContext) {
    if (!this.isInitialized) {
      throw new Error('Autofill Engine not initialized');
    }

    if (!this.llmService.isReady()) {
      throw new Error('LLM service not ready');
    }

    const startTime = Date.now();
    this.performanceMetrics.totalQuestions = (this.performanceMetrics.totalQuestions || 0) + 1;

    try {
      // Generate context for LLM
      const context = await this.profileManager.generateContext(fieldContext);
      
      // Generate question prompt using prompt manager
      const prompt = this.promptManager.generateQuestionPrompt(
        context, 
        fieldContext.field_type, 
        fieldContext
      );
      
      // Generate question using LLM with prompt
      const result = await this.llmService.generateSuggestion(prompt);
      
      // Parse the response using prompt manager
      let parsedResult = result;
      if (result.success && result.suggestion) {
        parsedResult = this.promptManager.parseResponse(result.suggestion, 'question');
        if (!parsedResult.success) {
          // Fallback to original result if parsing fails
          parsedResult = result;
        }
      }
      
      // Update performance metrics
      const latency = Date.now() - startTime;
      this.performanceMetrics.lastQuestionTime = latency;
      this.performanceMetrics.successfulQuestions = (this.performanceMetrics.successfulQuestions || 0) + 1;
      
      console.log(`Question generated in ${latency}ms`);
      
      return {
        ...parsedResult,
        performance: {
          latency: latency,
          successRate: this.performanceMetrics.successfulQuestions / this.performanceMetrics.totalQuestions
        }
      };

    } catch (error) {
      console.error('Failed to generate question:', error);
      throw error;
    }
  }

  /**
   * Validate user input
   * @param {string} input - User input
   * @param {string} fieldType - Field type
   * @returns {Promise<Object>} - Validation result
   */
  async validateInput(input, fieldType) {
    if (!this.isInitialized) {
      throw new Error('Autofill Engine not initialized');
    }

    if (!this.llmService.isReady()) {
      throw new Error('LLM service not ready');
    }

    const startTime = Date.now();
    this.performanceMetrics.totalValidations = (this.performanceMetrics.totalValidations || 0) + 1;

    try {
      // Generate context for LLM
      const fieldContext = { field_type: fieldType, userInput: input };
      const context = await this.profileManager.generateContext(fieldContext);
      
      // Generate validation prompt using prompt manager
      const prompt = this.promptManager.generateValidationPrompt(
        context, 
        fieldType, 
        input
      );
      
      // Generate validation using LLM with prompt
      const result = await this.llmService.generateSuggestion(prompt);
      
      // Parse the response using prompt manager
      let parsedResult = result;
      if (result.success && result.suggestion) {
        parsedResult = this.promptManager.parseResponse(result.suggestion, 'validation');
        if (!parsedResult.success) {
          // Fallback to original result if parsing fails
          parsedResult = result;
        }
      }
      
      // Update performance metrics
      const latency = Date.now() - startTime;
      this.performanceMetrics.lastValidationTime = latency;
      this.performanceMetrics.successfulValidations = (this.performanceMetrics.successfulValidations || 0) + 1;
      
      console.log(`Validation completed in ${latency}ms`);
      
      return {
        ...parsedResult,
        performance: {
          latency: latency,
          successRate: this.performanceMetrics.successfulValidations / this.performanceMetrics.totalValidations
        }
      };

    } catch (error) {
      console.error('Failed to validate input:', error);
      throw error;
    }
  }

  /**
   * Handle user input for profile learning
   * @param {string} input - User input
   * @param {string} fieldType - Field type
   * @returns {Promise<Object>} - Processing result
   */
  async processUserInput(input, fieldType) {
    try {
      const result = await this.profileManager.categorizeUserInput(input, fieldType);
      console.log(`User input processed: ${fieldType} = ${result.value}`);
      return result;

    } catch (error) {
      console.error('Failed to process user input:', error);
      return {
        category: null,
        value: input,
        saved: false,
        error: error.message
      };
    }
  }

  /**
   * Get available models
   * @returns {Array} - Array of available models
   */
  getAvailableModels() {
    return this.modelManager.getAvailableModels();
  }

  /**
   * Get current model information
   * @returns {Object|null} - Current model info
   */
  getCurrentModel() {
    if (!this.currentModel) {
      return null;
    }
    return this.modelManager.getModel(this.currentModel);
  }

  /**
   * Get performance metrics
   * @returns {Object} - Performance metrics
   */
  getPerformanceMetrics() {
    return {
      engine: this.performanceMetrics,
      llm: this.llmService.getPerformanceMetrics(),
      model: this.getCurrentModel(),
      profile: this.profileManager.getProfileStats(),
      hardware: {
        systemSpecs: this.systemSpecs,
        performanceScore: this.hardwareDetector.getPerformanceScore(this.systemSpecs),
        requirementsCheck: this.hardwareDetector.checkMinimumRequirements(this.systemSpecs)
      },
      monitoring: {
        summary: this.performanceMonitor.getPerformanceSummary(),
        targets: this.performanceMonitor.checkPerformanceTargets(),
        report: this.performanceMonitor.generateReport()
      }
    };
  }

  /**
   * Get profile information
   * @returns {Promise<Object>} - Profile data
   */
  async getProfile() {
    return await this.profileManager.loadProfile();
  }

  /**
   * Update profile field
   * @param {string} field - Field name
   * @param {any} value - Field value
   * @returns {Promise<boolean>} - Success status
   */
  async updateProfile(field, value) {
    return await this.profileManager.updateProfileField(field, value);
  }

  /**
   * Reset idle timeout
   */
  resetIdleTimeout() {
    if (this.idleTimeout) {
      clearTimeout(this.idleTimeout);
    }

    this.idleTimeout = setTimeout(async () => {
      console.log('Idle timeout reached, unloading model...');
      await this.unloadModel();
    }, this.idleTimeoutDuration);
  }

  /**
   * Unload current model
   * @returns {Promise<boolean>} - Success status
   */
  async unloadModel() {
    try {
      if (this.idleTimeout) {
        clearTimeout(this.idleTimeout);
        this.idleTimeout = null;
      }

      const unloaded = await this.llmService.unloadModel();
      if (unloaded) {
        this.currentModel = null;
        console.log('Model unloaded successfully');
      }
      
      return unloaded;

    } catch (error) {
      console.error('Failed to unload model:', error);
      return false;
    }
  }

  /**
   * Check hardware requirements
   * @returns {Promise<Object>} - Hardware check result
   */
  async checkHardwareRequirements() {
    try {
      // Use detected system specs or detect if not available
      let systemSpecs = this.systemSpecs;
      if (!systemSpecs) {
        systemSpecs = await this.hardwareDetector.detectSystemSpecs();
      }

      const requirementsCheck = this.hardwareDetector.checkMinimumRequirements(systemSpecs);
      const recommendedModel = this.modelManager.getRecommendedModel({
        ramGB: systemSpecs.totalMemoryGB,
        hasGPU: systemSpecs.gpu?.hasGPU || false
      });
      
      const performanceScore = this.hardwareDetector.getPerformanceScore(systemSpecs);
      
      return {
        meetsRequirements: requirementsCheck.meetsMinimum,
        meetsRecommended: requirementsCheck.meetsRecommended,
        systemSpecs,
        recommendedModel,
        performanceScore,
        requirementsCheck,
        message: requirementsCheck.meetsMinimum ? 
          'Hardware requirements met' : 
          'Hardware does not meet minimum requirements'
      };

    } catch (error) {
      console.error('Hardware check failed:', error);
      return {
        meetsRequirements: false,
        meetsRecommended: false,
        systemSpecs: null,
        recommendedModel: null,
        performanceScore: 0,
        requirementsCheck: null,
        message: 'Hardware check failed',
        error: error.message
      };
    }
  }

  /**
   * Shutdown the autofill engine
   * @returns {Promise<boolean>} - Success status
   */
  async shutdown() {
    try {
      console.log('Shutting down Autofill Engine...');
      
      // Save performance metrics before shutdown
      await this.performanceMonitor.saveMetrics();
      
      await this.unloadModel();
      this.isInitialized = false;
      
      console.log('Autofill Engine shutdown complete');
      return true;

    } catch (error) {
      console.error('Failed to shutdown Autofill Engine:', error);
      return false;
    }
  }
}

module.exports = AutofillEngine;
