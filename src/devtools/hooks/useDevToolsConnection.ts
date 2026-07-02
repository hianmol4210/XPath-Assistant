/**
 * useDevToolsConnection Hook — Simplified
 *
 * Uses chrome.devtools.inspectedWindow.eval() to directly execute JavaScript
 * on the inspected page. No background service worker or content script ports needed.
 *
 * Flow:
 * 1. User clicks "Capture" → injects a picker script on the page
 * 2. User clicks an element → script collects data and returns it via eval callback
 * 3. Panel receives data → processes through XPath/action/ZeuZ pipeline → adds step
 */

import { useEffect, useRef, useCallback } from 'react';
import { CapturedElement } from '../../shared/types';
import { useStore } from '../store';
import { generateSelector } from '../utils/xpathGenerator';
import { recommendAction } from '../utils/actionRecommender';
import { formatAsZeuzStep } from '../utils/zeuzFormatter';

export interface DevToolsConnection {
  startCapture: () => void;
  stopCapture: () => void;
  isConnected: boolean;
}

// JavaScript to inject into the page for element picking
const PICKER_SCRIPT = `
(function() {
  if (window.__qaAutomationPicker) {
    return '__QA_PICKER_ALREADY_ACTIVE__';
  }
  window.__qaAutomationPicker = true;

  var overlay = document.createElement('div');
  overlay.id = '__qa-automation-picker-overlay__';
  overlay.style.cssText = 'position:fixed;pointer-events:none;z-index:2147483647;border:2px solid #3b82f6;background:rgba(59,130,246,0.1);border-radius:2px;display:none;transition:all 0.05s ease-out;';
  document.documentElement.appendChild(overlay);

  // Track the last element found under cursor (works even for disabled elements)
  var lastHoveredElement = null;
  var capturedInIframe = false;

  function onMove(e) {
    // Hide overlay to detect element underneath (even disabled ones)
    overlay.style.display = 'none';
    var el = document.elementFromPoint(e.clientX, e.clientY);
    overlay.style.display = 'block';
    if (!el) { overlay.style.display = 'none'; return; }
    lastHoveredElement = el;
    var rect = el.getBoundingClientRect();
    overlay.style.top = rect.top + 'px';
    overlay.style.left = rect.left + 'px';
    overlay.style.width = rect.width + 'px';
    overlay.style.height = rect.height + 'px';
  }

  function onClick(e) {
    e.preventDefault();
    e.stopPropagation();
    e.stopImmediatePropagation();

    // Debounce: prevent capturing same click from multiple event types
    var now = Date.now();
    if (window.__qaLastCaptureTime && (now - window.__qaLastCaptureTime) < 300) return;
    window.__qaLastCaptureTime = now;

    // Use lastHoveredElement which was detected during mousemove
    // This works for disabled elements since mousemove + elementFromPoint detects them
    var el = lastHoveredElement;
    if (!el) {
      // Fallback: try elementFromPoint
      overlay.style.display = 'none';
      el = document.elementFromPoint(e.clientX, e.clientY);
      overlay.style.display = 'block';
    }
    if (!el) return;

    // Collect element data
    var attrs = {};
    for (var i = 0; i < el.attributes.length; i++) {
      attrs[el.attributes[i].name] = el.attributes[i].value;
    }
    var dataAttrs = {};
    var ariaAttrs = {};
    Object.keys(attrs).forEach(function(k) {
      if (k.startsWith('data-')) dataAttrs[k] = attrs[k];
      if (k.startsWith('aria-')) ariaAttrs[k] = attrs[k];
    });

    var parent = el.parentElement;
    var siblings = parent ? Array.from(parent.children) : [];
    var rect = el.getBoundingClientRect();
    var style = window.getComputedStyle(el);

    var data = {
      tag: el.tagName.toLowerCase(),
      text: (el.textContent || '').substring(0, 200),
      innerText: (el.innerText || '').substring(0, 500),
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
        totalSiblings: siblings.length
      },
      state: {
        visible: rect.width > 0 && rect.height > 0 && style.visibility !== 'hidden' && style.display !== 'none',
        enabled: !el.disabled,
        checked: !!el.checked,
        selected: !!el.selected
      },
      timestamp: Date.now()
    };

    // Flash green to confirm
    overlay.style.border = '2px solid #22c55e';
    overlay.style.background = 'rgba(34,197,94,0.15)';
    setTimeout(function() {
      overlay.style.border = '2px solid #3b82f6';
      overlay.style.background = 'rgba(59,130,246,0.1)';
    }, 300);

    // Store on TOP window via postMessage (works cross-origin)
    try {
      var msg = { __qaCapture: true, data: JSON.parse(JSON.stringify(data)) };
      if (window === window.top) {
        window.__qaAutomationLastCapture = msg.data;
      } else {
        window.top.postMessage(msg, '*');
      }
    } catch(err) {
      window.__qaAutomationLastCapture = data;
    }
    return false;
  }

  document.addEventListener('mousemove', onMove, true);
  document.addEventListener('mousedown', onClick, true);
  document.addEventListener('pointerdown', onClick, true);
  document.addEventListener('click', onClick, true);

  // Listen for captures from iframes via postMessage
  if (window === window.top) {
    window.addEventListener('message', function(e) {
      if (e.data && e.data.__qaCapture) {
        window.__qaAutomationLastCapture = e.data.data;
      }
    });
  }

  console.log('[QA Automation Picker] Started - mousedown/pointerdown/click listeners active');

  // Pause: remove listeners but keep state (allows normal page interaction)
  window.__qaAutomationPause = function() {
    document.removeEventListener('mousemove', onMove, true);
    document.removeEventListener('mousedown', onClick, true);
    document.removeEventListener('pointerdown', onClick, true);
    document.removeEventListener('click', onClick, true);
    overlay.style.display = 'none';
    console.log('[QA Automation Picker] Paused - clicks work normally now');
  };

  // Resume: re-add listeners
  window.__qaAutomationResume = function() {
    document.addEventListener('mousemove', onMove, true);
    document.addEventListener('mousedown', onClick, true);
    document.addEventListener('pointerdown', onClick, true);
    document.addEventListener('click', onClick, true);
    console.log('[QA Automation Picker] Resumed - capture mode active');
  };

  window.__qaAutomationCleanup = function() {
    document.removeEventListener('mousemove', onMove, true);
    document.removeEventListener('mousedown', onClick, true);
    document.removeEventListener('pointerdown', onClick, true);
    document.removeEventListener('click', onClick, true);
    overlay.remove();
    if (window.__qaAutomationHeartbeatTimer) {
      clearInterval(window.__qaAutomationHeartbeatTimer);
    }
    delete window.__qaAutomationPicker;
    delete window.__qaAutomationCleanup;
    delete window.__qaAutomationPause;
    delete window.__qaAutomationResume;
    delete window.__qaAutomationLastCapture;
    delete window.__qaAutomationHeartbeat;
    delete window.__qaAutomationHeartbeatTimer;
  };

  // Heartbeat: auto-cleanup if DevTools stops pinging (closed)
  window.__qaAutomationHeartbeat = Date.now();
  window.__qaAutomationHeartbeatTimer = setInterval(function() {
    if (Date.now() - window.__qaAutomationHeartbeat > 3000) {
      console.log('[QA Automation Picker] No heartbeat - DevTools closed, cleaning up');
      window.__qaAutomationCleanup();
    }
  }, 1000);

  // ─── Iframe support: inject picker into all accessible iframes ─────────────
  function injectIntoIframe(iframe) {
    try {
      var iframeDoc = iframe.contentDocument || iframe.contentWindow.document;
      if (!iframeDoc || iframeDoc.__qaPickerInjected) return;
      iframeDoc.__qaPickerInjected = true;

      var iframeOverlay = iframeDoc.createElement('div');
      iframeOverlay.style.cssText = 'position:fixed;pointer-events:none;z-index:2147483647;border:2px solid #3b82f6;background:rgba(59,130,246,0.1);border-radius:2px;display:none;transition:all 0.05s ease-out;';
      iframeDoc.documentElement.appendChild(iframeOverlay);

      var iframeLastHovered = null;

      function iframeOnMove(e) {
        iframeOverlay.style.display = 'none';
        var el = iframeDoc.elementFromPoint(e.clientX, e.clientY);
        iframeOverlay.style.display = 'block';
        if (!el) { iframeOverlay.style.display = 'none'; return; }
        iframeLastHovered = el;
        var rect = el.getBoundingClientRect();
        iframeOverlay.style.top = rect.top + 'px';
        iframeOverlay.style.left = rect.left + 'px';
        iframeOverlay.style.width = rect.width + 'px';
        iframeOverlay.style.height = rect.height + 'px';
      }

      function iframeOnClick(e) {
        e.preventDefault();
        e.stopPropagation();
        e.stopImmediatePropagation();

        var now = Date.now();
        if (window.__qaLastCaptureTime && (now - window.__qaLastCaptureTime) < 300) return;
        window.__qaLastCaptureTime = now;

        var el = iframeLastHovered;
        if (!el) {
          iframeOverlay.style.display = 'none';
          el = iframeDoc.elementFromPoint(e.clientX, e.clientY);
          iframeOverlay.style.display = 'block';
        }
        if (!el) return;

        var attrs = {};
        for (var i = 0; i < el.attributes.length; i++) {
          attrs[el.attributes[i].name] = el.attributes[i].value;
        }
        var dataAttrs = {};
        var ariaAttrs = {};
        Object.keys(attrs).forEach(function(k) {
          if (k.startsWith('data-')) dataAttrs[k] = attrs[k];
          if (k.startsWith('aria-')) ariaAttrs[k] = attrs[k];
        });

        var parent = el.parentElement;
        var siblings = parent ? Array.from(parent.children) : [];
        var rect = el.getBoundingClientRect();
        var style = iframe.contentWindow.getComputedStyle(el);

        var data = {
          tag: el.tagName.toLowerCase(),
          text: (el.textContent || '').substring(0, 200),
          innerText: (el.innerText || '').substring(0, 500),
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
            totalSiblings: siblings.length
          },
          state: {
            visible: rect.width > 0 && rect.height > 0 && style.visibility !== 'hidden' && style.display !== 'none',
            enabled: !el.disabled,
            checked: !!el.checked,
            selected: !!el.selected
          },
          timestamp: Date.now(),
          _iframe: true,
          _iframeSrc: iframe.src || '',
          _iframeId: iframe.id || ''
        };

        iframeOverlay.style.border = '2px solid #22c55e';
        iframeOverlay.style.background = 'rgba(34,197,94,0.15)';
        setTimeout(function() {
          iframeOverlay.style.border = '2px solid #3b82f6';
          iframeOverlay.style.background = 'rgba(59,130,246,0.1)';
        }, 300);

        // Store on TOP window so polling can find it
        try {
          window.top.__qaAutomationLastCapture = JSON.parse(JSON.stringify(data));
        } catch(err) {
          window.__qaAutomationLastCapture = data;
        }
        return false;
      }

      iframeDoc.addEventListener('mousemove', iframeOnMove, true);
      iframeDoc.addEventListener('mousedown', iframeOnClick, true);
      iframeDoc.addEventListener('pointerdown', iframeOnClick, true);
      iframeDoc.addEventListener('click', iframeOnClick, true);

      console.log('[QA Automation Picker] Injected into iframe:', iframe.src || iframe.id);
    } catch(e) {
      // Cross-origin iframe — can't access contentDocument
      console.log('[QA Automation Picker] Cannot inject into cross-origin iframe:', iframe.src);
    }
  }

  // Inject into existing iframes
  var iframes = document.querySelectorAll('iframe');
  iframes.forEach(function(iframe) {
    if (iframe.contentDocument) {
      injectIntoIframe(iframe);
    } else {
      iframe.addEventListener('load', function() { injectIntoIframe(iframe); });
    }
  });

  // Watch for new iframes added to the page
  var iframeObserver = new MutationObserver(function(mutations) {
    mutations.forEach(function(m) {
      m.addedNodes.forEach(function(node) {
        if (node.tagName === 'IFRAME') {
          if (node.contentDocument) {
            injectIntoIframe(node);
          } else {
            node.addEventListener('load', function() { injectIntoIframe(node); });
          }
        }
        // Also check children for iframes
        if (node.querySelectorAll) {
          node.querySelectorAll('iframe').forEach(function(iframe) {
            if (iframe.contentDocument) {
              injectIntoIframe(iframe);
            } else {
              iframe.addEventListener('load', function() { injectIntoIframe(iframe); });
            }
          });
        }
      });
    });
  });
  iframeObserver.observe(document.body, { childList: true, subtree: true });

  return '__QA_PICKER_STARTED__';
})();
`;

