import React, { useState } from 'react';
import { useStore, Step } from '../../store';
import { ActionType } from '../../utils/actionRecommender';
import { copyZeuzStep } from '../../utils/zeuzFormatter';

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
  { value: 'verify-exists', label: 'Verify Exists' },
  { value: 'verify-text', label: 'Verify Text' },
];

/**
 * Copy text to clipboard — works in DevTools panels where navigator.clipboard may fail
 */
function copyToClipboard(text: string): boolean {
  try {
    // Try modern API first
    if (navigator.clipboard && navigator.clipboard.writeText) {
      navigator.clipboard.writeText(text);
      return true;
    }
  } catch (e) {
    // Fall through to fallback
  }

  // Fallback: use execCommand
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

export const StepRow: React.FC<StepRowProps> = ({ step }) => {
  const selectedStepId = useStore((s) => s.selectedStepId);
  const selectStep = useStore((s) => s.selectStep);
  const removeStep = useStore((s) => s.removeStep);
  const updateStep = useStore((s) => s.updateStep);
  const setHighlightXpath = useStore((s) => s.setHighlightXpath);
  const [copied, setCopied] = useState(false);

  const isSelected = selectedStepId === step.id;

  const handleCopy = (e: React.MouseEvent) => {
    e.stopPropagation();
    const text = copyZeuzStep(step.zeuzStep);
    const success = copyToClipboard(text);
    if (success) {
      setCopied(true);
      setTimeout(() => setCopied(false), 1500);
    }
  };

  const handleDelete = (e: React.MouseEvent) => {
    e.stopPropagation();
    removeStep(step.id);
  };

  const handleActionChange = (e: React.ChangeEvent<HTMLSelectElement>) => {
    e.stopPropagation();
    updateStep(step.id, { action: e.target.value as ActionType });
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

        {/* Copy button */}
        <button
          className={`flex-shrink-0 px-2 py-0.5 rounded text-xs transition-colors ${
            copied
              ? 'bg-success/20 text-success'
              : 'bg-surface hover:bg-primary-500/20 text-text-muted hover:text-primary-400'
          }`}
          onClick={handleCopy}
          title="Copy ZeuZ step"
        >
          {copied ? '✓ Copied' : '📋 Copy'}
        </button>

        {/* Delete button */}
        <button
          className="flex-shrink-0 p-1 rounded hover:bg-error/20 text-text-muted hover:text-error transition-colors text-xs"
          onClick={handleDelete}
          title="Delete step"
        >
          ✕
        </button>
      </div>

      {/* ZeuZ parameter rows — what you copy-paste into ZeuZ */}
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
              </tr>
            ))}
          </tbody>
        </table>
      </div>

      {/* LOCATOR — auto-generated XPath with variable name */}
      <div className="px-3 py-1.5 bg-surface/50 rounded-b-lg">
        <div className="flex items-center gap-2 mb-1">
          <span className="text-xs font-mono text-accent font-bold">
            {step.zeuzStep.locatorName}
          </span>
          {step.selector.matchCount >= 0 && (
            <span className={`text-xs px-1.5 py-0.5 rounded ${
              step.selector.matchCount === 1 ? 'bg-success/20 text-success' : 'bg-error/20 text-error'
            }`}>
              {step.selector.matchCount === 1 ? '✓ 1' : `⚠ ${step.selector.matchCount}`}
            </span>
          )}
        </div>
        <div className={`text-xs font-mono truncate ${
          step.selector.matchCount === 1 ? 'text-success' :
          step.selector.matchCount > 1 ? 'text-error' : 'text-text-muted'
        }`} title={step.zeuzStep.locator}>
          {step.zeuzStep.locator}
        </div>
      </div>
    </div>
  );
};
