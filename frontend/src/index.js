import React from "react";
import ReactDOM from "react-dom/client";
import "@/index.css";
import App from "@/App";

// Comprehensive ResizeObserver error suppression
const resizeObserverError = /ResizeObserver loop|ResizeObserver loop completed with undelivered notifications/i;

// 1. Suppress console errors
const originalConsoleError = console.error;
console.error = (...args) => {
  const firstArg = args[0];
  if (
    (typeof firstArg === 'string' && resizeObserverError.test(firstArg)) ||
    (firstArg?.message && resizeObserverError.test(firstArg.message))
  ) {
    return;
  }
  originalConsoleError.call(console, ...args);
};

// 2. Suppress window errors
const originalWindowError = window.onerror;
window.onerror = (message, source, lineno, colno, error) => {
  if (
    (typeof message === 'string' && resizeObserverError.test(message)) ||
    (error?.message && resizeObserverError.test(error.message))
  ) {
    return true; // Prevent default error handling
  }
  if (originalWindowError) {
    return originalWindowError(message, source, lineno, colno, error);
  }
  return false;
};

// 3. Suppress error events
window.addEventListener('error', (e) => {
  if (
    (e.message && resizeObserverError.test(e.message)) ||
    (e.error?.message && resizeObserverError.test(e.error.message))
  ) {
    e.stopImmediatePropagation();
    e.preventDefault();
  }
}, true); // Capture phase to catch early

// 4. Suppress unhandled rejections
window.addEventListener('unhandledrejection', (e) => {
  if (e.reason?.message && resizeObserverError.test(e.reason.message)) {
    e.stopImmediatePropagation();
    e.preventDefault();
  }
}, true);

// 5. Override ResizeObserver to suppress errors at source
if (typeof ResizeObserver !== 'undefined') {
  const OriginalResizeObserver = window.ResizeObserver;
  window.ResizeObserver = class extends OriginalResizeObserver {
    constructor(callback) {
      super((entries, observer) => {
        try {
          callback(entries, observer);
        } catch (e) {
          if (!resizeObserverError.test(e.message)) {
            throw e;
          }
          // Silently ignore ResizeObserver errors
        }
      });
    }
  };
}

// 6. Disable React DevTools error overlay for ResizeObserver errors
if (typeof window !== 'undefined') {
  const originalReactDevToolsHook = window.__REACT_DEVTOOLS_GLOBAL_HOOK__;
  if (originalReactDevToolsHook) {
    const originalOnErrored = originalReactDevToolsHook.onErrored;
    window.__REACT_DEVTOOLS_GLOBAL_HOOK__.onErrored = function(error) {
      if (error?.message && resizeObserverError.test(error.message)) {
        return; // Skip this error
      }
      if (originalOnErrored) {
        originalOnErrored.call(this, error);
      }
    };
  }
}

const root = ReactDOM.createRoot(document.getElementById("root"));
root.render(
  <React.StrictMode>
    <App />
  </React.StrictMode>,
);
