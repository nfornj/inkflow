/**
 * Profile Manager - Handles encrypted user profile storage and context generation
 * Phase 4 Implementation - Placeholder for now
 */

const Store = require('electron-store');
const path = require('path');
const { app } = require('electron');
const ContextGenerator = require('./context-generator');

class ProfileManager {
  constructor() {
    // Initialize encrypted store
    this.store = new Store({
      name: 'user-profile',
      encryptionKey: 'inkflow-profile-key-2025',
      schema: {
        profile: {
          type: 'object',
          properties: {
            name: { type: 'string' },
            email: { type: 'string' },
            phone: { type: 'string' },
            address: {
              type: 'object',
              properties: {
                street: { type: 'string' },
                city: { type: 'string' },
                province: { type: 'string' },
                postal_code: { type: 'string' },
                country: { type: 'string' }
              }
            },
            company: { type: 'string' },
            job_title: { type: 'string' },
            date_of_birth: { type: 'string' },
            preferences: {
              type: 'object',
              properties: {
                locale: { type: 'string', default: 'en-CA' },
                date_format: { type: 'string', default: 'YYYY-MM-DD' },
                phone_format: { type: 'string', default: '(XXX) XXX-XXXX' }
              }
            },
            last_updated: { type: 'string' }
          }
        }
      }
    });

    // Initialize context generator
    this.contextGenerator = new ContextGenerator();

    this.defaultProfile = {
      name: '',
      email: '',
      phone: '',
      address: {
        street: '',
        city: '',
        province: '',
        postal_code: '',
        country: 'Canada'
      },
      company: '',
      job_title: '',
      date_of_birth: '',
      preferences: {
        locale: 'en-CA',
        date_format: 'YYYY-MM-DD',
        phone_format: '(XXX) XXX-XXXX'
      },
      last_updated: new Date().toISOString()
    };
  }

  /**
   * Save profile data to encrypted storage
   * @param {Object} profileData - Profile data to save
   * @returns {Promise<boolean>} - Success status
   */
  async saveProfile(profileData) {
    try {
      const profile = {
        ...this.defaultProfile,
        ...profileData,
        last_updated: new Date().toISOString()
      };

      this.store.set('profile', profile);
      console.log('Profile saved successfully');
      return true;

    } catch (error) {
      console.error('Failed to save profile:', error);
      return false;
    }
  }

  /**
   * Load profile data from encrypted storage
   * @returns {Promise<Object>} - Profile data
   */
  async loadProfile() {
    try {
      const profile = this.store.get('profile', this.defaultProfile);
      console.log('Profile loaded successfully');
      return profile;

    } catch (error) {
      console.error('Failed to load profile:', error);
      return this.defaultProfile;
    }
  }

  /**
   * Update specific profile field
   * @param {string} field - Field name
   * @param {any} value - Field value
   * @returns {Promise<boolean>} - Success status
   */
  async updateProfileField(field, value) {
    try {
      const profile = await this.loadProfile();
      
      // Handle nested fields (e.g., address.city)
      if (field.includes('.')) {
        const [parent, child] = field.split('.');
        if (!profile[parent]) {
          profile[parent] = {};
        }
        profile[parent][child] = value;
      } else {
        profile[field] = value;
      }

      return await this.saveProfile(profile);

    } catch (error) {
      console.error(`Failed to update profile field ${field}:`, error);
      return false;
    }
  }

  /**
   * Generate context object for LLM
   * @param {Object} fieldContext - Field-specific context
   * @param {Object} systemContext - System context
   * @returns {Promise<Object>} - Complete context object
   */
  async generateContext(fieldContext, systemContext = {}) {
    try {
      const userProfile = await this.loadProfile();
      
      // Use context generator for rich context
      const context = this.contextGenerator.generateContext(
        userProfile,
        fieldContext,
        systemContext
      );

      console.log('Context generated successfully');
      return context;

    } catch (error) {
      console.error('Failed to generate context:', error);
      throw error;
    }
  }

