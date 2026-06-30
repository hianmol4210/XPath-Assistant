import React from 'react';
import { useStore } from '../../store';
import { StepRow } from './StepRow';

export const ActionBuilder: React.FC = () => {
  const steps = useStore((s) => s.steps);

  if (steps.length === 0) {
    return (
      <div className="flex flex-col items-center justify-center h-full p-6 text-center">
        <p className="text-sm text-text-muted">
          Start capturing elements to build automation steps
        </p>
      </div>
    );
  }

  return (
    <div className="flex flex-col h-full p-3 gap-2 overflow-y-auto">
      {steps.map((step) => (
        <StepRow key={step.id} step={step} />
      ))}
    </div>
  );
};
