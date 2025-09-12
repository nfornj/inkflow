const { app, BrowserWindow, BrowserView, ipcMain, dialog, Menu, nativeTheme } = require('electron');
const Store = require('electron-store');
const path = require('path');
const fs = require('fs').promises;

// Load environment variables from .env file
require('dotenv').config();

// Import LLM Autofill Engine
const AutofillEngine = require('./src/main/autofill-engine');

// Import PDF Processor for OCR + AI approach
const PDFProcessor = require('./src/main/pdf-processor');

// Import PDF Finalizer for burning in form data
const PDFFinalizer = require('./src/main/pdf-finalizer');

// Import LLM Form Analyzer for enhanced form detection
const { LLMFormAnalyzer } = require('./src/main/llm-form-analyzer');

// Import Multi-Modal Form Detector
const FormDetector = require('./src/main/form-detector');

// Import LLM Provider System
const LLMProviderManager = require('./src/main/llm-provider-manager');
const LlamaProvider = require('./src/main/llm-providers/llama-provider');
const MiniCPMProvider = require('./src/main/llm-providers/minicpm-provider');

// Global variables
let mainWindow;
let browserView;
let currentBrowserViewId = null;
let currentSidebarWidth = 320; // Track current sidebar width
let currentTopInset = 120; // Track current top inset (header + tabs + indicators)
let currentContentType = 'web'; // Track current content type of BrowserView
let currentContentUrl = ''; // Track current URL/file loaded in BrowserView
let activeTabId = null; // Renderer-provided logical tab id
let autofillEngine = null;
let pdfProcessor = null;
let pdfFinalizer = null;
let llmFormAnalyzer = null;
let formDetector = null;
let llmProviderManager = null;

// Function to update BrowserView bounds based on current layout
function updateBrowserViewBounds() {
  if (!mainWindow || !browserView) return;
  
  const bounds = mainWindow.getBounds();
  const headerHeight = Math.max(0, Math.floor(currentTopInset));
  
  browserView.setBounds({
    x: 0,
    y: headerHeight,
    width: Math.max(0, bounds.width - currentSidebarWidth), // Account for sidebar
    height: Math.max(0, bounds.height - headerHeight)
  });
}

// Environment check
const isDev = process.env.NODE_ENV === 'development';

// Settings store (persisted)
const settingsStore = new Store({
  name: 'settings',
  defaults: {
    appearance: {
      themeSource: 'system', // 'light' | 'dark' | 'system'
      accentColor: '#3b82f6', // default blue
      pageZoom: 1.0,
      fontSize: 'medium', // 'small' | 'medium' | 'large'
      showHomeButton: false,
      showBookmarksBar: false,
      showTabGroupsInBookmarksBar: false,
      alwaysShowFullURLs: false,
      autoPinNewTabGroups: true,
      showMemoryOnTabHover: false,
      highlightLinksOnTab: true,
      confirmBeforeQuit: true
    }
  }
});

async function createWindow() {
  // Create the main window
  mainWindow = new BrowserWindow({
    width: 1400,
    height: 900,
    title: 'InkFlow',
    webPreferences: {
      nodeIntegration: false,
      contextIsolation: true,
      enableRemoteModule: false,
      preload: path.join(__dirname, 'preload.js'),
      webSecurity: true
    },
    titleBarStyle: 'hiddenInset',
    show: true
  });

  // Load the React app
  try {
    if (isDev) {
      console.log('Loading development URL: http://localhost:3000');
      await mainWindow.loadURL('http://localhost:3000');
      // mainWindow.webContents.openDevTools(); // Commented out - open manually with Ctrl+Shift+I if needed
    } else {
      console.log('Loading production build');
      await mainWindow.loadFile(path.join(__dirname, 'frontend/build/index.html'));
    }
    console.log('Window loaded successfully');
  } catch (error) {
    console.error('Error loading window:', error);
    // Try to show the window anyway
    mainWindow.show();
    mainWindow.focus();
  }

  // Initialize LLM Autofill Engine
  try {
    autofillEngine = new AutofillEngine();
    await autofillEngine.initialize();
    console.log('LLM Autofill Engine initialized successfully');
  } catch (error) {
    console.error('Failed to initialize LLM Autofill Engine:', error);
  }

  // Initialize LLM Provider Manager
  try {
    llmProviderManager = new LLMProviderManager();
    
    // Register MiniCPM-V provider (set as default for testing)
    const minicpmProvider = new MiniCPMProvider();
    llmProviderManager.registerProvider('minicpm', minicpmProvider);
    
    // Register Llama provider
    const llamaProvider = new LlamaProvider();
    llmProviderManager.registerProvider('llama', llamaProvider);
    
    // Initialize all providers
    await llmProviderManager.initializeAllProviders();
    
    console.log('LLM Provider Manager initialized successfully');
  } catch (error) {
    console.error('Failed to initialize LLM Provider Manager:', error);
  }

  // Initialize LLM Form Analyzer (using provider manager)
  try {
    llmFormAnalyzer = new LLMFormAnalyzer(llmProviderManager);
    console.log('LLM Form Analyzer initialized successfully');
  } catch (error) {
    console.error('Failed to initialize LLM Form Analyzer:', error);
  }

  // Initialize Multi-Modal Form Detector
  try {
    formDetector = new FormDetector(llmFormAnalyzer);
    console.log('Multi-Modal Form Detector initialized successfully');
  } catch (error) {
    console.error('Failed to initialize Multi-Modal Form Detector:', error);
  }


  // Initialize PDF Processor
  try {
    pdfProcessor = new PDFProcessor();
    console.log('PDF Processor initialized successfully');
  } catch (error) {
    console.error('Failed to initialize PDF Processor:', error);
  }

  // Initialize PDF Finalizer
  try {
    pdfFinalizer = new PDFFinalizer();
    console.log('PDF Finalizer initialized successfully');
  } catch (error) {
    console.error('Failed to initialize PDF Finalizer:', error);
  }

  // Show window when ready and focus it
  mainWindow.once('ready-to-show', () => {
    console.log('Window ready to show');
    mainWindow.show();
    mainWindow.focus();
    mainWindow.moveTop();
  });

  // Also ensure window shows after loading
  mainWindow.webContents.once('dom-ready', () => {
    console.log('DOM ready, showing window');
    if (!mainWindow.isVisible()) {
      mainWindow.show();
      mainWindow.focus();
    }
  });

  // Reflect OS theme changes to renderer and BrowserView
  try {
    nativeTheme.removeAllListeners('updated');
    nativeTheme.on('updated', () => {
      try {
        if (mainWindow) {
          mainWindow.webContents.send('native-theme-updated', {
            themeSource: nativeTheme.themeSource,
            shouldUseDarkColors: nativeTheme.shouldUseDarkColors
          });
        }
        if (settingsStore.get('appearance.themeSource') === 'system' && browserView) {
          try { browserView.setBackgroundColor(nativeTheme.shouldUseDarkColors ? '#1e1e1e' : '#fafafa'); } catch {}
          if (currentContentType === 'pdf') {
            try { browserView.webContents.reload(); } catch {}
          }
        }
      } catch {}
    });
  } catch {}

  // Handle window closed
  mainWindow.on('closed', () => {
    if (browserView) {
      mainWindow.removeBrowserView(browserView);
      browserView = null;
    }
    mainWindow = null;
  });

  // Handle window resize - update BrowserView bounds
  mainWindow.on('resize', () => {
    updateBrowserViewBounds();
  });
}

