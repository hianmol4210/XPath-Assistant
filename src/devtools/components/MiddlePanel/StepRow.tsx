import React, { useState } from 'react';
import { useStore, Step } from '../../store';
import { ActionType } from '../../utils/actionRecommender';
import { copyZeuzStep, formatAsZeuzStep } from '../../utils/zeuzFormatter';
import { buildSaveAttributeRows, buildSaveAttributeListRows } from '../../utils/zeuzStoreBuilder';

interface StepRowProps {
  step: Step;
}

const ACTION_OPTIONS: { value: ActionType; label: string }[] = [
  { value: 'click', label: 'Click' },
  { value: 'double-click', label: 'Double Click' },
  { value: 'right-click', label: 'Right Click' },
  { value: 'hover', label: 'Hover' },
  { value: 'type-text', label: 'Type Text' },
  { value: 'clear-text', label: 'Clear Text' },
  { value: 'check', label: 'Check' },
  { value: 'uncheck', label: 'Uncheck' },
  { value: 'select-by-text', label: 'Select By Text' },
  { value: 'select-by-value', label: 'Select By Value' },
  { value: 'upload-file', label: 'Upload File' },
  { value: 'wait-for-element', label: 'Wait For Element' },
  { value: 'wait-until-visible', label: 'Wait Until Visible' },
  { value: 'wait-until-hidden', label: 'Wait Until Hidden' },
  { value: 'wait-disable', label: 'Wait Disable' },
  { value: 'verify-exists', label: 'Verify Exists' },
  { value: 'verify-text', label: 'Verify Text' },
  { value: 'verify-visible', label: 'Verify Visible' },
  { value: 'save-attribute', label: 'Save Attribute' },
  { value: 'save-attribute-list', label: 'Save Attribute Values in List' },
];

/**
 * Copy text to clipboard — works in DevTools panels
 */
function copyToClipboard(text: string): boolean {
  try {
    if (navigator.clipboard && navigator.clipboard.writeText) {
      navigator.clipboard.writeText(text);
      return true;
    }
  } catch (e) {
    // Fall through
  }
  try {
    const textarea = document.createElement('textarea');
    textarea.value = text;
    textarea.style.position = 'fixed';
    textarea.style.opacity = '0';
    textarea.style.left = '-9999px';
    document.body.appendChild(textarea);
    textarea.select();
    const success = document.execCommand('copy');
    document.body.removeChild(textarea);
    return success;
  } catch (e) {
    console.warn('Copy failed:', e);
    return false;
  }
}

/**
 * Small copy icon button for individual values
 */
const CopyValueButton: React.FC<{ value: string }> = ({ value }) => {
  const [copied, setCopied] = useState(false);

  const handleClick = (e: React.MouseEvent) => {
    e.stopPropagation();
    if (copied) {
      setCopied(false);
    } else {
      if (copyToClipboard(value)) {
        setCopied(true);
      }
    }
  };

  return (
    <button
      className={`p-0.5 rounded transition-colors ${
        copied ? 'text-success' : 'text-text-muted/50 hover:text-text-muted'
      }`}
      onClick={handleClick}
      title="Copy value"
    >
      {copied ? '✓' : '⧉'}
    </button>
  );
};

// ─── StepRow Component ──────────────────────────────────────────────────────────

