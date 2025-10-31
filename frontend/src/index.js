import React from "react";
import ReactDOM from "react-dom/client";
import "@/index.css";
import App from "@/App";

// Suppress ResizeObserver errors (common in React with complex UI components)
const resizeObserverError = /ResizeObserver loop/;
const originalConsoleError = console.error;
console.error = (...args) => {
  if (typeof args[0] === 'string' && resizeObserverError.test(args[0])) {
    return;
  }
  originalConsoleError.call(console, ...args);
};

const root = ReactDOM.createRoot(document.getElementById("root"));
root.render(
  <React.StrictMode>
    <App />
  </React.StrictMode>,
);