// Create unified browser view for both web content and PDFs
function createUnifiedView(contentUrl, contentType = 'auto') {
  // Check if main window exists
  if (!mainWindow) {
    throw new Error('Main window not available');
  }

  // Remove existing browser view if any
  if (browserView) {
    try {
      mainWindow.removeBrowserView(browserView);
    } catch (error) {
      console.error('Error removing browser view:', error);
    }
    browserView = null;
  }

  // Create new unified browser view with enhanced PDF support
  browserView = new BrowserView({
    webPreferences: {
      nodeIntegration: false,
      contextIsolation: true,
      webSecurity: false, // Disable for bypassing restrictions
      allowRunningInsecureContent: true,
      experimentalFeatures: true,
      plugins: true, // Enable PDF plugin
      enableBlinkFeatures: 'PDFViewerUpdate', // Enable latest PDF features
      additionalArguments: [
        '--enable-pdf-tagging', // Better PDF accessibility
        '--enable-print-preview', // PDF print support
        '--disable-features=VizDisplayCompositor' // Better PDF rendering
      ]
    }
  });

  // Add to main window
  mainWindow.setBrowserView(browserView);
  
  // Position the browser view (full content area)
  updateBrowserViewBounds();

  // Enhanced header removal for both web and PDF content
  browserView.webContents.session.webRequest.onHeadersReceived((details, callback) => {
    // Remove headers that prevent embedding
    delete details.responseHeaders['x-frame-options'];
    delete details.responseHeaders['X-Frame-Options'];
    delete details.responseHeaders['content-security-policy'];
    delete details.responseHeaders['Content-Security-Policy'];
    
    // Enhanced PDF handling headers
    if (details.url.includes('.pdf') || contentType === 'pdf') {
      details.responseHeaders['content-type'] = ['application/pdf'];
      details.responseHeaders['content-disposition'] = ['inline'];
    }
    
    callback({ responseHeaders: details.responseHeaders });
  });

  // Load the content (URL or PDF file path)
  if (contentType === 'pdf' || contentUrl.endsWith('.pdf')) {
    // For PDF files, load directly - Chromium will use native PDF viewer
    console.log(`🚀 Loading PDF in unified Chromium viewer: ${contentUrl}`);
    browserView.webContents.loadFile(contentUrl);
    // Ensure background matches theme
    try { browserView.setBackgroundColor(nativeTheme.shouldUseDarkColors ? '#1e1e1e' : '#fafafa'); } catch {}
    currentContentType = 'pdf';
    currentContentUrl = contentUrl;
  } else {
    // For web URLs, load normally
    console.log(`🌐 Loading web content in unified Chromium viewer: ${contentUrl}`);
    browserView.webContents.loadURL(contentUrl);
    try { browserView.setBackgroundColor(nativeTheme.shouldUseDarkColors ? '#1e1e1e' : '#fafafa'); } catch {}
    currentContentType = 'web';
    currentContentUrl = contentUrl;
  }
  
  // Generate unique ID for this browser view
  currentBrowserViewId = Date.now().toString();
  
  // Enhanced event handling for both web and PDF content
  browserView.webContents.on('did-start-loading', () => {
    mainWindow.webContents.send('unified-content-loading', { 
      id: currentBrowserViewId, 
      loading: true,
      contentType: contentType
    });
  });

  browserView.webContents.on('did-finish-load', () => {
    const currentUrl = browserView.webContents.getURL();
    const isPdf = currentUrl.includes('.pdf') || contentType === 'pdf';
    currentContentType = isPdf ? 'pdf' : 'web';
    currentContentUrl = currentUrl;
    
    mainWindow.webContents.send('unified-content-loading', { 
      id: currentBrowserViewId, 
      loading: false,
      contentType: isPdf ? 'pdf' : 'web'
    });
    
    mainWindow.webContents.send('unified-content-loaded', { 
      id: currentBrowserViewId, 
      url: currentUrl,
      contentType: isPdf ? 'pdf' : 'web',
      title: browserView.webContents.getTitle(),
      bounds: browserView.getBounds() // Include BrowserView bounds for alignment
    });

    // If it's a PDF, enable form detection overlay with positioning info
    if (isPdf) {
      console.log('📝 PDF detected - enabling form overlay system');
      
      // Load PDF bytes and send to renderer
      (async () => {
        try {
          let pdfBytes = null;
          
          // If it's a local file, read the PDF bytes
          if (currentUrl.startsWith('file://')) {
            const filePath = currentUrl.replace('file://', '');
            const fs = require('fs').promises;
            const fileData = await fs.readFile(filePath);
            pdfBytes = Array.from(fileData); // Convert to array for JSON serialization
            console.log('📄 PDF bytes loaded for LLM processing:', pdfBytes.length, 'bytes');
          }
          
          const eventData = { 
            id: currentBrowserViewId,
            url: currentUrl,
            bounds: browserView.getBounds(), // BrowserView position and size
            scale: 1.0, // Default scale, can be updated later
            pdfBytes: pdfBytes // Include PDF bytes for LLM processing
          };
          
          console.log('📤 Sending pdf-detected event to renderer:', {
            id: eventData.id,
            url: eventData.url,
            hasPdfBytes: !!eventData.pdfBytes,
            pdfBytesLength: eventData.pdfBytes?.length
          });
          
          mainWindow.webContents.send('pdf-detected', eventData);
        } catch (error) {
          console.error('Error loading PDF bytes:', error);
          // Send without PDF bytes if loading fails
          mainWindow.webContents.send('pdf-detected', { 
            id: currentBrowserViewId,
            url: currentUrl,
            bounds: browserView.getBounds(),
            scale: 1.0
          });
        }
      })();
    }
  });

  browserView.webContents.on('did-fail-load', (event, errorCode, errorDescription) => {
    mainWindow.webContents.send('unified-content-error', { 
      id: currentBrowserViewId, 
      error: errorDescription,
      contentType: contentType
    });
  });

  // Handle navigation within the browser view
  browserView.webContents.on('will-navigate', (event, url) => {
    const isPdf = url.includes('.pdf');
    mainWindow.webContents.send('unified-content-navigate', {
      id: currentBrowserViewId,
      url: url,
      contentType: isPdf ? 'pdf' : 'web'
    });
  });

  return currentBrowserViewId;
}
// Associate current BrowserView content with a logical tab id
ipcMain.handle('set-active-tab', async (event, tabId) => {
  try {
    activeTabId = tabId;
    return { success: true };
  } catch (error) {
    return { success: false, error: error.message };
  }
});

// Hide browser view (for PDF mode)
function hideBrowserView() {
  if (browserView && mainWindow) {
    try {
      mainWindow.removeBrowserView(browserView);
    } catch (error) {
      console.error('Error hiding browser view:', error);
    }
  }
}

// Show browser view
function showBrowserView() {
  if (browserView && mainWindow) {
    try {
      mainWindow.setBrowserView(browserView);
      // Reposition
      const bounds = mainWindow.getBounds();
      browserView.setBounds({
        x: 0,
        y: Math.max(0, Math.floor(currentTopInset)),
        width: Math.max(0, bounds.width - currentSidebarWidth),
        height: Math.max(0, bounds.height - Math.floor(currentTopInset))
      });
    } catch (error) {
      console.error('Error showing browser view:', error);
    }
  }
}

// IPC Handlers
ipcMain.handle('navigate-url', async (event, url) => {
  try {
    const browserId = createUnifiedView(url, 'web');
    return { success: true, browserId, contentType: 'web' };
  } catch (error) {
    return { success: false, error: error.message };
  }
});

ipcMain.handle('load-pdf-file', async (event, filePath) => {
  try {
    const browserId = createUnifiedView(filePath, 'pdf');
    return { success: true, browserId, contentType: 'pdf' };
  } catch (error) {
    return { success: false, error: error.message };
  }
});

ipcMain.handle('load-pdf-data', async (event, pdfData, fileName = 'document.pdf') => {
  try {
    // Save PDF data to temp file for Chromium to load
    const tempDir = require('os').tmpdir();
    const tempFilePath = require('path').join(tempDir, `inkflow_${Date.now()}_${fileName}`);
    
    // Convert array back to Buffer if needed
    const buffer = Buffer.isBuffer(pdfData) ? pdfData : Buffer.from(pdfData);
    require('fs').writeFileSync(tempFilePath, buffer);
    
    const browserId = createUnifiedView(tempFilePath, 'pdf');
    return { success: true, browserId, contentType: 'pdf', tempFilePath };
  } catch (error) {
    return { success: false, error: error.message };
  }
});

