const fs = require('fs');
const path = require('path');

const testFiles = [
  'fillable-contact-form.pdf',
  'fillable-invoice-form.pdf', 
  'fillable-application-form.pdf',
  'fillable-survey-form.pdf',
  'create-test-pdfs.js',
  'create-fillable-pdfs.js',
  'cleanup-test-pdfs.js'
];

console.log('Cleaning up test PDFs...');

testFiles.forEach(file => {
  if (fs.existsSync(file)) {
    fs.unlinkSync(file);
    console.log(`✅ Removed ${file}`);
  } else {
    console.log(`⚠️  ${file} not found`);
  }
});

console.log('\n🧹 Cleanup complete!');
