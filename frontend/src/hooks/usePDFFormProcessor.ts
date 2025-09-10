import { useState, useCallback, useEffect } from 'react';
import { getPDFTextExtractor, cleanupPDFTextExtractor, PDFExtractionResult } from '../utils/pdfTextExtractor';
import { FormFieldDetector, FormFieldDetectionResult } from '../utils/formFieldDetector';
import { TodoGenerator, TodoListResult, TodoItem } from '../utils/todoGenerator';

export interface PDFFormProcessorState {
  // Processing states
  isProcessing: boolean;
  isInitialized: boolean;
  processingStep: 'idle' | 'extracting' | 'detecting' | 'generating' | 'complete' | 'error';
  progress: number;
  
  // Results
  extractionResult: PDFExtractionResult | null;
  detectionResult: FormFieldDetectionResult | null;
  todoResult: TodoListResult | null;
  
  // Error handling
  error: string | null;
  
  // Performance metrics
  totalProcessingTime: number;
}

export interface PDFFormProcessorActions {
  processPDF: (pdfBytes: Uint8Array) => Promise<boolean>;
  updateTodoStatus: (todoId: string, status: TodoItem['status']) => void;
  clearResults: () => void;
  retryProcessing: () => void;
}

export interface PDFFormProcessorReturn extends PDFFormProcessorState, PDFFormProcessorActions {
  // Convenience getters
  hasResults: boolean;
  isReady: boolean;
}

const PROCESSING_STEPS = {
  idle: 0,
  extracting: 25,
  detecting: 50,
  generating: 75,
  complete: 100,
  error: 0
};

