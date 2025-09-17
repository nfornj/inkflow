# Test PDFs for InkFlow Validation

This directory contains sample PDFs for testing InkFlow's processing capabilities.

## 📁 Directory Structure

### `/simple/`

- Basic text PDFs without forms
- Single page documents
- Clean, machine-readable text
- Use for: Basic OCR testing, text extraction validation

### `/complex/`

- Multi-page documents
- Mixed text and images
- Complex layouts with tables/columns
- Use for: Layout analysis, advanced OCR testing

### `/fillable/`

- Interactive PDF forms (AcroForms)
- Various field types (text, checkbox, dropdown, signature)
- Both simple and complex form layouts
- Use for: Form detection, field mapping, autofill testing

### `/scanned/`

- Image-based PDFs (scanned documents)
- Various quality levels (low, medium, high DPI)
- Different languages and fonts
- Use for: OCR accuracy testing, AI analysis validation

## 🧪 Testing Protocol

When testing PDF processing changes:

1. **Select appropriate test PDFs** based on change scope
2. **Create temp test script**: `temp-test-pdf-validation.js`
3. **Run tests with different PDF types**
4. **Validate results**: OCR accuracy, form detection, processing speed
5. **Document issues** in development changelog
6. **DELETE temp test script** after validation

## 📝 Sample Test Script Template

```javascript
// temp-test-pdf-validation.js
const fs = require("fs");
const path = require("path");

async function testPDFProcessing() {
  const testPDFs = [
    "test-pdfs/simple/basic-text.pdf",
    "test-pdfs/fillable/form-example.pdf",
    "test-pdfs/scanned/scan-sample.pdf",
  ];

  for (const pdfPath of testPDFs) {
    console.log(`Testing: ${pdfPath}`);
    // Add your PDF processing tests here
    // const result = await processPDF(pdfPath);
    // console.log('Result:', result.success ? '✅' : '❌');
  }
}

testPDFProcessing().catch(console.error);
// Remember to DELETE this file after testing!
```

## ⚠️ Important Notes

- **NEVER commit sensitive PDFs** - Use only sample/test documents
- **Keep file sizes reasonable** - Large PDFs slow down testing
- **Update this README** when adding new test categories
- **Test with variety** - Different PDF creators, versions, complexity levels
- **Clean up regularly** - Remove outdated test files

---

_This folder ensures consistent, thorough PDF testing across all development changes._
