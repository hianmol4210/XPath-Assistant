import React, { useState } from 'react';
import { useStore, Step } from '../../store';
import { ActionType } from '../../utils/actionRecommender';
import { copyZeuzStep, formatAsZeuzStep } from '../../utils/zeuzFormatter';

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
  { value: 'verify-exists', label: 'Verify Exists' },
  { value: 'verify-text', label: 'Verify Text' },
  { value: 'verify-visible', label: 'Verify Visible' },
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
    if (copyToClipboard(value)) {
      setCopied(true);
      setTimeout(() => setCopied(false), 1000);
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

export const StepRow: React.FC<StepRowProps> = ({ step }) => {
  const selectedStepId = useStore((s) => s.selectedStepId);
  const selectStep = useStore((s) => s.selectStep);
  const removeStep = useStore((s) => s.removeStep);
  const updateStep = useStore((s) => s.updateStep);
  const setHighlightXpath = useStore((s) => s.setHighlightXpath);
  const [copiedZeuz, setCopiedZeuz] = useState(false);
  const [copiedXpath, setCopiedXpath] = useState(false);

  const isSelected = selectedStepId === step.id;

  // Copy ZeuZ parameters only
  const handleCopyZeuz = (e: React.MouseEvent) => {
    e.stopPropagation();
    const text = copyZeuzStep(step.zeuzStep);
    if (copyToClipboard(text)) {
      setCopiedZeuz(true);
      setTimeout(() => setCopiedZeuz(false), 1500);
    }
  };

  // Copy XPath as variable assignment: xpath_name = //*[...]
  const handleCopyXpath = (e: React.MouseEvent) => {
    e.stopPropagation();
    const text = `${step.zeuzStep.locatorName} = ${step.zeuzStep.locator}`;
    if (copyToClipboard(text)) {
      setCopiedXpath(true);
      setTimeout(() => setCopiedXpath(false), 1500);
    }
  };

  const handleDelete = (e: React.MouseEvent) => {
    e.stopPropagation();
    removeStep(step.id);
  };

  const handleActionChange = (e: React.ChangeEvent<HTMLSelectElement>) => {
    e.stopPropagation();
    const newAction = e.target.value as ActionType;
    // Regenerate ZeuZ step with new action
    const newZeuzStep = formatAsZeuzStep(step.element, newAction, step.stepNumber);
    updateStep(step.id, { action: newAction, zeuzStep: newZeuzStep });
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
                  row.type === 'optional option' ? 'text-warning' :
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
        <div className="mt-2 flex justify-end">
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
        <div className="flex items-center gap-2 mb-1">
          <span className="text-xs font-mono text-accent font-bold">
            {step.zeuzStep.locatorName}
          </span>
          <span className="text-xs text-text-muted">=</span>
          <span className={`text-xs font-mono flex-1 truncate ${
            step.selector.matchCount === 1 ? 'text-success' :
            step.selector.matchCount > 1 ? 'text-error' : 'text-text-muted'
          }`} title={step.zeuzStep.locator}>
            {step.zeuzStep.locator}
          </span>
          {step.selector.matchCount >= 0 && (
            <span className={`text-xs px-1.5 py-0.5 rounded ${
              step.selector.matchCount === 1 ? 'bg-success/20 text-success' : 'bg-error/20 text-error'
            }`}>
              {step.selector.matchCount === 1 ? '✓ 1' : `⚠ ${step.selector.matchCount}`}
            </span>
          )}
        </div>

        {/* Copy XPath button */}
        <div className="flex justify-end mt-1">
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
