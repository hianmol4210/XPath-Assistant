import React, { useState } from 'react';
import { useStore, Step } from '../../store';
import { copyZeuzStep } from '../../utils/zeuzFormatter';

// ─── Copy Icon SVG ──────────────────────────────────────────────────────────────

const CopyIcon: React.FC<{ size?: number }> = ({ size = 14 }) => (
  <svg
    width={size}
    height={size}
    viewBox="0 0 24 24"
    fill="none"
    stroke="currentColor"
    strokeWidth="2"
    strokeLinecap="round"
    strokeLinejoin="round"
  >
    <rect x="9" y="9" width="13" height="13" rx="2" ry="2" />
    <path d="M5 15H4a2 2 0 0 1-2-2V4a2 2 0 0 1 2-2h9a2 2 0 0 1 2 2v1" />
  </svg>
);

const CheckIcon: React.FC<{ size?: number }> = ({ size = 14 }) => (
  <svg
    width={size}
    height={size}
    viewBox="0 0 24 24"
    fill="none"
    stroke="currentColor"
    strokeWidth="2"
    strokeLinecap="round"
    strokeLinejoin="round"
  >
    <polyline points="20 6 9 17 4 12" />
  </svg>
);

// ─── Copy Button ────────────────────────────────────────────────────────────────

const CopyButton: React.FC<{ text: string; label?: string }> = ({ text, label }) => {
  const [copied, setCopied] = useState(false);

  const handleCopy = () => {
    navigator.clipboard.writeText(text).then(() => {
      setCopied(true);
      setTimeout(() => setCopied(false), 1500);
    });
  };

  return (
    <button
      onClick={handleCopy}
      title={label || 'Copy to clipboard'}
      className="p-1 rounded text-text-muted hover:text-text hover:bg-surface-light transition-colors flex-shrink-0"
    >
      {copied ? <CheckIcon /> : <CopyIcon />}
    </button>
  );
};

// ─── Info Row ───────────────────────────────────────────────────────────────────

const InfoRow: React.FC<{ label: string; value: string }> = ({ label, value }) => {
  if (!value) return null;
  return (
    <div className="flex gap-2 py-0.5">
      <span className="text-xs text-text-muted w-16 flex-shrink-0">{label}</span>
      <span className="text-sm text-text font-mono break-all">{value}</span>
    </div>
  );
};

// ─── Selector Row ───────────────────────────────────────────────────────────────

const SelectorRow: React.FC<{ label: string; value: string }> = ({ label, value }) => {
  if (!value) return null;
  return (
    <div className="flex items-start gap-2 py-1">
      <span className="text-xs text-text-muted w-24 flex-shrink-0 pt-0.5">{label}</span>
      <span className="text-xs text-text font-mono break-all flex-1 bg-surface p-1 rounded">
        {value}
      </span>
      <CopyButton text={value} />
    </div>
  );
};

// ─── Confidence Badge ───────────────────────────────────────────────────────────

const ConfidenceBadge: React.FC<{ confidence: number }> = ({ confidence }) => {
  let colorClass = 'bg-error/20 text-error';
  if (confidence >= 90) {
    colorClass = 'bg-success/20 text-success';
  } else if (confidence >= 70) {
    colorClass = 'bg-warning/20 text-warning';
  }

  return (
    <span className={`inline-flex items-center gap-1 px-1.5 py-0.5 rounded text-xs ${colorClass}`}>
      <span className={`w-2 h-2 rounded-full ${confidence >= 90 ? 'bg-success' : confidence >= 70 ? 'bg-warning' : 'bg-error'}`} />
      {confidence}%
    </span>
  );
};

// ─── Match Count Badge ──────────────────────────────────────────────────────────

const MatchCountBadge: React.FC<{ matchCount: number }> = ({ matchCount }) => {
  if (matchCount === -1) {
    return (
      <span className="text-xs px-1.5 py-0.5 rounded bg-warning/20 text-warning">
        Not evaluated
      </span>
    );
  }
  if (matchCount === 1) {
    return (
      <span className="text-xs px-1.5 py-0.5 rounded bg-success/20 text-success">
        Matches: 1
      </span>
    );
  }
  return (
    <span className="text-xs px-1.5 py-0.5 rounded bg-error/20 text-error">
      Matches: {matchCount}
    </span>
  );
};

// ─── Section Card ───────────────────────────────────────────────────────────────

const SectionCard: React.FC<{ title: string; children: React.ReactNode; action?: React.ReactNode }> = ({
  title,
  children,
  action,
}) => (
  <div className="bg-surface-mid rounded-lg p-3">
    <div className="flex items-center justify-between mb-2">
      <h3 className="text-xs font-semibold text-text-muted uppercase tracking-wide">{title}</h3>
      {action}
    </div>
    {children}
  </div>
);

// ─── State Indicator ────────────────────────────────────────────────────────────

const StateIndicator: React.FC<{ label: string; value: boolean }> = ({ label, value }) => (
  <div className="flex items-center gap-2 py-0.5">
    <span className={`text-sm ${value ? 'text-success' : 'text-error'}`}>
      {value ? '✓' : '✗'}
    </span>
    <span className="text-xs text-text">{label}</span>
  </div>
);

// ─── Main Component ─────────────────────────────────────────────────────────────

