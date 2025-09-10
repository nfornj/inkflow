import { ExtractedPageData, TextRegion } from './pdfTextExtractor';

export interface FormField {
  id: string;
  label: string;
  type: FormFieldType;
  category: FormFieldCategory;
  page: number;
  position: {
    x: number;
    y: number;
    width: number;
    height: number;
  };
  confidence: number;
  keywords: string[];
  expectedInputArea?: {
    x: number;
    y: number;
    width: number;
    height: number;
  };
}

export type FormFieldType = 
  | 'text'
  | 'email' 
  | 'phone'
  | 'date'
  | 'number'
  | 'address'
  | 'name'
  | 'checkbox'
  | 'radio'
  | 'select'
  | 'textarea';

export type FormFieldCategory = 
  | 'Personal Information'
  | 'Contact Information'
  | 'Address Information'
  | 'Employment History'
  | 'Education'
  | 'Financial Information'
  | 'Emergency Contact'
  | 'References'
  | 'Medical Information'
  | 'Legal Information'
  | 'Other';

export interface FormFieldDetectionResult {
  fields: FormField[];
  totalFields: number;
  fieldsByCategory: Record<FormFieldCategory, FormField[]>;
  processingTime: number;
  success: boolean;
  error?: string;
}

// Comprehensive form field patterns
const FORM_FIELD_PATTERNS: Record<FormFieldType, {
  keywords: string[];
  category: FormFieldCategory;
  confidence: number;
}> = {
  name: {
    keywords: [
      'first name', 'last name', 'full name', 'name', 'given name', 'surname', 'family name',
      'middle name', 'middle initial', 'legal name', 'preferred name', 'maiden name'
    ],
    category: 'Personal Information',
    confidence: 0.9
  },
  email: {
    keywords: [
      'email', 'e-mail', 'email address', 'e-mail address', 'electronic mail',
      'contact email', 'work email', 'personal email'
    ],
    category: 'Contact Information',
    confidence: 0.95
  },
  phone: {
    keywords: [
      'phone', 'telephone', 'phone number', 'tel', 'mobile', 'cell', 'cellular',
      'home phone', 'work phone', 'mobile phone', 'cell phone', 'contact number'
    ],
    category: 'Contact Information',
    confidence: 0.9
  },
  date: {
    keywords: [
      'date', 'birth date', 'date of birth', 'dob', 'birthday', 'start date',
      'end date', 'graduation date', 'hire date', 'expiry date', 'expiration date'
    ],
    category: 'Personal Information',
    confidence: 0.85
  },
  address: {
    keywords: [
      'address', 'street', 'street address', 'home address', 'mailing address',
      'billing address', 'city', 'state', 'zip', 'postal code', 'zip code',
      'country', 'province', 'apartment', 'unit', 'suite'
    ],
    category: 'Address Information',
    confidence: 0.9
  },
  number: {
    keywords: [
      'ssn', 'social security', 'social security number', 'sin', 'id number',
      'employee id', 'student id', 'account number', 'policy number', 'license number'
    ],
    category: 'Personal Information',
    confidence: 0.8
  },
  text: {
    keywords: [
      'comments', 'notes', 'description', 'additional information', 'remarks',
      'explanation', 'details', 'other', 'specify', 'please explain'
    ],
    category: 'Other',
    confidence: 0.7
  },
  checkbox: {
    keywords: [
      'check', 'select', 'choose', 'mark', 'tick', 'yes/no', 'agree', 'consent',
      'acknowledge', 'confirm', 'certify', 'verify'
    ],
    category: 'Other',
    confidence: 0.6
  },
  radio: {
    keywords: [
      'select one', 'choose one', 'pick one', 'gender', 'marital status',
      'employment status', 'education level', 'title', 'prefix'
    ],
    category: 'Personal Information',
    confidence: 0.7
  },
  select: {
    keywords: [
      'dropdown', 'select from list', 'choose from', 'pick from',
      'department', 'division', 'category', 'type', 'classification'
    ],
    category: 'Other',
    confidence: 0.6
  },
  textarea: {
    keywords: [
      'experience', 'qualifications', 'skills', 'background', 'history',
      'summary', 'objective', 'goals', 'achievements', 'accomplishments'
    ],
    category: 'Other',
    confidence: 0.7
  }
};

