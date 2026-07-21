import React, { useCallback, useState } from 'react';
import { useStore } from '../../store';

// ─── SVG Icons ──────────────────────────────────────────────────────────────────

const CaptureIcon: React.FC = () => (
  <svg width="14" height="14" viewBox="0 0 16 16" fill="none" stroke="currentColor" strokeWidth="1.5">
    <circle cx="8" cy="8" r="6" />
    <circle cx="8" cy="8" r="2.5" fill="currentColor" />
  </svg>
);

const RecordIcon: React.FC = () => (
  <svg width="14" height="14" viewBox="0 0 16 16" fill="none">
    <circle cx="8" cy="8" r="6" fill="currentColor" />
  </svg>
);

const PauseIcon: React.FC = () => (
  <svg width="14" height="14" viewBox="0 0 16 16" fill="none" stroke="currentColor" strokeWidth="1.5">
    <rect x="4" y="3" width="3" height="10" rx="0.5" fill="currentColor" />
    <rect x="9" y="3" width="3" height="10" rx="0.5" fill="currentColor" />
  </svg>
);

const ResumeIcon: React.FC = () => (
  <svg width="14" height="14" viewBox="0 0 16 16" fill="none">
    <polygon points="4,2 14,8 4,14" fill="currentColor" />
  </svg>
);

const ClearIcon: React.FC = () => (
  <svg width="14" height="14" viewBox="0 0 16 16" fill="none" stroke="currentColor" strokeWidth="1.5">
    <path d="M5 3V2h6v1M2 4h12M3.5 4l.7 10.5a1 1 0 001 .5h5.6a1 1 0 001-.5L12.5 4" />
  </svg>
);

const SettingsIcon: React.FC = () => (
  <svg width="14" height="14" viewBox="0 0 16 16" fill="none" stroke="currentColor" strokeWidth="1.5">
    <circle cx="8" cy="8" r="2.5" />
    <path d="M8 1.5v2M8 12.5v2M1.5 8h2M12.5 8h2M3.3 3.3l1.4 1.4M11.3 11.3l1.4 1.4M3.3 12.7l1.4-1.4M11.3 4.7l1.4-1.4" />
  </svg>
);

const ExportIcon: React.FC = () => (
  <svg width="14" height="14" viewBox="0 0 16 16" fill="none" stroke="currentColor" strokeWidth="1.5">
    <path d="M8 2v8M5 7l3 3 3-3M3 12h10v2H3z" />
  </svg>
);

const FreezeIcon: React.FC = () => (
  <svg width="14" height="14" viewBox="0 0 16 16" fill="none" stroke="currentColor" strokeWidth="1.5">
    <path d="M8 1v14M1 8h14M4 4l8 8M12 4l-8 8" />
  </svg>
);

const CopyIcon: React.FC = () => (
  <svg width="14" height="14" viewBox="0 0 16 16" fill="none" stroke="currentColor" strokeWidth="1.5">
    <rect x="5" y="5" width="8" height="9" rx="1" />
    <path d="M3 11V3a1 1 0 011-1h6" />
  </svg>
);

const DragDropIcon: React.FC = () => (
  <svg width="14" height="14" viewBox="0 0 16 16" fill="none" stroke="currentColor" strokeWidth="1.5">
    <rect x="1" y="3" width="6" height="5" rx="1" />
    <rect x="9" y="8" width="6" height="5" rx="1" />
    <path d="M7 5.5h1.5M8.5 5.5V7M8.5 7l1 1.5" />
  </svg>
);

const SaveListIcon: React.FC = () => (
  <svg width="14" height="14" viewBox="0 0 16 16" fill="none" stroke="currentColor" strokeWidth="1.5">
    <rect x="2" y="2" width="12" height="12" rx="1" />
    <path d="M5 5.5h6M5 8h6M5 10.5h4" />
    <path d="M11 2v4l-1.5-1.5" strokeLinecap="round" />
  </svg>
);

// ─── ToolbarButton ──────────────────────────────────────────────────────────────

interface ToolbarButtonProps {
  icon: React.ReactNode;
  label: string;
  onClick: () => void;
  active?: boolean;
  variant?: 'default' | 'danger';
  disabled?: boolean;
}

