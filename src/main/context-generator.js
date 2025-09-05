/**
 * Context Generator - Generates rich context for LLM prompts
 * Phase 4 Implementation
 */

class ContextGenerator {
  constructor() {
    // Detect user's locale and country automatically
    const userLocale = Intl.DateTimeFormat().resolvedOptions().locale;
    const userCountry = this.detectCountryFromLocale(userLocale);
    
    this.systemContext = {
      currentDate: new Date().toISOString().split('T')[0],
      currentTime: new Date().toTimeString().split(' ')[0],
      timezone: Intl.DateTimeFormat().resolvedOptions().timeZone,
      locale: userLocale,
      country: userCountry,
      currency: this.getCurrencyForCountry(userCountry),
      dateFormat: this.getDateFormatForLocale(userLocale),
      phoneFormat: this.getPhoneFormatForCountry(userCountry)
    };
  }

  /**
   * Generate comprehensive context for LLM
   * @param {Object} userProfile - User profile data
   * @param {Object} fieldContext - Field-specific context
   * @param {Object} additionalContext - Additional context data
   * @returns {Object} - Complete context object
   */
  generateContext(userProfile, fieldContext, additionalContext = {}) {
    try {
      const context = {
        user_profile: this.enhanceUserProfile(userProfile),
        system_context: this.generateSystemContext(additionalContext),
        field_context: this.enhanceFieldContext(fieldContext),
        autofill_context: this.generateAutofillContext(userProfile, fieldContext),
        metadata: {
          generated_at: new Date().toISOString(),
          context_version: '1.0',
          locale: this.systemContext.locale
        }
      };

      console.log('Context generated successfully');
      return context;

    } catch (error) {
      console.error('Failed to generate context:', error);
      throw error;
    }
  }

  /**
   * Enhance user profile with additional metadata
   * @param {Object} profile - User profile
   * @returns {Object} - Enhanced profile
   */
  enhanceUserProfile(profile) {
    const enhanced = { ...profile };
    
    // Add profile completeness score
    enhanced.profile_completeness = this.calculateProfileCompleteness(profile);
    
    // Add data quality indicators
    enhanced.data_quality = this.assessDataQuality(profile);
    
    // Add location context
    if (profile.address) {
      enhanced.location_context = this.generateLocationContext(profile.address);
    }
    
    // Add professional context
    if (profile.company || profile.job_title) {
      enhanced.professional_context = this.generateProfessionalContext(profile);
    }
    
    return enhanced;
  }

  /**
   * Generate system context with current information
   * @param {Object} additionalContext - Additional context
   * @returns {Object} - System context
   */
  generateSystemContext(additionalContext = {}) {
    const now = new Date();
    
    return {
      ...this.systemContext,
      current_date: now.toISOString().split('T')[0],
      current_time: now.toTimeString().split(' ')[0],
      day_of_week: now.toLocaleDateString('en-CA', { weekday: 'long' }),
      month: now.toLocaleDateString('en-CA', { month: 'long' }),
      year: now.getFullYear(),
      season: this.getCurrentSeason(now),
      business_hours: this.isBusinessHours(now),
      ...additionalContext
    };
  }

  /**
   * Enhance field context with additional information
   * @param {Object} fieldContext - Field context
   * @returns {Object} - Enhanced field context
   */
  enhanceFieldContext(fieldContext) {
    const enhanced = { ...fieldContext };
    
    // Add field type confidence
    enhanced.field_type_confidence = this.calculateFieldTypeConfidence(fieldContext);
    
    // Add field importance
    enhanced.field_importance = this.calculateFieldImportance(fieldContext);
    
    // Add formatting hints
    enhanced.formatting_hints = this.getFormattingHints(fieldContext);
    
    // Add validation rules
    enhanced.validation_rules = this.getValidationRules(fieldContext);
    
    return enhanced;
  }