ipcMain.handle('browser-back', async () => {
  if (browserView && browserView.webContents.canGoBack()) {
    browserView.webContents.goBack();
    return { success: true };
  }
  return { success: false };
});

ipcMain.handle('browser-forward', async () => {
  if (browserView && browserView.webContents.canGoForward()) {
    browserView.webContents.goForward();
    return { success: true };
  }
  return { success: false };
});

ipcMain.handle('browser-reload', async () => {
  if (browserView) {
    browserView.webContents.reload();
    return { success: true };
  }
  return { success: false };
});

ipcMain.handle('browser-stop', async () => {
  if (browserView) {
    browserView.webContents.stop();
    return { success: true };
  }
  return { success: false };
});

ipcMain.handle('hide-browser', async () => {
  hideBrowserView();
  return { success: true };
});

ipcMain.handle('show-browser', async () => {
  showBrowserView();
  return { success: true };
});

// File operations for PDF
ipcMain.handle('open-file-dialog', async () => {
  try {
    console.log('Opening file dialog...');
    const result = await dialog.showOpenDialog(mainWindow, {
      properties: ['openFile'],
      filters: [
        { name: 'PDF Files', extensions: ['pdf'] },
        { name: 'All Files', extensions: ['*'] }
      ]
    });
    
    console.log('File dialog result:', { canceled: result.canceled, filePaths: result.filePaths });
    
    if (!result.canceled && result.filePaths.length > 0) {
      const filePath = result.filePaths[0];
      console.log('Reading file:', filePath);
      
      const fileData = await fs.readFile(filePath);
      console.log('File read successfully, size:', fileData.length, 'bytes');
      
      return {
        success: true,
        filePath,
        fileName: path.basename(filePath),
        data: Array.from(fileData) // Convert to array for JSON serialization
      };
    }
    
    console.log('File dialog was canceled or no files selected');
    return { success: false };
  } catch (error) {
    console.error('Error in open-file-dialog:', error);
    return { 
      success: false, 
      error: error.message 
    };
  }
});

ipcMain.handle('save-file-dialog', async (event, data, defaultName) => {
  try {
    console.log('save-file-dialog called with:', {
      dataType: typeof data,
      dataLength: data?.length,
      isArray: Array.isArray(data),
      defaultName
    });

    const result = await dialog.showSaveDialog(mainWindow, {
      defaultPath: defaultName,
      filters: [
        { name: 'PDF Files', extensions: ['pdf'] },
        { name: 'All Files', extensions: ['*'] }
      ]
    });
    
    console.log('Dialog result:', { canceled: result.canceled, filePath: result.filePath });
    
    if (!result.canceled) {
      const buffer = Buffer.from(data);
      console.log('Buffer created:', { bufferLength: buffer.length });
      
      await fs.writeFile(result.filePath, buffer);
      console.log('File written successfully to:', result.filePath);
      
      return { success: true, filePath: result.filePath };
    }
    
    return { success: false, message: 'User canceled save dialog' };
  } catch (error) {
    console.error('Error in save-file-dialog:', error);
    return { success: false, error: error.message };
  }
});

// AI API call - Llama only
ipcMain.handle('ask-ai', async (event, prompt, provider = 'llama', apiKey = null) => {
  try {
    // Only support Llama for local processing
    return await callLlamaLocal(prompt);
  } catch (error) {
    return {
      success: false,
      error: error.message
    };
  }
});


// Local Llama implementation via Ollama
async function callLlamaLocal(prompt) {
  try {
    // First ensure Ollama service is running
    const serviceResult = await startOllamaService();
    if (!serviceResult.success) {
      return {
        success: false,
        error: `Failed to start Ollama service: ${serviceResult.error || 'Unknown error'}. Please ensure Ollama is installed and try again.`
      };
    }

    // Check if we have a model available
    const modelCheck = await checkLlamaModelInOllama();
    if (!modelCheck.available) {
      return {
        success: false,
        error: 'No Llama model is available. Please download a model first using the "Download Model" button in settings.'
      };
    }

    const modelName = modelCheck.modelName || 'llama3.2:3b';
    
    // Make inference request to Ollama API
    const fetch = (await import('node-fetch')).default;
    
    // Try both IPv4 and IPv6 addresses
    const urls = [
      'http://127.0.0.1:11434/api/generate',
      'http://localhost:11434/api/generate'
    ];
    
    let response;
    let lastError;
    
    for (const url of urls) {
      try {
        console.log(`Making inference request to: ${url}`);
        response = await fetch(url, {
          method: 'POST',
          headers: {
            'Content-Type': 'application/json',
          },
          body: JSON.stringify({
            model: modelName,
            prompt: `You are a helpful assistant embedded in a PDF and browser application. You can help with document analysis, web browsing, and general questions.\n\nUser: ${prompt}`,
            stream: false,
            options: {
              temperature: 0.2,
              top_p: 0.9,
              max_tokens: 1000
            }
          }),
        });
        break; // Success, exit the loop
      } catch (error) {
        console.log(`Failed to connect to ${url}: ${error.message}`);
        lastError = error;
        continue; // Try next URL
      }
    }
    
    if (!response) {
      throw lastError || new Error('Failed to connect to Ollama service on any address');
    }

    if (!response.ok) {
      if (response.status === 404) {
        throw new Error(`Model "${modelName}" not found. Please download the model first.`);
      } else if (response.status === 500) {
        throw new Error('Ollama service error. Please restart the Ollama service.');
      } else {
        throw new Error(`Ollama API error: ${response.status} - ${response.statusText}`);
      }
    }

    const data = await response.json();
    
    if (data.response) {
      return {
        success: true,
        content: data.response
      };
    } else {
      throw new Error('No response from Ollama API');
    }
  } catch (error) {
    console.error('Llama inference error:', error);
    
    // Provide more helpful error messages
    let errorMessage = error.message;
    if (error.code === 'ECONNREFUSED') {
      errorMessage = 'Cannot connect to Ollama service. Please ensure Ollama is running and try again.';
    } else if (error.message.includes('fetch')) {
      errorMessage = 'Network error connecting to Ollama. Please check if Ollama is running on localhost:11434.';
    }
    
    return {
      success: false,
      error: `Local Llama inference failed: ${errorMessage}`
    };
  }
}

// Helper function to start Ollama service
async function startOllamaService() {
  const { spawn } = require('child_process');
  const os = require('os');
  
  return new Promise(async (resolve) => {
    console.log('Starting Ollama service...');
    
    // Check if Ollama is already running by trying to connect to the API
    const fetch = (await import('node-fetch')).default;
    fetch('http://127.0.0.1:11434/api/tags', { 
      method: 'GET',
      timeout: 2000 
    })
    .then(() => {
      console.log('Ollama service is already running');
      resolve({
        success: true,
        message: 'Ollama service is already running'
      });
    })
    .catch(() => {
      console.log('Ollama service not running, starting it...');
      
      // First check if Ollama is installed
      const checkOllama = spawn('ollama', ['--version'], { stdio: 'pipe' });
      
      checkOllama.on('close', (code) => {
        if (code !== 0) {
          console.error('Ollama is not installed or not accessible');
          resolve({
            success: false,
            error: 'Ollama is not installed or not accessible. Please install Ollama from https://ollama.ai'
          });
          return;
        }
        
        console.log('Ollama is installed, starting service...');
        
        // Start Ollama service
        console.log('Spawning ollama serve process...');
        const ollamaProcess = spawn('ollama', ['serve'], {
          stdio: 'pipe',
          detached: true
        });
        
        ollamaProcess.stdout.on('data', (data) => {
          console.log('Ollama stdout:', data.toString());
        });
        
        ollamaProcess.stderr.on('data', (data) => {
          console.log('Ollama stderr:', data.toString());
        });
        
        ollamaProcess.on('error', (error) => {
          console.error('Failed to start Ollama process:', error);
          resolve({
            success: false,
            error: `Failed to start Ollama: ${error.message}. Please ensure Ollama is installed and accessible.`
          });
        });
        
        ollamaProcess.on('close', (code) => {
          console.log(`Ollama process closed with code: ${code}`);
        });
        
        // Wait for service to start and verify it's working
        let attempts = 0;
        const maxAttempts = 10;
        
        const checkService = async () => {
          attempts++;
          console.log(`Checking Ollama service (attempt ${attempts}/${maxAttempts})...`);
          
          const fetch = (await import('node-fetch')).default;
          fetch('http://127.0.0.1:11434/api/tags', { 
            method: 'GET',
            timeout: 1000 
          })
          .then(() => {
            console.log('Ollama service is now running');
            resolve({
              success: true,
              message: 'Ollama service started successfully'
            });
          })
          .catch(() => {
            if (attempts < maxAttempts) {
              setTimeout(checkService, 1000);
            } else {
              console.error('Ollama service failed to start after maximum attempts');
              resolve({
                success: false,
                error: 'Ollama service failed to start. Please check if Ollama is installed correctly.'
              });
            }
          });
        };
        
        // Start checking after a brief delay
        setTimeout(checkService, 2000);
      });
      
      checkOllama.on('error', (error) => {
        console.error('Error checking Ollama installation:', error);
        resolve({
          success: false,
          error: `Error checking Ollama installation: ${error.message}`
        });
      });
    });
  });
}