  /**
   * Categorize user input and save to profile
   * @param {string} input - User input
   * @param {string} fieldType - Field type hint
   * @returns {Promise<Object>} - Categorization result
   */
  async categorizeUserInput(input, fieldType = null) {
    try {
      console.log(`Categorizing user input: "${input}" with field type: ${fieldType}`);
      
      // Use enhanced categorization logic
      const category = this.inferFieldType(input, fieldType);
      const processedValue = this.processValue(input, category);
      const confidence = this.calculateConfidence(input, category);
      
      // Save to profile if confidence is high enough
      let saved = false;
      if (category && processedValue && confidence > 0.7) {
        saved = await this.updateProfileField(category, processedValue);
        console.log(`Saved to profile: ${category} = ${processedValue} (confidence: ${confidence})`);
      } else {
        console.log(`Not saved: confidence too low (${confidence}) or invalid category`);
      }

      return {
        category: category,
        value: processedValue,
        confidence: confidence,
        saved: saved,
        timestamp: new Date().toISOString()
      };

    } catch (error) {
      console.error('Failed to categorize user input:', error);
      return {
        category: null,
        value: input,
        confidence: 0,
        saved: false,
        error: error.message,
        timestamp: new Date().toISOString()
      };
    }
  }

  /**
   * Infer field type from input
   * @param {string} input - User input
   * @param {string} hint - Field type hint
   * @returns {string|null} - Inferred field type
   */
  inferFieldType(input, hint = null) {
    if (hint) {
      return hint;
    }

    const cleanInput = input.trim();
    
    // Email detection
    if (this.isEmail(cleanInput)) {
      return 'email';
    }
    
    // Phone number detection
    if (this.isPhoneNumber(cleanInput)) {
      return 'phone';
    }
    
    // Postal code detection (Canadian format)
    if (this.isPostalCode(cleanInput)) {
      return 'address.postal_code';
    }
    
    // Province detection
    if (this.isProvince(cleanInput)) {
      return 'address.province';
    }
    
    // Street address detection
    if (this.isStreetAddress(cleanInput)) {
      return 'address.street';
    }
    
    // City detection
    if (this.isCity(cleanInput)) {
      return 'address.city';
    }
    
    // Name detection
    if (this.isName(cleanInput)) {
      return 'name';
    }
    
    // Company detection
    if (this.isCompany(cleanInput)) {
      return 'company';
    }
    
    // Job title detection
    if (this.isJobTitle(cleanInput)) {
      return 'job_title';
    }
    
    // Date detection
    if (this.isDate(cleanInput)) {
      return 'date_of_birth';
    }
    
    return null;
  }

  /**
   * Check if input is an email address
   * @param {string} input - Input to check
   * @returns {boolean} - Is email
   */
  isEmail(input) {
    const emailRegex = /^[^\s@]+@[^\s@]+\.[^\s@]+$/;
    return emailRegex.test(input) && input.includes('@') && input.includes('.');
  }

  /**
   * Check if input is a phone number (international support)
   * @param {string} input - Input to check
   * @returns {boolean} - Is phone number
   */
  isPhoneNumber(input) {
    const digits = input.replace(/[^\d]/g, '');
    
    // International phone number patterns
    const phonePatterns = [
      /^\d{10}$/,  // US/Canada: 10 digits
      /^\d{11}$/,  // US with country code: 11 digits
      /^\d{7,15}$/ // International: 7-15 digits (ITU-T E.164)
    ];
    
    return phonePatterns.some(pattern => pattern.test(digits)) && digits.length >= 7;
  }

  /**
   * Check if input is a postal/zip code (international support)
   * @param {string} input - Input to check
   * @returns {boolean} - Is postal code
   */
  isPostalCode(input) {
    const clean = input.replace(/[^\w]/g, '').toUpperCase();
    
    // International postal code patterns
    const postalPatterns = [
      /^[A-Z]\d[A-Z]\d[A-Z]\d$/,     // Canada: A1A1A1
      /^[A-Z]\d[A-Z] \d[A-Z]\d$/,    // Canada: A1A 1A1
      /^\d{5}$/,                      // US: 12345
      /^\d{5}-\d{4}$/,               // US: 12345-6789
      /^[A-Z]{1,2}\d[A-Z\d]? \d[A-Z]{2}$/, // UK: SW1A 1AA
      /^\d{4}$/,                      // Australia: 1234
      /^\d{5}$/,                      // Germany: 12345
      /^\d{4} [A-Z]{2}$/,            // Netherlands: 1234 AB
      /^\d{5}-\d{3}$/,               // Brazil: 12345-678
      /^\d{6}$/,                      // India: 123456
      /^\d{3}-\d{4}$/,               // Japan: 123-4567
      /^\d{5}$/,                      // South Korea: 12345
      /^\d{6}$/,                      // China: 123456
      /^\d{5}$/,                      // France: 12345
      /^\d{4}$/,                      // Sweden: 1234
      /^\d{4}$/,                      // Norway: 1234
      /^\d{4}$/,                      // Denmark: 1234
      /^\d{5}$/,                      // Finland: 12345
      /^\d{2}-\d{3}$/,               // Poland: 12-345
      /^\d{6}$/,                      // Russia: 123456
      /^\d{5}$/,                      // Turkey: 12345
      /^\d{7}$/,                      // Israel: 1234567
      /^\d{5}$/,                      // Saudi Arabia: 12345
      /^\d{4}$/,                      // UAE: 1234
      /^\d{6}$/,                      // South Africa: 123456
      /^\d{4}$/,                      // New Zealand: 1234
      /^\d{5}$/,                      // Mexico: 12345
      /^\d{4}$/,                      // Argentina: 1234
      /^\d{8}$/,                      // Brazil: 12345678
      /^\d{5}$/,                      // Chile: 12345
      /^\d{6}$/,                      // Colombia: 123456
      /^\d{5}$/,                      // Peru: 12345
      /^\d{4}$/,                      // Venezuela: 1234
      /^\d{5}$/,                      // Ecuador: 12345
      /^\d{4}$/,                      // Uruguay: 1234
      /^\d{4}$/,                      // Paraguay: 1234
      /^\d{4}$/,                      // Bolivia: 1234
      /^\d{4}$/,                      // Guyana: 1234
      /^\d{4}$/,                      // Suriname: 1234
      /^\d{4}$/,                      // French Guiana: 1234
    ];
    
    return postalPatterns.some(pattern => pattern.test(clean)) || 
           postalPatterns.some(pattern => pattern.test(input));
  }

