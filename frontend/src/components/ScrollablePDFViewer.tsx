import React, { useState, useCallback } from "react";
import { Document, Page, pdfjs } from "react-pdf";
import "react-pdf/dist/Page/AnnotationLayer.css";
import "react-pdf/dist/Page/TextLayer.css";

// Set up PDF.js worker
pdfjs.GlobalWorkerOptions.workerSrc = `//unpkg.com/pdfjs-dist@${pdfjs.version}/build/pdf.worker.min.js`;

interface ScrollablePDFViewerProps {
  pdfBytes: Uint8Array;
  onDocumentLoadSuccess?: (numPages: number) => void;
}

const ScrollablePDFViewer: React.FC<ScrollablePDFViewerProps> = ({
  pdfBytes,
  onDocumentLoadSuccess: onDocumentLoadSuccessProp,
}) => {
  const [numPages, setNumPages] = useState<number>(0);
  const [scale, setScale] = useState<number>(1.0);
  const [isLoading, setIsLoading] = useState<boolean>(true);

  // Convert Uint8Array to Blob URL for react-pdf
  const [pdfUrl, setPdfUrl] = React.useState<string | null>(null);

  React.useEffect(() => {
    console.log("PDF bytes received:", pdfBytes);
    console.log("PDF bytes type:", typeof pdfBytes);
    console.log("PDF bytes length:", pdfBytes?.length);
    console.log("PDF bytes constructor:", pdfBytes?.constructor?.name);

    if (pdfBytes && pdfBytes.length > 0) {
      try {
        // Convert Uint8Array to Blob
        const blob = new Blob([pdfBytes], { type: "application/pdf" });
        const url = URL.createObjectURL(blob);
        console.log("Created PDF blob URL:", url);
        setPdfUrl(url);
      } catch (error) {
        console.error("Error creating PDF blob:", error);
      }
    }
  }, [pdfBytes]);

  // Cleanup blob URL on unmount
  React.useEffect(() => {
    return () => {
      if (pdfUrl) {
        URL.revokeObjectURL(pdfUrl);
      }
    };
  }, [pdfUrl]);

  const onDocumentLoadSuccess = useCallback(
    ({ numPages }: { numPages: number }) => {
      console.log("PDF loaded successfully with", numPages, "pages");
      setNumPages(numPages);
      setIsLoading(false);
      onDocumentLoadSuccessProp?.(numPages);
    },
    [onDocumentLoadSuccessProp]
  );

  const onDocumentLoadError = useCallback((error: Error) => {
    console.error("PDF load error:", error);
    setIsLoading(false);
  }, []);

  const zoomIn = () => {
    setScale((prev) => Math.min(prev + 0.2, 3.0));
  };

  const zoomOut = () => {
    setScale((prev) => Math.max(prev - 0.2, 0.5));
  };

  const resetZoom = () => {
    setScale(1.0);
  };

  const fitToWidth = () => {
    // This would need to be calculated based on container width
    setScale(1.0);
  };

  if (isLoading || !pdfUrl) {
    return (
      <div
        style={{
          display: "flex",
          alignItems: "center",
          justifyContent: "center",
          height: "100%",
          color: "#666",
          fontSize: "18px",
        }}
      >
        {!pdfUrl ? "Preparing PDF..." : "Loading PDF..."}
      </div>
    );
  }

  return (
    <div
      style={{
        width: "100%",
        height: "100%",
        display: "flex",
        flexDirection: "column",
        backgroundColor: "#f5f5f5",
      }}
    >
      {/* Toolbar */}
      <div
        style={{
          display: "flex",
          alignItems: "center",
          justifyContent: "space-between",
          padding: "10px 20px",
          backgroundColor: "#2a2a2a",
          color: "white",
          borderBottom: "1px solid #444",
          flexShrink: 0,
        }}
      >
        <div style={{ display: "flex", alignItems: "center", gap: "10px" }}>
          <span style={{ fontSize: "16px", fontWeight: "500" }}>
            {numPages} pages - Scroll to navigate
          </span>
        </div>

        <div style={{ display: "flex", alignItems: "center", gap: "10px" }}>
          <button
            onClick={zoomOut}
            style={{
              padding: "8px 12px",
              backgroundColor: "#007acc",
              color: "white",
              border: "none",
              borderRadius: "4px",
              cursor: "pointer",
              fontSize: "14px",
            }}
          >
            Zoom Out
          </button>
          <span style={{ minWidth: "60px", textAlign: "center" }}>
            {Math.round(scale * 100)}%
          </span>
          <button
            onClick={zoomIn}
            style={{
              padding: "8px 12px",
              backgroundColor: "#007acc",
              color: "white",
              border: "none",
              borderRadius: "4px",
              cursor: "pointer",
              fontSize: "14px",
            }}
          >
            Zoom In
          </button>
          <button
            onClick={fitToWidth}
            style={{
              padding: "8px 12px",
              backgroundColor: "#666",
              color: "white",
              border: "none",
              borderRadius: "4px",
              cursor: "pointer",
              fontSize: "14px",
            }}
          >
            Fit to Width
          </button>
          <button
            onClick={resetZoom}
            style={{
              padding: "8px 12px",
              backgroundColor: "#666",
              color: "white",
              border: "none",
              borderRadius: "4px",
              cursor: "pointer",
              fontSize: "14px",
            }}
          >
            Reset
          </button>
        </div>
      </div>

      {/* PDF Content - Scrollable with all pages */}
      <div
        style={{
          flex: 1,
          overflow: "auto",
          padding: "20px",
          backgroundColor: "#f5f5f5",
        }}
      >
        <div
          style={{
            display: "flex",
            flexDirection: "column",
            alignItems: "center",
            gap: "20px",
            minHeight: "100%",
          }}
        >
          <Document
            file={pdfUrl}
            onLoadSuccess={onDocumentLoadSuccess}
            onLoadError={onDocumentLoadError}
            loading={
              <div
                style={{
                  display: "flex",
                  alignItems: "center",
                  justifyContent: "center",
                  height: "200px",
                  color: "#666",
                }}
              >
                Loading PDF...
              </div>
            }
            error={
              <div
                style={{
                  display: "flex",
                  alignItems: "center",
                  justifyContent: "center",
                  height: "200px",
                  color: "#ff6b6b",
                }}
              >
                Error loading PDF
              </div>
            }
          >
            {Array.from(new Array(numPages), (el, index) => (
              <div
                key={`page_${index + 1}`}
                style={{
                  display: "flex",
                  flexDirection: "column",
                  alignItems: "center",
                  gap: "10px",
                }}
              >
                <div
                  style={{
                    color: "#666",
                    fontSize: "14px",
                    fontWeight: "500",
                    textAlign: "center",
                  }}
                >
                  Page {index + 1} of {numPages}
                </div>
                <div
                  style={{
                    boxShadow: "0 4px 12px rgba(0,0,0,0.15)",
                    backgroundColor: "white",
                    borderRadius: "8px",
                    overflow: "hidden",
                  }}
                >
                  <Page
                    pageNumber={index + 1}
                    scale={scale}
                    renderTextLayer={true}
                    renderAnnotationLayer={true}
                  />
                </div>
              </div>
            ))}
          </Document>
        </div>
      </div>
    </div>
  );
};

export default ScrollablePDFViewer;
