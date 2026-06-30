import React, { useCallback, useRef, useEffect } from 'react';
import { useStore } from '../../store';

interface ResizablePanelProps {
  left: React.ReactNode;
  middle: React.ReactNode;
  right: React.ReactNode;
}

const MIN_PANEL_PCT = 10; // minimum 10% width per panel

export const ResizablePanel: React.FC<ResizablePanelProps> = ({ left, middle, right }) => {
  const panelSizes = useStore((s) => s.panelSizes);
  const setPanelSizes = useStore((s) => s.setPanelSizes);

  const containerRef = useRef<HTMLDivElement>(null);
  const draggingRef = useRef<'left' | 'right' | null>(null);
  const startXRef = useRef(0);
  const startSizesRef = useRef(panelSizes);

  const handleMouseDown = useCallback(
    (divider: 'left' | 'right') => (e: React.MouseEvent) => {
      e.preventDefault();
      draggingRef.current = divider;
      startXRef.current = e.clientX;
      startSizesRef.current = { ...panelSizes };
      document.body.style.cursor = 'col-resize';
      document.body.style.userSelect = 'none';
    },
    [panelSizes],
  );

  const handleMouseMove = useCallback(
    (e: MouseEvent) => {
      if (!draggingRef.current || !containerRef.current) return;

      const containerWidth = containerRef.current.getBoundingClientRect().width;
      const deltaX = e.clientX - startXRef.current;
      const deltaPct = (deltaX / containerWidth) * 100;
      const sizes = { ...startSizesRef.current };

      if (draggingRef.current === 'left') {
        let newLeft = sizes.left + deltaPct;
        let newMiddle = sizes.middle - deltaPct;

        if (newLeft < MIN_PANEL_PCT) {
          newMiddle = newMiddle - (MIN_PANEL_PCT - newLeft);
          newLeft = MIN_PANEL_PCT;
        }
        if (newMiddle < MIN_PANEL_PCT) {
          newLeft = newLeft - (MIN_PANEL_PCT - newMiddle);
          newMiddle = MIN_PANEL_PCT;
        }

        newLeft = Math.max(MIN_PANEL_PCT, newLeft);
        newMiddle = Math.max(MIN_PANEL_PCT, newMiddle);

        setPanelSizes({ left: newLeft, middle: newMiddle, right: sizes.right });
      } else {
        let newMiddle = sizes.middle + deltaPct;
        let newRight = sizes.right - deltaPct;

        if (newMiddle < MIN_PANEL_PCT) {
          newRight = newRight - (MIN_PANEL_PCT - newMiddle);
          newMiddle = MIN_PANEL_PCT;
        }
        if (newRight < MIN_PANEL_PCT) {
          newMiddle = newMiddle - (MIN_PANEL_PCT - newRight);
          newRight = MIN_PANEL_PCT;
        }

        newMiddle = Math.max(MIN_PANEL_PCT, newMiddle);
        newRight = Math.max(MIN_PANEL_PCT, newRight);

        setPanelSizes({ left: sizes.left, middle: newMiddle, right: newRight });
      }
    },
    [setPanelSizes],
  );

  const handleMouseUp = useCallback(() => {
    draggingRef.current = null;
    document.body.style.cursor = '';
    document.body.style.userSelect = '';
  }, []);

  useEffect(() => {
    document.addEventListener('mousemove', handleMouseMove);
    document.addEventListener('mouseup', handleMouseUp);
    return () => {
      document.removeEventListener('mousemove', handleMouseMove);
      document.removeEventListener('mouseup', handleMouseUp);
    };
  }, [handleMouseMove, handleMouseUp]);

  return (
    <div ref={containerRef} className="flex flex-1 overflow-hidden">
      {/* Left Panel */}
      <div
        className="overflow-auto bg-surface-mid rounded-lg m-1"
        style={{ width: `${panelSizes.left}%` }}
      >
        {left}
      </div>

      {/* Left Divider */}
      <div
        className="w-1 cursor-col-resize bg-surface hover:bg-primary-500 transition-colors flex-shrink-0"
        onMouseDown={handleMouseDown('left')}
      />

      {/* Middle Panel */}
      <div
        className="overflow-auto bg-surface-mid rounded-lg m-1"
        style={{ width: `${panelSizes.middle}%` }}
      >
        {middle}
      </div>

      {/* Right Divider */}
      <div
        className="w-1 cursor-col-resize bg-surface hover:bg-primary-500 transition-colors flex-shrink-0"
        onMouseDown={handleMouseDown('right')}
      />

      {/* Right Panel */}
      <div
        className="overflow-auto bg-surface-mid rounded-lg m-1"
        style={{ width: `${panelSizes.right}%` }}
      >
        {right}
      </div>
    </div>
  );
};
