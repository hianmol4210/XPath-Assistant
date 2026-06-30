import React, { useCallback, useState } from 'react';
import { useStore } from '../../store';

// ─── Inline SVG Icons ───────────────────────────────────────────────────────────

const CaptureIcon: React.FC = () => (
  <svg width="16" height="16" viewBox="0 0 16 16" fill="none" stroke="currentColor" strokeWidth="1.5">
    <circle cx="8" cy="8" r="6" />
    <circle cx="8" cy="8" r="2.5" fill="currentColor" />
  </svg>
);

const RecordIcon: React.FC = () => (
  <svg width="16" height="16" viewBox="0 0 16 16" fill="none">
    <circle cx="8" cy="8" r="6" fill="currentColor" />
  </svg>
);

const PauseIcon: React.FC = () => (
  <svg width="16" height="16" viewBox="0 0 16 16" fill="none" stroke="currentColor" strokeWidth="1.5">
    <rect x="4" y="3" width="3" height="10" rx="0.5" fill="currentColor" />
    <rect x="9" y="3" width="3" height="10" rx="0.5" fill="currentColor" />
  </svg>
);

const ResumeIcon: React.FC = () => (
  <svg width="16" height="16" viewBox="0 0 16 16" fill="none">
    <polygon points="4,2 14,8 4,14" fill="currentColor" />
  </svg>
);

const ClearIcon: React.FC = () => (
  <svg width="16" height="16" viewBox="0 0 16 16" fill="none" stroke="currentColor" strokeWidth="1.5">
    <path d="M5 3V2h6v1M2 4h12M3.5 4l.7 10.5a1 1 0 001 .5h5.6a1 1 0 001-.5L12.5 4" />
  </svg>
);

const SettingsIcon: React.FC = () => (
  <svg width="16" height="16" viewBox="0 0 16 16" fill="none" stroke="currentColor" strokeWidth="1.5">
    <circle cx="8" cy="8" r="2.5" />
    <path d="M8 1.5v2M8 12.5v2M1.5 8h2M12.5 8h2M3.3 3.3l1.4 1.4M11.3 11.3l1.4 1.4M3.3 12.7l1.4-1.4M11.3 4.7l1.4-1.4" />
  </svg>
);

const ExportIcon: React.FC = () => (
  <svg width="16" height="16" viewBox="0 0 16 16" fill="none" stroke="currentColor" strokeWidth="1.5">
    <path d="M8 2v8M5 7l3 3 3-3M3 12h10v2H3z" />
  </svg>
);

const FreezeIcon: React.FC = () => (
  <svg width="16" height="16" viewBox="0 0 16 16" fill="none" stroke="currentColor" strokeWidth="1.5">
    <path d="M8 1v14M1 8h14M4 4l8 8M12 4l-8 8" />
  </svg>
);

const CopyIcon: React.FC = () => (
  <svg width="16" height="16" viewBox="0 0 16 16" fill="none" stroke="currentColor" strokeWidth="1.5">
    <rect x="5" y="5" width="8" height="9" rx="1" />
    <path d="M3 11V3a1 1 0 011-1h6" />
  </svg>
);

// ─── ToolbarButton ──────────────────────────────────────────────────────────────

interface ToolbarButtonProps {
  icon: React.ReactNode;
  label: string;
  onClick: () => void;
  active?: boolean;
  variant?: 'default' | 'primary' | 'danger';
  disabled?: boolean;
}

const ToolbarButton: React.FC<ToolbarButtonProps> = ({
  icon,
  label,
  onClick,
  active = false,
  variant = 'default',
  disabled = false,
}) => {
  const baseClasses =
    'flex items-center gap-1.5 px-3 py-1.5 rounded-md text-xs font-medium transition-colors disabled:opacity-40 disabled:cursor-not-allowed';

  const variantClasses = active
    ? variant === 'danger'
      ? 'bg-error/20 text-error border border-error/40'
      : 'bg-primary-500/20 text-primary-400 border border-primary-500/40'
    : variant === 'danger'
      ? 'text-text-muted hover:text-error hover:bg-error/10 border border-transparent'
      : 'text-text-muted hover:text-text hover:bg-surface-light border border-transparent';

  return (
    <button
      className={`${baseClasses} ${variantClasses}`}
      onClick={onClick}
      disabled={disabled}
      title={label}
      aria-label={label}
    >
      {icon}
      <span className="hidden sm:inline">{label}</span>
    </button>
  );
};

// ─── Toolbar ────────────────────────────────────────────────────────────────────