  /**
   * Check if input is a state/province/region (international support)
   * @param {string} input - Input to check
   * @returns {boolean} - Is state/province/region
   */
  isProvince(input) {
    const clean = input.toUpperCase().trim();
    
    // International states/provinces/regions
    const regions = {
      // Canada
      'CA': ['ON', 'BC', 'AB', 'MB', 'SK', 'QC', 'NS', 'NB', 'NL', 'PE', 'YT', 'NT', 'NU',
             'ONTARIO', 'BRITISH COLUMBIA', 'ALBERTA', 'MANITOBA', 'SASKATCHEWAN', 
             'QUEBEC', 'NOVA SCOTIA', 'NEW BRUNSWICK', 'NEWFOUNDLAND', 'PRINCE EDWARD ISLAND'],
      
      // United States
      'US': ['AL', 'AK', 'AZ', 'AR', 'CA', 'CO', 'CT', 'DE', 'FL', 'GA', 'HI', 'ID', 'IL', 'IN', 'IA', 'KS', 'KY', 'LA', 'ME', 'MD', 'MA', 'MI', 'MN', 'MS', 'MO', 'MT', 'NE', 'NV', 'NH', 'NJ', 'NM', 'NY', 'NC', 'ND', 'OH', 'OK', 'OR', 'PA', 'RI', 'SC', 'SD', 'TN', 'TX', 'UT', 'VT', 'VA', 'WA', 'WV', 'WI', 'WY',
             'ALABAMA', 'ALASKA', 'ARIZONA', 'ARKANSAS', 'CALIFORNIA', 'COLORADO', 'CONNECTICUT', 'DELAWARE', 'FLORIDA', 'GEORGIA', 'HAWAII', 'IDAHO', 'ILLINOIS', 'INDIANA', 'IOWA', 'KANSAS', 'KENTUCKY', 'LOUISIANA', 'MAINE', 'MARYLAND', 'MASSACHUSETTS', 'MICHIGAN', 'MINNESOTA', 'MISSISSIPPI', 'MISSOURI', 'MONTANA', 'NEBRASKA', 'NEVADA', 'NEW HAMPSHIRE', 'NEW JERSEY', 'NEW MEXICO', 'NEW YORK', 'NORTH CAROLINA', 'NORTH DAKOTA', 'OHIO', 'OKLAHOMA', 'OREGON', 'PENNSYLVANIA', 'RHODE ISLAND', 'SOUTH CAROLINA', 'SOUTH DAKOTA', 'TENNESSEE', 'TEXAS', 'UTAH', 'VERMONT', 'VIRGINIA', 'WASHINGTON', 'WEST VIRGINIA', 'WISCONSIN', 'WYOMING'],
      
      // United Kingdom
      'GB': ['ENGLAND', 'SCOTLAND', 'WALES', 'NORTHERN IRELAND', 'LONDON', 'MANCHESTER', 'BIRMINGHAM', 'LIVERPOOL', 'LEEDS', 'SHEFFIELD', 'BRISTOL', 'NEWCASTLE', 'NOTTINGHAM', 'LEICESTER', 'COVENTRY', 'BRADFORD', 'CARDIFF', 'BELFAST', 'EDINBURGH', 'GLASGOW'],
      
      // Australia
      'AU': ['NSW', 'VIC', 'QLD', 'WA', 'SA', 'TAS', 'ACT', 'NT',
             'NEW SOUTH WALES', 'VICTORIA', 'QUEENSLAND', 'WESTERN AUSTRALIA', 'SOUTH AUSTRALIA', 'TASMANIA', 'AUSTRALIAN CAPITAL TERRITORY', 'NORTHERN TERRITORY'],
      
      // Germany
      'DE': ['BW', 'BY', 'BE', 'BB', 'HB', 'HH', 'HE', 'MV', 'NI', 'NW', 'RP', 'SL', 'SN', 'ST', 'SH', 'TH',
             'BADEN-WÜRTTEMBERG', 'BAVARIA', 'BERLIN', 'BRANDENBURG', 'BREMEN', 'HAMBURG', 'HESSE', 'MECKLENBURG-VORPOMMERN', 'LOWER SAXONY', 'NORTH RHINE-WESTPHALIA', 'RHINELAND-PALATINATE', 'SAARLAND', 'SAXONY', 'SAXONY-ANHALT', 'SCHLESWIG-HOLSTEIN', 'THURINGIA'],
      
      // France
      'FR': ['IDF', 'NPDC', 'RA', 'PACA', 'AQUITAINE', 'BRETAGNE', 'CENTRE', 'CHAMPAGNE-ARDENNE', 'CORSE', 'FRANCHE-COMTE', 'LANGUEDOC-ROUSSILLON', 'LIMOUSIN', 'LORRAINE', 'MIDI-PYRENEES', 'NORD-PAS-DE-CALAIS', 'NORMANDIE', 'PAYS DE LA LOIRE', 'PICARDIE', 'POITOU-CHARENTES', 'PROVENCE-ALPES-COTE D\'AZUR', 'RHONE-ALPES'],
      
      // Japan
      'JP': ['HOKKAIDO', 'AOMORI', 'IWATE', 'MIYAGI', 'AKITA', 'YAMAGATA', 'FUKUSHIMA', 'IBARAKI', 'TOCHIGI', 'GUNMA', 'SAITAMA', 'CHIBA', 'TOKYO', 'KANAGAWA', 'NIIGATA', 'TOYAMA', 'ISHIKAWA', 'FUKUI', 'YAMANASHI', 'NAGANO', 'GIFU', 'SHIZUOKA', 'AICHI', 'MIE', 'SHIGA', 'KYOTO', 'OSAKA', 'HYOGO', 'NARA', 'WAKAYAMA', 'TOTTORI', 'SHIMANE', 'OKAYAMA', 'HIROSHIMA', 'YAMAGUCHI', 'TOKUSHIMA', 'KAGAWA', 'EHIME', 'KOCHI', 'FUKUOKA', 'SAGA', 'NAGASAKI', 'KUMAMOTO', 'OITA', 'MIYAZAKI', 'KAGOSHIMA', 'OKINAWA'],
      
      // India
      'IN': ['AP', 'AR', 'AS', 'BR', 'CT', 'GA', 'GJ', 'HR', 'HP', 'JK', 'JH', 'KA', 'KL', 'MP', 'MH', 'MN', 'ML', 'MZ', 'NL', 'OR', 'PB', 'RJ', 'SK', 'TN', 'TG', 'TR', 'UP', 'UT', 'WB', 'AN', 'CH', 'DN', 'DL', 'LD', 'PY',
             'ANDHRA PRADESH', 'ARUNACHAL PRADESH', 'ASSAM', 'BIHAR', 'CHHATTISGARH', 'GOA', 'GUJARAT', 'HARYANA', 'HIMACHAL PRADESH', 'JAMMU AND KASHMIR', 'JHARKHAND', 'KARNATAKA', 'KERALA', 'MADHYA PRADESH', 'MAHARASHTRA', 'MANIPUR', 'MEGHALAYA', 'MIZORAM', 'NAGALAND', 'ODISHA', 'PUNJAB', 'RAJASTHAN', 'SIKKIM', 'TAMIL NADU', 'TELANGANA', 'TRIPURA', 'UTTAR PRADESH', 'UTTARAKHAND', 'WEST BENGAL', 'ANDAMAN AND NICOBAR ISLANDS', 'CHANDIGARH', 'DADRA AND NAGAR HAVELI', 'DELHI', 'LAKSHADWEEP', 'PUDUCHERRY']
    };
    
    // Check all regions
    for (const countryRegions of Object.values(regions)) {
      if (countryRegions.includes(clean)) {
        return true;
      }
    }
    
    return false;
  }

