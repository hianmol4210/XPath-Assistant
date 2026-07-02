/**
 * Background Service Worker for QA Automation Assistant
 *
 * Responsibilities:
 * - Port-based connections with DevTools panel and content scripts
 * - Tab tracking: maps tabId → { devtoolsPort, contentPort }
 * - Message routing between DevTools panel and content scripts
 * - Connection lifecycle management (connect/disconnect cleanup)
 * - Error handling for missing connections and unavailable tabs
 */

import { MessageType, ExtensionMessage } from '../shared/types';
import { PORT_NAMES } from '../shared/messages';

// --- Types ---

interface TabConnection {
  devtoolsPort: chrome.runtime.Port | null;
  contentPort: chrome.runtime.Port | null;
}

// --- State ---

/** Map of tabId → connected ports for that tab */
const tabConnections = new Map<number, TabConnection>();

// --- Helpers ---

function getOrCreateTabConnection(tabId: number): TabConnection {
  if (!tabConnections.has(tabId)) {
    tabConnections.set(tabId, { devtoolsPort: null, contentPort: null });
  }
  return tabConnections.get(tabId)!;
}

function removeTabConnection(tabId: number): void {
  tabConnections.delete(tabId);
}

/**
 * Safely post a message to a port, handling disconnected port errors.
 */
function safePostMessage(port: chrome.runtime.Port | null, message: ExtensionMessage): boolean {
  if (!port) return false;
  try {
    port.postMessage(message);
    return true;
  } catch (error) {
    console.warn('[ServiceWorker] Failed to post message:', error);
    return false;
  }
}

// --- DevTools Panel Connection ---

function handleDevToolsConnection(port: chrome.runtime.Port): void {
  // DevTools panel sends its inspected tab ID as the first message
  const onFirstMessage = (message: ExtensionMessage & { tabId?: number }) => {
    const tabId = message.tabId;

    if (!tabId) {
      console.warn('[ServiceWorker] DevTools connected without tabId');
      port.onMessage.removeListener(onFirstMessage);
      return;
    }

    const connection = getOrCreateTabConnection(tabId);
    connection.devtoolsPort = port;

    console.log(`[ServiceWorker] DevTools panel connected for tab ${tabId}`);

    // Remove the first-message listener and set up the routing listener
    port.onMessage.removeListener(onFirstMessage);
    port.onMessage.addListener((msg: ExtensionMessage) => {
      handleDevToolsMessage(tabId, msg);
    });

    // Handle DevTools panel disconnection
    port.onDisconnect.addListener(() => {
      handleDevToolsDisconnect(tabId);
    });
  };

  port.onMessage.addListener(onFirstMessage);

  // Handle case where port disconnects before sending tabId
  port.onDisconnect.addListener(() => {
    port.onMessage.removeListener(onFirstMessage);
  });
}

function handleDevToolsMessage(tabId: number, message: ExtensionMessage): void {
  const connection = tabConnections.get(tabId);

  if (!connection) {
    console.warn(`[ServiceWorker] No connection found for tab ${tabId}`);
    return;
  }

  // Route DevTools → Content Script messages
  switch (message.type) {
    case MessageType.START_CAPTURE:
    case MessageType.START_RECORD: {
      const sent = safePostMessage(connection.contentPort, { ...message, tabId });
      if (!sent) {
        console.warn(
          `[ServiceWorker] Content script not connected for tab ${tabId}, trying to inject...`
        );
        // Try to inject content script programmatically
        chrome.scripting.executeScript({
          target: { tabId },
          files: ['content.js'],
        }).then(() => {
          console.log(`[ServiceWorker] Content script injected into tab ${tabId}`);
          // Retry sending after a short delay to allow connection
          setTimeout(() => {
            const conn = tabConnections.get(tabId);
            if (conn?.contentPort) {
              safePostMessage(conn.contentPort, { ...message, tabId });
            } else {
              safePostMessage(connection.devtoolsPort, {
                type: MessageType.STOP_CAPTURE,
                payload: { error: 'Content script not connected' },
              });
            }
          }, 500);
        }).catch((err) => {
          console.warn(`[ServiceWorker] Failed to inject content script:`, err);
          safePostMessage(connection.devtoolsPort, {
            type: MessageType.STOP_CAPTURE,
            payload: { error: 'Content script not connected' },
          });
        });
      }
      break;
    }
    case MessageType.STOP_CAPTURE:
    case MessageType.STOP_RECORD: {
      // Best-effort: send to content script if available, don't error if not
      safePostMessage(connection.contentPort, { ...message, tabId });
      break;
    }
    case MessageType.HIGHLIGHT_ELEMENT: {
      // Best-effort: send to content script if available, silently ignore if not
      safePostMessage(connection.contentPort, { ...message, tabId });
      break;
    }
    default:
      console.warn(`[ServiceWorker] Unknown message type from DevTools: ${message.type}`);
  }
}

