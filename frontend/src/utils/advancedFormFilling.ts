import { PDFDocument } from 'pdf-lib';

// Types for better type safety
export interface FormFieldInfo {
  name: string;
  type: string;
  value?: any;
  options?: string[];
  isReadOnly?: boolean;
  isRequired?: boolean;
}

export interface FormAnalysis {
  hasForm: boolean;
  isXFA: boolean;
  isProtected: boolean;
  fieldCount: number;
  fields: FormFieldInfo[];
  issues: string[];
}

export interface FieldMatchResult {
  exactMatches: Record<string, string>;
  fuzzyMatches: Record<string, string>;
  unmatchedFormData: string[];
  unmatchedPdfFields: string[];
}

export interface FormSaveResults {
  success: boolean;
  fieldsUpdated: number;
  fieldsSkipped: number;
  fieldsWithErrors: number;
  errors: string[];
  warnings: string[];
  fieldResults: Record<string, { status: 'success' | 'skipped' | 'error'; message: string }>;
  pdfBytes?: Uint8Array;
}

// 1. COMPREHENSIVE PDF FORM ANALYSIS
export const analyzePDFForm = async (pdfBytes: Uint8Array): Promise<FormAnalysis> => {
  const analysis: FormAnalysis = {
    hasForm: false,
    isXFA: false,
    isProtected: false,
    fieldCount: 0,
    fields: [],
    issues: []
  };

  try {
    const pdfDoc = await PDFDocument.load(pdfBytes);
    const form = pdfDoc.getForm();
    
    // Check if form exists
    analysis.hasForm = form !== null;
    if (!analysis.hasForm) {
      analysis.issues.push("PDF does not contain a fillable form");
      return analysis;
    }

    // Check for XFA forms (not well supported by pdf-lib)
    try {
      analysis.isXFA = form.hasXFA();
      if (analysis.isXFA) {
        analysis.issues.push("PDF uses XFA forms which have limited support");
      }
    } catch (e) {
      // Some PDFs throw errors when checking XFA
      analysis.issues.push("Could not determine XFA status");
    }

    // Get all fields
    const fields = form.getFields();
    analysis.fieldCount = fields.length;

    if (fields.length === 0) {
      analysis.issues.push("PDF form has no fillable fields");
      return analysis;
    }

    // Analyze each field
    fields.forEach((field) => {
      const fieldInfo: FormFieldInfo = {
        name: field.getName(),
        type: field.constructor.name
      };

      try {
        // Check if field is read-only
        fieldInfo.isReadOnly = (field as any).isReadOnly?.() || false;
        
        // Get field-specific information
        if (field.constructor.name.includes('PDFTextField')) {
          fieldInfo.value = (field as any).getText?.() || '';
        } else if (field.constructor.name.includes('PDFCheckBox')) {
          fieldInfo.value = (field as any).isChecked?.() || false;
        } else if (field.constructor.name.includes('PDFRadioGroup')) {
          try {
            fieldInfo.options = (field as any).getOptions?.() || [];
            fieldInfo.value = (field as any).getSelected?.() || '';
          } catch (e) {
            fieldInfo.options = [];
          }
        } else if (field.constructor.name.includes('PDFDropdown')) {
          try {
            fieldInfo.options = (field as any).getOptions?.() || [];
            fieldInfo.value = (field as any).getSelected?.() || '';
          } catch (e) {
            fieldInfo.options = [];
          }
        }

        if (fieldInfo.isReadOnly) {
          analysis.issues.push(`Field "${fieldInfo.name}" is read-only`);
        }

      } catch (error) {
        analysis.issues.push(`Error analyzing field "${fieldInfo.name}": ${error}`);
      }

      analysis.fields.push(fieldInfo);
    });

    // Check for protection
    try {
      // Try to modify a test field to check if form is protected
      const testField = fields[0];
      if (testField && testField.constructor.name.includes('PDFTextField')) {
        const originalValue = (testField as any).getText?.() || '';
        (testField as any).setText?.('test');
        (testField as any).setText?.(originalValue); // Restore original
      }
    } catch (error) {
      analysis.isProtected = true;
      analysis.issues.push("PDF form appears to be protected against modifications");
    }

  } catch (error) {
    analysis.issues.push(`Error analyzing PDF: ${error}`);
  }

  return analysis;
};

