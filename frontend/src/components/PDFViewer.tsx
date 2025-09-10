import React, { useState, useEffect } from "react";
import { Viewer } from "@react-pdf-viewer/core";
import { defaultLayoutPlugin } from "@react-pdf-viewer/default-layout";
import { toolbarPlugin } from "@react-pdf-viewer/toolbar";
import EnhancedFormOverlay from "./EnhancedFormOverlay";

// Import the styles
import "@react-pdf-viewer/core/lib/styles/index.css";
import "@react-pdf-viewer/default-layout/lib/styles/index.css";
import "@react-pdf-viewer/toolbar/lib/styles/index.css";

interface PDFViewerProps {
  pdfBytes: Uint8Array;
  onPageChange?: (pageNumber: number) => void;
  onDocumentLoadSuccess?: (numPages: number) => void;
  darkMode?: boolean;
  enableFormFilling?: boolean;
  onFormDataChange?: (formData: Record<string, any>) => void;
  onSaveForm?: (formData: Record<string, any>) => void;
}

const PDFViewer: React.FC<PDFViewerProps> = ({
  pdfBytes,
  onPageChange: onPageChangeProp,
  onDocumentLoadSuccess: onDocumentLoadSuccessProp,
  darkMode = false,
  enableFormFilling = false,
  onFormDataChange,
  onSaveForm,
}) => {
  const [pdfData, setPdfData] = useState<Uint8Array | null>(null);

  console.log("PDFViewer: Props received:", {
    pdfBytes: pdfBytes ? pdfBytes.length : "null",
    darkMode,
    enableFormFilling,
    hasOnFormDataChange: !!onFormDataChange,
    hasOnSaveForm: !!onSaveForm,
  });

  // Debug form filling state
  useEffect(() => {
    console.log("PDFViewer: Form filling state changed:", enableFormFilling);
    if (enableFormFilling) {
      console.log(
        "PDFViewer: Rendering FormOverlay with enableFormFilling:",
        enableFormFilling
      );
    } else {
      console.log(
        "PDFViewer: Form filling disabled, not rendering FormOverlay"
      );
    }
  }, [enableFormFilling]);

  // Initialize plugins
  const defaultLayoutPluginInstance = defaultLayoutPlugin({
    sidebarTabs: (defaultTabs) => [
      defaultTabs[0], // Thumbnail tab
      defaultTabs[1], // Bookmark tab
    ],
  });

  const toolbarPluginInstance = toolbarPlugin();

  // Use Uint8Array directly for react-pdf-viewer
  useEffect(() => {
    if (pdfBytes && pdfBytes.length > 0) {
      setPdfData(pdfBytes);
    }
  }, [pdfBytes]);

  // Handle document load success
  const handleDocumentLoad = (e: any) => {
    const { numPages } = e.doc;
    onDocumentLoadSuccessProp?.(numPages);
  };

  // Handle page change
  const handlePageChange = (e: any) => {
    const { currentPage } = e;
    onPageChangeProp?.(currentPage + 1); // Convert to 1-based indexing
  };

  return (
    <div
      style={{
        width: "100%",
        height: "100%",
        display: "flex",
        flexDirection: "column",
        backgroundColor: darkMode ? "#1a1a1a" : "#f5f5f5",
        color: darkMode ? "#ffffff" : "#000000",
        position: "relative",
      }}
    >
      {!pdfData ? (
        <div
          style={{
            display: "flex",
            alignItems: "center",
            justifyContent: "center",
            height: "200px",
            color: darkMode ? "#cccccc" : "#666",
          }}
        >
          Preparing PDF...
        </div>
      ) : (
        <>
          <div
            className={darkMode ? "rpv-core__viewer--dark-theme" : ""}
            style={{
              height: "100%",
              width: "100%",
            }}
          >
            <div
              style={{ padding: "20px", textAlign: "center", color: "#666" }}
            >
              PDF Viewer temporarily disabled to prevent worker loading issues.
              <br />
              Please use the unified PDF viewer instead.
            </div>
          </div>

          {/* Form overlay for interactive form filling */}
          {enableFormFilling && (
            <div
              style={{
                position: "absolute",
                top: 0,
                left: 0,
                width: "100%",
                height: "100%",
                pointerEvents: "none", // Allow clicks to pass through to PDF viewer
                zIndex: 1000,
              }}
            >
              <div style={{ pointerEvents: "auto" }}>
                <EnhancedFormOverlay
                  pdfBytes={pdfBytes}
                  onFormDataChange={onFormDataChange}
                  onSaveForm={onSaveForm}
                />
              </div>
            </div>
          )}
        </>
      )}
    </div>
  );
};

export default PDFViewer;
