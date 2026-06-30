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

  function onMove(e) {
    // Hide overlay to detect element underneath
    overlay.style.display = 'none';
    var el = document.elementFromPoint(e.clientX, e.clientY);
    overlay.style.display = 'block';
    if (!el) { overlay.style.display = 'none'; return; }
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
    // Hide overlay to get the actual element underneath (works for disabled elements too)
    overlay.style.display = 'none';
    var el = document.elementFromPoint(e.clientX, e.clientY);
    overlay.style.display = 'block';
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

    // Store the data globally so the DevTools eval can retrieve it
    try {
      window.__qaAutomationLastCapture = JSON.parse(JSON.stringify(data));
    } catch(err) {
      window.__qaAutomationLastCapture = data;
    }
    return false;
  }

  document.addEventListener('mousemove', onMove, true);
  document.addEventListener('mousedown', onClick, true);

  console.log('[QA Automation Picker] Started - mousedown listener active');

  window.__qaAutomationCleanup = function() {
    document.removeEventListener('mousemove', onMove, true);
    document.removeEventListener('mousedown', onClick, true);
    overlay.remove();
    delete window.__qaAutomationPicker;
    delete window.__qaAutomationCleanup;
    delete window.__qaAutomationLastCapture;
  };

  return '__QA_PICKER_STARTED__';
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

const GET_CAPTURE_SCRIPT = `
(function() {
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

    // Evaluate match count on the actual page
    const xpath = selector.xpath.replace(/'/g, "\\'");
    const countScript = `
      (function() {
        try {
          var result = document.evaluate('${xpath}', document, null, XPathResult.ORDERED_NODE_SNAPSHOT_TYPE, null);
          return result.snapshotLength;
        } catch(e) { return -1; }
      })();
    `;
    const countResult = await evalOnPage(countScript);
    const matchCount = countResult ? parseInt(String(countResult), 10) : -1;
    selector.matchCount = isNaN(matchCount) ? -1 : matchCount;

    // Format as ZeuZ step (without xpath — ZeuZ uses class/text/placeholder to locate)
    const zeuzStep = formatAsZeuzStep(element, action, stepNumber, {
      defaultWait: settingsRef.current.defaultWait,
    });

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

  // Start capture: inject picker + start polling
  const startCapture = useCallback(async () => {
    if (!isConnected || isCapturingRef.current) return;
    isCapturingRef.current = true;

    await evalOnPage(PICKER_SCRIPT);
    startPolling();
  }, [isConnected, startPolling]);

  // Stop capture: remove picker + stop polling
  const stopCapture = useCallback(async () => {
    if (!isCapturingRef.current) return;
    isCapturingRef.current = false;

    stopPolling();
    await evalOnPage(STOP_PICKER_SCRIPT);
  }, [stopPolling]);

  // Sync with store's captureMode
  const prevModeRef = useRef(captureMode);

  useEffect(() => {
    const prev = prevModeRef.current;
    prevModeRef.current = captureMode;

    if (captureMode === 'capturing' && prev === 'idle') {
      startCapture();
    } else if (captureMode === 'idle' && (prev === 'capturing' || prev === 'paused')) {
      stopCapture();
    } else if (captureMode === 'paused' && prev === 'capturing') {
      stopPolling();
    } else if (captureMode === 'capturing' && prev === 'paused') {
      startPolling();
    }
  }, [captureMode, startCapture, stopCapture, startPolling, stopPolling]);

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
