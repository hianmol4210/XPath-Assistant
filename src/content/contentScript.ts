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

// --- Smart XPath Generator (runs on the live page, tests uniqueness) ---
function isDynamicAttr(value: string): boolean {
  if (!value) return true;
  if (/[0-9a-f]{8}-[0-9a-f]{4}/i.test(value)) return true;
  if (/^_ng|^cdk-|^mat-|^mdc-|^react-|^:r/.test(value)) return true;
  if (/[-_]\d+$/.test(value) || /^\d+[-_]/.test(value)) return true;
  if (/\d+-\d+/.test(value)) return true;
  if (value.length <= 2) return true;
  return false;
}

function countMatches(xpath: string): number {
  try {
    const result = document.evaluate(xpath, document, null, XPathResult.ORDERED_NODE_SNAPSHOT_TYPE, null);
    return result.snapshotLength;
  } catch { return -1; }
}

function generateSmartXpath(el: Element): string {
  const tag = el.tagName.toLowerCase();
  const candidates: string[] = [];

  // Strategy 1: ID (if stable)
  if (el.id && !isDynamicAttr(el.id)) {
    const xpath = `//*[@id='${el.id}']`;
    if (countMatches(xpath) === 1) return xpath;
  }

  // Strategy 2: aria-label
  const ariaLabel = el.getAttribute('aria-label');
  if (ariaLabel && !isDynamicAttr(ariaLabel)) {
    const xpath = `//${tag}[@aria-label='${ariaLabel}']`;
    if (countMatches(xpath) === 1) return xpath;
    candidates.push(xpath);
  }

  // Strategy 3: placeholder
  const placeholder = el.getAttribute('placeholder');
  if (placeholder) {
    const xpath = `//${tag}[@placeholder='${placeholder}']`;
    if (countMatches(xpath) === 1) return xpath;
    candidates.push(xpath);
  }

  // Strategy 4: name
  const name = el.getAttribute('name');
  if (name && !isDynamicAttr(name)) {
    const xpath = `//${tag}[@name='${name}']`;
    if (countMatches(xpath) === 1) return xpath;
    candidates.push(xpath);
  }

  // Strategy 5: formcontrolname (Angular)
  const fcn = el.getAttribute('formcontrolname');
  if (fcn && !isDynamicAttr(fcn)) {
    const xpath = `//${tag}[@formcontrolname='${fcn}']`;
    if (countMatches(xpath) === 1) return xpath;
    candidates.push(xpath);
  }

  // Strategy 6: data-testid
  const testId = el.getAttribute('data-testid');
  if (testId && !isDynamicAttr(testId)) {
    const xpath = `//*[@data-testid='${testId}']`;
    if (countMatches(xpath) === 1) return xpath;
  }

  // Strategy 7: Text content (use element's own direct text, not children's text)
  // Get only direct text nodes (not from child elements)
  const ownTextNodes = Array.from(el.childNodes)
    .filter(n => n.nodeType === Node.TEXT_NODE)
    .map(n => (n.textContent || '').trim())
    .filter(t => t.length > 0);
  const ownText = ownTextNodes.join(' ').trim();
  // Also get full textContent as fallback for leaf elements (no children)
  const fullText = (el.textContent || '').trim();
  const directText = (el.children.length === 0) ? fullText : ownText;
  
  if (directText && directText.length > 0 && directText.length <= 60 && !directText.includes('\n')) {
    const xpath = `//${tag}[normalize-space(.)='${directText}']`;
    if (countMatches(xpath) === 1) return xpath;
    // Try contains for partial text match
    if (directText.length > 10) {
      const partial = directText.substring(0, 30);
      const xpath2 = `//${tag}[contains(normalize-space(.),'${partial}')]`;
      if (countMatches(xpath2) === 1) return xpath2;
    }
    // Try with parent context
    const parentEl = el.parentElement;
    if (parentEl) {
      const parentClasses = Array.from(parentEl.classList).filter(c => !isDynamicAttr(c) && c.length > 3);
      if (parentClasses.length > 0) {
        const xpath2 = `//*[contains(@class,'${parentClasses[0]}')]//${tag}[normalize-space(.)='${directText}']`;
        if (countMatches(xpath2) === 1) return xpath2;
      }
    }
    candidates.push(xpath);
  }

  // Strategy 8: Stable class + text
  const stableClasses = Array.from(el.classList).filter(c => !isDynamicAttr(c) && c.length > 3);
  if (stableClasses.length > 0 && directText && directText.length <= 60) {
    const xpath = `//${tag}[contains(@class,'${stableClasses[0]}') and normalize-space(.)='${directText}']`;
    if (countMatches(xpath) === 1) return xpath;
    candidates.push(xpath);
  }

  // Strategy 9: Stable class + parent with stable class
  if (stableClasses.length > 0) {
    const parentEl = el.parentElement;
    if (parentEl) {
      const parentStable = Array.from(parentEl.classList).filter(c => !isDynamicAttr(c) && c.length > 3);
      if (parentStable.length > 0) {
        const xpath = `//*[contains(@class,'${parentStable[0]}')]//${tag}[contains(@class,'${stableClasses[0]}')]`;
        if (countMatches(xpath) === 1) return xpath;
        candidates.push(xpath);
      }
    }
  }

  // Strategy 10: Sibling text relationship (preceding sibling with unique text)
  const prevSibling = el.previousElementSibling;
  if (prevSibling) {
    const sibText = (prevSibling.textContent || '').trim();
    if (sibText && sibText.length <= 40 && sibText.length > 1) {
      const sibTag = prevSibling.tagName.toLowerCase();
      const xpath = `//${sibTag}[normalize-space(.)='${sibText}']/following-sibling::${tag}`;
      if (countMatches(xpath) === 1) return xpath;
      // Try with index [1]
      const xpath2 = `(//${sibTag}[normalize-space(.)='${sibText}']/following-sibling::${tag})[1]`;
      if (countMatches(xpath2) === 1) return xpath2;
    }
  }

  // Strategy 11: Ancestor with ID + descendant
  let anc = el.parentElement;
  for (let i = 0; i < 5 && anc; i++) {
    if (anc.id && !isDynamicAttr(anc.id)) {
      if (stableClasses.length > 0) {
        const xpath = `//*[@id='${anc.id}']//${tag}[contains(@class,'${stableClasses[0]}')]`;
        if (countMatches(xpath) === 1) return xpath;
      }
      if (directText && directText.length <= 60) {
        const xpath = `//*[@id='${anc.id}']//${tag}[normalize-space(.)='${directText}']`;
        if (countMatches(xpath) === 1) return xpath;
      }
      break;
    }
    anc = anc.parentElement;
  }

  // Strategy 12: Ancestor with stable class + descendant
  anc = el.parentElement;
  for (let i = 0; i < 5 && anc; i++) {
    const ancClasses = Array.from(anc.classList).filter(c => !isDynamicAttr(c) && c.length > 3);
    if (ancClasses.length > 0) {
      if (directText && directText.length <= 60) {
        const xpath = `//*[contains(@class,'${ancClasses[0]}')]//${tag}[normalize-space(.)='${directText}']`;
        if (countMatches(xpath) === 1) return xpath;
      }
      if (stableClasses.length > 0) {
        const xpath = `//*[contains(@class,'${ancClasses[0]}')]//${tag}[contains(@class,'${stableClasses[0]}')]`;
        if (countMatches(xpath) === 1) return xpath;
      }
    }
    anc = anc.parentElement;
  }

  // Fallback: use the best candidate (first one found) even if not unique
  if (candidates.length > 0) return candidates[0];

  // Last resort: tag with class
  if (stableClasses.length > 0) {
    return `//${tag}[contains(@class,'${stableClasses[0]}')]`;
  }

  return `//${tag}`;
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

  // Collect ancestors (up to 5 levels) for Smart Store Builder
  const ancestors: Array<{ tag: string; id: string; classes: string[] }> = [];
  let ancestor = el.parentElement;
  for (let i = 0; i < 5 && ancestor; i++) {
    ancestors.push({
      tag: ancestor.tagName.toLowerCase(),
      id: ancestor.id || '',
      classes: Array.from(ancestor.classList),
    });
    ancestor = ancestor.parentElement;
  }

  // Collect direct children tags
  const childTags: string[] = Array.from(el.children).map(c => c.tagName.toLowerCase());

  // Same-tag sibling info (position among siblings of same tag type)
  const sameTagSiblings = siblings.filter(s => s.tagName === el.tagName);
  const sameTagSiblingIndex = sameTagSiblings.indexOf(el);
  const sameTagSiblingCount = sameTagSiblings.length;

  // Get own text (direct text nodes only, not child elements' text)
  const elementOwnText = Array.from(el.childNodes)
    .filter(n => n.nodeType === Node.TEXT_NODE)
    .map(n => (n.textContent || '').trim())
    .filter(t => t.length > 0)
    .join(' ');
  // For leaf elements (no children), use full textContent
  const textForCapture = el.children.length === 0
    ? (el.textContent || '').substring(0, 200)
    : elementOwnText.substring(0, 200);

  return {
    tag: el.tagName.toLowerCase(),
    text: textForCapture,
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
    // --- Optional enriched data for Smart Store Builder (backward-compatible) ---
    _ancestors: ancestors,
    _childTags: childTags,
    _sameTagSiblingIndex: sameTagSiblingIndex,
    _sameTagSiblingCount: sameTagSiblingCount,
    _smartXpath: generateSmartXpath(el),
    _smartXpathMatchCount: (() => {
      const xpath = generateSmartXpath(el);
      return countMatches(xpath);
    })(),
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
    console.log(`[QA Picker] 🖱️ CLICKED element: <${data.tag}> "${data.text.substring(0, 30)}" | sending to extension...`);
    chrome.runtime.sendMessage({
      type: 'ELEMENT_CAPTURED_FROM_FRAME',
      payload: data,
    }, (response) => {
      if (chrome.runtime.lastError) {
        console.log(`[QA Picker] ❌ sendMessage failed: ${chrome.runtime.lastError.message}`);
      } else {
        console.log(`[QA Picker] ✅ Data sent successfully`);
      }
    });
  } catch (err) {
    console.log(`[QA Picker] ❌ Exception sending: ${err}`);
  }
}

