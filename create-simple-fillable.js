const fs = require('fs');
const { PDFDocument, rgb, StandardFonts } = require('pdf-lib');

async function createSimpleFillablePDF() {
  console.log('Creating a simple fillable PDF...');

  // Create a new PDF document
  const pdfDoc = await PDFDocument.create();
  const page = pdfDoc.addPage([600, 800]);
  
  // Get the form
  const form = pdfDoc.getForm();
  
  // Embed fonts
  const font = await pdfDoc.embedFont(StandardFonts.Helvetica);
  const boldFont = await pdfDoc.embedFont(StandardFonts.HelveticaBold);

  // Title
  page.drawText('Simple Fillable Form', {
    x: 50,
    y: 750,
    size: 24,
    font: boldFont,
    color: rgb(0, 0, 0),
  });

  // Create a simple text field
  const nameField = form.createTextField('name');
  nameField.setText('John Doe'); // Pre-fill with sample text
  nameField.addToPage(page, {
    x: 50,
    y: 700,
    width: 300,
    height: 30,
  });

  // Add label
  page.drawText('Name:', {
    x: 50,
    y: 740,
    size: 12,
    font: font,
    color: rgb(0, 0, 0),
  });

  // Create another text field
  const emailField = form.createTextField('email');
  emailField.setText('john@example.com');
  emailField.addToPage(page, {
    x: 50,
    y: 650,
    width: 300,
    height: 30,
  });

  page.drawText('Email:', {
    x: 50,
    y: 690,
    size: 12,
    font: font,
    color: rgb(0, 0, 0),
  });

  // Create a checkbox
  const checkbox = form.createCheckBox('newsletter');
  checkbox.check();
  checkbox.addToPage(page, {
    x: 50,
    y: 600,
    width: 20,
    height: 20,
  });

  page.drawText('Subscribe to newsletter', {
    x: 80,
    y: 610,
    size: 12,
    font: font,
    color: rgb(0, 0, 0),
  });

  // Create radio buttons
  const radioGroup = form.createRadioGroup('gender');
  
  // Male option
  radioGroup.addOptionToPage('male', page, {
    x: 50,
    y: 550,
    width: 15,
    height: 15,
  });
  page.drawText('Male', {
    x: 75,
    y: 555,
    size: 12,
    font: font,
    color: rgb(0, 0, 0),
  });

  // Female option
  radioGroup.addOptionToPage('female', page, {
    x: 150,
    y: 550,
    width: 15,
    height: 15,
  });
  page.drawText('Female', {
    x: 175,
    y: 555,
    size: 12,
    font: font,
    color: rgb(0, 0, 0),
  });

  // Set default selection
  radioGroup.select('male');

  page.drawText('Gender:', {
    x: 50,
    y: 580,
    size: 12,
    font: font,
    color: rgb(0, 0, 0),
  });

  // Create a dropdown (choice field)
  const countryField = form.createDropdown('country');
  countryField.addOptions(['USA', 'Canada', 'UK', 'Germany', 'France']);
  countryField.select('USA');
  countryField.addToPage(page, {
    x: 50,
    y: 500,
    width: 200,
    height: 30,
  });

  page.drawText('Country:', {
    x: 50,
    y: 540,
    size: 12,
    font: font,
    color: rgb(0, 0, 0),
  });

  // Create a text area
  const commentsField = form.createTextField('comments');
  commentsField.setText('This is a sample comment...');
  commentsField.addToPage(page, {
    x: 50,
    y: 400,
    width: 500,
    height: 80,
  });

  page.drawText('Comments:', {
    x: 50,
    y: 490,
    size: 12,
    font: font,
    color: rgb(0, 0, 0),
  });

  // Instructions
  page.drawText('Instructions:', {
    x: 50,
    y: 350,
    size: 14,
    font: boldFont,
    color: rgb(0, 0, 0),
  });

  page.drawText('1. Click on the text fields to edit them', {
    x: 50,
    y: 320,
    size: 10,
    font: font,
    color: rgb(0, 0, 0),
  });

  page.drawText('2. Click the checkbox to toggle it', {
    x: 50,
    y: 300,
    size: 10,
    font: font,
    color: rgb(0, 0, 0),
  });

  page.drawText('3. Click radio buttons to select one option', {
    x: 50,
    y: 280,
    size: 10,
    font: font,
    color: rgb(0, 0, 0),
  });

  page.drawText('4. Click the dropdown to see options', {
    x: 50,
    y: 260,
    size: 10,
    font: font,
    color: rgb(0, 0, 0),
  });

  page.drawText('5. Click in the text area to edit comments', {
    x: 50,
    y: 240,
    size: 10,
    font: font,
    color: rgb(0, 0, 0),
  });

  // Save the PDF
  const pdfBytes = await pdfDoc.save();
  fs.writeFileSync('simple-fillable-form.pdf', pdfBytes);
  
  console.log('✅ Created simple-fillable-form.pdf');
  console.log('This PDF contains:');
  console.log('- Pre-filled text fields (click to edit)');
  console.log('- A checked checkbox (click to toggle)');
  console.log('- Radio buttons with default selection');
  console.log('- A dropdown with options');
  console.log('- A text area for comments');
  console.log('');
  console.log('If the form fields are not interactive, the issue might be:');
  console.log('1. PDF viewer doesn\'t support form fields');
  console.log('2. Form fields are not being rendered properly');
  console.log('3. Need to test in a different PDF viewer');
}

createSimpleFillablePDF().catch(console.error);
