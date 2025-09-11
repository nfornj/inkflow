import { useState, useCallback, useRef } from 'react';

export interface LLMFormField {
    id: string;
    name: string;
    type: string;
    section: string;
    required: boolean;
    placeholder?: string;
    validation?: string;
    confidence: number;
    position: {
        page: number;
        approximate_location: string;
    };
}

export interface LLMFormSection {
    id: string;
    title: string;
    description: string;
    priority: number;
    required: boolean;
    fields: string[];
}

export interface LLMTodoItem {
    id: string;
    title: string;
    description: string;
    status: 'pending' | 'in_progress' | 'completed' | 'skipped';
    priority: 'high' | 'medium' | 'low';
    required: boolean;
    estimatedTime: string;
    fieldIds: string[];
    tips: string[];
    completionAnimation: string;
    animationTrigger?: {
        type: string;
        timestamp: number;
        animation: string;
    };
}

export interface LLMTodoCategory {
    id: string;
    name: string;
    icon: string;
    description: string;
    priority: number;
    required: boolean;
    estimatedTime: string;
    items: LLMTodoItem[];
    completed: number;
    total: number;
    progress: number;
}

export interface LLMFormAnalysisResult {
    success: boolean;
    formStructure: {
        sections: LLMFormSection[];
        fields: LLMFormField[];
        metadata: {
            form_type: string;
            estimated_completion_time: string;
            complexity: string;
        };
    };
    todoList: {
        categories: LLMTodoCategory[];
        summary: {
            totalItems: number;
            completedItems: number;
            progress: number;
            estimatedTotalTime: string;
            requiredItems: number;
            optionalItems: number;
        };
    };
    fieldMapping: Record<string, any>;
    metadata: {
        processingTime: number;
        totalSections: number;
        totalFields: number;
        requiredFields: number;
        method: string;
    };
    error?: string;
}

export interface LLMFormProcessorState {
    isProcessing: boolean;
    isInitialized: boolean;
    progress: number;
    processingStep: 'idle' | 'extracting' | 'analyzing' | 'generating' | 'completed';
    analysisResult: LLMFormAnalysisResult | null;
    error: string | null;
    animationQueue: Array<{
        todoId: string;
        animation: string;
        timestamp: number;
    }>;
}

const PROCESSING_STEPS = {
    idle: 0,
    extracting: 25,
    analyzing: 50,
    generating: 75,
    completed: 100
};

