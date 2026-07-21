/**
 * MultiCaptureProgress
 *
 * Sits between the Toolbar and the step list.
 * Only visible when multiCapturePhase !== 'idle'.
 *
 * Shows:
 *   - Which action is being captured (Drag & Drop / Save Attribute)
 *   - Step indicator: "Select Source" / "Select Destination" etc.
 *   - Preview card of the first captured element (after click 1)
 *   - Variable name field + Generate button (save-attr only, after click 2)
 *   - Reset button (cancels entire session)
 */

import React, { useRef, useEffect } from 'react';
import { useStore } from '../../store';
import { CapturedElement } from '../../../shared/types';
import { generateVarName, buildDragDropStep, buildSaveAttributeListStep, toZeuzStep } from '../../utils/zeuzMultiFormatter';
import { generateSelector } from '../../utils/xpathGenerator';

// ─── Small element preview card ─────────────────────────────────────────────────

const ElementPreviewCard: React.FC<{
  label: string;
  element: CapturedElement;
  color: 'green' | 'amber';
}> = ({ label, element, color }) => {
  const xpath = (element as any)._smartXpath || '';
  const colorMap = {
    green: {
      border: 'border-green-500/40',
      bg: 'bg-green-500/10',
      badge: 'bg-green-500/20 text-green-300',
      label: 'text-green-400',
    },
    amber: {
      border: 'border-amber-500/40',
      bg: 'bg-amber-500/10',
      badge: 'bg-amber-500/20 text-amber-300',
      label: 'text-amber-400',
    },
  };
  const c = colorMap[color];

  return (
    <div className={`rounded-lg border ${c.border} ${c.bg} p-2.5`}>
      <div className="flex items-center gap-2 mb-1.5">
        <span className={`text-[10px] font-semibold uppercase tracking-wide ${c.label}`}>
          ✓ {label}
        </span>
      </div>
      <div className="grid grid-cols-[auto_1fr] gap-x-3 gap-y-0.5 text-xs font-mono">
        <span className="text-text-muted">tag</span>
        <span className="text-text">&lt;{element.tag}&gt;</span>
        {element.text?.trim() && (
          <>
            <span className="text-text-muted">text</span>
            <span className="text-text truncate max-w-[200px]">{element.text.trim().substring(0, 50)}</span>
          </>
        )}
        {element.classes.filter(c => c.length > 3).length > 0 && (
          <>
            <span className="text-text-muted">class</span>
            <span className="text-text truncate max-w-[200px]">
              {element.classes.filter(c => c.length > 3).slice(0, 3).join(' ')}
            </span>
          </>
        )}
        {xpath && (
          <>
            <span className="text-text-muted">xpath</span>
            <span className="text-text-muted truncate max-w-[200px]">{xpath}</span>
          </>
        )}
      </div>
    </div>
  );
};

// ─── Step indicator dot ─────────────────────────────────────────────────────────

const StepDot: React.FC<{ done: boolean; active: boolean; label: string }> = ({ done, active, label }) => (
  <div className="flex items-center gap-2">
    <div className={`w-5 h-5 rounded-full flex items-center justify-center text-[10px] font-bold flex-shrink-0 ${
      done
        ? 'bg-green-500/30 text-green-300 border border-green-500/50'
        : active
          ? 'bg-primary-500/30 text-primary-300 border border-primary-500/50 animate-pulse'
          : 'bg-surface text-text-muted border border-surface-light'
    }`}>
      {done ? '✓' : active ? '→' : '·'}
    </div>
    <span className={`text-xs ${done ? 'text-green-400' : active ? 'text-primary-300' : 'text-text-muted'}`}>
      {label}
    </span>
  </div>
);

// ─── Main component ─────────────────────────────────────────────────────────────

