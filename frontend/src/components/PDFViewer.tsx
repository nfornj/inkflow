import React, { useState, useCallback } from "react";
import { Document, Page, pdfjs } from "react-pdf";
import "react-pdf/dist/esm/Page/AnnotationLayer.css";
import "react-pdf/dist/esm/Page/TextLayer.css";

// Set up PDF.js worker
pdfjs.GlobalWorkerOptions.workerSrc = `//unpkg.com/pdfjs-dist@${pdfjs.version}/build/pdf.worker.min.js`;

interface PDFViewerProps {
  pdfBytes: Uint8Array;
  onPageChange?: (pageNumber: number) => void;
  onDocumentLoadSuccess?: (numPages: number) => void;
}

const PDFViewer: React.FC<PDFViewerProps> = ({
  pdfBytes,
  onPageChange: onPageChangeProp,
  onDocumentLoadSuccess: onDocumentLoadSuccessProp,
}) => {
  const [numPages, setNumPages] = useState<number>(0);
  const [pageNumber, setPageNumber] = useState<number>(1);
  const [scale, setScale] = useState<number>(1.0);

  const onDocumentLoadSuccess = useCallback(
    ({ numPages }: { numPages: number }) => {
      setNumPages(numPages);
      onDocumentLoadSuccessProp?.(numPages);
    },
    [onDocumentLoadSuccessProp]
  );

  const onPageChange = useCallback(
    (pageNumber: number) => {
      setPageNumber(pageNumber);
      onPageChangeProp?.(pageNumber);
    },
    [onPageChangeProp]
  );

  const goToPrevPage = () => {
    setPageNumber((prev) => Math.max(prev - 1, 1));
  };

  const goToNextPage = () => {
    setPageNumber((prev) => Math.min(prev + 1, numPages));
  };

  const zoomIn = () => {
    setScale((prev) => Math.min(prev + 0.2, 3.0));
  };

  const zoomOut = () => {
    setScale((prev) => Math.max(prev - 0.2, 0.5));
  };

  const resetZoom = () => {
    setScale(1.0);
  };

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
        }}
      >
        <div style={{ display: "flex", alignItems: "center", gap: "10px" }}>
          <button
            onClick={goToPrevPage}
            disabled={pageNumber <= 1}
            style={{
              padding: "5px 10px",
              backgroundColor: pageNumber <= 1 ? "#555" : "#007acc",
              color: "white",
              border: "none",
              borderRadius: "4px",
              cursor: pageNumber <= 1 ? "not-allowed" : "pointer",
            }}
          >
            ← Previous
          </button>
          <span>
            Page {pageNumber} of {numPages}
          </span>
          <button
            onClick={goToNextPage}
            disabled={pageNumber >= numPages}
            style={{
              padding: "5px 10px",
              backgroundColor: pageNumber >= numPages ? "#555" : "#007acc",
              color: "white",
              border: "none",
              borderRadius: "4px",
              cursor: pageNumber >= numPages ? "not-allowed" : "pointer",
            }}
          >
            Next →
          </button>
        </div>

        <div style={{ display: "flex", alignItems: "center", gap: "10px" }}>
          <button
            onClick={zoomOut}
            style={{
              padding: "5px 10px",
              backgroundColor: "#007acc",
              color: "white",
              border: "none",
              borderRadius: "4px",
              cursor: "pointer",
            }}
          >
            Zoom Out
          </button>
          <span>{Math.round(scale * 100)}%</span>
          <button
            onClick={zoomIn}
            style={{
              padding: "5px 10px",
              backgroundColor: "#007acc",
              color: "white",
              border: "none",
              borderRadius: "4px",
              cursor: "pointer",
            }}
          >
            Zoom In
          </button>
          <button
            onClick={resetZoom}
            style={{
              padding: "5px 10px",
              backgroundColor: "#666",
              color: "white",
              border: "none",
              borderRadius: "4px",
              cursor: "pointer",
            }}
          >
            Reset
          </button>
        </div>
      </div>

      {/* PDF Content - Scrollable */}
      <div
        style={{
          flex: 1,
          overflow: "auto",
          padding: "20px",
          display: "flex",
          justifyContent: "center",
          backgroundColor: "#f5f5f5",
        }}
      >
        <Document
          file={{ data: pdfBytes }}
          onLoadSuccess={onDocumentLoadSuccess}
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
          <div
            style={{
              boxShadow: "0 4px 12px rgba(0,0,0,0.15)",
              backgroundColor: "white",
              borderRadius: "8px",
              overflow: "hidden",
            }}
          >
            <Page
              pageNumber={pageNumber}
              scale={scale}
              renderTextLayer={true}
              renderAnnotationLayer={true}
            />
          </div>
        </Document>
      </div>
    </div>
  );
};

export default PDFViewer;
