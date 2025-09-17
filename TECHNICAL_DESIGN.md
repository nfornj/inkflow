# InkFlow Technical Design

_Single source of truth for current architecture - Always updated, no versions_

**Last Updated**: September 16, 2025 - Post AcroForm/PDF.js removal simplification

---

## 🏗️ **Current Architecture Overview**

### **High-Level System Design**

```mermaid
graph TB
    subgraph User_Interface [User Interface Layer]
        A[React Frontend] --> B[Unified Content Viewer]
        B --> C[PDF Form Overlay]
        C --> D[Form Field Editor]
    end

    subgraph Electron_Main [Electron Main Process]
        E[Main Process] --> F[BrowserView Manager]
        F --> G[IPC Handler]
        G --> H[PDF Processor]
        H --> I[Form Detector]
        I --> J[LLM Service]
    end

    subgraph Processing_Pipeline [Processing Pipeline]
        K[OCR Engine] --> L[AI Analysis]
        L --> M[Field Detection]
        M --> N[Form Overlay]
    end

    subgraph Native_Rendering [Native Chromium Rendering]
        O[Chromium BrowserView]
        P[Native PDF Plugin]
        Q[Native Form Controls]
    end

    A --> G
    F --> O
    O --> P
    P --> Q
    H --> K
    N --> D
```

---

## 📄 **PDF Processing Workflow**

### **Simplified Post-Removal Architecture**

```mermaid
sequenceDiagram
    participant U as User
    participant R as React Frontend
    participant E as Electron Main
    participant B as BrowserView
    participant O as OCR Engine
    participant L as LLM Service

    U->>R: Upload PDF
    R->>E: loadPdfData() via IPC
    E->>E: Save to temp file
    E->>B: Load PDF in BrowserView
    B->>B: Native Chromium PDF rendering
    B->>U: Display PDF with native controls

    Note over U,R: Optional: AI-powered analysis
    U->>R: Trigger Form Analysis
    R->>E: pdfProcessorAnalyze() via IPC
    E->>O: Extract text via OCR (Tesseract)
    O->>L: Analyze with LLM (Llama)
    L->>E: Return detected fields
    E->>R: Form field data
    R->>U: Display form overlay for insights
```

---

## 🔄 **Data Flow Architecture**

### **Current Processing Pipeline**

```mermaid
flowchart LR
    subgraph Input [PDF Input]
        A[User Upload] --> B[PDF Bytes]
        B --> C[Temp File]
    end

    subgraph Native_Display [Native Display]
        C --> D[Chromium BrowserView]
        D --> E[Native PDF Viewer]
        E --> F[Native Form Controls]
    end

    subgraph AI_Analysis [AI Analysis - Optional]
        C --> G[PDF-to-Image]
        G --> H[OCR Processing]
        H --> I[Text Extraction]
        I --> J[LLM Analysis]
        J --> K[Field Detection]
    end

    subgraph Output [User Interaction]
        F --> L[Direct Form Filling]
        K --> M[AI Insights Overlay]
        M --> N[Enhanced Form Editing]
        L --> O[Save/Export]
        N --> O
    end

    style D fill:#4285f4,color:#fff
    style H fill:#34a853,color:#fff
    style J fill:#ea4335,color:#fff
```

---

## 🧠 **LLM Integration Architecture**

### **Local AI Processing**

```mermaid
graph TB
    subgraph LLM_Stack [Local LLM Stack]
        A[Ollama Runtime] --> B[Llama 3.2 Model]
        B --> C[LLM Service]
        C --> D[Prompt Manager]
        D --> E[Context Generator]
    end

    subgraph Processing_Flow [Processing Flow]
        F[PDF Text] --> G[Context Generation]
        G --> H[Prompt Construction]
        H --> I[LLM Inference]
        I --> J[Response Parsing]
        J --> K[Field Mapping]
    end

    subgraph Performance [Performance Monitoring]
        L[Hardware Detector]
        M[Performance Monitor]
        N[Model Manager]
    end

    E --> G
    C --> I
    L --> C
    M --> C
    N --> B
```

---

## 📱 **Component Architecture**

### **Frontend Component Hierarchy**

```mermaid
graph TD
    A[App.tsx] --> B[UnifiedContentViewer]
    A --> C[FormTodoList]
    A --> D[LLMProviderSettings]

    B --> E[BrowserView Integration]
    B --> F[PDF Detection]

    A --> G[UnifiedPDFEditor]
    G --> H[EnhancedFormOverlay]
    H --> I[Form Field Rendering]
    H --> J[AI-powered Insights]

    A --> K[React Hooks]
    K --> L[usePDFFormProcessor]
    K --> M[useLLMFormProcessor]
    K --> N[useLLMAutofill]
```

---

## 🔌 **IPC Communication Design**

### **Main ↔ Renderer Communication**

```mermaid
sequenceDiagram
    participant R as Renderer Process
    participant P as Preload Script
    participant M as Main Process
    participant S as Services

    Note over R,P: Frontend API Calls
    R->>P: electronAPI.loadPdfData()
    P->>M: ipcRenderer.invoke('load-pdf-data')
    M->>M: Save PDF, create BrowserView
    M->>R: Return success/browserId

    Note over R,S: AI Processing
    R->>P: electronAPI.pdfProcessorAnalyze()
    P->>M: ipcRenderer.invoke('analyze-pdf-multimodal')
    M->>S: FormDetector.detectFormFields()
    S->>S: OCR + LLM Processing
    S->>M: Form field results
    M->>R: Structured field data
```

---

## 🎯 **Next Architecture Evolution**

### **Planned Enhancements**

```mermaid
graph TB
    subgraph Current [Current State]
        A[Chromium Native PDF]
        B[Tesseract OCR]
        C[Llama 3.2 LLM]
        D[Manual Form Editing]
    end

    subgraph Planned [Planned Enhancements]
        E[Qwen2.5-VL OCR]
        F[Automatic Form Filling]
        G[webContents.executeJavaScript]
        H[Enhanced AI Pipeline]
    end

    subgraph Future [Future Architecture]
        I[Advanced Multimodal AI]
        J[Real-time Form Analysis]
        K[Intelligent Autofill]
    end

    B -.-> E
    C -.-> H
    D -.-> F
    F -.-> G
    E --> I
    F --> J
    G --> K
```

---

## 📊 **Performance Targets**

### **Current Metrics**

- **PDF Load Time**: 1-2 seconds (60% improvement)
- **Memory Usage**: 40% reduction vs previous architecture
- **Bundle Size**: 2MB+ smaller (PDF.js removal)
- **LLM Response**: <3 seconds P95 latency
- **OCR Processing**: 5-10 seconds per page

### **Architecture Benefits**

- ✅ **Single Rendering Path**: Chromium only
- ✅ **Native Performance**: Browser-grade PDF handling
- ✅ **Reduced Complexity**: No redundant layers
- ✅ **Better UX**: Native form controls
- ✅ **Maintainable**: Clean, focused codebase

---

_This design document reflects the current post-simplification architecture and will be updated as the system evolves._