  /**
   * Check if input is a street address
   * @param {string} input - Input to check
   * @returns {boolean} - Is street address
   */
  isStreetAddress(input) {
    const streetWords = ['ST', 'STREET', 'AVE', 'AVENUE', 'RD', 'ROAD', 'BLVD', 'BOULEVARD', 'DR', 'DRIVE', 'CT', 'COURT', 'PL', 'PLACE', 'WAY', 'LANE', 'CRES', 'CRESCENT'];
    const upperInput = input.toUpperCase();
    return streetWords.some(word => upperInput.includes(word)) || 
           /^\d+\s+[A-Za-z\s]+$/.test(input);
  }

  /**
   * Check if input is a city name
   * @param {string} input - Input to check
   * @returns {boolean} - Is city
   */
  isCity(input) {
    const canadianCities = ['TORONTO', 'VANCOUVER', 'MONTREAL', 'CALGARY', 'EDMONTON', 'OTTAWA', 'WINNIPEG', 'QUEBEC CITY', 'HAMILTON', 'KITCHENER', 'LONDON', 'VICTORIA', 'HALIFAX', 'OSHAWA', 'WINDSOR', 'SASKATOON', 'REGINA', 'SHERBROOKE', 'BARRIE', 'KELOWNA'];
    const clean = input.toUpperCase().trim();
    return canadianCities.includes(clean) || 
           (input.split(' ').length <= 3 && /^[A-Za-z\s]+$/.test(input) && input.length > 2);
  }

