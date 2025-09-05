/**
 * React Hook for LLM Autofill functionality
 * Phase 6 Implementation
 */

import { useState, useCallback, useRef, useEffect } from 'react';
import { 
  FieldContext, 
  AutofillSuggestionResult, 
  AutofillQuestionResult, 
  AutofillValidationResult,
  AutofillProcessResult,
  AutofillProfileResult,
  AutofillPerformanceResult,
  AutofillStatusResult
} from '../types/electron';

interface UseLLMAutofillOptions {
  debounceMs?: number;
  enableCursorStates?: boolean;
  enableFocusManagement?: boolean;
  onSuggestion?: (result: AutofillSuggestionResult) => void;
  onQuestion?: (result: AutofillQuestionResult) => void;
  onValidation?: (result: AutofillValidationResult) => void;
  onError?: (error: string) => void;
}

interface UseLLMAutofillReturn {
  // Core autofill functions
  getSuggestion: (fieldContext: FieldContext) => Promise<AutofillSuggestionResult>;
  generateQuestion: (fieldContext: FieldContext) => Promise<AutofillQuestionResult>;
  validateInput: (input: string, fieldType: string) => Promise<AutofillValidationResult>;
  processInput: (input: string, fieldType: string) => Promise<AutofillProcessResult>;
  
  // Profile management
  getProfile: () => Promise<AutofillProfileResult>;
  updateProfile: (field: string, value: string) => Promise<AutofillProcessResult>;
  
  // Performance and status
  getPerformance: () => Promise<AutofillPerformanceResult>;
  checkStatus: () => Promise<AutofillStatusResult>;
  
  // UI state management
  setCursorState: (element: HTMLInputElement | HTMLTextAreaElement, state: 'wait' | 'pointer' | 'text') => void;
  setFocus: (element: HTMLInputElement | HTMLTextAreaElement, position?: number) => void;
  
  // State
  isProcessing: boolean;
  lastSuggestion: AutofillSuggestionResult | null;
  lastQuestion: AutofillQuestionResult | null;
  lastValidation: AutofillValidationResult | null;
  error: string | null;
}

