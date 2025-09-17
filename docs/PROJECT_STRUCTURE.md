# InkFlow Project Structure

## 📁 Root Directory

```
inkflow/
├── 📄 main.js                 # Electron main process
├── 📄 preload.js              # IPC communication bridge
├── 📄 package.json            # Main dependencies & scripts
├── 📄 README.md               # Project overview & setup
├── 📄 babel.config.js         # Babel configuration for tests
├── 📄 jest.config.js          # Jest testing configuration
├── 🖼️ inkflow.png             # Application icon
├── 📄 eng.traineddata         # Tesseract OCR English language data
└── 📄 .gitignore              # Git ignore rules
```

## 📂 Documentation (`docs/`)

Organized documentation and development history:

```
docs/
├── 📄 PROJECT_STRUCTURE.md           # This file - project organization
├── 📄 LLM_AUTOFILL_UPGRADE_PLAN.md   # v2.0.0 upgrade roadmap
├── 📄 VERSION_TRACKING.md            # Version history and features
├── 📄 LLAMA_IMPLEMENTATION.md        # Local LLM integration guide
├── 📄 GLOBAL_SUPPORT_SUMMARY.md      # International localization
├── 📄 GOOGLE_ADK_MERMAID_DIAGRAM.md  # System architecture diagrams
└── development-phases/               # Development phase summaries
    ├── 📄 PHASE1_SUMMARY.md
    ├── 📄 PHASE2_SUMMARY.md
    ├── 📄 PHASE3_SUMMARY.md
    ├── 📄 PHASE4_SUMMARY.md
    ├── 📄 PHASE5_SUMMARY.md
    ├── 📄 PHASE6_SUMMARY.md
    └── 📄 PHASE7_SUMMARY.md
```

## 📂 Source Code (`src/`)

Backend logic and core functionality:

```
src/
├── main/                           # Electron main process modules
│   ├── 🔧 autofill-engine.js         # Core autofill logic engine
│   ├── 🔧 llm-service.js             # Primary LLM service (node-llama-cpp)
│   ├── 🔧 llm-service-ollama.js      # Ollama-based LLM service
│   ├── 🔧 llm-provider-manager.js    # LLM provider management
│   ├── 📁 llm-providers/            # Individual LLM provider implementations
│   │   ├── 🔧 llama-provider.js
│   │   ├── 🔧 minicpm-provider.js
│   │   └── 🔧 ollama-provider.js
│   ├── 🔧 model-manager.js           # GGUF model download & management
│   ├── 🔧 performance-monitor.js     # Performance tracking & optimization
│   ├── 🔧 profile-manager.js         # User profile encryption & storage
│   ├── 🔧 context-generator.js       # LLM context creation
│   ├── 🔧 prompt-manager.js          # LLM prompt templating
│   ├── 🔧 hardware-detector.js       # System hardware detection
│   ├── 🔧 download-manager.js        # Model download with progress
│   ├── 📄 pdf-processor.js          # PDF OCR & text extraction
│   ├── 📄 pdf-finalizer.js          # PDF form data burning
│   ├── 🔍 form-detector.js          # Multi-modal form detection
│   ├── 🔍 acroform-detector.js      # AcroForm field detection
│   ├── 🔍 visual-detector.js        # Visual form field detection
│   ├── 🔍 layout-analyzer.js        # Page layout analysis
│   ├── 🔍 llm-form-analyzer.js      # LLM-powered form analysis
│   └── 🔍 semantic-validator.js     # Semantic field validation
├── shared/                         # Shared configuration
│   ├── 📄 models.json               # LLM model definitions
│   └── 📄 prompts.json              # LLM prompt templates
└── test/                          # Test suites
    ├── 🧪 autofill-engine.test.js   # Unit tests for autofill engine
    ├── 🧪 prompt-manager.test.js    # Unit tests for prompt manager
    ├── 🧪 integration.test.js       # Integration tests
    ├── 🧪 performance.test.js       # Performance benchmarks
    ├── 🧪 cross-platform.test.js    # Cross-platform compatibility
    ├── ⚙️ setup.js                  # Test environment setup
    ├── ⚙️ global-setup.js           # Global test setup
    └── ⚙️ global-teardown.js        # Global test cleanup
```

## 📂 Frontend (`frontend/`)

React-based user interface:

```
frontend/
├── 📄 package.json              # Frontend dependencies
├── 📄 tsconfig.json             # TypeScript configuration
├── 📄 README.md                 # Frontend development guide
├── 📁 public/                   # Static assets
│   ├── 📄 index.html
│   ├── 🖼️ favicon.ico
│   ├── 🖼️ logo192.png
│   ├── 🖼️ logo512.png
│   ├── 📄 manifest.json
│   ├── 📄 pdf.worker.min.js     # PDF.js worker
│   ├── 📁 images/               # UI icons and graphics
│   └── 📁 standard_fonts/       # PDF rendering fonts
├── 📁 src/                      # React source code
│   ├── 📄 App.tsx               # Main React component
│   ├── 📄 index.tsx             # React entry point
│   ├── 📄 App.css               # Main application styles
│   ├── 📄 index.css             # Global styles
│   ├── 📁 components/           # Reusable React components
│   │   ├── 🎨 BrowserView.tsx   # Web browser interface
│   │   ├── 🎨 PDFViewer.tsx     # PDF display component
│   │   ├── 🎨 TabManager.tsx    # Tab management
│   │   ├── 🎨 AIAssistant.tsx   # AI chat interface
│   │   ├── 🎨 FormFiller.tsx    # Form filling interface
│   │   └── 🎨 [Other components]
│   ├── 📁 hooks/                # React hooks
│   │   ├── 🪝 useLLMAutofill.ts     # LLM autofill integration
│   │   ├── 🪝 useLLMFormProcessor.ts # LLM form processing
│   │   └── 🪝 usePDFFormProcessor.ts # PDF form handling
│   ├── 📁 utils/                # Utility functions
│   │   ├── 🔧 formDetection.ts      # Form field detection
│   │   ├── 🔧 formFieldDetector.ts  # Advanced field detection
│   │   ├── 🔧 pdfTextExtractor.ts   # PDF text extraction
│   │   ├── 🔧 advancedFormFilling.ts # Smart form filling
│   │   └── 🔧 todoGenerator.ts      # Task management
│   ├── 📁 editor/               # PDF editing functionality
│   │   ├── 📄 NewPdfEditor.tsx  # PDF editor component
│   │   └── 📁 detect/           # Detection utilities
│   └── 📁 types/                # TypeScript definitions
│       └── 📄 electron.d.ts     # Electron API types
└── 📁 build/                    # Production build output (generated)
```

## 🔧 Key Technologies

### **Core Stack**

- **Electron**: Desktop application framework
- **React + TypeScript**: Frontend UI framework
- **Node.js**: Backend runtime
- **Chromium BrowserView**: Embedded web browser

### **LLM Integration**

- **node-llama-cpp**: Local LLM inference
- **Ollama**: Alternative LLM runtime
- **GGUF Models**: Quantized model format

### **PDF Processing**

- **pdf.js**: PDF rendering and display
- **pdf-lib**: PDF manipulation and form handling
- **Tesseract.js**: OCR text extraction

### **UI Libraries**

- **Radix UI Icons**: Icon components
- **Custom CSS**: Styling and themes

## 🚀 Development Workflow

### **Development Commands**

```bash
# Install dependencies
npm install

# Development mode (React + Electron)
npm run dev

# Build React frontend
npm run build

# Package Electron application
npm run build:electron

# Run tests
npm test
npm run test:coverage
```

### **File Organization Principles**

1. **Separation of Concerns**: Clear separation between frontend (React) and backend (Electron main process)
2. **Modular Architecture**: Individual modules for different functionalities
3. **Test Coverage**: Comprehensive test suites with >80% coverage
4. **Documentation**: Well-documented APIs and implementation guides
5. **Configuration Management**: Centralized configuration files

## 📊 Project Statistics

- **Languages**: TypeScript, JavaScript, CSS
- **Total Modules**: 50+ individual files
- **Test Coverage**: >80% for core modules
- **Cross-Platform**: Windows, macOS, Linux support
- **Architecture**: Multi-process (main + renderer)

## 🔒 Security Features

- **Context Isolation**: Renderer process isolation
- **IPC Communication**: Secure inter-process communication
- **Web Security**: Configurable web security policies
- **Encrypted Storage**: User profile encryption
- **Local Processing**: No external API dependencies for LLM

This structure provides a clean, maintainable, and scalable foundation for the InkFlow application.