// Category-specific keywords to help with categorization
const CATEGORY_KEYWORDS: Record<FormFieldCategory, string[]> = {
  'Personal Information': ['personal', 'individual', 'identity', 'basic'],
  'Contact Information': ['contact', 'reach', 'communication', 'correspondence'],
  'Address Information': ['address', 'location', 'residence', 'mailing'],
  'Employment History': ['employment', 'work', 'job', 'career', 'position', 'employer', 'company'],
  'Education': ['education', 'school', 'university', 'college', 'degree', 'diploma', 'certification'],
  'Financial Information': ['financial', 'income', 'salary', 'tax', 'banking', 'credit'],
  'Emergency Contact': ['emergency', 'contact', 'next of kin', 'relative', 'family'],
  'References': ['reference', 'referee', 'recommendation', 'contact person'],
  'Medical Information': ['medical', 'health', 'doctor', 'physician', 'condition', 'medication'],
  'Legal Information': ['legal', 'law', 'attorney', 'lawyer', 'court', 'litigation'],
  'Other': ['other', 'additional', 'miscellaneous', 'general']
};

export class FormFieldDetector {
  detectFormFields(pagesData: ExtractedPageData[]): FormFieldDetectionResult {
    const startTime = Date.now();
    
    try {
      const allFields: FormField[] = [];
      
      for (const pageData of pagesData) {
        const pageFields = this.detectFieldsOnPage(pageData);
        allFields.push(...pageFields);
      }

      // Group fields by category
      const fieldsByCategory = this.groupFieldsByCategory(allFields);
      
      // Remove duplicates and merge similar fields
      const uniqueFields = this.deduplicateFields(allFields);
      
      const processingTime = Date.now() - startTime;
      
      console.log(`Form field detection completed: ${uniqueFields.length} fields found in ${processingTime}ms`);
      
      return {
        fields: uniqueFields,
        totalFields: uniqueFields.length,
        fieldsByCategory: this.groupFieldsByCategory(uniqueFields),
        processingTime,
        success: true
      };
    } catch (error) {
      console.error('Form field detection failed:', error);
      return {
        fields: [],
        totalFields: 0,
        fieldsByCategory: {} as Record<FormFieldCategory, FormField[]>,
        processingTime: Date.now() - startTime,
        success: false,
        error: error instanceof Error ? error.message : 'Unknown error'
      };
    }
  }

  private detectFieldsOnPage(pageData: ExtractedPageData): FormField[] {
    const fields: FormField[] = [];
    const processedRegions = new Set<string>();

    for (const region of pageData.textRegions) {
      const regionKey = `${region.bbox.x0}-${region.bbox.y0}-${region.text}`;
      if (processedRegions.has(regionKey)) continue;

      const detectedField = this.analyzeTextRegion(region, pageData);
      if (detectedField) {
        fields.push(detectedField);
        processedRegions.add(regionKey);
      }
    }

    return fields;
  }

  private analyzeTextRegion(region: TextRegion, pageData: ExtractedPageData): FormField | null {
    const text = region.text.toLowerCase().trim();
    if (text.length < 2) return null;

    // Check against all field type patterns
    for (const [fieldType, pattern] of Object.entries(FORM_FIELD_PATTERNS)) {
      for (const keyword of pattern.keywords) {
        if (this.isKeywordMatch(text, keyword)) {
          // Look for potential input area near this label
          const inputArea = this.findInputArea(region, pageData);
          
          // Determine more specific category if possible
          const category = this.determineCategory(text, pattern.category);
          
          return {
            id: `field-${region.page}-${region.bbox.x0}-${region.bbox.y0}`,
            label: this.cleanLabel(region.text),
            type: fieldType as FormFieldType,
            category,
            page: region.page,
            position: {
              x: region.bbox.x0,
              y: region.bbox.y0,
              width: region.bbox.x1 - region.bbox.x0,
              height: region.bbox.y1 - region.bbox.y0
            },
            confidence: pattern.confidence * (region.confidence / 100),
            keywords: [keyword],
            expectedInputArea: inputArea
          };
        }
      }
    }

    // Check for generic field indicators
    if (this.looksLikeFieldLabel(text)) {
      return {
        id: `field-${region.page}-${region.bbox.x0}-${region.bbox.y0}`,
        label: this.cleanLabel(region.text),
        type: 'text',
        category: 'Other',
        page: region.page,
        position: {
          x: region.bbox.x0,
          y: region.bbox.y0,
          width: region.bbox.x1 - region.bbox.x0,
          height: region.bbox.y1 - region.bbox.y0
        },
        confidence: 0.5,
        keywords: ['generic'],
        expectedInputArea: this.findInputArea(region, pageData)
      };
    }

    return null;
  }

