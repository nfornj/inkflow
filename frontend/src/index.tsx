/* eslint-disable import/first */
// Force-disable PDF.js worker at app entry to avoid any FakeWorker startup
// issues in Electron. This makes PDF.js render on the main thread.
import * as pdfjsLib from "pdfjs-dist";
// Load the worker bundle so FakeWorker has WorkerMessageHandler registered
// even when GlobalWorkerOptions.workerSrc is false.
// This import is safe in Electron and avoids network requests.
import "pdfjs-dist/build/pdf.worker.min.js";
import React from "react";
if ((pdfjsLib as any)?.GlobalWorkerOptions) {
  (pdfjsLib as any).GlobalWorkerOptions.workerSrc = false as any;
}
if (typeof (pdfjsLib as any).disableWorker !== "undefined") {
  (pdfjsLib as any).disableWorker = true;
}
import ReactDOM from "react-dom/client";
import "./index.css";
import App from "./App";
import reportWebVitals from "./reportWebVitals";

const root = ReactDOM.createRoot(
  document.getElementById("root") as HTMLElement
);
root.render(
  <React.StrictMode>
    <App />
  </React.StrictMode>
);

// If you want to start measuring performance in your app, pass a function
// to log results (for example: reportWebVitals(console.log))
// or send to an analytics endpoint. Learn more: https://bit.ly/CRA-vitals
reportWebVitals();