// Record mode: captures XPath AND lets click pass through (no preventDefault)
const RECORD_SCRIPT = `
(function() {
  if (window.__qaAutomationPicker) {
    return '__QA_PICKER_ALREADY_ACTIVE__';
  }
  window.__qaAutomationPicker = true;
  window.__qaAutomationRecordMode = true;

  var overlay = document.createElement('div');
  overlay.id = '__qa-automation-picker-overlay__';
  overlay.style.cssText = 'position:fixed;pointer-events:none;z-index:2147483647;border:2px solid #ef4444;background:rgba(239,68,68,0.08);border-radius:2px;display:none;transition:all 0.05s ease-out;';
  document.documentElement.appendChild(overlay);

  var lastHoveredElement = null;

  function onMove(e) {
    overlay.style.display = 'none';
    var el = document.elementFromPoint(e.clientX, e.clientY);
    overlay.style.display = 'block';
    if (!el) { overlay.style.display = 'none'; return; }
    lastHoveredElement = el;
    var rect = el.getBoundingClientRect();
    overlay.style.top = rect.top + 'px';
    overlay.style.left = rect.left + 'px';
    overlay.style.width = rect.width + 'px';
    overlay.style.height = rect.height + 'px';
  }

  function onClick(e) {
    // NO preventDefault, NO stopPropagation — click passes through to the page!
    var now = Date.now();
    if (window.__qaLastCaptureTime && (now - window.__qaLastCaptureTime) < 300) return;
    window.__qaLastCaptureTime = now;

    var el = lastHoveredElement;
    if (!el) {
      overlay.style.display = 'none';
      el = document.elementFromPoint(e.clientX, e.clientY);
      overlay.style.display = 'block';
    }
    if (!el) return;

    var attrs = {};
    for (var i = 0; i < el.attributes.length; i++) {
      attrs[el.attributes[i].name] = el.attributes[i].value;
    }
    var dataAttrs = {};
    var ariaAttrs = {};
    Object.keys(attrs).forEach(function(k) {
      if (k.startsWith('data-')) dataAttrs[k] = attrs[k];
      if (k.startsWith('aria-')) ariaAttrs[k] = attrs[k];
    });

    var parent = el.parentElement;
    var siblings = parent ? Array.from(parent.children) : [];
    var rect = el.getBoundingClientRect();
    var style = window.getComputedStyle(el);

    var data = {
      tag: el.tagName.toLowerCase(),
      text: (el.textContent || '').substring(0, 200),
      innerText: (el.innerText || '').substring(0, 500),
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
        totalSiblings: siblings.length
      },
      state: {
        visible: rect.width > 0 && rect.height > 0 && style.visibility !== 'hidden' && style.display !== 'none',
        enabled: !el.disabled,
        checked: !!el.checked,
        selected: !!el.selected
      },
      timestamp: Date.now()
    };

    // Flash green briefly
    overlay.style.border = '2px solid #22c55e';
    overlay.style.background = 'rgba(34,197,94,0.15)';
    setTimeout(function() {
      overlay.style.border = '2px solid #ef4444';
      overlay.style.background = 'rgba(239,68,68,0.08)';
    }, 300);

    // Store on TOP window via postMessage (works cross-origin for iframes)
    try {
      var msg = { __qaCapture: true, data: JSON.parse(JSON.stringify(data)) };
      if (window === window.top) {
        window.__qaAutomationLastCapture = msg.data;
      } else {
        window.top.postMessage(msg, '*');
      }
    } catch(err) {
      window.__qaAutomationLastCapture = data;
    }
    // Don't return false — let the event propagate naturally
  }

  // Use click event only (not mousedown) so we capture AFTER the action happens
  document.addEventListener('mousemove', onMove, true);
  document.addEventListener('click', onClick, false);

  // Listen for captures from iframes via postMessage
  if (window === window.top) {
    window.addEventListener('message', function(e) {
      if (e.data && e.data.__qaCapture) {
        window.__qaAutomationLastCapture = e.data.data;
      }
    });
  }

  console.log('[QA Automation Record] Started - click pass-through + capture mode');

  window.__qaAutomationCleanup = function() {
    document.removeEventListener('mousemove', onMove, true);
    document.removeEventListener('click', onClick, false);
    overlay.remove();
    delete window.__qaAutomationPicker;
    delete window.__qaAutomationRecordMode;
    delete window.__qaAutomationCleanup;
    delete window.__qaAutomationPause;
    delete window.__qaAutomationResume;
    delete window.__qaAutomationLastCapture;
    if (window.__qaAutomationHeartbeatTimer) {
      clearInterval(window.__qaAutomationHeartbeatTimer);
    }
    delete window.__qaAutomationHeartbeat;
    delete window.__qaAutomationHeartbeatTimer;
  };

  window.__qaAutomationHeartbeat = Date.now();
  window.__qaAutomationHeartbeatTimer = setInterval(function() {
    if (Date.now() - window.__qaAutomationHeartbeat > 3000) {
      console.log('[QA Automation Record] No heartbeat - cleaning up');
      window.__qaAutomationCleanup();
    }
  }, 1000);

  return '__QA_RECORD_STARTED__';
})();
`;