const ToolbarButton: React.FC<ToolbarButtonProps> = ({
  icon, label, onClick, active = false, variant = 'default', disabled = false,
}) => {
  const base = 'flex items-center gap-1.5 px-2.5 py-1.5 rounded text-xs font-medium transition-colors disabled:opacity-40 disabled:cursor-not-allowed';
  const style = active
    ? variant === 'danger'
      ? 'bg-error/20 text-error border border-error/40'
      : 'bg-primary-500/20 text-primary-400 border border-primary-500/40'
    : variant === 'danger'
      ? 'text-text-muted hover:text-error hover:bg-error/10 border border-transparent'
      : 'text-text-muted hover:text-text hover:bg-surface-light border border-transparent';

  return (
    <button
      className={`${base} ${style}`}
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

const Divider: React.FC = () => <div className="w-px h-5 bg-surface-light mx-0.5 flex-shrink-0" />;

// ─── Toolbar ────────────────────────────────────────────────────────────────────

export const Toolbar: React.FC = () => {
  const captureMode    = useStore(s => s.captureMode);
  const startCapture   = useStore(s => s.startCapture);
  const stopCapture    = useStore(s => s.stopCapture);
  const pauseCapture   = useStore(s => s.pauseCapture);
  const startRecording = useStore(s => s.startRecording);
  const stopRecording  = useStore(s => s.stopRecording);
  const steps          = useStore(s => s.steps);
  const clearSteps     = useStore(s => s.clearSteps);

  const multiCaptureAction = useStore(s => s.multiCaptureAction);
  const multiCapturePhase  = useStore(s => s.multiCapturePhase);
  const startMultiCapture  = useStore(s => s.startMultiCapture);
  const resetMultiCapture  = useStore(s => s.resetMultiCapture);

  const isCapturing  = captureMode === 'capturing';
  const isPaused     = captureMode === 'paused';
  const isRecording  = captureMode === 'recording';

  // Any multi-capture session in progress
  const isMultiActive = multiCapturePhase !== 'idle';

  const [isFrozen, setIsFrozen] = useState(false);

  // ── Capture (single-click) ──
  const handleCaptureToggle = useCallback(() => {
    if (isCapturing || isPaused) stopCapture();
    else startCapture();
  }, [isCapturing, isPaused, startCapture, stopCapture]);

  // ── Record ──
  const handleRecordToggle = useCallback(() => {
    if (isRecording) stopRecording();
    else startRecording();
  }, [isRecording, startRecording, stopRecording]);

  // ── Multi-capture buttons ──
  const handleMultiCapture = useCallback((action: 'drag-and-drop' | 'save-attribute-list') => {
    if (isMultiActive && multiCaptureAction === action) {
      // Same button → cancel
      resetMultiCapture();
      // Also stop the picker if running
      stopCapture();
      return;
    }
    // Start capture mode so the picker is injected
    if (!isCapturing) startCapture();
    startMultiCapture(action);
  }, [isMultiActive, multiCaptureAction, isCapturing, startCapture, startMultiCapture, resetMultiCapture, stopCapture]);

  // ── Pause / Resume ──
  const handlePause  = useCallback(() => { pauseCapture(); }, [pauseCapture]);
  const handleResume = useCallback(() => { startCapture(); }, [startCapture]);

  // ── Clear ──
  const handleClear = useCallback(() => { clearSteps(); }, [clearSteps]);

  // ── Freeze page ──
  const handleFreeze = useCallback(() => {
    if (isFrozen) {
      try {
        chrome.devtools.inspectedWindow.eval(`
          (function(){
            var s=document.getElementById('__qa-freeze-style__');
            if(s) s.remove();
            document.documentElement.classList.remove('__qa-frozen__');
          })();
        `);
      } catch (_) {}
      setIsFrozen(false);
    } else {
      try {
        chrome.devtools.inspectedWindow.eval(`
          (function(){
            if(document.getElementById('__qa-freeze-style__')) return;
            var s=document.createElement('style');
            s.id='__qa-freeze-style__';
            s.textContent=\`
              .__qa-frozen__,.__qa-frozen__ * {
                animation-play-state:paused!important;transition:none!important;
              }
              .__qa-frozen__::before {
                content:'';position:fixed;top:0;left:0;right:0;bottom:0;
                z-index:2147483640;pointer-events:none;
                border:4px solid #ef4444;box-sizing:border-box;
              }
            \`;
            document.head.appendChild(s);
            document.documentElement.classList.add('__qa-frozen__');
          })();
        `);
      } catch (_) {}
      setIsFrozen(true);
    }
  }, [isFrozen]);

  // ── Export / Copy All / Settings ──
  const handleExport = useCallback(() => { /* Task 23 */ }, []);

  const handleCopyAll = useCallback(() => {
    if (steps.length === 0) return;
    const text = steps.map(step => {
      const rows = step.zeuzStep.rows.map(r => `${r.field}\t${r.type}\t${r.value}`).join('\n');
      return `${step.zeuzStep.title}\n${rows}`;
    }).join('\n\n');
    navigator.clipboard.writeText(text);
  }, [steps]);

  const handleSettings = useCallback(() => { /* Task 26 */ }, []);

  return (
    <div className="sticky top-0 z-10 flex items-center gap-1 px-2 py-1.5 bg-surface-mid border-b border-surface-light flex-wrap">

      {/* ── Group 1: Playback controls ── */}
      <div className="flex items-center gap-0.5">
        <ToolbarButton
          icon={<RecordIcon />}
          label={isRecording ? 'Stop Recording' : 'Record'}
          onClick={handleRecordToggle}
          active={isRecording}
          variant="danger"
          disabled={isCapturing || isPaused || isMultiActive}
        />
        <ToolbarButton
          icon={<PauseIcon />}
          label="Pause"
          onClick={handlePause}
          disabled={!isCapturing || isMultiActive}
        />
        <ToolbarButton
          icon={<ResumeIcon />}
          label="Resume"
          onClick={handleResume}
          disabled={!isPaused}
        />
      </div>

      <Divider />

      {/* ── Group 2: Capture actions (visually distinct) ── */}
      <div className="flex items-center gap-0.5">
        {/* Single-click Capture */}
        <ToolbarButton
          icon={<CaptureIcon />}
          label={isCapturing || isPaused ? 'Stop' : 'Capture'}
          onClick={handleCaptureToggle}
          active={isCapturing || isPaused}
          disabled={isRecording || isMultiActive}
        />

        {/* Save Attribute Values in List */}
        <ToolbarButton
          icon={<SaveListIcon />}
          label={isMultiActive && multiCaptureAction === 'save-attribute-list' ? 'Cancel' : 'Save Attr List'}
          onClick={() => handleMultiCapture('save-attribute-list')}
          active={isMultiActive && multiCaptureAction === 'save-attribute-list'}
          variant={isMultiActive && multiCaptureAction === 'save-attribute-list' ? 'danger' : 'default'}
          disabled={isRecording || (isMultiActive && multiCaptureAction !== 'save-attribute-list') || (isCapturing && !isMultiActive)}
        />

        {/* Drag & Drop */}
        <ToolbarButton
          icon={<DragDropIcon />}
          label={isMultiActive && multiCaptureAction === 'drag-and-drop' ? 'Cancel' : 'Drag & Drop'}
          onClick={() => handleMultiCapture('drag-and-drop')}
          active={isMultiActive && multiCaptureAction === 'drag-and-drop'}
          variant={isMultiActive && multiCaptureAction === 'drag-and-drop' ? 'danger' : 'default'}
          disabled={isRecording || (isMultiActive && multiCaptureAction !== 'drag-and-drop') || (isCapturing && !isMultiActive)}
        />
      </div>

      <Divider />

      {/* ── Group 3: Page tools ── */}
      <div className="flex items-center gap-0.5">
        <ToolbarButton
          icon={<ClearIcon />}
          label="Clear"
          onClick={handleClear}
          disabled={steps.length === 0}
        />
        <ToolbarButton
          icon={<FreezeIcon />}
          label={isFrozen ? 'Unfreeze' : 'Freeze'}
          onClick={handleFreeze}
          active={isFrozen}
          variant={isFrozen ? 'danger' : 'default'}
        />
      </div>

      {/* Spacer */}
      <div className="flex-1" />

      {/* ── Group 4: Output actions ── */}
      <div className="flex items-center gap-0.5">
        <ToolbarButton icon={<SettingsIcon />} label="Settings" onClick={handleSettings} />
        <ToolbarButton icon={<ExportIcon />}   label="Export"   onClick={handleExport}   disabled={steps.length === 0} />
        <ToolbarButton icon={<CopyIcon />}     label="Copy All" onClick={handleCopyAll}  disabled={steps.length === 0} />
      </div>

      {/* ── Status badges ── */}
      {isCapturing && !isMultiActive && (
        <div className="flex items-center gap-1.5 ml-1 px-2 py-0.5 rounded bg-primary-500/10 border border-primary-500/30">
          <span className="w-1.5 h-1.5 rounded-full bg-primary-500 animate-pulse" />
          <span className="text-[11px] text-primary-400">Capturing</span>
        </div>
      )}
      {isRecording && (
        <div className="flex items-center gap-1.5 ml-1 px-2 py-0.5 rounded bg-error/10 border border-error/30">
          <span className="w-1.5 h-1.5 rounded-full bg-error animate-pulse" />
          <span className="text-[11px] text-error">Recording</span>
        </div>
      )}
      {isPaused && (
        <div className="flex items-center gap-1.5 ml-1 px-2 py-0.5 rounded bg-warning/10 border border-warning/30">
          <span className="w-1.5 h-1.5 rounded-full bg-warning" />
          <span className="text-[11px] text-warning">Paused</span>
        </div>
      )}
    </div>
  );
};
