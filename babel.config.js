/**
 * Babel Configuration for Jest Tests
 * Phase 7 Implementation
 */

module.exports = {
  presets: [
    [
      '@babel/preset-env',
      {
        targets: {
          node: 'current'
        },
        modules: 'commonjs'
      }
    ]
  ],
  plugins: [
    // Add any necessary plugins here
  ]
};