export const ElementDetails: React.FC = () => {
  const selectedStepId = useStore((s) => s.selectedStepId);
  const steps = useStore((s) => s.steps);

  const selectedStep: Step | undefined = steps.find((s) => s.id === selectedStepId);

  if (!selectedStep) {
    return (
      <div className="flex flex-col h-full items-center justify-center p-4">
        <p className="text-sm text-text-muted text-center">
          Select a captured element to view its details and selectors.
        </p>
      </div>
    );
  }

  const { element, selector, zeuzStep } = selectedStep;

  const role = element.ariaAttributes?.['role'] || element.attributes?.['role'] || '';
  const ariaLabel = element.ariaAttributes?.['aria-label'] || '';
  const textPreview = element.text ? element.text.substring(0, 100) : '';
  const classStr = element.classes.join(' ');
  const zeuzText = copyZeuzStep(zeuzStep);

  // Multi-capture steps store a secondary locator on the zeuzStep object
  const locator2 = (zeuzStep as any).locator2 as string | undefined;
  const isMultiCapture = !!locator2;

  return (
    <div className="flex flex-col h-full overflow-y-auto p-3 gap-3">
      {/* Section 1: Basic Info */}
      <SectionCard title="Basic Info">
        <div className="space-y-0.5">
          <InfoRow label="Tag" value={`<${element.tag}>`} />
          <InfoRow label="Text" value={textPreview} />
          <InfoRow label="Class" value={classStr} />
          <InfoRow label="ID" value={element.id} />
          <InfoRow label="Name" value={element.name} />
          <InfoRow label="Role" value={role} />
          <InfoRow label="ARIA Label" value={ariaLabel} />
        </div>
      </SectionCard>

      {/* Section 2: Selectors */}
      <SectionCard title="Selectors">
        <div className="space-y-1">
          {/* Recommended XPath with badges */}
          <div className="flex items-start gap-2 py-1">
            <span className="text-xs text-text-muted w-24 flex-shrink-0 pt-0.5">
              {isMultiCapture ? 'Source XPath' : 'Recommended'}
            </span>
            <div className="flex-1 min-w-0">
              <div className="flex items-center gap-2 mb-1">
                <ConfidenceBadge confidence={selector.confidence} />
                <MatchCountBadge matchCount={selector.matchCount} />
              </div>
              <div className="flex items-start gap-1">
                <span className="text-xs text-text font-mono break-all bg-surface p-1 rounded flex-1">
                  {selector.xpath}
                </span>
                <CopyButton text={selector.xpath} />
              </div>
            </div>
          </div>

          {/* Second locator for multi-capture steps (drag-drop dst / save-list container) */}
          {isMultiCapture && locator2 && (
            <div className="flex items-start gap-2 py-1">
              <span className="text-xs text-text-muted w-24 flex-shrink-0 pt-0.5">
                {selectedStep.action === 'drag-and-drop' ? 'Dest XPath' : 'Container'}
              </span>
              <div className="flex items-start gap-1 flex-1">
                <span className="text-xs text-warning font-mono break-all bg-surface p-1 rounded flex-1">
                  {locator2}
                </span>
                <CopyButton text={locator2} />
              </div>
            </div>
          )}

          {!isMultiCapture && (
            <>
              <SelectorRow label="Relative XPath" value={selector.relativeXpath} />
              <SelectorRow label="Absolute XPath" value={selector.absoluteXpath} />
              <SelectorRow label="CSS Selector" value={selector.cssSelector} />
              <SelectorRow label="Parent XPath" value={selector.parentXpath} />
            </>
          )}
        </div>
      </SectionCard>

      {/* Section 3: Attributes */}
      <SectionCard title="Attributes">
        <div className="max-h-40 overflow-y-auto space-y-0.5">
          {Object.entries(element.attributes).length > 0 ? (
            Object.entries(element.attributes).map(([key, value]) => (
              <div key={key} className="text-xs font-mono text-text py-0.5">
                <span className="text-text-muted">{key}</span>
                <span className="text-text-muted">=</span>
                <span className="text-text">"{value}"</span>
              </div>
            ))
          ) : (
            <p className="text-xs text-text-muted">No attributes</p>
          )}
        </div>
      </SectionCard>

      {/* Section 4: Element State */}
      <SectionCard title="Element State">
        <div className="grid grid-cols-2 gap-1">
          <StateIndicator label="Visible" value={element.state.visible} />
          <StateIndicator label="Enabled" value={element.state.enabled} />
          <StateIndicator label="Checked" value={element.state.checked} />
          <StateIndicator label="Selected" value={element.state.selected} />
        </div>
      </SectionCard>

      {/* Section 5: ZeuZ Preview */}
      <SectionCard
        title="ZeuZ Preview"
        action={<CopyButton text={zeuzText} label="Copy ZeuZ step" />}
      >
        <div className="bg-surface rounded p-2 overflow-x-auto">
          <div className="text-xs font-mono text-text-muted mb-1">{zeuzStep.title}</div>
          <div className="grid grid-cols-[auto_auto_1fr] gap-x-4 gap-y-0.5">
            {zeuzStep.rows.map((row, idx) => (
              <React.Fragment key={idx}>
                <span className="text-xs font-mono text-text">{row.field}</span>
                <span className="text-xs font-mono text-text-muted">{row.type}</span>
                <span className="text-xs font-mono text-text">{row.value}</span>
              </React.Fragment>
            ))}
          </div>
        </div>
      </SectionCard>
    </div>
  );
};