function handleDevToolsDisconnect(tabId: number): void {
  const connection = tabConnections.get(tabId);

  if (!connection) return;

  console.log(`[ServiceWorker] DevTools panel disconnected for tab ${tabId}`);

  // Notify content script to stop any active capture/record session
  if (connection.contentPort) {
    safePostMessage(connection.contentPort, { type: MessageType.STOP_CAPTURE });
    safePostMessage(connection.contentPort, { type: MessageType.STOP_RECORD });
  }

  connection.devtoolsPort = null;

  // If content script is also gone, clean up the entry entirely
  if (!connection.contentPort) {
    removeTabConnection(tabId);
  }
}

// --- Content Script Connection ---

function handleContentScriptConnection(port: chrome.runtime.Port): void {
  const tabId = port.sender?.tab?.id;

  if (!tabId) {
    console.warn('[ServiceWorker] Content script connected without tab ID');
    port.disconnect();
    return;
  }

  const connection = getOrCreateTabConnection(tabId);
  connection.contentPort = port;

  console.log(`[ServiceWorker] Content script connected for tab ${tabId}`);

  // Listen for messages from content script
  port.onMessage.addListener((message: ExtensionMessage) => {
    handleContentScriptMessage(tabId, message);
  });

  // Handle content script disconnection
  port.onDisconnect.addListener(() => {
    handleContentScriptDisconnect(tabId);
  });
}

function handleContentScriptMessage(tabId: number, message: ExtensionMessage): void {
  const connection = tabConnections.get(tabId);

  if (!connection) {
    console.warn(`[ServiceWorker] No connection found for tab ${tabId}`);
    return;
  }

  // Route Content Script → DevTools Panel messages
  switch (message.type) {
    case MessageType.ELEMENT_CAPTURED:
    case MessageType.RECORD_EVENT: {
      const sent = safePostMessage(connection.devtoolsPort, { ...message, tabId });
      if (!sent) {
        console.warn(
          `[ServiceWorker] DevTools panel not connected for tab ${tabId}, message: ${message.type}`
        );
      }
      break;
    }
    default:
      console.warn(`[ServiceWorker] Unknown message type from content script: ${message.type}`);
  }
}

function handleContentScriptDisconnect(tabId: number): void {
  const connection = tabConnections.get(tabId);

  if (!connection) return;

  console.log(`[ServiceWorker] Content script disconnected for tab ${tabId}`);

  // Notify DevTools panel that the content script connection was lost
  if (connection.devtoolsPort) {
    safePostMessage(connection.devtoolsPort, {
      type: MessageType.STOP_CAPTURE,
      payload: { error: 'Content script disconnected' },
    });
  }

  connection.contentPort = null;

  // If DevTools is also gone, clean up the entry entirely
  if (!connection.devtoolsPort) {
    removeTabConnection(tabId);
  }
}

// --- Main Connection Listener ---

chrome.runtime.onConnect.addListener((port: chrome.runtime.Port) => {
  switch (port.name) {
    case PORT_NAMES.DEVTOOLS:
      handleDevToolsConnection(port);
      break;
    case PORT_NAMES.CONTENT:
      handleContentScriptConnection(port);
      break;
    default:
      console.warn(`[ServiceWorker] Unknown port name: ${port.name}`);
      port.disconnect();
  }
});

// --- Tab Removal Cleanup ---

chrome.tabs.onRemoved.addListener((tabId: number) => {
  if (tabConnections.has(tabId)) {
    console.log(`[ServiceWorker] Tab ${tabId} removed, cleaning up connections`);
    removeTabConnection(tabId);
  }
});

// --- Simple message handler for content script queries ---
chrome.runtime.onMessage.addListener((message, sender, sendResponse) => {
  if (message.type === 'IS_CAPTURE_ACTIVE') {
    // Check storage and respond
    chrome.storage.local.get(['__qaCaptureActive', '__qaRecordMode'], (result) => {
      sendResponse({
        active: !!result.__qaCaptureActive,
        recordMode: !!result.__qaRecordMode,
      });
    });
    return true; // Keep channel open for async response
  }
  // SET capture state (called from DevTools panel)
  if (message.type === 'SET_CAPTURE_STATE') {
    chrome.storage.local.set({
      __qaCaptureActive: !!message.active,
      __qaRecordMode: !!message.recordMode,
    });
    sendResponse({ ok: true });
    return false;
  }
  // Forward ELEMENT_CAPTURED_FROM_FRAME to DevTools panel if needed
  if (message.type === 'ELEMENT_CAPTURED_FROM_FRAME') {
    // Store in chrome.storage so the DevTools panel can poll for it
    chrome.storage.local.set({ __qaLastCapturedElement: message.payload });
    sendResponse({ ok: true });
    return false;
  }
});

console.log('[ServiceWorker] QA Automation Assistant background service worker initialized');
