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
  { value: 'wait-disable', label: 'Wait Disable' },
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

// ─── Store Panel Component ───────────────────────────────────────────────────

type StoreType = 'save-attribute' | 'save-list';

const StorePanel: React.FC<{ step: Step; onCopy: () => void }> = ({ step, onCopy }) => {
  const [storeType, setStoreType] = useState<StoreType>('save-attribute');
  const [variableName, setVariableName] = useState(
    `${step.zeuzStep.locatorName.replace('xpath_', '')}_value`
  );
  const [saveField, setSaveField] = useState('text');
  const [targetParam, setTargetParam] = useState('tag="td", return="text"');
  const [paired, setPaired] = useState('yes');
  const [copiedStore, setCopiedStore] = useState(false);

  const generateStoreJson = () => {
    const stepActions: [string, string, string][] = [];

    // Add element/parent parameters from the captured step
    step.zeuzStep.rows.forEach(row => {
      if (row.type === 'element parameter' || row.type === 'parent parameter') {
        stepActions.push([row.field, row.type, row.value]);
      }
    });

    if (storeType === 'save-attribute') {
      // Single value save
      stepActions.push([saveField, 'save parameter', variableName]);
      stepActions.push(['save attribute', 'selenium action', 'save attribute']);
    } else {
      // Save as list
      stepActions.push(['attributes', 'target parameter', targetParam]);
      stepActions.push(['paired', 'optional parameter', paired]);
      stepActions.push(['save attribute values in list', 'selenium action', variableName]);
    }

    const result = [{
      action_name: storeType === 'save-attribute'
        ? `Save ${saveField} of ${step.zeuzStep.title.replace(/^#\d+\s*/, '').replace(/^Click on\s*/, '').replace(/^Enter text in on\s*/, '')}`
        : `Save list from ${step.zeuzStep.title.replace(/^#\d+\s*/, '').replace(/^Click on\s*/, '')}`,
      action_disabled: 'false',
      step_actions: stepActions,
    }];

    return JSON.stringify(result);
  };

  const handleCopy = (e: React.MouseEvent) => {
    e.stopPropagation();
    const json = generateStoreJson();
    if (copyToClipboard(json)) {
      setCopiedStore(true);
      onCopy();
    }
  };

  return (
    <div className="mt-2 p-3 bg-surface rounded-lg border border-warning/30" onClick={e => e.stopPropagation()}>
      <div className="text-xs font-semibold text-warning mb-2">💾 Store Configuration</div>

      {/* Store Type */}
      <div className="flex items-center gap-2 mb-2">
        <span className="text-xs text-text-muted w-20">Type:</span>
        <select
          className="bg-surface-light text-text text-xs rounded px-2 py-1 border border-surface-mid flex-1"
          value={storeType}
          onChange={e => setStoreType(e.target.value as StoreType)}
        >
          <option value="save-attribute">Save Attribute (single value)</option>
          <option value="save-list">Save Attribute Values in List</option>
        </select>
      </div>

      {/* Save Attribute fields */}
      {storeType === 'save-attribute' && (
        <>
          <div className="flex items-center gap-2 mb-2">
            <span className="text-xs text-text-muted w-20">Field:</span>
            <select
              className="bg-surface-light text-text text-xs rounded px-2 py-1 border border-surface-mid flex-1"
              value={saveField}
              onChange={e => setSaveField(e.target.value)}
            >
              <option value="text">text</option>
              <option value="id">id</option>
              <option value="class">class</option>
              <option value="href">href</option>
              <option value="src">src</option>
              <option value="value">value</option>
              <option value="title">title</option>
              <option value="innertext">innertext</option>
            </select>
          </div>
          <div className="flex items-center gap-2 mb-2">
            <span className="text-xs text-text-muted w-20">Variable:</span>
            <input
              className="bg-surface-light text-text text-xs rounded px-2 py-1 border border-surface-mid flex-1 font-mono"
              value={variableName}
              onChange={e => setVariableName(e.target.value)}
            />
          </div>
        </>
      )}

      {/* Save List fields */}
      {storeType === 'save-list' && (
        <>
          <div className="flex items-center gap-2 mb-2">
            <span className="text-xs text-text-muted w-20">Target:</span>
            <input
              className="bg-surface-light text-text text-xs rounded px-2 py-1 border border-surface-mid flex-1 font-mono"
              value={targetParam}
              onChange={e => setTargetParam(e.target.value)}
              placeholder='tag="td", return="text"'
            />
          </div>
          <div className="flex items-center gap-2 mb-2">
            <span className="text-xs text-text-muted w-20">Paired:</span>
            <select
              className="bg-surface-light text-text text-xs rounded px-2 py-1 border border-surface-mid"
              value={paired}
              onChange={e => setPaired(e.target.value)}
            >
              <option value="yes">yes</option>
              <option value="no">no</option>
            </select>
          </div>
          <div className="flex items-center gap-2 mb-2">
            <span className="text-xs text-text-muted w-20">List name:</span>
            <input
              className="bg-surface-light text-text text-xs rounded px-2 py-1 border border-surface-mid flex-1 font-mono"
              value={variableName}
              onChange={e => setVariableName(e.target.value)}
            />
          </div>
        </>
      )}

      {/* Copy Store button */}
      <div className="flex justify-end">
        <button
          className={`px-3 py-1 rounded text-xs font-medium transition-colors ${
            copiedStore
              ? 'bg-success/20 text-success'
              : 'bg-warning/10 text-warning hover:bg-warning/20'
          }`}
          onClick={handleCopy}
        >
          {copiedStore ? '✓ Copied Store Action' : '📋 Copy Store Action'}
        </button>
      </div>
    </div>
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
  const [showStore, setShowStore] = useState(false);
  const [copiedStore, setCopiedStore] = useState(false);

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

        {/* Copy ZeuZ button + Store button */}
        <div className="mt-2 flex justify-end gap-2">
          <button
            className={`px-3 py-1 rounded text-xs font-medium transition-colors ${
              showStore
                ? 'bg-warning/20 text-warning'
                : 'bg-warning/10 text-warning hover:bg-warning/20'
            }`}
            onClick={(e) => { e.stopPropagation(); setShowStore(!showStore); }}
            title="Store value or list"
          >
            {showStore ? '✕ Close Store' : '💾 Store'}
          </button>
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

        {/* Store Panel — collapsible */}
        {showStore && (
          <StorePanel step={step} onCopy={() => { setCopiedStore(true); setTimeout(() => setCopiedStore(false), 0); }} />
        )}
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
        </div>

        {/* Full XPath on its own line — wraps, fully selectable */}
        <div className={`text-xs font-mono break-all select-all cursor-text p-1.5 rounded bg-surface ${
          step.selector.matchCount === 1 ? 'text-success' :
          step.selector.matchCount > 1 ? 'text-error' : 'text-text-muted'
        }`}>
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