export const MultiCaptureProgress: React.FC = () => {
  const multiCaptureAction   = useStore(s => s.multiCaptureAction);
  const multiCapturePhase    = useStore(s => s.multiCapturePhase);
  const multiCaptureSelection1 = useStore(s => s.multiCaptureSelection1);
  const multiCaptureSelection2 = useStore(s => s.multiCaptureSelection2);
  const multiCaptureVarName  = useStore(s => s.multiCaptureVarName);
  const setMultiCaptureVarName = useStore(s => s.setMultiCaptureVarName);
  const resetMultiCapture    = useStore(s => s.resetMultiCapture);
  const addStep              = useStore(s => s.addStep);
  const steps                = useStore(s => s.steps);

  const varInputRef = useRef<HTMLInputElement>(null);

  // Focus variable name field when awaitingConfirm phase starts
  useEffect(() => {
    if (multiCapturePhase === 'awaitingConfirm' && varInputRef.current) {
      varInputRef.current.focus();
      varInputRef.current.select();
    }
  }, [multiCapturePhase]);

  if (multiCapturePhase === 'idle' || !multiCaptureAction) return null;

  const isDragDrop = multiCaptureAction === 'drag-and-drop';

  // Labels per action
  const labels = isDragDrop
    ? { first: 'Select Source Element', second: 'Select Destination Element',
        firstDone: 'Source', secondDone: 'Destination' }
    : { first: 'Select Target Element (repeated item)', second: 'Select Container Element (parent)',
        firstDone: 'Target', secondDone: 'Container' };

  const title = isDragDrop ? 'Drag & Drop' : 'Save Attribute Values in List';

  const step1done = multiCapturePhase === 'waitingForSecond' || multiCapturePhase === 'awaitingConfirm';
  const step2done = multiCapturePhase === 'awaitingConfirm';

  // Generate button handler (save-attr only)
  const handleGenerate = () => {
    if (!multiCaptureSelection1 || !multiCaptureSelection2) return;
    const stepNumber = steps.length + 1;
    const multi = buildSaveAttributeListStep(
      stepNumber,
      multiCaptureSelection1,
      multiCaptureSelection2,
      multiCaptureVarName,
    );
    const zeuzStep = toZeuzStep(multi, stepNumber);
    const selector = generateSelector(multiCaptureSelection1);
    selector.matchCount = -1;
    addStep(multiCaptureSelection1, 'save-attribute-list', selector, zeuzStep as any);
    resetMultiCapture();
  };

  const handleKeyDown = (e: React.KeyboardEvent) => {
    if (e.key === 'Enter') handleGenerate();
    if (e.key === 'Escape') resetMultiCapture();
  };

  return (
    <div className="border-b border-surface-light bg-surface-mid">
      {/* Header bar */}
      <div className="flex items-center justify-between px-3 py-2 border-b border-surface-light/50">
        <div className="flex items-center gap-2">
          <span className="w-2 h-2 rounded-full bg-primary-400 animate-pulse" />
          <span className="text-xs font-semibold text-primary-300">{title}</span>
        </div>
        <button
          onClick={resetMultiCapture}
          className="text-xs text-text-muted hover:text-error hover:bg-error/10 px-2 py-0.5 rounded transition-colors"
          title="Cancel capture"
        >
          Reset ✕
        </button>
      </div>

      <div className="p-3 flex flex-col gap-3">
        {/* Progress indicators */}
        <div className="flex flex-col gap-1.5">
          <StepDot
            done={step1done}
            active={multiCapturePhase === 'waitingForFirst'}
            label={step1done ? `${labels.firstDone} captured` : labels.first}
          />
          <StepDot
            done={step2done}
            active={multiCapturePhase === 'waitingForSecond'}
            label={step2done ? `${labels.secondDone} captured` : labels.second}
          />
        </div>

        {/* Selection 1 preview card */}
        {multiCaptureSelection1 && (
          <ElementPreviewCard
            label={labels.firstDone}
            element={multiCaptureSelection1}
            color="green"
          />
        )}

        {/* Selection 2 preview card */}
        {multiCaptureSelection2 && (
          <ElementPreviewCard
            label={labels.secondDone}
            element={multiCaptureSelection2}
            color="amber"
          />
        )}

        {/* Waiting prompt */}
        {multiCapturePhase === 'waitingForFirst' && (
          <p className="text-xs text-text-muted italic">
            Click an element on the page to capture it…
          </p>
        )}
        {multiCapturePhase === 'waitingForSecond' && (
          <p className="text-xs text-text-muted italic">
            Now click the {isDragDrop ? 'destination' : 'container'} element…
          </p>
        )}

        {/* Variable name + Generate (save-attr only, awaitingConfirm phase) */}
        {multiCapturePhase === 'awaitingConfirm' && !isDragDrop && (
          <div className="flex flex-col gap-2">
            <label className="text-xs text-text-muted font-medium">Variable Name</label>
            <div className="flex gap-2">
              <input
                ref={varInputRef}
                type="text"
                value={multiCaptureVarName}
                onChange={e => setMultiCaptureVarName(e.target.value)}
                onKeyDown={handleKeyDown}
                className="flex-1 bg-surface text-text text-xs font-mono px-2 py-1.5 rounded border border-surface-light focus:outline-none focus:border-primary-500"
                placeholder="variable_name"
                spellCheck={false}
              />
              <button
                onClick={handleGenerate}
                disabled={!multiCaptureVarName.trim()}
                className="px-3 py-1.5 rounded text-xs font-medium bg-primary-500/20 text-primary-300 hover:bg-primary-500/30 disabled:opacity-40 disabled:cursor-not-allowed transition-colors"
              >
                Generate
              </button>
            </div>
          </div>
        )}
      </div>
    </div>
  );
};
