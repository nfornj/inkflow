/**
 * Prompt Manager - Handles LLM prompt engineering and response formatting
 * Phase 5 Implementation
 */

class PromptManager {
  constructor() {
    this.systemPrompts = {
      autofill: this.getAutofillSystemPrompt(),
      question: this.getQuestionSystemPrompt(),
      validation: this.getValidationSystemPrompt()
    };
    
    this.fieldTemplates = {
      'email': this.getEmailTemplate(),
      'phone': this.getPhoneTemplate(),
      'name': this.getNameTemplate(),
      'address.street': this.getStreetTemplate(),
      'address.city': this.getCityTemplate(),
      'address.province': this.getProvinceTemplate(),
      'address.postal_code': this.getPostalCodeTemplate(),
      'company': this.getCompanyTemplate(),
      'job_title': this.getJobTitleTemplate(),
      'date_of_birth': this.getDateTemplate()
    };
    
    this.responseFormats = {
      suggestion: this.getSuggestionFormat(),
      question: this.getQuestionFormat(),
      validation: this.getValidationFormat()
    };
  }

  /**
   * Generate autofill prompt for a field
   * @param {Object} context - Complete context object
   * @param {string} fieldType - Type of field to fill
   * @param {Object} fieldContext - Field-specific context
   * @returns {string} - Formatted prompt
   */
  generateAutofillPrompt(context, fieldType, fieldContext) {
    const template = this.fieldTemplates[fieldType] || this.getGenericTemplate();
    const systemPrompt = this.systemPrompts.autofill;
    
    return this.formatPrompt(systemPrompt, template, context, fieldType, fieldContext);
  }

  /**
   * Generate question prompt for missing information
   * @param {Object} context - Complete context object
   * @param {string} fieldType - Type of field to ask about
   * @param {Object} fieldContext - Field-specific context
   * @returns {string} - Formatted prompt
   */
  generateQuestionPrompt(context, fieldType, fieldContext) {
    const template = this.fieldTemplates[fieldType] || this.getGenericTemplate();
    const systemPrompt = this.systemPrompts.question;
    
    return this.formatPrompt(systemPrompt, template, context, fieldType, fieldContext);
  }

  /**
   * Generate validation prompt for user input
   * @param {Object} context - Complete context object
   * @param {string} fieldType - Type of field to validate
   * @param {string} userInput - User input to validate
   * @returns {string} - Formatted prompt
   */
  generateValidationPrompt(context, fieldType, userInput) {
    const template = this.fieldTemplates[fieldType] || this.getGenericTemplate();
    const systemPrompt = this.systemPrompts.validation;
    
    return this.formatPrompt(systemPrompt, template, context, fieldType, { userInput });
  }

  /**
   * Format prompt with context and template
   * @param {string} systemPrompt - System prompt
   * @param {Object} template - Field template
   * @param {Object} context - Complete context
   * @param {string} fieldType - Field type
   * @param {Object} fieldContext - Field-specific context
   * @returns {string} - Formatted prompt
   */
  formatPrompt(systemPrompt, template, context, fieldType, fieldContext) {
    const userProfile = context.user_profile || {};
    const systemContext = context.system_context || {};
    const autofillContext = context.autofill_context || {};
    
    // Build context summary
    const contextSummary = this.buildContextSummary(userProfile, systemContext, autofillContext);
    
    // Build field-specific instructions
    const fieldInstructions = this.buildFieldInstructions(template, fieldType, fieldContext);
    
    // Build available data
    const availableData = this.buildAvailableData(autofillContext, fieldType);
    
    // Combine all parts
    return `${systemPrompt}

${contextSummary}

${fieldInstructions}

${availableData}

${template.instructions}

${template.examples}

Please provide your response in the following format:
${this.responseFormats.suggestion}`;
  }