// Llama model download functionality via Ollama
ipcMain.handle('download-llama-model', async (event, modelName = 'llama3.2:3b') => {
  try {
    // First verify Ollama is installed
    const ollamaInstalled = await checkOllamaInstallation();
    if (!ollamaInstalled.available) {
      return {
        success: false,
        error: 'Ollama is not installed. Please install Ollama first from https://ollama.ai'
      };
    }

    // Start the download process via Ollama
    return await downloadModelViaOllama(event, modelName);
  } catch (error) {
    return {
      success: false,
      error: error.message
    };
  }
});

// Download Llama model via Ollama with real progress tracking
async function downloadModelViaOllama(event, modelName) {
  const { spawn } = require('child_process');
  
  return new Promise((resolve) => {
    console.log(`Starting download of ${modelName} via Ollama...`);
    
    // Use Ollama to pull the model
    const ollama = spawn('ollama', ['pull', modelName], {
      stdio: 'pipe'
    });

    let hasStarted = false;
    let isComplete = false;

    ollama.stdout.on('data', (data) => {
      const output = data.toString();
      console.log('Ollama stdout:', output);
      
      if (!hasStarted) {
        hasStarted = true;
        event.sender.send('llama-download-progress', 0);
      }
      
      // Parse Ollama progress output
      // Ollama outputs progress in formats like:
      // "pulling manifest"
      // "downloading 12% ▕████████░░░░░░░░░░░░░░░░░░░░░░░░░░░░░░░░░░░░░░░░░░░░░░░░░░░░░░░░░░░░░░░░░░░░░░░▏ 123 MB/1.0 GB"
      
      const progressMatch = output.match(/downloading\s+(\d+)%/);
      if (progressMatch) {
        const progress = parseInt(progressMatch[1]);
        event.sender.send('llama-download-progress', progress);
      }
      
      // Check for completion
      if (output.includes('success') || output.includes('model downloaded')) {
        if (!isComplete) {
          isComplete = true;
          event.sender.send('llama-download-progress', 100);
          event.sender.send('llama-download-complete');
        }
      }
    });

    ollama.stderr.on('data', (data) => {
      const output = data.toString();
      console.log('Ollama stderr:', output);
      
      // Ollama sometimes outputs progress info to stderr
      const progressMatch = output.match(/downloading\s+(\d+)%/);
      if (progressMatch) {
        const progress = parseInt(progressMatch[1]);
        event.sender.send('llama-download-progress', progress);
      }
    });

    ollama.on('close', (code) => {
      console.log(`Ollama download process exited with code ${code}`);
      
      if (code === 0) {
        if (!isComplete) {
          event.sender.send('llama-download-progress', 100);
          event.sender.send('llama-download-complete');
        }
        resolve({
          success: true,
          message: `${modelName} downloaded successfully`
        });
      } else {
        resolve({
          success: false,
          error: `Download failed with exit code ${code}. Please check if Ollama is running and accessible.`
        });
      }
    });

    ollama.on('error', (error) => {
      console.error('Ollama download error:', error);
      resolve({
        success: false,
        error: `Failed to start download: ${error.message}`
      });
    });

    // Send initial progress
    setTimeout(() => {
      if (!hasStarted) {
        event.sender.send('llama-download-progress', 5);
      }
    }, 1000);
  });
}

// Check if Llama model is available
ipcMain.handle('check-llama-model', async (event) => {
  try {
    // Check for Ollama installation first
    const ollamaInstalled = await checkOllamaInstallation();
    if (!ollamaInstalled.available) {
      return {
        success: true,
        available: false,
        path: null,
        reason: 'ollama_not_installed',
        message: 'Ollama is not installed. Please install Ollama first.'
      };
    }

    // Check if Llama 3.2 model is available through Ollama
    const modelAvailable = await checkLlamaModelInOllama();
    
    return {
      success: true,
      available: modelAvailable.available,
      path: modelAvailable.path,
      reason: modelAvailable.available ? 'model_ready' : 'model_not_downloaded',
      message: modelAvailable.message,
      ollamaPath: ollamaInstalled.path
    };
  } catch (error) {
    console.error('Error checking Llama model:', error);
    return {
      success: false,
      error: error.message,
      reason: 'check_failed'
    };
  }
});

// Check if Ollama is installed on the system
async function checkOllamaInstallation() {
  const { spawn } = require('child_process');
  const os = require('os');
  
  return new Promise((resolve) => {
    // On macOS, we might need to handle security permissions
    const platform = os.platform();
    if (platform === 'darwin') {
      // Check if we need to request permission for command execution
      console.log('Checking Ollama installation on macOS...');
    }
    
    // Try to run ollama command to check if it's installed
    const ollama = spawn('ollama', ['--version'], {
      stdio: 'pipe'
    });

    let output = '';
    let errorOutput = '';

    ollama.stdout.on('data', (data) => {
      output += data.toString();
    });

    ollama.stderr.on('data', (data) => {
      errorOutput += data.toString();
    });

    ollama.on('close', (code) => {
      if (code === 0 && output.includes('ollama')) {
        // Ollama is installed and working
        resolve({
          available: true,
          path: 'ollama', // Available in PATH
          version: output.trim(),
          message: 'Ollama is installed and ready'
        });
      } else {
        // Try to find Ollama in common installation paths
        const platform = os.platform();
        let possiblePaths = [];
        
        if (platform === 'darwin') {
          possiblePaths = [
            '/usr/local/bin/ollama',
            '/opt/homebrew/bin/ollama',
            '/Applications/Ollama.app/Contents/Resources/ollama'
          ];
        } else if (platform === 'win32') {
          possiblePaths = [
            'C:\\Program Files\\Ollama\\ollama.exe',
            'C:\\Users\\' + os.userInfo().username + '\\AppData\\Local\\Programs\\Ollama\\ollama.exe'
          ];
        } else {
          possiblePaths = [
            '/usr/bin/ollama',
            '/usr/local/bin/ollama',
            '/home/' + os.userInfo().username + '/.local/bin/ollama'
          ];
        }

        // Check if Ollama exists in any of these paths
        checkOllamaInPaths(possiblePaths).then((foundPath) => {
          if (foundPath) {
            resolve({
              available: true,
              path: foundPath,
              message: 'Ollama found at custom location'
            });
          } else {
            resolve({
              available: false,
              path: null,
              message: 'Ollama is not installed. Please install from https://ollama.ai'
            });
          }
        });
      }
    });

    ollama.on('error', (error) => {
      console.log('Ollama command error:', error.message);
      resolve({
        available: false,
        path: null,
        message: 'Ollama is not installed or not accessible'
      });
    });
  });
}

// Helper function to check Ollama in specific paths
async function checkOllamaInPaths(paths) {
  const fs = require('fs').promises;
  
  for (const path of paths) {
    try {
      await fs.access(path);
      return path;
    } catch (error) {
      // Path doesn't exist, continue checking
      continue;
    }
  }
  return null;
}