export const Toolbar: React.FC = () => {
  const captureMode = useStore((s) => s.captureMode);
  const startCapture = useStore((s) => s.startCapture);
  const stopCapture = useStore((s) => s.stopCapture);
  const pauseCapture = useStore((s) => s.pauseCapture);
  const startRecording = useStore((s) => s.startRecording);
  const stopRecording = useStore((s) => s.stopRecording);
  const steps = useStore((s) => s.steps);
  const clearSteps = useStore((s) => s.clearSteps);

  const isCapturing = captureMode === 'capturing';
  const isPaused = captureMode === 'paused';
  const isRecording = captureMode === 'recording';
  const isIdle = captureMode === 'idle';

  const handleCaptureToggle = useCallback(() => {
    if (isCapturing || isPaused) {
      stopCapture();
    } else {
      startCapture();
    }
  }, [isCapturing, isPaused, startCapture, stopCapture]);

  const handleRecordToggle = useCallback(() => {
    if (isRecording) {
      stopRecording();
    } else {
      startRecording();
    }
  }, [isRecording, startRecording, stopRecording]);

  const handlePause = useCallback(() => {
    pauseCapture();
  }, [pauseCapture]);

  const handleResume = useCallback(() => {
    startCapture();
  }, [startCapture]);

  const handleClear = useCallback(() => {
    clearSteps();
  }, [clearSteps]);

  const [isFrozen, setIsFrozen] = useState(false);

  const handleFreeze = useCallback(() => {
    if (isFrozen) {
      // Unfreeze: remove the freeze styles
      try {
        chrome.devtools.inspectedWindow.eval(`
          (function() {
            var style = document.getElementById('__qa-freeze-style__');
            if (style) style.remove();
            document.documentElement.classList.remove('__qa-frozen__');
          })();
        `);
      } catch (e) {}
      setIsFrozen(false);
    } else {
      // Freeze: inject CSS that pauses all animations/transitions and disables interaction
      try {
        chrome.devtools.inspectedWindow.eval(`
          (function() {
            if (document.getElementById('__qa-freeze-style__')) return;
            var style = document.createElement('style');
            style.id = '__qa-freeze-style__';
            style.textContent = \`
              .__qa-frozen__,
              .__qa-frozen__ * {
                animation-play-state: paused !important;
                transition: none !important;
              }
              .__qa-frozen__::before {
                content: '';
                position: fixed;
                top: 0; left: 0; right: 0; bottom: 0;
                z-index: 2147483640;
                pointer-events: none;
                border: 4px solid #ef4444;
                box-sizing: border-box;
              }
            \`;
            document.head.appendChild(style);
            document.documentElement.classList.add('__qa-frozen__');
          })();
        `);
      } catch (e) {}
      setIsFrozen(true);
    }
  }, [isFrozen]);

  const handleExport = useCallback(() => {
    // Export functionality will be implemented later (Task 23)
  }, []);

  const handleCopyAll = useCallback(() => {
    if (steps.length === 0) return;

    const allText = steps
      .map((step) => {
        const rows = step.zeuzStep.rows
          .map((row) => `${row.field}\t${row.type}\t${row.value}`)
          .join('\n');
        return `#${step.stepNumber} ${step.zeuzStep.title}\n${rows}`;
      })
      .join('\n\n');

    navigator.clipboard.writeText(allText);
  }, [steps]);

  const handleSettings = useCallback(() => {
    // Settings modal will be implemented later (Task 26)
  }, []);

  return (
    <div className="sticky top-0 z-10 flex items-center gap-1 px-3 py-2 bg-surface-mid border-b border-surface-light">
      {/* Capture Group */}
      <div className="flex items-center gap-1">
        <ToolbarButton
          icon={<CaptureIcon />}
          label={isCapturing || isPaused ? 'Stop Capture' : 'Capture'}
          onClick={handleCaptureToggle}
          active={isCapturing || isPaused}
          disabled={isRecording}
        />
        <ToolbarButton
          icon={<RecordIcon />}
          label={isRecording ? 'Stop Recording' : 'Record'}
          onClick={handleRecordToggle}
          active={isRecording}
          variant="danger"
          disabled={isCapturing || isPaused}
        />
      </div>

      {/* Divider */}
      <div className="w-px h-5 bg-surface-light mx-1" />

      {/* Playback Controls */}
      <div className="flex items-center gap-1">
        <ToolbarButton
          icon={<PauseIcon />}
          label="Pause"
          onClick={handlePause}
          disabled={!isCapturing}
        />
        <ToolbarButton
          icon={<ResumeIcon />}
          label="Resume"
          onClick={handleResume}
          disabled={!isPaused}
        />
      </div>

      {/* Divider */}
      <div className="w-px h-5 bg-surface-light mx-1" />

      {/* Actions */}
      <div className="flex items-center gap-1">
        <ToolbarButton
          icon={<ClearIcon />}
          label="Clear"
          onClick={handleClear}
          disabled={steps.length === 0}
        />
        <ToolbarButton
          icon={<FreezeIcon />}
          label={isFrozen ? 'Unfreeze Page' : 'Freeze Page'}
          onClick={handleFreeze}
          active={isFrozen}
          variant={isFrozen ? 'danger' : 'default'}
        />
      </div>

      {/* Spacer */}
      <div className="flex-1" />

      {/* Right-side Actions */}
      <div className="flex items-center gap-1">
        <ToolbarButton
          icon={<SettingsIcon />}
          label="Settings"
          onClick={handleSettings}
        />
        <ToolbarButton
          icon={<ExportIcon />}
          label="Export"
          onClick={handleExport}
          disabled={steps.length === 0}
        />
        <ToolbarButton
          icon={<CopyIcon />}
          label="Copy All"
          onClick={handleCopyAll}
          disabled={steps.length === 0}
        />
      </div>

      {/* Status Indicator */}
      {isCapturing && (
        <div className="flex items-center gap-1.5 ml-2 px-2 py-1 rounded bg-primary-500/10 border border-primary-500/30">
          <span className="w-2 h-2 rounded-full bg-primary-500 animate-pulse" />
          <span className="text-xs text-primary-400">Capturing</span>
        </div>
      )}
      {isRecording && (
        <div className="flex items-center gap-1.5 ml-2 px-2 py-1 rounded bg-error/10 border border-error/30">
          <span className="w-2 h-2 rounded-full bg-error animate-pulse" />
          <span className="text-xs text-error">Recording</span>
        </div>
      )}
      {isPaused && (
        <div className="flex items-center gap-1.5 ml-2 px-2 py-1 rounded bg-warning/10 border border-warning/30">
          <span className="w-2 h-2 rounded-full bg-warning" />
          <span className="text-xs text-warning">Paused</span>
        </div>
      )}
    </div>
  );
};