export const usePDFFormProcessor = (): PDFFormProcessorReturn => {
  const [state, setState] = useState<PDFFormProcessorState>({
    isProcessing: false,
    isInitialized: false,
    processingStep: 'idle',
    progress: 0,
    extractionResult: null,
    detectionResult: null,
    todoResult: null,
    error: null,
    totalProcessingTime: 0
  });

  // Keep track of current PDF bytes for retrying
  const [currentPdfBytes, setCurrentPdfBytes] = useState<Uint8Array | null>(null);

  // Instances
  const [formFieldDetector] = useState(() => new FormFieldDetector());
  const [todoGenerator] = useState(() => new TodoGenerator());

  // Initialize on mount
  useEffect(() => {
    const initialize = async () => {
      try {
        // PDF text extractor will be initialized when first used
        setState(prev => ({ ...prev, isInitialized: true }));
        console.log('PDF Form Processor initialized');
      } catch (error) {
        console.error('Failed to initialize PDF Form Processor:', error);
        setState(prev => ({
          ...prev,
          error: error instanceof Error ? error.message : 'Initialization failed',
          processingStep: 'error'
        }));
      }
    };

    initialize();

    // Cleanup on unmount
    return () => {
      cleanupPDFTextExtractor();
    };
  }, []);

  const updateProgress = useCallback((step: PDFFormProcessorState['processingStep'], customProgress?: number) => {
    setState(prev => ({
      ...prev,
      processingStep: step,
      progress: customProgress ?? PROCESSING_STEPS[step]
    }));
  }, []);

  const processPDF = useCallback(async (pdfBytes: Uint8Array): Promise<boolean> => {
    if (!state.isInitialized) {
      console.error('PDF Form Processor not initialized');
      return false;
    }

    const startTime = Date.now();
    setCurrentPdfBytes(pdfBytes);

    try {
      setState(prev => ({
        ...prev,
        isProcessing: true,
        error: null,
        extractionResult: null,
        detectionResult: null,
        todoResult: null
      }));

      console.log('Starting PDF form processing pipeline...');

      // Step 1: Extract text using Tesseract.js
      updateProgress('extracting');
      console.log('Step 1: Extracting text with OCR...');
      
      let extractionResult: PDFExtractionResult;
      try {
        const extractor = await getPDFTextExtractor();
        extractionResult = await extractor.extractTextFromPDF(pdfBytes);
        
        if (!extractionResult.success) {
          throw new Error(`Text extraction failed: ${extractionResult.error}`);
        }
      } catch (ocrError) {
        console.warn('OCR extraction failed, creating empty result:', ocrError);
        
        // Create a fallback empty result so the app doesn't crash
        extractionResult = {
          pages: [],
          totalPages: 0,
          processingTime: 0,
          success: false,
          error: ocrError instanceof Error ? ocrError.message : 'OCR failed'
        };
        
        // Re-throw to be handled by outer catch
        throw new Error(`OCR processing failed: ${ocrError instanceof Error ? ocrError.message : 'Unknown error'}`);
      }

      console.log(`Text extraction completed: ${extractionResult.pages.length} pages processed`);
      setState(prev => ({ ...prev, extractionResult }));

      // Step 2: Detect form fields
      updateProgress('detecting');
      console.log('Step 2: Detecting form fields...');
      
      const detectionResult = formFieldDetector.detectFormFields(extractionResult.pages);
      
      if (!detectionResult.success) {
        throw new Error(`Form field detection failed: ${detectionResult.error}`);
      }

      console.log(`Form field detection completed: ${detectionResult.totalFields} fields found`);
      setState(prev => ({ ...prev, detectionResult }));

      // Step 3: Generate todo list
      updateProgress('generating');
      console.log('Step 3: Generating todo list...');
      
      const todoResult = todoGenerator.generateTodoList(detectionResult);
      
      if (!todoResult.success) {
        throw new Error(`Todo generation failed: ${todoResult.error}`);
      }

      console.log(`Todo generation completed: ${todoResult.categories.length} categories, ${todoResult.totalItems} items`);

      const totalProcessingTime = Date.now() - startTime;
      
      setState(prev => ({
        ...prev,
        todoResult,
        totalProcessingTime,
        isProcessing: false,
        processingStep: 'complete',
        progress: 100
      }));

      console.log(`PDF form processing completed successfully in ${totalProcessingTime}ms`);
      return true;

    } catch (error) {
      const totalProcessingTime = Date.now() - startTime;
      const errorMessage = error instanceof Error ? error.message : 'Unknown error occurred';
      
      console.error('PDF form processing failed:', error);
      
      setState(prev => ({
        ...prev,
        error: errorMessage,
        isProcessing: false,
        processingStep: 'error',
        progress: 0,
        totalProcessingTime
      }));

      return false;
    }
  }, [state.isInitialized, formFieldDetector, todoGenerator, updateProgress]);

  const updateTodoStatus = useCallback((todoId: string, status: TodoItem['status']) => {
    setState(prev => {
      if (!prev.todoResult) return prev;

      const updatedCategories = todoGenerator.updateTodoStatus(
        prev.todoResult.categories,
        todoId,
        status
      );

      // Recalculate progress
      const totalItems = updatedCategories.reduce((sum, cat) => sum + cat.items.length, 0);
      const completedItems = updatedCategories.reduce((sum, cat) => sum + cat.completed, 0);
      const progress = totalItems > 0 ? Math.round((completedItems / totalItems) * 100) : 0;

      // Find next action
      const nextAction = updatedCategories
        .sort((a, b) => a.priority - b.priority)
        .find(cat => cat.items.some(item => item.status === 'pending'))
        ?.items.find(item => item.status === 'pending');

      return {
        ...prev,
        todoResult: {
          ...prev.todoResult,
          categories: updatedCategories,
          totalItems,
          completedItems,
          progress,
          nextAction
        }
      };
    });

    console.log(`Updated todo item ${todoId} status to ${status}`);
  }, [todoGenerator]);

  const clearResults = useCallback(() => {
    setState(prev => ({
      ...prev,
      extractionResult: null,
      detectionResult: null,
      todoResult: null,
      error: null,
      processingStep: 'idle',
      progress: 0,
      totalProcessingTime: 0
    }));
    
    setCurrentPdfBytes(null);
    console.log('Cleared all processing results');
  }, []);

  const retryProcessing = useCallback(() => {
    if (currentPdfBytes) {
      console.log('Retrying PDF processing...');
      processPDF(currentPdfBytes);
    } else {
      console.error('Cannot retry: no PDF data available');
    }
  }, [currentPdfBytes, processPDF]);

  // Convenience getters
  const hasResults = Boolean(state.todoResult && state.todoResult.success);
  const isReady = state.isInitialized && !state.isProcessing;

  return {
    // State
    ...state,
    
    // Actions
    processPDF,
    updateTodoStatus,
    clearResults,
    retryProcessing,
    
    // Convenience
    hasResults,
    isReady
  };
};

// Export convenience function to get processing status message
export const getProcessingStatusMessage = (step: PDFFormProcessorState['processingStep']): string => {
  switch (step) {
    case 'idle':
      return 'Ready to process PDF';
    case 'extracting':
      return 'Extracting text with OCR...';
    case 'detecting':
      return 'Identifying form fields...';
    case 'generating':
      return 'Creating todo list...';
    case 'complete':
      return 'Processing complete';
    case 'error':
      return 'Processing failed';
    default:
      return 'Processing...';
  }
};

// Export hook for debugging/development
export const usePDFFormProcessorDebug = () => {
  const processor = usePDFFormProcessor();
  
  // Log state changes in development
  useEffect(() => {
    if (process.env.NODE_ENV === 'development') {
      console.log('PDF Form Processor State:', {
        step: processor.processingStep,
        progress: processor.progress,
        hasResults: processor.hasResults,
        isReady: processor.isReady,
        error: processor.error
      });
    }
  }, [processor.processingStep, processor.progress, processor.hasResults, processor.isReady, processor.error]);
  
  return processor;
};