  /**
   * Build context summary for prompt
   * @param {Object} userProfile - User profile data
   * @param {Object} systemContext - System context
   * @param {Object} autofillContext - Autofill context
   * @returns {string} - Context summary
   */
  buildContextSummary(userProfile, systemContext, autofillContext) {
    let summary = "## USER PROFILE CONTEXT\n";
    
    // Personal information
    if (userProfile.name) summary += `- Name: ${userProfile.name}\n`;
    if (userProfile.email) summary += `- Email: ${userProfile.email}\n`;
    if (userProfile.phone) summary += `- Phone: ${userProfile.phone}\n`;
    
    // Address information
    if (userProfile.address) {
      summary += `- Address: `;
      const addressParts = [];
      if (userProfile.address.street) addressParts.push(userProfile.address.street);
      if (userProfile.address.city) addressParts.push(userProfile.address.city);
      if (userProfile.address.province) addressParts.push(userProfile.address.province);
      if (userProfile.address.postal_code) addressParts.push(userProfile.address.postal_code);
      summary += addressParts.join(', ') + '\n';
    }
    
    // Professional information
    if (userProfile.company) summary += `- Company: ${userProfile.company}\n`;
    if (userProfile.job_title) summary += `- Job Title: ${userProfile.job_title}\n`;
    
    // System context
    summary += `\n## SYSTEM CONTEXT\n`;
    summary += `- Current Date: ${systemContext.current_date}\n`;
    summary += `- Locale: ${systemContext.locale}\n`;
    summary += `- Country: ${systemContext.country}\n`;
    summary += `- Currency: ${systemContext.currency}\n`;
    
    // Profile completeness
    if (userProfile.profile_completeness) {
      summary += `- Profile Completeness: ${userProfile.profile_completeness}%\n`;
    }
    
    return summary;
  }

  /**
   * Build field-specific instructions
   * @param {Object} template - Field template
   * @param {string} fieldType - Field type
   * @param {Object} fieldContext - Field-specific context
   * @returns {string} - Field instructions
   */
  buildFieldInstructions(template, fieldType, fieldContext) {
    let instructions = `## FIELD INSTRUCTIONS\n`;
    instructions += `- Field Type: ${fieldType}\n`;
    instructions += `- Field Name: ${fieldContext.field_name || 'Unknown'}\n`;
    instructions += `- Field Importance: ${fieldContext.field_importance || 'medium'}\n`;
    instructions += `- Required: ${fieldContext.required || false}\n`;
    
    if (template.formatting_hints && template.formatting_hints.length > 0) {
      instructions += `- Formatting Hints: ${template.formatting_hints.join(', ')}\n`;
    }
    
    if (template.validation_rules) {
      instructions += `- Validation Rules: ${JSON.stringify(template.validation_rules)}\n`;
    }
    
    return instructions;
  }

  /**
   * Build available data section
   * @param {Object} autofillContext - Autofill context
   * @param {string} fieldType - Field type
   * @returns {string} - Available data section
   */
  buildAvailableData(autofillContext, fieldType) {
    let data = `## AVAILABLE DATA\n`;
    
    if (autofillContext.available_data && autofillContext.available_data.length > 0) {
      data += `Direct matches:\n`;
      autofillContext.available_data.forEach(item => {
        data += `- ${item.source}: ${item.value} (confidence: ${item.confidence})\n`;
      });
    }
    
    if (autofillContext.related_fields && autofillContext.related_fields.length > 0) {
      data += `\nRelated fields: ${autofillContext.related_fields.join(', ')}\n`;
    }
    
    if (autofillContext.fallback_options && autofillContext.fallback_options.length > 0) {
      data += `\nFallback options:\n`;
      autofillContext.fallback_options.forEach(option => {
        data += `- ${option.type}: ${option.value}\n`;
      });
    }
    
    return data;
  }

