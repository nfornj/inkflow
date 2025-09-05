/**
 * Performance Tests for LLM Autofill System
 * Phase 7 Implementation
 */

const { jest } = require('@jest/globals');
const AutofillEngine = require('../main/autofill-engine');
const ProfileManager = require('../main/profile-manager');
const ContextGenerator = require('../main/context-generator');
const PromptManager = require('../main/prompt-manager');

// Mock dependencies
jest.mock('../main/llm-service');
jest.mock('../main/model-manager');
jest.mock('../main/hardware-detector');
jest.mock('../main/performance-monitor');

describe('LLM Autofill Performance Tests', () => {
  let autofillEngine;
  let profileManager;
  let contextGenerator;
  let promptManager;

  beforeEach(() => {
    // Reset all mocks
    jest.clearAllMocks();

    // Create instances
    profileManager = new ProfileManager();
    contextGenerator = new ContextGenerator();
    promptManager = new PromptManager();
  });

  describe('Profile Manager Performance', () => {
    test('should handle large profile data efficiently', async () => {
      const startTime = Date.now();

      // Create large profile data
      const largeProfile = {
        name: 'John Doe',
        email: 'john@example.com',
        phone: '(555) 123-4567',
        address: {
          street: '123 Main Street',
          city: 'New York',
          province: 'NY',
          postal_code: '10001',
          country: 'US'
        },
        company: 'Acme Corporation',
        job_title: 'Senior Software Engineer',
        date_of_birth: '1990-01-01',
        preferences: {
          locale: 'en-US',
          date_format: 'MM/DD/YYYY',
          phone_format: '(XXX) XXX-XXXX'
        }
      };

      // Save large profile
      for (const [key, value] of Object.entries(largeProfile)) {
        if (typeof value === 'object' && value !== null) {
          for (const [subKey, subValue] of Object.entries(value)) {
            await profileManager.updateProfile(`${key}.${subKey}`, subValue);
          }
        } else {
          await profileManager.updateProfile(key, value);
        }
      }

      const endTime = Date.now();
      const duration = endTime - startTime;

      // Should complete within 1000ms
      expect(duration).toBeLessThan(1000);

      // Verify profile was saved correctly
      const retrievedProfile = await profileManager.getProfile();
      expect(retrievedProfile.success).toBe(true);
      expect(retrievedProfile.data.name).toBe(largeProfile.name);
      expect(retrievedProfile.data.email).toBe(largeProfile.email);
    });

    test('should categorize multiple inputs efficiently', async () => {
      const startTime = Date.now();

      // Test multiple categorizations
      const testInputs = [
        { input: 'john@example.com', fieldType: 'email' },
        { input: '(555) 123-4567', fieldType: 'phone' },
        { input: 'John Doe', fieldType: 'name' },
        { input: '123 Main Street', fieldType: 'address.street' },
        { input: 'New York', fieldType: 'address.city' },
        { input: 'NY', fieldType: 'address.province' },
        { input: '10001', fieldType: 'address.postal_code' },
        { input: 'Acme Corp', fieldType: 'company' },
        { input: 'Software Engineer', fieldType: 'job_title' },
        { input: '1990-01-01', fieldType: 'date_of_birth' }
      ];

      const results = [];
      for (const { input, fieldType } of testInputs) {
        const result = await profileManager.categorizeUserInput(input, fieldType);
        results.push(result);
      }

      const endTime = Date.now();
      const duration = endTime - startTime;

      // Should complete within 2000ms for 10 inputs
      expect(duration).toBeLessThan(2000);

      // Verify all categorizations were successful
      results.forEach((result, index) => {
        expect(result.success).toBe(true);
        expect(result.fieldType).toBe(testInputs[index].fieldType);
        expect(result.value).toBe(testInputs[index].input);
      });
    });

    test('should generate profile statistics efficiently', async () => {
      // Setup profile data
      await profileManager.updateProfile('name', 'John Doe');
      await profileManager.updateProfile('email', 'john@example.com');
      await profileManager.updateProfile('phone', '(555) 123-4567');
      await profileManager.updateProfile('address.street', '123 Main St');
      await profileManager.updateProfile('address.city', 'New York');
      await profileManager.updateProfile('address.province', 'NY');
      await profileManager.updateProfile('address.postal_code', '10001');
      await profileManager.updateProfile('company', 'Acme Corp');
      await profileManager.updateProfile('job_title', 'Software Engineer');

      const startTime = Date.now();

      // Generate statistics multiple times
      const statsPromises = [];
      for (let i = 0; i < 10; i++) {
        statsPromises.push(profileManager.getProfileStats());
      }

      const statsResults = await Promise.all(statsPromises);

      const endTime = Date.now();
      const duration = endTime - startTime;

      // Should complete within 1000ms for 10 statistics generations
      expect(duration).toBeLessThan(1000);

      // Verify all statistics were generated successfully
      statsResults.forEach(stats => {
        expect(stats.success).toBe(true);
        expect(stats.data.totalFields).toBeGreaterThan(0);
        expect(stats.data.filledFields).toBeGreaterThan(0);
        expect(stats.data.completionPercentage).toBeGreaterThan(0);
        expect(stats.data.completionPercentage).toBeLessThanOrEqual(100);
      });
    });
  });

  describe('Context Generation Performance', () => {
    test('should generate context efficiently', () => {
      const startTime = Date.now();

      // Generate context multiple times
      for (let i = 0; i < 100; i++) {
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
        expect(userContext.personal.name).toBe('John Doe');
        expect(userContext.address.city).toBe('New York');
        expect(userContext.professional.company).toBe('Acme Corp');
      }

      const endTime = Date.now();
      const duration = endTime - startTime;

      // Should complete within 1000ms for 100 context generations
      expect(duration).toBeLessThan(1000);
    });

    test('should generate system context efficiently', () => {
      const startTime = Date.now();

      // Generate system context multiple times
      for (let i = 0; i < 1000; i++) {
        const systemContext = contextGenerator.systemContext;
        expect(systemContext.currentDate).toBeDefined();
        expect(systemContext.locale).toBeDefined();
        expect(systemContext.country).toBeDefined();
        expect(systemContext.currency).toBeDefined();
      }

      const endTime = Date.now();
      const duration = endTime - startTime;

      // Should complete within 500ms for 1000 system context generations
      expect(duration).toBeLessThan(500);
    });

    test('should generate autofill context efficiently', () => {
      const startTime = Date.now();

      // Generate autofill context multiple times
      for (let i = 0; i < 100; i++) {
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
      }

      const endTime = Date.now();
      const duration = endTime - startTime;

      // Should complete within 500ms for 100 autofill context generations
      expect(duration).toBeLessThan(500);
    });
  });

  describe('Prompt Generation Performance', () => {
    test('should generate autofill prompts efficiently', () => {
      const startTime = Date.now();

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

      // Generate prompts multiple times
      for (let i = 0; i < 50; i++) {
        const prompt = promptManager.generateAutofillPrompt(context, 'email', fieldContext);
        expect(prompt).toContain('intelligent autofill assistant');
        expect(prompt).toContain('John Doe');
        expect(prompt).toContain('Email Address');
      }

      const endTime = Date.now();
      const duration = endTime - startTime;

      // Should complete within 1000ms for 50 prompt generations
      expect(duration).toBeLessThan(1000);
    });

    test('should generate question prompts efficiently', () => {
      const startTime = Date.now();

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

      // Generate question prompts multiple times
      for (let i = 0; i < 50; i++) {
        const prompt = promptManager.generateQuestionPrompt(context, 'phone', fieldContext);
        expect(prompt).toContain('intelligent form assistant');
        expect(prompt).toContain('Phone Number');
        expect(prompt).toContain('Field Type: phone');
      }

      const endTime = Date.now();
      const duration = endTime - startTime;

      // Should complete within 1000ms for 50 question prompt generations
      expect(duration).toBeLessThan(1000);
    });

    test('should generate validation prompts efficiently', () => {
      const startTime = Date.now();

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

      // Generate validation prompts multiple times
      for (let i = 0; i < 50; i++) {
        const prompt = promptManager.generateValidationPrompt(context, 'email', 'john@example.com');
        expect(prompt).toContain('intelligent validation assistant');
        expect(prompt).toContain('john@example.com');
        expect(prompt).toContain('Field Type: email');
      }

      const endTime = Date.now();
      const duration = endTime - startTime;

      // Should complete within 1000ms for 50 validation prompt generations
      expect(duration).toBeLessThan(1000);
    });
  });

  describe('Response Parsing Performance', () => {
    test('should parse JSON responses efficiently', () => {
      const startTime = Date.now();

      const responses = [
        '{"success": true, "suggestion": "john@example.com", "confidence": 0.95, "source": "profile"}',
        '{"success": true, "question": "What is your phone number?", "field_type": "phone"}',
        '{"success": true, "valid": true, "corrected_value": "john@example.com", "feedback": "Valid email"}',
        '{"success": false, "error": "Invalid input format"}',
        '{"success": true, "suggestion": "john.doe@acmecorp.com", "confidence": 0.92, "source": "llm"}'
      ];

      // Parse responses multiple times
      for (let i = 0; i < 100; i++) {
        responses.forEach(response => {
          const result = promptManager.parseResponse(response, 'suggestion');
          expect(result.success).toBeDefined();
        });
      }

      const endTime = Date.now();
      const duration = endTime - startTime;

      // Should complete within 1000ms for 500 response parsings
      expect(duration).toBeLessThan(1000);
    });

    test('should parse text responses efficiently', () => {
      const startTime = Date.now();

      const textResponses = [
        'suggestion: john@example.com\nconfidence: 0.95',
        'question: What is your email address?',
        'valid: true\ncorrected_value: john@example.com',
        'error: Invalid input format',
        'suggestion: john.doe@acmecorp.com\nconfidence: 0.92'
      ];

      // Parse text responses multiple times
      for (let i = 0; i < 100; i++) {
        textResponses.forEach((response, index) => {
          const result = promptManager.parseResponse(response, 'suggestion');
          expect(result.success).toBeDefined();
        });
      }

      const endTime = Date.now();
      const duration = endTime - startTime;

      // Should complete within 1000ms for 500 text response parsings
      expect(duration).toBeLessThan(1000);
    });

    test('should handle malformed responses efficiently', () => {
      const startTime = Date.now();

      const malformedResponses = [
        'Invalid JSON response',
        '{"success": true, "suggestion": "test"', // Missing closing brace
        '{"success": false}', // Missing error field
        '', // Empty response
        null, // Null response
        undefined // Undefined response
      ];

      // Parse malformed responses multiple times
      for (let i = 0; i < 100; i++) {
        malformedResponses.forEach(response => {
          const result = promptManager.parseResponse(response, 'suggestion');
          expect(result.success).toBe(false);
          expect(result.error).toBeDefined();
        });
      }

      const endTime = Date.now();
      const duration = endTime - startTime;

      // Should complete within 1000ms for 600 malformed response parsings
      expect(duration).toBeLessThan(1000);
    });
  });

  describe('Memory Usage Performance', () => {
    test('should not leak memory during profile operations', async () => {
      const initialMemory = process.memoryUsage();

      // Perform many profile operations
      for (let i = 0; i < 1000; i++) {
        await profileManager.updateProfile('name', `User ${i}`);
        await profileManager.updateProfile('email', `user${i}@example.com`);
        await profileManager.categorizeUserInput(`User ${i}`, 'name');
        await profileManager.categorizeUserInput(`user${i}@example.com`, 'email');
      }

      const finalMemory = process.memoryUsage();
      const memoryIncrease = finalMemory.heapUsed - initialMemory.heapUsed;

      // Memory increase should be reasonable (less than 50MB)
      expect(memoryIncrease).toBeLessThan(50 * 1024 * 1024);
    });

    test('should not leak memory during context generation', () => {
      const initialMemory = process.memoryUsage();

      // Generate many contexts
      for (let i = 0; i < 10000; i++) {
        const userProfile = {
          name: `User ${i}`,
          email: `user${i}@example.com`,
          phone: `(555) ${i.toString().padStart(3, '0')}-4567`
        };

        const userContext = contextGenerator.generateUserContext(userProfile);
        const systemContext = contextGenerator.systemContext;
        const autofillContext = contextGenerator.generateAutofillContext({
          field_type: 'email',
          field_name: 'Email Address'
        });
      }

      const finalMemory = process.memoryUsage();
      const memoryIncrease = finalMemory.heapUsed - initialMemory.heapUsed;

      // Memory increase should be reasonable (less than 100MB)
      expect(memoryIncrease).toBeLessThan(100 * 1024 * 1024);
    });

    test('should not leak memory during prompt generation', () => {
      const initialMemory = process.memoryUsage();

      const context = {
        user_profile: {
          name: 'John Doe',
          email: 'john@example.com',
          phone: '(555) 123-4567'
        },
        system_context: {
          locale: 'en-US',
          country: 'US'
        },
        autofill_context: {
          field_type: 'email',
          field_name: 'Email Address'
        }
      };

      // Generate many prompts
      for (let i = 0; i < 10000; i++) {
        const prompt = promptManager.generateAutofillPrompt(context, 'email', {
          field_type: 'email',
          field_name: 'Email Address'
        });
      }

      const finalMemory = process.memoryUsage();
      const memoryIncrease = finalMemory.heapUsed - initialMemory.heapUsed;

      // Memory increase should be reasonable (less than 100MB)
      expect(memoryIncrease).toBeLessThan(100 * 1024 * 1024);
    });
  });

  describe('Concurrent Operations Performance', () => {
    test('should handle concurrent profile operations', async () => {
      const startTime = Date.now();

      // Create concurrent profile operations
      const operations = [];
      for (let i = 0; i < 100; i++) {
        operations.push(profileManager.updateProfile('name', `User ${i}`));
        operations.push(profileManager.updateProfile('email', `user${i}@example.com`));
        operations.push(profileManager.categorizeUserInput(`User ${i}`, 'name'));
        operations.push(profileManager.categorizeUserInput(`user${i}@example.com`, 'email'));
      }

      // Wait for all operations to complete
      const results = await Promise.all(operations);

      const endTime = Date.now();
      const duration = endTime - startTime;

      // Should complete within 5000ms for 400 concurrent operations
      expect(duration).toBeLessThan(5000);

      // Verify all operations were successful
      results.forEach(result => {
        expect(result.success).toBe(true);
      });
    });

    test('should handle concurrent context generation', async () => {
      const startTime = Date.now();

      // Create concurrent context generation operations
      const operations = [];
      for (let i = 0; i < 1000; i++) {
        const userProfile = {
          name: `User ${i}`,
          email: `user${i}@example.com`,
          phone: `(555) ${i.toString().padStart(3, '0')}-4567`
        };

        operations.push(Promise.resolve(contextGenerator.generateUserContext(userProfile)));
        operations.push(Promise.resolve(contextGenerator.systemContext));
        operations.push(Promise.resolve(contextGenerator.generateAutofillContext({
          field_type: 'email',
          field_name: 'Email Address'
        })));
      }

      // Wait for all operations to complete
      const results = await Promise.all(operations);

      const endTime = Date.now();
      const duration = endTime - startTime;

      // Should complete within 2000ms for 3000 concurrent operations
      expect(duration).toBeLessThan(2000);

      // Verify all operations were successful
      results.forEach(result => {
        expect(result).toBeDefined();
      });
    });

    test('should handle concurrent prompt generation', async () => {
      const startTime = Date.now();

      const context = {
        user_profile: {
          name: 'John Doe',
          email: 'john@example.com',
          phone: '(555) 123-4567'
        },
        system_context: {
          locale: 'en-US',
          country: 'US'
        },
        autofill_context: {
          field_type: 'email',
          field_name: 'Email Address'
        }
      };

      // Create concurrent prompt generation operations
      const operations = [];
      for (let i = 0; i < 1000; i++) {
        operations.push(Promise.resolve(promptManager.generateAutofillPrompt(context, 'email', {
          field_type: 'email',
          field_name: 'Email Address'
        })));
        operations.push(Promise.resolve(promptManager.generateQuestionPrompt(context, 'phone', {
          field_type: 'phone',
          field_name: 'Phone Number'
        })));
        operations.push(Promise.resolve(promptManager.generateValidationPrompt(context, 'email', 'john@example.com')));
      }

      // Wait for all operations to complete
      const results = await Promise.all(operations);

      const endTime = Date.now();
      const duration = endTime - startTime;

      // Should complete within 2000ms for 3000 concurrent operations
      expect(duration).toBeLessThan(2000);

      // Verify all operations were successful
      results.forEach(result => {
        expect(result).toBeDefined();
        expect(typeof result).toBe('string');
      });
    });
  });
});

