# LLM Autofill Upgrade Plan

## Version 1.0 - Comprehensive Local LLM Integration

### 🎯 **Project Overview**

Upgrade InkFlow's autofill logic to use locally running open-source LLMs for intelligent field value suggestions from user profiles. This is a backend-only implementation with no UI/UX changes.

---

## 📊 **Implementation Phases**

### **Phase 1: Foundation & Dependencies** ⚡

**Timeline: Week 1-2**

#### 1.1 Package Dependencies

- [ ] Add `node-llama-cpp` dependency to package.json
- [ ] Add `electron-store` for encrypted user profile storage
- [ ] Update build scripts for platform-specific binaries
- [ ] Configure electron-builder for cross-platform deployment

#### 1.2 Project Structure

```
src/
├── main/
│   ├── llm-service.js          # NEW: LLM inference engine
│   ├── model-manager.js        # NEW: Model download & management
│   ├── autofill-engine.js      # NEW: Autofill logic coordinator
│   └── profile-manager.js      # NEW: User profile management
├── shared/
│   ├── models.json             # NEW: Model manifest
│   └── prompts.json            # NEW: System prompts
└── renderer/
    └── autofill-handler.js     # MODIFIED: LLM integration
```

---

### **Phase 2: LLM Service Implementation** 🧠

**Timeline: Week 3-4**

#### 2.1 Core LLM Service (`llm-service.js`)

```javascript
class LLMService {
  // Model loading & memory management
  async loadModel(modelPath, gpuLayers)
  async unloadModel()
  async generateSuggestion(context)

  // Performance monitoring
  getPerformanceMetrics()
  logLatency(operation, duration)
}
```

#### 2.2 Hardware Requirements

- [ ] Implement minimum hardware check (8GB RAM)
- [ ] GPU detection (NVIDIA/CUDA, Metal)
- [ ] Configurable GPU layer offloading
- [ ] Memory usage monitoring

#### 2.3 Performance Targets

- [ ] P95 latency < 3 seconds
- [ ] Idle timeout (30 min default)
- [ ] Resource cleanup on unload

---

### **Phase 3: Model Management System** 📦

**Timeline: Week 5-6**

#### 3.1 Model Manifest (`models.json`)

```json
{
  "models": [
    {
      "modelName": "LLaMA 3.2 8B Instruct (Fast)",
      "quantization": "Q4_K_M",
      "downloadUrl": "https://huggingface.co/...",
      "checksum": "sha256:...",
      "minRamGb": 8,
      "gpuRecommended": true
    }
  ]
}
```

#### 3.2 Model Manager (`model-manager.js`)

- [ ] Download manager with progress tracking
- [ ] Checksum verification
- [ ] Secure local storage
- [ ] Model versioning
- [ ] Update notifications

#### 3.3 Supported Models (Initial)

- [ ] LLaMA 3.2 8B (Q4_K_M, Q8_0)
- [ ] Phi-3 3.8B (Q4_K_M)
- [ ] Future: Multimodal models (LLaVA)

---

### **Phase 4: User Profile & Context System** 👤

**Timeline: Week 7-8**

#### 4.1 Profile Manager (`profile-manager.js`)

```javascript
class ProfileManager {
  // Encrypted storage
  async saveProfile(profileData)
  async loadProfile()

  // Context generation
  generateContext(fieldContext, systemContext)

  // Data categorization
  categorizeUserInput(input, fieldType)
}
```

#### 4.2 Context Structure

```javascript
{
  "user_profile": {
    "name": "John Doe",
    "address": { "street": "123 King St E", "city": "Oshawa" }
  },
  "system_context": {
    "current_date": "2025-01-03",
    "locale": "en-CA"
  },
  "field_context": {
    "field_type": "address",
    "field_name": "city"
  }
}
```

---

### **Phase 5: Prompt Engineering** 🎯

**Timeline: Week 9-10**

#### 5.1 System Prompts (`prompts.json`)

```json
{
  "autofill_system": "You are a silent, efficient autofill assistant...",
  "categorization": "Categorize this user input and save to profile...",
  "question_generation": "Generate a helpful question for missing data..."
}
```

#### 5.2 Response Format

```javascript
// Success case
{"suggestion": "Oshawa"}

// Need more info
{"question": "What is your city?"}

// No suggestion
{"suggestion": null}
```

#### 5.3 Prompt Templates

- [ ] Field-specific prompts
- [ ] Locale-aware suggestions
- [ ] Date field handling
- [ ] Address parsing