export const useLLMFormProcessor = () => {
    const [state, setState] = useState<LLMFormProcessorState>({
        isProcessing: false,
        isInitialized: false,
        progress: 0,
        processingStep: 'idle',
        analysisResult: null,
        error: null,
        animationQueue: []
    });

    const processingRef = useRef<boolean>(false);

    const updateProgress = useCallback((step: LLMFormProcessorState['processingStep'], customProgress?: number) => {
        setState(prev => ({
            ...prev,
            processingStep: step,
            progress: customProgress ?? PROCESSING_STEPS[step]
        }));
    }, []);

    const processPDFWithLLM = useCallback(async (pdfBytes: Uint8Array): Promise<boolean> => {
      console.log('🚀🚀🚀 FRONTEND FUNCTION CALLED: processPDFWithLLM with', pdfBytes?.length, 'bytes');
      if (window.electronAPI?.debugLog) {
        window.electronAPI.debugLog(`🚀🚀🚀 FRONTEND FUNCTION CALLED: processPDFWithLLM with ${pdfBytes?.length} bytes`);
      }
      console.log('🚀 FRONTEND: Processing state check:', {
        isCurrentlyProcessing: processingRef.current,
        hasElectronAPI: !!window.electronAPI,
        hasAnalyzePDFWithLLM: !!window.electronAPI?.analyzePDFWithLLM
      });

        if (processingRef.current) {
            console.warn('LLM form processing already in progress');
            return false;
        }

        processingRef.current = true;
        const startTime = Date.now();

        try {
            setState(prev => ({
                ...prev,
                isProcessing: true,
                error: null,
                analysisResult: null,
                animationQueue: []
            }));

            console.log('Starting LLM-powered form analysis...');

            // Step 1: Extract PDF text content
            updateProgress('extracting');
            console.log('Step 1: Extracting PDF text content...');
            console.log('PDF bytes length:', pdfBytes.length);

            const pdfText = await extractPDFText(pdfBytes);
            console.log('PDF text extraction result:', {
                textLength: pdfText?.length || 0,
                hasText: !!pdfText,
                preview: pdfText?.substring(0, 200) + '...'
            });

            if (!pdfText || pdfText.trim().length === 0) {
                throw new Error('No text content found in PDF');
            }

            console.log(`Extracted ${pdfText.length} characters of text`);

            // Step 2: Analyze with LLM
            updateProgress('analyzing');
            console.log('Step 2: Analyzing form structure with LLM...');

            const analysisResult = await window.electronAPI?.analyzePDFWithLLM({
                pdfText: pdfText,
                options: {
                    includeFieldMapping: true,
                    generateTodos: true,
                    enableAnimations: true
                }
            });

            console.log('Frontend received analysis result:', {
                hasResult: !!analysisResult,
                success: analysisResult?.success,
                hasTodoList: !!analysisResult?.todoList,
                categoriesCount: analysisResult?.todoList?.categories?.length,
                categories: analysisResult?.todoList?.categories?.map(cat => ({ name: cat.name, itemCount: cat.items?.length }))
            });

            if (!analysisResult) {
                throw new Error('Failed to get analysis result from Electron API');
            }

            if (!analysisResult.success) {
                throw new Error(`LLM analysis failed: ${analysisResult.error}`);
            }

            // Step 3: Generate final todo structure
            updateProgress('generating');
            console.log('Step 3: Finalizing todo structure...');

            // Process and validate the analysis result
            const processedResult = processAnalysisResult(analysisResult);

      console.log('🎉 FRONTEND: Setting analysis result in state:', {
        hasTodoList: !!processedResult.todoList,
        categoriesCount: processedResult.todoList?.categories?.length,
        totalItems: processedResult.todoList?.summary?.totalItems
      });
      
      setState(prev => ({
        ...prev,
        analysisResult: processedResult,
        isInitialized: true
      }));
      
      console.log('🎉 FRONTEND: State updated successfully');

            updateProgress('completed');

            const processingTime = Date.now() - startTime;
            console.log(`\n=== LLM FORM PROCESSING COMPLETED ===`);
            console.log(`Total processing time: ${processingTime}ms`);
            console.log(`Sections detected: ${processedResult.formStructure.sections.length}`);
            console.log(`Fields detected: ${processedResult.formStructure.fields.length}`);
            console.log(`Todo categories: ${processedResult.todoList.categories.length}`);
            console.log(`Total todo items: ${processedResult.todoList.summary.totalItems}`);

            return true;

        } catch (error) {
            console.error('LLM form processing failed:', error);
            console.error('Error details:', {
                message: error instanceof Error ? error.message : 'Unknown error',
                stack: error instanceof Error ? error.stack : undefined,
                type: typeof error
            });
            setState(prev => ({
                ...prev,
                error: error instanceof Error ? error.message : 'Unknown error occurred',
                analysisResult: null
            }));
            return false;

        } finally {
            processingRef.current = false;
            setState(prev => ({
                ...prev,
                isProcessing: false
            }));
        }
    }, [updateProgress]);

    const updateTodoStatus = useCallback((todoId: string, status: LLMTodoItem['status']) => {
        setState(prev => {
            if (!prev.analysisResult) return prev;

            const updatedResult = { ...prev.analysisResult };
            const updatedTodoList = { ...updatedResult.todoList };
            const updatedCategories = updatedTodoList.categories.map(category => {
                const updatedCategory = { ...category };
                const updatedItems = category.items.map(item => {
                    if (item.id === todoId) {
                        const oldStatus = item.status;
                        const updatedItem = { ...item, status };

                        // Add completion animation trigger
                        if (oldStatus !== 'completed' && status === 'completed') {
                            updatedItem.animationTrigger = {
                                type: 'completion',
                                timestamp: Date.now(),
                                animation: item.completionAnimation || 'checkmark'
                            };

                            // Add to animation queue
                            const newAnimation = {
                                todoId,
                                animation: item.completionAnimation || 'checkmark',
                                timestamp: Date.now()
                            };

                            setState(prevState => ({
                                ...prevState,
                                animationQueue: [...prevState.animationQueue, newAnimation]
                            }));
                        }

                        return updatedItem;
                    }
                    return item;
                });

                updatedCategory.items = updatedItems;
                updatedCategory.completed = updatedItems.filter(item => item.status === 'completed').length;
                updatedCategory.progress = Math.round((updatedCategory.completed / updatedCategory.total) * 100);

                return updatedCategory;
            });

            updatedTodoList.categories = updatedCategories;

            // Update summary
            updatedTodoList.summary.completedItems = updatedCategories
                .reduce((sum, cat) => sum + cat.completed, 0);
            updatedTodoList.summary.progress = Math.round(
                (updatedTodoList.summary.completedItems / updatedTodoList.summary.totalItems) * 100
            );

            updatedResult.todoList = updatedTodoList;

            return {
                ...prev,
                analysisResult: updatedResult
            };
        });
    }, []);

    const clearAnimationQueue = useCallback(() => {
        setState(prev => ({
            ...prev,
            animationQueue: []
        }));
    }, []);

    const getTodoById = useCallback((todoId: string): LLMTodoItem | null => {
        if (!state.analysisResult) return null;

        for (const category of state.analysisResult.todoList.categories) {
            const item = category.items.find(item => item.id === todoId);
            if (item) return item;
        }

        return null;
    }, [state.analysisResult]);

    const getCategoryProgress = useCallback((categoryId: string): number => {
        if (!state.analysisResult) return 0;

        const category = state.analysisResult.todoList.categories.find(cat => cat.id === categoryId);
        return category ? category.progress : 0;
    }, [state.analysisResult]);

    return {
        // State
        isProcessing: state.isProcessing,
        isInitialized: state.isInitialized,
        progress: state.progress,
        processingStep: state.processingStep,
        analysisResult: state.analysisResult,
        error: state.error,
        animationQueue: state.animationQueue,

        // Actions
        processPDFWithLLM,
        updateTodoStatus,
        clearAnimationQueue,
        getTodoById,
        getCategoryProgress,

        // Computed values
        todoList: state.analysisResult?.todoList || null,
        formStructure: state.analysisResult?.formStructure || null,
        fieldMapping: state.analysisResult?.fieldMapping || {},
        totalProgress: state.analysisResult?.todoList.summary.progress || 0,
        hasAnimations: state.animationQueue.length > 0
    };
};