  /**
   * Generate autofill-specific context
   * @param {Object} userProfile - User profile
   * @param {Object} fieldContext - Field context
   * @returns {Object} - Autofill context
   */
  generateAutofillContext(userProfile, fieldContext) {
    return {
      available_data: this.getAvailableData(userProfile, fieldContext),
      related_fields: this.getRelatedFields(fieldContext),
      suggestions_priority: this.calculateSuggestionsPriority(userProfile, fieldContext),
      fallback_options: this.getFallbackOptions(userProfile, fieldContext)
    };
  }

  /**
   * Calculate profile completeness score
   * @param {Object} profile - User profile
   * @returns {number} - Completeness score (0-100)
   */
  calculateProfileCompleteness(profile) {
    const fields = [
      'name', 'email', 'phone', 'date_of_birth',
      'address.street', 'address.city', 'address.province', 'address.postal_code',
      'company', 'job_title'
    ];
    
    const filledFields = fields.filter(field => {
      const value = this.getNestedValue(profile, field);
      return value && value.toString().trim() !== '';
    });
    
    return Math.round((filledFields.length / fields.length) * 100);
  }

  /**
   * Assess data quality of profile
   * @param {Object} profile - User profile
   * @returns {Object} - Data quality assessment
   */
  assessDataQuality(profile) {
    const quality = {
      email_valid: false,
      phone_valid: false,
      address_complete: false,
      name_proper_case: false,
      postal_code_valid: false
    };
    
    if (profile.email) {
      quality.email_valid = /^[^\s@]+@[^\s@]+\.[^\s@]+$/.test(profile.email);
    }
    
    if (profile.phone) {
      const digits = profile.phone.replace(/[^\d]/g, '');
      quality.phone_valid = digits.length === 10;
    }
    
    if (profile.address) {
      const addressFields = ['street', 'city', 'province', 'postal_code'];
      const filledAddressFields = addressFields.filter(field => 
        profile.address[field] && profile.address[field].trim() !== ''
      );
      quality.address_complete = filledAddressFields.length >= 3;
    }
    
    if (profile.name) {
      quality.name_proper_case = /^[A-Z][a-z]+ [A-Z][a-z]+/.test(profile.name);
    }
    
    if (profile.address?.postal_code) {
      quality.postal_code_valid = /^[A-Z]\d[A-Z] \d[A-Z]\d$/.test(profile.address.postal_code);
    }
    
    return quality;
  }

  /**
   * Generate location context from address
   * @param {Object} address - Address object
   * @returns {Object} - Location context
   */
  generateLocationContext(address) {
    const context = {};
    
    if (address.city) {
      context.city = address.city;
      context.major_city = this.isMajorCity(address.city);
    }
    
    if (address.province) {
      context.province = address.province;
      context.province_name = this.getProvinceName(address.province);
    }
    
    if (address.postal_code) {
      context.postal_code = address.postal_code;
      context.postal_code_area = address.postal_code.substring(0, 3);
    }
    
    return context;
  }

  /**
   * Generate professional context
   * @param {Object} profile - User profile
   * @returns {Object} - Professional context
   */
  generateProfessionalContext(profile) {
    const context = {};
    
    if (profile.company) {
      context.company = profile.company;
      context.company_type = this.inferCompanyType(profile.company);
    }
    
    if (profile.job_title) {
      context.job_title = profile.job_title;
      context.seniority_level = this.inferSeniorityLevel(profile.job_title);
      context.department = this.inferDepartment(profile.job_title);
    }
    
    return context;
  }

  /**
   * Get current season
   * @param {Date} date - Date to check
   * @returns {string} - Season name
   */
  getCurrentSeason(date) {
    const month = date.getMonth();
    if (month >= 2 && month <= 4) return 'spring';
    if (month >= 5 && month <= 7) return 'summer';
    if (month >= 8 && month <= 10) return 'fall';
    return 'winter';
  }

  /**
   * Check if current time is business hours
   * @param {Date} date - Date to check
   * @returns {boolean} - Is business hours
   */
  isBusinessHours(date) {
    const hour = date.getHours();
    const day = date.getDay();
    return day >= 1 && day <= 5 && hour >= 9 && hour <= 17;
  }