---

### **Phase 6: Integration & UI Behavior** 🔗

**Timeline: Week 11-12**

#### 6.1 Autofill Handler Updates

- [ ] LLM service integration
- [ ] Cursor state management
- [ ] Focus management
- [ ] Error handling

#### 6.2 Cursor States

```javascript
// Processing state
field.style.cursor = "wait";

// Interactive state (hovering suggestion)
suggestion.style.cursor = "pointer";

// Standard state
field.style.cursor = "text";
```

#### 6.3 Focus Management

- [ ] Caret positioning at end of inserted text
- [ ] No auto-advance to next field
- [ ] Maintain existing tab order

---

### **Phase 7: Testing & Optimization** 🧪

**Timeline: Week 13-14**

#### 7.1 Cross-Platform Testing

- [ ] Windows x64
- [ ] Windows ARM64
- [ ] macOS Intel
- [ ] macOS Apple Silicon

#### 7.2 Performance Testing

- [ ] Latency benchmarks
- [ ] Memory usage profiling
- [ ] GPU utilization monitoring
- [ ] Battery impact assessment

#### 7.3 Error Handling

- [ ] Model loading failures
- [ ] Network connectivity issues
- [ ] Invalid responses
- [ ] Hardware incompatibility

---

## 🔧 **Technical Specifications**

### **Dependencies**

```json
{
  "node-llama-cpp": "^2.0.0",
  "electron-store": "^8.0.0",
  "crypto": "built-in",
  "fs-extra": "^11.0.0"
}
```

### **Hardware Requirements**

- **Minimum**: 8GB RAM, 4-core CPU
- **Recommended**: 16GB RAM, 8-core CPU, GPU
- **Storage**: 4GB for models + 1GB for app

### **Performance Targets**

- **P95 Latency**: < 3 seconds
- **Memory Usage**: < 4GB for model
- **Idle Timeout**: 30 minutes (configurable)
- **GPU Layers**: 0-32 (configurable)

---

## 📁 **File Changes Summary**

### **New Files**

- `src/main/llm-service.js` - LLM inference engine
- `src/main/model-manager.js` - Model download & management
- `src/main/autofill-engine.js` - Autofill logic coordinator
- `src/main/profile-manager.js` - User profile management
- `src/shared/models.json` - Model manifest
- `src/shared/prompts.json` - System prompts
- `LLM_AUTOFILL_UPGRADE_PLAN.md` - This plan

### **Modified Files**

- `package.json` - Dependencies & build scripts
- `src/main/preload.js` - New IPC methods
- `src/main/main.js` - LLM service initialization
- `src/renderer/autofill-handler.js` - LLM integration

### **Build Configuration**

- `electron-builder` config for platform-specific binaries
- Cross-platform llama.cpp binary packaging
- Model download & verification scripts

---

## 🚀 **Deployment Strategy**

### **Version Control**

- Semantic versioning (v2.0.0 for major upgrade)
- Feature flags for gradual rollout
- Rollback capability for critical issues

### **User Migration**

- Automatic profile migration from existing system
- Model download on first launch
- Progressive enhancement (fallback to existing system)

### **Monitoring**

- Performance metrics collection
- Error rate monitoring
- User feedback integration

---

## 📈 **Success Metrics**

### **Performance**

- [ ] P95 suggestion latency < 3 seconds
- [ ] 99% uptime for LLM service
- [ ] < 5% error rate for suggestions

### **User Experience**

- [ ] No UI/UX changes (maintain existing design)
- [ ] Smooth cursor state transitions
- [ ] Accurate field suggestions (>90%)

### **Technical**

- [ ] Cross-platform compatibility
- [ ] Memory usage within limits
- [ ] Secure profile storage

---

## 🔄 **Version Tracking**

### **v2.0.0 - LLM Autofill Upgrade**

- **Status**: Planning Phase
- **Start Date**: 2025-01-03
- **Target Completion**: 2025-04-03 (14 weeks)
- **Current Phase**: Phase 1 - Foundation

### **Progress Tracking**

- [ ] Phase 1: Foundation & Dependencies
- [ ] Phase 2: LLM Service Implementation
- [ ] Phase 3: Model Management System
- [ ] Phase 4: User Profile & Context System
- [ ] Phase 5: Prompt Engineering
- [ ] Phase 6: Integration & UI Behavior
- [ ] Phase 7: Testing & Optimization

---

_This plan will be updated as implementation progresses. All changes will be tracked in version control with detailed commit messages._

