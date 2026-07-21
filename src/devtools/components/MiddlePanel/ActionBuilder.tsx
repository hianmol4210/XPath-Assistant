import React, { useState } from 'react';
import { useStore } from '../../store';
import { copyAllSteps } from '../../utils/zeuzFormatter';
import { StepRow } from './StepRow';
import { MultiCaptureProgress } from './MultiCaptureProgress';

function copyToClipboard(text: string): boolean {
  try {
    if (navigator.clipboard && navigator.clipboard.writeText) {
      navigator.clipboard.writeText(text);
      return true;
    }
  } catch (e) {}
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
    return false;
  }
}

export const ActionBuilder: React.FC = () => {
  const steps = useStore((s) => s.steps);
  const checkedStepIds = useStore((s) => s.checkedStepIds);
  const checkAllSteps = useStore((s) => s.checkAllSteps);
  const uncheckAllSteps = useStore((s) => s.uncheckAllSteps);
  const [copiedAll, setCopiedAll] = useState(false);
  const [copiedSelected, setCopiedSelected] = useState(false);

  const allChecked = steps.length > 0 && checkedStepIds.size === steps.length;
  const someChecked = checkedStepIds.size > 0 && checkedStepIds.size < steps.length;

  const handleSelectAll = () => {
    if (allChecked) {
      uncheckAllSteps();
    } else {
      checkAllSteps();
    }
  };

  const handleCopyAll = () => {
    if (steps.length === 0) return;
    if (copiedAll) {
      setCopiedAll(false);
    } else {
      const text = copyAllSteps(steps.map(s => s.zeuzStep));
      if (copyToClipboard(text)) {
        setCopiedAll(true);
      }
    }
  };

  const handleCopySelected = () => {
    const selectedSteps = steps.filter(s => checkedStepIds.has(s.id));
    if (selectedSteps.length === 0) return;
    if (copiedSelected) {
      setCopiedSelected(false);
    } else {
      const text = copyAllSteps(selectedSteps.map(s => s.zeuzStep));
      if (copyToClipboard(text)) {
        setCopiedSelected(true);
      }
    }
  };

  if (steps.length === 0) {
    return (
      <div className="flex flex-col h-full">
        <MultiCaptureProgress />
        <div className="flex flex-col items-center justify-center flex-1 p-6 text-center">
          <p className="text-sm text-text-muted">
            Start capturing elements to build automation steps
          </p>
        </div>
      </div>
    );
  }

  return (
    <div className="flex flex-col h-full">
      {/* Multi-capture progress panel — visible only during active multi-capture */}
      <MultiCaptureProgress />

      {/* Header with Select All + Copy buttons */}
      <div className="flex items-center gap-3 px-3 py-2 border-b border-surface/50 bg-surface-mid sticky top-0 z-5">
        {/* Select All checkbox */}
        <label className="flex items-center gap-2 cursor-pointer">
          <input
            type="checkbox"
            checked={allChecked}
            ref={(el) => { if (el) el.indeterminate = someChecked; }}
            onChange={handleSelectAll}
            className="w-4 h-4 rounded border-surface-light accent-primary-500"
          />
          <span className="text-xs text-text-muted">
            {allChecked ? 'Deselect All' : 'Select All'}
          </span>
        </label>

        <span className="text-xs text-text-muted">
          {checkedStepIds.size > 0 && `${checkedStepIds.size}/${steps.length} selected`}
        </span>

        <div className="flex-1" />

        {/* Copy Selected button */}
        <button
          className={`px-3 py-1 rounded text-xs font-medium transition-colors ${
            copiedSelected
              ? 'bg-success/20 text-success'
              : checkedStepIds.size > 0
                ? 'bg-accent/10 text-accent hover:bg-accent/20'
                : 'bg-surface text-text-muted/50 cursor-not-allowed'
          }`}
          onClick={handleCopySelected}
          disabled={checkedStepIds.size === 0}
          title="Copy selected steps as ZeuZ JSON"
        >
          {copiedSelected ? '✓ Copied' : `📋 Copy Selected (${checkedStepIds.size})`}
        </button>

        {/* Copy All button */}
        <button
          className={`px-3 py-1 rounded text-xs font-medium transition-colors ${
            copiedAll
              ? 'bg-success/20 text-success'
              : 'bg-primary-500/10 text-primary-400 hover:bg-primary-500/20'
          }`}
          onClick={handleCopyAll}
          title="Copy all steps as ZeuZ JSON"
        >
          {copiedAll ? '✓ Copied All' : '📋 Copy All'}
        </button>
      </div>

      {/* Step list */}
      <div className="flex-1 p-3 gap-2 overflow-y-auto flex flex-col">
        {steps.map((step) => (
          <StepRow key={step.id} step={step} />
        ))}
      </div>
    </div>
  );
};
