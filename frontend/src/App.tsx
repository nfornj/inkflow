import React, {
  useState,
  useRef,
  useEffect,
  useMemo,
  useCallback,
} from "react";
import * as pdfjsLib from "pdfjs-dist";
import ReactMarkdown from "react-markdown";
import remarkGfm from "remark-gfm";
import rehypeRaw from "rehype-raw";
import UnifiedPDFEditor from "./components/UnifiedPDFEditor";
import UnifiedContentViewer from "./components/UnifiedContentViewer";
import "./components/UnifiedPDFEditor.css";
import {
  ChevronLeftIcon,
  ChevronRightIcon,
  ReloadIcon,
  PlusIcon,
  FileTextIcon,
  GlobeIcon,
  LightningBoltIcon,
  Cross2Icon,
  ExternalLinkIcon,
  ZoomInIcon,
  ZoomOutIcon,
  CropIcon,
  ResetIcon,
  CopyIcon,
  MoonIcon,
  SunIcon,
  UpdateIcon,
  PaperPlaneIcon,
  GearIcon,
} from "@radix-ui/react-icons";
import "./App.css";

interface Tab {
  id: string;
  title: string;
  contentType: "pdf" | "web" | "settings";
  isActive: boolean;
  isSettings?: boolean;
  pdfBytes?: Uint8Array;
  fileName?: string;
  filePath?: string;
  pageNum?: number;
  url?: string;
  browserId?: string;

  // Legacy support
  isPDF?: boolean;
}