const STOP_PICKER_SCRIPT = `
(function() {
  if (window.__qaAutomationCleanup) {
    window.__qaAutomationCleanup();
    return '__QA_PICKER_STOPPED__';
  }
  return '__QA_PICKER_NOT_ACTIVE__';
})();
`;

const PAUSE_PICKER_SCRIPT = `
(function() {
  if (window.__qaAutomationPause) {
    window.__qaAutomationPause();
    return '__QA_PICKER_PAUSED__';
  }
  return '__QA_PICKER_NOT_ACTIVE__';
})();
`;

const RESUME_PICKER_SCRIPT = `
(function() {
  if (window.__qaAutomationResume) {
    window.__qaAutomationResume();
    return '__QA_PICKER_RESUMED__';
  }
  return '__QA_PICKER_NOT_ACTIVE__';
})();
`;

const GET_CAPTURE_SCRIPT = `
(function() {
  // Heartbeat ping — tells the picker script that DevTools is still open
  if (window.__qaAutomationHeartbeat !== undefined) {
    window.__qaAutomationHeartbeat = Date.now();
  }
  if (window.__qaAutomationLastCapture) {
    try {
      var data = JSON.stringify(window.__qaAutomationLastCapture);
      window.__qaAutomationLastCapture = null;
      return data;
    } catch(e) {
      window.__qaAutomationLastCapture = null;
      return null;
    }
  }
  return null;
})();
`;