export const useLLMAutofill = (options: UseLLMAutofillOptions = {}): UseLLMAutofillReturn => {
  const {
    debounceMs = 300,
    enableCursorStates = true,
    enableFocusManagement = true,
    onSuggestion,
    onQuestion,
    onValidation,
    onError
  } = options;

  // State
  const [isProcessing, setIsProcessing] = useState(false);
  const [lastSuggestion, setLastSuggestion] = useState<AutofillSuggestionResult | null>(null);
  const [lastQuestion, setLastQuestion] = useState<AutofillQuestionResult | null>(null);
  const [lastValidation, setLastValidation] = useState<AutofillValidationResult | null>(null);
  const [error, setError] = useState<string | null>(null);

  // Refs
  const debounceTimeoutRef = useRef<NodeJS.Timeout | null>(null);
  const currentElementRef = useRef<HTMLInputElement | HTMLTextAreaElement | null>(null);

  // Cursor state management
  const setCursorState = useCallback((element: HTMLInputElement | HTMLTextAreaElement, state: 'wait' | 'pointer' | 'text') => {
    if (!enableCursorStates) return;
    
    switch (state) {
      case 'wait':
        element.style.cursor = 'wait';
        element.style.opacity = '0.7';
        break;
      case 'pointer':
        element.style.cursor = 'pointer';
        element.style.opacity = '1';
        break;
      case 'text':
        element.style.cursor = 'text';
        element.style.opacity = '1';
        break;
    }
  }, [enableCursorStates]);

  // Focus management
  const setFocus = useCallback((element: HTMLInputElement | HTMLTextAreaElement, position?: number) => {
    if (!enableFocusManagement) return;
    
    element.focus();
    if (position !== undefined) {
      element.setSelectionRange(position, position);
    } else {
      // Place cursor at end of text
      const textLength = element.value.length;
      element.setSelectionRange(textLength, textLength);
    }
  }, [enableFocusManagement]);

  // Core autofill functions
  const getSuggestion = useCallback(async (fieldContext: FieldContext): Promise<AutofillSuggestionResult> => {
    if (!window.electronAPI) {
      const error = 'Electron API not available';
      setError(error);
      onError?.(error);
      return { success: false, error };
    }

    setIsProcessing(true);
    setError(null);

    try {
      const result = await window.electronAPI.llmAutofillGetSuggestion(fieldContext);
      setLastSuggestion(result);
      onSuggestion?.(result);
      return result;
    } catch (err) {
      const error = err instanceof Error ? err.message : 'Unknown error';
      setError(error);
      onError?.(error);
      return { success: false, error };
    } finally {
      setIsProcessing(false);
    }
  }, [onSuggestion, onError]);

  const generateQuestion = useCallback(async (fieldContext: FieldContext): Promise<AutofillQuestionResult> => {
    if (!window.electronAPI) {
      const error = 'Electron API not available';
      setError(error);
      onError?.(error);
      return { success: false, error };
    }

    setIsProcessing(true);
    setError(null);

    try {
      const result = await window.electronAPI.llmAutofillGenerateQuestion(fieldContext);
      setLastQuestion(result);
      onQuestion?.(result);
      return result;
    } catch (err) {
      const error = err instanceof Error ? err.message : 'Unknown error';
      setError(error);
      onError?.(error);
      return { success: false, error };
    } finally {
      setIsProcessing(false);
    }
  }, [onQuestion, onError]);

  const validateInput = useCallback(async (input: string, fieldType: string): Promise<AutofillValidationResult> => {
    if (!window.electronAPI) {
      const error = 'Electron API not available';
      setError(error);
      onError?.(error);
      return { success: false, error };
    }

    setIsProcessing(true);
    setError(null);

    try {
      const result = await window.electronAPI.llmAutofillValidateInput(input, fieldType);
      setLastValidation(result);
      onValidation?.(result);
      return result;
    } catch (err) {
      const error = err instanceof Error ? err.message : 'Unknown error';
      setError(error);
      onError?.(error);
      return { success: false, error };
    } finally {
      setIsProcessing(false);
    }
  }, [onValidation, onError]);

  const processInput = useCallback(async (input: string, fieldType: string): Promise<AutofillProcessResult> => {
    if (!window.electronAPI) {
      const error = 'Electron API not available';
      setError(error);
      onError?.(error);
      return { success: false, error };
    }

    setIsProcessing(true);
    setError(null);

    try {
      const result = await window.electronAPI.llmAutofillProcessInput(input, fieldType);
      return result;
    } catch (err) {
      const error = err instanceof Error ? err.message : 'Unknown error';
      setError(error);
      onError?.(error);
      return { success: false, error };
    } finally {
      setIsProcessing(false);
    }
  }, [onError]);

  // Profile management
  const getProfile = useCallback(async (): Promise<AutofillProfileResult> => {
    if (!window.electronAPI) {
      const error = 'Electron API not available';
      setError(error);
      onError?.(error);
      return { success: false, error };
    }

    try {
      const result = await window.electronAPI.llmAutofillGetProfile();
      return result;
    } catch (err) {
      const error = err instanceof Error ? err.message : 'Unknown error';
      setError(error);
      onError?.(error);
      return { success: false, error };
    }
  }, [onError]);

  const updateProfile = useCallback(async (field: string, value: string): Promise<AutofillProcessResult> => {
    if (!window.electronAPI) {
      const error = 'Electron API not available';
      setError(error);
      onError?.(error);
      return { success: false, error };
    }

    try {
      const result = await window.electronAPI.llmAutofillUpdateProfile(field, value);
      return result;
    } catch (err) {
      const error = err instanceof Error ? err.message : 'Unknown error';
      setError(error);
      onError?.(error);
      return { success: false, error };
    }
  }, [onError]);

  // Performance and status
  const getPerformance = useCallback(async (): Promise<AutofillPerformanceResult> => {
    if (!window.electronAPI) {
      const error = 'Electron API not available';
      setError(error);
      onError?.(error);
      return { success: false, error };
    }

    try {
      const result = await window.electronAPI.llmAutofillGetPerformance();
      return result;
    } catch (err) {
      const error = err instanceof Error ? err.message : 'Unknown error';
      setError(error);
      onError?.(error);
      return { success: false, error };
    }
  }, [onError]);

  const checkStatus = useCallback(async (): Promise<AutofillStatusResult> => {
    if (!window.electronAPI) {
      const error = 'Electron API not available';
      setError(error);
      onError?.(error);
      return { success: false, error };
    }

    try {
      const result = await window.electronAPI.llmAutofillCheckStatus();
      return result;
    } catch (err) {
      const error = err instanceof Error ? err.message : 'Unknown error';
      setError(error);
      onError?.(error);
      return { success: false, error };
    }
  }, [onError]);

  // Debounced suggestion function
  const getSuggestionDebounced = useCallback((fieldContext: FieldContext) => {
    if (debounceTimeoutRef.current) {
      clearTimeout(debounceTimeoutRef.current);
    }

    debounceTimeoutRef.current = setTimeout(() => {
      getSuggestion(fieldContext);
    }, debounceMs);
  }, [getSuggestion, debounceMs]);

  // Cleanup on unmount
  useEffect(() => {
    return () => {
      if (debounceTimeoutRef.current) {
        clearTimeout(debounceTimeoutRef.current);
      }
    };
  }, []);

  return {
    // Core autofill functions
    getSuggestion,
    generateQuestion,
    validateInput,
    processInput,
    
    // Profile management
    getProfile,
    updateProfile,
    
    // Performance and status
    getPerformance,
    checkStatus,
    
    // UI state management
    setCursorState,
    setFocus,
    
    // State
    isProcessing,
    lastSuggestion,
    lastQuestion,
    lastValidation,
    error
  };
};

export default useLLMAutofill;