  /**
   * Calculate field type confidence
   * @param {Object} fieldContext - Field context
   * @returns {number} - Confidence score (0-1)
   */
  calculateFieldTypeConfidence(fieldContext) {
    if (!fieldContext.field_type) return 0;
    
    const typeConfidence = {
      'email': 0.95,
      'phone': 0.9,
      'name': 0.85,
      'address.postal_code': 0.9,
      'address.province': 0.85,
      'address.city': 0.8,
      'address.street': 0.75,
      'company': 0.7,
      'job_title': 0.7,
      'date_of_birth': 0.8
    };
    
    return typeConfidence[fieldContext.field_type] || 0.5;
  }

  /**
   * Calculate field importance
   * @param {Object} fieldContext - Field context
   * @returns {string} - Importance level
   */
  calculateFieldImportance(fieldContext) {
    const importantFields = ['email', 'phone', 'name', 'address.postal_code'];
    const mediumFields = ['address.street', 'address.city', 'address.province', 'company'];
    const lowFields = ['job_title', 'date_of_birth'];
    
    if (importantFields.includes(fieldContext.field_type)) return 'high';
    if (mediumFields.includes(fieldContext.field_type)) return 'medium';
    if (lowFields.includes(fieldContext.field_type)) return 'low';
    
    return 'medium';
  }

  /**
   * Get formatting hints for field
   * @param {Object} fieldContext - Field context
   * @returns {Array} - Formatting hints
   */
  getFormattingHints(fieldContext) {
    const hints = {
      'email': ['lowercase', 'no_spaces'],
      'phone': ['canadian_format', 'parentheses', 'hyphens'],
      'name': ['proper_case', 'no_numbers'],
      'address.postal_code': ['canadian_format', 'uppercase', 'space_separated'],
      'address.province': ['abbreviation', 'uppercase'],
      'address.city': ['proper_case'],
      'address.street': ['proper_case', 'numbers_allowed'],
      'company': ['proper_case'],
      'job_title': ['proper_case']
    };
    
    return hints[fieldContext.field_type] || [];
  }

  /**
   * Get validation rules for field
   * @param {Object} fieldContext - Field context
   * @returns {Object} - Validation rules
   */
  getValidationRules(fieldContext) {
    const rules = {
      'email': { pattern: 'email', required: true },
      'phone': { pattern: 'canadian_phone', required: true },
      'name': { pattern: 'letters_only', min_length: 2, required: true },
      'address.postal_code': { pattern: 'canadian_postal', required: true },
      'address.province': { pattern: 'canadian_province', required: true },
      'address.city': { pattern: 'letters_only', required: true },
      'address.street': { pattern: 'address', required: true },
      'company': { pattern: 'text', required: false },
      'job_title': { pattern: 'text', required: false }
    };
    
    return rules[fieldContext.field_type] || { pattern: 'text', required: false };
  }

  /**
   * Get available data for field
   * @param {Object} userProfile - User profile
   * @param {Object} fieldContext - Field context
   * @returns {Array} - Available data
   */
  getAvailableData(userProfile, fieldContext) {
    const available = [];
    
    // Direct field match
    const directValue = this.getNestedValue(userProfile, fieldContext.field_type);
    if (directValue) {
      available.push({ source: 'direct', value: directValue, confidence: 1.0 });
    }
    
    // Related field matches
    const relatedFields = this.getRelatedFields(fieldContext);
    for (const relatedField of relatedFields) {
      const value = this.getNestedValue(userProfile, relatedField);
      if (value) {
        available.push({ source: 'related', field: relatedField, value: value, confidence: 0.8 });
      }
    }
    
    return available;
  }

  /**
   * Get related fields for field type
   * @param {Object} fieldContext - Field context
   * @returns {Array} - Related fields
   */
  getRelatedFields(fieldContext) {
    const relations = {
      'email': ['name'],
      'phone': ['name'],
      'name': ['email', 'phone'],
      'address.street': ['address.city', 'address.province'],
      'address.city': ['address.street', 'address.province', 'address.postal_code'],
      'address.province': ['address.city', 'address.postal_code'],
      'address.postal_code': ['address.city', 'address.province'],
      'company': ['job_title'],
      'job_title': ['company']
    };
    
    return relations[fieldContext.field_type] || [];
  }

