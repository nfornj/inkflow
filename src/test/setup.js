/**
 * Jest Setup File for LLM Autofill Tests
 * Phase 7 Implementation
 */

// Set test environment variables
process.env.NODE_ENV = 'test';
process.env.ELECTRON_IS_DEV = '0';

// Mock console methods to reduce noise during tests
const originalConsole = global.console;
global.console = {
  ...originalConsole,
  log: jest.fn(),
  debug: jest.fn(),
  info: jest.fn(),
  warn: jest.fn(),
  error: jest.fn()
};

// Mock Electron modules
jest.mock('electron', () => ({
  app: {
    getPath: jest.fn(() => '/tmp/inkflow-test'),
    isReady: jest.fn(() => true),
    getName: jest.fn(() => 'inkflow-test'),
    getVersion: jest.fn(() => '1.0.0')
  },
  BrowserWindow: jest.fn(),
  ipcMain: {
    handle: jest.fn(),
    on: jest.fn(),
    removeAllListeners: jest.fn()
  },
  ipcRenderer: {
    invoke: jest.fn(),
    on: jest.fn(),
    removeAllListeners: jest.fn()
  },
  contextBridge: {
    exposeInMainWorld: jest.fn()
  }
}));

// Mock file system operations
jest.mock('fs', () => ({
  ...jest.requireActual('fs'),
  promises: {
    ...jest.requireActual('fs').promises,
    mkdir: jest.fn().mockResolvedValue(undefined),
    writeFile: jest.fn().mockResolvedValue(undefined),
    readFile: jest.fn().mockResolvedValue('{}'),
    unlink: jest.fn().mockResolvedValue(undefined),
    rmdir: jest.fn().mockResolvedValue(undefined)
  }
}));

// Mock crypto module
jest.mock('crypto', () => ({
  ...jest.requireActual('crypto'),
  createHash: jest.fn(() => ({
    update: jest.fn().mockReturnThis(),
    digest: jest.fn(() => 'mock-hash')
  }))
}));

// Mock child_process module
jest.mock('child_process', () => ({
  spawn: jest.fn(() => ({
    on: jest.fn(),
    stdout: { on: jest.fn() },
    stderr: { on: jest.fn() },
    kill: jest.fn()
  })),
  exec: jest.fn((command, callback) => {
    if (callback) {
      callback(null, 'mock output', '');
    }
    return { on: jest.fn() };
  })
}));

// Mock os module
jest.mock('os', () => ({
  ...jest.requireActual('os'),
  platform: jest.fn(() => 'darwin'),
  arch: jest.fn(() => 'x64'),
  cpus: jest.fn(() => [
    { model: 'Intel Core i7', speed: 2400 },
    { model: 'Intel Core i7', speed: 2400 },
    { model: 'Intel Core i7', speed: 2400 },
    { model: 'Intel Core i7', speed: 2400 }
  ]),
  totalmem: jest.fn(() => 16 * 1024 * 1024 * 1024), // 16GB
  freemem: jest.fn(() => 8 * 1024 * 1024 * 1024) // 8GB
}));

// Mock path module
jest.mock('path', () => ({
  ...jest.requireActual('path'),
  join: jest.fn((...args) => args.join('/')),
  resolve: jest.fn((...args) => args.join('/')),
  dirname: jest.fn((p) => p.split('/').slice(0, -1).join('/')),
  basename: jest.fn((p) => p.split('/').pop()),
  extname: jest.fn((p) => {
    const parts = p.split('.');
    return parts.length > 1 ? '.' + parts.pop() : '';
  })
}));

// Mock electron-store
jest.mock('electron-store', () => {
  return jest.fn().mockImplementation(() => ({
    get: jest.fn(() => ({})),
    set: jest.fn(),
    delete: jest.fn(),
    clear: jest.fn(),
    has: jest.fn(() => false),
    size: 0,
    store: {}
  }));
});

