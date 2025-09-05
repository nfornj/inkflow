/**
 * Global Setup for LLM Autofill Tests
 * Phase 7 Implementation
 */

const fs = require('fs').promises;
const path = require('path');

module.exports = async () => {
  console.log('Setting up global test environment...');
  
  // Create test directories
  const testDirs = [
    '/tmp/inkflow-test',
    '/tmp/inkflow-test/models',
    '/tmp/inkflow-test/profiles',
    '/tmp/inkflow-test/cache'
  ];
  
  for (const dir of testDirs) {
    try {
      await fs.mkdir(dir, { recursive: true });
    } catch (error) {
      // Directory might already exist, that's fine
    }
  }
  
  // Set test environment variables
  process.env.NODE_ENV = 'test';
  process.env.ELECTRON_IS_DEV = '0';
  process.env.INKFLOW_TEST_MODE = '1';
  
  console.log('Global test environment setup complete.');
};