  /**
   * Calculate suggestions priority
   * @param {Object} userProfile - User profile
   * @param {Object} fieldContext - Field context
   * @returns {string} - Priority level
   */
  calculateSuggestionsPriority(userProfile, fieldContext) {
    const profileCompleteness = this.calculateProfileCompleteness(userProfile);
    const fieldImportance = this.calculateFieldImportance(fieldContext);
    
    if (profileCompleteness < 50) return 'high';
    if (fieldImportance === 'high') return 'high';
    if (fieldImportance === 'medium') return 'medium';
    return 'low';
  }

  /**
   * Get fallback options
   * @param {Object} userProfile - User profile
   * @param {Object} fieldContext - Field context
   * @returns {Array} - Fallback options
   */
  getFallbackOptions(userProfile, fieldContext) {
    const fallbacks = [];
    
    // Default values based on field type
    const defaults = {
      'address.country': 'Canada',
      'address.province': 'ON' // Default to Ontario
    };
    
    if (defaults[fieldContext.field_type]) {
      fallbacks.push({ type: 'default', value: defaults[fieldContext.field_type] });
    }
    
    // System-generated values
    if (fieldContext.field_type === 'date_of_birth') {
      fallbacks.push({ type: 'current_date', value: this.systemContext.currentDate });
    }
    
    return fallbacks;
  }

  /**
   * Helper method to get nested value from object
   * @param {Object} obj - Object to search
   * @param {string} path - Dot-separated path
   * @returns {any} - Value at path
   */
  getNestedValue(obj, path) {
    return path.split('.').reduce((current, key) => current?.[key], obj);
  }

  /**
   * Check if city is a major Canadian city
   * @param {string} city - City name
   * @returns {boolean} - Is major city
   */
  isMajorCity(city) {
    const majorCities = ['TORONTO', 'VANCOUVER', 'MONTREAL', 'CALGARY', 'EDMONTON', 'OTTAWA', 'WINNIPEG', 'QUEBEC CITY'];
    return majorCities.includes(city.toUpperCase());
  }

  /**
   * Get full province name from abbreviation
   * @param {string} abbreviation - Province abbreviation
   * @returns {string} - Full province name
   */
  getProvinceName(abbreviation) {
    const provinces = {
      'ON': 'Ontario',
      'BC': 'British Columbia',
      'AB': 'Alberta',
      'MB': 'Manitoba',
      'SK': 'Saskatchewan',
      'QC': 'Quebec',
      'NS': 'Nova Scotia',
      'NB': 'New Brunswick',
      'NL': 'Newfoundland and Labrador',
      'PE': 'Prince Edward Island',
      'YT': 'Yukon',
      'NT': 'Northwest Territories',
      'NU': 'Nunavut'
    };
    
    return provinces[abbreviation.toUpperCase()] || abbreviation;
  }

  /**
   * Infer company type from name
   * @param {string} companyName - Company name
   * @returns {string} - Company type
   */
  inferCompanyType(companyName) {
    const upperName = companyName.toUpperCase();
    
    if (upperName.includes('INC') || upperName.includes('CORP')) return 'corporation';
    if (upperName.includes('LLC') || upperName.includes('LTD')) return 'limited';
    if (upperName.includes('GOV') || upperName.includes('GOVERNMENT')) return 'government';
    if (upperName.includes('UNIV') || upperName.includes('COLLEGE')) return 'education';
    if (upperName.includes('HOSPITAL') || upperName.includes('CLINIC')) return 'healthcare';
    
    return 'private';
  }

