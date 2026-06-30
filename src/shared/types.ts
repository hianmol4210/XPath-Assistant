/**
 * Shared type definitions for QA Automation Assistant
 * Used across content script, background service worker, and DevTools panel
 */

/**
 * Message types for communication between extension layers
 */
export enum MessageType {
  START_CAPTURE = 'START_CAPTURE',
  STOP_CAPTURE = 'STOP_CAPTURE',
  ELEMENT_CAPTURED = 'ELEMENT_CAPTURED',
  HIGHLIGHT_ELEMENT = 'HIGHLIGHT_ELEMENT',
  START_RECORD = 'START_RECORD',
  STOP_RECORD = 'STOP_RECORD',
  RECORD_EVENT = 'RECORD_EVENT',
}

/**
 * Element state information
 */
export interface ElementState {
  visible: boolean;
  enabled: boolean;
  checked: boolean;
  selected: boolean;
}

/**
 * Parent/sibling hierarchy information for a captured element
 */
export interface ElementHierarchy {
  parentTag: string;
  parentId: string;
  parentClasses: string[];
  siblingIndex: number;
  totalSiblings: number;
}

/**
 * Captured element data collected from the content script
 */
export interface CapturedElement {
  /** HTML tag name (e.g., 'button', 'input', 'div') */
  tag: string;
  /** Direct text content of the element */
  text: string;
  /** Full inner text including child elements */
  innerText: string;
  /** Element id attribute */
  id: string;
  /** Element name attribute */
  name: string;
  /** CSS class names */
  classes: string[];
  /** All element attributes as key-value pairs */
  attributes: Record<string, string>;
  /** Data attributes (data-*) */
  dataAttributes: Record<string, string>;
  /** ARIA attributes (aria-*) */
  ariaAttributes: Record<string, string>;
  /** Element hierarchy (parent chain and sibling info) */
  hierarchy: ElementHierarchy;
  /** Element state (visible, enabled, checked, selected) */
  state: ElementState;
  /** Timestamp when the element was captured */
  timestamp: number;
}

/**
 * Message payload sent between extension layers
 */
export interface ExtensionMessage {
  type: MessageType;
  payload?: CapturedElement | Record<string, unknown>;
  tabId?: number;
}
