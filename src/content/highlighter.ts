/**
 * Highlighter Module for QA Automation Assistant
 *
 * A standalone, reusable module for highlighting elements on the page.
 * Used by both captureMode.ts (during capture workflow) and contentScript.ts
 * (when DevTools panel requests highlight via HIGHLIGHT_ELEMENT messages).
 *
 * Features:
 * - Fixed-position overlay with pointer-events:none, max z-index
 * - Two modes: 'hover' (blue) and 'selection' (green)
 * - Element info tooltip showing tag name + short text snippet
 * - XPath-based highlighting for DevTools panel integration
 * - Full cleanup/dispose support
 */

// --- Types ---

export type HighlightMode = 'hover' | 'selection';

// --- Constants ---

const OVERLAY_ID = '__qa-automation-highlighter-overlay__';
const TOOLTIP_ID = '__qa-automation-highlighter-tooltip__';

const STYLES = {
  hover: {
    border: '2px solid #3b82f6',
    background: 'rgba(59, 130, 246, 0.1)',
  },
  selection: {
    border: '2px solid #22c55e',
    background: 'rgba(34, 197, 94, 0.1)',
  },
} as const;

const TOOLTIP_MAX_TEXT_LENGTH = 30;

// --- State ---

let overlayElement: HTMLDivElement | null = null;
let tooltipElement: HTMLDivElement | null = null;
let currentHighlightedElement: Element | null = null;
let currentMode: HighlightMode = 'hover';

// --- Overlay Creation ---

function getOrCreateOverlay(): HTMLDivElement {
  if (overlayElement) return overlayElement;

  const overlay = document.createElement('div');
  overlay.id = OVERLAY_ID;
  overlay.style.position = 'fixed';
  overlay.style.pointerEvents = 'none';
  overlay.style.zIndex = '2147483647';
  overlay.style.borderRadius = '2px';
  overlay.style.transition = 'all 0.05s ease-out';
  overlay.style.display = 'none';
  overlay.style.boxSizing = 'border-box';
  document.documentElement.appendChild(overlay);

  overlayElement = overlay;
  return overlay;
}

function getOrCreateTooltip(): HTMLDivElement {
  if (tooltipElement) return tooltipElement;

  const tooltip = document.createElement('div');
  tooltip.id = TOOLTIP_ID;
  tooltip.style.position = 'fixed';
  tooltip.style.pointerEvents = 'none';
  tooltip.style.zIndex = '2147483647';
  tooltip.style.display = 'none';
  tooltip.style.backgroundColor = '#1e1e2e';
  tooltip.style.color = '#e2e8f0';
  tooltip.style.fontSize = '11px';
  tooltip.style.fontFamily = 'monospace';
  tooltip.style.padding = '4px 8px';
  tooltip.style.borderRadius = '4px';
  tooltip.style.whiteSpace = 'nowrap';
  tooltip.style.boxShadow = '0 2px 8px rgba(0, 0, 0, 0.3)';
  tooltip.style.maxWidth = '300px';
  tooltip.style.overflow = 'hidden';
  tooltip.style.textOverflow = 'ellipsis';
  document.documentElement.appendChild(tooltip);

  tooltipElement = tooltip;
  return tooltip;
}

// --- Overlay Positioning ---

function positionOverlayOnElement(element: Element, mode: HighlightMode): void {
  const overlay = getOrCreateOverlay();
  const rect = element.getBoundingClientRect();

  // Apply mode-specific styles
  const style = STYLES[mode];
  overlay.style.border = style.border;
  overlay.style.backgroundColor = style.background;

  // Position overlay to match element bounds
  overlay.style.top = `${rect.top}px`;
  overlay.style.left = `${rect.left}px`;
  overlay.style.width = `${rect.width}px`;
  overlay.style.height = `${rect.height}px`;
  overlay.style.display = 'block';
}

function positionTooltipNearElement(element: Element): void {
  const tooltip = getOrCreateTooltip();
  const rect = element.getBoundingClientRect();

  // Build tooltip content: <tag> text snippet
  const tag = element.tagName.toLowerCase();
  const textContent = (element.textContent || '').trim();
  const snippet = textContent.length > TOOLTIP_MAX_TEXT_LENGTH
    ? textContent.substring(0, TOOLTIP_MAX_TEXT_LENGTH) + '…'
    : textContent;

  const tooltipText = snippet
    ? `<${tag}> ${snippet}`
    : `<${tag}>`;

  tooltip.textContent = tooltipText;
  tooltip.style.display = 'block';

  // Position: prefer above the element, fall back to below if not enough space
  const tooltipHeight = 24; // approximate height
  const gap = 6;

  if (rect.top > tooltipHeight + gap) {
    // Position above
    tooltip.style.top = `${rect.top - tooltipHeight - gap}px`;
  } else {
    // Position below
    tooltip.style.top = `${rect.bottom + gap}px`;
  }

  // Align horizontally to the left of the element, clamp to viewport
  let leftPos = rect.left;
  const tooltipWidth = tooltip.offsetWidth || 200;
  if (leftPos + tooltipWidth > window.innerWidth) {
    leftPos = window.innerWidth - tooltipWidth - 8;
  }
  if (leftPos < 4) {
    leftPos = 4;
  }
  tooltip.style.left = `${leftPos}px`;
}

// --- XPath Evaluation ---

function findElementByXpath(xpath: string): Element | null {
  try {
    const result = document.evaluate(
      xpath,
      document,
      null,
      XPathResult.FIRST_ORDERED_NODE_TYPE,
      null
    );
    return result.singleNodeValue as Element | null;
  } catch (error) {
    console.warn('[QA Automation] Invalid XPath expression:', xpath, error);
    return null;
  }
}

// --- Public API ---

/**
 * Highlight a specific DOM element with an overlay and tooltip.
 * @param element - The DOM element to highlight
 * @param mode - 'hover' for blue highlight, 'selection' for green highlight
 */
export function highlightElement(element: Element, mode: HighlightMode = 'hover'): void {
  currentHighlightedElement = element;
  currentMode = mode;

  positionOverlayOnElement(element, mode);
  positionTooltipNearElement(element);
}

/**
 * Find an element by XPath and highlight it.
 * @param xpath - XPath expression to locate the element
 * @param mode - 'hover' for blue highlight, 'selection' for green highlight
 * @returns true if element was found and highlighted, false otherwise
 */
export function highlightByXpath(xpath: string, mode: HighlightMode = 'hover'): boolean {
  const element = findElementByXpath(xpath);
  if (!element) {
    console.warn('[QA Automation] Element not found for XPath:', xpath);
    return false;
  }

  highlightElement(element, mode);
  return true;
}

/**
 * Remove the highlight overlay and tooltip from the page.
 */
export function clearHighlight(): void {
  currentHighlightedElement = null;

  if (overlayElement) {
    overlayElement.style.display = 'none';
  }

  if (tooltipElement) {
    tooltipElement.style.display = 'none';
  }
}

/**
 * Full cleanup: removes overlay and tooltip elements from the DOM.
 * Call this when the highlighter is no longer needed.
 */
export function dispose(): void {
  clearHighlight();

  if (overlayElement) {
    overlayElement.remove();
    overlayElement = null;
  }

  if (tooltipElement) {
    tooltipElement.remove();
    tooltipElement = null;
  }

  currentHighlightedElement = null;
}

/**
 * Returns the currently highlighted element, if any.
 */
export function getCurrentHighlightedElement(): Element | null {
  return currentHighlightedElement;
}

/**
 * Returns the current highlight mode.
 */
export function getCurrentMode(): HighlightMode {
  return currentMode;
}
