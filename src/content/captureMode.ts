/**
 * Capture Mode for QA Automation Assistant
 *
 * Handles element capture interactions:
 * - Highlighting hovered elements with a blue overlay
 * - Capturing element data on click (without exiting capture mode)
 * - Collecting full element info: tag, text, attributes, hierarchy, state
 * - ESC key exits capture mode
 * - Supports multiple sequential captures
 */

import { MessageType, CapturedElement, ElementHierarchy, ElementState } from '../shared/types';

// --- State ---

let isCapturing = false;
let highlightOverlay: HTMLDivElement | null = null;
let currentTarget: Element | null = null;
let port: chrome.runtime.Port | null = null;

// --- Overlay Management ---

function createOverlay(): HTMLDivElement {
  const overlay = document.createElement('div');
  overlay.id = '__qa-automation-highlight-overlay__';
  overlay.style.position = 'fixed';
  overlay.style.pointerEvents = 'none';
  overlay.style.zIndex = '2147483647';
  overlay.style.border = '2px solid #3b82f6';
  overlay.style.backgroundColor = 'rgba(59, 130, 246, 0.1)';
  overlay.style.borderRadius = '2px';
  overlay.style.transition = 'all 0.05s ease-out';
  overlay.style.display = 'none';
  document.documentElement.appendChild(overlay);
  return overlay;
}

function positionOverlay(element: Element): void {
  if (!highlightOverlay) return;

  const rect = element.getBoundingClientRect();
  highlightOverlay.style.top = `${rect.top}px`;
  highlightOverlay.style.left = `${rect.left}px`;
  highlightOverlay.style.width = `${rect.width}px`;
  highlightOverlay.style.height = `${rect.height}px`;
  highlightOverlay.style.display = 'block';
}

function hideOverlay(): void {
  if (highlightOverlay) {
    highlightOverlay.style.display = 'none';
  }
}

function removeOverlay(): void {
  if (highlightOverlay) {
    highlightOverlay.remove();
    highlightOverlay = null;
  }
}

function flashCaptureConfirmation(element: Element): void {
  const rect = element.getBoundingClientRect();
  const flash = document.createElement('div');
  flash.style.position = 'fixed';
  flash.style.pointerEvents = 'none';
  flash.style.zIndex = '2147483647';
  flash.style.border = '2px solid #22c55e';
  flash.style.backgroundColor = 'rgba(34, 197, 94, 0.15)';
  flash.style.borderRadius = '2px';
  flash.style.top = `${rect.top}px`;
  flash.style.left = `${rect.left}px`;
  flash.style.width = `${rect.width}px`;
  flash.style.height = `${rect.height}px`;
  flash.style.transition = 'opacity 0.3s ease-out';
  document.documentElement.appendChild(flash);

  setTimeout(() => {
    flash.style.opacity = '0';
  }, 200);

  setTimeout(() => {
    flash.remove();
  }, 500);
}

// --- Element Data Collection ---

function collectAttributes(element: Element): Record<string, string> {
  const attrs: Record<string, string> = {};
  for (let i = 0; i < element.attributes.length; i++) {
    const attr = element.attributes[i];
    attrs[attr.name] = attr.value;
  }
  return attrs;
}

function collectDataAttributes(attributes: Record<string, string>): Record<string, string> {
  const dataAttrs: Record<string, string> = {};
  for (const [key, value] of Object.entries(attributes)) {
    if (key.startsWith('data-')) {
      dataAttrs[key] = value;
    }
  }
  return dataAttrs;
}

function collectAriaAttributes(attributes: Record<string, string>): Record<string, string> {
  const ariaAttrs: Record<string, string> = {};
  for (const [key, value] of Object.entries(attributes)) {
    if (key.startsWith('aria-')) {
      ariaAttrs[key] = value;
    }
  }
  return ariaAttrs;
}

