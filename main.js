const { app, BrowserWindow, BrowserView, ipcMain, dialog, Menu } = require('electron');
const path = require('path');
const fs = require('fs').promises;

// Load environment variables from .env file
require('dotenv').config();

// Global variables
let mainWindow;
let browserView;
let currentBrowserViewId = null;

// Environment check
const isDev = process.env.NODE_ENV === 'development';

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

  // Handle window closed
  mainWindow.on('closed', () => {
    mainWindow = null;
    if (browserView) {
      mainWindow.removeBrowserView(browserView);
      browserView = null;
    }
  });
}

// Create embedded browser view for restricted sites
function createBrowserView(url) {
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

  // Create new browser view
  browserView = new BrowserView({
    webPreferences: {
      nodeIntegration: false,
      contextIsolation: true,
      webSecurity: false, // Disable for bypassing restrictions
      allowRunningInsecureContent: true,
      experimentalFeatures: true
    }
  });

  // Add to main window
  mainWindow.setBrowserView(browserView);
  
  // Position the browser view (below header, above footer)
  const bounds = mainWindow.getBounds();
  browserView.setBounds({
    x: 0,
    y: 120, // Below header and tabs (48px header + 36px tabs + 36px browser indicator)
    width: bounds.width - 320, // Leave space for AI sidebar (320px)
    height: bounds.height - 120 // Leave space for header and tabs
  });

  // Disable web security for this view to bypass iframe restrictions
  browserView.webContents.session.webRequest.onHeadersReceived((details, callback) => {
    // Remove headers that prevent embedding
    delete details.responseHeaders['x-frame-options'];
    delete details.responseHeaders['X-Frame-Options'];
    delete details.responseHeaders['content-security-policy'];
    delete details.responseHeaders['Content-Security-Policy'];
    
    callback({ responseHeaders: details.responseHeaders });
  });

  // Load the URL
  browserView.webContents.loadURL(url);
  
  // Generate unique ID for this browser view
  currentBrowserViewId = Date.now().toString();
  
  // Send navigation events to renderer
  browserView.webContents.on('did-start-loading', () => {
    mainWindow.webContents.send('browser-loading', { id: currentBrowserViewId, loading: true });
  });

  browserView.webContents.on('did-finish-load', () => {
    mainWindow.webContents.send('browser-loading', { id: currentBrowserViewId, loading: false });
    mainWindow.webContents.send('browser-url-changed', { 
      id: currentBrowserViewId, 
      url: browserView.webContents.getURL() 
    });
  });

  browserView.webContents.on('did-fail-load', (event, errorCode, errorDescription) => {
    mainWindow.webContents.send('browser-error', { 
      id: currentBrowserViewId, 
      error: errorDescription 
    });
  });

  return currentBrowserViewId;
}

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
        y: 120, // Below header and tabs (48px header + 36px tabs + 36px browser indicator)
        width: bounds.width - 320, // Leave space for AI sidebar (320px)
        height: bounds.height - 120 // Leave space for header and tabs
      });
    } catch (error) {
      console.error('Error showing browser view:', error);
    }
  }
}

// IPC Handlers
ipcMain.handle('navigate-url', async (event, url) => {
  try {
    const browserId = createBrowserView(url);
    return { success: true, browserId };
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
  const result = await dialog.showOpenDialog(mainWindow, {
    properties: ['openFile'],
    filters: [
      { name: 'PDF Files', extensions: ['pdf'] },
      { name: 'All Files', extensions: ['*'] }
    ]
  });
  
  if (!result.canceled && result.filePaths.length > 0) {
    const filePath = result.filePaths[0];
    const fileData = await fs.readFile(filePath);
    return {
      success: true,
      filePath,
      fileName: path.basename(filePath),
      data: Array.from(fileData) // Convert to array for JSON serialization
    };
  }
  
  return { success: false };
});

ipcMain.handle('save-file-dialog', async (event, data, defaultName) => {
  const result = await dialog.showSaveDialog(mainWindow, {
    defaultPath: defaultName,
    filters: [
      { name: 'PDF Files', extensions: ['pdf'] },
      { name: 'All Files', extensions: ['*'] }
    ]
  });
  
  if (!result.canceled) {
    await fs.writeFile(result.filePath, Buffer.from(data));
    return { success: true, filePath: result.filePath };
  }
  
  return { success: false };
});

// AI API call (Gemini)
ipcMain.handle('ask-ai', async (event, prompt) => {
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
        contents: [{
          parts: [{
            text: `You are a helpful assistant embedded in a PDF and browser application. You can help with document analysis, web browsing, and general questions.\n\nUser: ${prompt}`
          }]
        }],
        generationConfig: {
          temperature: 0.2,
          topK: 40,
          topP: 0.95,
          maxOutputTokens: 1000,
        }
      })
    });

    if (!response.ok) {
      const errorText = await response.text();
      throw new Error(`Gemini API error: ${response.status} - ${errorText}`);
    }

    const data = await response.json();
    return {
      success: true,
      content: data.candidates[0].content.parts[0].text
    };
  } catch (error) {
    return {
      success: false,
      error: error.message
    };
  }
});

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

// Handle window resize to update browser view bounds
ipcMain.handle('window-resized', async () => {
  if (browserView) {
    const bounds = mainWindow.getBounds();
    browserView.setBounds({
      x: 0,
      y: 120, // Below header and tabs (48px header + 36px tabs + 36px browser indicator)
      width: bounds.width - 320, // Leave space for AI sidebar (320px)
      height: bounds.height - 120 // Leave space for header and tabs
    });
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

