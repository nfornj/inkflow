const { contextBridge, ipcRenderer } = require('electron');

// Expose protected methods that allow the renderer process to use
// the ipcRenderer without exposing the entire object
contextBridge.exposeInMainWorld('electronAPI', {
  // Browser navigation
  navigateUrl: (url) => ipcRenderer.invoke('navigate-url', url),
  browserBack: () => ipcRenderer.invoke('browser-back'),
  browserForward: () => ipcRenderer.invoke('browser-forward'),
  browserReload: () => ipcRenderer.invoke('browser-reload'),
  browserStop: () => ipcRenderer.invoke('browser-stop'),
  hideBrowser: () => ipcRenderer.invoke('hide-browser'),
  showBrowser: () => ipcRenderer.invoke('show-browser'),

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

  // Event listeners
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