  /**
   * Check if input is a name
   * @param {string} input - Input to check
   * @returns {boolean} - Is name
   */
  isName(input) {
    const words = input.split(' ').filter(word => word.length > 0);
    return words.length >= 2 && 
           words.length <= 4 && 
           words.every(word => /^[A-Za-z]+$/.test(word)) &&
           words.every(word => word.length > 1);
  }

  /**
   * Check if input is a company name
   * @param {string} input - Input to check
   * @returns {boolean} - Is company
   */
  isCompany(input) {
    const companyWords = ['INC', 'CORP', 'CORPORATION', 'LLC', 'LTD', 'LIMITED', 'COMPANY', 'CO', 'GROUP', 'SYSTEMS', 'SOLUTIONS', 'TECHNOLOGIES', 'SERVICES'];
    const upperInput = input.toUpperCase();
    return companyWords.some(word => upperInput.includes(word)) ||
           (input.length > 3 && input.split(' ').length <= 5);
  }

  /**
   * Check if input is a job title
   * @param {string} input - Input to check
   * @returns {boolean} - Is job title
   */
  isJobTitle(input) {
    const jobTitles = ['MANAGER', 'DIRECTOR', 'ENGINEER', 'DEVELOPER', 'ANALYST', 'CONSULTANT', 'SPECIALIST', 'COORDINATOR', 'ADMINISTRATOR', 'SUPERVISOR', 'LEAD', 'SENIOR', 'JUNIOR', 'ASSOCIATE', 'ASSISTANT', 'EXECUTIVE', 'PRESIDENT', 'CEO', 'CTO', 'CFO', 'VP', 'VICE PRESIDENT'];
    const upperInput = input.toUpperCase();
    return jobTitles.some(title => upperInput.includes(title)) ||
           (input.split(' ').length <= 4 && input.length > 3);
  }

  /**
   * Check if input is a date
   * @param {string} input - Input to check
   * @returns {boolean} - Is date
   */
  isDate(input) {
    const dateFormats = [
      /^\d{4}-\d{2}-\d{2}$/, // YYYY-MM-DD
      /^\d{2}\/\d{2}\/\d{4}$/, // MM/DD/YYYY
      /^\d{2}-\d{2}-\d{4}$/, // MM-DD-YYYY
      /^\d{1,2}\/\d{1,2}\/\d{4}$/, // M/D/YYYY
    ];
    return dateFormats.some(format => format.test(input));
  }