  /**
   * Infer seniority level from job title
   * @param {string} jobTitle - Job title
   * @returns {string} - Seniority level
   */
  inferSeniorityLevel(jobTitle) {
    const upperTitle = jobTitle.toUpperCase();
    
    if (upperTitle.includes('SENIOR') || upperTitle.includes('LEAD') || upperTitle.includes('PRINCIPAL')) return 'senior';
    if (upperTitle.includes('JUNIOR') || upperTitle.includes('ASSOCIATE') || upperTitle.includes('ASSISTANT')) return 'junior';
    if (upperTitle.includes('MANAGER') || upperTitle.includes('DIRECTOR') || upperTitle.includes('VP')) return 'management';
    if (upperTitle.includes('PRESIDENT') || upperTitle.includes('CEO') || upperTitle.includes('CTO')) return 'executive';
    
    return 'mid';
  }

  /**
   * Infer department from job title
   * @param {string} jobTitle - Job title
   * @returns {string} - Department
   */
  inferDepartment(jobTitle) {
    const upperTitle = jobTitle.toUpperCase();
    
    if (upperTitle.includes('ENGINEER') || upperTitle.includes('DEVELOPER') || upperTitle.includes('TECH')) return 'engineering';
    if (upperTitle.includes('SALES') || upperTitle.includes('ACCOUNT')) return 'sales';
    if (upperTitle.includes('MARKETING') || upperTitle.includes('COMMUNICATION')) return 'marketing';
    if (upperTitle.includes('HR') || upperTitle.includes('HUMAN RESOURCE')) return 'human_resources';
    if (upperTitle.includes('FINANCE') || upperTitle.includes('ACCOUNTING')) return 'finance';
    if (upperTitle.includes('DESIGN') || upperTitle.includes('CREATIVE')) return 'design';
    
    return 'general';
  }

  /**
   * Detect country from locale
   * @param {string} locale - User locale (e.g., 'en-US', 'fr-CA', 'de-DE')
   * @returns {string} - Country code
   */
  detectCountryFromLocale(locale) {
    const localeToCountry = {
      'en-US': 'US',
      'en-CA': 'CA',
      'en-GB': 'GB',
      'en-AU': 'AU',
      'en-NZ': 'NZ',
      'fr-CA': 'CA',
      'fr-FR': 'FR',
      'de-DE': 'DE',
      'de-AT': 'AT',
      'de-CH': 'CH',
      'es-ES': 'ES',
      'es-MX': 'MX',
      'es-AR': 'AR',
      'it-IT': 'IT',
      'pt-BR': 'BR',
      'pt-PT': 'PT',
      'nl-NL': 'NL',
      'nl-BE': 'BE',
      'sv-SE': 'SE',
      'no-NO': 'NO',
      'da-DK': 'DK',
      'fi-FI': 'FI',
      'pl-PL': 'PL',
      'ru-RU': 'RU',
      'ja-JP': 'JP',
      'ko-KR': 'KR',
      'zh-CN': 'CN',
      'zh-TW': 'TW',
      'hi-IN': 'IN',
      'ar-SA': 'SA',
      'tr-TR': 'TR',
      'he-IL': 'IL'
    };

    return localeToCountry[locale] || 'US'; // Default to US
  }

  /**
   * Get currency for country
   * @param {string} country - Country code
   * @returns {string} - Currency code
   */
  getCurrencyForCountry(country) {
    const countryToCurrency = {
      'US': 'USD',
      'CA': 'CAD',
      'GB': 'GBP',
      'AU': 'AUD',
      'NZ': 'NZD',
      'FR': 'EUR',
      'DE': 'EUR',
      'AT': 'EUR',
      'CH': 'CHF',
      'ES': 'EUR',
      'MX': 'MXN',
      'AR': 'ARS',
      'IT': 'EUR',
      'BR': 'BRL',
      'PT': 'EUR',
      'NL': 'EUR',
      'BE': 'EUR',
      'SE': 'SEK',
      'NO': 'NOK',
      'DK': 'DKK',
      'FI': 'EUR',
      'PL': 'PLN',
      'RU': 'RUB',
      'JP': 'JPY',
      'KR': 'KRW',
      'CN': 'CNY',
      'TW': 'TWD',
      'IN': 'INR',
      'SA': 'SAR',
      'TR': 'TRY',
      'IL': 'ILS'
    };

    return countryToCurrency[country] || 'USD';
  }