// Simple fuzzy matching algorithm
const findBestMatch = (target: string, options: string[]): { match: string; score: number } => {
  let bestMatch = '';
  let bestScore = 0;

  options.forEach(option => {
    const score = calculateSimilarity(target.toLowerCase(), option.toLowerCase());
    if (score > bestScore) {
      bestScore = score;
      bestMatch = option;
    }
  });

  return { match: bestMatch, score: bestScore };
};

const calculateSimilarity = (str1: string, str2: string): number => {
  const longer = str1.length > str2.length ? str1 : str2;
  const shorter = str1.length > str2.length ? str2 : str1;
  
  if (longer.length === 0) return 1.0;
  
  const editDistance = levenshteinDistance(longer, shorter);
  return (longer.length - editDistance) / longer.length;
};

const levenshteinDistance = (str1: string, str2: string): number => {
  const matrix: number[][] = [];
  
  for (let i = 0; i <= str2.length; i++) {
    matrix[i] = [i];
  }
  
  for (let j = 0; j <= str1.length; j++) {
    matrix[0][j] = j;
  }
  
  for (let i = 1; i <= str2.length; i++) {
    for (let j = 1; j <= str1.length; j++) {
      if (str2.charAt(i - 1) === str1.charAt(j - 1)) {
        matrix[i][j] = matrix[i - 1][j - 1];
      } else {
        matrix[i][j] = Math.min(
          matrix[i - 1][j - 1] + 1,
          matrix[i][j - 1] + 1,
          matrix[i - 1][j] + 1
        );
      }
    }
  }
  
  return matrix[str2.length][str1.length];
};

// 2. FIELD NAME MATCHING WITH FUZZY LOGIC
export const matchFieldNames = (
  formData: Record<string, any>, 
  pdfFields: FormFieldInfo[]
): FieldMatchResult => {
  const result: FieldMatchResult = {
    exactMatches: {},
    fuzzyMatches: {},
    unmatchedFormData: [],
    unmatchedPdfFields: []
  };

  const pdfFieldNames = pdfFields.map(f => f.name);
  const formDataKeys = Object.keys(formData);

  // Find exact matches
  formDataKeys.forEach(key => {
    if (pdfFieldNames.includes(key)) {
      result.exactMatches[key] = key;
    } else {
      result.unmatchedFormData.push(key);
    }
  });

  // Find fuzzy matches for unmatched form data
  result.unmatchedFormData.forEach(formKey => {
    const fuzzyMatch = findBestMatch(formKey, pdfFieldNames);
    if (fuzzyMatch.score > 0.7) { // 70% similarity threshold
      result.fuzzyMatches[formKey] = fuzzyMatch.match;
      // Remove from unmatched
      result.unmatchedFormData = result.unmatchedFormData.filter(k => k !== formKey);
    }
  });

  // Find unmatched PDF fields
  result.unmatchedPdfFields = pdfFieldNames.filter(pdfField => 
    !Object.values(result.exactMatches).includes(pdfField) &&
    !Object.values(result.fuzzyMatches).includes(pdfField)
  );

  return result;
};