function App() {
  // Tab management
  const [tabs, setTabs] = useState<Tab[]>([
    {
      id: "1",
      title: "New Tab",
      contentType: "web",
      isActive: true,
      isPDF: false,
    },
  ]);
  // Store PDF bytes per tab to prevent mixing between tabs
  const [tabPdfData, setTabPdfData] = useState<Record<string, number[]>>({});
  const activeTab = tabs.find((t) => t.isActive)!;

  // Memoize PDF bytes for current tab to prevent unnecessary re-creation
  const currentTabPdfBytes = useMemo(() => {
    if (!activeTab?.id || !tabPdfData[activeTab.id]) return null;
    console.log(`App: Creating memoized PDF bytes for tab ${activeTab.id}`);

    // Create a completely independent copy to prevent ArrayBuffer detachment
    const sourceArray = tabPdfData[activeTab.id];
    return Uint8Array.from(sourceArray);
  }, [activeTab?.id, tabPdfData]);

  // UI State
  const [omniboxValue, setOmniboxValue] = useState("");
  const [isWebView, setIsWebView] = useState(false);

  // Settings state
  const [showSettings, setShowSettings] = useState(false);

  // AI Provider settings
  const [aiProvider] = useState<"llama">("llama");
  const [llamaModelDownloaded, setLlamaModelDownloaded] = useState(false);
  const [modelDownloadProgress, setModelDownloadProgress] = useState(0);
  const [isDownloadingModel, setIsDownloadingModel] = useState(false);

  // Additional Llama status tracking
  const [llamaStatus, setLlamaStatus] = useState<{
    reason: string;
    message: string;
    ollamaInstalled: boolean;
  }>({
    reason: "checking",
    message: "Checking system status...",
    ollamaInstalled: false,
  });

  // Ollama installation state
  const [isInstallingOllama, setIsInstallingOllama] = useState(false);
  const [ollamaInstallProgress, setOllamaInstallProgress] = useState(0);
  const [ollamaInstallStep, setOllamaInstallStep] = useState("");
  const [ollamaServiceTestFailed, setOllamaServiceTestFailed] = useState(false);

  // Function to open settings as a tab
  function openSettingsTab() {
    // Check if settings tab already exists
    const existingSettingsTab = tabs.find((tab) => tab.isSettings);

    if (existingSettingsTab) {
      // If exists, just activate it
      setTabs((prev) =>
        prev.map((tab) => ({
          ...tab,
          isActive: tab.id === existingSettingsTab.id,
        }))
      );
    } else {
      // Create new settings tab
      const newSettingsTab: Tab = {
        id: `settings-${Date.now()}`,
        title: "Settings",
        contentType: "settings",
        isPDF: false,
        isActive: true,
        isSettings: true,
      };

      // Deactivate all other tabs and add settings tab
      setTabs((prev) => [
        ...prev.map((tab) => ({ ...tab, isActive: false })),
        newSettingsTab,
      ]);
    }

    // Hide browser if it's showing
    if (isWebView) {
      setIsWebView(false);
      window.electronAPI?.hideBrowser();
    }
  }
  const [browserLoading, setBrowserLoading] = useState(false);
  const [currentUrl, setCurrentUrl] = useState("");

  // AI State
  const [prompt, setPrompt] = useState("");
  const [aiReply, setAiReply] = useState<string>("");
  const [aiLoading, setAiLoading] = useState(false);

  // PDF State
  const canvasRef = useRef<HTMLCanvasElement>(null);
  const [pdfScale, setPdfScale] = useState(1.0);
  const [totalPages, setTotalPages] = useState(0);
  const [currentPage, setCurrentPage] = useState(1);
  const [showTextLayerDebug, setShowTextLayerDebug] = useState(false);
  const [pdfSummary, setPdfSummary] = useState<string>("");
  const [pdfDocument, setPdfDocument] = useState<any>(null);
  const [summaryLoading, setSummaryLoading] = useState(false);
  const [detectedContentType, setDetectedContentType] = useState<string>("");
  const [pdfReloading, setPdfReloading] = useState(false);
  const [useNewPDFViewer, setUseNewPDFViewer] = useState<boolean>(true);
  const [darkMode, setDarkMode] = useState<boolean>(false);
  const [formData, setFormData] = useState<Record<string, any>>({});

  // Font customization state
  const [selectedFont, setSelectedFont] = useState<string>("Helvetica");
  const [selectedFontSize, setSelectedFontSize] = useState<number>(14);

  // Debug state
  const [debugEnabled, setDebugEnabled] = useState(false);
  const [debugExpanded, setDebugExpanded] = useState(false);
  const [debugLog, setDebugLog] = useState<string[]>([]);

  const addDebugLog = useCallback((message: string) => {
    const timestamp = new Date().toLocaleTimeString();
    setDebugLog((prev) => [...prev.slice(-9), `${timestamp}: ${message}`]);
  }, []);

  // Enable debug mode with Ctrl+D
  useEffect(() => {
    const handleKeyDown = (e: KeyboardEvent) => {
      if (e.ctrlKey && e.key === "d") {
        e.preventDefault();
        setDebugEnabled(!debugEnabled);
        addDebugLog(`Debug mode ${!debugEnabled ? "enabled" : "disabled"}`);
      }
    };
    window.addEventListener("keydown", handleKeyDown);
    return () => window.removeEventListener("keydown", handleKeyDown);
  }, [debugEnabled, addDebugLog]);

  // Initialize theme and accent from settings; keep Electron in sync
  useEffect(() => {
    (async () => {
      try {
        const settings = await window.electronAPI?.getSettings();
        const appearance = settings?.success
          ? settings.data?.appearance || {}
          : {};
        const themeSource = appearance.themeSource || "system";
        const themeInfo = await window.electronAPI?.getThemeInfo();
        const systemDark = themeInfo?.success
          ? themeInfo.data?.shouldUseDarkColors
          : false;
        const isDark =
          themeSource === "system" ? !!systemDark : themeSource === "dark";
        setDarkMode(isDark);
        if (appearance.accentColor) {
          document.documentElement.style.setProperty(
            "--accent",
            appearance.accentColor
          );
        }
        await window.electronAPI?.setTheme(themeSource as any);
      } catch {}
    })();

    // Listen for OS theme changes if user selects Device
    try {
      window.electronAPI?.onNativeThemeUpdated?.((data) => {
        (async () => {
          const settings = await window.electronAPI?.getSettings();
          const appearance = settings?.success
            ? settings.data?.appearance || {}
            : {};
          if ((appearance.themeSource || "system") === "system") {
            setDarkMode(!!data.shouldUseDarkColors);
          }
        })();
      });
    } catch {}
  }, []);

  useEffect(() => {
    try {
      window.electronAPI?.setTheme(darkMode ? "dark" : "light");
      // Recompute BrowserView bounds in case header/tab sizes changed with theme
      const header = document.querySelector(".header") as HTMLElement | null;
      const tabBar = document.querySelector(".tab-bar") as HTMLElement | null;
      const browserIndicator = document.querySelector(
        ".browser-indicator"
      ) as HTMLElement | null;
      const topInset =
        (header?.offsetHeight || 0) +
        (tabBar?.offsetHeight || 0) +
        (browserIndicator?.offsetHeight || 0);
      const sidebarEl = document.querySelector(
        ".sidebar"
      ) as HTMLElement | null;
      const sidebarWidth = sidebarEl?.offsetWidth || 320;
      window.electronAPI?.updateLayout({ topInset, sidebarWidth });
      if (isWebView) {
        window.electronAPI?.showBrowser();
      }
    } catch {}
  }, [darkMode, isWebView]);

  // Report layout metrics (top inset + sidebar width) to main for pixel-perfect BrowserView bounds
  useEffect(() => {
    const reportLayout = () => {
      try {
        const header = document.querySelector(".header") as HTMLElement | null;
        const tabBar = document.querySelector(".tab-bar") as HTMLElement | null;
        const browserIndicator = document.querySelector(
          ".browser-indicator"
        ) as HTMLElement | null;
        const topInset =
          (header?.offsetHeight || 0) +
          (tabBar?.offsetHeight || 0) +
          (browserIndicator?.offsetHeight || 0);
        const sidebarEl = document.querySelector(
          ".sidebar"
        ) as HTMLElement | null;
        const sidebarWidth = sidebarEl?.offsetWidth || 320;
        window.electronAPI?.updateLayout({ topInset, sidebarWidth });
      } catch {}
    };

    reportLayout();
    window.addEventListener("resize", reportLayout);
    return () => window.removeEventListener("resize", reportLayout);
  }, []);

  // Sidebar resize state
  const [sidebarWidth, setSidebarWidth] = useState(320); // Default width
  const [isResizing, setIsResizing] = useState(false);
  const [windowWidth, setWindowWidth] = useState(window.innerWidth);

  // Handle window resize for responsive layout
  useEffect(() => {
    const handleResize = () => {
      const newWidth = window.innerWidth;
      setWindowWidth(newWidth);

      // Adjust sidebar width if it's too large for the window
      const maxAllowedWidth = Math.floor(newWidth * 0.5);
      if (sidebarWidth > maxAllowedWidth) {
        const newSidebarWidth = Math.min(320, maxAllowedWidth);
        setSidebarWidth(newSidebarWidth);

        // Notify main process of the adjusted width
        if (window.electronAPI) {
          window.electronAPI.sidebarResized(newSidebarWidth);
        }
      }
    };

    window.addEventListener("resize", handleResize);
    return () => window.removeEventListener("resize", handleResize);
  }, [sidebarWidth]);

  // Form handling functions
  const handleFormDataChange = (newFormData: Record<string, any>) => {
    setFormData(newFormData);
    addDebugLog(`Form data updated: ${Object.keys(newFormData).length} fields`);
    console.log("Form data changed:", newFormData);
  };

  const handleSaveForm = async (formDataToSave: Record<string, any>) => {
    try {
      addDebugLog(
        `Starting advanced form save with ${
          Object.keys(formDataToSave).length
        } fields`
      );

      if (!activeTab?.pdfBytes) {
        addDebugLog("No PDF data available for saving");
        alert("No PDF data available for saving");
        return;
      }

      // Import the advanced form filling utilities
      const { handleAdvancedFormSave, downloadFilledPDF } = await import(
        "./utils/advancedFormFilling"
      );

      console.log("🚀 Starting advanced form save...");

      const results = await handleAdvancedFormSave(
        formDataToSave,
        activeTab.pdfBytes,
        {
          enableFuzzyMatching: true,
          enableValueNormalization: true,
          skipProtectedFields: true,
          createBackup: true,
          flattenForm: false, // Keep editable for testing
        }
      );

      // Download the filled PDF
      downloadFilledPDF(results.pdfBytes!, activeTab.fileName);

      // Show detailed results
      let message = `Form processing completed!\n\n`;
      message += `✅ Fields updated: ${results.fieldsUpdated}\n`;
      message += `⏭️ Fields skipped: ${results.fieldsSkipped}\n`;
      message += `❌ Fields with errors: ${results.fieldsWithErrors}\n`;

      if (results.warnings.length > 0) {
        message += `\n⚠️ Warnings:\n${results.warnings.slice(0, 5).join("\n")}`;
        if (results.warnings.length > 5) {
          message += `\n... and ${results.warnings.length - 5} more warnings`;
        }
      }

      if (results.errors.length > 0) {
        message += `\n❌ Errors:\n${results.errors.slice(0, 3).join("\n")}`;
        if (results.errors.length > 3) {
          message += `\n... and ${results.errors.length - 3} more errors`;
        }
      }

      alert(message);
      addDebugLog(message);

      // Log detailed field results to console
      console.log("📊 Detailed field results:", results.fieldResults);
    } catch (error) {
      console.error("💥 Advanced form save failed:", error);
      alert(`Error saving form: ${error}`);
      addDebugLog(`Error in advanced form save: ${error}`);
    }
  };

  // Sidebar resize functionality
  const handleMouseDown = (e: React.MouseEvent) => {
    e.preventDefault();
    setIsResizing(true);
    addDebugLog("Started resizing sidebar");
  };

  const handleDoubleClick = async () => {
    setSidebarWidth(320); // Reset to default width
    addDebugLog("Sidebar width reset to default (320px)");

    // Notify main process to update BrowserView bounds
    if (window.electronAPI) {
      try {
        await window.electronAPI.sidebarResized(320);
      } catch (error) {
        console.error("Error notifying main process of sidebar reset:", error);
      }
    }
  };

  const handleMouseMove = (e: MouseEvent) => {
    if (!isResizing) return;

    const windowWidth = window.innerWidth;
    const newWidth = windowWidth - e.clientX;

    // Set constraints: minimum 280px, maximum 50% of screen width
    const minWidth = 280;
    const maxWidth = Math.floor(windowWidth * 0.5);

    const constrainedWidth = Math.min(Math.max(newWidth, minWidth), maxWidth);
    setSidebarWidth(constrainedWidth);

    // Notify main process in real-time (throttled to avoid performance issues)
    if (window.electronAPI) {
      // Use requestAnimationFrame to throttle the updates
      if (!window.sidebarResizeFrame) {
        window.sidebarResizeFrame = requestAnimationFrame(async () => {
          try {
            if (window.electronAPI) {
              await window.electronAPI.sidebarResized(constrainedWidth);
            }
          } catch (error) {
            console.error(
              "Error notifying main process during sidebar drag:",
              error
            );
          }
          window.sidebarResizeFrame = null;
        });
      }
    }
  };

  const handleMouseUp = async () => {
    if (isResizing) {
      setIsResizing(false);
      addDebugLog(`Sidebar resized to ${sidebarWidth}px`);

      // Cancel any pending animation frame
      if (window.sidebarResizeFrame) {
        cancelAnimationFrame(window.sidebarResizeFrame);
        window.sidebarResizeFrame = null;
      }

      // Final update to main process with the exact final width
      if (window.electronAPI) {
        try {
          await window.electronAPI.sidebarResized(sidebarWidth);
        } catch (error) {
          console.error(
            "Error notifying main process of sidebar resize:",
            error
          );
        }
      }
    }
  };

  // Add event listeners for resize
  React.useEffect(() => {
    if (isResizing) {
      document.addEventListener("mousemove", handleMouseMove);
      document.addEventListener("mouseup", handleMouseUp);
      document.body.style.cursor = "ew-resize";
      document.body.style.userSelect = "none";
    } else {
      document.removeEventListener("mousemove", handleMouseMove);
      document.removeEventListener("mouseup", handleMouseUp);
      document.body.style.cursor = "";
      document.body.style.userSelect = "";
    }

    return () => {
      document.removeEventListener("mousemove", handleMouseMove);
      document.removeEventListener("mouseup", handleMouseUp);
      document.body.style.cursor = "";
      document.body.style.userSelect = "";
    };
  }, [isResizing, sidebarWidth]);

  // Keyboard shortcuts
  useEffect(() => {
    const handleKeyDown = (e: KeyboardEvent) => {
      // Ctrl/Cmd + D to toggle debug
      if ((e.ctrlKey || e.metaKey) && e.key === "d") {
        e.preventDefault();
        setDebugEnabled(!debugEnabled);
      }
      // Escape to close settings modal or settings tab
      if (e.key === "Escape") {
        if (showSettings) {
          setShowSettings(false);
        } else if (activeTab && activeTab.isSettings) {
          // Close settings tab and switch to another tab or create new one
          const otherTabs = tabs.filter((tab) => !tab.isSettings);
          if (otherTabs.length > 0) {
            // Switch to the first non-settings tab
            setTabs((prev) =>
              prev
                .filter((tab) => !tab.isSettings)
                .map((tab, index) => ({
                  ...tab,
                  isActive: index === 0,
                }))
            );
          } else {
            // Create a new tab
            const newTab: Tab = {
              id: `tab-${Date.now()}`,
              title: "New Tab",
              contentType: "web",
              isPDF: false,
              isActive: true,
            };
            setTabs([newTab]);
          }
        }
      }
    };

    document.addEventListener("keydown", handleKeyDown);
    return () => document.removeEventListener("keydown", handleKeyDown);
  }, [debugEnabled, showSettings, activeTab, tabs]);

  // Copy to clipboard functionality
  const copyToClipboard = async (text: string) => {
    try {
      await navigator.clipboard.writeText(text);
      addDebugLog("Content copied to clipboard");
    } catch (err) {
      addDebugLog("Failed to copy content");
    }
  };

  // AI Provider setup and model management
  useEffect(() => {
    if (!window.electronAPI) return;

    // Check if Llama model is available on startup
    const checkLlamaModel = async () => {
      try {
        if (!window.electronAPI?.checkLlamaModel) {
          addDebugLog("Llama model check API not available");
          return;
        }

        const result = await window.electronAPI.checkLlamaModel();
        if (result.success) {
          setLlamaModelDownloaded(result.available);

          // Update status based on the result
          setLlamaStatus({
            reason: result.reason || "unknown",
            message: result.message || "Unknown status",
            ollamaInstalled:
              result.reason === "model_ready" ||
              result.reason === "model_not_downloaded",
          });

          // Detailed logging based on the reason
          if (result.reason === "ollama_not_installed") {
            addDebugLog("Ollama is not installed on this system");
          } else if (result.reason === "model_ready") {
            addDebugLog(`Llama model ready: ${result.path}`);
          } else if (result.reason === "model_not_downloaded") {
            addDebugLog(
              "Ollama is installed but Llama 3.2 model needs to be downloaded"
            );
          } else {
            addDebugLog(
              `Llama model check: ${
                result.available ? "available" : "not found"
              }`
            );
          }

          if (result.message) {
            addDebugLog(`Status: ${result.message}`);
          }
        } else {
          addDebugLog(`Error checking Llama model: ${result.error}`);
          setLlamaStatus({
            reason: "error",
            message: result.error || "Failed to check model status",
            ollamaInstalled: false,
          });
        }
      } catch (error) {
        addDebugLog(`Error checking Llama model: ${error}`);
      }
    };

    checkLlamaModel();

    // Set up Llama download progress listeners
    if (window.electronAPI?.onLlamaDownloadProgress) {
      window.electronAPI.onLlamaDownloadProgress((progress) => {
        setModelDownloadProgress(progress);
        addDebugLog(`Llama download progress: ${progress}%`);
      });
    }

    if (window.electronAPI?.onLlamaDownloadComplete) {
      window.electronAPI.onLlamaDownloadComplete(() => {
        setIsDownloadingModel(false);
        setLlamaModelDownloaded(true);
        setModelDownloadProgress(100);
        addDebugLog("Llama model download completed");
      });
    }

    // Set up Ollama installation progress listener
    if (window.electronAPI?.onOllamaInstallProgress) {
      window.electronAPI.onOllamaInstallProgress((data) => {
        setOllamaInstallProgress(data.progress);
        setOllamaInstallStep(data.step);
        addDebugLog(`Ollama installation: ${data.step} - ${data.progress}%`);
      });
    }

    return () => {
      // Cleanup listeners
      if (window.electronAPI?.removeAllListeners) {
        window.electronAPI.removeAllListeners("llama-download-progress");
        window.electronAPI.removeAllListeners("llama-download-complete");
        window.electronAPI.removeAllListeners("ollama-install-progress");
      }
    };
  }, [addDebugLog]);

  // Auto-start Ollama service when Llama provider is selected
  useEffect(() => {
    const autoStartOllama = async () => {
      if (
        aiProvider === "llama" &&
        llamaStatus.ollamaInstalled &&
        !isInstallingOllama
      ) {
        try {
          if (window.electronAPI?.startOllamaService) {
            const result = await window.electronAPI.startOllamaService();
            if (result.success) {
              addDebugLog("Ollama service auto-started for Llama provider");
            }
          }
        } catch (error) {
          addDebugLog(`Auto-start Ollama failed: ${error}`);
        }
      }
    };

    autoStartOllama();
  }, [
    aiProvider,
    llamaStatus.ollamaInstalled,
    isInstallingOllama,
    addDebugLog,
  ]);

  // Setup PDF.js worker on mount
  useEffect(() => {
    try {
      // Try to use unpkg CDN first (most reliable for newer versions)
      pdfjsLib.GlobalWorkerOptions.workerSrc = "/pdf.worker.min.js";
      addDebugLog("PDF.js worker configured with unpkg CDN");
    } catch (error) {
      // Fallback: create a simple blob worker that disables worker functionality
      const workerBlob = new Blob(
        [
          `
        self.addEventListener('message', function(e) {
          // Just acknowledge the message
          self.postMessage(e.data);
        });
      `,
        ],
        { type: "application/javascript" }
      );
      pdfjsLib.GlobalWorkerOptions.workerSrc = URL.createObjectURL(workerBlob);
      addDebugLog("PDF.js worker configured with fallback blob");
    }
  }, [addDebugLog]);

  // Debug activeTab changes (only log when PDF-related properties change)
  useEffect(() => {
    if (activeTab?.isPDF || activeTab?.pdfBytes) {
      addDebugLog(
        `ActiveTab changed: id=${activeTab?.id}, isPDF=${
          activeTab?.isPDF
        }, hasPdfBytes=${!!activeTab?.pdfBytes}, pageNum=${activeTab?.pageNum}`
      );
    }
  }, [activeTab, addDebugLog]);

  // Re-render PDF when scale changes or debug mode toggles
  useEffect(() => {
    if (
      activeTab &&
      activeTab.isPDF &&
      activeTab.pdfBytes &&
      activeTab.pageNum
    ) {
      renderPDFPage(activeTab.pdfBytes, activeTab.pageNum, pdfScale);
    }
  }, [
    pdfScale,
    showTextLayerDebug,
    activeTab?.isPDF,
    activeTab?.pdfBytes,
    activeTab?.pageNum,
  ]); // eslint-disable-line react-hooks/exhaustive-deps

  // Set up Electron event listeners
  useEffect(() => {
    if (!window.electronAPI) return;

    window.electronAPI.onBrowserLoading((data) => {
      setBrowserLoading(data.loading);
      addDebugLog(
        data.loading ? "Browser loading..." : "Browser finished loading"
      );
    });

    window.electronAPI.onBrowserUrlChanged((data) => {
      setCurrentUrl(data.url);
      setOmniboxValue(data.url);
      addDebugLog(`URL changed to: ${data.url}`);
    });

    window.electronAPI.onBrowserError((data) => {
      addDebugLog(`Browser error: ${data.error}`);
    });

    return () => {
      if (window.electronAPI) {
        window.electronAPI.removeAllListeners("browser-loading");
        window.electronAPI.removeAllListeners("browser-url-changed");
        window.electronAPI.removeAllListeners("browser-error");
      }
    };
  }, [addDebugLog]);

  // Handle window resize for dynamic sidebar constraints
  useEffect(() => {
    const handleResize = () => {
      if (window.electronAPI && isWebView) {
        window.electronAPI.windowResized();
      }
    };

    window.addEventListener("resize", handleResize);
    return () => window.removeEventListener("resize", handleResize);
  }, [isWebView]);

  async function navigateToUrl(url: string) {
    if (!window.electronAPI) {
      addDebugLog("Electron API not available");
      return;
    }

    if (!url.startsWith("http://") && !url.startsWith("https://")) {
      url = "https://" + url;
    }

    addDebugLog(`Navigating to: ${url}`);
    setIsWebView(true);

    try {
      const result = await window.electronAPI.navigateUrl(url);
      if (result.success) {
        addDebugLog(
          `Unified content loaded: ${result.browserId} (${result.contentType})`
        );
        setCurrentUrl(url);
        setOmniboxValue(url);

        // Update active tab with web content info
        setTabs((prev) =>
          prev.map((tab) =>
            tab.isActive
              ? {
                  ...tab,
                  title: new URL(url).hostname,
                  contentType: "web" as const,
                  isPDF: false, // Legacy support
                  url: url,
                  browserId: result.browserId,
                }
              : tab
          )
        );

        await window.electronAPI.showBrowser();
      } else {
        addDebugLog(`Navigation failed: ${result.error}`);
      }
    } catch (error) {
      addDebugLog(`Navigation error: ${error}`);
    }
  }

  async function handleOmniboxSubmit(e: React.FormEvent) {
    e.preventDefault();

    if (!omniboxValue.trim()) return;

    // Check if it's a search query or URL
    if (
      omniboxValue.includes(" ") ||
      (!omniboxValue.includes(".") && !omniboxValue.startsWith("http"))
    ) {
      // Search query
      const searchUrl = `https://duckduckgo.com/?q=${encodeURIComponent(
        omniboxValue
      )}`;
      await navigateToUrl(searchUrl);
    } else {
      // URL
      await navigateToUrl(omniboxValue);
    }
  }

  async function goBack() {
    if (window.electronAPI) {
      const result = await window.electronAPI.browserBack();
      if (result.success) {
        addDebugLog("Navigated back");
      }
    }
  }

  async function goForward() {
    if (window.electronAPI) {
      const result = await window.electronAPI.browserForward();
      if (result.success) {
        addDebugLog("Navigated forward");
      }
    }
  }

  async function reload() {
    if (!window.electronAPI) return;

    try {
      // Check if current tab is a PDF
      if (isWebView) {
        // Handle web page reload
        const result = await window.electronAPI.browserReload();
        if (result.success) {
          addDebugLog("Web page reloaded");
        }
      } else {
        addDebugLog("No content to reload");
      }
    } catch (error) {
      addDebugLog(`Error during reload: ${error}`);
      console.error("Reload error:", error);
    } finally {
      setPdfReloading(false);
    }
  }

  async function openPDF() {
    if (!window.electronAPI) {
      addDebugLog("Electron API not available");
      return;
    }

    addDebugLog("Opening file dialog...");
    try {
      const result = await window.electronAPI.openFileDialog();
      addDebugLog(
        `File dialog result: success=${
          result.success
        }, hasData=${!!result.data}, fileName=${result.fileName}`
      );

      if (result.success && result.data) {
        addDebugLog(`Opening PDF: ${result.fileName}`);

        // Convert ArrayBuffer to Uint8Array and create a copy to prevent detachment
        const pdfBytes = new Uint8Array(result.data.slice(0));

        // Store safe copy as regular array per tab
        setTabPdfData((prev) => ({
          ...prev,
          [activeTab.id]: Array.from(pdfBytes),
        }));

        // Validate the PDF file
        addDebugLog(`PDF file size: ${pdfBytes.length} bytes`);

        if (pdfBytes.length === 0) {
          throw new Error("PDF file is empty");
        }

        // Check PDF header
        const pdfHeader = new TextDecoder().decode(pdfBytes.slice(0, 10));
        addDebugLog(`PDF header: ${pdfHeader}`);

        if (!pdfHeader.startsWith("%PDF-")) {
          throw new Error(
            `Invalid PDF file format. Expected PDF header, got: ${pdfHeader}`
          );
        }

        // Load PDF using unified content system
        const loadResult = await window.electronAPI.loadPdfData(
          Array.from(pdfBytes),
          result.fileName || "document.pdf"
        );

        if (loadResult.success) {
          addDebugLog(`PDF loaded in unified viewer: ${loadResult.browserId}`);

          // Update tab with unified content data
          setTabs((prev) => {
            const updatedTabs = prev.map((tab) =>
              tab.isActive
                ? {
                    ...tab,
                    title: result.fileName || "PDF",
                    contentType: "pdf" as const,
                    isPDF: true, // Legacy support
                    pdfBytes,
                    fileName: result.fileName,
                    filePath: result.filePath,
                    pageNum: 1,
                    browserId: loadResult.browserId,
                  }
                : tab
            );
            const updatedActiveTab = updatedTabs.find((t) => t.isActive);
            addDebugLog(
              `Updated tab state: contentType=${
                updatedActiveTab?.contentType
              }, hasPdfBytes=${!!updatedActiveTab?.pdfBytes}, title=${
                updatedActiveTab?.title
              }`
            );
            return updatedTabs;
          });

          // Switch to unified content mode (handles both web and PDF)
          setIsWebView(true);

          // Clear any cached PDF document
          setPdfDocument(null);

          // PDF loaded successfully
          addDebugLog("PDF loaded successfully in unified viewer");

          // Automatically generate summary
          generatePdfSummary(pdfBytes);
        } else {
          throw new Error(
            loadResult.error || "Failed to load PDF in unified viewer"
          );
        }
      } else {
        if (!result.success) {
          addDebugLog("File dialog was canceled or failed");
        } else if (!result.data) {
          addDebugLog("No file data received from dialog");
        }
      }
    } catch (error) {
      addDebugLog(`Error opening PDF: ${error}`);
    }
  }

  // Handle save from unified PDF editor
  const handleUnifiedPDFSave = useCallback(
    async (fields: any[], _pdfBytes: Uint8Array) => {
      try {
        const currentTabPdfData = tabPdfData[activeTab.id];
        console.log("handleUnifiedPDFSave called with:", {
          fieldsCount: fields?.length,
          currentTabId: activeTab.id,
          currentTabPdfDataLength: currentTabPdfData?.length,
          fieldsData: fields?.map((f) => ({
            name: f.name,
            type: f.type,
            value: f.value,
          })),
        });

        if (!window.electronAPI?.pdfFinalizerFinalize) {
          addDebugLog("PDF finalizer API not available");
          alert("PDF save functionality not available");
          return;
        }

        if (!currentTabPdfData || currentTabPdfData.length === 0) {
          addDebugLog(
            `No PDF data available for saving. currentTabPdfData: ${currentTabPdfData}, length: ${currentTabPdfData?.length}`
          );
          alert("No PDF data available for saving");
          return;
        }

        addDebugLog(`Saving PDF with ${fields.length} form fields`);

        // Convert fields to the format expected by PDF finalizer
        const formFields = fields.map((field) => ({
          name: field.name,
          type: field.type,
          pageNumber: field.pageNumber,
          x: field.x,
          y: field.y,
          width: field.width,
          height: field.height,
          value: field.value,
          isAcroForm: true, // These are AcroForm fields from pdf.js
        }));

        // Use the current tab's PDF bytes array directly (no ArrayBuffer issues)
        const buffer = currentTabPdfData;

        // Call PDF finalizer with user-selected font settings
        const result = await window.electronAPI.pdfFinalizerFinalize(
          buffer,
          formFields,
          {
            fontSize: selectedFontSize,
            fontFamily: selectedFont,
          }
        );

        if (result.success && result.data) {
          // Save the filled PDF
          const filledPdfBytes = new Uint8Array(result.data);
          console.log("About to save PDF with data:", {
            originalDataLength: Array.isArray(result.data)
              ? result.data.length
              : result.data.byteLength || "unknown",
            filledPdfBytesLength: filledPdfBytes.length,
            fileName: activeTab.fileName,
          });

          // Convert to a plain array before sending over IPC
          const saveResult = await window.electronAPI.saveFileDialog(
            Array.from(filledPdfBytes),
            `${
              activeTab.fileName?.replace(".pdf", "") || "document"
            }_filled.pdf`
          );

          console.log("Save result:", saveResult);

          // Use setTimeout to prevent state updates from interfering with PDF rendering
          setTimeout(() => {
            if (saveResult.success) {
              addDebugLog(`PDF saved successfully to: ${saveResult.filePath}`);
              alert(`PDF saved successfully to: ${saveResult.filePath}`);
            } else {
              addDebugLog(
                `PDF save failed: ${
                  saveResult.error || saveResult.message || "Unknown error"
                }`
              );
              alert(
                `Failed to save PDF: ${
                  saveResult.error || saveResult.message || "Unknown error"
                }`
              );
            }
          }, 0);
        } else {
          setTimeout(() => {
            addDebugLog(`PDF save failed: ${result.error}`);
            alert(`Failed to save PDF: ${result.error || "Unknown error"}`);
          }, 0);
        }
      } catch (error) {
        setTimeout(() => {
          addDebugLog(`PDF save error: ${error}`);
          alert(`Error saving PDF: ${error}`);
        }, 0);
      }
    },
    [activeTab, tabPdfData, addDebugLog, selectedFont, selectedFontSize]
  );

  async function renderPDFPagesWorkingOld(
    pdfBytes: Uint8Array,
    scale?: number
  ) {
    if (!canvasRef.current) return;

    try {
      addDebugLog(`Starting PDF rendering for all pages - NEW APPROACH`);

      // Validate PDF bytes before processing
      if (!pdfBytes || pdfBytes.length === 0) {
        throw new Error("PDF bytes are empty or invalid");
      }

      // Check if this looks like a valid PDF
      const pdfHeader = new TextDecoder().decode(pdfBytes.slice(0, 10));
      if (!pdfHeader.startsWith("%PDF-")) {
        throw new Error(`Invalid PDF format. Header: ${pdfHeader}`);
      }

      addDebugLog(`PDF bytes length: ${pdfBytes.length}`);
      addDebugLog(`PDF version: ${pdfHeader}`);

      // Use cached PDF document if available, otherwise load it
      let pdf = pdfDocument;
      if (!pdf) {
        addDebugLog(`Loading PDF document (not cached)`);

        // Enhanced PDF loading with better error handling
        const loadingTask = pdfjsLib.getDocument({
          data: pdfBytes,
          useSystemFonts: true,
          disableFontFace: false,
          isEvalSupported: false,
          disableAutoFetch: false,
          disableStream: false,
          cMapUrl: "https://unpkg.com/pdfjs-dist@5.4.149/cmaps/",
          cMapPacked: true,
          standardFontDataUrl:
            "https://unpkg.com/pdfjs-dist@5.4.149/standard_fonts/",
        });

        // Handle loading progress and errors
        loadingTask.onProgress = (progress: any) => {
          if (progress.loaded && progress.total) {
            const percent = Math.round(
              (progress.loaded / progress.total) * 100
            );
            addDebugLog(`PDF Loading progress: ${percent}%`);
          }
        };

        pdf = await loadingTask.promise;
        setPdfDocument(pdf); // Cache the PDF document
        addDebugLog(`PDF document loaded and cached successfully`);
      } else {
        addDebugLog(`Using cached PDF document`);
      }

      // Store total pages
      setTotalPages(pdf.numPages);
      addDebugLog(`PDF loaded: ${pdf.numPages} pages`);

      // Get the PDF container (the parent of pdf-page-container)
      const pdfPageContainer = canvasRef.current.parentElement;
      const pdfContainer = pdfPageContainer?.parentElement;

      if (!pdfContainer) {
        throw new Error("Could not find PDF container");
      }

      addDebugLog(`PDF container found: ${pdfContainer.className}`);

      // Clear the entire PDF container and make it scrollable
      pdfContainer.innerHTML = "";

      // Ensure PDF container has proper height for scrolling
      pdfContainer.style.cssText = `
        flex: 1;
        display: flex;
        flex-direction: column;
        background: #2a2a2a;
        overflow: hidden;
        height: 100%;
        position: relative;
      `;

      // Create the toolbar
      const toolbar = document.createElement("div");
      toolbar.className = "pdf-toolbar";
      toolbar.style.cssText = `
        height: 60px;
        background: #333;
        display: flex;
        align-items: center;
        padding: 0 20px;
        color: white;
        flex-shrink: 0;
      `;
      toolbar.innerHTML = `
        <h3>${pdf.numPages} page${
        pdf.numPages !== 1 ? "s" : ""
      } - Scroll to navigate</h3>
      `;

      // Create a scrollable content area
      const scrollableContent = document.createElement("div");
      scrollableContent.className = "pdf-content";
      scrollableContent.style.cssText = `
        flex: 1;
        overflow-y: auto;
        overflow-x: hidden;
        padding: 20px;
        background: #f5f5f5;
        display: block;
        height: 100%;
        box-sizing: border-box;
      `;

      // Add toolbar and content to PDF container
      pdfContainer.appendChild(toolbar);
      pdfContainer.appendChild(scrollableContent);

      // Calculate optimal scale
      const firstPage = await pdf.getPage(1);
      const viewport = firstPage.getViewport({ scale: 1.0 });
      const containerWidth = pdfContainer.clientWidth - 40; // Account for padding
      const finalScale =
        scale || pdfScale || Math.min(containerWidth / viewport.width, 1.5);

      addDebugLog(`Using scale: ${finalScale}`);
      addDebugLog(`Container width: ${containerWidth}px`);

      // Render all pages
      const pageCanvases: HTMLCanvasElement[] = [];
      for (let pageNum = 1; pageNum <= pdf.numPages; pageNum++) {
        addDebugLog(`Rendering page ${pageNum} of ${pdf.numPages}`);

        const page = await pdf.getPage(pageNum);
        const pageViewport = page.getViewport({ scale: finalScale });

        // Create page wrapper
        const pageWrapper = document.createElement("div");
        pageWrapper.className = "page";
        pageWrapper.style.cssText = `
          background: white;
          margin: 0 auto 20px auto;
          padding: 20px;
          border-radius: 8px;
          box-shadow: 0 4px 12px rgba(0,0,0,0.15);
          display: block;
          max-width: 100%;
          width: fit-content;
        `;

        // Add page number
        const pageNumberDiv = document.createElement("div");
        pageNumberDiv.textContent = `Page ${pageNum} of ${pdf.numPages}`;
        pageNumberDiv.style.cssText = `
          margin-bottom: 15px;
          color: #666;
          font-size: 14px;
          font-weight: 500;
          text-align: center;
        `;

        // Create canvas for this page
        const pageCanvas = document.createElement("canvas");
        pageCanvas.width = pageViewport.width;
        pageCanvas.height = pageViewport.height;
        pageCanvas.style.cssText = `
          display: block;
          max-width: 100%;
          height: auto;
          border: 1px solid #ddd;
        `;

        // Clear canvas with white background
        const context = pageCanvas.getContext("2d")!;
        context.fillStyle = "#ffffff";
        context.fillRect(0, 0, pageCanvas.width, pageCanvas.height);

        // Render the page
        await page.render({
          canvasContext: context,
          viewport: pageViewport,
        }).promise;

        // Assemble page wrapper
        pageWrapper.appendChild(pageNumberDiv);
        pageWrapper.appendChild(pageCanvas);
        scrollableContent.appendChild(pageWrapper);
        pageCanvases.push(pageCanvas);

        addDebugLog(`Page ${pageNum} rendered successfully`);
      }

      // Add the scrollable content to the PDF container
      pdfContainer.appendChild(scrollableContent);

      // Store references for cleanup
      (scrollableContent as any).pageCanvases = pageCanvases;

      addDebugLog(
        `All ${pdf.numPages} pages rendered successfully in scrollable view`
      );
      addDebugLog(
        `Scrollable content dimensions: ${scrollableContent.clientWidth}x${scrollableContent.clientHeight}`
      );
      addDebugLog(
        `Scrollable content scroll height: ${scrollableContent.scrollHeight}px`
      );
      addDebugLog(
        `Can scroll: ${
          scrollableContent.scrollHeight > scrollableContent.clientHeight
        }`
      );
      addDebugLog(
        `PDF container dimensions: ${pdfContainer.clientWidth}x${pdfContainer.clientHeight}`
      );
      addDebugLog(
        `PDF container scroll height: ${pdfContainer.scrollHeight}px`
      );

      // Force a minimum height to ensure scrolling works
      if (scrollableContent.scrollHeight <= scrollableContent.clientHeight) {
        addDebugLog("Forcing minimum height for scrolling");
        scrollableContent.style.minHeight = "2000px";
      }

      // Add scroll event listener for debugging
      scrollableContent.addEventListener("scroll", () => {
        addDebugLog(`Scroll position: ${scrollableContent.scrollTop}px`);
      });
    } catch (error) {
      const errorMessage =
        error instanceof Error ? error.message : String(error);
      addDebugLog(`Error rendering PDF: ${errorMessage}`);
      console.error("PDF Rendering Error:", error);

      // Show error message
      const container = canvasRef.current?.parentElement?.parentElement;
      if (container) {
        container.innerHTML = `
          <div style="
            display: flex;
            flex-direction: column;
            align-items: center;
            justify-content: center;
            height: 400px;
            color: #ff6b6b;
            font-size: 16px;
            text-align: center;
            padding: 20px;
            background: #2a2a2a;
            border-radius: 8px;
            margin: 20px;
          ">
            <div style="font-size: 48px; margin-bottom: 16px;">⚠️</div>
            <div style="font-weight: 600; margin-bottom: 8px;">PDF Rendering Error</div>
            <div style="font-size: 14px; opacity: 0.8;">${errorMessage}</div>
          </div>
        `;
      }
    }
  }

  async function renderPDFPagesWorkingUltraSimple(
    pdfBytes: Uint8Array,
    scale?: number
  ) {
    if (!canvasRef.current) return;

    try {
      addDebugLog(`Starting PDF rendering - SIMPLE SCROLLABLE APPROACH`);

      // Validate PDF bytes before processing
      if (!pdfBytes || pdfBytes.length === 0) {
        throw new Error("PDF bytes are empty or invalid");
      }

      // Check if this looks like a valid PDF
      const pdfHeader = new TextDecoder().decode(pdfBytes.slice(0, 10));
      if (!pdfHeader.startsWith("%PDF-")) {
        throw new Error(`Invalid PDF format. Header: ${pdfHeader}`);
      }

      addDebugLog(`PDF bytes length: ${pdfBytes.length}`);
      addDebugLog(`PDF version: ${pdfHeader}`);

      // Use cached PDF document if available, otherwise load it
      let pdf = pdfDocument;
      if (!pdf) {
        addDebugLog(`Loading PDF document (not cached)`);

        // Enhanced PDF loading with better error handling
        const loadingTask = pdfjsLib.getDocument({
          data: pdfBytes,
          useSystemFonts: true,
          disableFontFace: false,
          isEvalSupported: false,
          disableAutoFetch: false,
          disableStream: false,
          cMapUrl: "https://unpkg.com/pdfjs-dist@5.4.149/cmaps/",
          cMapPacked: true,
          standardFontDataUrl:
            "https://unpkg.com/pdfjs-dist@5.4.149/standard_fonts/",
        });

        // Handle loading progress and errors
        loadingTask.onProgress = (progress: any) => {
          if (progress.loaded && progress.total) {
            const percent = Math.round(
              (progress.loaded / progress.total) * 100
            );
            addDebugLog(`PDF Loading progress: ${percent}%`);
          }
        };

        pdf = await loadingTask.promise;
        setPdfDocument(pdf); // Cache the PDF document
        addDebugLog(`PDF document loaded and cached successfully`);
      } else {
        addDebugLog(`Using cached PDF document`);
      }

      // Store total pages
      setTotalPages(pdf.numPages);
      addDebugLog(`PDF loaded: ${pdf.numPages} pages`);

      // Get the pdf-page-container and make it scrollable
      const container = canvasRef.current.parentElement;
      if (!container) return;

      addDebugLog(`PDF page container found: ${container.className}`);

      // Clear existing content
      container.innerHTML = "";

      // Make the container scrollable - THIS IS THE KEY FIX
      container.style.cssText = `
        position: relative;
        display: block;
        height: 100%;
        min-height: 600px;
        overflow-y: auto;
        overflow-x: hidden;
        background: #f5f5f5;
        padding: 20px;
        box-sizing: border-box;
      `;

      // Calculate optimal scale
      const firstPage = await pdf.getPage(1);
      const viewport = firstPage.getViewport({ scale: 1.0 });
      const containerWidth = container.clientWidth - 40; // Account for padding
      const finalScale =
        scale || pdfScale || Math.min(containerWidth / viewport.width, 1.5);

      addDebugLog(`Using scale: ${finalScale}`);
      addDebugLog(`Container width: ${containerWidth}px`);

      // Render all pages
      for (let pageNum = 1; pageNum <= pdf.numPages; pageNum++) {
        addDebugLog(`Rendering page ${pageNum} of ${pdf.numPages}`);

        const page = await pdf.getPage(pageNum);
        const pageViewport = page.getViewport({ scale: finalScale });

        // Create page wrapper
        const pageWrapper = document.createElement("div");
        pageWrapper.className = "pdf-page";
        pageWrapper.style.cssText = `
          background: white;
          margin: 0 auto 20px auto;
          padding: 20px;
          border-radius: 8px;
          box-shadow: 0 4px 12px rgba(0,0,0,0.15);
          display: block;
          max-width: 100%;
          width: fit-content;
        `;

        // Add page number
        const pageNumberDiv = document.createElement("div");
        pageNumberDiv.textContent = `Page ${pageNum} of ${pdf.numPages}`;
        pageNumberDiv.style.cssText = `
          margin-bottom: 15px;
          color: #666;
          font-size: 14px;
          font-weight: 500;
          text-align: center;
        `;

        // Create canvas for this page
        const pageCanvas = document.createElement("canvas");
        pageCanvas.width = pageViewport.width;
        pageCanvas.height = pageViewport.height;
        pageCanvas.style.cssText = `
          display: block;
          max-width: 100%;
          height: auto;
          border: 1px solid #ddd;
        `;

        // Clear canvas with white background
        const context = pageCanvas.getContext("2d")!;
        context.fillStyle = "#ffffff";
        context.fillRect(0, 0, pageCanvas.width, pageCanvas.height);

        // Render the page
        await page.render({
          canvasContext: context,
          viewport: pageViewport,
        }).promise;

        // Assemble page wrapper
        pageWrapper.appendChild(pageNumberDiv);
        pageWrapper.appendChild(pageCanvas);
        container.appendChild(pageWrapper);

        addDebugLog(`Page ${pageNum} rendered successfully`);
      }

      addDebugLog(
        `All ${pdf.numPages} pages rendered successfully in scrollable view`
      );
      addDebugLog(
        `Container dimensions: ${container.clientWidth}x${container.clientHeight}`
      );
      addDebugLog(`Container scroll height: ${container.scrollHeight}px`);
      addDebugLog(
        `Can scroll: ${container.scrollHeight > container.clientHeight}`
      );

      // Add scroll event listener for debugging
      container.addEventListener("scroll", () => {
        addDebugLog(`Scroll position: ${container.scrollTop}px`);
      });
    } catch (error) {
      const errorMessage =
        error instanceof Error ? error.message : String(error);
      addDebugLog(`Error rendering PDF: ${errorMessage}`);
      console.error("PDF Rendering Error:", error);

      // Show error message
      const container = canvasRef.current?.parentElement;
      if (container) {
        container.innerHTML = `
          <div style="
            display: flex;
            flex-direction: column;
            align-items: center;
            justify-content: center;
            height: 400px;
            color: #ff6b6b;
            font-size: 16px;
            text-align: center;
            padding: 20px;
            background: #2a2a2a;
            border-radius: 8px;
            margin: 20px;
          ">
            <div style="font-size: 48px; margin-bottom: 16px;">⚠️</div>
            <div style="font-weight: 600; margin-bottom: 8px;">PDF Rendering Error</div>
            <div style="font-size: 14px; opacity: 0.8;">${errorMessage}</div>
          </div>
        `;
      }
    }
  }

  async function renderPDFPagesWorking(pdfBytes: Uint8Array, scale?: number) {
    if (!canvasRef.current) return;

    try {
      addDebugLog(`Starting PDF rendering - SIMPLE WORKING APPROACH`);

      // Validate PDF bytes
      if (!pdfBytes || pdfBytes.length === 0) {
        throw new Error("PDF bytes are empty or invalid");
      }

      // Load PDF document
      let pdf = pdfDocument;
      if (!pdf) {
        const loadingTask = pdfjsLib.getDocument({
          data: pdfBytes,
          useSystemFonts: true,
          disableFontFace: false,
          isEvalSupported: false,
          disableAutoFetch: false,
          disableStream: false,
        });

        pdf = await loadingTask.promise;
        setPdfDocument(pdf);
        addDebugLog(`PDF document loaded: ${pdf.numPages} pages`);
      }

      setTotalPages(pdf.numPages);

      // Get the main content area and replace it with a simple scrollable container
      const mainContent = document.querySelector(".main-content");
      if (!mainContent) {
        throw new Error("Could not find main content area");
      }

      // Create a simple scrollable PDF viewer using normal document flow
      mainContent.innerHTML = `
        <div style="
          width: 100%;
          height: 100%;
          overflow-y: auto;
          overflow-x: hidden;
          background: #f5f5f5;
          padding: 20px;
          box-sizing: border-box;
        ">
          <div id="pdf-pages" style="
            display: flex;
            flex-direction: column;
            align-items: center;
            gap: 20px;
            min-height: calc(100vh - 200px);
          ">
            <!-- PDF pages will be rendered here -->
          </div>
        </div>
      `;

      const pagesContainer = document.getElementById("pdf-pages");
      if (!pagesContainer) {
        throw new Error("Could not create pages container");
      }

      // Calculate scale
      const firstPage = await pdf.getPage(1);
      const viewport = firstPage.getViewport({ scale: 1.0 });
      const containerWidth = mainContent.clientWidth - 40;
      const finalScale =
        scale || pdfScale || Math.min(containerWidth / viewport.width, 1.5);

      addDebugLog(`Using scale: ${finalScale}`);

      // Render all pages
      for (let pageNum = 1; pageNum <= pdf.numPages; pageNum++) {
        const page = await pdf.getPage(pageNum);
        const pageViewport = page.getViewport({ scale: finalScale });

        // Create page container
        const pageContainer = document.createElement("div");
        pageContainer.style.cssText = `
          background: white;
          padding: 20px;
          border-radius: 8px;
          box-shadow: 0 4px 12px rgba(0,0,0,0.15);
          width: fit-content;
          max-width: 100%;
        `;

        // Add page number
        const pageNumber = document.createElement("div");
        pageNumber.textContent = `Page ${pageNum} of ${pdf.numPages}`;
        pageNumber.style.cssText = `
          margin-bottom: 15px;
          color: #666;
          font-size: 14px;
          font-weight: 500;
          text-align: center;
        `;

        // Create canvas
        const canvas = document.createElement("canvas");
        canvas.width = pageViewport.width;
        canvas.height = pageViewport.height;
        canvas.style.cssText = `
          display: block;
          max-width: 100%;
          height: auto;
          border: 1px solid #ddd;
        `;

        // Render page
        const context = canvas.getContext("2d")!;
        context.fillStyle = "#ffffff";
        context.fillRect(0, 0, canvas.width, canvas.height);

        await page.render({
          canvasContext: context,
          viewport: pageViewport,
        }).promise;

        // Assemble page
        pageContainer.appendChild(pageNumber);
        pageContainer.appendChild(canvas);
        pagesContainer.appendChild(pageContainer);

        addDebugLog(`Page ${pageNum} rendered`);
      }

      addDebugLog(`All ${pdf.numPages} pages rendered successfully`);

      // Debug scrolling
      const scrollContainer = mainContent.querySelector("div");
      if (scrollContainer) {
        addDebugLog(
          `Scroll container height: ${scrollContainer.clientHeight}px`
        );
        addDebugLog(
          `Scroll container scroll height: ${scrollContainer.scrollHeight}px`
        );
        addDebugLog(
          `Can scroll: ${
            scrollContainer.scrollHeight > scrollContainer.clientHeight
          }`
        );

        // Force scroll test
        if (scrollContainer.scrollHeight <= scrollContainer.clientHeight) {
          addDebugLog(
            "WARNING: Content height is not greater than container height - scrolling may not work"
          );
          // Add extra height to force scrolling
          scrollContainer.style.minHeight = "200vh";
          addDebugLog("Added min-height: 200vh to force scrolling");
        }
      }
    } catch (error) {
      const errorMessage =
        error instanceof Error ? error.message : String(error);
      addDebugLog(`Error rendering PDF: ${errorMessage}`);
      console.error("PDF Rendering Error:", error);

      const mainContent = document.querySelector(".main-content");
      if (mainContent) {
        mainContent.innerHTML = `
          <div style="
            display: flex;
            flex-direction: column;
            align-items: center;
            justify-content: center;
            height: 400px;
            color: #ff6b6b;
            font-size: 16px;
            text-align: center;
            padding: 20px;
            background: #2a2a2a;
            border-radius: 8px;
            margin: 20px;
          ">
            <div style="font-size: 48px; margin-bottom: 16px;">⚠️</div>
            <div style="font-weight: 600; margin-bottom: 8px;">PDF Rendering Error</div>
            <div style="font-size: 14px; opacity: 0.8;">${errorMessage}</div>
          </div>
        `;
      }
    }
  }

  async function renderPDFPagesWorkingNew(
    pdfBytes: Uint8Array,
    scale?: number
  ) {
    try {
      addDebugLog(`Starting PDF rendering - COMPLETELY NEW APPROACH`);

      // Validate PDF bytes before processing
      if (!pdfBytes || pdfBytes.length === 0) {
        throw new Error("PDF bytes are empty or invalid");
      }

      // Check if this looks like a valid PDF
      const pdfHeader = new TextDecoder().decode(pdfBytes.slice(0, 10));
      if (!pdfHeader.startsWith("%PDF-")) {
        throw new Error(`Invalid PDF format. Header: ${pdfHeader}`);
      }

      addDebugLog(`PDF bytes length: ${pdfBytes.length}`);
      addDebugLog(`PDF version: ${pdfHeader}`);

      // Use cached PDF document if available, otherwise load it
      let pdf = pdfDocument;
      if (!pdf) {
        addDebugLog(`Loading PDF document (not cached)`);

        // Enhanced PDF loading with better error handling
        const loadingTask = pdfjsLib.getDocument({
          data: pdfBytes,
          useSystemFonts: true,
          disableFontFace: false,
          isEvalSupported: false,
          disableAutoFetch: false,
          disableStream: false,
          cMapUrl: "https://unpkg.com/pdfjs-dist@5.4.149/cmaps/",
          cMapPacked: true,
          standardFontDataUrl:
            "https://unpkg.com/pdfjs-dist@5.4.149/standard_fonts/",
        });

        // Handle loading progress and errors
        loadingTask.onProgress = (progress: any) => {
          if (progress.loaded && progress.total) {
            const percent = Math.round(
              (progress.loaded / progress.total) * 100
            );
            addDebugLog(`PDF Loading progress: ${percent}%`);
          }
        };

        pdf = await loadingTask.promise;
        setPdfDocument(pdf); // Cache the PDF document
        addDebugLog(`PDF document loaded and cached successfully`);
      } else {
        addDebugLog(`Using cached PDF document`);
      }

      // Store total pages
      setTotalPages(pdf.numPages);
      addDebugLog(`PDF loaded: ${pdf.numPages} pages`);

      // COMPLETELY NEW APPROACH - Find the main content area and replace it entirely
      const mainContent = document.querySelector(".main-content");
      if (!mainContent) {
        throw new Error("Could not find main content area");
      }

      addDebugLog(`Found main content area: ${mainContent.className}`);

      // Clear the entire main content and create a simple scrollable container
      mainContent.innerHTML = `
        <div id="pdf-viewer-container" style="
          width: 100%;
          height: 100%;
          overflow-y: auto;
          overflow-x: hidden;
          background: #f5f5f5;
          padding: 20px;
          box-sizing: border-box;
        ">
          <div id="pdf-pages-container" style="
            display: flex;
            flex-direction: column;
            align-items: center;
            gap: 20px;
            min-height: 100%;
          ">
            <!-- Pages will be inserted here -->
          </div>
        </div>
      `;

      const pdfContainer = document.getElementById("pdf-pages-container");
      if (!pdfContainer) {
        throw new Error("Could not create PDF container");
      }

      // Calculate optimal scale
      const firstPage = await pdf.getPage(1);
      const viewport = firstPage.getViewport({ scale: 1.0 });
      const containerWidth = mainContent.clientWidth - 40; // Account for padding
      const finalScale =
        scale || pdfScale || Math.min(containerWidth / viewport.width, 1.5);

      addDebugLog(`Using scale: ${finalScale}`);
      addDebugLog(`Container width: ${containerWidth}px`);

      // Render all pages
      for (let pageNum = 1; pageNum <= pdf.numPages; pageNum++) {
        addDebugLog(`Rendering page ${pageNum} of ${pdf.numPages}`);

        const page = await pdf.getPage(pageNum);
        const pageViewport = page.getViewport({ scale: finalScale });

        // Create page wrapper
        const pageWrapper = document.createElement("div");
        pageWrapper.style.cssText = `
          background: white;
          padding: 20px;
          border-radius: 8px;
          box-shadow: 0 4px 12px rgba(0,0,0,0.15);
          width: fit-content;
          max-width: 100%;
        `;

        // Add page number
        const pageNumberDiv = document.createElement("div");
        pageNumberDiv.textContent = `Page ${pageNum} of ${pdf.numPages}`;
        pageNumberDiv.style.cssText = `
          margin-bottom: 15px;
          color: #666;
          font-size: 14px;
          font-weight: 500;
          text-align: center;
        `;

        // Create canvas for this page
        const pageCanvas = document.createElement("canvas");
        pageCanvas.width = pageViewport.width;
        pageCanvas.height = pageViewport.height;
        pageCanvas.style.cssText = `
          display: block;
          max-width: 100%;
          height: auto;
          border: 1px solid #ddd;
        `;

        // Clear canvas with white background
        const context = pageCanvas.getContext("2d")!;
        context.fillStyle = "#ffffff";
        context.fillRect(0, 0, pageCanvas.width, pageCanvas.height);

        // Render the page
        await page.render({
          canvasContext: context,
          viewport: pageViewport,
        }).promise;

        // Assemble page wrapper
        pageWrapper.appendChild(pageNumberDiv);
        pageWrapper.appendChild(pageCanvas);
        pdfContainer.appendChild(pageWrapper);

        addDebugLog(`Page ${pageNum} rendered successfully`);
      }

      addDebugLog(
        `All ${pdf.numPages} pages rendered successfully in scrollable view`
      );

      // Add scroll event listener for debugging
      const scrollContainer = document.getElementById("pdf-viewer-container");
      if (scrollContainer) {
        scrollContainer.addEventListener("scroll", () => {
          addDebugLog(`Scroll position: ${scrollContainer.scrollTop}px`);
        });

        addDebugLog(
          `Scroll container dimensions: ${scrollContainer.clientWidth}x${scrollContainer.clientHeight}`
        );
        addDebugLog(
          `Scroll container scroll height: ${scrollContainer.scrollHeight}px`
        );
        addDebugLog(
          `Can scroll: ${
            scrollContainer.scrollHeight > scrollContainer.clientHeight
          }`
        );
      }
    } catch (error) {
      const errorMessage =
        error instanceof Error ? error.message : String(error);
      addDebugLog(`Error rendering PDF: ${errorMessage}`);
      console.error("PDF Rendering Error:", error);

      // Show error message
      const mainContent = document.querySelector(".main-content");
      if (mainContent) {
        mainContent.innerHTML = `
          <div style="
            display: flex;
            flex-direction: column;
            align-items: center;
            justify-content: center;
            height: 400px;
            color: #ff6b6b;
            font-size: 16px;
            text-align: center;
            padding: 20px;
            background: #2a2a2a;
            border-radius: 8px;
            margin: 20px;
          ">
            <div style="font-size: 48px; margin-bottom: 16px;">⚠️</div>
            <div style="font-weight: 600; margin-bottom: 8px;">PDF Rendering Error</div>
            <div style="font-size: 14px; opacity: 0.8;">${errorMessage}</div>
          </div>
        `;
      }
    }
  }

  async function renderPDFPage(
    pdfBytes: Uint8Array,
    pageNum: number,
    scale?: number
  ) {
    if (!canvasRef.current) return;

    try {
      addDebugLog(`Starting PDF rendering for page ${pageNum}`);

      // Validate PDF bytes before processing
      if (!pdfBytes || pdfBytes.length === 0) {
        throw new Error("PDF bytes are empty or invalid");
      }

      // Check if this looks like a valid PDF
      const pdfHeader = new TextDecoder().decode(pdfBytes.slice(0, 10));
      if (!pdfHeader.startsWith("%PDF-")) {
        throw new Error(`Invalid PDF format. Header: ${pdfHeader}`);
      }

      addDebugLog(`PDF bytes length: ${pdfBytes.length}`);
      addDebugLog(`PDF version: ${pdfHeader}`);

      // Use cached PDF document if available, otherwise load it
      let pdf = pdfDocument;
      if (!pdf) {
        addDebugLog(`Loading PDF document (not cached)`);

        // Enhanced PDF loading with better error handling
        const loadingTask = pdfjsLib.getDocument({
          data: pdfBytes,
          useSystemFonts: true,
          disableFontFace: false,
          isEvalSupported: false,
          disableAutoFetch: false,
          disableStream: false,
          cMapUrl: "https://unpkg.com/pdfjs-dist@5.4.149/cmaps/",
          cMapPacked: true,
          standardFontDataUrl:
            "https://unpkg.com/pdfjs-dist@5.4.149/standard_fonts/",
        });

        // Handle loading progress and errors
        loadingTask.onProgress = (progress: any) => {
          if (progress.loaded && progress.total) {
            const percent = Math.round(
              (progress.loaded / progress.total) * 100
            );
            addDebugLog(`PDF Loading progress: ${percent}%`);
          }
        };

        pdf = await loadingTask.promise;
        setPdfDocument(pdf); // Cache the PDF document
        addDebugLog(`PDF document loaded and cached successfully`);
      } else {
        addDebugLog(`Using cached PDF document`);
      }

      // Validate page number
      if (pageNum < 1 || pageNum > pdf.numPages) {
        throw new Error(
          `Invalid page number: ${pageNum}. PDF has ${pdf.numPages} pages.`
        );
      }

      const page = await pdf.getPage(pageNum);
      addDebugLog(`Page ${pageNum} loaded successfully`);

      // Store total pages
      setTotalPages(pdf.numPages);
      addDebugLog(`PDF loaded: ${pdf.numPages} pages`);

      const canvas = canvasRef.current;
      const context = canvas.getContext("2d")!;

      // Use provided scale or current pdfScale
      const currentScale = scale || pdfScale;

      // For initial load, calculate a good default scale, otherwise use current scale
      let optimalScale = currentScale;
      const containerWidth = canvas.parentElement?.clientWidth || 800;
      addDebugLog(
        `Container width: ${containerWidth}, current scale: ${currentScale}`
      );

      if (!scale && pdfScale === 1.2) {
        // This is initial load, calculate optimal size
        const baseViewport = page.getViewport({ scale: 1.0 });
        const maxWidth = containerWidth - 100;
        optimalScale = Math.min(2.0, maxWidth / baseViewport.width);
        addDebugLog(`Calculated optimal scale: ${optimalScale}`);
        setPdfScale(optimalScale);
      }

      const viewport = page.getViewport({ scale: optimalScale });
      canvas.height = viewport.height;
      canvas.width = viewport.width;

      addDebugLog(
        `Canvas size: ${canvas.width}x${
          canvas.height
        }, scale: ${optimalScale.toFixed(2)}`
      );

      // Clear canvas before rendering
      context.clearRect(0, 0, canvas.width, canvas.height);

      // Fill with white background to prevent artifacts
      context.fillStyle = "#ffffff";
      context.fillRect(0, 0, canvas.width, canvas.height);

      addDebugLog(`Starting page render for page ${pageNum}...`);
      await page.render({
        canvasContext: context,
        viewport: viewport,
        canvas: canvas,
      }).promise;
      addDebugLog(`Page ${pageNum} render completed successfully`);

      // Render text layer for text selection
      addDebugLog(`Starting text layer render...`);
      await renderTextLayer(page, viewport);
      addDebugLog(`Text layer render completed`);

      // Clean up page object to prevent memory leaks
      if (page.cleanup && typeof page.cleanup === "function") {
        page.cleanup();
        addDebugLog(`Page cleanup completed`);
      }

      addDebugLog(`PDF page ${pageNum} rendered successfully`);
    } catch (error) {
      const errorMessage =
        error instanceof Error ? error.message : String(error);
      addDebugLog(`Error rendering PDF page ${pageNum}: ${errorMessage}`);
      console.error("PDF Rendering Error:", error);

      // Show error message on canvas
      const canvas = canvasRef.current;
      if (canvas) {
        const context = canvas.getContext("2d")!;
        canvas.width = 600;
        canvas.height = 400;

        // Clear canvas and show error
        context.clearRect(0, 0, canvas.width, canvas.height);
        context.fillStyle = "#1a1a1a";
        context.fillRect(0, 0, canvas.width, canvas.height);

        context.fillStyle = "#ef4444";
        context.font = "bold 16px Arial";
        context.textAlign = "center";
        context.fillText("PDF Rendering Error", canvas.width / 2, 120);

        context.fillStyle = "#ffffff";
        context.font = "14px Arial";
        context.fillText(
          `Page ${pageNum} cannot be displayed properly.`,
          canvas.width / 2,
          150
        );
        context.fillText(
          "The file may be corrupted or incompatible.",
          canvas.width / 2,
          170
        );

        context.fillStyle = "#60a5fa";
        context.font = "12px Arial";
        context.fillText(
          "Try opening the file in a different PDF viewer.",
          canvas.width / 2,
          200
        );
        context.fillText(
          "Check the debug log for more details.",
          canvas.width / 2,
          220
        );

        // Show the actual error message
        context.fillStyle = "#ffa500";
        context.font = "11px monospace";
        context.fillText(`Error: ${errorMessage}`, canvas.width / 2, 250);
      }
    }
  }

  async function renderTextLayer(page: any, viewport: any) {
    try {
      const textLayerDiv = document.getElementById("pdf-text-layer");
      if (!textLayerDiv) return;

      // Clear existing text layer
      textLayerDiv.innerHTML = "";

      // Set the dimensions to match the canvas
      const canvas = canvasRef.current;
      if (canvas) {
        textLayerDiv.style.width = canvas.width + "px";
        textLayerDiv.style.height = canvas.height + "px";
      }

      // Use simple text layer creation (most compatible approach)
      await createSimpleTextLayer(page, viewport);

      addDebugLog("Text layer rendered for selection");
    } catch (error) {
      addDebugLog(`Error rendering text layer: ${error}`);
    }
  }

  async function createSimpleTextLayer(page: any, viewport: any) {
    try {
      const textLayerDiv = document.getElementById("pdf-text-layer");
      if (!textLayerDiv) return;

      const textContent = await page.getTextContent();
      const textItems = textContent.items;

      addDebugLog(`Creating text layer with ${textItems.length} text items`);

      textItems.forEach((item: any, index: number) => {
        if (!item.str || item.str.trim() === "") return; // Skip empty strings

        const textDiv = document.createElement("span");
        textDiv.textContent = item.str;
        textDiv.style.position = "absolute";
        textDiv.style.color = "transparent";
        textDiv.style.userSelect = "text";
        textDiv.style.pointerEvents = "auto";
        textDiv.style.whiteSpace = "pre";

        // Calculate font size based on viewport scaling
        const fontSize = item.height * viewport.scale;
        textDiv.style.fontSize = `${fontSize}px`;

        // Use a standard font family for better text matching
        textDiv.style.fontFamily = "Arial, sans-serif";

        // Calculate position using viewport transformation
        const x = item.transform[4] * viewport.scale;
        const y = viewport.height - item.transform[5] * viewport.scale;

        textDiv.style.left = `${x}px`;
        textDiv.style.top = `${y - fontSize}px`; // Adjust for font baseline

        // Add data attributes for debugging
        textDiv.setAttribute("data-text", item.str);
        textDiv.setAttribute("data-index", index.toString());

        // Add debugging visualization when enabled
        if (showTextLayerDebug) {
          textDiv.style.backgroundColor = "rgba(255, 0, 0, 0.2)";
          textDiv.style.border = "1px solid rgba(255, 0, 0, 0.5)";
          textDiv.style.color = "rgba(255, 0, 0, 0.7)"; // Make text visible for debugging
        }

        textLayerDiv.appendChild(textDiv);
      });

      addDebugLog("Enhanced text layer created for selection");
    } catch (error) {
      addDebugLog(`Error creating simple text layer: ${error}`);
    }
  }

  async function extractPdfTextContent(pdfBytes: Uint8Array): Promise<string> {
    try {
      const pdf = await pdfjsLib.getDocument({ data: pdfBytes }).promise;
      let fullText = "";

      for (let pageNum = 1; pageNum <= pdf.numPages; pageNum++) {
        const page = await pdf.getPage(pageNum);
        const textContent = await page.getTextContent();

        // Extract text from each page
        const pageText = textContent.items
          .map((item: any) => item.str)
          .join(" ");

        fullText += `\n\n--- Page ${pageNum} ---\n${pageText}`;

        // Clean up page object to prevent memory leaks
        if (page.cleanup && typeof page.cleanup === "function") {
          page.cleanup();
        }
      }

      addDebugLog(`Extracted text from ${pdf.numPages} pages`);
      return fullText.trim();
    } catch (error) {
      addDebugLog(`Error extracting PDF text: ${error}`);
      throw error;
    }
  }

  async function generatePdfSummary(pdfBytes: Uint8Array) {
    if (!window.electronAPI) {
      addDebugLog("Electron API not available");
      return;
    }

    setSummaryLoading(true);
    setPdfSummary("");
    addDebugLog(
      `Generating PDF summary with ${aiProvider.toUpperCase()} AI...`
    );

    try {
      // Extract text content from PDF (function will handle ArrayBuffer copying)
      const textContent = await extractPdfTextContent(pdfBytes);

      if (textContent.length < 100) {
        setPdfSummary(
          "This PDF appears to contain mainly images or very little text content to analyze."
        );
        setSummaryLoading(false);
        return;
      }

      // Limit text content to avoid API limits (approximately 100,000 characters)
      const limitedContent =
        textContent.length > 100000
          ? textContent.substring(0, 100000) +
            "... [Content truncated for analysis]"
          : textContent;

      // Detect content type and create appropriate prompt
      const contentType = "general_document"; // Simplified content type detection
      setDetectedContentType(contentType);
      addDebugLog(`Detected content type: ${contentType}`);
      const enhancedPrompt = createEnhancedPrompt(limitedContent, contentType);

      // Use Llama for analysis (no API key needed)

      // If using Llama, ensure Ollama service is running
      if (aiProvider === "llama") {
        addDebugLog("Ensuring Ollama service is running for PDF analysis...");

        // First test if Ollama is installed
        try {
          const installTest = await window.electronAPI.testOllamaInstallation();
          addDebugLog(
            `Ollama installation test: success=${installTest.success}, message=${installTest.message}, error=${installTest.error}`
          );

          if (!installTest.success) {
            addDebugLog(`Ollama is not installed: ${installTest.error}`);
            setPdfSummary(
              `Error: Ollama is not installed or not accessible. ${installTest.error}`
            );
            setSummaryLoading(false);
            return;
          }

          addDebugLog(`Ollama is installed: ${installTest.version}`);
        } catch (error) {
          addDebugLog(`Error testing Ollama installation: ${error}`);
        }

        try {
          const serviceResult = await window.electronAPI.startOllamaService();
          addDebugLog(
            `Ollama service result: success=${serviceResult.success}, message=${serviceResult.message}, error=${serviceResult.error}`
          );

          if (!serviceResult.success) {
            addDebugLog(
              `Failed to start Ollama service: ${serviceResult.error}`
            );
            setPdfSummary(
              `Error: Could not start Ollama service. ${serviceResult.error}`
            );
            setSummaryLoading(false);
            return;
          }
          addDebugLog(`Ollama service is ready: ${serviceResult.message}`);

          // Test the connection to make sure it's actually working
          try {
            const testResult = await window.electronAPI.testOllamaConnection();
            addDebugLog(
              `Ollama connection test: success=${testResult.success}, message=${testResult.message}`
            );
            if (!testResult.success) {
              addDebugLog(`Ollama connection test failed: ${testResult.error}`);
              setPdfSummary(
                `Error: Ollama service started but connection test failed. ${testResult.error}`
              );
              setSummaryLoading(false);
              return;
            }
          } catch (error) {
            addDebugLog(`Error testing Ollama connection: ${error}`);
          }
        } catch (error) {
          addDebugLog(`Error starting Ollama service: ${error}`);
          setPdfSummary(`Error: Could not start Ollama service. ${error}`);
          setSummaryLoading(false);
          return;
        }
      }

      // Use the universal PDF analysis endpoint with Llama 3.2
      const result = await window.electronAPI.analyzePdf({
        textContent: enhancedPrompt,
        provider: "llama",
      });

      if (result.success && result.content) {
        setPdfSummary(result.content);
        addDebugLog("PDF summary generated successfully with Llama 3.2");
      } else {
        setPdfSummary(
          `Error generating summary: ${result.error || "Unknown error"}`
        );
        addDebugLog(`Summary generation failed: ${result.error}`);
      }
    } catch (error) {
      setPdfSummary(`Error: ${error}`);
      addDebugLog(`Summary generation error: ${error}`);
    } finally {
      setSummaryLoading(false);
    }
  }

  function createEnhancedPrompt(
    textContent: string,
    contentType: string
  ): string {
    const baseInstruction =
      "Please analyze the following document and provide a comprehensive summary. ";

    const typeSpecificInstructions = {
      academic_paper: `This appears to be an academic paper. Focus on:
        • Research question and hypothesis
        • Methodology and approach
        • Key findings and results
        • Conclusions and implications
        • Limitations and future work
        
        Structure your summary with clear academic sections.`,

      research_paper: `This appears to be a research document. Please highlight:
        • Research objectives and scope
        • Methods and data sources
        • Primary findings and insights
        • Statistical significance and trends
        • Recommendations and next steps`,

      financial_report: `This appears to be a financial document. Focus on:
        • Key financial metrics and performance indicators
        • Revenue, profit, and growth trends
        • Major financial highlights and concerns
        • Period-over-period comparisons
        • Future outlook and projections`,

      annual_report: `This appears to be an annual report. Please summarize:
        • Company performance overview
        • Financial highlights and key metrics
        • Strategic initiatives and achievements
        • Market position and competitive landscape
        • Future plans and outlook`,

      employment_verification: `This appears to be an employment verification document. Extract:
        • Employee name and position
        • Employment dates and status
        • Salary/compensation information
        • Company details and contact
        • Purpose of verification`,

      legal_contract: `This appears to be a legal contract. Focus on:
        • Parties involved in the agreement
        • Key terms and conditions
        • Rights and obligations of each party
        • Important dates and deadlines
        • Penalties or consequences
        • Termination conditions`,

      invoice_bill: `This appears to be an invoice or bill. Extract:
        • Billing entity and recipient
        • Services or products provided
        • Amounts, taxes, and total due
        • Payment terms and due dates
        • Reference numbers and codes`,

      technical_manual: `This appears to be a technical manual. Summarize:
        • Product or system overview
        • Key features and capabilities
        • Installation and setup procedures
        • Important safety information
        • Troubleshooting guidance`,

      technical_spec: `This appears to be a technical specification. Focus on:
        • System or product requirements
        • Technical specifications and parameters
        • Performance criteria and standards
        • Implementation guidelines
        • Compatibility and dependencies`,

      api_documentation: `This appears to be API documentation. Highlight:
        • API overview and purpose
        • Available endpoints and methods
        • Authentication requirements
        • Request/response formats
        • Code examples and usage`,

      textbook: `This appears to be educational material. Summarize:
        • Main topics and learning objectives
        • Key concepts and theories
        • Important formulas or principles
        • Chapter structure and progression
        • Practical applications`,

      educational_material: `This appears to be educational content. Focus on:
        • Learning goals and objectives
        • Core concepts and topics
        • Structure and organization
        • Assessment methods
        • Required materials or prerequisites`,

      news_article: `This appears to be a news article. Extract:
        • Main news story and headline
        • Key facts and who is involved
        • When and where events occurred
        • Significance and impact
        • Quotes from relevant sources`,

      blog_article: `This appears to be a blog or opinion piece. Highlight:
        • Main argument or perspective
        • Supporting points and evidence
        • Author's conclusions
        • Call to action or recommendations
        • Target audience and purpose`,

      medical_document: `This appears to be a medical document. Focus on:
        • Patient information (if appropriate)
        • Medical findings and diagnoses
        • Treatment recommendations
        • Important medical terminology
        • Follow-up requirements`,

      government_document: `This appears to be a government document. Summarize:
        • Policy or regulation overview
        • Key requirements and compliance
        • Affected parties and stakeholders
        • Implementation timeline
        • Contact information for questions`,

      marketing_material: `This appears to be marketing material. Extract:
        • Product or service being promoted
        • Key benefits and features
        • Target audience
        • Call to action
        • Contact or purchasing information`,

      general_document: `Please provide a structured summary focusing on:
        • Document purpose and main topics
        • Key information and important points
        • Structure and organization
        • Notable details or findings
        • Actionable items or next steps`,
    };

    const instruction =
      typeSpecificInstructions[
        contentType as keyof typeof typeSpecificInstructions
      ] || typeSpecificInstructions.general_document;

    return `${baseInstruction}${instruction}

Format your response with clear headings and bullet points for easy reading. Be concise but comprehensive.

DOCUMENT CONTENT:
${textContent}`;
  }

  // PDF Zoom functions
  function zoomIn() {
    const newScale = Math.min(pdfScale * 1.25, 3.0); // Max 3x zoom
    setPdfScale(newScale);
    if (activeTab && activeTab.pdfBytes) {
      renderPDFPagesWorking(activeTab.pdfBytes, newScale);
    }
  }

  function zoomOut() {
    const newScale = Math.max(pdfScale * 0.8, 0.25); // Min 0.25x zoom
    setPdfScale(newScale);
    if (activeTab && activeTab.pdfBytes) {
      renderPDFPagesWorking(activeTab.pdfBytes, newScale);
    }
  }

  function resetZoom() {
    setPdfScale(1.0);
    if (activeTab && activeTab.pdfBytes) {
      renderPDFPagesWorking(activeTab.pdfBytes, 1.0);
    }
  }

  async function fitToWidth() {
    if (!canvasRef.current || !activeTab || !activeTab.pdfBytes) return;
    try {
      const pdf = await pdfjsLib.getDocument({ data: activeTab.pdfBytes })
        .promise;
      const page = await pdf.getPage(1); // Use first page for scale calculation
      const baseViewport = page.getViewport({ scale: 1.0 });

      const containerWidth =
        canvasRef.current.parentElement?.clientWidth || 800;
      const newScale = (containerWidth - 100) / baseViewport.width;
      setPdfScale(newScale);
      renderPDFPagesWorking(activeTab.pdfBytes, newScale);
      addDebugLog(`Fit to width: scale ${newScale.toFixed(2)}`);
    } catch (error) {
      addDebugLog(`Error in fit to width: ${error}`);
    }
  }

  // Page navigation functions removed - using scrollable view instead

  async function askAI() {
    if (!window.electronAPI || !prompt.trim()) return;

    setAiLoading(true);
    addDebugLog(`Asking AI assistant using Llama...`);

    try {
      // Use Llama for all AI requests (no API key needed)
      const result = await window.electronAPI.askAI(prompt, "llama");
      if (result.success && result.content) {
        setAiReply(result.content);
        addDebugLog("AI response received");
      } else {
        setAiReply(`Error: ${result.error}`);
        addDebugLog(`AI error: ${result.error}`);
      }
    } catch (error) {
      setAiReply(`Error: ${error}`);
      addDebugLog(`AI request failed: ${error}`);
    } finally {
      setAiLoading(false);
    }
  }

  function addNewTab() {
    const newTab: Tab = {
      id: Date.now().toString(),
      title: "New Tab",
      contentType: "web",
      isPDF: false,
      isActive: true,
    };

    setTabs((prev) => [
      ...prev.map((tab) => ({ ...tab, isActive: false })),
      newTab,
    ]);

    // Clear PDF data for new tab (will be set when PDF is loaded)
    // No need to clear tabPdfData as each tab has its own entry

    // Hide browser view for new tab
    if (window.electronAPI) {
      window.electronAPI.hideBrowser();
    }
    setIsWebView(false);
    setCurrentUrl("");
    setOmniboxValue("");
  }

  function switchTab(tabId: string) {
    setTabs((prev) =>
      prev.map((tab) => ({
        ...tab,
        isActive: tab.id === tabId,
      }))
    );

    const tab = tabs.find((t) => t.id === tabId);
    if (tab) {
      // Inform main process which logical tab is active for isolation
      try {
        window.electronAPI?.setActiveTab(tab.id);
      } catch {}

      if (tab.isPDF || tab.contentType === "pdf") {
        // Show Chromium BrowserView for PDF tabs
        setIsWebView(true);
        setCurrentUrl(tab.url || "");
        if (window.electronAPI) {
          // load pdf bytes via loadPdfData when available
          (async () => {
            try {
              if (window.electronAPI) {
                // Prefer loading from filePath for stronger tab isolation
                if (tab.filePath) {
                  await window.electronAPI.loadPdfFile(tab.filePath);
                } else {
                  const bytesForTab = tabPdfData[tab.id]
                    ? tabPdfData[tab.id]
                    : tab.pdfBytes
                    ? Array.from(tab.pdfBytes)
                    : null;
                  if (bytesForTab) {
                    await window.electronAPI.loadPdfData(
                      bytesForTab,
                      tab.fileName || "document.pdf"
                    );
                  }
                }
                await window.electronAPI.showBrowser();
              }
            } catch {}
          })();
        }
      } else if (tab.url) {
        // Show browser for URL tabs
        setIsWebView(true);
        setCurrentUrl(tab.url);
        setOmniboxValue(tab.url);
        if (window.electronAPI) {
          window.electronAPI.showBrowser();
        }
      }
    }
  }

  return (
    <div className={`app ${darkMode ? "dark-theme" : "light-theme"}`}>
      {/* Header */}
      <div className="header">
        <div className="header-left">
          <div className="nav-controls">
            <button className="nav-btn" onClick={goBack} title="Back">
              <ChevronLeftIcon />
            </button>
            <button className="nav-btn" onClick={goForward} title="Forward">
              <ChevronRightIcon />
            </button>
            <button className="nav-btn" onClick={reload} title="Reload">
              <ReloadIcon />
            </button>
            {/* Theme toggle moved to Settings → Appearance */}
            <button className="nav-btn" onClick={addNewTab} title="New Tab">
              <PlusIcon />
            </button>
          </div>
        </div>

        <div className="header-center">
          <form className="omnibox-form" onSubmit={handleOmniboxSubmit}>
            <input
              type="text"
              className="omnibox"
              placeholder="Search or enter URL"
              value={omniboxValue}
              onChange={(e) => setOmniboxValue(e.target.value)}
            />
          </form>
        </div>

        <div className="header-right">
          <button
            className="header-btn"
            onClick={() => navigateToUrl("https://google.com")}
            title="Google"
          >
            <GlobeIcon /> Google
          </button>
          <button
            className="header-btn"
            onClick={() => navigateToUrl("https://github.com")}
            title="GitHub"
          >
            <ExternalLinkIcon /> GitHub
          </button>
          <button
            className="nav-btn"
            onClick={openSettingsTab}
            title="Settings (API Key, Debug)"
          >
            <GearIcon />
          </button>
        </div>
      </div>

      {/* Tab Bar */}
      <div className="tab-bar">
        {tabs.map((tab) => (
          <div
            key={tab.id}
            className={`tab ${tab.isActive ? "active" : ""}`}
            onClick={() => switchTab(tab.id)}
            title={tab.title}
          >
            {tab.isPDF ? (
              <FileTextIcon />
            ) : tab.isSettings ? (
              <GearIcon />
            ) : (
              <GlobeIcon />
            )}
            <span>{tab.title}</span>
            {tabs.length > 1 && (
              <button
                className="tab-close"
                onClick={(e) => {
                  e.stopPropagation();
                  setTabs((prev) => prev.filter((t) => t.id !== tab.id));
                }}
                title="Close tab"
              >
                <Cross2Icon />
              </button>
            )}
          </div>
        ))}
      </div>

      {/* Main Content */}
      <div className="main-content">
        <div className="content-area">
          {/* Browser Loading Indicator - Only show for actual web content, not PDFs */}
          {isWebView &&
            browserLoading &&
            activeTab &&
            activeTab.contentType === "web" && (
              <div className="loading-overlay">
                <div className="loading-spinner">
                  <ReloadIcon className="spinning" />
                  <span>Loading...</span>
                </div>
              </div>
            )}

          {/* Browser Mode Active Indicator - Only show for actual web content, not PDFs */}
          {isWebView && activeTab && activeTab.contentType === "web" && (
            <div className="browser-indicator">
              <GlobeIcon />
              <span>Browser Mode Active</span>
              <span className="url-display">{currentUrl}</span>
            </div>
          )}

          {/* Unified Content Viewer (handles both PDF and web content) */}
          <UnifiedContentViewer
            key={activeTab.id} // Force remount when tab changes
            isActive={
              isWebView || (activeTab && activeTab.contentType === "pdf")
            }
            onFormFieldsDetected={(fields) => {
              console.log("Form fields detected:", fields);
              // Handle form field detection if needed
            }}
            onSave={(fields, pdfData) => {
              if (pdfData) {
                handleUnifiedPDFSave(fields, pdfData);
              }
            }}
            selectedFont={selectedFont}
            selectedFontSize={selectedFontSize}
          />

          {/* Removed legacy PDF viewer - Chromium-only rendering now */}

          {/* Settings Tab */}
          {activeTab && activeTab.isSettings && (
            <div className="settings-tab">
              <div className="settings-content-tab">
                <div className="settings-header-tab">
                  <h2>Settings</h2>
                  <p>Configure your application preferences</p>
                </div>

                <div className="settings-sections">
                  {/* Appearance Section */}
                  <div className="setting-section-tab">
                    <h3>Appearance</h3>
                    <div className="setting-item appearance-card">
                      <div className="theme-choice">
                        <button
                          className={`theme-pill ${
                            !darkMode &&
                            (window as any).__themeSource !== "system"
                              ? "active"
                              : ""
                          }`}
                          onClick={async () => {
                            setDarkMode(false);
                            await window.electronAPI?.setTheme("light");
                            const s = await window.electronAPI?.getSettings();
                            const currentAppearance =
                              s && s.success && s.data
                                ? s.data.appearance || {}
                                : {};
                            (window as any).__themeSource = "light";
                            await window.electronAPI?.updateSettings({
                              appearance: {
                                ...currentAppearance,
                                themeSource: "light",
                              },
                            });
                          }}
                        >
                          <span className="theme-icon">☀️</span> Light
                        </button>
                        <button
                          className={`theme-pill ${
                            (window as any).__themeSource === "system"
                              ? "active"
                              : ""
                          }`}
                          onClick={async () => {
                            const info =
                              await window.electronAPI?.getThemeInfo();
                            const isDark = info?.success
                              ? info.data?.shouldUseDarkColors
                              : darkMode;
                            setDarkMode(!!isDark);
                            await window.electronAPI?.setTheme("system");
                            const s = await window.electronAPI?.getSettings();
                            const currentAppearance =
                              s && s.success && s.data
                                ? s.data.appearance || {}
                                : {};
                            (window as any).__themeSource = "system";
                            await window.electronAPI?.updateSettings({
                              appearance: {
                                ...currentAppearance,
                                themeSource: "system",
                              },
                            });
                          }}
                        >
                          <span className="theme-icon">🖥️</span> Device
                        </button>
                        <button
                          className={`theme-pill ${
                            darkMode &&
                            (window as any).__themeSource !== "system"
                              ? "active"
                              : ""
                          }`}
                          onClick={async () => {
                            setDarkMode(true);
                            await window.electronAPI?.setTheme("dark");
                            const s = await window.electronAPI?.getSettings();
                            const currentAppearance =
                              s && s.success && s.data
                                ? s.data.appearance || {}
                                : {};
                            (window as any).__themeSource = "dark";
                            await window.electronAPI?.updateSettings({
                              appearance: {
                                ...currentAppearance,
                                themeSource: "dark",
                              },
                            });
                          }}
                        >
                          <span className="theme-icon">🌙</span> Dark
                        </button>
                      </div>

                      <div className="appearance-row">
                        <label>Accent color</label>
                        <div className="accent-swatches">
                          {[
                            "#000000",
                            "#11808d",
                            "#b3543b",
                            "#7d3c4a",
                            "#c3132d",
                            "#dc7b00",
                            "#caa300",
                            "#7c8351",
                            "#0f6ea8",
                            "#7a54a1",
                          ].map((c) => (
                            <button
                              key={c}
                              className="swatch"
                              style={{ background: c }}
                              onClick={async () => {
                                document.documentElement.style.setProperty(
                                  "--accent",
                                  c
                                );
                                const s =
                                  await window.electronAPI?.getSettings();
                                const currentAppearance =
                                  s && s.success && s.data
                                    ? s.data.appearance || {}
                                    : {};
                                await window.electronAPI?.updateSettings({
                                  appearance: {
                                    ...currentAppearance,
                                    accentColor: c,
                                  },
                                });
                              }}
                              aria-label={`Accent ${c}`}
                            />
                          ))}
                          {/* Removed free-form color picker per request */}
                        </div>
                      </div>
                    </div>
                  </div>
                  <div className="setting-section-tab">
                    <h3>Local AI Assistant</h3>
                    <div className="setting-item">
                      <p className="ai-description">
                        InkFlow uses Llama 3.2 for local, private AI processing.
                        No internet connection or API keys required - everything
                        runs on your device.
                      </p>

                      <div className="provider-config">
                        <div className="llama-config-compact">
                          <div className="llama-status-info">
                            <p className="status-message">
                              {llamaStatus.message}
                            </p>
                            {llamaStatus.reason === "ollama_not_installed" && (
                              <div className="ollama-install-info">
                                <p>
                                  Ollama is required for local Llama processing.
                                  We can install it automatically for you.
                                </p>

                                {isInstallingOllama ? (
                                  <div className="install-progress">
                                    <div className="install-progress-bar">
                                      <div
                                        className="install-progress-fill"
                                        style={{
                                          width: `${ollamaInstallProgress}%`,
                                        }}
                                      ></div>
                                    </div>
                                    <div className="install-progress-text">
                                      <span className="install-step">
                                        {ollamaInstallStep}
                                      </span>
                                      <span className="install-percentage">
                                        {ollamaInstallProgress}%
                                      </span>
                                    </div>
                                  </div>
                                ) : (
                                  <div className="install-actions">
                                    <button
                                      className="install-ollama-btn"
                                      onClick={async () => {
                                        setIsInstallingOllama(true);
                                        setOllamaInstallProgress(0);
                                        setOllamaInstallStep(
                                          "Starting installation..."
                                        );
                                        addDebugLog(
                                          "Starting automatic Ollama installation..."
                                        );

                                        try {
                                          if (
                                            !window.electronAPI?.installOllama
                                          ) {
                                            addDebugLog(
                                              "Install API not available"
                                            );
                                            setIsInstallingOllama(false);
                                            return;
                                          }

                                          const result =
                                            await window.electronAPI.installOllama();
                                          if (result.success) {
                                            addDebugLog(
                                              `Ollama installed successfully: ${result.message}`
                                            );

                                            // Re-check status after installation
                                            if (
                                              window.electronAPI
                                                ?.checkLlamaModel
                                            ) {
                                              const checkResult =
                                                await window.electronAPI.checkLlamaModel();
                                              if (checkResult.success) {
                                                setLlamaModelDownloaded(
                                                  checkResult.available
                                                );
                                                setLlamaStatus({
                                                  reason:
                                                    checkResult.reason ||
                                                    "unknown",
                                                  message:
                                                    checkResult.message ||
                                                    "Unknown status",
                                                  ollamaInstalled:
                                                    checkResult.reason !==
                                                    "ollama_not_installed",
                                                });
                                              }
                                            }
                                          } else {
                                            addDebugLog(
                                              `Installation failed: ${result.error}`
                                            );
                                          }
                                        } catch (error) {
                                          addDebugLog(
                                            `Installation error: ${error}`
                                          );
                                        } finally {
                                          setIsInstallingOllama(false);
                                        }
                                      }}
                                    >
                                      Install Ollama Automatically
                                    </button>

                                    <button
                                      className="refresh-btn"
                                      onClick={async () => {
                                        // Re-check status
                                        if (
                                          window.electronAPI?.checkLlamaModel
                                        ) {
                                          const result =
                                            await window.electronAPI.checkLlamaModel();
                                          if (result.success) {
                                            setLlamaModelDownloaded(
                                              result.available
                                            );
                                            setLlamaStatus({
                                              reason:
                                                result.reason || "unknown",
                                              message:
                                                result.message ||
                                                "Unknown status",
                                              ollamaInstalled:
                                                result.reason !==
                                                "ollama_not_installed",
                                            });
                                          }
                                        }
                                      }}
                                    >
                                      Refresh Status
                                    </button>

                                    <button
                                      className="permission-btn"
                                      onClick={async () => {
                                        // Check macOS permissions
                                        if (
                                          window.electronAPI
                                            ?.requestMacosPermissions
                                        ) {
                                          const result =
                                            await window.electronAPI.requestMacosPermissions();
                                          if (result.success) {
                                            addDebugLog("macOS permissions OK");
                                          } else {
                                            addDebugLog(
                                              `Permission issue: ${result.message}`
                                            );
                                            if (result.suggestion) {
                                              addDebugLog(
                                                `Suggestion: ${result.suggestion}`
                                              );
                                            }
                                          }
                                        }
                                      }}
                                    >
                                      Check Permissions
                                    </button>
                                  </div>
                                )}
                              </div>
                            )}

                            {/* Ollama Service Test and Install Section */}
                            <div className="ollama-service-section">
                              <h4>Ollama Service</h4>

                              {/* Test Service Button */}
                              <button
                                className="test-service-btn"
                                onClick={async () => {
                                  addDebugLog("Testing Ollama service...");
                                  if (!window.electronAPI) {
                                    addDebugLog("Electron API not available");
                                    return;
                                  }
                                  try {
                                    const testResult =
                                      await window.electronAPI.testOllamaConnection();
                                    if (testResult.success) {
                                      addDebugLog(
                                        `✅ Ollama service is running: ${testResult.message}`
                                      );
                                      setOllamaServiceTestFailed(false);
                                      if (
                                        testResult.models &&
                                        testResult.models.length > 0
                                      ) {
                                        addDebugLog(
                                          `Available models: ${testResult.models
                                            .map((m) => m.name)
                                            .join(", ")}`
                                        );
                                      }
                                    } else {
                                      addDebugLog(
                                        `❌ Ollama service test failed: ${testResult.error}`
                                      );
                                      setOllamaServiceTestFailed(true);
                                    }
                                  } catch (error) {
                                    addDebugLog(
                                      `Error testing Ollama service: ${error}`
                                    );
                                  }
                                }}
                              >
                                Test Service
                              </button>

                              {/* Start Service Button */}
                              <button
                                className="start-service-btn"
                                onClick={async () => {
                                  addDebugLog("Starting Ollama service...");
                                  if (!window.electronAPI) {
                                    addDebugLog("Electron API not available");
                                    return;
                                  }
                                  try {
                                    const result =
                                      await window.electronAPI.startOllamaService();
                                    if (result.success) {
                                      addDebugLog(`✅ ${result.message}`);
                                      setOllamaServiceTestFailed(false);
                                    } else {
                                      addDebugLog(
                                        `❌ Failed to start service: ${result.error}`
                                      );
                                      setOllamaServiceTestFailed(true);
                                    }
                                  } catch (error) {
                                    addDebugLog(
                                      `Error starting Ollama service: ${error}`
                                    );
                                  }
                                }}
                              >
                                Start Service
                              </button>

                              {/* Install Ollama Button */}
                              {(!llamaStatus.ollamaInstalled ||
                                llamaStatus.reason === "ollama_not_installed" ||
                                ollamaServiceTestFailed) && (
                                <button
                                  className="install-ollama-btn"
                                  onClick={async () => {
                                    addDebugLog(
                                      "Starting Ollama installation..."
                                    );
                                    if (!window.electronAPI) {
                                      addDebugLog("Electron API not available");
                                      return;
                                    }
                                    setIsInstallingOllama(true);
                                    setOllamaInstallProgress(0);
                                    setOllamaInstallStep(
                                      "Starting installation..."
                                    );

                                    try {
                                      const result =
                                        await window.electronAPI.installOllama();
                                      if (result.success) {
                                        addDebugLog(
                                          `✅ Ollama installed successfully: ${result.message}`
                                        );
                                        setOllamaServiceTestFailed(false);
                                        // Refresh the Llama status
                                        const statusResult =
                                          await window.electronAPI.checkLlamaModel();
                                        setLlamaStatus({
                                          reason:
                                            statusResult.reason || "unknown",
                                          message:
                                            statusResult.message ||
                                            "Status updated",
                                          ollamaInstalled:
                                            statusResult.reason ===
                                              "model_ready" ||
                                            statusResult.reason ===
                                              "model_not_downloaded",
                                        });
                                      } else {
                                        addDebugLog(
                                          `❌ Ollama installation failed: ${result.error}`
                                        );
                                      }
                                    } catch (error) {
                                      addDebugLog(
                                        `Error installing Ollama: ${error}`
                                      );
                                    } finally {
                                      setIsInstallingOllama(false);
                                    }
                                  }}
                                  disabled={isInstallingOllama}
                                >
                                  {isInstallingOllama
                                    ? "Installing..."
                                    : "Install Ollama"}
                                </button>
                              )}

                              {/* Installation Progress */}
                              {isInstallingOllama && (
                                <div className="install-progress">
                                  <div className="install-progress-bar">
                                    <div
                                      className="install-progress-fill"
                                      style={{
                                        width: `${ollamaInstallProgress}%`,
                                      }}
                                    ></div>
                                  </div>
                                  <div className="install-progress-text">
                                    <span className="install-step">
                                      {ollamaInstallStep}
                                    </span>
                                    <span className="install-percentage">
                                      {ollamaInstallProgress}%
                                    </span>
                                  </div>
                                </div>
                              )}
                            </div>

                            {llamaStatus.ollamaInstalled &&
                              !llamaModelDownloaded && (
                                <div className="model-download-compact">
                                  <p className="download-info-compact">
                                    Download required for local processing
                                    (~4GB)
                                  </p>
                                  {isDownloadingModel ? (
                                    <div className="download-progress-compact">
                                      <div className="progress-bar-compact">
                                        <div
                                          className="progress-fill-compact"
                                          style={{
                                            width: `${modelDownloadProgress}%`,
                                          }}
                                        ></div>
                                      </div>
                                      <span className="progress-text-compact">
                                        {modelDownloadProgress}%
                                      </span>
                                    </div>
                                  ) : (
                                    <button
                                      className="download-btn-compact"
                                      onClick={async () => {
                                        setIsDownloadingModel(true);
                                        setModelDownloadProgress(0);
                                        addDebugLog(
                                          "Starting Llama model download via Ollama..."
                                        );

                                        try {
                                          if (
                                            !window.electronAPI
                                              ?.downloadLlamaModel
                                          ) {
                                            addDebugLog(
                                              "Download API not available"
                                            );
                                            setIsDownloadingModel(false);
                                            return;
                                          }

                                          // Ensure Ollama service is running before downloading
                                          if (
                                            window.electronAPI
                                              ?.startOllamaService
                                          ) {
                                            addDebugLog(
                                              "Starting Ollama service..."
                                            );
                                            const serviceResult =
                                              await window.electronAPI.startOllamaService();
                                            if (serviceResult.success) {
                                              addDebugLog(
                                                "Ollama service started successfully"
                                              );
                                            } else {
                                              addDebugLog(
                                                `Service start warning: ${serviceResult.message}`
                                              );
                                            }
                                          }

                                          const result =
                                            await window.electronAPI.downloadLlamaModel();
                                          if (!result.success) {
                                            setIsDownloadingModel(false);
                                            addDebugLog(
                                              `Download failed: ${result.error}`
                                            );
                                          }
                                        } catch (error) {
                                          setIsDownloadingModel(false);
                                          addDebugLog(
                                            `Download error: ${error}`
                                          );
                                        }
                                      }}
                                    >
                                      Download Model
                                    </button>
                                  )}
                                </div>
                              )}

                            {llamaModelDownloaded && (
                              <div className="model-status-compact">
                                <span className="status-text">
                                  ✓ Model ready for local processing
                                </span>
                                <button
                                  className="redownload-btn"
                                  onClick={() => {
                                    setLlamaModelDownloaded(false);
                                    setLlamaStatus({
                                      reason: "model_not_downloaded",
                                      message: "Model needs to be downloaded",
                                      ollamaInstalled: true,
                                    });
                                  }}
                                >
                                  Re-download
                                </button>
                              </div>
                            )}
                          </div>
                        </div>
                      </div>
                    </div>
                  </div>

                  <div className="setting-section-tab">
                    <h3>Debug Options</h3>
                    <div className="setting-item">
                      <div className="setting-toggle">
                        <label className="toggle-label">
                          <input
                            type="checkbox"
                            checked={debugEnabled}
                            onChange={(e) => setDebugEnabled(e.target.checked)}
                          />
                          <span className="toggle-text">Enable Debug Log</span>
                          <span className="shortcut-badge">Ctrl+D</span>
                        </label>
                      </div>
                      <span className="setting-description">
                        Shows debugging information in footer for
                        troubleshooting
                      </span>
                    </div>
                  </div>

                  <div className="setting-section-tab">
                    <h3>Application Info</h3>
                    <div className="setting-item">
                      <div className="info-grid">
                        <div className="info-item">
                          <span className="info-label">Version</span>
                          <span className="info-value">1.0.0</span>
                        </div>
                        <div className="info-item">
                          <span className="info-label">PDF Engine</span>
                          <span className="info-value">PDF.js 5.4.149</span>
                        </div>
                        <div className="info-item">
                          <span className="info-label">AI Provider</span>
                          <span className="info-value">Llama 3.2 (Local)</span>
                        </div>
                      </div>
                    </div>
                  </div>
                </div>
              </div>
            </div>
          )}

          {/* Welcome Screen */}
          {(!activeTab || (!activeTab.isPDF && !activeTab.isSettings)) &&
            !isWebView && (
              <div className="welcome-screen">
                <h2>Welcome to InkFlow</h2>
                <p>Intelligent PDF analysis and seamless browsing</p>
                <div className="welcome-actions">
                  <button className="action-btn" onClick={openPDF}>
                    <FileTextIcon /> Open PDF
                  </button>
                  <button
                    className="action-btn"
                    onClick={() => navigateToUrl("https://google.com")}
                  >
                    <GlobeIcon /> Browse Web
                  </button>
                </div>
              </div>
            )}
        </div>

        {/* AI Sidebar */}
        <div
          className={`sidebar ${isResizing ? "resizing" : ""}`}
          style={{ width: `${sidebarWidth}px` }}
        >
          {/* Resize handle */}
          <div
            className={`sidebar-resize-handle ${
              sidebarWidth <= 280
                ? "at-min"
                : sidebarWidth >= Math.floor(window.innerWidth * 0.5)
                ? "at-max"
                : ""
            }`}
            onMouseDown={handleMouseDown}
            onDoubleClick={handleDoubleClick}
            title={`Drag to resize sidebar (${sidebarWidth}px / max: ${Math.floor(
              window.innerWidth * 0.5
            )}px) • Double-click to reset`}
          />
          <div className="gemini-header">
            <h1>✨ InkFlow</h1>
          </div>

          <div className="gemini-chat">
            <div className="chat-conversation-area">
              {/* PDF Summary as first message in chat */}
              {activeTab &&
                (activeTab.isPDF || activeTab.contentType === "pdf") &&
                summaryLoading && (
                  <div className="cursor-message loading">
                    <div className="message-header">
                      <div className="message-meta">
                        <span className="assistant-name">AI</span>
                      </div>
                    </div>
                    <div className="message-content loading-content">
                      <div className="typing-indicator">
                        <div className="typing-dots">
                          <span></span>
                          <span></span>
                          <span></span>
                        </div>
                        <span className="typing-text modern-shine">
                          Analyzing document...
                        </span>
                      </div>
                    </div>
                  </div>
                )}

              {activeTab &&
                (activeTab.isPDF || activeTab.contentType === "pdf") &&
                pdfSummary && (
                  <div className="cursor-message">
                    <div className="message-header">
                      <div className="message-meta">
                        <span className="assistant-name">AI</span>
                        <div className="message-actions">
                          <button
                            className="action-icon"
                            onClick={() =>
                              activeTab &&
                              activeTab.pdfBytes &&
                              generatePdfSummary(activeTab.pdfBytes)
                            }
                            title="Regenerate"
                          >
                            <UpdateIcon />
                          </button>
                          <button
                            className="action-icon"
                            onClick={() => copyToClipboard(pdfSummary)}
                            title="Copy"
                          >
                            <CopyIcon />
                          </button>
                        </div>
                      </div>
                    </div>
                    <div className="message-content cursor-markdown">
                      <div className="pdf-summary-header">
                        <LightningBoltIcon />
                        <span>PDF Analysis</span>
                        {detectedContentType && (
                          <span className="content-type-badge">
                            {detectedContentType
                              .replace(/_/g, " ")
                              .replace(/\b\w/g, (l) => l.toUpperCase())}
                          </span>
                        )}
                      </div>
                      <ReactMarkdown
                        remarkPlugins={[remarkGfm]}
                        rehypePlugins={[rehypeRaw]}
                      >
                        {pdfSummary}
                      </ReactMarkdown>
                    </div>
                  </div>
                )}

              {!aiReply &&
                !aiLoading &&
                (!activeTab ||
                  (!activeTab.isPDF && activeTab.contentType !== "pdf")) && (
                  <div className="empty-chat-indicator">
                    Type a message below to start chatting...
                  </div>
                )}

              {aiReply && (
                <div className="cursor-message">
                  <div className="message-header">
                    <div className="message-meta">
                      <span className="assistant-name">AI</span>
                      <div className="message-actions">
                        <button
                          className="action-icon"
                          onClick={() => copyToClipboard(aiReply)}
                          title="Copy"
                        >
                          <CopyIcon />
                        </button>
                      </div>
                    </div>
                  </div>
                  <div className="message-content cursor-markdown">
                    <ReactMarkdown
                      remarkPlugins={[remarkGfm]}
                      rehypePlugins={[rehypeRaw]}
                    >
                      {aiReply}
                    </ReactMarkdown>
                  </div>
                </div>
              )}

              {aiLoading && (
                <div className="cursor-message loading">
                  <div className="message-header">
                    <div className="message-meta">
                      <span className="assistant-name">AI</span>
                    </div>
                  </div>
                  <div className="message-content loading-content">
                    <div className="typing-indicator">
                      <div className="typing-dots">
                        <span></span>
                        <span></span>
                        <span></span>
                      </div>
                      <span className="typing-text">Thinking...</span>
                    </div>
                  </div>
                </div>
              )}
            </div>

            <div className="gemini-input-container">
              <div className="gemini-input">
                <textarea
                  placeholder=""
                  value={prompt}
                  onChange={(e) => {
                    setPrompt(e.target.value);
                    // Auto-expand textarea
                    e.target.style.height = "auto";
                    e.target.style.height =
                      Math.min(e.target.scrollHeight, 200) + "px";
                  }}
                  onKeyDown={(e) => {
                    if (e.key === "Enter" && !e.shiftKey) {
                      e.preventDefault();
                      askAI();
                    }
                  }}
                  disabled={aiLoading}
                />
                <div className="input-actions">
                  <button
                    className="attach-button"
                    title="Attach document"
                    onClick={openPDF}
                  >
                    <PaperPlaneIcon />
                  </button>
                </div>
              </div>
            </div>

            {aiReply && (
              <div className="cursor-message">
                <div className="message-header">
                  <div className="message-meta">
                    <span className="assistant-name">AI</span>
                    <div className="message-actions">
                      <button
                        className="action-icon"
                        onClick={() => copyToClipboard(aiReply)}
                        title="Copy"
                      >
                        <CopyIcon />
                      </button>
                    </div>
                  </div>
                </div>
                <div className="message-content cursor-markdown">
                  <ReactMarkdown
                    remarkPlugins={[remarkGfm]}
                    rehypePlugins={[rehypeRaw]}
                  >
                    {aiReply}
                  </ReactMarkdown>
                </div>
              </div>
            )}
          </div>
        </div>

        {/* Footer Debug Log */}
        {debugEnabled && (
          <div
            className={`footer-debug ${
              debugExpanded ? "expanded" : "collapsed"
            }`}
          >
            <div
              className="footer-debug-header"
              onClick={() => setDebugExpanded(!debugExpanded)}
            >
              <div className="debug-header-left">
                <h4>Debug Log</h4>
                <span className="debug-count">({debugLog.length} entries)</span>
              </div>
              <div className="debug-controls">
                <button
                  className="debug-control-btn"
                  onClick={(e) => {
                    e.stopPropagation();
                    setDebugLog([]);
                  }}
                  title="Clear log"
                >
                  ✕
                </button>
                <button
                  className="debug-control-btn"
                  onClick={(e) => {
                    e.stopPropagation();
                    setDebugExpanded(!debugExpanded);
                  }}
                  title={debugExpanded ? "Collapse" : "Expand"}
                >
                  {debugExpanded ? "−" : "+"}
                </button>
                <button
                  className="debug-control-btn"
                  onClick={(e) => {
                    e.stopPropagation();
                    setDebugEnabled(false);
                  }}
                  title="Close debug"
                >
                  ×
                </button>
              </div>
            </div>
            {debugExpanded && (
              <div className="footer-debug-content">
                {debugLog.length === 0 ? (
                  <div className="debug-empty">No debug messages</div>
                ) : (
                  debugLog.map((log, index) => (
                    <div key={index} className="debug-entry">
                      {log}
                    </div>
                  ))
                )}
              </div>
            )}
          </div>
        )}
      </div>
    </div>
  );
}

export default App;