  /**
   * Get date format for locale
   * @param {string} locale - User locale
   * @returns {string} - Date format
   */
  getDateFormatForLocale(locale) {
    const localeToDateFormat = {
      'en-US': 'MM/DD/YYYY',
      'en-CA': 'YYYY-MM-DD',
      'en-GB': 'DD/MM/YYYY',
      'en-AU': 'DD/MM/YYYY',
      'en-NZ': 'DD/MM/YYYY',
      'fr-CA': 'YYYY-MM-DD',
      'fr-FR': 'DD/MM/YYYY',
      'de-DE': 'DD.MM.YYYY',
      'de-AT': 'DD.MM.YYYY',
      'de-CH': 'DD.MM.YYYY',
      'es-ES': 'DD/MM/YYYY',
      'es-MX': 'DD/MM/YYYY',
      'es-AR': 'DD/MM/YYYY',
      'it-IT': 'DD/MM/YYYY',
      'pt-BR': 'DD/MM/YYYY',
      'pt-PT': 'DD/MM/YYYY',
      'nl-NL': 'DD-MM-YYYY',
      'nl-BE': 'DD/MM/YYYY',
      'sv-SE': 'YYYY-MM-DD',
      'no-NO': 'DD.MM.YYYY',
      'da-DK': 'DD.MM.YYYY',
      'fi-FI': 'DD.MM.YYYY',
      'pl-PL': 'DD.MM.YYYY',
      'ru-RU': 'DD.MM.YYYY',
      'ja-JP': 'YYYY/MM/DD',
      'ko-KR': 'YYYY.MM.DD',
      'zh-CN': 'YYYY-MM-DD',
      'zh-TW': 'YYYY/MM/DD',
      'hi-IN': 'DD/MM/YYYY',
      'ar-SA': 'DD/MM/YYYY',
      'tr-TR': 'DD.MM.YYYY',
      'he-IL': 'DD/MM/YYYY'
    };

    return localeToDateFormat[locale] || 'MM/DD/YYYY';
  }

  /**
   * Get phone format for country
   * @param {string} country - Country code
   * @returns {string} - Phone format
   */
  getPhoneFormatForCountry(country) {
    const countryToPhoneFormat = {
      'US': '(XXX) XXX-XXXX',
      'CA': '(XXX) XXX-XXXX',
      'GB': 'XXXX XXX XXXX',
      'AU': 'XXXX XXX XXX',
      'NZ': 'XXXX XXX XXX',
      'FR': 'XX XX XX XX XX',
      'DE': 'XXX XXXXXXXX',
      'AT': 'XXX XXXXXXXX',
      'CH': 'XXX XXX XX XX',
      'ES': 'XXX XXX XXX',
      'MX': 'XXX XXX XXXX',
      'AR': 'XXX XXXX-XXXX',
      'IT': 'XXX XXX XXXX',
      'BR': '(XX) XXXXX-XXXX',
      'PT': 'XXX XXX XXX',
      'NL': 'XX XXX XXXX',
      'BE': 'XXX XX XX XX',
      'SE': 'XXX-XXX XX XX',
      'NO': 'XXX XX XXX',
      'DK': 'XX XX XX XX',
      'FI': 'XXX XXX XXXX',
      'PL': 'XXX XXX XXX',
      'RU': 'XXX XXX-XX-XX',
      'JP': 'XXX-XXXX-XXXX',
      'KR': 'XXX-XXXX-XXXX',
      'CN': 'XXX XXXX XXXX',
      'TW': 'XXXX XXX XXX',
      'IN': 'XXXXX XXXXX',
      'SA': 'XXX XXX XXXX',
      'TR': 'XXX XXX XX XX',
      'IL': 'XXX-XXX-XXXX'
    };

    return countryToPhoneFormat[country] || '(XXX) XXX-XXXX';
  }
}

module.exports = ContextGenerator;