// Check if Llama 3.2 model is available in Ollama
async function checkLlamaModelInOllama() {
  const { spawn } = require('child_process');
  
  return new Promise((resolve) => {
    // List available models in Ollama
    const ollama = spawn('ollama', ['list'], {
      stdio: 'pipe'
    });

    let output = '';
    let errorOutput = '';

    ollama.stdout.on('data', (data) => {
      output += data.toString();
    });

    ollama.stderr.on('data', (data) => {
      errorOutput += data.toString();
    });

    ollama.on('close', (code) => {
      if (code === 0) {
        // Check if any Llama 3.2 model is available
        const availableModels = output.toLowerCase();
        const llamaModels = ['llama3.2:1b', 'llama3.2:3b', 'llama3.2', 'llama3.2:latest'];
        
        for (const model of llamaModels) {
          if (availableModels.includes(model)) {
            resolve({
              available: true,
              path: model,
              message: `Llama 3.2 model (${model}) is ready`,
              modelName: model
            });
            return;
          }
        }
        
        resolve({
          available: false,
          path: null,
          message: 'Llama 3.2 model not found. Download required.',
          availableModels: output
        });
      } else {
        resolve({
          available: false,
          path: null,
          message: 'Unable to check models. Ollama may not be running.',
          error: errorOutput
        });
      }
    });

    ollama.on('error', (error) => {
      resolve({
        available: false,
        path: null,
        message: 'Error checking Ollama models: ' + error.message
      });
    });
  });
}

// Gemini AI Integration for PDF analysis
ipcMain.handle('analyze-pdf-with-gemini', async (event, request) => {
  try {
    const fetch = (await import('node-fetch')).default;
    
    const apiKey = process.env.GEMINI_API_KEY;
    if (!apiKey) {
      throw new Error('GEMINI_API_KEY environment variable is not set');
    }

    const response = await fetch(`https://generativelanguage.googleapis.com/v1beta/models/gemini-1.5-flash-latest:generateContent?key=${apiKey}`, {
      method: 'POST',
      headers: {
        'Content-Type': 'application/json',
      },
      body: JSON.stringify({
        contents: [
          {
            parts: [
              {
                text: request.textContent
              }
            ]
          }
        ],
        generationConfig: {
          temperature: 0.3,
          topK: 40,
          topP: 0.95,
          maxOutputTokens: 2048,
        }
      })
    });

    if (!response.ok) {
      const errorText = await response.text();
      throw new Error(`Gemini API error: ${response.status} - ${errorText}`);
    }

    const data = await response.json();
    
    if (data.candidates && data.candidates.length > 0 && data.candidates[0].content) {
      return {
        success: true,
        content: data.candidates[0].content.parts[0].text
      };
    } else {
      throw new Error('No valid response from Gemini API');
    }
  } catch (error) {
    return {
      success: false,
      error: error.message
    };
  }
});

// Universal PDF analysis endpoint that uses the selected AI provider
ipcMain.handle('analyze-pdf', async (event, request) => {
  try {
    const { textContent, provider = 'gemini', apiKey = null } = request;
    
    // Use the general AI endpoint with the specified provider
    return await callAIProvider(textContent, provider, apiKey);
  } catch (error) {
    return {
      success: false,
      error: error.message
    };
  }
});

// Helper function to call the appropriate AI provider
async function callAIProvider(prompt, provider, apiKey) {
  // Only support Llama for local processing
  return await callLlamaLocal(prompt);
}

// Handle window resize to update browser view bounds
ipcMain.handle('window-resized', async () => {
  if (browserView) {
    const bounds = mainWindow.getBounds();
    browserView.setBounds({
      x: 0,
      y: Math.max(0, Math.floor(currentTopInset)),
      width: Math.max(0, bounds.width - currentSidebarWidth),
      height: Math.max(0, bounds.height - Math.floor(currentTopInset))
    });
  }
});

// Automatic Ollama installation
ipcMain.handle('install-ollama', async (event) => {
  const os = require('os');
  const platform = os.platform();
  
  try {
    console.log(`Installing Ollama for ${platform}...`);
    
    if (platform === 'darwin') {
      return await installOllamaMacOS(event);
    } else if (platform === 'win32') {
      return await installOllamaWindows(event);
    } else {
      return await installOllamaLinux(event);
    }
  } catch (error) {
    return {
      success: false,
      error: `Installation failed: ${error.message}`
    };
  }
});

// Install Ollama on macOS
async function installOllamaMacOS(event) {
  const { spawn } = require('child_process');
  const https = require('https');
  const fs = require('fs').promises;
  const path = require('path');
  
  return new Promise((resolve) => {
    // Download and install Ollama using the official installer
    const downloadUrl = 'https://ollama.ai/download/Ollama-darwin.zip';
    const tempDir = require('os').tmpdir();
    const zipPath = path.join(tempDir, 'Ollama-darwin.zip');
    const appPath = '/Applications/Ollama.app';
    
    event.sender.send('ollama-install-progress', { step: 'downloading', progress: 0 });
    
    // Check if already installed
    const checkProcess = spawn('which', ['ollama'], { stdio: 'pipe' });
    checkProcess.on('close', (code) => {
      if (code === 0) {
        resolve({
          success: true,
          message: 'Ollama is already installed',
          path: 'ollama'
        });
        return;
      }
      
      // Download the installer
      downloadFile(downloadUrl, zipPath, (progress) => {
        event.sender.send('ollama-install-progress', { 
          step: 'downloading', 
          progress: Math.round(progress * 50) 
        });
      }).then(async () => {
        event.sender.send('ollama-install-progress', { step: 'extracting', progress: 60 });
        
        // Extract and install
        try {
          // Use unzip command to extract
          const unzipProcess = spawn('unzip', ['-o', zipPath, '-d', '/Applications/'], {
            stdio: 'pipe'
          });
          
          unzipProcess.on('close', (code) => {
            if (code === 0) {
              // Clean up
              fs.unlink(zipPath).catch(() => {});
              
              event.sender.send('ollama-install-progress', { step: 'complete', progress: 100 });
              
              resolve({
                success: true,
                message: 'Ollama installed successfully',
                path: '/Applications/Ollama.app/Contents/Resources/ollama'
              });
            } else {
              resolve({
                success: false,
                error: 'Failed to extract Ollama installer'
              });
            }
          });
        } catch (error) {
          resolve({
            success: false,
            error: `Installation failed: ${error.message}`
          });
        }
      }).catch((error) => {
        resolve({
          success: false,
          error: `Download failed: ${error.message}`
        });
      });
    });
  });
}

// Install Ollama on Windows
async function installOllamaWindows(event) {
  const { spawn } = require('child_process');
  const https = require('https');
  const fs = require('fs').promises;
  const path = require('path');
  
  return new Promise((resolve) => {
    const downloadUrl = 'https://ollama.ai/download/OllamaSetup.exe';
    const tempDir = require('os').tmpdir();
    const installerPath = path.join(tempDir, 'OllamaSetup.exe');
    
    event.sender.send('ollama-install-progress', { step: 'downloading', progress: 0 });
    
    // Check if already installed
    const checkProcess = spawn('where', ['ollama'], { stdio: 'pipe' });
    checkProcess.on('close', (code) => {
      if (code === 0) {
        resolve({
          success: true,
          message: 'Ollama is already installed',
          path: 'ollama'
        });
        return;
      }
      
      // Download the installer
      downloadFile(downloadUrl, installerPath, (progress) => {
        event.sender.send('ollama-install-progress', { 
          step: 'downloading', 
          progress: Math.round(progress * 70) 
        });
      }).then(async () => {
        event.sender.send('ollama-install-progress', { step: 'installing', progress: 80 });
        
        // Run the installer silently
        const installProcess = spawn(installerPath, ['/S'], {
          stdio: 'pipe'
        });
        
        installProcess.on('close', (code) => {
          // Clean up
          fs.unlink(installerPath).catch(() => {});
          
          if (code === 0) {
            event.sender.send('ollama-install-progress', { step: 'complete', progress: 100 });
            resolve({
              success: true,
              message: 'Ollama installed successfully',
              path: 'C:\\Program Files\\Ollama\\ollama.exe'
            });
          } else {
            resolve({
              success: false,
              error: 'Ollama installation failed'
            });
          }
        });
      }).catch((error) => {
        resolve({
          success: false,
          error: `Download failed: ${error.message}`
        });
      });
    });
  });
}

