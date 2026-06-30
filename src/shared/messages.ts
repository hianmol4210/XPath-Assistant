/**
 * Message type constants shared between all extension parts
 * (content script, background service worker, DevTools panel)
 *
 * These string constants are used as message identifiers in
 * chrome.runtime.sendMessage and port.postMessage calls.
 */

export const MESSAGES = {
  /** Sent from DevTools to content script to enable capture mode */
  START_CAPTURE: 'START_CAPTURE',
  /** Sent from DevTools to content script to disable capture mode */
  STOP_CAPTURE: 'STOP_CAPTURE',
  /** Sent from content script to DevTools when an element is captured */
  ELEMENT_CAPTURED: 'ELEMENT_CAPTURED',
  /** Sent from DevTools to content script to highlight a specific element */
  HIGHLIGHT_ELEMENT: 'HIGHLIGHT_ELEMENT',
  /** Sent from DevTools to content script to start record mode */
  START_RECORD: 'START_RECORD',
  /** Sent from DevTools to content script to stop record mode */
  STOP_RECORD: 'STOP_RECORD',
  /** Sent from content script to DevTools when a user interaction is recorded */
  RECORD_EVENT: 'RECORD_EVENT',
} as const;

export type MessageKey = keyof typeof MESSAGES;
export type MessageValue = (typeof MESSAGES)[MessageKey];

/**
 * Port names for long-lived connections
 */
export const PORT_NAMES = {
  /** Port name for DevTools panel connection to background */
  DEVTOOLS: 'devtools-panel',
  /** Port name for content script connection to background */
  CONTENT: 'content-script',
} as const;