// Mock node-fetch
jest.mock('node-fetch', () => {
  return jest.fn(() => Promise.resolve({
    ok: true,
    status: 200,
    json: () => Promise.resolve({}),
    text: () => Promise.resolve(''),
    headers: new Map()
  }));
});

// Mock https module
jest.mock('https', () => ({
  ...jest.requireActual('https'),
  request: jest.fn((options, callback) => {
    const mockResponse = {
      on: jest.fn(),
      pipe: jest.fn(),
      statusCode: 200,
      headers: {}
    };
    if (callback) {
      callback(mockResponse);
    }
    return {
      on: jest.fn(),
      write: jest.fn(),
      end: jest.fn()
    };
  })
}));

// Mock http module
jest.mock('http', () => ({
  ...jest.requireActual('http'),
  request: jest.fn((options, callback) => {
    const mockResponse = {
      on: jest.fn(),
      pipe: jest.fn(),
      statusCode: 200,
      headers: {}
    };
    if (callback) {
      callback(mockResponse);
    }
    return {
      on: jest.fn(),
      write: jest.fn(),
      end: jest.fn()
    };
  })
}));

// Global test utilities
global.testUtils = {
  createMockProfile: () => ({
    name: 'John Doe',
    email: 'john@example.com',
    phone: '(555) 123-4567',
    address: {
      street: '123 Main St',
      city: 'New York',
      province: 'NY',
      postal_code: '10001',
      country: 'US'
    },
    company: 'Acme Corp',
    job_title: 'Software Engineer'
  }),
  
  createMockContext: (userProfile = {}) => ({
    user_profile: {
      name: 'John Doe',
      email: 'john@example.com',
      phone: '(555) 123-4567',
      ...userProfile
    },
    system_context: {
      current_date: '2025-01-03',
      current_time: '12:00:00',
      timezone: 'America/New_York',
      locale: 'en-US',
      country: 'US',
      currency: 'USD',
      dateFormat: 'MM/DD/YYYY',
      phoneFormat: '(XXX) XXX-XXXX'
    },
    autofill_context: {
      field_type: 'email',
      field_name: 'Email Address',
      field_importance: 'high',
      required: true,
      available_data: [],
      related_fields: [],
      fallback_options: []
    }
  }),
  
  createMockFieldContext: (fieldType = 'email') => ({
    field_type: fieldType,
    field_name: `${fieldType.charAt(0).toUpperCase() + fieldType.slice(1)} Field`,
    field_importance: 'medium',
    required: false
  }),
  
  createMockLLMResponse: (type = 'suggestion') => {
    switch (type) {
      case 'suggestion':
        return {
          success: true,
          suggestion: 'john@example.com',
          confidence: 0.95,
          source: 'llm',
          reasoning: 'Generated based on user profile'
        };
      case 'question':
        return {
          success: true,
          question: 'What is your email address?',
          field_type: 'email',
          reasoning: 'Email is required but not available'
        };
      case 'validation':
        return {
          success: true,
          valid: true,
          corrected_value: 'john@example.com',
          feedback: 'Valid email format',
          suggestions: ['john.doe@example.com']
        };
      default:
        return { success: false, error: 'Unknown response type' };
    }
  },
  
  waitFor: (ms) => new Promise(resolve => setTimeout(resolve, ms)),
  
  mockPerformanceNow: () => {
    let time = 0;
    jest.spyOn(performance, 'now').mockImplementation(() => {
      time += 100; // Increment by 100ms each call
      return time;
    });
    return () => performance.now.mockRestore();
  }
};

// Clean up after each test
afterEach(() => {
  jest.clearAllMocks();
});

// Global error handler for unhandled promise rejections
process.on('unhandledRejection', (reason, promise) => {
  console.error('Unhandled Rejection at:', promise, 'reason:', reason);
});

// Global error handler for uncaught exceptions
process.on('uncaughtException', (error) => {
  console.error('Uncaught Exception:', error);
});