// Install Ollama on Linux
async function installOllamaLinux(event) {
  const { spawn } = require('child_process');
  
  return new Promise((resolve) => {
    event.sender.send('ollama-install-progress', { step: 'installing', progress: 0 });
    
    // Check if already installed
    const checkProcess = spawn('which', ['ollama'], { stdio: 'pipe' });
    checkProcess.on('close', (code) => {
      if (code === 0) {
        resolve({
          success: true,
          message: 'Ollama is already installed',
          path: 'ollama'
        });
        return;
      }
      
      // Install using curl
      const installScript = spawn('curl', ['-fsSL', 'https://ollama.ai/install.sh'], {
        stdio: 'pipe'
      });
      
      let script = '';
      installScript.stdout.on('data', (data) => {
        script += data.toString();
      });
      
      installScript.on('close', (code) => {
        if (code === 0) {
          // Execute the installation script
          const executeProcess = spawn('sh', ['-c', script], {
            stdio: 'pipe'
          });
          
          executeProcess.on('close', (installCode) => {
            if (installCode === 0) {
              event.sender.send('ollama-install-progress', { step: 'complete', progress: 100 });
              resolve({
                success: true,
                message: 'Ollama installed successfully',
                path: '/usr/local/bin/ollama'
              });
            } else {
              resolve({
                success: false,
                error: 'Ollama installation failed'
              });
            }
          });
        } else {
          resolve({
            success: false,
            error: 'Failed to download Ollama installation script'
          });
        }
      });
    });
  });
}

// Helper function to download files with progress
function downloadFile(url, filePath, progressCallback) {
  const https = require('https');
  const fs = require('fs').promises;
  
  return new Promise((resolve, reject) => {
    const file = require('fs').createWriteStream(filePath);
    
    https.get(url, (response) => {
      const totalSize = parseInt(response.headers['content-length'], 10);
      let downloadedSize = 0;
      
      response.on('data', (chunk) => {
        downloadedSize += chunk.length;
        const progress = downloadedSize / totalSize;
        progressCallback(progress);
        file.write(chunk);
      });
      
      response.on('end', () => {
        file.end();
        resolve();
      });
      
      response.on('error', (error) => {
        file.close();
        reject(error);
      });
    }).on('error', (error) => {
      file.close();
      reject(error);
    });
  });
}

// Start Ollama service
ipcMain.handle('start-ollama-service', async () => {
  return await startOllamaService();
});

// Test Ollama service connection
ipcMain.handle('test-ollama-connection', async () => {
  const fetch = (await import('node-fetch')).default;
  
  // Try both IPv4 and IPv6 addresses
  const urls = [
    'http://127.0.0.1:11434/api/tags',
    'http://localhost:11434/api/tags'
  ];
  
  for (const url of urls) {
    try {
      console.log(`Testing Ollama connection at: ${url}`);
      const response = await fetch(url, { 
        method: 'GET',
        timeout: 3000 
      });
      
      if (response.ok) {
        const data = await response.json();
        console.log(`✅ Ollama service is running at: ${url}`);
        return {
          success: true,
          message: `Ollama service is running at ${url}`,
          models: data.models || []
        };
      }
    } catch (error) {
      console.log(`❌ Failed to connect to ${url}: ${error.message}`);
      // Continue to next URL
    }
  }
  
  return {
    success: false,
    error: 'Cannot connect to Ollama service on any address. Please ensure Ollama is running.'
  };
});

// Test Ollama installation
ipcMain.handle('test-ollama-installation', async () => {
  const { spawn } = require('child_process');
  
  return new Promise((resolve) => {
    console.log('Testing Ollama installation...');
    const checkOllama = spawn('ollama', ['--version'], { stdio: 'pipe' });
    
    let output = '';
    let errorOutput = '';
    
    checkOllama.stdout.on('data', (data) => {
      output += data.toString();
    });
    
    checkOllama.stderr.on('data', (data) => {
      errorOutput += data.toString();
    });
    
    checkOllama.on('close', (code) => {
      if (code === 0) {
        resolve({
          success: true,
          message: 'Ollama is installed and accessible',
          version: output.trim()
        });
      } else {
        resolve({
          success: false,
          error: `Ollama is not installed or not accessible. Exit code: ${code}`,
          stderr: errorOutput
        });
      }
    });
    
    checkOllama.on('error', (error) => {
      resolve({
        success: false,
        error: `Error checking Ollama installation: ${error.message}`
      });
    });
  });
});

// Request macOS permissions for Ollama access
ipcMain.handle('request-macos-permissions', async () => {
  const os = require('os');
  
  if (os.platform() !== 'darwin') {
    return {
      success: true,
      message: 'Not running on macOS, no permissions needed'
    };
  }

  try {
    // On macOS, we may need to request permissions for:
    // 1. Terminal/shell access for running ollama commands
    // 2. File system access for model storage
    
    // Check if we have permission to execute commands
    const { spawn } = require('child_process');
    
    return new Promise((resolve) => {
      // Test command execution
      const testProcess = spawn('which', ['ollama'], { stdio: 'pipe' });
      
      testProcess.on('close', (code) => {
        if (code === 0) {
          resolve({
            success: true,
            message: 'Terminal access available',
            hasTerminalAccess: true
          });
        } else {
          resolve({
            success: false,
            message: 'Terminal access may be restricted. Please check macOS Security & Privacy settings.',
            hasTerminalAccess: false,
            suggestion: 'Go to System Preferences > Security & Privacy > Privacy > Developer Tools and add this app'
          });
        }
      });
      
      testProcess.on('error', (error) => {
        resolve({
          success: false,
          message: `Permission check failed: ${error.message}`,
          hasTerminalAccess: false
        });
      });
    });
    
  } catch (error) {
    return {
      success: false,
      message: `Error checking permissions: ${error.message}`
    };
  }
});

// PDF Processor IPC Handlers
ipcMain.handle('pdf-processor-analyze', async (event, pdfBuffer, options = {}) => {
  try {
    if (!pdfProcessor) {
      return { success: false, error: 'PDF Processor not initialized' };
    }

    const result = await pdfProcessor.processPDF(pdfBuffer, options);
    return result;
  } catch (error) {
    console.error('Error processing PDF with OCR + AI:', error);
    return { success: false, error: error.message };
  }
});

ipcMain.handle('pdf-processor-check-availability', async (event) => {
  try {
    const availability = await PDFProcessor.checkAvailability();
    return { success: true, data: availability };
  } catch (error) {
    console.error('Error checking PDF processor availability:', error);
    return { success: false, error: error.message };
  }
});

// PDF Finalizer IPC Handlers
ipcMain.handle('pdf-finalizer-finalize', async (event, originalPdfBuffer, formData, options = {}) => {
  try {
    if (!pdfFinalizer) {
      return { success: false, error: 'PDF Finalizer not initialized' };
    }

    // Convert array back to Buffer if needed (for IPC compatibility)
    const pdfBuffer = Array.isArray(originalPdfBuffer) 
      ? Buffer.from(originalPdfBuffer) 
      : originalPdfBuffer;

    const finalizedPdfBytes = await pdfFinalizer.finalizePDF(pdfBuffer, formData, options);
    return { success: true, data: Array.from(finalizedPdfBytes) };
  } catch (error) {
    console.error('Error finalizing PDF:', error);
    return { success: false, error: error.message };
  }
});

ipcMain.handle('pdf-finalizer-validate-form-data', async (event, formData) => {
  try {
    if (!pdfFinalizer) {
      return { success: false, error: 'PDF Finalizer not initialized' };
    }

    const validation = pdfFinalizer.validateFormData(formData);
    return { success: true, data: validation };
  } catch (error) {
    console.error('Error validating form data:', error);
    return { success: false, error: error.message };
  }
});

