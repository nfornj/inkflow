const { contextBridge, ipcRenderer } = require('electron');

// Expose protected methods that allow the renderer process to use
// the ipcRenderer without exposing the entire object
contextBridge.exposeInMainWorld('electronAPI', {
  // Unified content navigation (web + PDF)
  navigateUrl: (url) => ipcRenderer.invoke('navigate-url', url),
  loadPdfFile: (filePath) => ipcRenderer.invoke('load-pdf-file', filePath),
  loadPdfData: (pdfData, fileName) => ipcRenderer.invoke('load-pdf-data', pdfData, fileName),
  
  // Browser navigation controls
  browserBack: () => ipcRenderer.invoke('browser-back'),
  browserForward: () => ipcRenderer.invoke('browser-forward'),
  browserReload: () => ipcRenderer.invoke('browser-reload'),
  browserStop: () => ipcRenderer.invoke('browser-stop'),
  hideBrowser: () => ipcRenderer.invoke('hide-browser'),
  showBrowser: () => ipcRenderer.invoke('show-browser'),
  setActiveTab: (tabId) => ipcRenderer.invoke('set-active-tab', tabId),

  // File operations
  openFileDialog: () => ipcRenderer.invoke('open-file-dialog'),
  saveFileDialog: (data, defaultName) => ipcRenderer.invoke('save-file-dialog', data, defaultName),

  // AI integration
  askAI: (prompt, provider, apiKey) => ipcRenderer.invoke('ask-ai', prompt, provider, apiKey),
  analyzePdfWithGemini: (request) => ipcRenderer.invoke('analyze-pdf-with-gemini', request),
  analyzePdf: (request) => ipcRenderer.invoke('analyze-pdf', request),
  
  // Llama model management
  downloadLlamaModel: () => ipcRenderer.invoke('download-llama-model'),
  checkLlamaModel: () => ipcRenderer.invoke('check-llama-model'),
  requestMacosPermissions: () => ipcRenderer.invoke('request-macos-permissions'),
  installOllama: () => ipcRenderer.invoke('install-ollama'),
  startOllamaService: () => ipcRenderer.invoke('start-ollama-service'),
  testOllamaConnection: () => ipcRenderer.invoke('test-ollama-connection'),
  testOllamaInstallation: () => ipcRenderer.invoke('test-ollama-installation'),
  
  // Llama download progress listeners
  onLlamaDownloadProgress: (callback) => {
    ipcRenderer.on('llama-download-progress', (event, progress) => callback(progress));
  },
  onLlamaDownloadComplete: (callback) => {
    ipcRenderer.on('llama-download-complete', () => callback());
  },
  onOllamaInstallProgress: (callback) => {
    ipcRenderer.on('ollama-install-progress', (event, data) => callback(data));
  },

  // Window management
  windowResized: () => ipcRenderer.invoke('window-resized'),
  sidebarResized: (sidebarWidth) => ipcRenderer.invoke('sidebar-resized', sidebarWidth),
  updateLayout: (layout) => ipcRenderer.invoke('update-layout', layout),
  setTheme: (theme) => ipcRenderer.invoke('set-theme', theme),
  getThemeInfo: () => ipcRenderer.invoke('get-theme-info'),
  onNativeThemeUpdated: (callback) => {
    ipcRenderer.on('native-theme-updated', (event, data) => callback(data));
  },

  // Settings API
  getSettings: () => ipcRenderer.invoke('get-settings'),
  updateSettings: (partial) => ipcRenderer.invoke('update-settings', partial),

  // Unified content event listeners
  onUnifiedContentLoading: (callback) => {
    ipcRenderer.on('unified-content-loading', (event, data) => callback(data));
  },
  onUnifiedContentLoaded: (callback) => {
    ipcRenderer.on('unified-content-loaded', (event, data) => callback(data));
  },
  onUnifiedContentError: (callback) => {
    ipcRenderer.on('unified-content-error', (event, data) => callback(data));
  },
  onUnifiedContentNavigate: (callback) => {
    ipcRenderer.on('unified-content-navigate', (event, data) => callback(data));
  },
  onPdfDetected: (callback) => {
    ipcRenderer.on('pdf-detected', (event, data) => callback(data));
  },
  
  // Legacy browser event listeners (for backward compatibility)
  onBrowserLoading: (callback) => {
    ipcRenderer.on('browser-loading', (event, data) => callback(data));
  },
  onBrowserUrlChanged: (callback) => {
    ipcRenderer.on('browser-url-changed', (event, data) => callback(data));
  },
  onBrowserError: (callback) => {
    ipcRenderer.on('browser-error', (event, data) => callback(data));
  },

  // Remove listeners
  removeAllListeners: (channel) => {
    ipcRenderer.removeAllListeners(channel);
  },

  // PDF Processor APIs (OCR + AI approach)
  pdfProcessorAnalyze: (pdfBuffer, options) => ipcRenderer.invoke('pdf-processor-analyze', pdfBuffer, options),
  pdfProcessorCheckAvailability: () => ipcRenderer.invoke('pdf-processor-check-availability'),

  // PDF Finalizer APIs (burning in form data)
  pdfFinalizerFinalize: (originalPdfBuffer, formData, options) => ipcRenderer.invoke('pdf-finalizer-finalize', originalPdfBuffer, formData, options),
  pdfFinalizerValidateFormData: (formData) => ipcRenderer.invoke('pdf-finalizer-validate-form-data', formData),

  // LLM Form Analyzer APIs
  analyzePDFMultiModal: (request) => ipcRenderer.invoke('analyze-pdf-multimodal', request),
  analyzePDFWithLLM: (request) => ipcRenderer.invoke('analyze-pdf-with-llm', request), // Legacy
  clearFormCache: () => ipcRenderer.invoke('clear-form-cache'),
  updateLLMTodoStatus: (request) => ipcRenderer.invoke('update-llm-todo-status', request),

  // LLM Provider Management
  getLLMProviders: () => ipcRenderer.invoke('get-llm-providers'),
  switchLLMProvider: (providerId) => ipcRenderer.invoke('switch-llm-provider', providerId),
  getLLMPerformance: () => ipcRenderer.invoke('get-llm-performance'),
  autoSelectBestProvider: () => ipcRenderer.invoke('auto-select-best-provider'),
  extractPDFText: (pdfBytes) => ipcRenderer.invoke('extract-pdf-text', pdfBytes),
  
  // Debug logging
  debugLog: (message) => ipcRenderer.invoke('debug-log', message),

  // LLM Autofill APIs
  llmAutofillGetSuggestion: (fieldContext) => ipcRenderer.invoke('llm-autofill-get-suggestion', fieldContext),
  llmAutofillGenerateQuestion: (fieldContext) => ipcRenderer.invoke('llm-autofill-generate-question', fieldContext),
  llmAutofillValidateInput: (input, fieldType) => ipcRenderer.invoke('llm-autofill-validate-input', input, fieldType),
  llmAutofillProcessInput: (input, fieldType) => ipcRenderer.invoke('llm-autofill-process-input', input, fieldType),
  llmAutofillGetProfile: () => ipcRenderer.invoke('llm-autofill-get-profile'),
  llmAutofillUpdateProfile: (field, value) => ipcRenderer.invoke('llm-autofill-update-profile', field, value),
  llmAutofillGetPerformance: () => ipcRenderer.invoke('llm-autofill-get-performance'),
  llmAutofillCheckStatus: () => ipcRenderer.invoke('llm-autofill-check-status')
});

// Environment variables
contextBridge.exposeInMainWorld('env', {
  NODE_ENV: process.env.NODE_ENV
});

