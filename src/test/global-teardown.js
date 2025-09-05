/**
 * Global Teardown for LLM Autofill Tests
 * Phase 7 Implementation
 */

const fs = require('fs').promises;
const path = require('path');

module.exports = async () => {
  console.log('Cleaning up global test environment...');
  
  // Clean up test directories
  const testDirs = [
    '/tmp/inkflow-test'
  ];
  
  for (const dir of testDirs) {
    try {
      await fs.rmdir(dir, { recursive: true });
    } catch (error) {
      // Directory might not exist or be empty, that's fine
    }
  }
  
  // Clear test environment variables
  delete process.env.INKFLOW_TEST_MODE;
  
  console.log('Global test environment cleanup complete.');
};