  /**
   * Calculate confidence score for field type inference
   * @param {string} input - User input
   * @param {string} fieldType - Inferred field type
   * @returns {number} - Confidence score (0-1)
   */
  calculateConfidence(input, fieldType) {
    if (!fieldType) {
      return 0;
    }

    let confidence = 0.5; // Base confidence

    switch (fieldType) {
      case 'email':
        if (this.isEmail(input)) {
          confidence = 0.95;
          // Bonus for common email domains
          const commonDomains = ['gmail.com', 'yahoo.com', 'hotmail.com', 'outlook.com', 'icloud.com'];
          if (commonDomains.some(domain => input.toLowerCase().includes(domain))) {
            confidence = 0.98;
          }
        }
        break;

      case 'phone':
        if (this.isPhoneNumber(input)) {
          confidence = 0.9;
          // Bonus for properly formatted numbers
          if (/^\(\d{3}\) \d{3}-\d{4}$/.test(input)) {
            confidence = 0.95;
          }
        }
        break;

      case 'address.postal_code':
        if (this.isPostalCode(input)) {
          confidence = 0.9;
          // Bonus for properly formatted postal codes
          if (/^[A-Z]\d[A-Z] \d[A-Z]\d$/.test(input.toUpperCase())) {
            confidence = 0.95;
          }
        }
        break;

      case 'address.province':
        if (this.isProvince(input)) {
          confidence = 0.85;
          // Bonus for standard abbreviations
          const provinces = ['ON', 'BC', 'AB', 'MB', 'SK', 'QC', 'NS', 'NB', 'NL', 'PE', 'YT', 'NT', 'NU'];
          if (provinces.includes(input.toUpperCase())) {
            confidence = 0.95;
          }
        }
        break;

      case 'address.street':
        if (this.isStreetAddress(input)) {
          confidence = 0.8;
          // Bonus for numbers at the beginning
          if (/^\d+/.test(input)) {
            confidence = 0.9;
          }
        }
        break;

      case 'address.city':
        if (this.isCity(input)) {
          confidence = 0.75;
          // Bonus for known Canadian cities
          const canadianCities = ['TORONTO', 'VANCOUVER', 'MONTREAL', 'CALGARY', 'EDMONTON', 'OTTAWA', 'WINNIPEG', 'QUEBEC CITY', 'HAMILTON', 'KITCHENER', 'LONDON', 'VICTORIA', 'HALIFAX', 'OSHAWA', 'WINDSOR', 'SASKATOON', 'REGINA', 'SHERBROOKE', 'BARRIE', 'KELOWNA'];
          if (canadianCities.includes(input.toUpperCase())) {
            confidence = 0.9;
          }
        }
        break;

      case 'name':
        if (this.isName(input)) {
          confidence = 0.8;
          // Bonus for proper capitalization
          const words = input.split(' ');
          if (words.every(word => /^[A-Z][a-z]+$/.test(word))) {
            confidence = 0.9;
          }
        }
        break;

      case 'company':
        if (this.isCompany(input)) {
          confidence = 0.7;
          // Bonus for company suffixes
          const companySuffixes = ['INC', 'CORP', 'CORPORATION', 'LLC', 'LTD', 'LIMITED', 'COMPANY', 'CO'];
          if (companySuffixes.some(suffix => input.toUpperCase().includes(suffix))) {
            confidence = 0.85;
          }
        }
        break;

      case 'job_title':
        if (this.isJobTitle(input)) {
          confidence = 0.7;
          // Bonus for common job titles
          const commonTitles = ['MANAGER', 'DIRECTOR', 'ENGINEER', 'DEVELOPER', 'ANALYST', 'CONSULTANT'];
          if (commonTitles.some(title => input.toUpperCase().includes(title))) {
            confidence = 0.85;
          }
        }
        break;

      case 'date_of_birth':
        if (this.isDate(input)) {
          confidence = 0.8;
          // Bonus for standard date format
          if (/^\d{4}-\d{2}-\d{2}$/.test(input)) {
            confidence = 0.9;
          }
        }
        break;

      default:
        confidence = 0.5;
    }

    return Math.min(1, Math.max(0, confidence));
  }

