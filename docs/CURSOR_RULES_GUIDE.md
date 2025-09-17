# Cursor Rules Guide for InkFlow

## 📋 Overview

The `.cursorrules` file has been added to ensure consistent development practices and automatic cleanup of temporary files during development and testing.

## 🎯 **Key Rule: Automatic Cleanup**

**The most important rule**: When testing something, if you create a new file, **DELETE** the files you created afterwards unless specifically asked to keep them.

### Examples of Auto-Delete Files:

```bash
# Testing files - always delete after use
temp-form-test.pdf
test-llm-response.json
debug-autofill.log
sample-user-data.json

# Naming patterns that trigger auto-cleanup
temp-*
test-*
debug-*
*-temp.*
*-test.*
```

## 🔧 How It Works

### During Development:

1. **Create** temporary files with clear prefixes: `temp-`, `test-`, `debug-`
2. **Test** functionality using these files
3. **Validate** that everything works as expected
4. **DELETE** all temporary files immediately after testing
5. **Only keep** files when user explicitly requests it

### Cursor AI Assistant Benefits:

- ✅ **Automatic cleanup** of test files
- ✅ **Consistent patterns** across development sessions
- ✅ **Clean repository** without temporary clutter
- ✅ **Professional practices** following InkFlow standards

## 📁 File Organization Guidelines

### Proper Directories:

```
src/main/          → Backend modules
frontend/src/      → React components
docs/             → Documentation
src/test/         → Permanent test files
```

### ❌ Don't Create Files In:

- Root directory (unless core project files)
- Random locations without purpose
- Nested temporary structures

## 🚀 InkFlow Specific Practices

### LLM Development:

- Use existing: `llm-service.js`, `llm-service-ollama.js`
- Test with temporary prompts: `temp-prompt-test.json`
- Delete test files after validation

### PDF Processing:

- Use: `pdf-processor.js`, `pdf-finalizer.js`
- Create test PDFs: `temp-form-test.pdf`
- Remove after testing completion

### React Components:

- Follow patterns from `components/`
- Test with temporary data: `temp-component-data.json`
- Clean up test artifacts

## 📊 Benefits

### For Development:

- 🧹 **Clean codebase** - no leftover test files
- 🚀 **Faster navigation** - less file clutter
- 📝 **Better git history** - only meaningful changes
- 🔄 **Consistent workflow** - established patterns

### For Collaboration:

- 👥 **Team consistency** - everyone follows same rules
- 📚 **Easy onboarding** - clear guidelines
- 🔍 **Code reviews** - focus on actual changes
- 🎯 **Quality assurance** - automatic cleanup

## 🎯 Usage Examples

### Good Practice:

```bash
# Create temporary test file
echo "test data" > temp-user-profile.json

# Test functionality
npm test -- --testNamePattern="profile"

# Validate results
echo "Tests passed ✅"

# Clean up immediately
rm temp-user-profile.json
```

### Bad Practice:

```bash
# Create test file
echo "test data" > user-profile-test.json

# Test functionality
npm test

# Leave file behind ❌ (violates rules)
```

## 📋 Checklist Before Each Session End

- [ ] All `temp-*` files deleted
- [ ] All `test-*` files removed (unless permanent tests)
- [ ] All `debug-*` logs cleaned up
- [ ] No random files left in root directory
- [ ] Repository is clean for next development session

---

**Remember**: The `.cursorrules` file ensures that Cursor AI will automatically follow these practices, keeping your InkFlow development environment clean and professional! 🎉