  /**
   * Parse LLM response
   * @param {string} response - Raw LLM response
   * @param {string} expectedFormat - Expected response format
   * @returns {Object} - Parsed response
   */
  parseResponse(response, expectedFormat = 'suggestion') {
    try {
      // Try to parse as JSON first
      if (response.trim().startsWith('{')) {
        return JSON.parse(response);
      }
      
      // Try to extract JSON from response
      const jsonMatch = response.match(/\{[\s\S]*\}/);
      if (jsonMatch) {
        return JSON.parse(jsonMatch[0]);
      }
      
      // Fallback to text parsing
      return this.parseTextResponse(response, expectedFormat);
      
    } catch (error) {
      console.error('Failed to parse LLM response:', error);
      return {
        success: false,
        error: 'Failed to parse response',
        raw_response: response
      };
    }
  }

  /**
   * Parse text response when JSON parsing fails
   * @param {string} response - Raw response text
   * @param {string} expectedFormat - Expected format
   * @returns {Object} - Parsed response
   */
  parseTextResponse(response, expectedFormat) {
    const lines = response.split('\n').map(line => line.trim()).filter(line => line);
    
    if (expectedFormat === 'suggestion') {
      // Look for suggestion patterns
      const suggestionMatch = response.match(/suggestion[:\s]+(.+)/i);
      const valueMatch = response.match(/value[:\s]+(.+)/i);
      
      if (suggestionMatch || valueMatch) {
        return {
          success: true,
          suggestion: suggestionMatch ? suggestionMatch[1].trim() : valueMatch[1].trim(),
          confidence: 0.8,
          source: 'llm'
        };
      }
    }
    
    if (expectedFormat === 'question') {
      // Look for question patterns
      const questionMatch = response.match(/question[:\s]+(.+)/i);
      
      if (questionMatch) {
        return {
          success: true,
          question: questionMatch[1].trim(),
          field_type: 'unknown'
        };
      }
    }
    
    // Default fallback
    return {
      success: false,
      error: 'Could not parse response',
      raw_response: response
    };
  }

  /**
   * Get autofill system prompt
   * @returns {string} - System prompt
   */
  getAutofillSystemPrompt() {
    return `You are an intelligent autofill assistant that helps users fill out forms by suggesting appropriate values based on their profile and context.

Your task is to analyze the user's profile data and provide the most appropriate suggestion for the requested field.

Guidelines:
1. Use the user's profile data as the primary source for suggestions
2. Consider the field type, formatting requirements, and validation rules
3. Provide suggestions that are contextually appropriate and accurate
4. If no suitable data is available, suggest asking the user for the information
5. Always respect the user's privacy and data preferences
6. Format suggestions according to the field's requirements
7. Consider the user's locale and cultural context

Response format: Provide your response as a JSON object with the following structure:
- success: boolean indicating if a suggestion was found
- suggestion: the suggested value (if available)
- confidence: confidence score from 0.0 to 1.0
- source: where the suggestion came from (profile, related_field, fallback, etc.)
- reasoning: brief explanation of why this suggestion was made`;
  }

  /**
   * Get question system prompt
   * @returns {string} - System prompt
   */
  getQuestionSystemPrompt() {
    return `You are an intelligent form assistant that helps users by asking for missing information in a natural, conversational way.

Your task is to generate a helpful question that will prompt the user to provide the missing information for the requested field.

Guidelines:
1. Ask questions in a natural, conversational tone
2. Be specific about what information is needed
3. Provide context about why the information is important
4. Consider the user's locale and cultural context
5. Keep questions concise but informative
6. Avoid being pushy or demanding

Response format: Provide your response as a JSON object with the following structure:
- success: boolean indicating if a question was generated
- question: the question to ask the user
- field_type: the type of field being asked about
- reasoning: brief explanation of why this question was chosen`;
  }

  /**
   * Get validation system prompt
   * @returns {string} - System prompt
   */
  getValidationSystemPrompt() {
    return `You are an intelligent validation assistant that helps verify and improve user input for form fields.

Your task is to validate the user's input and provide feedback or corrections if needed.

Guidelines:
1. Validate the input against the field's requirements
2. Check format, length, and content appropriateness
3. Provide helpful feedback for invalid input
4. Suggest corrections when possible
5. Be encouraging and constructive in your feedback
6. Consider the user's locale and cultural context

Response format: Provide your response as a JSON object with the following structure:
- success: boolean indicating if the input is valid
- valid: boolean indicating if the input passes validation
- corrected_value: the corrected value (if applicable)
- feedback: helpful feedback for the user
- suggestions: array of improvement suggestions`;
  }