// Helper function to extract PDF text
async function extractPDFText(pdfBytes: Uint8Array): Promise<string> {
    try {
        console.log('extractPDFText: Starting PDF text extraction with', pdfBytes.length, 'bytes');

        // Use PDF.js directly in the frontend (avoid main process issues)
        const pdfjsLib = await import('pdfjs-dist');

        // Configure worker if not already done
        if (!pdfjsLib.GlobalWorkerOptions.workerSrc) {
            pdfjsLib.GlobalWorkerOptions.workerSrc = `//cdnjs.cloudflare.com/ajax/libs/pdf.js/${pdfjsLib.version}/pdf.worker.min.js`;
        }

        const pdf = await pdfjsLib.getDocument({ data: pdfBytes }).promise;
        let fullText = '';

        console.log('extractPDFText: Processing', pdf.numPages, 'pages');

        for (let pageNum = 1; pageNum <= pdf.numPages; pageNum++) {
            const page = await pdf.getPage(pageNum);
            const textContent = await page.getTextContent();

            const pageText = textContent.items
                .map((item: any) => item.str)
                .join(' ');

            fullText += `\n\n--- Page ${pageNum} ---\n${pageText}`;
        }

        console.log('extractPDFText: Extracted', fullText.length, 'characters');
        return fullText.trim();

    } catch (error) {
        console.error('PDF text extraction failed:', error);
        throw new Error(`Failed to extract PDF text: ${error instanceof Error ? error.message : 'Unknown error'}`);
    }
}

// Helper function to process and validate analysis result
function processAnalysisResult(rawResult: any): LLMFormAnalysisResult {
    // Validate and sanitize the result from the LLM analyzer
    const result: LLMFormAnalysisResult = {
        success: rawResult.success || false,
        formStructure: {
            sections: rawResult.formStructure?.sections || [],
            fields: rawResult.formStructure?.fields || [],
            metadata: rawResult.formStructure?.metadata || {
                form_type: 'unknown',
                estimated_completion_time: '10 minutes',
                complexity: 'medium'
            }
        },
        todoList: {
            categories: rawResult.todoList?.categories || [],
            summary: rawResult.todoList?.summary || {
                totalItems: 0,
                completedItems: 0,
                progress: 0,
                estimatedTotalTime: '0 minutes',
                requiredItems: 0,
                optionalItems: 0
            }
        },
        fieldMapping: rawResult.fieldMapping || {},
        metadata: rawResult.metadata || {
            processingTime: 0,
            totalSections: 0,
            totalFields: 0,
            requiredFields: 0,
            method: 'llm_analysis'
        },
        error: rawResult.error
    };

    return result;
}
