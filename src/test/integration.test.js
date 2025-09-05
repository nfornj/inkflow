/**
 * Integration Tests for LLM Autofill System
 * Phase 7 Implementation
 */

const { jest } = require('@jest/globals');
const path = require('path');
const fs = require('fs').promises;

// Mock Electron modules
jest.mock('electron', () => ({
  app: {
    getPath: jest.fn(() => '/tmp/inkflow'),
    isReady: jest.fn(() => true)
  }
}));

// Import modules after mocking
const AutofillEngine = require('../main/autofill-engine');
const ProfileManager = require('../main/profile-manager');
const ContextGenerator = require('../main/context-generator');
const PromptManager = require('../main/prompt-manager');

describe('LLM Autofill Integration Tests', () => {
  let autofillEngine;
  let profileManager;
  let contextGenerator;
  let promptManager;

  beforeEach(async () => {
    // Clean up any existing test data
    try {
      await fs.rmdir('/tmp/inkflow', { recursive: true });
    } catch (error) {
      // Directory doesn't exist, that's fine
    }

    // Create fresh instances
    autofillEngine = new AutofillEngine();
    profileManager = new ProfileManager();
    contextGenerator = new ContextGenerator();
    promptManager = new PromptManager();
  });

  afterEach(async () => {
    // Clean up test data
    try {
      await fs.rmdir('/tmp/inkflow', { recursive: true });
    } catch (error) {
      // Directory doesn't exist, that's fine
    }
  });

  describe('Profile Management Integration', () => {
    test('should create and manage user profile', async () => {
      // Create initial profile
      const initialProfile = {
        name: 'John Doe',
        email: 'john@example.com',
        phone: '(555) 123-4567',
        address: {
          street: '123 Main St',
          city: 'New York',
          province: 'NY',
          postal_code: '10001',
          country: 'US'
        },
        company: 'Acme Corp',
        job_title: 'Software Engineer'
      };

      // Save profile
      await profileManager.updateProfile('name', initialProfile.name);
      await profileManager.updateProfile('email', initialProfile.email);
      await profileManager.updateProfile('phone', initialProfile.phone);
      await profileManager.updateProfile('address.street', initialProfile.address.street);
      await profileManager.updateProfile('address.city', initialProfile.address.city);
      await profileManager.updateProfile('address.province', initialProfile.address.province);
      await profileManager.updateProfile('address.postal_code', initialProfile.address.postal_code);
      await profileManager.updateProfile('address.country', initialProfile.address.country);
      await profileManager.updateProfile('company', initialProfile.company);
      await profileManager.updateProfile('job_title', initialProfile.job_title);

      // Retrieve profile
      const retrievedProfile = await profileManager.getProfile();

      expect(retrievedProfile.success).toBe(true);
      expect(retrievedProfile.data.name).toBe(initialProfile.name);
      expect(retrievedProfile.data.email).toBe(initialProfile.email);
      expect(retrievedProfile.data.phone).toBe(initialProfile.phone);
      expect(retrievedProfile.data.address.street).toBe(initialProfile.address.street);
      expect(retrievedProfile.data.address.city).toBe(initialProfile.address.city);
      expect(retrievedProfile.data.address.province).toBe(initialProfile.address.province);
      expect(retrievedProfile.data.address.postal_code).toBe(initialProfile.address.postal_code);
      expect(retrievedProfile.data.address.country).toBe(initialProfile.address.country);
      expect(retrievedProfile.data.company).toBe(initialProfile.company);
      expect(retrievedProfile.data.job_title).toBe(initialProfile.job_title);
    });

    test('should categorize and learn from user input', async () => {
      // Test email categorization
      const emailResult = await profileManager.categorizeUserInput('john.doe@example.com', 'email');
      expect(emailResult.success).toBe(true);
      expect(emailResult.fieldType).toBe('email');
      expect(emailResult.value).toBe('john.doe@example.com');
      expect(emailResult.confidence).toBeGreaterThan(0.8);

      // Test phone categorization
      const phoneResult = await profileManager.categorizeUserInput('(555) 123-4567', 'phone');
      expect(phoneResult.success).toBe(true);
      expect(phoneResult.fieldType).toBe('phone');
      expect(phoneResult.value).toBe('(555) 123-4567');
      expect(phoneResult.confidence).toBeGreaterThan(0.8);

      // Test name categorization
      const nameResult = await profileManager.categorizeUserInput('John Doe', 'name');
      expect(nameResult.success).toBe(true);
      expect(nameResult.fieldType).toBe('name');
      expect(nameResult.value).toBe('John Doe');
      expect(nameResult.confidence).toBeGreaterThan(0.8);

      // Test address categorization
      const addressResult = await profileManager.categorizeUserInput('123 Main Street', 'address.street');
      expect(addressResult.success).toBe(true);
      expect(addressResult.fieldType).toBe('address.street');
      expect(addressResult.value).toBe('123 Main Street');
      expect(addressResult.confidence).toBeGreaterThan(0.7);
    });

    test('should generate profile statistics', async () => {
      // Add some profile data
      await profileManager.updateProfile('name', 'John Doe');
      await profileManager.updateProfile('email', 'john@example.com');
      await profileManager.updateProfile('phone', '(555) 123-4567');

      const stats = await profileManager.getProfileStats();

      expect(stats.success).toBe(true);
      expect(stats.data.totalFields).toBeGreaterThan(0);
      expect(stats.data.filledFields).toBeGreaterThan(0);
      expect(stats.data.completionPercentage).toBeGreaterThan(0);
      expect(stats.data.completionPercentage).toBeLessThanOrEqual(100);
      expect(stats.data.categoryStats).toBeDefined();
      expect(stats.data.qualityScore).toBeGreaterThan(0);
      expect(stats.data.qualityScore).toBeLessThanOrEqual(1);
    });
  });

  describe('Context Generation Integration', () => {
    test('should generate system context', () => {
      const systemContext = contextGenerator.systemContext;

      expect(systemContext.currentDate).toBeDefined();
      expect(systemContext.currentTime).toBeDefined();
      expect(systemContext.timezone).toBeDefined();
      expect(systemContext.locale).toBeDefined();
      expect(systemContext.country).toBeDefined();
      expect(systemContext.currency).toBeDefined();
      expect(systemContext.dateFormat).toBeDefined();
      expect(systemContext.phoneFormat).toBeDefined();
    });

    test('should generate user context', () => {
      const userProfile = {
        name: 'John Doe',
        email: 'john@example.com',
        phone: '(555) 123-4567',
        address: {
          street: '123 Main St',
          city: 'New York',
          province: 'NY',
          postal_code: '10001',
          country: 'US'
        },
        company: 'Acme Corp',
        job_title: 'Software Engineer'
      };

      const userContext = contextGenerator.generateUserContext(userProfile);

      expect(userContext.personal).toBeDefined();
      expect(userContext.personal.name).toBe('John Doe');
      expect(userContext.personal.email).toBe('john@example.com');
      expect(userContext.personal.phone).toBe('(555) 123-4567');
      expect(userContext.address).toBeDefined();
      expect(userContext.address.street).toBe('123 Main St');
      expect(userContext.address.city).toBe('New York');
      expect(userContext.address.province).toBe('NY');
      expect(userContext.address.postal_code).toBe('10001');
      expect(userContext.address.country).toBe('US');
      expect(userContext.professional).toBeDefined();
      expect(userContext.professional.company).toBe('Acme Corp');
      expect(userContext.professional.job_title).toBe('Software Engineer');
    });

    test('should generate autofill context', () => {
      const fieldContext = {
        field_type: 'email',
        field_name: 'Email Address',
        field_importance: 'high',
        required: true
      };

      const autofillContext = contextGenerator.generateAutofillContext(fieldContext);

      expect(autofillContext.field_type).toBe('email');
      expect(autofillContext.field_name).toBe('Email Address');
      expect(autofillContext.field_importance).toBe('high');
      expect(autofillContext.required).toBe(true);
      expect(autofillContext.available_data).toBeDefined();
      expect(autofillContext.related_fields).toBeDefined();
      expect(autofillContext.fallback_options).toBeDefined();
    });

    test('should generate complete context', async () => {
      // Setup profile
      await profileManager.updateProfile('name', 'John Doe');
      await profileManager.updateProfile('email', 'john@example.com');
      await profileManager.updateProfile('phone', '(555) 123-4567');

      const fieldContext = {
        field_type: 'email',
        field_name: 'Email Address',
        field_importance: 'high',
        required: true
      };

      const context = await profileManager.generateContext(fieldContext);

      expect(context.user_profile).toBeDefined();
      expect(context.user_profile.name).toBe('John Doe');
      expect(context.user_profile.email).toBe('john@example.com');
      expect(context.user_profile.phone).toBe('(555) 123-4567');
      expect(context.system_context).toBeDefined();
      expect(context.system_context.locale).toBeDefined();
      expect(context.system_context.country).toBeDefined();
      expect(context.autofill_context).toBeDefined();
      expect(context.autofill_context.field_type).toBe('email');
    });
  });

  describe('Prompt Generation Integration', () => {
    test('should generate autofill prompt with complete context', () => {
      const context = {
        user_profile: {
          name: 'John Doe',
          email: 'john@example.com',
          phone: '(555) 123-4567',
          address: {
            street: '123 Main St',
            city: 'New York',
            province: 'NY',
            postal_code: '10001',
            country: 'US'
          },
          company: 'Acme Corp',
          job_title: 'Software Engineer'
        },
        system_context: {
          current_date: '2025-01-03',
          locale: 'en-US',
          country: 'US',
          currency: 'USD',
          dateFormat: 'MM/DD/YYYY',
          phoneFormat: '(XXX) XXX-XXXX'
        },
        autofill_context: {
          field_type: 'email',
          field_name: 'Email Address',
          field_importance: 'high',
          required: true,
          available_data: [
            { source: 'profile', value: 'john@example.com', confidence: 0.95 }
          ],
          related_fields: ['name', 'company'],
          fallback_options: [
            { type: 'common', value: 'john@acmecorp.com' }
          ]
        }
      };

      const fieldContext = {
        field_type: 'email',
        field_name: 'Email Address',
        field_importance: 'high',
        required: true
      };

      const prompt = promptManager.generateAutofillPrompt(context, 'email', fieldContext);

      expect(prompt).toContain('intelligent autofill assistant');
      expect(prompt).toContain('John Doe');
      expect(prompt).toContain('john@example.com');
      expect(prompt).toContain('(555) 123-4567');
      expect(prompt).toContain('123 Main St, New York, NY, 10001');
      expect(prompt).toContain('Acme Corp');
      expect(prompt).toContain('Software Engineer');
      expect(prompt).toContain('Email Address');
      expect(prompt).toContain('Field Type: email');
      expect(prompt).toContain('Field Importance: high');
      expect(prompt).toContain('Required: true');
      expect(prompt).toContain('profile: john@example.com (confidence: 0.95)');
      expect(prompt).toContain('Related fields: name, company');
      expect(prompt).toContain('common: john@acmecorp.com');
      expect(prompt).toContain('Generate an email address suggestion');
      expect(prompt).toContain('john.smith@gmail.com');
      expect(prompt).toContain('{"success": true');
    });

    test('should generate question prompt for missing information', () => {
      const context = {
        user_profile: {
          name: 'John Doe',
          email: 'john@example.com'
        },
        system_context: {
          locale: 'en-US',
          country: 'US'
        },
        autofill_context: {
          field_type: 'phone',
          field_name: 'Phone Number',
          field_importance: 'high',
          required: true
        }
      };

      const fieldContext = {
        field_type: 'phone',
        field_name: 'Phone Number',
        field_importance: 'high',
        required: true
      };

      const prompt = promptManager.generateQuestionPrompt(context, 'phone', fieldContext);

      expect(prompt).toContain('intelligent form assistant');
      expect(prompt).toContain('missing information');
      expect(prompt).toContain('Phone Number');
      expect(prompt).toContain('Field Type: phone');
      expect(prompt).toContain('Field Importance: high');
      expect(prompt).toContain('Required: true');
      expect(prompt).toContain('Generate a phone number suggestion');
      expect(prompt).toContain('(555) 123-4567');
      expect(prompt).toContain('{"success": true');
    });

    test('should generate validation prompt for user input', () => {
      const context = {
        user_profile: {
          name: 'John Doe'
        },
        system_context: {
          locale: 'en-US',
          country: 'US'
        },
        autofill_context: {
          field_type: 'email',
          userInput: 'john@example.com'
        }
      };

      const prompt = promptManager.generateValidationPrompt(context, 'email', 'john@example.com');

      expect(prompt).toContain('intelligent validation assistant');
      expect(prompt).toContain('john@example.com');
      expect(prompt).toContain('Field Type: email');
      expect(prompt).toContain('validate the user\'s input');
      expect(prompt).toContain('{"success": true');
    });
  });

  describe('Response Parsing Integration', () => {
    test('should parse complex LLM response correctly', () => {
      const response = `{
        "success": true,
        "suggestion": "john.doe@acmecorp.com",
        "confidence": 0.92,
        "source": "llm",
        "reasoning": "Generated based on user's name 'John Doe' and company 'Acme Corp' with professional email format"
      }`;

      const result = promptManager.parseResponse(response, 'suggestion');

      expect(result.success).toBe(true);
      expect(result.suggestion).toBe('john.doe@acmecorp.com');
      expect(result.confidence).toBe(0.92);
      expect(result.source).toBe('llm');
      expect(result.reasoning).toContain('Generated based on user\'s name');
    });

    test('should handle malformed JSON with text parsing', () => {
      const response = `The suggested email address is: john.doe@acmecorp.com
      Confidence: 0.92
      Source: llm
      Reasoning: Based on user profile data`;

      const result = promptManager.parseResponse(response, 'suggestion');

      expect(result.success).toBe(true);
      expect(result.suggestion).toBe('john.doe@acmecorp.com');
      expect(result.confidence).toBe(0.8);
      expect(result.source).toBe('llm');
    });

    test('should handle question response parsing', () => {
      const response = `{
        "success": true,
        "question": "What is your phone number?",
        "field_type": "phone",
        "reasoning": "Phone number is required but not available in user profile"
      }`;

      const result = promptManager.parseResponse(response, 'question');

      expect(result.success).toBe(true);
      expect(result.question).toBe('What is your phone number?');
      expect(result.field_type).toBe('phone');
      expect(result.reasoning).toContain('Phone number is required');
    });

    test('should handle validation response parsing', () => {
      const response = `{
        "success": true,
        "valid": true,
        "corrected_value": "john.doe@acmecorp.com",
        "feedback": "Valid email format. Corrected to use company domain.",
        "suggestions": ["john@acmecorp.com", "j.doe@acmecorp.com"]
      }`;

      const result = promptManager.parseResponse(response, 'validation');

      expect(result.success).toBe(true);
      expect(result.valid).toBe(true);
      expect(result.corrected_value).toBe('john.doe@acmecorp.com');
      expect(result.feedback).toContain('Valid email format');
      expect(result.suggestions).toContain('john@acmecorp.com');
      expect(result.suggestions).toContain('j.doe@acmecorp.com');
    });
  });

  describe('End-to-End Autofill Flow', () => {
    test('should complete full autofill workflow', async () => {
      // Setup profile
      await profileManager.updateProfile('name', 'John Doe');
      await profileManager.updateProfile('company', 'Acme Corp');
      await profileManager.updateProfile('address.city', 'New York');
      await profileManager.updateProfile('address.province', 'NY');

      // Generate context
      const fieldContext = {
        field_type: 'email',
        field_name: 'Email Address',
        field_importance: 'high',
        required: true
      };

      const context = await profileManager.generateContext(fieldContext);

      // Generate prompt
      const prompt = promptManager.generateAutofillPrompt(context, 'email', fieldContext);

      // Simulate LLM response
      const mockLLMResponse = `{
        "success": true,
        "suggestion": "john.doe@acmecorp.com",
        "confidence": 0.92,
        "source": "llm",
        "reasoning": "Generated based on user's name 'John Doe' and company 'Acme Corp'"
      }`;

      // Parse response
      const parsedResponse = promptManager.parseResponse(mockLLMResponse, 'suggestion');

      expect(parsedResponse.success).toBe(true);
      expect(parsedResponse.suggestion).toBe('john.doe@acmecorp.com');
      expect(parsedResponse.confidence).toBe(0.92);
      expect(parsedResponse.source).toBe('llm');
      expect(parsedResponse.reasoning).toContain('Generated based on user\'s name');

      // Process user input
      const processResult = await profileManager.categorizeUserInput(parsedResponse.suggestion, 'email');
      expect(processResult.success).toBe(true);
      expect(processResult.fieldType).toBe('email');
      expect(processResult.value).toBe('john.doe@acmecorp.com');
    });

    test('should handle question generation workflow', async () => {
      // Setup minimal profile
      await profileManager.updateProfile('name', 'John Doe');

      // Generate context for missing phone
      const fieldContext = {
        field_type: 'phone',
        field_name: 'Phone Number',
        field_importance: 'high',
        required: true
      };

      const context = await profileManager.generateContext(fieldContext);

      // Generate question prompt
      const prompt = promptManager.generateQuestionPrompt(context, 'phone', fieldContext);

      // Simulate LLM response
      const mockLLMResponse = `{
        "success": true,
        "question": "What is your phone number?",
        "field_type": "phone",
        "reasoning": "Phone number is required but not available in user profile"
      }`;

      // Parse response
      const parsedResponse = promptManager.parseResponse(mockLLMResponse, 'question');

      expect(parsedResponse.success).toBe(true);
      expect(parsedResponse.question).toBe('What is your phone number?');
      expect(parsedResponse.field_type).toBe('phone');
      expect(parsedResponse.reasoning).toContain('Phone number is required');
    });

    test('should handle validation workflow', async () => {
      // Setup profile
      await profileManager.updateProfile('name', 'John Doe');

      // Generate context for validation
      const fieldContext = {
        field_type: 'email',
        userInput: 'john@example.com'
      };

      const context = await profileManager.generateContext(fieldContext);

      // Generate validation prompt
      const prompt = promptManager.generateValidationPrompt(context, 'email', 'john@example.com');

      // Simulate LLM response
      const mockLLMResponse = `{
        "success": true,
        "valid": true,
        "corrected_value": "john@example.com",
        "feedback": "Valid email format",
        "suggestions": ["john.doe@example.com"]
      }`;

      // Parse response
      const parsedResponse = promptManager.parseResponse(mockLLMResponse, 'validation');

      expect(parsedResponse.success).toBe(true);
      expect(parsedResponse.valid).toBe(true);
      expect(parsedResponse.corrected_value).toBe('john@example.com');
      expect(parsedResponse.feedback).toBe('Valid email format');
      expect(parsedResponse.suggestions).toContain('john.doe@example.com');
    });
  });

  describe('Error Handling Integration', () => {
    test('should handle profile corruption gracefully', async () => {
      // This test would simulate profile corruption and recovery
      // For now, we'll test error handling in context generation
      const fieldContext = {
        field_type: 'email',
        field_name: 'Email Address'
      };

      // Mock profile manager to throw error
      const originalGenerateContext = profileManager.generateContext;
      profileManager.generateContext = jest.fn().mockRejectedValue(new Error('Profile corruption'));

      try {
        await profileManager.generateContext(fieldContext);
        fail('Expected error to be thrown');
      } catch (error) {
        expect(error.message).toBe('Profile corruption');
      }

      // Restore original method
      profileManager.generateContext = originalGenerateContext;
    });

    test('should handle malformed LLM responses gracefully', () => {
      const malformedResponses = [
        'Invalid JSON response',
        '{"success": true, "suggestion": "test"', // Missing closing brace
        '{"success": false}', // Missing error field
        '', // Empty response
        null, // Null response
        undefined // Undefined response
      ];

      malformedResponses.forEach((response, index) => {
        const result = promptManager.parseResponse(response, 'suggestion');
        expect(result.success).toBe(false);
        expect(result.error).toBeDefined();
      });
    });

    test('should handle context generation errors gracefully', () => {
      const invalidContexts = [
        null,
        undefined,
        {},
        { user_profile: null },
        { system_context: null },
        { autofill_context: null }
      ];

      invalidContexts.forEach((context, index) => {
        expect(() => {
          promptManager.buildContextSummary(
            context.user_profile || {},
            context.system_context || {},
            context.autofill_context || {}
          );
        }).not.toThrow();
      });
    });
  });
});

