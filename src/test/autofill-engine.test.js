/**
 * Unit Tests for Autofill Engine
 * Phase 7 Implementation
 */

const { jest } = require('@jest/globals');
const AutofillEngine = require('../main/autofill-engine');
const LLMService = require('../main/llm-service');
const ModelManager = require('../main/model-manager');
const ProfileManager = require('../main/profile-manager');
const HardwareDetector = require('../main/hardware-detector');
const PerformanceMonitor = require('../main/performance-monitor');
const PromptManager = require('../main/prompt-manager');

// Mock dependencies
jest.mock('../main/llm-service');
jest.mock('../main/model-manager');
jest.mock('../main/profile-manager');
jest.mock('../main/hardware-detector');
jest.mock('../main/performance-monitor');
jest.mock('../main/prompt-manager');

describe('AutofillEngine', () => {
  let autofillEngine;
  let mockLLMService;
  let mockModelManager;
  let mockProfileManager;
  let mockHardwareDetector;
  let mockPerformanceMonitor;
  let mockPromptManager;

  beforeEach(() => {
    // Reset all mocks
    jest.clearAllMocks();

    // Create mock instances
    mockLLMService = {
      isReady: jest.fn(),
      generateSuggestion: jest.fn(),
      loadModel: jest.fn(),
      unloadModel: jest.fn()
    };

    mockModelManager = {
      getAvailableModels: jest.fn(),
      downloadModel: jest.fn(),
      verifyModel: jest.fn(),
      getModelPath: jest.fn()
    };

    mockProfileManager = {
      generateContext: jest.fn(),
      categorizeUserInput: jest.fn(),
      getProfile: jest.fn(),
      updateProfile: jest.fn()
    };

    mockHardwareDetector = {
      detectHardware: jest.fn(),
      checkRequirements: jest.fn()
    };

    mockPerformanceMonitor = {
      recordRequest: jest.fn(),
      getMetrics: jest.fn()
    };

    mockPromptManager = {
      generateAutofillPrompt: jest.fn(),
      generateQuestionPrompt: jest.fn(),
      generateValidationPrompt: jest.fn(),
      parseResponse: jest.fn()
    };

    // Setup mock implementations
    LLMService.mockImplementation(() => mockLLMService);
    ModelManager.mockImplementation(() => mockModelManager);
    ProfileManager.mockImplementation(() => mockProfileManager);
    HardwareDetector.mockImplementation(() => mockHardwareDetector);
    PerformanceMonitor.mockImplementation(() => mockPerformanceMonitor);
    PromptManager.mockImplementation(() => mockPromptManager);

    // Create autofill engine instance
    autofillEngine = new AutofillEngine();
  });

  describe('Initialization', () => {
    test('should initialize with default values', () => {
      expect(autofillEngine.isInitialized).toBe(false);
      expect(autofillEngine.currentModel).toBe(null);
      expect(autofillEngine.systemSpecs).toBe(null);
      expect(autofillEngine.performanceMetrics).toBeDefined();
    });

    test('should initialize successfully with valid hardware', async () => {
      // Mock hardware detection
      mockHardwareDetector.detectHardware.mockResolvedValue({
        cpu: { cores: 8, architecture: 'x64' },
        memory: { total: 16, available: 12 },
        gpu: { available: true, type: 'nvidia' }
      });

      mockHardwareDetector.checkRequirements.mockResolvedValue(true);
      mockModelManager.getAvailableModels.mockResolvedValue([
        { id: 'llama-3.2-8b-instruct-fast', name: 'Llama 3.2 8B Fast' }
      ]);

      await autofillEngine.initialize();

      expect(autofillEngine.isInitialized).toBe(true);
      expect(mockHardwareDetector.detectHardware).toHaveBeenCalled();
      expect(mockHardwareDetector.checkRequirements).toHaveBeenCalled();
    });

    test('should handle initialization failure gracefully', async () => {
      mockHardwareDetector.detectHardware.mockRejectedValue(new Error('Hardware detection failed'));

      await expect(autofillEngine.initialize()).rejects.toThrow('Hardware detection failed');
      expect(autofillEngine.isInitialized).toBe(false);
    });
  });

  describe('Model Management', () => {
    beforeEach(async () => {
      // Initialize engine
      mockHardwareDetector.detectHardware.mockResolvedValue({
        cpu: { cores: 8, architecture: 'x64' },
        memory: { total: 16, available: 12 },
        gpu: { available: true, type: 'nvidia' }
      });
      mockHardwareDetector.checkRequirements.mockResolvedValue(true);
      mockModelManager.getAvailableModels.mockResolvedValue([]);
      await autofillEngine.initialize();
    });

    test('should load model successfully', async () => {
      const modelId = 'llama-3.2-8b-instruct-fast';
      mockModelManager.verifyModel.mockResolvedValue(true);
      mockLLMService.loadModel.mockResolvedValue({ success: true });

      const result = await autofillEngine.loadModel(modelId);

      expect(result.success).toBe(true);
      expect(autofillEngine.currentModel).toBe(modelId);
      expect(mockLLMService.loadModel).toHaveBeenCalledWith(modelId);
    });

    test('should handle model loading failure', async () => {
      const modelId = 'invalid-model';
      mockModelManager.verifyModel.mockResolvedValue(false);

      const result = await autofillEngine.loadModel(modelId);

      expect(result.success).toBe(false);
      expect(result.error).toContain('Model not found');
    });

    test('should unload model successfully', async () => {
      autofillEngine.currentModel = 'llama-3.2-8b-instruct-fast';
      mockLLMService.unloadModel.mockResolvedValue({ success: true });

      const result = await autofillEngine.unloadModel();

      expect(result.success).toBe(true);
      expect(autofillEngine.currentModel).toBe(null);
      expect(mockLLMService.unloadModel).toHaveBeenCalled();
    });
  });

  describe('Suggestion Generation', () => {
    beforeEach(async () => {
      // Initialize engine
      mockHardwareDetector.detectHardware.mockResolvedValue({
        cpu: { cores: 8, architecture: 'x64' },
        memory: { total: 16, available: 12 },
        gpu: { available: true, type: 'nvidia' }
      });
      mockHardwareDetector.checkRequirements.mockResolvedValue(true);
      mockModelManager.getAvailableModels.mockResolvedValue([]);
      await autofillEngine.initialize();

      // Setup LLM service
      autofillEngine.currentModel = 'llama-3.2-8b-instruct-fast';
      mockLLMService.isReady.mockReturnValue(true);
    });

    test('should generate suggestion successfully', async () => {
      const fieldContext = {
        field_type: 'email',
        field_name: 'Email Address',
        field_importance: 'high',
        required: true
      };

      const mockContext = {
        user_profile: { name: 'John Doe', email: 'john@example.com' },
        system_context: { locale: 'en-US', country: 'US' },
        autofill_context: { field_type: 'email' }
      };

      const mockPrompt = 'Generate email suggestion for John Doe';
      const mockLLMResponse = {
        success: true,
        suggestion: 'john.doe@example.com'
      };

      const mockParsedResponse = {
        success: true,
        suggestion: 'john.doe@example.com',
        confidence: 0.95,
        source: 'llm',
        reasoning: 'Generated from user profile'
      };

      mockProfileManager.generateContext.mockResolvedValue(mockContext);
      mockPromptManager.generateAutofillPrompt.mockReturnValue(mockPrompt);
      mockLLMService.generateSuggestion.mockResolvedValue(mockLLMResponse);
      mockPromptManager.parseResponse.mockReturnValue(mockParsedResponse);

      const result = await autofillEngine.generateSuggestion(fieldContext);

      expect(result.success).toBe(true);
      expect(result.suggestion).toBe('john.doe@example.com');
      expect(result.confidence).toBe(0.95);
      expect(mockProfileManager.generateContext).toHaveBeenCalledWith(fieldContext);
      expect(mockPromptManager.generateAutofillPrompt).toHaveBeenCalledWith(
        mockContext,
        'email',
        fieldContext
      );
      expect(mockLLMService.generateSuggestion).toHaveBeenCalledWith(mockPrompt);
      expect(mockPromptManager.parseResponse).toHaveBeenCalledWith(
        'john.doe@example.com',
        'suggestion'
      );
    });

    test('should handle suggestion generation failure', async () => {
      const fieldContext = {
        field_type: 'email',
        field_name: 'Email Address'
      };

      mockProfileManager.generateContext.mockRejectedValue(new Error('Context generation failed'));

      const result = await autofillEngine.generateSuggestion(fieldContext);

      expect(result.success).toBe(false);
      expect(result.error).toContain('Context generation failed');
    });

    test('should fallback to heuristic suggestions when LLM fails', async () => {
      const fieldContext = {
        field_type: 'email',
        field_name: 'Email Address'
      };

      const mockContext = {
        user_profile: { name: 'John Doe' },
        system_context: { locale: 'en-US' },
        autofill_context: { field_type: 'email' }
      };

      mockProfileManager.generateContext.mockResolvedValue(mockContext);
      mockPromptManager.generateAutofillPrompt.mockReturnValue('Generate email');
      mockLLMService.generateSuggestion.mockRejectedValue(new Error('LLM service failed'));

      const result = await autofillEngine.generateSuggestion(fieldContext);

      expect(result.success).toBe(false);
      expect(result.error).toContain('LLM service failed');
    });
  });

  describe('Question Generation', () => {
    beforeEach(async () => {
      // Initialize engine
      mockHardwareDetector.detectHardware.mockResolvedValue({
        cpu: { cores: 8, architecture: 'x64' },
        memory: { total: 16, available: 12 },
        gpu: { available: true, type: 'nvidia' }
      });
      mockHardwareDetector.checkRequirements.mockResolvedValue(true);
      mockModelManager.getAvailableModels.mockResolvedValue([]);
      await autofillEngine.initialize();

      autofillEngine.currentModel = 'llama-3.2-8b-instruct-fast';
      mockLLMService.isReady.mockReturnValue(true);
    });

    test('should generate question successfully', async () => {
      const fieldContext = {
        field_type: 'phone',
        field_name: 'Phone Number',
        field_importance: 'high',
        required: true
      };

      const mockContext = {
        user_profile: { name: 'John Doe' },
        system_context: { locale: 'en-US', country: 'US' },
        autofill_context: { field_type: 'phone' }
      };

      const mockPrompt = 'Generate question for phone number';
      const mockLLMResponse = {
        success: true,
        suggestion: '{"question": "What is your phone number?", "field_type": "phone"}'
      };

      const mockParsedResponse = {
        success: true,
        question: 'What is your phone number?',
        field_type: 'phone',
        reasoning: 'Generated for missing phone information'
      };

      mockProfileManager.generateContext.mockResolvedValue(mockContext);
      mockPromptManager.generateQuestionPrompt.mockReturnValue(mockPrompt);
      mockLLMService.generateSuggestion.mockResolvedValue(mockLLMResponse);
      mockPromptManager.parseResponse.mockReturnValue(mockParsedResponse);

      const result = await autofillEngine.generateQuestion(fieldContext);

      expect(result.success).toBe(true);
      expect(result.question).toBe('What is your phone number?');
      expect(result.field_type).toBe('phone');
      expect(mockPromptManager.generateQuestionPrompt).toHaveBeenCalledWith(
        mockContext,
        'phone',
        fieldContext
      );
    });
  });

  describe('Input Validation', () => {
    beforeEach(async () => {
      // Initialize engine
      mockHardwareDetector.detectHardware.mockResolvedValue({
        cpu: { cores: 8, architecture: 'x64' },
        memory: { total: 16, available: 12 },
        gpu: { available: true, type: 'nvidia' }
      });
      mockHardwareDetector.checkRequirements.mockResolvedValue(true);
      mockModelManager.getAvailableModels.mockResolvedValue([]);
      await autofillEngine.initialize();

      autofillEngine.currentModel = 'llama-3.2-8b-instruct-fast';
      mockLLMService.isReady.mockReturnValue(true);
    });

    test('should validate input successfully', async () => {
      const input = 'john@example.com';
      const fieldType = 'email';

      const mockContext = {
        user_profile: { name: 'John Doe' },
        system_context: { locale: 'en-US' },
        autofill_context: { field_type: 'email', userInput: input }
      };

      const mockPrompt = 'Validate email input';
      const mockLLMResponse = {
        success: true,
        suggestion: '{"valid": true, "corrected_value": "john@example.com"}'
      };

      const mockParsedResponse = {
        success: true,
        valid: true,
        corrected_value: 'john@example.com',
        feedback: 'Valid email format'
      };

      mockProfileManager.generateContext.mockResolvedValue(mockContext);
      mockPromptManager.generateValidationPrompt.mockReturnValue(mockPrompt);
      mockLLMService.generateSuggestion.mockResolvedValue(mockLLMResponse);
      mockPromptManager.parseResponse.mockReturnValue(mockParsedResponse);

      const result = await autofillEngine.validateInput(input, fieldType);

      expect(result.success).toBe(true);
      expect(result.valid).toBe(true);
      expect(result.corrected_value).toBe('john@example.com');
      expect(mockPromptManager.generateValidationPrompt).toHaveBeenCalledWith(
        mockContext,
        'email',
        input
      );
    });
  });

  describe('Profile Management', () => {
    beforeEach(async () => {
      // Initialize engine
      mockHardwareDetector.detectHardware.mockResolvedValue({
        cpu: { cores: 8, architecture: 'x64' },
        memory: { total: 16, available: 12 },
        gpu: { available: true, type: 'nvidia' }
      });
      mockHardwareDetector.checkRequirements.mockResolvedValue(true);
      mockModelManager.getAvailableModels.mockResolvedValue([]);
      await autofillEngine.initialize();
    });

    test('should get profile successfully', async () => {
      const mockProfile = {
        name: 'John Doe',
        email: 'john@example.com',
        phone: '(555) 123-4567'
      };

      mockProfileManager.getProfile.mockResolvedValue({
        success: true,
        data: mockProfile
      });

      const result = await autofillEngine.getProfile();

      expect(result.success).toBe(true);
      expect(result.data).toEqual(mockProfile);
      expect(mockProfileManager.getProfile).toHaveBeenCalled();
    });

    test('should update profile successfully', async () => {
      const field = 'email';
      const value = 'john.doe@example.com';

      mockProfileManager.updateProfile.mockResolvedValue({
        success: true,
        message: 'Profile updated successfully'
      });

      const result = await autofillEngine.updateProfile(field, value);

      expect(result.success).toBe(true);
      expect(result.message).toBe('Profile updated successfully');
      expect(mockProfileManager.updateProfile).toHaveBeenCalledWith(field, value);
    });
  });

  describe('Performance Monitoring', () => {
    beforeEach(async () => {
      // Initialize engine
      mockHardwareDetector.detectHardware.mockResolvedValue({
        cpu: { cores: 8, architecture: 'x64' },
        memory: { total: 16, available: 12 },
        gpu: { available: true, type: 'nvidia' }
      });
      mockHardwareDetector.checkRequirements.mockResolvedValue(true);
      mockModelManager.getAvailableModels.mockResolvedValue([]);
      await autofillEngine.initialize();
    });

    test('should track performance metrics', async () => {
      const fieldContext = {
        field_type: 'email',
        field_name: 'Email Address'
      };

      const mockContext = {
        user_profile: { name: 'John Doe' },
        system_context: { locale: 'en-US' },
        autofill_context: { field_type: 'email' }
      };

      mockProfileManager.generateContext.mockResolvedValue(mockContext);
      mockPromptManager.generateAutofillPrompt.mockReturnValue('Generate email');
      mockLLMService.generateSuggestion.mockResolvedValue({
        success: true,
        suggestion: 'john@example.com'
      });
      mockPromptManager.parseResponse.mockReturnValue({
        success: true,
        suggestion: 'john@example.com',
        confidence: 0.95
      });

      await autofillEngine.generateSuggestion(fieldContext);

      expect(autofillEngine.performanceMetrics.totalSuggestions).toBe(1);
      expect(autofillEngine.performanceMetrics.successfulSuggestions).toBe(1);
      expect(autofillEngine.performanceMetrics.averageLatency).toBeGreaterThan(0);
    });

    test('should get performance metrics', () => {
      const metrics = autofillEngine.getPerformanceMetrics();

      expect(metrics).toHaveProperty('totalSuggestions');
      expect(metrics).toHaveProperty('successfulSuggestions');
      expect(metrics).toHaveProperty('averageLatency');
      expect(metrics).toHaveProperty('errorRate');
    });
  });

  describe('Error Handling', () => {
    test('should handle initialization errors gracefully', async () => {
      mockHardwareDetector.detectHardware.mockRejectedValue(new Error('Hardware detection failed'));

      await expect(autofillEngine.initialize()).rejects.toThrow('Hardware detection failed');
      expect(autofillEngine.isInitialized).toBe(false);
    });

    test('should handle model loading errors gracefully', async () => {
      mockHardwareDetector.detectHardware.mockResolvedValue({
        cpu: { cores: 8, architecture: 'x64' },
        memory: { total: 16, available: 12 },
        gpu: { available: true, type: 'nvidia' }
      });
      mockHardwareDetector.checkRequirements.mockResolvedValue(true);
      mockModelManager.getAvailableModels.mockResolvedValue([]);
      await autofillEngine.initialize();

      mockModelManager.verifyModel.mockResolvedValue(false);

      const result = await autofillEngine.loadModel('invalid-model');
      expect(result.success).toBe(false);
      expect(result.error).toContain('Model not found');
    });

    test('should handle suggestion generation errors gracefully', async () => {
      mockHardwareDetector.detectHardware.mockResolvedValue({
        cpu: { cores: 8, architecture: 'x64' },
        memory: { total: 16, available: 12 },
        gpu: { available: true, type: 'nvidia' }
      });
      mockHardwareDetector.checkRequirements.mockResolvedValue(true);
      mockModelManager.getAvailableModels.mockResolvedValue([]);
      await autofillEngine.initialize();

      autofillEngine.currentModel = 'llama-3.2-8b-instruct-fast';
      mockLLMService.isReady.mockReturnValue(true);

      const fieldContext = { field_type: 'email' };
      mockProfileManager.generateContext.mockRejectedValue(new Error('Context generation failed'));

      const result = await autofillEngine.generateSuggestion(fieldContext);
      expect(result.success).toBe(false);
      expect(result.error).toContain('Context generation failed');
    });
  });
});