  /**
   * Get email field template
   * @returns {Object} - Email template
   */
  getEmailTemplate() {
    return {
      instructions: `Generate an email address suggestion based on the user's profile. Consider:
- Use the user's name to generate a professional email
- Consider common email patterns (firstname.lastname@domain.com)
- Use appropriate domains based on the user's context
- Ensure the email follows proper format`,
      examples: `Examples:
- Name: John Smith → john.smith@gmail.com
- Name: Jane Doe, Company: Acme Corp → jane.doe@acmecorp.com
- Name: Bob Johnson → b.johnson@outlook.com`,
      formatting_hints: ['lowercase', 'no_spaces'],
      validation_rules: { pattern: 'email', required: true }
    };
  }

  /**
   * Get phone field template
   * @returns {Object} - Phone template
   */
  getPhoneTemplate() {
    return {
      instructions: `Generate a phone number suggestion based on the user's profile. Consider:
- Use the user's existing phone number if available
- Format according to the user's locale
- Consider the field's formatting requirements
- Ensure the number is valid for the user's country`,
      examples: `Examples:
- US: (555) 123-4567
- Canada: (416) 555-1234
- UK: 020 7946 0958
- International: +1 (555) 123-4567`,
      formatting_hints: ['country_format', 'parentheses', 'hyphens'],
      validation_rules: { pattern: 'phone', required: true }
    };
  }

  /**
   * Get name field template
   * @returns {Object} - Name template
   */
  getNameTemplate() {
    return {
      instructions: `Generate a name suggestion based on the user's profile. Consider:
- Use the user's full name if available
- Format with proper capitalization
- Consider cultural naming conventions
- Ensure the name is complete and professional`,
      examples: `Examples:
- First Last → John Smith
- Full Name → Dr. Jane Doe
- Professional → Prof. Robert Johnson`,
      formatting_hints: ['proper_case', 'no_numbers'],
      validation_rules: { pattern: 'letters_only', min_length: 2, required: true }
    };
  }

  /**
   * Get street address template
   * @returns {Object} - Street template
   */
  getStreetTemplate() {
    return {
      instructions: `Generate a street address suggestion based on the user's profile. Consider:
- Use the user's existing address if available
- Format according to local conventions
- Include house number and street name
- Consider the user's locale and address format`,
      examples: `Examples:
- US: 123 Main Street
- Canada: 456 King Street East
- UK: 789 High Street
- International: 321 Via Roma`,
      formatting_hints: ['proper_case', 'numbers_allowed'],
      validation_rules: { pattern: 'address', required: true }
    };
  }

  /**
   * Get city template
   * @returns {Object} - City template
   */
  getCityTemplate() {
    return {
      instructions: `Generate a city suggestion based on the user's profile. Consider:
- Use the user's existing city if available
- Consider related address information
- Format with proper capitalization
- Consider the user's locale and cultural context`,
      examples: `Examples:
- Toronto, ON
- New York, NY
- London, UK
- Tokyo, Japan`,
      formatting_hints: ['proper_case'],
      validation_rules: { pattern: 'letters_only', required: true }
    };
  }

  /**
   * Get province/state template
   * @returns {Object} - Province template
   */
  getProvinceTemplate() {
    return {
      instructions: `Generate a province/state suggestion based on the user's profile. Consider:
- Use the user's existing province/state if available
- Consider related address information
- Use standard abbreviations when appropriate
- Consider the user's country and locale`,
      examples: `Examples:
- Canada: ON, BC, AB
- US: CA, TX, NY
- UK: England, Scotland, Wales
- Australia: NSW, VIC, QLD`,
      formatting_hints: ['abbreviation', 'uppercase'],
      validation_rules: { pattern: 'province', required: true }
    };
  }

