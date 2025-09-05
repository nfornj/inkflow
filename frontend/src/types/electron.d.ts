// TypeScript declarations for Electron API

export interface ElectronAPI {
  // Browser navigation
  navigateUrl: (url: string) => Promise<{ success: boolean; browserId?: string; error?: string }>;
  browserBack: () => Promise<{ success: boolean }>;
  browserForward: () => Promise<{ success: boolean }>;
  browserReload: () => Promise<{ success: boolean }>;
  browserStop: () => Promise<{ success: boolean }>;
  hideBrowser: () => Promise<{ success: boolean }>;
  showBrowser: () => Promise<{ success: boolean }>;

  // File operations
  openFileDialog: () => Promise<{ success: boolean; filePath?: string; fileName?: string; data?: ArrayBuffer; error?: string }>;
  saveFileDialog: (data: any, defaultName: string) => Promise<{ success: boolean; filePath?: string; error?: string }>;

  // AI integration
  askAI: (prompt: string, provider?: 'llama') => Promise<{ success: boolean; content?: string; error?: string }>;
  analyzePdf: (request: { textContent: string; provider?: string }) => Promise<{ success: boolean; content?: string; error?: string }>;

  // Llama model management
  downloadLlamaModel: () => Promise<{ success: boolean; message?: string; error?: string }>;
  checkLlamaModel: () => Promise<{ success: boolean; available: boolean; path?: string; error?: string; reason?: string; message?: string; ollamaPath?: string }>;
  requestMacosPermissions: () => Promise<{ success: boolean; message?: string; hasTerminalAccess?: boolean; suggestion?: string }>;
  installOllama: () => Promise<{ success: boolean; message?: string; error?: string; path?: string }>;
  startOllamaService: () => Promise<{ success: boolean; message?: string; error?: string }>;
  testOllamaConnection: () => Promise<{ success: boolean; message?: string; error?: string; models?: any[] }>;
  testOllamaInstallation: () => Promise<{ success: boolean; message?: string; error?: string; version?: string; stderr?: string }>;

  // Window management
  windowResized: () => Promise<{ success: boolean }>;

  // Event listeners
  onBrowserLoading: (callback: (data: { loading: boolean }) => void) => void;
  onBrowserUrlChanged: (callback: (data: { url: string }) => void) => void;
  onBrowserError: (callback: (data: { error: string }) => void) => void;

  // Llama download progress listeners
  onLlamaDownloadProgress: (callback: (progress: number) => void) => void;
  onLlamaDownloadComplete: (callback: () => void) => void;
  onOllamaInstallProgress: (callback: (data: { step: string; progress: number }) => void) => void;

  // Remove listeners
  removeAllListeners: (channel: string) => void;

  // LLM Autofill APIs
  llmAutofillGetSuggestion: (fieldContext: FieldContext) => Promise<AutofillSuggestionResult>;
  llmAutofillGenerateQuestion: (fieldContext: FieldContext) => Promise<AutofillQuestionResult>;
  llmAutofillValidateInput: (input: string, fieldType: string) => Promise<AutofillValidationResult>;
  llmAutofillProcessInput: (input: string, fieldType: string) => Promise<AutofillProcessResult>;
  llmAutofillGetProfile: () => Promise<AutofillProfileResult>;
  llmAutofillUpdateProfile: (field: string, value: string) => Promise<AutofillUpdateResult>;
  llmAutofillGetPerformance: () => Promise<AutofillPerformanceResult>;
  llmAutofillCheckStatus: () => Promise<AutofillStatusResult>;
}

// LLM Autofill Type Definitions
export interface FieldContext {
  field_type: string;
  field_name?: string;
  field_importance?: 'low' | 'medium' | 'high';
  required?: boolean;
  userInput?: string;
}

export interface AutofillSuggestionResult {
  success: boolean;
  suggestion?: string;
  confidence?: number;
  source?: string;
  reasoning?: string;
  performance?: {
    latency: number;
    averageLatency: number;
    successRate: number;
  };
  error?: string;
}

export interface AutofillQuestionResult {
  success: boolean;
  question?: string;
  field_type?: string;
  reasoning?: string;
  performance?: {
    latency: number;
    successRate: number;
  };
  error?: string;
}

export interface AutofillValidationResult {
  success: boolean;
  valid?: boolean;
  corrected_value?: string;
  feedback?: string;
  suggestions?: string[];
  performance?: {
    latency: number;
    successRate: number;
  };
  error?: string;
}

export interface AutofillProcessResult {
  success: boolean;
  value?: string;
  fieldType?: string;
  confidence?: number;
  error?: string;
}

export interface AutofillProfileResult {
  success: boolean;
  data?: {
    name?: string;
    email?: string;
    phone?: string;
    address?: {
      street?: string;
      city?: string;
      province?: string;
      postal_code?: string;
      country?: string;
    };
    company?: string;
    job_title?: string;
    date_of_birth?: string;
    preferences?: {
      locale?: string;
      date_format?: string;
      phone_format?: string;
    };
    last_updated?: string;
  };
  error?: string;
}

export interface AutofillUpdateResult {
  success: boolean;
  message?: string;
  error?: string;
}

export interface AutofillPerformanceResult {
  success: boolean;
  data?: {
    totalSuggestions: number;
    successfulSuggestions: number;
    averageLatency: number;
    lastSuggestionTime: number;
    errorRate: number;
    totalQuestions?: number;
    successfulQuestions?: number;
    lastQuestionTime?: number;
    totalValidations?: number;
    successfulValidations?: number;
    lastValidationTime?: number;
  };
  error?: string;
}

export interface AutofillStatusResult {
  success: boolean;
  data?: {
    isInitialized: boolean;
    isReady: boolean;
    currentModel?: string;
  };
  error?: string;
}

declare global {
  interface Window {
    electronAPI?: ElectronAPI;
    env?: {
      NODE_ENV: string;
    };
  }
}

export {};