// Debug logging IPC handler
ipcMain.handle('debug-log', async (event, message) => {
  console.log('🔍 [RENDERER DEBUG]:', message);
});

// LLM Form Analyzer IPC Handler

// Multi-Modal Form Detection (NEW - Primary method)
ipcMain.handle('analyze-pdf-multimodal', async (event, request) => {
  try {
    console.log('🚀 Multi-Modal Analysis Request Received:', {
      hasFormDetector: !!formDetector,
      requestKeys: Object.keys(request),
      pdfBytesLength: request.pdfBytes?.length,
      method: 'multi_modal_detection'
    });
    
    if (!formDetector) {
      return { success: false, error: 'Multi-Modal Form Detector not initialized' };
    }

    const { pdfBytes, options = {} } = request;
    
    if (!pdfBytes || pdfBytes.length === 0) {
      return { success: false, error: 'Invalid PDF bytes provided' };
    }

    console.log('Starting multi-modal form detection...');
    const startTime = Date.now();
    
    // Convert array to Uint8Array if needed
    const pdfBytesArray = new Uint8Array(pdfBytes);
    
    // Multi-modal detection with automatic fallback chain
    const analysisResult = await formDetector.detectFormFields(pdfBytesArray, options);
    
    const processingTime = Date.now() - startTime;
    console.log(`🚀 Multi-modal detection completed in ${processingTime}ms using method: ${analysisResult.method}`);
    
    return analysisResult;
    
  } catch (error) {
    console.error('Error in multi-modal analysis:', error);
    return { 
      success: false, 
      error: error.message,
      method: 'multi_modal_error',
      fallbackData: null
    };
  }
});

// Clear form detection cache (for testing loading spinner)
ipcMain.handle('clear-form-cache', async (event) => {
  try {
    if (!formDetector) {
      return { success: false, error: 'Form detector not initialized' };
    }

    formDetector.clearCache();
    console.log('🗑️ Form detection cache cleared');
    return { success: true };
  } catch (error) {
    console.error('❌ Failed to clear form cache:', error);
    return { success: false, error: error.message };
  }
});

// Legacy dual-pass analysis (kept for backward compatibility)
ipcMain.handle('analyze-pdf-with-llm', async (event, request) => {
  try {
    console.log('🔍 LLM Form Analysis Request Received (legacy dual-pass):', {
      hasAnalyzer: !!llmFormAnalyzer,
      requestKeys: Object.keys(request),
      pdfTextLength: request.pdfText?.length
    });
    
    if (!llmFormAnalyzer) {
      return { success: false, error: 'LLM Form Analyzer not initialized' };
    }

    const { pdfText, options = {} } = request;
    
    if (!pdfText || typeof pdfText !== 'string') {
      return { success: false, error: 'Invalid PDF text provided' };
    }

    console.log('Starting LLM form analysis (legacy dual-pass)...');
    const startTime = Date.now();
    
    const analysisResult = await llmFormAnalyzer.analyzePDFForForms(pdfText, options);
    
    const processingTime = Date.now() - startTime;
    console.log(`LLM form analysis completed in ${processingTime}ms`);
    
    return analysisResult;
    
  } catch (error) {
    console.error('Error in LLM form analysis:', error);
    return { 
      success: false, 
      error: error.message,
      fallbackData: llmFormAnalyzer ? llmFormAnalyzer.generateFallbackTodos(request.pdfText || '') : null
    };
  }
});

// LLM Provider Management IPC Handlers

// Get available LLM providers
ipcMain.handle('get-llm-providers', async (event) => {
  try {
    if (!llmProviderManager) {
      return { success: false, error: 'LLM Provider Manager not initialized' };
    }

    const providers = await llmProviderManager.getAvailableProviders();
    const activeProviderId = llmProviderManager.getActiveProviderId();
    const performanceComparison = llmProviderManager.getPerformanceComparison();

    return {
      success: true,
      providers,
      activeProviderId,
      performanceComparison
    };
  } catch (error) {
    console.error('Failed to get LLM providers:', error);
    return { success: false, error: error.message };
  }
});

// Switch LLM provider
ipcMain.handle('switch-llm-provider', async (event, providerId) => {
  try {
    if (!llmProviderManager) {
      return { success: false, error: 'LLM Provider Manager not initialized' };
    }

    console.log(`🔄 Switching to LLM provider: ${providerId}`);
    const success = await llmProviderManager.switchProvider(providerId);

    if (success) {
      // Update form analyzer to use new provider
      if (llmFormAnalyzer) {
        llmFormAnalyzer.setProviderManager(llmProviderManager);
      }

      const activeProvider = llmProviderManager.getActiveProvider();
      console.log(`✅ Successfully switched to provider: ${providerId}`);
      
      return {
        success: true,
        activeProviderId: providerId,
        providerInfo: activeProvider ? activeProvider.getModelInfo() : null
      };
    } else {
      return { success: false, error: `Failed to switch to provider: ${providerId}` };
    }
  } catch (error) {
    console.error('Failed to switch LLM provider:', error);
    return { success: false, error: error.message };
  }
});

// Get LLM provider performance stats
ipcMain.handle('get-llm-performance', async (event) => {
  try {
    if (!llmProviderManager) {
      return { success: false, error: 'LLM Provider Manager not initialized' };
    }

    const performanceComparison = llmProviderManager.getPerformanceComparison();
    const fastestProvider = llmProviderManager.getFastestProvider();

    return {
      success: true,
      performanceComparison,
      fastestProvider
    };
  } catch (error) {
    console.error('Failed to get LLM performance:', error);
    return { success: false, error: error.message };
  }
});

// Auto-select best performing provider
ipcMain.handle('auto-select-best-provider', async (event) => {
  try {
    if (!llmProviderManager) {
      return { success: false, error: 'LLM Provider Manager not initialized' };
    }

    const switched = await llmProviderManager.autoSelectBestProvider();
    const activeProviderId = llmProviderManager.getActiveProviderId();

    return {
      success: true,
      switched,
      activeProviderId
    };
  } catch (error) {
    console.error('Failed to auto-select best provider:', error);
    return { success: false, error: error.message };
  }
});

ipcMain.handle('update-llm-todo-status', async (event, request) => {
  try {
    if (!llmFormAnalyzer) {
      return { success: false, error: 'LLM Form Analyzer not available' };
    }

    const { todoId, status, todoList } = request;
    
    if (!todoId || !status || !todoList) {
      return { success: false, error: 'Missing required parameters' };
    }

    const result = await llmFormAnalyzer.updateTodoStatus(todoId, status, todoList);
    
    return result;
    
  } catch (error) {
    console.error('Error updating todo status:', error);
    return { success: false, error: error.message };
  }
});

ipcMain.handle('extract-pdf-text', async (event, pdfBytes) => {
  try {
    console.log('📄 PDF Text Extraction Request:', {
      hasPdfBytes: !!pdfBytes,
      pdfBytesLength: pdfBytes?.length,
      pdfBytesType: typeof pdfBytes
    });
    
    // Use PDF.js for Node.js environment (dynamic import for ES module)
    const pdfjs = await import('pdfjs-dist');
    
    const pdf = await pdfjs.getDocument({ data: pdfBytes }).promise;
    let fullText = '';
    
    for (let pageNum = 1; pageNum <= pdf.numPages; pageNum++) {
      const page = await pdf.getPage(pageNum);
      const textContent = await page.getTextContent();
      
      const pageText = textContent.items
        .map(item => item.str)
        .join(' ');
      
      fullText += `\n\n--- Page ${pageNum} ---\n${pageText}`;
    }
    
    return { success: true, text: fullText.trim() };
    
  } catch (error) {
    console.error('Error extracting PDF text:', error);
    return { success: false, error: error.message };
  }
});