  /**
   * Get postal code template
   * @returns {Object} - Postal code template
   */
  getPostalCodeTemplate() {
    return {
      instructions: `Generate a postal/zip code suggestion based on the user's profile. Consider:
- Use the user's existing postal code if available
- Consider related address information
- Format according to the user's country
- Ensure the format is correct for the user's locale`,
      examples: `Examples:
- US: 12345 or 12345-6789
- Canada: A1A 1A1
- UK: SW1A 1AA
- Germany: 12345`,
      formatting_hints: ['country_format', 'uppercase'],
      validation_rules: { pattern: 'postal_code', required: true }
    };
  }

  /**
   * Get company template
   * @returns {Object} - Company template
   */
  getCompanyTemplate() {
    return {
      instructions: `Generate a company name suggestion based on the user's profile. Consider:
- Use the user's existing company if available
- Consider the user's job title and industry
- Format with proper capitalization
- Consider the user's professional context`,
      examples: `Examples:
- Acme Corporation
- Microsoft Inc.
- Google LLC
- Local Business Co.`,
      formatting_hints: ['proper_case'],
      validation_rules: { pattern: 'text', required: false }
    };
  }

  /**
   * Get job title template
   * @returns {Object} - Job title template
   */
  getJobTitleTemplate() {
    return {
      instructions: `Generate a job title suggestion based on the user's profile. Consider:
- Use the user's existing job title if available
- Consider the user's company and industry
- Format with proper capitalization
- Consider the user's professional level`,
      examples: `Examples:
- Software Engineer
- Marketing Manager
- Sales Director
- Senior Developer`,
      formatting_hints: ['proper_case'],
      validation_rules: { pattern: 'text', required: false }
    };
  }

  /**
   * Get date template
   * @returns {Object} - Date template
   */
  getDateTemplate() {
    return {
      instructions: `Generate a date suggestion based on the user's profile. Consider:
- Use the user's existing date if available
- Consider the field's purpose (birth date, etc.)
- Format according to the user's locale
- Ensure the date is reasonable and valid`,
      examples: `Examples:
- US: 01/15/1990
- Canada: 1990-01-15
- UK: 15/01/1990
- International: 1990-01-15`,
      formatting_hints: ['locale_format'],
      validation_rules: { pattern: 'date', required: false }
    };
  }

  /**
   * Get generic template for unknown field types
   * @returns {Object} - Generic template
   */
  getGenericTemplate() {
    return {
      instructions: `Generate a suggestion for this field based on the user's profile. Consider:
- Use any relevant information from the user's profile
- Consider the field's context and purpose
- Format appropriately for the field type
- Provide a helpful suggestion if possible`,
      examples: `Examples:
- Use profile data when available
- Consider related information
- Format according to field requirements`,
      formatting_hints: ['text'],
      validation_rules: { pattern: 'text', required: false }
    };
  }

  /**
   * Get suggestion response format
   * @returns {string} - Response format
   */
  getSuggestionFormat() {
    return `{
  "success": true,
  "suggestion": "suggested_value",
  "confidence": 0.95,
  "source": "profile|related_field|fallback|llm",
  "reasoning": "Brief explanation of why this suggestion was made"
}`;
  }

  /**
   * Get question response format
   * @returns {string} - Response format
   */
  getQuestionFormat() {
    return `{
  "success": true,
  "question": "What is your [field_name]?",
  "field_type": "field_type",
  "reasoning": "Brief explanation of why this question was chosen"
}`;
  }

  /**
   * Get validation response format
   * @returns {string} - Response format
   */
  getValidationFormat() {
    return `{
  "success": true,
  "valid": true,
  "corrected_value": "corrected_value_if_needed",
  "feedback": "Helpful feedback for the user",
  "suggestions": ["suggestion1", "suggestion2"]
}`;
  }
}

module.exports = PromptManager;

