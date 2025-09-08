const fs = require('fs');
const { PDFDocument } = require('pdf-lib');

async function testPDFForms() {
  console.log('Testing PDF form fields...\n');

  const pdfFiles = [
    'simple-fillable-form.pdf',
    'acroform-test.pdf',
    'fillable-contact-form.pdf',
    'fillable-survey-form.pdf'
  ];

  for (const filename of pdfFiles) {
    if (!fs.existsSync(filename)) {
      console.log(`❌ ${filename} - File not found`);
      continue;
    }

    try {
      const pdfBytes = fs.readFileSync(filename);
      const pdfDoc = await PDFDocument.load(pdfBytes);
      const form = pdfDoc.getForm();
      
      console.log(`📄 ${filename}:`);
      console.log(`   Size: ${(pdfBytes.length / 1024).toFixed(1)} KB`);
      
      // Get all form fields
      const fields = form.getFields();
      console.log(`   Form fields: ${fields.length}`);
      
      if (fields.length > 0) {
        fields.forEach((field, index) => {
          const fieldName = field.getName();
          const fieldType = field.constructor.name;
          console.log(`   ${index + 1}. ${fieldName} (${fieldType})`);
          
          // Try to get field value if possible
          try {
            if (fieldType === 'PDFTextField') {
              console.log(`      Value: "${field.getText()}"`);
            } else if (fieldType === 'PDFCheckBox') {
              console.log(`      Checked: ${field.isChecked()}`);
            } else if (fieldType === 'PDFRadioGroup') {
              console.log(`      Selected: ${field.getSelected()}`);
            } else if (fieldType === 'PDFDropdown') {
              console.log(`      Selected: ${field.getSelected()}`);
              console.log(`      Options: ${field.getOptions().join(', ')}`);
            }
          } catch (e) {
            console.log(`      (Could not read field value)`);
          }
        });
      } else {
        console.log('   ⚠️  No form fields found!');
      }
      
      console.log('');
      
    } catch (error) {
      console.log(`❌ ${filename} - Error: ${error.message}`);
      console.log('');
    }
  }

  console.log('🔍 Form Field Support Test:');
  console.log('');
  console.log('If form fields are not interactive in your PDF viewer:');
  console.log('1. The PDF viewer might not support form fields');
  console.log('2. Form fields might be rendered as static elements');
  console.log('3. Try opening in Adobe Acrobat Reader for best compatibility');
  console.log('4. Check if @react-pdf-viewer supports form field interaction');
  console.log('');
  console.log('To test form field interaction:');
  console.log('- Open the PDFs in Adobe Acrobat Reader');
  console.log('- Try clicking on text fields, checkboxes, radio buttons');
  console.log('- Check if you can type in text fields');
  console.log('- Verify if checkboxes can be toggled');
}

testPDFForms().catch(console.error);