  /**
   * Process and format value based on field type
   * @param {string} value - Raw value
   * @param {string} fieldType - Field type
   * @returns {string} - Processed value
   */
  processValue(value, fieldType) {
    if (!fieldType) {
      return value.trim();
    }

    const trimmedValue = value.trim();

    switch (fieldType) {
      case 'phone':
        // Format based on detected country/locale
        const digits = trimmedValue.replace(/[^\d]/g, '');
        if (digits.length === 10) {
          // Default to US/Canada format
          return `(${digits.slice(0, 3)}) ${digits.slice(3, 6)}-${digits.slice(6)}`;
        } else if (digits.length === 11 && digits.startsWith('1')) {
          // US/Canada with country code
          return `+1 (${digits.slice(1, 4)}) ${digits.slice(4, 7)}-${digits.slice(7)}`;
        }
        return trimmedValue;
        
      case 'address.postal_code':
        // Format based on detected pattern
        const clean = trimmedValue.replace(/[^\w]/g, '').toUpperCase();
        if (clean.length === 6 && /^[A-Z]\d[A-Z]\d[A-Z]\d$/.test(clean)) {
          // Canadian format: A1A 1A1
          return `${clean.slice(0, 3)} ${clean.slice(3)}`;
        } else if (clean.length === 5 && /^\d{5}$/.test(clean)) {
          // US format: 12345
          return clean;
        } else if (clean.length === 9 && /^\d{5}\d{4}$/.test(clean)) {
          // US+4 format: 12345-6789
          return `${clean.slice(0, 5)}-${clean.slice(5)}`;
        }
        return trimmedValue.toUpperCase();
        
      case 'email':
        return trimmedValue.toLowerCase();
        
      case 'name':
        // Proper case formatting
        return trimmedValue.split(' ')
          .map(word => word.charAt(0).toUpperCase() + word.slice(1).toLowerCase())
          .join(' ');
        
      case 'address.province':
        // Convert to standard abbreviation (international support)
        const provinceMap = {
          // Canada
          'ONTARIO': 'ON', 'BRITISH COLUMBIA': 'BC', 'ALBERTA': 'AB', 'MANITOBA': 'MB',
          'SASKATCHEWAN': 'SK', 'QUEBEC': 'QC', 'NOVA SCOTIA': 'NS', 'NEW BRUNSWICK': 'NB',
          'NEWFOUNDLAND': 'NL', 'PRINCE EDWARD ISLAND': 'PE', 'YUKON': 'YT',
          'NORTHWEST TERRITORIES': 'NT', 'NUNAVUT': 'NU',
          
          // United States
          'CALIFORNIA': 'CA', 'TEXAS': 'TX', 'FLORIDA': 'FL', 'NEW YORK': 'NY',
          'PENNSYLVANIA': 'PA', 'ILLINOIS': 'IL', 'OHIO': 'OH', 'GEORGIA': 'GA',
          'NORTH CAROLINA': 'NC', 'MICHIGAN': 'MI', 'NEW JERSEY': 'NJ', 'VIRGINIA': 'VA',
          'WASHINGTON': 'WA', 'ARIZONA': 'AZ', 'MASSACHUSETTS': 'MA', 'TENNESSEE': 'TN',
          'INDIANA': 'IN', 'MISSOURI': 'MO', 'MARYLAND': 'MD', 'WISCONSIN': 'WI',
          'COLORADO': 'CO', 'MINNESOTA': 'MN', 'SOUTH CAROLINA': 'SC', 'ALABAMA': 'AL',
          'LOUISIANA': 'LA', 'KENTUCKY': 'KY', 'OREGON': 'OR', 'OKLAHOMA': 'OK',
          'CONNECTICUT': 'CT', 'UTAH': 'UT', 'IOWA': 'IA', 'NEVADA': 'NV',
          'ARKANSAS': 'AR', 'MISSISSIPPI': 'MS', 'KANSAS': 'KS', 'NEW MEXICO': 'NM',
          'NEBRASKA': 'NE', 'WEST VIRGINIA': 'WV', 'IDAHO': 'ID', 'HAWAII': 'HI',
          'NEW HAMPSHIRE': 'NH', 'MAINE': 'ME', 'RHODE ISLAND': 'RI', 'MONTANA': 'MT',
          'DELAWARE': 'DE', 'SOUTH DAKOTA': 'SD', 'NORTH DAKOTA': 'ND', 'ALASKA': 'AK',
          'VERMONT': 'VT', 'WYOMING': 'WY'
        };
        const upperValue = trimmedValue.toUpperCase();
        return provinceMap[upperValue] || upperValue;
        
      case 'address.city':
        // Proper case formatting
        return trimmedValue.split(' ')
          .map(word => word.charAt(0).toUpperCase() + word.slice(1).toLowerCase())
          .join(' ');
        
      case 'company':
        // Proper case formatting
        return trimmedValue.split(' ')
          .map(word => word.charAt(0).toUpperCase() + word.slice(1).toLowerCase())
          .join(' ');
        
      case 'job_title':
        // Proper case formatting
        return trimmedValue.split(' ')
          .map(word => word.charAt(0).toUpperCase() + word.slice(1).toLowerCase())
          .join(' ');
        
      case 'date_of_birth':
        // Standardize date format
        if (/^\d{2}\/\d{2}\/\d{4}$/.test(trimmedValue)) {
          const [month, day, year] = trimmedValue.split('/');
          return `${year}-${month.padStart(2, '0')}-${day.padStart(2, '0')}`;
        }
        return trimmedValue;
        
      default:
        return trimmedValue;
    }
  }