// --- Start / Stop ---
function startPicker(recordMode: boolean) {
  if (isCapturing) return;
  
  // Wait for DOM to be ready
  if (!document.documentElement) {
    document.addEventListener('DOMContentLoaded', () => startPicker(recordMode));
    return;
  }

  isCapturing = true;
  isRecordMode = recordMode;

  console.log(`[QA Picker] ✅ STARTED in frame: ${window.location.href.substring(0, 80)} | record=${recordMode}`);

  overlay = createOverlay();
  if (recordMode) {
    overlay.style.border = '2px solid #ef4444';
    overlay.style.background = 'rgba(239,68,68,0.08)';
  }

  document.addEventListener('mousemove', onMouseMove, true);
  if (recordMode) {
    // Record mode: capture phase (so we see it even if framework stops propagation)
    // but DON'T preventDefault/stopPropagation in the handler
    document.addEventListener('click', onClick, true);
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
  console.log(`[QA Picker] 🛑 STOPPED in frame: ${window.location.href.substring(0, 60)}`);
}

// --- Message Listener ---
chrome.runtime.onMessage.addListener((message, _sender, sendResponse) => {
  if (message.type === 'START_CAPTURE') {
    startPicker(false);
    sendResponse({ ok: true });
  } else if (message.type === 'START_RECORD') {
    startPicker(true);
    sendResponse({ ok: true });
  } else if (message.type === 'STOP_CAPTURE') {
    stopPicker();
    sendResponse({ ok: true });
  } else if (message.type === 'HIGHLIGHT_XPATH') {
    // Highlight element by xpath — works in all frames
    try {
      const xpath = message.xpath;
      const result = document.evaluate(xpath, document, null, XPathResult.FIRST_ORDERED_NODE_TYPE, null);
      const el = result.singleNodeValue as HTMLElement;
      if (el) {
        el.scrollIntoView({ behavior: 'smooth', block: 'center' });
        const rect = el.getBoundingClientRect();
        const hl = document.createElement('div');
        hl.style.cssText = 'position:fixed;pointer-events:none;z-index:2147483647;border:3px solid #22c55e;background:rgba(34,197,94,0.2);border-radius:4px;transition:opacity 0.5s;';
        hl.style.top = `${rect.top}px`;
        hl.style.left = `${rect.left}px`;
        hl.style.width = `${rect.width}px`;
        hl.style.height = `${rect.height}px`;
        document.documentElement.appendChild(hl);
        setTimeout(() => { hl.style.opacity = '0'; }, 2000);
        setTimeout(() => { hl.remove(); }, 2500);
        sendResponse({ found: true });
      } else {
        sendResponse({ found: false });
      }
    } catch (e) {
      sendResponse({ found: false });
    }
  }
  return false;
});

// Auto-start: check if capture is active for THIS tab
function checkAndAutoStart(retries = 3) {
  try {
    chrome.runtime.sendMessage({ type: 'IS_CAPTURE_ACTIVE' }, (response) => {
      if (chrome.runtime.lastError) {
        if (retries > 0) setTimeout(() => checkAndAutoStart(retries - 1), 1000);
        return;
      }
      if (response && response.active && !isCapturing) {
        startPicker(!!response.recordMode);
      }
    });
  } catch (e) {}
}

checkAndAutoStart();
setTimeout(() => checkAndAutoStart(), 1000);
setTimeout(() => checkAndAutoStart(), 3000);

// Periodic check for late-loading frames (only every 2s)
const periodicCheck = setInterval(() => {
  if (!isCapturing) {
    checkAndAutoStart(1);
  }
}, 2000);

// Listen for STOP from storage changes (immediate cleanup)
// Storage change listener removed — was causing false stops.
// Capture is stopped only via explicit STOP_CAPTURE message.

// Don't auto-stop on visibility change — it causes false stops when switching to DevTools panel

// Auto-cleanup if extension context invalidates
try {
  chrome.runtime.id;
} catch (e) {
  stopPicker();
}
