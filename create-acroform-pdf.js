const fs = require('fs');
const { PDFDocument, rgb, StandardFonts } = require('pdf-lib');

async function createAcroFormPDF() {
  console.log('Creating PDF with AcroForm fields (more compatible)...');

  // Create a new PDF document
  const pdfDoc = await PDFDocument.create();
  const page = pdfDoc.addPage([600, 800]);
  
  // Get the form
  const form = pdfDoc.getForm();
  
  // Embed fonts
  const font = await pdfDoc.embedFont(StandardFonts.Helvetica);
  const boldFont = await pdfDoc.embedFont(StandardFonts.HelveticaBold);

  // Title
  page.drawText('AcroForm Compatible PDF', {
    x: 50,
    y: 750,
    size: 24,
    font: boldFont,
    color: rgb(0, 0, 0),
  });

  // Create text fields with explicit properties
  const nameField = form.createTextField('name');
  nameField.setText('Enter your name here');
  nameField.enableReadOnly();
  nameField.disableReadOnly();
  nameField.addToPage(page, {
    x: 50,
    y: 700,
    width: 300,
    height: 25,
    borderWidth: 1,
    borderColor: rgb(0, 0, 0),
    backgroundColor: rgb(1, 1, 1),
  });

  page.drawText('Name:', {
    x: 50,
    y: 735,
    size: 12,
    font: font,
    color: rgb(0, 0, 0),
  });

  // Email field
  const emailField = form.createTextField('email');
  emailField.setText('Enter your email');
  emailField.addToPage(page, {
    x: 50,
    y: 650,
    width: 300,
    height: 25,
    borderWidth: 1,
    borderColor: rgb(0, 0, 0),
  });

  page.drawText('Email:', {
    x: 50,
    y: 685,
    size: 12,
    font: font,
    color: rgb(0, 0, 0),
  });

  // Phone field
  const phoneField = form.createTextField('phone');
  phoneField.setText('(555) 123-4567');
  phoneField.addToPage(page, {
    x: 50,
    y: 600,
    width: 200,
    height: 25,
    borderWidth: 1,
    borderColor: rgb(0, 0, 0),
  });

  page.drawText('Phone:', {
    x: 50,
    y: 635,
    size: 12,
    font: font,
    color: rgb(0, 0, 0),
  });

  // Checkbox
  const newsletterCheckbox = form.createCheckBox('newsletter');
  newsletterCheckbox.addToPage(page, {
    x: 50,
    y: 550,
    width: 20,
    height: 20,
    borderWidth: 1,
    borderColor: rgb(0, 0, 0),
  });

  page.drawText('Subscribe to newsletter', {
    x: 80,
    y: 560,
    size: 12,
    font: font,
    color: rgb(0, 0, 0),
  });

  // Another checkbox
  const termsCheckbox = form.createCheckBox('terms');
  termsCheckbox.check();
  termsCheckbox.addToPage(page, {
    x: 50,
    y: 520,
    width: 20,
    height: 20,
    borderWidth: 1,
    borderColor: rgb(0, 0, 0),
  });

  page.drawText('I agree to the terms and conditions', {
    x: 80,
    y: 530,
    size: 12,
    font: font,
    color: rgb(0, 0, 0),
  });

  // Radio buttons
  const genderGroup = form.createRadioGroup('gender');
  
  // Male
  genderGroup.addOptionToPage('male', page, {
    x: 50,
    y: 480,
    width: 15,
    height: 15,
    borderWidth: 1,
    borderColor: rgb(0, 0, 0),
  });
  page.drawText('Male', {
    x: 75,
    y: 485,
    size: 12,
    font: font,
    color: rgb(0, 0, 0),
  });

  // Female
  genderGroup.addOptionToPage('female', page, {
    x: 150,
    y: 480,
    width: 15,
    height: 15,
    borderWidth: 1,
    borderColor: rgb(0, 0, 0),
  });
  page.drawText('Female', {
    x: 175,
    y: 485,
    size: 12,
    font: font,
    color: rgb(0, 0, 0),
  });

  // Other
  genderGroup.addOptionToPage('other', page, {
    x: 250,
    y: 480,
    width: 15,
    height: 15,
    borderWidth: 1,
    borderColor: rgb(0, 0, 0),
  });
  page.drawText('Other', {
    x: 275,
    y: 485,
    size: 12,
    font: font,
    color: rgb(0, 0, 0),
  });

  page.drawText('Gender:', {
    x: 50,
    y: 510,
    size: 12,
    font: font,
    color: rgb(0, 0, 0),
  });

  // Dropdown
  const countryField = form.createDropdown('country');
  countryField.addOptions(['Select Country', 'United States', 'Canada', 'United Kingdom', 'Germany', 'France', 'Japan', 'Australia']);
  countryField.select('Select Country');
  countryField.addToPage(page, {
    x: 50,
    y: 430,
    width: 200,
    height: 25,
    borderWidth: 1,
    borderColor: rgb(0, 0, 0),
  });

  page.drawText('Country:', {
    x: 50,
    y: 465,
    size: 12,
    font: font,
    color: rgb(0, 0, 0),
  });

  // Text area
  const commentsField = form.createTextField('comments');
  commentsField.setText('Enter your comments here...\nThis is a multi-line text area.\nYou can type multiple lines of text.');
  commentsField.addToPage(page, {
    x: 50,
    y: 350,
    width: 500,
    height: 60,
    borderWidth: 1,
    borderColor: rgb(0, 0, 0),
  });

  page.drawText('Comments:', {
    x: 50,
    y: 420,
    size: 12,
    font: font,
    color: rgb(0, 0, 0),
  });

  // Instructions
  page.drawText('Form Field Test Instructions:', {
    x: 50,
    y: 300,
    size: 16,
    font: boldFont,
    color: rgb(0, 0, 0),
  });

  const instructions = [
    '1. Click on text fields to edit them',
    '2. Click checkboxes to toggle them on/off',
    '3. Click radio buttons to select one option',
    '4. Click the dropdown to see country options',
    '5. Click in the text area to edit comments',
    '',
    'If fields are not clickable, try:',
    '- Opening in Adobe Acrobat Reader',
    '- Using a different PDF viewer',
    '- Checking if form fields are supported'
  ];

  instructions.forEach((instruction, index) => {
    page.drawText(instruction, {
      x: 50,
      y: 280 - (index * 15),
      size: 10,
      font: font,
      color: rgb(0, 0, 0),
    });
  });

  // Save the PDF
  const pdfBytes = await pdfDoc.save();
  fs.writeFileSync('acroform-test.pdf', pdfBytes);
  
  console.log('✅ Created acroform-test.pdf');
  console.log('');
  console.log('This PDF uses AcroForm fields which should be more compatible.');
  console.log('Test it in different PDF viewers:');
  console.log('- Adobe Acrobat Reader (best support)');
  console.log('- Chrome/Edge built-in PDF viewer');
  console.log('- Firefox PDF viewer');
  console.log('- Your Electron app PDF viewer');
}

createAcroFormPDF().catch(console.error);