export const StepRow: React.FC<StepRowProps> = ({ step }) => {
  const selectedStepId = useStore((s) => s.selectedStepId);
  const selectStep = useStore((s) => s.selectStep);
  const removeStep = useStore((s) => s.removeStep);
  const updateStep = useStore((s) => s.updateStep);
  const setHighlightXpath = useStore((s) => s.setHighlightXpath);
  const checkedStepIds = useStore((s) => s.checkedStepIds);
  const toggleCheckedStep = useStore((s) => s.toggleCheckedStep);
  const [copiedZeuz, setCopiedZeuz] = useState(false);
  const [copiedXpath, setCopiedXpath] = useState(false);

  const isSelected = selectedStepId === step.id;
  const isChecked = checkedStepIds.has(step.id);

  const handleCheckbox = (e: React.ChangeEvent<HTMLInputElement>) => {
    e.stopPropagation();
    toggleCheckedStep(step.id);
  };

  // Copy ZeuZ parameters only — stays green until clicked again
  const handleCopyZeuz = (e: React.MouseEvent) => {
    e.stopPropagation();
    if (copiedZeuz) {
      // Already copied — reset to normal
      setCopiedZeuz(false);
    } else {
      const text = copyZeuzStep(step.zeuzStep);
      if (copyToClipboard(text)) {
        setCopiedZeuz(true);
      }
    }
  };

  // Copy XPath as variable assignment — stays green until clicked again
  const handleCopyXpath = (e: React.MouseEvent) => {
    e.stopPropagation();
    if (copiedXpath) {
      // Already copied — reset to normal
      setCopiedXpath(false);
    } else {
      const text = `${step.zeuzStep.locatorName} = ${step.zeuzStep.locator}`;
      if (copyToClipboard(text)) {
        setCopiedXpath(true);
      }
    }
  };

  const handleDelete = (e: React.MouseEvent) => {
    e.stopPropagation();
    removeStep(step.id);
  };

  const handleActionChange = (e: React.ChangeEvent<HTMLSelectElement>) => {
    e.stopPropagation();
    const newAction = e.target.value as ActionType;

    // For save actions: use the isolated Store Builder (does NOT affect other actions)
    if (newAction === 'save-attribute' || newAction === 'save-attribute-list') {
      const storeRows = newAction === 'save-attribute'
        ? buildSaveAttributeRows(step.element as any)
        : buildSaveAttributeListRows(step.element as any);

      // Create a zeuzStep-compatible object with the store builder's rows
      const storeZeuzStep = {
        ...step.zeuzStep,
        title: `#${step.stepNumber} ${newAction === 'save-attribute' ? 'Save attribute of' : 'Save attribute values in list from'} ${step.element.text?.trim().substring(0, 30) || step.element.tag}`,
        rows: storeRows as any,
      };
      updateStep(step.id, { action: newAction, zeuzStep: storeZeuzStep });
    } else {
      // All other actions: use existing formatter (unchanged)
      const newZeuzStep = formatAsZeuzStep(step.element, newAction, step.stepNumber);
      updateStep(step.id, { action: newAction, zeuzStep: newZeuzStep });
    }
  };

  const handleMouseEnter = () => {
    setHighlightXpath(step.selector.xpath);
  };

  const handleMouseLeave = () => {
    setHighlightXpath(null);
  };

  return (
    <div
      className={`rounded-lg bg-surface-light cursor-pointer transition-colors hover:bg-surface-mid ${
        isSelected ? 'border-l-3 border-primary-500' : 'border-l-3 border-transparent'
      }`}
      onClick={() => selectStep(step.id)}
      onMouseEnter={handleMouseEnter}
      onMouseLeave={handleMouseLeave}
    >
      {/* Step header */}
      <div className="flex items-center gap-2 px-3 py-2 border-b border-surface/50">
        {/* Checkbox */}
        <input
          type="checkbox"
          checked={isChecked}
          onChange={handleCheckbox}
          onClick={(e) => e.stopPropagation()}
          className="w-4 h-4 rounded border-surface-light accent-primary-500 flex-shrink-0"
        />

        {/* Step number badge */}
        <span className="flex-shrink-0 w-6 h-6 flex items-center justify-center rounded-full bg-primary-500/20 text-primary-400 text-xs font-bold">
          {step.stepNumber}
        </span>

        {/* Step title */}
        <span className="flex-1 text-xs font-medium text-text truncate">
          {step.zeuzStep.title}
        </span>

        {/* Action type dropdown */}
        <select
          className="bg-surface text-text text-xs rounded px-1.5 py-0.5 border border-surface-mid focus:outline-none focus:border-primary-500"
          value={step.action}
          onChange={handleActionChange}
          onClick={(e) => e.stopPropagation()}
        >
          {ACTION_OPTIONS.map((opt) => (
            <option key={opt.value} value={opt.value}>
              {opt.label}
            </option>
          ))}
        </select>

        {/* Delete button */}
        <button
          className="flex-shrink-0 p-1 rounded hover:bg-error/20 text-text-muted hover:text-error transition-colors text-xs"
          onClick={handleDelete}
          title="Delete step"
        >
          ✕
        </button>
      </div>

      {/* ZeuZ parameter rows */}
      <div className="px-3 py-1.5">
        <table className="w-full text-xs font-mono">
          <tbody>
            {step.zeuzStep.rows.map((row, idx) => (
              <tr key={idx} className="border-b border-surface/30 last:border-0">
                <td className={`py-1 pr-4 font-semibold whitespace-nowrap ${
                  row.type === 'element parameter' ? 'text-primary-400' :
                  row.type === 'parent parameter' ? 'text-accent' :
                  row.type === 'save parameter' ? 'text-warning' :
                  row.type === 'target parameter' ? 'text-warning' :
                  row.type === 'optional option' ? 'text-text-muted' :
                  'text-success'
                }`}>
                  {row.field}
                </td>
                <td className="py-1 pr-4 text-text-muted whitespace-nowrap">
                  {row.type}
                </td>
                <td className="py-1 text-text break-all">
                  {row.value}
                </td>
                <td className="py-1 pl-1 w-5">
                  <CopyValueButton value={row.value} />
                </td>
              </tr>
            ))}
          </tbody>
        </table>

        {/* Copy ZeuZ button */}
        <div className="mt-2 flex justify-end gap-2">
          <button
            className={`px-3 py-1 rounded text-xs font-medium transition-colors ${
              copiedZeuz
                ? 'bg-success/20 text-success'
                : 'bg-primary-500/10 text-primary-400 hover:bg-primary-500/20'
            }`}
            onClick={handleCopyZeuz}
            title="Copy ZeuZ parameters"
          >
            {copiedZeuz ? '✓ Copied ZeuZ' : '📋 Copy ZeuZ'}
          </button>
        </div>
      </div>

      {/* XPath section — separate from ZeuZ */}
      <div className="px-3 py-2 bg-surface/50 rounded-b-lg border-t border-surface/30">
        {/* Variable name + match badge */}
        <div className="flex items-center gap-2 mb-1">
          <span className="text-xs font-mono text-accent font-bold">
            {step.zeuzStep.locatorName}
          </span>
          <span className="text-xs text-text-muted">=</span>
          {step.selector.matchCount >= 0 && (
            <span className={`text-xs px-1.5 py-0.5 rounded ${
              step.selector.matchCount === 1 ? 'bg-success/20 text-success' : 'bg-error/20 text-error'
            }`}>
              {step.selector.matchCount === 1 ? '✓ 1' : `⚠ ${step.selector.matchCount}`}
            </span>
          )}
          {step.selector.matchCount < 0 && (
            <span className="text-xs px-1.5 py-0.5 rounded bg-warning/20 text-warning">
              ? Unknown
            </span>
          )}
        </div>

        {/* Full XPath on its own line — wraps, fully selectable, CLICK to highlight */}
        <div
          className={`text-xs font-mono break-all select-all cursor-pointer p-1.5 rounded bg-surface hover:ring-1 hover:ring-primary-500 ${
            step.selector.matchCount === 1 ? 'text-success' :
            step.selector.matchCount > 1 ? 'text-error' : 'text-text-muted'
          }`}
          onClick={(e) => {
            e.stopPropagation();
            // Highlight element on page by evaluating the xpath
            try {
              chrome.devtools.inspectedWindow.eval(`
                (function() {
                  var xpath = ${JSON.stringify(step.zeuzStep.locator)};
                  try {
                    var result = document.evaluate(xpath, document, null, XPathResult.FIRST_ORDERED_NODE_TYPE, null);
                    var el = result.singleNodeValue;
                    if (el) {
                      el.scrollIntoView({ behavior: 'smooth', block: 'center' });
                      var rect = el.getBoundingClientRect();
                      var hl = document.createElement('div');
                      hl.style.cssText = 'position:fixed;pointer-events:none;z-index:2147483647;border:3px solid #22c55e;background:rgba(34,197,94,0.2);border-radius:4px;transition:opacity 0.5s;';
                      hl.style.top = rect.top+'px'; hl.style.left = rect.left+'px';
                      hl.style.width = rect.width+'px'; hl.style.height = rect.height+'px';
                      document.documentElement.appendChild(hl);
                      setTimeout(function(){ hl.style.opacity='0'; }, 2000);
                      setTimeout(function(){ hl.remove(); }, 2500);
                    }
                  } catch(e) {}
                })();
              `);
            } catch (e) {}
          }}
          title="Click to highlight element on page"
        >
          {step.zeuzStep.locator}
        </div>

        {/* Copy XPath button */}
        <div className="flex justify-end mt-1.5">
          <button
            className={`px-3 py-1 rounded text-xs font-medium transition-colors ${
              copiedXpath
                ? 'bg-success/20 text-success'
                : 'bg-accent/10 text-accent hover:bg-accent/20'
            }`}
            onClick={handleCopyXpath}
            title="Copy XPath as variable assignment"
          >
            {copiedXpath ? '✓ Copied XPath' : '📋 Copy XPath'}
          </button>
        </div>
      </div>
    </div>
  );
};