// LLM Autofill IPC Handlers
ipcMain.handle('llm-autofill-get-suggestion', async (event, fieldContext) => {
  try {
    if (!autofillEngine) {
      return { success: false, error: 'Autofill engine not initialized' };
    }

    const result = await autofillEngine.generateSuggestion(fieldContext);
    return result;
  } catch (error) {
    console.error('Error getting LLM autofill suggestion:', error);
    return { success: false, error: error.message };
  }
});

ipcMain.handle('llm-autofill-generate-question', async (event, fieldContext) => {
  try {
    if (!autofillEngine) {
      return { success: false, error: 'Autofill engine not initialized' };
    }

    const result = await autofillEngine.generateQuestion(fieldContext);
    return result;
  } catch (error) {
    console.error('Error generating LLM autofill question:', error);
    return { success: false, error: error.message };
  }
});

ipcMain.handle('llm-autofill-validate-input', async (event, input, fieldType) => {
  try {
    if (!autofillEngine) {
      return { success: false, error: 'Autofill engine not initialized' };
    }

    const result = await autofillEngine.validateInput(input, fieldType);
    return result;
  } catch (error) {
    console.error('Error validating LLM autofill input:', error);
    return { success: false, error: error.message };
  }
});

ipcMain.handle('llm-autofill-process-input', async (event, input, fieldType) => {
  try {
    if (!autofillEngine) {
      return { success: false, error: 'Autofill engine not initialized' };
    }

    const result = await autofillEngine.processUserInput(input, fieldType);
    return result;
  } catch (error) {
    console.error('Error processing LLM autofill input:', error);
    return { success: false, error: error.message };
  }
});

ipcMain.handle('llm-autofill-get-profile', async (event) => {
  try {
    if (!autofillEngine) {
      return { success: false, error: 'Autofill engine not initialized' };
    }

    const result = await autofillEngine.getProfile();
    return result;
  } catch (error) {
    console.error('Error getting LLM autofill profile:', error);
    return { success: false, error: error.message };
  }
});

ipcMain.handle('llm-autofill-update-profile', async (event, field, value) => {
  try {
    if (!autofillEngine) {
      return { success: false, error: 'Autofill engine not initialized' };
    }

    const result = await autofillEngine.updateProfile(field, value);
    return result;
  } catch (error) {
    console.error('Error updating LLM autofill profile:', error);
    return { success: false, error: error.message };
  }
});

ipcMain.handle('llm-autofill-get-performance', async (event) => {
  try {
    if (!autofillEngine) {
      return { success: false, error: 'Autofill engine not initialized' };
    }

    const result = autofillEngine.getPerformanceMetrics();
    return { success: true, data: result };
  } catch (error) {
    console.error('Error getting LLM autofill performance:', error);
    return { success: false, error: error.message };
  }
});

ipcMain.handle('llm-autofill-check-status', async (event) => {
  try {
    if (!autofillEngine) {
      return { success: false, error: 'Autofill engine not initialized' };
    }

    const isInitialized = autofillEngine.isInitialized;
    const isReady = autofillEngine.llmService?.isReady() || false;
    const currentModel = autofillEngine.currentModel;
    
    return { 
      success: true, 
      data: { 
        isInitialized, 
        isReady, 
        currentModel 
      } 
    };
  } catch (error) {
    console.error('Error checking LLM autofill status:', error);
    return { success: false, error: error.message };
  }
});

// App event handlers
app.whenReady().then(createWindow);

app.on('window-all-closed', () => {
  if (process.platform !== 'darwin') {
    app.quit();
  }
});

app.on('activate', () => {
  if (BrowserWindow.getAllWindows().length === 0) {
    createWindow();
  }
});

// Security: Prevent new window creation
app.on('web-contents-created', (event, contents) => {
  contents.on('new-window', (event, navigationUrl) => {
    event.preventDefault();
    // Open in current browser view instead
    if (browserView) {
      browserView.webContents.loadURL(navigationUrl);
    }
  });
});

// IPC Handlers

// Handle sidebar resize - update BrowserView bounds
ipcMain.handle('sidebar-resized', async (event, sidebarWidth) => {
  try {
    currentSidebarWidth = sidebarWidth;
    updateBrowserViewBounds();
    return { success: true };
  } catch (error) {
    console.error('Error handling sidebar resize:', error);
    return { success: false, error: error.message };
  }
});

// Receive layout metrics (top inset and sidebar width) from renderer for pixel-perfect alignment
ipcMain.handle('update-layout', async (event, layout) => {
  try {
    if (typeof layout?.topInset === 'number') {
      currentTopInset = layout.topInset;
    }
    if (typeof layout?.sidebarWidth === 'number') {
      currentSidebarWidth = layout.sidebarWidth;
    }
    updateBrowserViewBounds();
    return { success: true };
  } catch (error) {
    console.error('Error updating layout metrics:', error);
    return { success: false, error: error.message };
  }
});

// Settings IPC
ipcMain.handle('get-settings', async () => {
  try {
    return { success: true, data: settingsStore.store };
  } catch (error) {
    return { success: false, error: error.message };
  }
});

ipcMain.handle('update-settings', async (event, partial) => {
  try {
    const merged = { ...settingsStore.store, ...partial };
    settingsStore.store = merged;
    // Apply appearance changes immediately
    const appearance = merged.appearance || {};
    if (appearance.themeSource) {
      nativeTheme.themeSource = appearance.themeSource;
      if (browserView && typeof browserView.setBackgroundColor === 'function') {
        browserView.setBackgroundColor(nativeTheme.shouldUseDarkColors ? '#1e1e1e' : '#fafafa');
      }
      if (currentContentType === 'pdf') {
        try { browserView.webContents.reload(); } catch {}
      }
    }
    return { success: true, data: merged };
  } catch (error) {
    return { success: false, error: error.message };
  }
});

// Allow renderer to control Chromium's theme (affects built-in PDF viewer)
ipcMain.handle('set-theme', async (event, theme) => {
  try {
    if (['light', 'dark', 'system'].includes(theme)) {
      nativeTheme.themeSource = theme;
      // Persist appearance setting
      try {
        const current = settingsStore.get('appearance');
        settingsStore.set('appearance', { ...current, themeSource: theme });
      } catch {}
      if (browserView) {
        try {
          const targetBg = nativeTheme.shouldUseDarkColors ? '#1e1e1e' : '#fafafa';
          const hasBVMethod = typeof browserView.setBackgroundColor === 'function';
          const hasWCColorScheme = typeof browserView.webContents.setColorScheme === 'function';
          const hasWCCSS = typeof browserView.webContents.insertCSS === 'function';
          console.log('Theme toggle capabilities:', { hasBVMethod, hasWCColorScheme, hasWCCSS, targetBg });
          if (hasBVMethod) {
            browserView.setBackgroundColor(targetBg);
          }
          if (hasWCColorScheme) {
            browserView.webContents.setColorScheme(nativeTheme.shouldUseDarkColors ? 'dark' : 'light');
          }
          if (hasWCCSS) {
            const css = nativeTheme.shouldUseDarkColors
              ? ':root{color-scheme:dark;background:#1e1e1e !important;} body{background:#1e1e1e !important;}'
              : ':root{color-scheme:light;background:#fafafa !important;} body{background:#fafafa !important;}';
            try { await browserView.webContents.insertCSS(css); } catch {}
          }
        } catch (err) {
          console.log('Fallback theme application failed:', err?.message);
        }
        // For Chromium's built-in PDF viewer, apply theme change by reloading
        if (currentContentType === 'pdf') {
          try {
            browserView.webContents.reload();
          } catch {}
        }
      }
      return { success: true };
    }
    return { success: false, error: 'Invalid theme' };
  } catch (error) {
    console.error('Error setting theme:', error);
    return { success: false, error: error.message };
  }
});

// Get theme info (for Device/system theme and diagnostics)
ipcMain.handle('get-theme-info', async () => {
  try {
    return {
      success: true,
      data: {
        themeSource: nativeTheme.themeSource,
        shouldUseDarkColors: nativeTheme.shouldUseDarkColors
      }
    };
  } catch (error) {
    return { success: false, error: error.message };
  }
});
