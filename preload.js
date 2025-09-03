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
  
  // Llama model management
  downloadLlamaModel: () => ipcRenderer.invoke('download-llama-model'),
  checkLlamaModel: () => ipcRenderer.invoke('check-llama-model'),
  
  // Llama download progress listeners
  onLlamaDownloadProgress: (callback) => {
    ipcRenderer.on('llama-download-progress', (event, progress) => callback(progress));
  },
  onLlamaDownloadComplete: (callback) => {
    ipcRenderer.on('llama-download-complete', () => callback());
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
  }
});

// Environment variables
contextBridge.exposeInMainWorld('env', {
  NODE_ENV: process.env.NODE_ENV
});