// 3. VALUE VALIDATION FOR DIFFERENT FIELD TYPES
export const validateAndNormalizeFieldValue = (
  field: FormFieldInfo, 
  value: any
): { isValid: boolean; normalizedValue: any; error?: string } => {
  
  if (value === undefined || value === null || value === '') {
    return { isValid: true, normalizedValue: '' };
  }

  switch (true) {
    case field.type.includes('PDFTextField'):
      return { isValid: true, normalizedValue: String(value) };
      
    case field.type.includes('PDFCheckBox'):
      const boolValue = value === true || 
                       value === 'true' || 
                       value === '1' || 
                       value === 1 ||
                       value === 'on' ||
                       value === 'yes' ||
                       value === 'checked';
      return { isValid: true, normalizedValue: boolValue };
      
    case field.type.includes('PDFRadioGroup'):
    case field.type.includes('PDFDropdown'):
      const stringValue = String(value);
      if (!field.options || field.options.length === 0) {
        return { isValid: true, normalizedValue: stringValue };
      }
      
      // Check exact match
      if (field.options.includes(stringValue)) {
        return { isValid: true, normalizedValue: stringValue };
      }
      
      // Try case-insensitive match
      const caseInsensitiveMatch = field.options.find(
        option => option.toLowerCase() === stringValue.toLowerCase()
      );
      if (caseInsensitiveMatch) {
        return { isValid: true, normalizedValue: caseInsensitiveMatch };
      }
      
      // Try fuzzy match
      const fuzzyMatch = findBestMatch(stringValue, field.options);
      if (fuzzyMatch.score > 0.8) {
        return { 
          isValid: true, 
          normalizedValue: fuzzyMatch.match,
          error: `Using fuzzy match: "${stringValue}" → "${fuzzyMatch.match}"`
        };
      }
      
      return { 
        isValid: false, 
        normalizedValue: stringValue,
        error: `Value "${stringValue}" not found in options: [${field.options.join(', ')}]`
      };
      
    default:
      return { isValid: true, normalizedValue: String(value) };
  }
};

