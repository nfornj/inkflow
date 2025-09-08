# Form Filling Test Guide

## 🧪 **Testing Form Filling Functionality**

### **Step 1: Load a Fillable PDF**

1. Open the Electron app
2. Click "Open File" and select one of these test PDFs:
   - `simple-fillable-form.pdf` (6 fields)
   - `fillable-contact-form.pdf` (10 fields)
   - `fillable-survey-form.pdf` (13 fields)

### **Step 2: Enable Form Filling**

1. Look for the **📄 (FileText) button** in the toolbar next to the dark mode toggle
2. Click it to enable form filling mode
3. You should see:
   - A blue "Form Mode: X fields detected" indicator in the top-left
   - Form field overlays with labels appearing on the PDF
   - A "Save Form" button in the top-right

### **Step 3: Test Form Interaction**

1. **Text Fields**: Click on text input overlays and type values
2. **Checkboxes**: Click on checkbox overlays to toggle them
3. **Dropdowns**: Click on dropdown overlays to select options
4. **Radio Buttons**: Click on radio button overlays to select them

### **Step 4: Save the Form**

1. Fill out some form fields
2. Click the "Save Form" button
3. A filled PDF should be downloaded to your Downloads folder
4. The filename will be `filled_[original-filename].pdf`

### **Expected Behavior**

- ✅ Form fields should be visible as blue-bordered overlays
- ✅ Each field should have a label showing the field name
- ✅ You should be able to type in text fields
- ✅ Checkboxes should toggle when clicked
- ✅ Dropdowns should show options when clicked
- ✅ Form data should be saved to the PDF and downloaded

### **Debugging**

If form filling isn't working:

1. Check the browser console (F12) for error messages
2. Look for "Form Mode: X fields detected" indicator
3. Check if the PDF actually contains form fields using: `node test-pdf-forms.js`

### **Known Issues**

- Form field positioning is approximate (not pixel-perfect)
- Some PDFs may not have accessible position information
- Form fields are positioned based on field name patterns

### **Test PDFs Available**

- `simple-fillable-form.pdf` - Basic form with 6 fields
- `fillable-contact-form.pdf` - Contact form with 10 fields
- `fillable-survey-form.pdf` - Survey form with 13 fields
- `acroform-test.pdf` - Advanced form with 8 fields
