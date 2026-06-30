import React, { useEffect, useCallback } from 'react';
import { Toolbar } from './components/Toolbar/Toolbar';
import { ResizablePanel } from './components/Shared/ResizablePanel';
import { ActionBuilder } from './components/MiddlePanel';
import { ElementDetails } from './components/RightPanel';
import { useStore } from './store';
import { useDevToolsConnection } from './hooks/useDevToolsConnection';

// ─── Placeholder Panels ─────────────────────────────────────────────────────────

const LeftPanelPlaceholder: React.FC = () => (
  <div className="flex flex-col h-full p-3">
    <h2 className="text-sm font-semibold text-text mb-2">Inspector Tree</h2>
    <p className="text-xs text-text-muted">
      Captured elements will appear here in a tree structure.
    </p>
  </div>
);

// ─── App ────────────────────────────────────────────────────────────────────────

const App: React.FC = () => {
  const captureMode = useStore((s) => s.captureMode);
  const startCapture = useStore((s) => s.startCapture);
  const stopCapture = useStore((s) => s.stopCapture);
  const stopRecording = useStore((s) => s.stopRecording);
  const selectedStepId = useStore((s) => s.selectedStepId);
  const removeStep = useStore((s) => s.removeStep);

  // Simple DevTools connection — uses chrome.devtools.inspectedWindow.eval()
  // No background service worker or content script ports needed
  const { isConnected } = useDevToolsConnection();

  const handleKeyDown = useCallback(
    (e: KeyboardEvent) => {
      // Ctrl+Shift+C → Toggle capture mode
      if (e.ctrlKey && e.shiftKey && e.key === 'C') {
        e.preventDefault();
        if (captureMode === 'idle') {
          startCapture();
        } else if (captureMode === 'capturing' || captureMode === 'paused') {
          stopCapture();
        }
        return;
      }

      // Delete → Remove selected step
      if (e.key === 'Delete') {
        if (selectedStepId) {
          e.preventDefault();
          removeStep(selectedStepId);
        }
        return;
      }

      // ESC → Stop capture or recording
      if (e.key === 'Escape') {
        if (captureMode === 'capturing' || captureMode === 'paused') {
          e.preventDefault();
          stopCapture();
        } else if (captureMode === 'recording') {
          e.preventDefault();
          stopRecording();
        }
        return;
      }
    },
    [captureMode, selectedStepId, startCapture, stopCapture, stopRecording, removeStep],
  );

  useEffect(() => {
    document.addEventListener('keydown', handleKeyDown);
    return () => {
      document.removeEventListener('keydown', handleKeyDown);
    };
  }, [handleKeyDown]);

  return (
    <div className="flex flex-col h-screen bg-surface text-text overflow-hidden">
      {/* Sticky Toolbar */}
      <Toolbar />

      {/* Connection status — only show if DevTools API unavailable */}
      {!isConnected && (
        <div className="flex items-center gap-1.5 px-3 py-1 bg-warning/10 border-b border-warning/30 text-xs text-warning">
          <span className="w-2 h-2 rounded-full bg-warning" />
          Chrome DevTools API not available — make sure this is running inside DevTools
        </div>
      )}

      {/* Three-panel layout */}
      <ResizablePanel
        left={<LeftPanelPlaceholder />}
        middle={<ActionBuilder />}
        right={<ElementDetails />}
      />
    </div>
  );
};

export default App;