// 4. ENHANCED FORM FILLING WITH ALL FIXES
export const handleAdvancedFormSave = async (
  formDataToSave: Record<string, any>,
  pdfBytes: Uint8Array,
  options: {
    enableFuzzyMatching?: boolean;
    enableValueNormalization?: boolean;
    skipProtectedFields?: boolean;
    createBackup?: boolean;
    flattenForm?: boolean;
  } = {}
): Promise<FormSaveResults> => {
  const {
    enableFuzzyMatching = true,
    enableValueNormalization = true,
    skipProtectedFields = true,
    createBackup = true,
    flattenForm = false
  } = options;

  const results: FormSaveResults = {
    success: false,
    fieldsUpdated: 0,
    fieldsSkipped: 0,
    fieldsWithErrors: 0,
    errors: [],
    warnings: [],
    fieldResults: {}
  };

  try {
    // Step 1: Analyze the PDF form
    console.log("🔍 Analyzing PDF form...");
    const analysis = await analyzePDFForm(pdfBytes);
    
    if (analysis.issues.length > 0) {
      results.warnings.push(...analysis.issues);
    }

    if (!analysis.hasForm) {
      throw new Error("PDF does not contain a fillable form");
    }

    if (analysis.fieldCount === 0) {
      throw new Error("PDF form has no fillable fields");
    }

    console.log(`📋 Found ${analysis.fieldCount} form fields`);

    // Step 2: Match field names
    console.log("🔗 Matching field names...");
    const fieldMatching = matchFieldNames(formDataToSave, analysis.fields);
    
    console.log(`✅ Exact matches: ${Object.keys(fieldMatching.exactMatches).length}`);
    console.log(`🔍 Fuzzy matches: ${Object.keys(fieldMatching.fuzzyMatches).length}`);
    console.log(`❌ Unmatched form data: ${fieldMatching.unmatchedFormData.length}`);
    console.log(`❓ Unmatched PDF fields: ${fieldMatching.unmatchedPdfFields.length}`);

    if (fieldMatching.unmatchedFormData.length > 0) {
      results.warnings.push(`Unmatched form data keys: ${fieldMatching.unmatchedFormData.join(', ')}`);
    }

    // Step 3: Load PDF and get form
    const pdfDoc = await PDFDocument.load(pdfBytes);
    const form = pdfDoc.getForm();

    // Step 4: Fill form fields
    console.log("✏️ Filling form fields...");
    
    const allMatches = { ...fieldMatching.exactMatches, ...fieldMatching.fuzzyMatches };
    
    for (const [formDataKey, pdfFieldName] of Object.entries(allMatches)) {
      const fieldValue = formDataToSave[formDataKey];
      const fieldInfo = analysis.fields.find(f => f.name === pdfFieldName);
      
      if (!fieldInfo) {
        results.errors.push(`Field info not found for: ${pdfFieldName}`);
        results.fieldsWithErrors++;
        continue;
      }

      // Skip protected fields if option is enabled
      if (skipProtectedFields && fieldInfo.isReadOnly) {
        results.fieldResults[pdfFieldName] = { 
          status: 'skipped', 
          message: 'Field is read-only' 
        };
        results.fieldsSkipped++;
        continue;
      }

      // Validate and normalize value
      const validation = validateAndNormalizeFieldValue(fieldInfo, fieldValue);
      
      if (!validation.isValid && !enableValueNormalization) {
        results.fieldResults[pdfFieldName] = { 
          status: 'error', 
          message: validation.error || 'Invalid value' 
        };
        results.fieldsWithErrors++;
        continue;
      }

      if (validation.error) {
        results.warnings.push(`${pdfFieldName}: ${validation.error}`);
      }

      // Fill the field
      try {
        const field = form.getField(pdfFieldName);
        const normalizedValue = validation.normalizedValue;

        if (fieldInfo.type.includes('PDFTextField')) {
          (field as any).setText(String(normalizedValue));
        } else if (fieldInfo.type.includes('PDFCheckBox')) {
          if (normalizedValue) {
            (field as any).check();
          } else {
            (field as any).uncheck();
          }
        } else if (fieldInfo.type.includes('PDFRadioGroup')) {
          (field as any).select(String(normalizedValue));
        } else if (fieldInfo.type.includes('PDFDropdown')) {
          (field as any).select(String(normalizedValue));
        }

        results.fieldResults[pdfFieldName] = { 
          status: 'success', 
          message: `Set to: ${normalizedValue}` 
        };
        results.fieldsUpdated++;
        
      } catch (error) {
        results.fieldResults[pdfFieldName] = { 
          status: 'error', 
          message: `Error: ${error}` 
        };
        results.fieldsWithErrors++;
        results.errors.push(`Error filling ${pdfFieldName}: ${error}`);
      }
    }

    // Step 5: Flatten form if requested
    if (flattenForm && results.fieldsUpdated > 0) {
      form.flatten();
      console.log("📎 Form flattened (made non-editable)");
    }

    // Step 6: Save PDF
    const filledPdfBytes = await pdfDoc.save();
    results.success = true;
    results.pdfBytes = filledPdfBytes;

    console.log(`🎉 Form filling completed!`);
    console.log(`✅ Fields updated: ${results.fieldsUpdated}`);
    console.log(`⏭️ Fields skipped: ${results.fieldsSkipped}`);
    console.log(`❌ Fields with errors: ${results.fieldsWithErrors}`);

    return results;

  } catch (error) {
    results.errors.push(`Critical error: ${error}`);
    console.error("💥 Form filling failed:", error);
    throw error;
  }
};

// 5. HELPER FUNCTION TO DOWNLOAD FILLED PDF
export const downloadFilledPDF = (
  pdfBytes: Uint8Array, 
  originalFileName: string = 'form'
): void => {
  const blob = new Blob([pdfBytes], { type: "application/pdf" });
  const url = URL.createObjectURL(blob);
  const link = document.createElement("a");
  link.href = url;
  
  const timestamp = new Date().toISOString().slice(0, 19).replace(/[:.]/g, '-');
  const baseFileName = originalFileName.replace(/\.pdf$/i, '');
  link.download = `${baseFileName}_filled_${timestamp}.pdf`;
  
  document.body.appendChild(link);
  link.click();
  document.body.removeChild(link);
  URL.revokeObjectURL(url);
};

