import React from "react";
import ReactDOM from "react-dom/client";
import "@/index.css";
import App from "@/App";

// Suppress ResizeObserver errors (common in React with complex UI components)
const resizeObserverError = /ResizeObserver loop/;

// Suppress console errors
const originalConsoleError = console.error;
console.error = (...args) => {
  if (typeof args[0] === 'string' && resizeObserverError.test(args[0])) {
    return;
  }
  originalConsoleError.call(console, ...args);
};

// Suppress window errors for ResizeObserver
window.addEventListener('error', (e) => {
  if (resizeObserverError.test(e.message)) {
    e.stopImmediatePropagation();
    e.preventDefault();
    return false;
  }
});

// Suppress unhandled promise rejections for ResizeObserver
window.addEventListener('unhandledrejection', (e) => {
  if (e.reason && typeof e.reason.message === 'string' && resizeObserverError.test(e.reason.message)) {
    e.stopImmediatePropagation();
    e.preventDefault();
    return false;
  }
});

const root = ReactDOM.createRoot(document.getElementById("root"));
root.render(
  <React.StrictMode>
    <App />
  </React.StrictMode>,
);
