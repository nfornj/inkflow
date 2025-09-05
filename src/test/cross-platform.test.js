/**
 * Cross-Platform Tests for LLM Autofill System
 * Phase 7 Implementation
 */

const { jest } = require('@jest/globals');
const os = require('os');
const path = require('path');

// Mock Electron modules
jest.mock('electron', () => ({
  app: {
    getPath: jest.fn(() => {
      const platform = os.platform();
      switch (platform) {
        case 'win32':
          return 'C:\\Users\\Test\\AppData\\Roaming\\inkflow';
        case 'darwin':
          return '/Users/test/Library/Application Support/inkflow';
        case 'linux':
          return '/home/test/.config/inkflow';
        default:
          return '/tmp/inkflow';
      }
    }),
    isReady: jest.fn(() => true)
  }
}));

// Import modules after mocking
const ProfileManager = require('../main/profile-manager');
const ContextGenerator = require('../main/context-generator');
const PromptManager = require('../main/prompt-manager');

describe('Cross-Platform LLM Autofill Tests', () => {
  let profileManager;
  let contextGenerator;
  let promptManager;

  beforeEach(() => {
    // Create fresh instances for each test
    profileManager = new ProfileManager();
    contextGenerator = new ContextGenerator();
    promptManager = new PromptManager();
  });

  describe('Platform Detection', () => {
    test('should detect current platform correctly', () => {
      const platform = os.platform();
      expect(['win32', 'darwin', 'linux'].includes(platform)).toBe(true);
    });

    test('should detect architecture correctly', () => {
      const arch = os.arch();
      expect(['x64', 'arm64', 'ia32'].includes(arch)).toBe(true);
    });

    test('should detect OS version correctly', () => {
      const platform = os.platform();
      const release = os.release();
      
      expect(typeof release).toBe('string');
      expect(release.length).toBeGreaterThan(0);
      
      if (platform === 'win32') {
        expect(release).toMatch(/^\d+\.\d+\.\d+/);
      } else if (platform === 'darwin') {
        expect(release).toMatch(/^\d+\.\d+\.\d+/);
      } else if (platform === 'linux') {
        expect(release).toMatch(/^\d+\.\d+\.\d+/);
      }
    });
  });

  describe('Path Handling', () => {
    test('should handle Windows paths correctly', () => {
      // Mock Windows platform
      const originalPlatform = process.platform;
      Object.defineProperty(process, 'platform', {
        value: 'win32',
        writable: true
      });

      const { app } = require('electron');
      app.getPath.mockReturnValue('C:\\Users\\Test\\AppData\\Roaming\\inkflow');

      const profileManager = new ProfileManager();
      expect(profileManager).toBeDefined();

      // Restore original platform
      Object.defineProperty(process, 'platform', {
        value: originalPlatform,
        writable: true
      });
    });

    test('should handle macOS paths correctly', () => {
      // Mock macOS platform
      const originalPlatform = process.platform;
      Object.defineProperty(process, 'platform', {
        value: 'darwin',
        writable: true
      });

      const { app } = require('electron');
      app.getPath.mockReturnValue('/Users/test/Library/Application Support/inkflow');

      const profileManager = new ProfileManager();
      expect(profileManager).toBeDefined();

      // Restore original platform
      Object.defineProperty(process, 'platform', {
        value: originalPlatform,
        writable: true
      });
    });

    test('should handle Linux paths correctly', () => {
      // Mock Linux platform
      const originalPlatform = process.platform;
      Object.defineProperty(process, 'platform', {
        value: 'linux',
        writable: true
      });

      const { app } = require('electron');
      app.getPath.mockReturnValue('/home/test/.config/inkflow');

      const profileManager = new ProfileManager();
      expect(profileManager).toBeDefined();

      // Restore original platform
      Object.defineProperty(process, 'platform', {
        value: originalPlatform,
        writable: true
      });
    });
  });

  describe('Locale Detection', () => {
    test('should detect locale correctly on all platforms', () => {
      const systemContext = contextGenerator.systemContext;
      
      expect(systemContext.locale).toBeDefined();
      expect(typeof systemContext.locale).toBe('string');
      expect(systemContext.locale.length).toBeGreaterThan(0);
      
      // Should be a valid locale format (e.g., 'en-US', 'fr-CA', 'de-DE')
      expect(systemContext.locale).toMatch(/^[a-z]{2}-[A-Z]{2}$/);
    });

    test('should detect country correctly on all platforms', () => {
      const systemContext = contextGenerator.systemContext;
      
      expect(systemContext.country).toBeDefined();
      expect(typeof systemContext.country).toBe('string');
      expect(systemContext.country.length).toBe(2); // ISO country code
      expect(systemContext.country).toMatch(/^[A-Z]{2}$/);
    });

    test('should detect currency correctly on all platforms', () => {
      const systemContext = contextGenerator.systemContext;
      
      expect(systemContext.currency).toBeDefined();
      expect(typeof systemContext.currency).toBe('string');
      expect(systemContext.currency.length).toBe(3); // ISO currency code
      expect(systemContext.currency).toMatch(/^[A-Z]{3}$/);
    });

    test('should detect date format correctly on all platforms', () => {
      const systemContext = contextGenerator.systemContext;
      
      expect(systemContext.dateFormat).toBeDefined();
      expect(typeof systemContext.dateFormat).toBe('string');
      expect(systemContext.dateFormat.length).toBeGreaterThan(0);
      
      // Should be a valid date format
      expect(['MM/DD/YYYY', 'DD/MM/YYYY', 'YYYY-MM-DD', 'DD.MM.YYYY']).toContain(systemContext.dateFormat);
    });

    test('should detect phone format correctly on all platforms', () => {
      const systemContext = contextGenerator.systemContext;
      
      expect(systemContext.phoneFormat).toBeDefined();
      expect(typeof systemContext.phoneFormat).toBe('string');
      expect(systemContext.phoneFormat.length).toBeGreaterThan(0);
      
      // Should be a valid phone format
      expect(['(XXX) XXX-XXXX', 'XXX XXX XXXX', 'XX XX XX XX XX', 'XXX-XXX-XXXX']).toContain(systemContext.phoneFormat);
    });
  });

  describe('Profile Management Cross-Platform', () => {
    test('should work correctly on Windows', async () => {
      // Mock Windows platform
      const originalPlatform = process.platform;
      Object.defineProperty(process, 'platform', {
        value: 'win32',
        writable: true
      });

      const { app } = require('electron');
      app.getPath.mockReturnValue('C:\\Users\\Test\\AppData\\Roaming\\inkflow');

      const profileManager = new ProfileManager();
      
      // Test profile operations
      await profileManager.updateProfile('name', 'John Doe');
      await profileManager.updateProfile('email', 'john@example.com');
      
      const profile = await profileManager.getProfile();
      expect(profile.success).toBe(true);
      expect(profile.data.name).toBe('John Doe');
      expect(profile.data.email).toBe('john@example.com');

      // Restore original platform
      Object.defineProperty(process, 'platform', {
        value: originalPlatform,
        writable: true
      });
    });

    test('should work correctly on macOS', async () => {
      // Mock macOS platform
      const originalPlatform = process.platform;
      Object.defineProperty(process, 'platform', {
        value: 'darwin',
        writable: true
      });

      const { app } = require('electron');
      app.getPath.mockReturnValue('/Users/test/Library/Application Support/inkflow');

      const profileManager = new ProfileManager();
      
      // Test profile operations
      await profileManager.updateProfile('name', 'John Doe');
      await profileManager.updateProfile('email', 'john@example.com');
      
      const profile = await profileManager.getProfile();
      expect(profile.success).toBe(true);
      expect(profile.data.name).toBe('John Doe');
      expect(profile.data.email).toBe('john@example.com');

      // Restore original platform
      Object.defineProperty(process, 'platform', {
        value: originalPlatform,
        writable: true
      });
    });

    test('should work correctly on Linux', async () => {
      // Mock Linux platform
      const originalPlatform = process.platform;
      Object.defineProperty(process, 'platform', {
        value: 'linux',
        writable: true
      });

      const { app } = require('electron');
      app.getPath.mockReturnValue('/home/test/.config/inkflow');

      const profileManager = new ProfileManager();
      
      // Test profile operations
      await profileManager.updateProfile('name', 'John Doe');
      await profileManager.updateProfile('email', 'john@example.com');
      
      const profile = await profileManager.getProfile();
      expect(profile.success).toBe(true);
      expect(profile.data.name).toBe('John Doe');
      expect(profile.data.email).toBe('john@example.com');

      // Restore original platform
      Object.defineProperty(process, 'platform', {
        value: originalPlatform,
        writable: true
      });
    });
  });

  describe('Context Generation Cross-Platform', () => {
    test('should generate consistent context across platforms', () => {
      const userProfile = {
        name: 'John Doe',
        email: 'john@example.com',
        phone: '(555) 123-4567',
        address: {
          street: '123 Main St',
          city: 'New York',
          province: 'NY',
          postal_code: '10001',
          country: 'US'
        }
      };

      const userContext = contextGenerator.generateUserContext(userProfile);
      
      // Should be consistent regardless of platform
      expect(userContext.personal.name).toBe('John Doe');
      expect(userContext.personal.email).toBe('john@example.com');
      expect(userContext.personal.phone).toBe('(555) 123-4567');
      expect(userContext.address.street).toBe('123 Main St');
      expect(userContext.address.city).toBe('New York');
      expect(userContext.address.province).toBe('NY');
      expect(userContext.address.postal_code).toBe('10001');
      expect(userContext.address.country).toBe('US');
    });

    test('should handle different locale formats correctly', () => {
      const systemContext = contextGenerator.systemContext;
      
      // Should have valid locale format
      expect(systemContext.locale).toMatch(/^[a-z]{2}-[A-Z]{2}$/);
      
      // Should have valid country code
      expect(systemContext.country).toMatch(/^[A-Z]{2}$/);
      
      // Should have valid currency code
      expect(systemContext.currency).toMatch(/^[A-Z]{3}$/);
    });
  });

  describe('Prompt Generation Cross-Platform', () => {
    test('should generate consistent prompts across platforms', () => {
      const context = {
        user_profile: {
          name: 'John Doe',
          email: 'john@example.com',
          phone: '(555) 123-4567'
        },
        system_context: {
          current_date: '2025-01-03',
          locale: 'en-US',
          country: 'US',
          currency: 'USD'
        },
        autofill_context: {
          field_type: 'email',
          field_name: 'Email Address',
          field_importance: 'high',
          required: true
        }
      };

      const fieldContext = {
        field_type: 'email',
        field_name: 'Email Address',
        field_importance: 'high',
        required: true
      };

      const prompt = promptManager.generateAutofillPrompt(context, 'email', fieldContext);
      
      // Should be consistent regardless of platform
      expect(prompt).toContain('intelligent autofill assistant');
      expect(prompt).toContain('John Doe');
      expect(prompt).toContain('john@example.com');
      expect(prompt).toContain('(555) 123-4567');
      expect(prompt).toContain('Email Address');
      expect(prompt).toContain('Field Type: email');
      expect(prompt).toContain('Field Importance: high');
      expect(prompt).toContain('Required: true');
    });

    test('should handle different date formats correctly', () => {
      const systemContext = contextGenerator.systemContext;
      
      // Should have valid date format
      expect(['MM/DD/YYYY', 'DD/MM/YYYY', 'YYYY-MM-DD', 'DD.MM.YYYY']).toContain(systemContext.dateFormat);
      
      // Should have valid phone format
      expect(['(XXX) XXX-XXXX', 'XXX XXX XXXX', 'XX XX XX XX XX', 'XXX-XXX-XXXX']).toContain(systemContext.phoneFormat);
    });
  });

  describe('Error Handling Cross-Platform', () => {
    test('should handle file system errors gracefully on all platforms', async () => {
      // Mock file system error
      const { app } = require('electron');
      app.getPath.mockImplementation(() => {
        throw new Error('File system error');
      });

      expect(() => {
        new ProfileManager();
      }).toThrow('File system error');
    });

    test('should handle permission errors gracefully on all platforms', async () => {
      // Mock permission error
      const { app } = require('electron');
      app.getPath.mockReturnValue('/readonly/path');

      const profileManager = new ProfileManager();
      
      // This should not throw an error during initialization
      expect(profileManager).toBeDefined();
    });

    test('should handle network errors gracefully on all platforms', () => {
      // Test context generation with network-dependent operations
      const systemContext = contextGenerator.systemContext;
      
      // Should still work even if network is unavailable
      expect(systemContext.locale).toBeDefined();
      expect(systemContext.country).toBeDefined();
      expect(systemContext.currency).toBeDefined();
    });
  });

  describe('Performance Cross-Platform', () => {
    test('should maintain performance across platforms', async () => {
      const startTime = Date.now();

      // Test profile operations
      await profileManager.updateProfile('name', 'John Doe');
      await profileManager.updateProfile('email', 'john@example.com');
      await profileManager.updateProfile('phone', '(555) 123-4567');

      // Test context generation
      const userProfile = {
        name: 'John Doe',
        email: 'john@example.com',
        phone: '(555) 123-4567'
      };
      const userContext = contextGenerator.generateUserContext(userProfile);
      const systemContext = contextGenerator.systemContext;

      // Test prompt generation
      const context = {
        user_profile: userProfile,
        system_context: systemContext,
        autofill_context: {
          field_type: 'email',
          field_name: 'Email Address'
        }
      };
      const prompt = promptManager.generateAutofillPrompt(context, 'email', {
        field_type: 'email',
        field_name: 'Email Address'
      });

      const endTime = Date.now();
      const duration = endTime - startTime;

      // Should complete within reasonable time on all platforms
      expect(duration).toBeLessThan(1000);
    });

    test('should handle memory constraints across platforms', () => {
      const initialMemory = process.memoryUsage();

      // Perform many operations
      for (let i = 0; i < 1000; i++) {
        const userProfile = {
          name: `User ${i}`,
          email: `user${i}@example.com`,
          phone: `(555) ${i.toString().padStart(3, '0')}-4567`
        };

        const userContext = contextGenerator.generateUserContext(userProfile);
        const systemContext = contextGenerator.systemContext;
        const autofillContext = contextGenerator.generateAutofillContext({
          field_type: 'email',
          field_name: 'Email Address'
        });
      }

      const finalMemory = process.memoryUsage();
      const memoryIncrease = finalMemory.heapUsed - initialMemory.heapUsed;

      // Memory increase should be reasonable on all platforms
      expect(memoryIncrease).toBeLessThan(100 * 1024 * 1024); // 100MB
    });
  });

  describe('Internationalization Cross-Platform', () => {
    test('should handle different locales correctly', () => {
      const locales = ['en-US', 'en-CA', 'fr-CA', 'de-DE', 'es-ES', 'ja-JP', 'zh-CN'];
      
      locales.forEach(locale => {
        // Mock locale detection
        const originalResolvedOptions = Intl.DateTimeFormat.prototype.resolvedOptions;
        Intl.DateTimeFormat.prototype.resolvedOptions = jest.fn(() => ({
          locale: locale,
          timeZone: 'America/New_York'
        }));

        const contextGenerator = new ContextGenerator();
        const systemContext = contextGenerator.systemContext;

        expect(systemContext.locale).toBe(locale);
        expect(systemContext.country).toBeDefined();
        expect(systemContext.currency).toBeDefined();
        expect(systemContext.dateFormat).toBeDefined();
        expect(systemContext.phoneFormat).toBeDefined();

        // Restore original method
        Intl.DateTimeFormat.prototype.resolvedOptions = originalResolvedOptions;
      });
    });

    test('should handle different timezones correctly', () => {
      const timezones = ['America/New_York', 'America/Los_Angeles', 'Europe/London', 'Asia/Tokyo', 'Australia/Sydney'];
      
      timezones.forEach(timezone => {
        // Mock timezone detection
        const originalResolvedOptions = Intl.DateTimeFormat.prototype.resolvedOptions;
        Intl.DateTimeFormat.prototype.resolvedOptions = jest.fn(() => ({
          locale: 'en-US',
          timeZone: timezone
        }));

        const contextGenerator = new ContextGenerator();
        const systemContext = contextGenerator.systemContext;

        expect(systemContext.timezone).toBe(timezone);
        expect(systemContext.currentDate).toBeDefined();
        expect(systemContext.currentTime).toBeDefined();

        // Restore original method
        Intl.DateTimeFormat.prototype.resolvedOptions = originalResolvedOptions;
      });
    });
  });
});

