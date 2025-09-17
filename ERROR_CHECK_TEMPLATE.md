# Error-Free Development Checklist

_Use this template to ensure code runs without errors after changes_

## 🔍 **Pre-Development Checks**

### **1. Start Clean**

```bash
# Check current status
npm run build           # Should complete successfully
npm test               # Should pass all tests
npm run lint           # Should show no errors (if available)
cd frontend && npm run build  # Frontend should compile
```

### **2. Review Recent Changes**

- [ ] Check recent commits for any broken functionality
- [ ] Verify no TODO or FIXME comments were left unresolved
- [ ] Ensure no temporary debug code remains

---

## ⚡ **During Development**

### **3. Incremental Testing**

After each significant change:

```bash
# Quick validation
npm run build          # Compilation check
# Test the specific functionality you changed
# Check browser console for errors
# Verify no new TypeScript/ESLint errors
```

### **4. Error Handling Standards**

```javascript
// ✅ Good: Proper async error handling
try {
  const result = await someAsyncOperation();
  return { success: true, data: result };
} catch (error) {
  console.error("Operation failed:", error);
  return { success: false, error: error.message };
}

// ❌ Bad: Unhandled async operation
const result = await someAsyncOperation(); // Could throw uncaught error
```

### **5. TypeScript Compliance**

```typescript
// ✅ Good: Proper typing
interface ProcessResult {
  success: boolean;
  data?: any;
  error?: string;
}

// ❌ Bad: Using 'any' without justification
function process(input: any): any { ... }
```

---

## 📋 **Pre-Commit Validation**

### **6. Comprehensive Testing**

```bash
# Full validation sequence
echo "🧹 Cleaning temporary files..."
find . -name "temp-*" -type f -delete
find . -name "*-temp.*" -type f -delete

echo "🔨 Building project..."
npm run build
if [ $? -ne 0 ]; then echo "❌ Build failed"; exit 1; fi

echo "🧪 Running tests..."
npm test
if [ $? -ne 0 ]; then echo "❌ Tests failed"; exit 1; fi

echo "📄 Testing PDFs..."
# Create and run temp-test-validation.js
# Test with sample PDFs from test-pdfs/
# Delete temp test script

echo "🎯 Frontend validation..."
cd frontend
npm run build
if [ $? -ne 0 ]; then echo "❌ Frontend build failed"; exit 1; fi
cd ..

echo "✅ All checks passed!"
```

### **7. Error Monitoring Checklist**

- [ ] Browser console shows no errors
- [ ] Node.js console shows no unhandled promises
- [ ] All async operations have error handling
- [ ] TypeScript compiler shows no errors
- [ ] ESLint shows no errors (if configured)
- [ ] Basic app functionality works (PDF upload, processing, etc.)

---

## 🚨 **Common Error Categories to Check**

### **8. Runtime Errors**

- Uncaught TypeError (usually undefined/null access)
- Unhandled Promise rejections
- Network errors (API calls, file loading)
- File system errors (PDF processing, temp files)

### **9. Build Errors**

- TypeScript compilation errors
- Missing imports/exports
- Dependency resolution issues
- Asset loading problems

### **10. Logic Errors**

- PDF processing failures
- Form detection not working
- IPC communication issues
- LLM/OCR service errors

---

## 🛠️ **Quick Fix Commands**

### **11. Emergency Error Fixes**

```bash
# TypeScript errors
npx tsc --noEmit                    # Check TypeScript only
npx tsc --noEmit --skipLibCheck     # Skip library checks

# Dependency issues
npm install                         # Reinstall dependencies
rm -rf node_modules && npm install  # Clean reinstall

# Frontend issues
cd frontend
rm -rf node_modules build
npm install && npm run build
cd ..

# Clear electron cache
rm -rf ~/.cache/electron
```

---

## 📝 **Error Documentation**

### **12. When Errors Occur**

Document in DEVELOPMENT_CHANGELOG.md:

```markdown
### **Error Fix - [Issue Description]**

**Time**: [timestamp]
**Error**: [specific error message]
**Cause**: [root cause identified]
**Fix**: [solution applied]
**Prevention**: [steps to avoid in future]
```

---

_This checklist ensures code runs error-free after every development change._
