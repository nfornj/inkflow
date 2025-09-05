/**
 * Unit Tests for Prompt Manager
 * Phase 7 Implementation
 */

const { jest } = require('@jest/globals');
const PromptManager = require('../main/prompt-manager');

describe('PromptManager', () => {
  let promptManager;

  beforeEach(() => {
    promptManager = new PromptManager();
  });

  describe('Initialization', () => {
    test('should initialize with system prompts', () => {
      expect(promptManager.systemPrompts).toBeDefined();
      expect(promptManager.systemPrompts.autofill).toBeDefined();
      expect(promptManager.systemPrompts.question).toBeDefined();
      expect(promptManager.systemPrompts.validation).toBeDefined();
    });

    test('should initialize with field templates', () => {
      expect(promptManager.fieldTemplates).toBeDefined();
      expect(promptManager.fieldTemplates.email).toBeDefined();
      expect(promptManager.fieldTemplates.phone).toBeDefined();
      expect(promptManager.fieldTemplates.name).toBeDefined();
      expect(promptManager.fieldTemplates['address.street']).toBeDefined();
    });

    test('should initialize with response formats', () => {
      expect(promptManager.responseFormats).toBeDefined();
      expect(promptManager.responseFormats.suggestion).toBeDefined();
      expect(promptManager.responseFormats.question).toBeDefined();
      expect(promptManager.responseFormats.validation).toBeDefined();
    });
  });

  describe('Autofill Prompt Generation', () => {
    test('should generate autofill prompt for email field', () => {
      const context = {
        user_profile: {
          name: 'John Doe',
          email: 'john@example.com',
          phone: '(555) 123-4567'
        },
        system_context: {
          current_date: '2025-01-03',
          locale: 'en-US',
          country: 'US',
          currency: 'USD'
        },
        autofill_context: {
          field_type: 'email',
          field_name: 'Email Address',
          field_importance: 'high',
          required: true
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
      expect(prompt).toContain('Email Address');
      expect(prompt).toContain('Field Type: email');
      expect(prompt).toContain('Generate an email address suggestion');
      expect(prompt).toContain('{"success": true');
    });

    test('should generate autofill prompt for phone field', () => {
      const context = {
        user_profile: {
          name: 'John Doe',
          phone: '(555) 123-4567'
        },
        system_context: {
          locale: 'en-US',
          country: 'US'
        },
        autofill_context: {
          field_type: 'phone',
          field_name: 'Phone Number'
        }
      };

      const fieldContext = {
        field_type: 'phone',
        field_name: 'Phone Number'
      };

      const prompt = promptManager.generateAutofillPrompt(context, 'phone', fieldContext);

      expect(prompt).toContain('Generate a phone number suggestion');
      expect(prompt).toContain('(555) 123-4567');
      expect(prompt).toContain('Field Type: phone');
      expect(prompt).toContain('country_format');
    });

    test('should generate autofill prompt for address field', () => {
      const context = {
        user_profile: {
          name: 'John Doe',
          address: {
            street: '123 Main St',
            city: 'New York',
            province: 'NY',
            postal_code: '10001'
          }
        },
        system_context: {
          locale: 'en-US',
          country: 'US'
        },
        autofill_context: {
          field_type: 'address.street',
          field_name: 'Street Address'
        }
      };

      const fieldContext = {
        field_type: 'address.street',
        field_name: 'Street Address'
      };

      const prompt = promptManager.generateAutofillPrompt(context, 'address.street', fieldContext);

      expect(prompt).toContain('Generate a street address suggestion');
      expect(prompt).toContain('123 Main St');
      expect(prompt).toContain('New York');
      expect(prompt).toContain('Field Type: address.street');
    });
  });

  describe('Question Prompt Generation', () => {
    test('should generate question prompt for missing email', () => {
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
          field_name: 'Email Address',
          required: true
        }
      };

      const fieldContext = {
        field_type: 'email',
        field_name: 'Email Address',
        required: true
      };

      const prompt = promptManager.generateQuestionPrompt(context, 'email', fieldContext);

      expect(prompt).toContain('intelligent form assistant');
      expect(prompt).toContain('missing information');
      expect(prompt).toContain('Email Address');
      expect(prompt).toContain('Field Type: email');
      expect(prompt).toContain('{"success": true');
    });

    test('should generate question prompt for missing phone', () => {
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
          required: true
        }
      };

      const fieldContext = {
        field_type: 'phone',
        field_name: 'Phone Number',
        required: true
      };

      const prompt = promptManager.generateQuestionPrompt(context, 'phone', fieldContext);

      expect(prompt).toContain('What is your phone number?');
      expect(prompt).toContain('Phone Number');
      expect(prompt).toContain('Field Type: phone');
    });
  });

  describe('Validation Prompt Generation', () => {
    test('should generate validation prompt for email input', () => {
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
      expect(prompt).toContain('{"success": true');
    });

    test('should generate validation prompt for phone input', () => {
      const context = {
        user_profile: {
          name: 'John Doe'
        },
        system_context: {
          locale: 'en-US',
          country: 'US'
        },
        autofill_context: {
          field_type: 'phone',
          userInput: '555-123-4567'
        }
      };

      const prompt = promptManager.generateValidationPrompt(context, 'phone', '555-123-4567');

      expect(prompt).toContain('555-123-4567');
      expect(prompt).toContain('Field Type: phone');
      expect(prompt).toContain('validate the user\'s input');
    });
  });

  describe('Response Parsing', () => {
    test('should parse valid JSON suggestion response', () => {
      const response = '{"success": true, "suggestion": "john@example.com", "confidence": 0.95, "source": "profile"}';
      const result = promptManager.parseResponse(response, 'suggestion');

      expect(result.success).toBe(true);
      expect(result.suggestion).toBe('john@example.com');
      expect(result.confidence).toBe(0.95);
      expect(result.source).toBe('profile');
    });

    test('should parse valid JSON question response', () => {
      const response = '{"success": true, "question": "What is your email address?", "field_type": "email"}';
      const result = promptManager.parseResponse(response, 'question');

      expect(result.success).toBe(true);
      expect(result.question).toBe('What is your email address?');
      expect(result.field_type).toBe('email');
    });

    test('should parse valid JSON validation response', () => {
      const response = '{"success": true, "valid": true, "corrected_value": "john@example.com", "feedback": "Valid email format"}';
      const result = promptManager.parseResponse(response, 'validation');

      expect(result.success).toBe(true);
      expect(result.valid).toBe(true);
      expect(result.corrected_value).toBe('john@example.com');
      expect(result.feedback).toBe('Valid email format');
    });

    test('should handle malformed JSON response', () => {
      const response = '{"success": true, "suggestion": "john@example.com", "confidence": 0.95'; // Missing closing brace
      const result = promptManager.parseResponse(response, 'suggestion');

      expect(result.success).toBe(false);
      expect(result.error).toContain('Failed to parse response');
    });

    test('should handle text response with suggestion pattern', () => {
      const response = 'suggestion: john@example.com\nconfidence: 0.95';
      const result = promptManager.parseResponse(response, 'suggestion');

      expect(result.success).toBe(true);
      expect(result.suggestion).toBe('john@example.com');
      expect(result.confidence).toBe(0.8);
      expect(result.source).toBe('llm');
    });

    test('should handle text response with question pattern', () => {
      const response = 'question: What is your email address?';
      const result = promptManager.parseResponse(response, 'question');

      expect(result.success).toBe(true);
      expect(result.question).toBe('What is your email address?');
      expect(result.field_type).toBe('unknown');
    });

    test('should handle empty response', () => {
      const response = '';
      const result = promptManager.parseResponse(response, 'suggestion');

      expect(result.success).toBe(false);
      expect(result.error).toContain('Could not parse response');
    });
  });

  describe('Context Building', () => {
    test('should build context summary with complete profile', () => {
      const userProfile = {
        name: 'John Doe',
        email: 'john@example.com',
        phone: '(555) 123-4567',
        address: {
          street: '123 Main St',
          city: 'New York',
          province: 'NY',
          postal_code: '10001'
        },
        company: 'Acme Corp',
        job_title: 'Software Engineer'
      };

      const systemContext = {
        current_date: '2025-01-03',
        locale: 'en-US',
        country: 'US',
        currency: 'USD'
      };

      const autofillContext = {
        field_type: 'email',
        field_name: 'Email Address'
      };

      const summary = promptManager.buildContextSummary(userProfile, systemContext, autofillContext);

      expect(summary).toContain('John Doe');
      expect(summary).toContain('john@example.com');
      expect(summary).toContain('(555) 123-4567');
      expect(summary).toContain('123 Main St, New York, NY, 10001');
      expect(summary).toContain('Acme Corp');
      expect(summary).toContain('Software Engineer');
      expect(summary).toContain('2025-01-03');
      expect(summary).toContain('en-US');
      expect(summary).toContain('US');
      expect(summary).toContain('USD');
    });

    test('should build context summary with minimal profile', () => {
      const userProfile = {
        name: 'John Doe'
      };

      const systemContext = {
        current_date: '2025-01-03',
        locale: 'en-US',
        country: 'US'
      };

      const autofillContext = {
        field_type: 'email'
      };

      const summary = promptManager.buildContextSummary(userProfile, systemContext, autofillContext);

      expect(summary).toContain('John Doe');
      expect(summary).toContain('2025-01-03');
      expect(summary).toContain('en-US');
      expect(summary).toContain('US');
    });

    test('should build field instructions correctly', () => {
      const template = {
        instructions: 'Generate email suggestion',
        examples: 'john@example.com',
        formatting_hints: ['lowercase', 'no_spaces'],
        validation_rules: { pattern: 'email', required: true }
      };

      const fieldType = 'email';
      const fieldContext = {
        field_name: 'Email Address',
        field_importance: 'high',
        required: true
      };

      const instructions = promptManager.buildFieldInstructions(template, fieldType, fieldContext);

      expect(instructions).toContain('Field Type: email');
      expect(instructions).toContain('Field Name: Email Address');
      expect(instructions).toContain('Field Importance: high');
      expect(instructions).toContain('Required: true');
      expect(instructions).toContain('lowercase, no_spaces');
      expect(instructions).toContain('{"pattern":"email","required":true}');
    });

    test('should build available data section', () => {
      const autofillContext = {
        available_data: [
          { source: 'profile', value: 'john@example.com', confidence: 0.95 },
          { source: 'related_field', value: 'john.doe@example.com', confidence: 0.85 }
        ],
        related_fields: ['name', 'company'],
        fallback_options: [
          { type: 'common', value: 'john@company.com' },
          { type: 'pattern', value: 'j.doe@example.com' }
        ]
      };

      const fieldType = 'email';

      const data = promptManager.buildAvailableData(autofillContext, fieldType);

      expect(data).toContain('Direct matches:');
      expect(data).toContain('profile: john@example.com (confidence: 0.95)');
      expect(data).toContain('related_field: john.doe@example.com (confidence: 0.85)');
      expect(data).toContain('Related fields: name, company');
      expect(data).toContain('Fallback options:');
      expect(data).toContain('common: john@company.com');
      expect(data).toContain('pattern: j.doe@example.com');
    });
  });

  describe('Field Templates', () => {
    test('should have email template with correct properties', () => {
      const template = promptManager.getEmailTemplate();

      expect(template.instructions).toContain('email address suggestion');
      expect(template.examples).toContain('john.smith@gmail.com');
      expect(template.formatting_hints).toContain('lowercase');
      expect(template.formatting_hints).toContain('no_spaces');
      expect(template.validation_rules.pattern).toBe('email');
      expect(template.validation_rules.required).toBe(true);
    });

    test('should have phone template with correct properties', () => {
      const template = promptManager.getPhoneTemplate();

      expect(template.instructions).toContain('phone number suggestion');
      expect(template.examples).toContain('(555) 123-4567');
      expect(template.formatting_hints).toContain('country_format');
      expect(template.formatting_hints).toContain('parentheses');
      expect(template.validation_rules.pattern).toBe('phone');
      expect(template.validation_rules.required).toBe(true);
    });

    test('should have name template with correct properties', () => {
      const template = promptManager.getNameTemplate();

      expect(template.instructions).toContain('name suggestion');
      expect(template.examples).toContain('John Smith');
      expect(template.formatting_hints).toContain('proper_case');
      expect(template.formatting_hints).toContain('no_numbers');
      expect(template.validation_rules.pattern).toBe('letters_only');
      expect(template.validation_rules.required).toBe(true);
    });

    test('should have generic template for unknown field types', () => {
      const template = promptManager.getGenericTemplate();

      expect(template.instructions).toContain('suggestion for this field');
      expect(template.formatting_hints).toContain('text');
      expect(template.validation_rules.pattern).toBe('text');
      expect(template.validation_rules.required).toBe(false);
    });
  });

  describe('Response Formats', () => {
    test('should have correct suggestion response format', () => {
      const format = promptManager.getSuggestionFormat();

      expect(format).toContain('"success": true');
      expect(format).toContain('"suggestion": "suggested_value"');
      expect(format).toContain('"confidence": 0.95');
      expect(format).toContain('"source": "profile|related_field|fallback|llm"');
      expect(format).toContain('"reasoning": "Brief explanation"');
    });

    test('should have correct question response format', () => {
      const format = promptManager.getQuestionFormat();

      expect(format).toContain('"success": true');
      expect(format).toContain('"question": "What is your [field_name]?"');
      expect(format).toContain('"field_type": "field_type"');
      expect(format).toContain('"reasoning": "Brief explanation"');
    });

    test('should have correct validation response format', () => {
      const format = promptManager.getValidationFormat();

      expect(format).toContain('"success": true');
      expect(format).toContain('"valid": true');
      expect(format).toContain('"corrected_value": "corrected_value_if_needed"');
      expect(format).toContain('"feedback": "Helpful feedback for the user"');
      expect(format).toContain('"suggestions": ["suggestion1", "suggestion2"]');
    });
  });
});

