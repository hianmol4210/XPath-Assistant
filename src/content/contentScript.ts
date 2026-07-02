/**
 * Content Script for QA Automation Assistant
 *
 * Injected into ALL frames (including cross-origin iframes) via manifest.
 * Listens for START_CAPTURE/STOP_CAPTURE messages and handles element picking.
 * Sends captured element data back via chrome.runtime.sendMessage.
 *
 * This is the IFRAME solution — it works in every frame Chrome injects it into.
 */

// --- State ---
let isCapturing = false;
let isRecordMode = false;
let overlay: HTMLDivElement | null = null;
let lastHoveredElement: Element | null = null;

// --- Overlay ---
function createOverlay(): HTMLDivElement {
  const el = document.createElement('div');
  el.style.cssText = 'position:fixed;pointer-events:none;z-index:2147483647;border:2px solid #3b82f6;background:rgba(59,130,246,0.1);border-radius:2px;display:none;transition:all 0.05s ease-out;';
  document.documentElement.appendChild(el);
  return el;
}

// --- Element Data Collection ---
function collectElementData(el: Element) {
  const attrs: Record<string, string> = {};
  for (let i = 0; i < el.attributes.length; i++) {
    attrs[el.attributes[i].name] = el.attributes[i].value;
  }
  const dataAttrs: Record<string, string> = {};
  const ariaAttrs: Record<string, string> = {};
  Object.keys(attrs).forEach(k => {
    if (k.startsWith('data-')) dataAttrs[k] = attrs[k];
    if (k.startsWith('aria-')) ariaAttrs[k] = attrs[k];
  });

  const parent = el.parentElement;
  const siblings = parent ? Array.from(parent.children) : [];
  const rect = el.getBoundingClientRect();
  const style = window.getComputedStyle(el);

  return {
    tag: el.tagName.toLowerCase(),
    text: (el.textContent || '').substring(0, 200),
    innerText: ((el as HTMLElement).innerText || '').substring(0, 500),
    id: el.id || '',
    name: el.getAttribute('name') || '',
    classes: Array.from(el.classList),
    attributes: attrs,
    dataAttributes: dataAttrs,
    ariaAttributes: ariaAttrs,
    hierarchy: {
      parentTag: parent ? parent.tagName.toLowerCase() : '',
      parentId: parent ? (parent.id || '') : '',
      parentClasses: parent ? Array.from(parent.classList) : [],
      siblingIndex: siblings.indexOf(el),
      totalSiblings: siblings.length,
    },
    state: {
      visible: rect.width > 0 && rect.height > 0 && style.visibility !== 'hidden' && style.display !== 'none',
      enabled: !(el as HTMLInputElement).disabled,
      checked: !!(el as HTMLInputElement).checked,
      selected: !!(el as HTMLOptionElement).selected,
    },
    timestamp: Date.now(),
    _isInIframe: window !== window.top,
    _frameUrl: window.location.href,
  };
}

// --- Event Handlers ---
function onMouseMove(e: MouseEvent) {
  if (!overlay) return;
  overlay.style.display = 'none';
  const el = document.elementFromPoint(e.clientX, e.clientY);
  if (!el) { overlay.style.display = 'none'; return; }
  overlay.style.display = 'block';
  lastHoveredElement = el;
  const rect = el.getBoundingClientRect();
  overlay.style.top = `${rect.top}px`;
  overlay.style.left = `${rect.left}px`;
  overlay.style.width = `${rect.width}px`;
  overlay.style.height = `${rect.height}px`;
}

function onClick(e: MouseEvent) {
  if (!isRecordMode) {
    e.preventDefault();
    e.stopPropagation();
    e.stopImmediatePropagation();
  }

  const el = lastHoveredElement || document.elementFromPoint(e.clientX, e.clientY);
  if (!el) return;

  // Debounce
  const now = Date.now();
  if ((window as any).__qaLastCapTime && (now - (window as any).__qaLastCapTime) < 300) return;
  (window as any).__qaLastCapTime = now;

  const data = collectElementData(el);

  // Flash green
  if (overlay) {
    overlay.style.border = '2px solid #22c55e';
    overlay.style.background = 'rgba(34,197,94,0.15)';
    setTimeout(() => {
      if (overlay) {
        overlay.style.border = isRecordMode ? '2px solid #ef4444' : '2px solid #3b82f6';
        overlay.style.background = isRecordMode ? 'rgba(239,68,68,0.08)' : 'rgba(59,130,246,0.1)';
      }
    }, 300);
  }

  // Send data back to extension
  try {
    chrome.runtime.sendMessage({
      type: 'ELEMENT_CAPTURED_FROM_FRAME',
      payload: data,
    });
  } catch (err) {
    // Extension might be reloaded
  }
}

// --- Start / Stop ---
function startPicker(recordMode: boolean) {
  if (isCapturing) return;
  isCapturing = true;
  isRecordMode = recordMode;

  overlay = createOverlay();
  if (recordMode) {
    overlay.style.border = '2px solid #ef4444';
    overlay.style.background = 'rgba(239,68,68,0.08)';
  }

  document.addEventListener('mousemove', onMouseMove, true);
  if (recordMode) {
    document.addEventListener('click', onClick, false); // no capture phase = pass-through
  } else {
    document.addEventListener('mousedown', onClick, true);
    document.addEventListener('pointerdown', onClick, true);
    document.addEventListener('click', onClick, true);
  }
}

function stopPicker() {
  if (!isCapturing) return;
  isCapturing = false;

  document.removeEventListener('mousemove', onMouseMove, true);
  document.removeEventListener('mousedown', onClick, true);
  document.removeEventListener('pointerdown', onClick, true);
  document.removeEventListener('click', onClick, true);
  document.removeEventListener('click', onClick, false);

  if (overlay) {
    overlay.remove();
    overlay = null;
  }
  lastHoveredElement = null;
}

// --- Message Listener ---
chrome.runtime.onMessage.addListener((message, _sender, sendResponse) => {
  if (message.type === 'START_CAPTURE') {
    chrome.storage.local.set({ __qaCaptureActive: true, __qaRecordMode: false });
    startPicker(false);
    sendResponse({ ok: true });
  } else if (message.type === 'START_RECORD') {
    chrome.storage.local.set({ __qaCaptureActive: true, __qaRecordMode: true });
    startPicker(true);
    sendResponse({ ok: true });
  } else if (message.type === 'STOP_CAPTURE') {
    chrome.storage.local.set({ __qaCaptureActive: false, __qaRecordMode: false });
    stopPicker();
    sendResponse({ ok: true });
  }
  return false;
});

// Auto-start if capture was already active (handles iframe reloads and navigation)
try {
  chrome.storage.local.get(['__qaCaptureActive', '__qaRecordMode'], (result) => {
    if (result.__qaCaptureActive) {
      startPicker(!!result.__qaRecordMode);
    }
  });
} catch (e) {
  // storage might not be available
}

// Auto-cleanup if extension context invalidates
try {
  chrome.runtime.id;
} catch (e) {
  stopPicker();
}
