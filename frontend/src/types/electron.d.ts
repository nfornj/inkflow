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
  openFileDialog: () => Promise<{ success: boolean; filePath?: string; fileName?: string; fileBuffer?: ArrayBuffer; error?: string }>;
  saveFileDialog: (data: any, defaultName: string) => Promise<{ success: boolean; filePath?: string; error?: string }>;

  // AI integration
  askAI: (prompt: string, provider?: 'gemini' | 'openai' | 'llama', apiKey?: string) => Promise<{ success: boolean; content?: string; error?: string }>;
  analyzePdfWithGemini: (request: any) => Promise<{ success: boolean; summary?: string; contentType?: string; error?: string }>;

  // Llama model management
  downloadLlamaModel: () => Promise<{ success: boolean; message?: string; error?: string }>;
  checkLlamaModel: () => Promise<{ success: boolean; available: boolean; path?: string; error?: string }>;

  // Window management
  windowResized: () => Promise<{ success: boolean }>;

  // Event listeners
  onBrowserLoading: (callback: (data: { loading: boolean }) => void) => void;
  onBrowserUrlChanged: (callback: (data: { url: string }) => void) => void;
  onBrowserError: (callback: (data: { error: string }) => void) => void;

  // Llama download progress listeners
  onLlamaDownloadProgress: (callback: (progress: number) => void) => void;
  onLlamaDownloadComplete: (callback: () => void) => void;

  // Remove listeners
  removeAllListeners: (channel: string) => void;
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
