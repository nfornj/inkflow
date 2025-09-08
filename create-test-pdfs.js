const fs = require('fs');
const path = require('path');
const { PDFDocument, rgb, StandardFonts } = require('pdf-lib');

async function createTestPDFs() {
  console.log('Creating test PDFs with fillable forms...');

  // Test PDF 1: Simple Contact Form
  const contactFormPDF = await PDFDocument.create();
  const page1 = contactFormPDF.addPage([600, 800]);
  const font = await contactFormPDF.embedFont(StandardFonts.Helvetica);
  const boldFont = await contactFormPDF.embedFont(StandardFonts.HelveticaBold);

  // Title
  page1.drawText('Contact Information Form', {
    x: 50,
    y: 750,
    size: 20,
    font: boldFont,
    color: rgb(0, 0, 0),
  });

  // Form fields
  const fields = [
    { label: 'Full Name:', y: 700 },
    { label: 'Email Address:', y: 650 },
    { label: 'Phone Number:', y: 600 },
    { label: 'Company:', y: 550 },
    { label: 'Address:', y: 500 },
    { label: 'City:', y: 450 },
    { label: 'State/Province:', y: 400 },
    { label: 'Postal Code:', y: 350 },
    { label: 'Country:', y: 300 },
    { label: 'Comments:', y: 250 },
  ];

  fields.forEach(field => {
    page1.drawText(field.label, {
      x: 50,
      y: field.y,
      size: 12,
      font: font,
      color: rgb(0, 0, 0),
    });
    
    // Draw input field box
    page1.drawRectangle({
      x: 200,
      y: field.y - 5,
      width: 300,
      height: 20,
      borderColor: rgb(0, 0, 0),
      borderWidth: 1,
    });
  });

  // Save contact form
  const contactFormBytes = await contactFormPDF.save();
  fs.writeFileSync('test-contact-form.pdf', contactFormBytes);
  console.log('✅ Created test-contact-form.pdf');

  // Test PDF 2: Multi-page Invoice Form
  const invoicePDF = await PDFDocument.create();
  
  // Page 1 - Invoice Header
  const invoicePage1 = invoicePDF.addPage([600, 800]);
  invoicePage1.drawText('INVOICE', {
    x: 50,
    y: 750,
    size: 24,
    font: boldFont,
    color: rgb(0, 0, 0),
  });

  // Invoice fields
  const invoiceFields = [
    { label: 'Invoice Number:', y: 700 },
    { label: 'Date:', y: 670 },
    { label: 'Due Date:', y: 640 },
    { label: 'Bill To:', y: 600 },
    { label: 'Company Name:', y: 570 },
    { label: 'Address:', y: 540 },
    { label: 'City, State ZIP:', y: 510 },
    { label: 'Phone:', y: 480 },
    { label: 'Email:', y: 450 },
  ];

  invoiceFields.forEach(field => {
    invoicePage1.drawText(field.label, {
      x: 50,
      y: field.y,
      size: 12,
      font: font,
      color: rgb(0, 0, 0),
    });
    
    invoicePage1.drawRectangle({
      x: 200,
      y: field.y - 5,
      width: 300,
      height: 20,
      borderColor: rgb(0, 0, 0),
      borderWidth: 1,
    });
  });

  // Page 2 - Invoice Items
  const invoicePage2 = invoicePDF.addPage([600, 800]);
  invoicePage2.drawText('Invoice Items', {
    x: 50,
    y: 750,
    size: 18,
    font: boldFont,
    color: rgb(0, 0, 0),
  });

  // Item fields
  const itemFields = [
    { label: 'Description:', y: 700 },
    { label: 'Quantity:', y: 650 },
    { label: 'Unit Price:', y: 600 },
    { label: 'Total:', y: 550 },
    { label: 'Tax Rate (%):', y: 500 },
    { label: 'Tax Amount:', y: 450 },
    { label: 'Subtotal:', y: 400 },
    { label: 'Total Amount:', y: 350 },
  ];

  itemFields.forEach(field => {
    invoicePage2.drawText(field.label, {
      x: 50,
      y: field.y,
      size: 12,
      font: font,
      color: rgb(0, 0, 0),
    });
    
    invoicePage2.drawRectangle({
      x: 200,
      y: field.y - 5,
      width: 300,
      height: 20,
      borderColor: rgb(0, 0, 0),
      borderWidth: 1,
    });
  });

  // Save invoice form
  const invoiceBytes = await invoicePDF.save();
  fs.writeFileSync('test-invoice-form.pdf', invoiceBytes);
  console.log('✅ Created test-invoice-form.pdf');

  // Test PDF 3: Application Form with Multiple Sections
  const applicationPDF = await PDFDocument.create();
  const appPage = applicationPDF.addPage([600, 800]);

  appPage.drawText('Job Application Form', {
    x: 50,
    y: 750,
    size: 20,
    font: boldFont,
    color: rgb(0, 0, 0),
  });

  // Personal Information Section
  appPage.drawText('Personal Information', {
    x: 50,
    y: 700,
    size: 16,
    font: boldFont,
    color: rgb(0.2, 0.2, 0.8),
  });

  const personalFields = [
    { label: 'First Name:', y: 670 },
    { label: 'Last Name:', y: 640 },
    { label: 'Middle Initial:', y: 610 },
    { label: 'Date of Birth:', y: 580 },
    { label: 'Social Security Number:', y: 550 },
    { label: 'Phone Number:', y: 520 },
    { label: 'Email Address:', y: 490 },
  ];

  personalFields.forEach(field => {
    appPage.drawText(field.label, {
      x: 50,
      y: field.y,
      size: 11,
      font: font,
      color: rgb(0, 0, 0),
    });
    
    appPage.drawRectangle({
      x: 200,
      y: field.y - 5,
      width: 300,
      height: 18,
      borderColor: rgb(0, 0, 0),
      borderWidth: 1,
    });
  });

  // Employment Section
  appPage.drawText('Employment Information', {
    x: 50,
    y: 450,
    size: 16,
    font: boldFont,
    color: rgb(0.2, 0.2, 0.8),
  });

  const employmentFields = [
    { label: 'Position Applied For:', y: 420 },
    { label: 'Desired Salary:', y: 390 },
    { label: 'Available Start Date:', y: 360 },
    { label: 'Previous Company:', y: 330 },
    { label: 'Years of Experience:', y: 300 },
  ];

  employmentFields.forEach(field => {
    appPage.drawText(field.label, {
      x: 50,
      y: field.y,
      size: 11,
      font: font,
      color: rgb(0, 0, 0),
    });
    
    appPage.drawRectangle({
      x: 200,
      y: field.y - 5,
      width: 300,
      height: 18,
      borderColor: rgb(0, 0, 0),
      borderWidth: 1,
    });
  });

  // Emergency Contact Section
  appPage.drawText('Emergency Contact', {
    x: 50,
    y: 250,
    size: 16,
    font: boldFont,
    color: rgb(0.2, 0.2, 0.8),
  });

  const emergencyFields = [
    { label: 'Contact Name:', y: 220 },
    { label: 'Relationship:', y: 190 },
    { label: 'Phone Number:', y: 160 },
    { label: 'Address:', y: 130 },
  ];

  emergencyFields.forEach(field => {
    appPage.drawText(field.label, {
      x: 50,
      y: field.y,
      size: 11,
      font: font,
      color: rgb(0, 0, 0),
    });
    
    appPage.drawRectangle({
      x: 200,
      y: field.y - 5,
      width: 300,
      height: 18,
      borderColor: rgb(0, 0, 0),
      borderWidth: 1,
    });
  });

  // Save application form
  const applicationBytes = await applicationPDF.save();
  fs.writeFileSync('test-application-form.pdf', applicationBytes);
  console.log('✅ Created test-application-form.pdf');

  // Test PDF 4: Survey Form with Checkboxes and Radio Buttons
  const surveyPDF = await PDFDocument.create();
  const surveyPage = surveyPDF.addPage([600, 800]);

  surveyPage.drawText('Customer Satisfaction Survey', {
    x: 50,
    y: 750,
    size: 20,
    font: boldFont,
    color: rgb(0, 0, 0),
  });

  // Rating questions
  const ratingQuestions = [
    { question: 'How would you rate our service?', y: 700 },
    { question: 'How likely are you to recommend us?', y: 650 },
    { question: 'How satisfied are you with our product?', y: 600 },
    { question: 'How was your overall experience?', y: 550 },
  ];

  ratingQuestions.forEach((q, index) => {
    surveyPage.drawText(q.question, {
      x: 50,
      y: q.y,
      size: 12,
      font: font,
      color: rgb(0, 0, 0),
    });

    // Draw rating scale 1-5
    for (let i = 1; i <= 5; i++) {
      surveyPage.drawText(`${i}`, {
        x: 200 + (i - 1) * 50,
        y: q.y - 25,
        size: 10,
        font: font,
        color: rgb(0, 0, 0),
      });
      
      surveyPage.drawRectangle({
        x: 195 + (i - 1) * 50,
        y: q.y - 30,
        width: 15,
        height: 15,
        borderColor: rgb(0, 0, 0),
        borderWidth: 1,
      });
    }
  });

  // Open-ended questions
  const openQuestions = [
    { question: 'What did you like most about our service?', y: 450 },
    { question: 'What could we improve?', y: 400 },
    { question: 'Additional comments:', y: 350 },
  ];

  openQuestions.forEach(q => {
    surveyPage.drawText(q.question, {
      x: 50,
      y: q.y,
      size: 12,
      font: font,
      color: rgb(0, 0, 0),
    });
    
    surveyPage.drawRectangle({
      x: 50,
      y: q.y - 30,
      width: 500,
      height: 60,
      borderColor: rgb(0, 0, 0),
      borderWidth: 1,
    });
  });

  // Contact information
  surveyPage.drawText('Contact Information (Optional)', {
    x: 50,
    y: 280,
    size: 14,
    font: boldFont,
    color: rgb(0.2, 0.2, 0.8),
  });

  const contactFields = [
    { label: 'Name:', y: 250 },
    { label: 'Email:', y: 220 },
    { label: 'Phone:', y: 190 },
  ];

  contactFields.forEach(field => {
    surveyPage.drawText(field.label, {
      x: 50,
      y: field.y,
      size: 11,
      font: font,
      color: rgb(0, 0, 0),
    });
    
    surveyPage.drawRectangle({
      x: 200,
      y: field.y - 5,
      width: 300,
      height: 18,
      borderColor: rgb(0, 0, 0),
      borderWidth: 1,
    });
  });

  // Save survey form
  const surveyBytes = await surveyPDF.save();
  fs.writeFileSync('test-survey-form.pdf', surveyBytes);
  console.log('✅ Created test-survey-form.pdf');

  // Test PDF 5: Multi-page Document with Mixed Content
  const mixedPDF = await PDFDocument.create();
  
  // Page 1 - Title page
  const titlePage = mixedPDF.addPage([600, 800]);
  titlePage.drawText('Test Document', {
    x: 200,
    y: 400,
    size: 32,
    font: boldFont,
    color: rgb(0, 0, 0),
  });
  titlePage.drawText('Multi-page PDF with various content types', {
    x: 150,
    y: 350,
    size: 16,
    font: font,
    color: rgb(0.3, 0.3, 0.3),
  });

  // Page 2 - Form page
  const formPage = mixedPDF.addPage([600, 800]);
  formPage.drawText('Registration Form', {
    x: 50,
    y: 750,
    size: 20,
    font: boldFont,
    color: rgb(0, 0, 0),
  });

  const regFields = [
    { label: 'Username:', y: 700 },
    { label: 'Password:', y: 650 },
    { label: 'Confirm Password:', y: 600 },
    { label: 'First Name:', y: 550 },
    { label: 'Last Name:', y: 500 },
    { label: 'Email:', y: 450 },
    { label: 'Phone:', y: 400 },
    { label: 'Date of Birth:', y: 350 },
    { label: 'Gender:', y: 300 },
    { label: 'Country:', y: 250 },
    { label: 'Terms and Conditions:', y: 200 },
  ];

  regFields.forEach(field => {
    formPage.drawText(field.label, {
      x: 50,
      y: field.y,
      size: 12,
      font: font,
      color: rgb(0, 0, 0),
    });
    
    formPage.drawRectangle({
      x: 200,
      y: field.y - 5,
      width: 300,
      height: 20,
      borderColor: rgb(0, 0, 0),
      borderWidth: 1,
    });
  });

  // Page 3 - Content page
  const contentPage = mixedPDF.addPage([600, 800]);
  contentPage.drawText('Document Content', {
    x: 50,
    y: 750,
    size: 20,
    font: boldFont,
    color: rgb(0, 0, 0),
  });

  const content = [
    'This is a test document with multiple pages.',
    'It contains various types of content including:',
    '• Text paragraphs',
    '• Form fields',
    '• Different page layouts',
    '• Mixed content types',
    '',
    'This page demonstrates regular text content',
    'without form fields, which is useful for testing',
    'PDF viewing and scrolling functionality.',
    '',
    'The document should scroll properly between pages',
    'and display correctly in both light and dark modes.',
    '',
    'Additional content to make the page longer:',
    'Lorem ipsum dolor sit amet, consectetur adipiscing elit.',
    'Sed do eiusmod tempor incididunt ut labore et dolore magna aliqua.',
    'Ut enim ad minim veniam, quis nostrud exercitation ullamco.',
    'Laboris nisi ut aliquip ex ea commodo consequat.',
    'Duis aute irure dolor in reprehenderit in voluptate velit.',
    'Esse cillum dolore eu fugiat nulla pariatur.',
    'Excepteur sint occaecat cupidatat non proident.',
    'Sunt in culpa qui officia deserunt mollit anim id est laborum.',
  ];

  content.forEach((line, index) => {
    contentPage.drawText(line, {
      x: 50,
      y: 700 - (index * 20),
      size: 12,
      font: font,
      color: rgb(0, 0, 0),
    });
  });

  // Save mixed content PDF
  const mixedBytes = await mixedPDF.save();
  fs.writeFileSync('test-mixed-content.pdf', mixedBytes);
  console.log('✅ Created test-mixed-content.pdf');

  console.log('\n🎉 All test PDFs created successfully!');
  console.log('\nCreated files:');
  console.log('• test-contact-form.pdf - Simple contact information form');
  console.log('• test-invoice-form.pdf - Multi-page invoice with billing fields');
  console.log('• test-application-form.pdf - Job application with multiple sections');
  console.log('• test-survey-form.pdf - Customer survey with rating scales');
  console.log('• test-mixed-content.pdf - Multi-page document with mixed content');
  console.log('\nThese PDFs are perfect for testing:');
  console.log('• PDF viewing and scrolling functionality');
  console.log('• Dark mode theming');
  console.log('• Multi-page navigation');
  console.log('• Form field rendering');
  console.log('• Different content types and layouts');
}

createTestPDFs().catch(console.error);
