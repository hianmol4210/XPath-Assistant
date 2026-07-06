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

    // Generate smart xpath on the live DOM
    var smartXpath = (function() {
      var t = el.tagName.toLowerCase();
      function cnt(xp) { try { return document.evaluate(xp, document, null, XPathResult.ORDERED_NODE_SNAPSHOT_TYPE, null).snapshotLength; } catch(e) { return -1; } }
      function dyn(v) { return !v || v.length<=2 || /[-_]\\d+$|^\\d|\\d+-\\d|^_ng|^cdk|^mat|^react|^:r/.test(v); }
      if (el.id && !dyn(el.id)) { var x='//*[@id=\"'+el.id+'\"]'; if(cnt(x)===1) return x; }
      var al=el.getAttribute('aria-label'); if(al&&!dyn(al)){var x='//'+t+'[@aria-label=\"'+al+'\"]';if(cnt(x)===1)return x;}
      var ph=el.getAttribute('placeholder'); if(ph){var x='//'+t+'[@placeholder=\"'+ph+'\"]';if(cnt(x)===1)return x;}
      var nm=el.getAttribute('name'); if(nm&&!dyn(nm)){var x='//'+t+'[@name=\"'+nm+'\"]';if(cnt(x)===1)return x;}
      var txt=(el.textContent||'').trim(); if(txt&&txt.length<=50){var x='//'+t+'[normalize-space(.)=\"'+txt+'\"]';if(cnt(x)===1)return x;}
      var cls=Array.from(el.classList).filter(function(c){return!dyn(c)&&c.length>3;});
      if(cls.length>0&&txt&&txt.length<=50){var x='//'+t+'[contains(@class,\"'+cls[0]+'\") and normalize-space(.)=\"'+txt+'\"]';if(cnt(x)===1)return x;}
      var p=el.parentElement;if(p){var pc=Array.from(p.classList).filter(function(c){return!dyn(c)&&c.length>3;});if(pc.length>0&&txt){var x='//*[contains(@class,\"'+pc[0]+'\")]//'+t+'[normalize-space(.)=\"'+txt+'\"]';if(cnt(x)===1)return x;}}
      if(cls.length>0)return '//'+t+'[contains(@class,\"'+cls[0]+'\")]';
      return '//'+t;
    })();
    data._smartXpath = smartXpath;

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
    if (Date.now() - window.__qaAutomationHeartbeat > 30000) {
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
    if (Date.now() - window.__qaAutomationHeartbeat > 30000) {
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
    const stepNumber = stepsRef.current.length + 1;

    // ─── Special handling for iframe elements ─────────────────────────────────
    if (element.tag === 'iframe') {
      // Generate a "switch iframe" step instead of a click step
      const iframeSrc = element.attributes['src'] || '';
      const iframeId = element.id || '';
      const iframeClass = element.classes.filter(c => c.length > 3).join(' ');

      const zeuzRows: Array<{field: string; type: string; value: string}> = [];
      zeuzRows.push({ field: 'index', type: 'iframe parameter', value: 'default content' });
      
      if (iframeId) {
        zeuzRows.push({ field: 'id', type: 'iframe parameter', value: iframeId });
      } else if (iframeClass) {
        zeuzRows.push({ field: '*class', type: 'iframe parameter', value: iframeClass });
      } else if (iframeSrc) {
        zeuzRows.push({ field: 'src', type: 'iframe parameter', value: iframeSrc });
      }
      
      zeuzRows.push({ field: 'switch iframe', type: 'selenium action', value: 'switch iframe' });

      const zeuzStep = {
        title: `#${stepNumber} Switch to iframe`,
        stepNumber,
        rows: zeuzRows as any,
        locator: iframeId ? `//*[@id='${iframeId}']` : iframeClass ? `//*[contains(@class, '${iframeClass}')]//iframe` : `//iframe[@src='${iframeSrc}']`,
        locatorName: `xpath_iframe_${iframeId || iframeClass.split(' ')[0] || 'frame'}`,
      };

      selector.matchCount = 1;
      addStep(element, 'click' as any, selector, zeuzStep as any);
      setSelectedElement(element);

      // Auto-open iframe content in a new tab for further capture
      if (iframeSrc) {
        try {
          const tabId = chrome.devtools?.inspectedWindow?.tabId;
          if (tabId) {
            chrome.tabs.create({ url: iframeSrc, active: false });
          }
        } catch (e) {
          console.warn('[useCapture] Could not open iframe in new tab:', e);
        }
      }
      return;
    }

    // ─── Normal element processing ────────────────────────────────────────────
    const actionRec = recommendAction(element);
    const action = actionRec.primary;

    // Format as ZeuZ step first (to get the locator)
    const zeuzStep = formatAsZeuzStep(element, action, stepNumber, {
      defaultWait: settingsRef.current.defaultWait,
    });

    // Use match count from content script (evaluated on the actual page)
    const smartMatchCount = (element as any)._smartXpathMatchCount;
    if (typeof smartMatchCount === 'number' && smartMatchCount >= 0) {
      selector.matchCount = smartMatchCount;
    } else {
      // Fallback: try evalOnPage
      const xpathJson = JSON.stringify(zeuzStep.locator);
      const countScript = `
        (function() {
          try {
            var xpath = ${xpathJson};
            var result = document.evaluate(xpath, document, null, XPathResult.ORDERED_NODE_SNAPSHOT_TYPE, null);
            return result.snapshotLength;
          } catch(e) { return -1; }
        })();
      `;
      const countResult = await evalOnPage(countScript);
      const matchCount = countResult ? parseInt(String(countResult), 10) : -1;
      selector.matchCount = isNaN(matchCount) ? -1 : matchCount;
    }

    addStep(element, action, selector, zeuzStep);
    setSelectedElement(element);
  }, [addStep, setSelectedElement]);

  // Deduplication: track last capture to prevent double captures
  const lastCaptureTimestampRef = useRef(0);
  const lastCaptureKeyRef = useRef('');

  // Poll for captured elements (from both top-frame eval AND iframe content scripts via storage)
  const startPolling = useCallback(() => {
    if (pollingRef.current) return;

    pollingRef.current = setInterval(async () => {
      // Global dedup: skip if we just processed something
      const now = Date.now();
      if (now - lastCaptureTimestampRef.current < 1000) return;

      // Get captured element from storage (set by background from content script)
      try {
        chrome.storage.local.get(['__qaLastCapturedElement'], (res) => {
          if (res.__qaLastCapturedElement) {
            chrome.storage.local.remove('__qaLastCapturedElement');
            if (Date.now() - lastCaptureTimestampRef.current < 1000) return;
            lastCaptureTimestampRef.current = Date.now();
            processElement(res.__qaLastCapturedElement as CapturedElement);
          }
        });
      } catch (e) {}
    }, 300);
  }, [processElement]);

  const stopPolling = useCallback(() => {
    if (pollingRef.current) {
      clearInterval(pollingRef.current);
      pollingRef.current = null;
    }
  }, []);

  // Send message to content scripts in ALL frames (including iframes)
  const sendToAllFrames = useCallback(async (messageType: string) => {
    try {
      const tabId = chrome.devtools?.inspectedWindow?.tabId;
      if (!tabId) return;
      // Send to all frames in the tab
      chrome.tabs.sendMessage(tabId, { type: messageType });
    } catch (e) {
      console.warn('[useCapture] Failed to send to frames:', e);
    }
  }, []);

  // NOTE: Iframe captures are picked up via storage polling (set by background).
  // No direct onMessage listener needed — it caused duplicates.

  // Start capture: tell content scripts in all frames (no eval picker - avoids duplicates)
  const startCapture = useCallback(async () => {
    if (!isConnected || isCapturingRef.current) return;
    isCapturingRef.current = true;

    // Set state via background — scoped to this tab only
    try {
      const tabId = chrome.devtools?.inspectedWindow?.tabId;
      chrome.runtime.sendMessage({ type: 'SET_CAPTURE_STATE', active: true, recordMode: false, tabId });
    } catch (e) {}

    await sendToAllFrames('START_CAPTURE');
    startPolling();
  }, [isConnected, startPolling, sendToAllFrames]);

  // Start record: tell content scripts only (no eval picker - avoids duplicates)
  const startRecord = useCallback(async () => {
    if (!isConnected || isCapturingRef.current) return;
    isCapturingRef.current = true;

    // Set state via background — scoped to this tab only
    try {
      const tabId = chrome.devtools?.inspectedWindow?.tabId;
      chrome.runtime.sendMessage({ type: 'SET_CAPTURE_STATE', active: true, recordMode: true, tabId });
    } catch (e) {}

    // Only use content scripts for record mode — no eval-based picker
    await sendToAllFrames('START_RECORD');
    startPolling();
  }, [isConnected, startPolling, sendToAllFrames]);

  // Stop capture: tell content scripts to stop
  const stopCapture = useCallback(async () => {
    if (!isCapturingRef.current) return;
    isCapturingRef.current = false;

    stopPolling();
    await sendToAllFrames('STOP_CAPTURE');
    // Clear state via background
    try {
      const tabId = chrome.devtools?.inspectedWindow?.tabId;
      chrome.runtime.sendMessage({ type: 'SET_CAPTURE_STATE', active: false, recordMode: false, tabId: null });
    } catch (e) {}
  }, [stopPolling, sendToAllFrames]);

  // Sync captureMode changes — only react to ACTUAL user-initiated changes
  const prevModeRef = useRef(captureMode);
  const hasSyncedRef = useRef(false);

  useEffect(() => {
    const prev = prevModeRef.current;
    
    // Skip if same
    if (prev === captureMode) return;
    
    prevModeRef.current = captureMode;
    console.log(`[DevTools] captureMode changed: ${prev} → ${captureMode}`);

    if (captureMode === 'capturing' && prev === 'idle') {
      startCapture();
    } else if (captureMode === 'recording' && prev === 'idle') {
      startRecord();
    } else if (captureMode === 'idle' && (prev === 'capturing' || prev === 'paused' || prev === 'recording')) {
      stopCapture();
    }
  }, [captureMode]); // eslint-disable-line react-hooks/exhaustive-deps

  // Cleanup on unmount (DevTools panel closed)
  useEffect(() => {
    return () => {
      stopPolling();
      if (isCapturingRef.current) {
        evalOnPage(STOP_PICKER_SCRIPT);
        // Stop capture globally and on all frames
        try {
          const tabId = chrome.devtools?.inspectedWindow?.tabId;
          chrome.runtime.sendMessage({ type: 'SET_CAPTURE_STATE', active: false, recordMode: false, tabId: null });
          if (tabId) {
            chrome.tabs.sendMessage(tabId, { type: 'STOP_CAPTURE' });
          }
        } catch (e) {}
        isCapturingRef.current = false;
      }
    };
  }, [stopPolling]);

  return {
    startCapture,
    stopCapture,
    isConnected,
  };
}