  /**
   * Get profile statistics
   * @returns {Promise<Object>} - Profile statistics
   */
  async getProfileStats() {
    try {
      const profile = await this.loadProfile();
      
      let filledFields = 0;
      let totalFields = 0;
      const fieldDetails = {};
      
      const countFields = (obj, prefix = '') => {
        for (const [key, value] of Object.entries(obj)) {
          if (typeof value === 'object' && value !== null && key !== 'preferences') {
            countFields(value, prefix + key + '.');
          } else if (key !== 'preferences' && key !== 'last_updated') {
            totalFields++;
            const fieldName = prefix + key;
            const isFilled = value && value.toString().trim() !== '';
            
            fieldDetails[fieldName] = {
              filled: isFilled,
              value: isFilled ? value : null,
              type: typeof value
            };
            
            if (isFilled) {
              filledFields++;
            }
          }
        }
      };
      
      countFields(profile);
      
      // Calculate category-specific statistics
      const categories = {
        personal: ['name', 'email', 'phone', 'date_of_birth'],
        address: ['address.street', 'address.city', 'address.province', 'address.postal_code', 'address.country'],
        professional: ['company', 'job_title']
      };
      
      const categoryStats = {};
      for (const [category, fields] of Object.entries(categories)) {
        const categoryFilled = fields.filter(field => fieldDetails[field]?.filled).length;
        categoryStats[category] = {
          total: fields.length,
          filled: categoryFilled,
          percentage: Math.round((categoryFilled / fields.length) * 100)
        };
      }
      
      // Calculate data quality score
      const qualityScore = this.calculateDataQuality(profile);
      
      return {
        totalFields,
        filledFields,
        completionPercentage: Math.round((filledFields / totalFields) * 100),
        lastUpdated: profile.last_updated,
        fieldDetails,
        categoryStats,
        qualityScore,
        profileAge: this.calculateProfileAge(profile.last_updated)
      };

    } catch (error) {
      console.error('Failed to get profile stats:', error);
      return {
        totalFields: 0,
        filledFields: 0,
        completionPercentage: 0,
        lastUpdated: null,
        fieldDetails: {},
        categoryStats: {},
        qualityScore: 0,
        profileAge: 0
      };
    }
  }

  /**
   * Calculate data quality score
   * @param {Object} profile - User profile
   * @returns {number} - Quality score (0-100)
   */
  calculateDataQuality(profile) {
    let score = 0;
    let maxScore = 0;
    
    // Email quality
    if (profile.email) {
      maxScore += 20;
      if (this.isEmail(profile.email)) {
        score += 20;
      } else {
        score += 10; // Partial credit for having an email
      }
    }
    
    // Phone quality
    if (profile.phone) {
      maxScore += 20;
      if (this.isPhoneNumber(profile.phone)) {
        score += 20;
      } else {
        score += 10; // Partial credit for having a phone
      }
    }
    
    // Name quality
    if (profile.name) {
      maxScore += 20;
      if (this.isName(profile.name)) {
        score += 20;
      } else {
        score += 10; // Partial credit for having a name
      }
    }
    
    // Address quality
    if (profile.address) {
      maxScore += 40;
      let addressScore = 0;
      
      if (profile.address.street && this.isStreetAddress(profile.address.street)) {
        addressScore += 10;
      }
      if (profile.address.city && this.isCity(profile.address.city)) {
        addressScore += 10;
      }
      if (profile.address.province && this.isProvince(profile.address.province)) {
        addressScore += 10;
      }
      if (profile.address.postal_code && this.isPostalCode(profile.address.postal_code)) {
        addressScore += 10;
      }
      
      score += addressScore;
    }
    
    return maxScore > 0 ? Math.round((score / maxScore) * 100) : 0;
  }

  /**
   * Calculate profile age in days
   * @param {string} lastUpdated - Last updated timestamp
   * @returns {number} - Profile age in days
   */
  calculateProfileAge(lastUpdated) {
    if (!lastUpdated) {
      return 0;
    }
    
    const lastUpdateDate = new Date(lastUpdated);
    const now = new Date();
    const diffTime = Math.abs(now - lastUpdateDate);
    return Math.ceil(diffTime / (1000 * 60 * 60 * 24));
  }

  /**
   * Clear all profile data
   * @returns {Promise<boolean>} - Success status
   */
  async clearProfile() {
    try {
      this.store.delete('profile');
      console.log('Profile cleared successfully');
      return true;

    } catch (error) {
      console.error('Failed to clear profile:', error);
      return false;
    }
  }
}

module.exports = ProfileManager;