  private isKeywordMatch(text: string, keyword: string): boolean {
    // Exact match
    if (text.includes(keyword)) return true;
    
    // Fuzzy match (handle common variations)
    const variations = [
      keyword.replace(' ', ''),  // Remove spaces
      keyword.replace('-', ' '), // Replace hyphens with spaces
      keyword.replace('_', ' '), // Replace underscores with spaces
    ];
    
    return variations.some(variation => text.includes(variation));
  }

  private looksLikeFieldLabel(text: string): boolean {
    // Check for common field label patterns
    const labelIndicators = [
      /:$/, // Ends with colon
      /^[A-Za-z\s]+:/, // Starts with letters and ends with colon
      /\*$/, // Ends with asterisk (required field)
      /\($/, // Ends with opening parenthesis
      /required/i, // Contains "required"
      /optional/i, // Contains "optional"
    ];

    return labelIndicators.some(pattern => pattern.test(text)) && text.length > 3;
  }

  private findInputArea(
    labelRegion: TextRegion,
    pageData: ExtractedPageData
  ): { x: number; y: number; width: number; height: number } | undefined {
    // Look for empty space or underscores after the label
    const searchArea = {
      x: labelRegion.bbox.x1 + 10, // Start 10px after label
      y: labelRegion.bbox.y0 - 5,  // 5px above label
      width: 200, // Default input width
      height: labelRegion.bbox.y1 - labelRegion.bbox.y0 + 10 // Label height + padding
    };

    // Check if there's text in this area (which would indicate no input field)
    const overlappingText = pageData.textRegions.filter(region => {
      return region.bbox.x0 < searchArea.x + searchArea.width &&
             region.bbox.x1 > searchArea.x &&
             region.bbox.y0 < searchArea.y + searchArea.height &&
             region.bbox.y1 > searchArea.y;
    });

    // If there's minimal text in the search area, it's likely an input area
    if (overlappingText.length <= 1) {
      return searchArea;
    }

    return undefined;
  }

  private determineCategory(text: string, defaultCategory: FormFieldCategory): FormFieldCategory {
    // Check if the text contains category-specific keywords
    for (const [category, keywords] of Object.entries(CATEGORY_KEYWORDS)) {
      if (keywords.some(keyword => text.includes(keyword.toLowerCase()))) {
        return category as FormFieldCategory;
      }
    }
    
    return defaultCategory;
  }

  private cleanLabel(text: string): string {
    return text
      .replace(/[:\*\(\)]/g, '') // Remove common label punctuation
      .trim()
      .replace(/\s+/g, ' ') // Normalize whitespace
      .replace(/^\w/, c => c.toUpperCase()); // Capitalize first letter
  }

  private deduplicateFields(fields: FormField[]): FormField[] {
    const unique: FormField[] = [];
    const seen = new Set<string>();

    for (const field of fields) {
      // Create a key based on label and position (for same-page duplicates)
      const key = `${field.label.toLowerCase()}-${field.page}-${Math.round(field.position.x / 10)}-${Math.round(field.position.y / 10)}`;
      
      if (!seen.has(key)) {
        seen.add(key);
        unique.push(field);
      } else {
        // If we've seen this field before, keep the one with higher confidence
        const existingIndex = unique.findIndex(f => {
          const existingKey = `${f.label.toLowerCase()}-${f.page}-${Math.round(f.position.x / 10)}-${Math.round(f.position.y / 10)}`;
          return existingKey === key;
        });
        
        if (existingIndex >= 0 && field.confidence > unique[existingIndex].confidence) {
          unique[existingIndex] = field;
        }
      }
    }

    // Sort by page, then by position
    return unique.sort((a, b) => {
      if (a.page !== b.page) return a.page - b.page;
      if (a.position.y !== b.position.y) return a.position.y - b.position.y;
      return a.position.x - b.position.x;
    });
  }

  private groupFieldsByCategory(fields: FormField[]): Record<FormFieldCategory, FormField[]> {
    const grouped: Record<FormFieldCategory, FormField[]> = {
      'Personal Information': [],
      'Contact Information': [],
      'Address Information': [],
      'Employment History': [],
      'Education': [],
      'Financial Information': [],
      'Emergency Contact': [],
      'References': [],
      'Medical Information': [],
      'Legal Information': [],
      'Other': []
    };

    for (const field of fields) {
      grouped[field.category].push(field);
    }

    return grouped;
  }
}