function evalOnPage(expression: string): Promise<string | null> {
  return new Promise((resolve) => {
    try {
      chrome.devtools.inspectedWindow.eval(expression, (result: unknown, exceptionInfo) => {
        if (exceptionInfo) {
          console.warn('[useCapture] eval error:', exceptionInfo);
          resolve(null);
        } else {
          resolve(result as string | null);
        }
      });
    } catch (err) {
      console.warn('[useCapture] eval failed:', err);
      resolve(null);
    }
  });
}

export function useDevToolsConnection(): DevToolsConnection {
  const pollingRef = useRef<ReturnType<typeof setInterval> | null>(null);
  const isCapturingRef = useRef(false);

  const addStep = useStore((s) => s.addStep);
  const setSelectedElement = useStore((s) => s.setSelectedElement);
  const steps = useStore((s) => s.steps);
  const settings = useStore((s) => s.settings);
  const captureMode = useStore((s) => s.captureMode);

  const stepsRef = useRef(steps);
  const settingsRef = useRef(settings);

  useEffect(() => { stepsRef.current = steps; }, [steps]);
  useEffect(() => { settingsRef.current = settings; }, [settings]);

  // Check if chrome.devtools is available
  const isConnected = typeof chrome !== 'undefined' && !!chrome.devtools?.inspectedWindow;

  // Process a captured element — also evaluates XPath match count on the page
  const processElement = useCallback(async (element: CapturedElement) => {
    const selector = generateSelector(element);
    const actionRec = recommendAction(element);
    const action = actionRec.primary;
    const stepNumber = stepsRef.current.length + 1;

    // Format as ZeuZ step first (to get the locator)
    const zeuzStep = formatAsZeuzStep(element, action, stepNumber, {
      defaultWait: settingsRef.current.defaultWait,
    });

    // Evaluate match count using the LOCATOR xpath (the one shown in the UI)
    const locatorXpath = zeuzStep.locator.replace(/'/g, "\\'");
    const countScript = `
      (function() {
        try {
          var result = document.evaluate('${locatorXpath}', document, null, XPathResult.ORDERED_NODE_SNAPSHOT_TYPE, null);
          return result.snapshotLength;
        } catch(e) { return -1; }
      })();
    `;
    const countResult = await evalOnPage(countScript);
    const matchCount = countResult ? parseInt(String(countResult), 10) : -1;
    selector.matchCount = isNaN(matchCount) ? -1 : matchCount;

    addStep(element, action, selector, zeuzStep);
    setSelectedElement(element);
  }, [addStep, setSelectedElement]);

  // Poll for captured elements
  const startPolling = useCallback(() => {
    if (pollingRef.current) return;

    pollingRef.current = setInterval(async () => {
      const result = await evalOnPage(GET_CAPTURE_SCRIPT);
      if (result && result !== 'null' && result !== 'undefined') {
        try {
          const element = JSON.parse(result) as CapturedElement;
          processElement(element);
        } catch (e) {
          console.warn('[useCapture] Failed to parse capture data:', result?.substring(0, 100), e);
        }
      }
    }, 300); // Check every 300ms
  }, [processElement]);

  const stopPolling = useCallback(() => {
    if (pollingRef.current) {
      clearInterval(pollingRef.current);
      pollingRef.current = null;
    }
  }, []);

  // Inject picker into ALL frames (including cross-origin iframes) using chrome.scripting API
  const injectIntoAllFrames = useCallback(async (script: string) => {
    try {
      const tabId = chrome.devtools?.inspectedWindow?.tabId;
      if (!tabId) return;
      
      await chrome.scripting.executeScript({
        target: { tabId, allFrames: true },
        func: (scriptText: string) => {
          eval(scriptText);
        },
        args: [script],
      });
    } catch (e) {
      console.warn('[useCapture] Failed to inject into all frames:', e);
    }
  }, []);

  // Start capture: inject picker + start polling
  const startCapture = useCallback(async () => {
    if (!isConnected || isCapturingRef.current) return;
    isCapturingRef.current = true;

    await evalOnPage(PICKER_SCRIPT);
    // Also inject into all iframes (cross-origin support)
    await injectIntoAllFrames(PICKER_SCRIPT);
    startPolling();
  }, [isConnected, startPolling, injectIntoAllFrames]);

  // Start record: inject record picker (pass-through clicks) + start polling
  const startRecord = useCallback(async () => {
    if (!isConnected || isCapturingRef.current) return;
    isCapturingRef.current = true;

    await evalOnPage(RECORD_SCRIPT);
    // Also inject into all iframes (cross-origin support)
    await injectIntoAllFrames(RECORD_SCRIPT);
    startPolling();
  }, [isConnected, startPolling, injectIntoAllFrames]);

  // Stop capture: remove picker + stop polling
  const stopCapture = useCallback(async () => {
    if (!isCapturingRef.current) return;
    isCapturingRef.current = false;

    stopPolling();
    await evalOnPage(STOP_PICKER_SCRIPT);
    // Also stop in all iframes
    await injectIntoAllFrames(STOP_PICKER_SCRIPT);
  }, [stopPolling, injectIntoAllFrames]);

  // Sync with store's captureMode
  const prevModeRef = useRef(captureMode);

  useEffect(() => {
    const prev = prevModeRef.current;
    prevModeRef.current = captureMode;

    if (captureMode === 'capturing' && prev === 'idle') {
      startCapture();
    } else if (captureMode === 'recording' && prev === 'idle') {
      // Record mode: capture XPath + let clicks pass through
      startRecord();
    } else if (captureMode === 'idle' && (prev === 'capturing' || prev === 'paused' || prev === 'recording')) {
      stopCapture();
    } else if (captureMode === 'paused' && prev === 'capturing') {
      evalOnPage(PAUSE_PICKER_SCRIPT);
    } else if (captureMode === 'capturing' && prev === 'paused') {
      evalOnPage(RESUME_PICKER_SCRIPT).then((result) => {
        if (result === '__QA_PICKER_NOT_ACTIVE__') {
          evalOnPage(PICKER_SCRIPT);
        }
      });
    }
  }, [captureMode, startCapture, startRecord, stopCapture, startPolling, stopPolling]);

  // Cleanup on unmount
  useEffect(() => {
    return () => {
      stopPolling();
      if (isCapturingRef.current) {
        evalOnPage(STOP_PICKER_SCRIPT);
      }
    };
  }, [stopPolling]);

  return {
    startCapture,
    stopCapture,
    isConnected,
  };
}