function collectHierarchy(element: Element): ElementHierarchy {
  const parent = element.parentElement;

  const parentTag = parent ? parent.tagName.toLowerCase() : '';
  const parentId = parent ? parent.id || '' : '';
  const parentClasses = parent ? Array.from(parent.classList) : [];

  // Calculate sibling index and total siblings (same tag type)
  let siblingIndex = 0;
  let totalSiblings = 0;

  if (parent) {
    const children = Array.from(parent.children);
    totalSiblings = children.length;
    siblingIndex = children.indexOf(element);
  }

  return {
    parentTag,
    parentId,
    parentClasses,
    siblingIndex,
    totalSiblings,
  };
}

function collectState(element: Element): ElementState {
  const htmlElement = element as HTMLElement;
  const rect = element.getBoundingClientRect();
  const computedStyle = window.getComputedStyle(element);

  const visible =
    rect.width > 0 &&
    rect.height > 0 &&
    computedStyle.visibility !== 'hidden' &&
    computedStyle.display !== 'none' &&
    computedStyle.opacity !== '0';

  const enabled = !(element as HTMLInputElement).disabled;
  const checked = (element as HTMLInputElement).checked || false;
  const selected = (element as HTMLOptionElement).selected || false;

  return {
    visible,
    enabled,
    checked,
    selected,
  };
}

function collectElementData(element: Element): CapturedElement {
  const htmlElement = element as HTMLElement;
  const attributes = collectAttributes(element);

  return {
    tag: element.tagName.toLowerCase(),
    text: element.textContent?.trim().substring(0, 200) || '',
    innerText: htmlElement.innerText?.trim().substring(0, 500) || '',
    id: element.id || '',
    name: element.getAttribute('name') || '',
    classes: Array.from(element.classList),
    attributes,
    dataAttributes: collectDataAttributes(attributes),
    ariaAttributes: collectAriaAttributes(attributes),
    hierarchy: collectHierarchy(element),
    state: collectState(element),
    timestamp: Date.now(),
  };
}

// --- Event Handlers ---

function onMouseMove(event: MouseEvent): void {
  const target = event.target as Element;
  if (!target || target === highlightOverlay) return;

  currentTarget = target;
  positionOverlay(target);
}

function onClick(event: MouseEvent): void {
  event.preventDefault();
  event.stopPropagation();
  event.stopImmediatePropagation();

  const target = event.target as Element;
  if (!target || target === highlightOverlay) return;

  // Collect element data
  const elementData = collectElementData(target);

  // Send captured element data through port
  if (port) {
    port.postMessage({
      type: MessageType.ELEMENT_CAPTURED,
      payload: elementData,
    });
  }

  // Flash green border to confirm capture
  flashCaptureConfirmation(target);

  // Do NOT exit capture mode — allow multiple captures in sequence
}

function onKeyDown(event: KeyboardEvent): void {
  if (event.key === 'Escape') {
    event.preventDefault();
    event.stopPropagation();
    stopCapture();

    // Notify background/devtools that capture was stopped via ESC
    if (port) {
      port.postMessage({
        type: MessageType.STOP_CAPTURE,
      });
    }
  }
}

// --- Public API ---

/**
 * Start capture mode: attaches event listeners for hover highlighting,
 * click capture, and ESC key exit.
 */
export function startCapture(connectionPort: chrome.runtime.Port): void {
  if (isCapturing) return;

  isCapturing = true;
  port = connectionPort;

  // Create the highlight overlay
  highlightOverlay = createOverlay();

  // Add event listeners
  document.addEventListener('mousemove', onMouseMove, true);
  document.addEventListener('click', onClick, true);
  document.addEventListener('keydown', onKeyDown, true);

  console.log('[QA Automation] Capture mode started');
}

/**
 * Stop capture mode: removes all event listeners and cleans up the overlay.
 */
export function stopCapture(): void {
  if (!isCapturing) return;

  isCapturing = false;
  currentTarget = null;

  // Remove event listeners
  document.removeEventListener('mousemove', onMouseMove, true);
  document.removeEventListener('click', onClick, true);
  document.removeEventListener('keydown', onKeyDown, true);

  // Remove overlay
  removeOverlay();

  console.log('[QA Automation] Capture mode stopped');
}

/**
 * Returns whether capture mode is currently active.
 */
export function isCaptureModeActive(): boolean {
  return isCapturing;
}
