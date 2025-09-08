# 🧪 Form Filling Test Guide

## **Issue Diagnosis: "No form fields detected"**

The error message appears because the form filling system isn't detecting fields properly. Here's how to test and fix it:

## **Step 1: Load a Working PDF**

Use one of these PDFs that we know have form fields:

- `simple-fillable-form.pdf` (6 fields) ✅
- `fillable-contact-form.pdf` (10 fields) ✅
- `fillable-survey-form.pdf` (13 fields) ✅
- `acroform-test.pdf` (8 fields) ✅

**❌ Avoid:** `fillable-application-form.pdf` - This has form fields but may have detection issues

## **Step 2: Enable Form Filling**

1. Load a PDF in the viewer
2. Look for the **📄 (FileText) button** in the toolbar
3. Click it to enable form filling mode
4. The button should turn blue when active

## **Step 3: Check Console for Debug Info**

Open browser console (F12) and look for:

```
PDFViewer: Props received: {pdfBytes: 8659, darkMode: false, enableFormFilling: true, ...}
FormOverlay: Component rendered with pdfBytes: 8659
FormOverlay: Starting field detection...
FormOverlay: Found 6 form fields in PDF
```

## **Step 4: Expected Behavior**

When working correctly, you should see:

- Blue "Form Mode: X fields detected" indicator
- Form field overlays with labels
- "Save Form" button in top-right

## **Step 5: Troubleshooting**

### If you still see "No form fields detected":

1. **Check Console Errors**: Look for JavaScript errors in browser console
2. **Verify PDF Loading**: Make sure the PDF is fully loaded before enabling form filling
3. **Try Different PDF**: Use `simple-fillable-form.pdf` which is known to work
4. **Check Button State**: Ensure the 📄 button is blue (active)

### Common Issues:

- **PDF not loaded**: Wait for PDF to fully load before enabling form filling
- **JavaScript errors**: Check browser console for errors
- **Wrong PDF**: Some PDFs may not have detectable form fields
- **Timing issues**: Try disabling and re-enabling form filling

## **Step 6: Test Form Interaction**

Once form fields are detected:

1. Click on text input overlays to type
2. Click checkboxes to toggle them
3. Click dropdowns to select options
4. Click "Save Form" to download filled PDF

## **Debug Commands**

To test PDF form fields from command line:

```bash
node test-pdf-forms.js
```

This will show which PDFs have detectable form fields.
