/**
 * Zustand Store
 *
 * Single store using the slice pattern with logical groupings:
 * - Capture slice: capture mode state and start/stop/pause actions
 * - Steps slice: steps array and add/remove/update/reorder/clear actions
 * - Settings slice: defaultWait, xpathStrategy, autoSuggest, theme
 * - UI slice: selectedStepId, selectedElement, searchQuery, panelSizes
 */

import { create, StateCreator } from 'zustand';
import { CapturedElement } from '../../shared/types';
import { ActionType } from '../utils/actionRecommender';
import { SelectorResult } from '../utils/selectorTypes';
import { ZeuzStep } from '../utils/zeuzFormatter';

// ─── Step Interface ─────────────────────────────────────────────────────────────

export interface Step {
  id: string;
  stepNumber: number;
  element: CapturedElement;
  action: ActionType;
  selector: SelectorResult;
  zeuzStep: ZeuzStep;
  value: string;
  delay: number;
  description: string;
  groupId: string | null;
}

// ─── Capture Slice ──────────────────────────────────────────────────────────────

export interface CaptureSlice {
  captureMode: 'idle' | 'capturing' | 'paused' | 'recording';
  startCapture: () => void;
  stopCapture: () => void;
  pauseCapture: () => void;
  startRecording: () => void;
  stopRecording: () => void;
}

const createCaptureSlice: StateCreator<AppState, [], [], CaptureSlice> = (set) => ({
  captureMode: 'idle',
  startCapture: () => set({ captureMode: 'capturing' }),
  stopCapture: () => set({ captureMode: 'idle' }),
  pauseCapture: () => set((state) => ({
    captureMode: state.captureMode === 'capturing' ? 'paused' : state.captureMode,
  })),
  startRecording: () => set({ captureMode: 'recording' }),
  stopRecording: () => set({ captureMode: 'idle' }),
});

// ─── Steps Slice ────────────────────────────────────────────────────────────────

export interface StepsSlice {
  steps: Step[];
  addStep: (element: CapturedElement, action: ActionType, selector: SelectorResult, zeuzStep: ZeuzStep) => void;
  removeStep: (stepId: string) => void;
  updateStep: (stepId: string, updates: Partial<Step>) => void;
  reorderSteps: (fromIndex: number, toIndex: number) => void;
  clearSteps: () => void;
}

let stepCounter = 0;

function generateStepId(): string {
  stepCounter += 1;
  return `step-${Date.now()}-${stepCounter}`;
}

const createStepsSlice: StateCreator<AppState, [], [], StepsSlice> = (set) => ({
  steps: [],

  addStep: (element, action, selector, zeuzStep) =>
    set((state) => {
      const stepNumber = state.steps.length + 1;
      const newStep: Step = {
        id: generateStepId(),
        stepNumber,
        element,
        action,
        selector,
        zeuzStep,
        value: '',
        delay: 0,
        description: zeuzStep.title,
        groupId: null,
      };
      return { steps: [...state.steps, newStep] };
    }),

  removeStep: (stepId) =>
    set((state) => {
      const filtered = state.steps.filter((s) => s.id !== stepId);
      const renumbered = filtered.map((s, index) => ({
        ...s,
        stepNumber: index + 1,
      }));
      return { steps: renumbered };
    }),

  updateStep: (stepId, updates) =>
    set((state) => ({
      steps: state.steps.map((s) =>
        s.id === stepId ? { ...s, ...updates } : s,
      ),
    })),

  reorderSteps: (fromIndex, toIndex) =>
    set((state) => {
      const newSteps = [...state.steps];
      const [moved] = newSteps.splice(fromIndex, 1);
      newSteps.splice(toIndex, 0, moved);
      const renumbered = newSteps.map((s, index) => ({
        ...s,
        stepNumber: index + 1,
      }));
      return { steps: renumbered };
    }),

  clearSteps: () => set({ steps: [] }),
});

// ─── Settings Slice ─────────────────────────────────────────────────────────────

export interface Settings {
  defaultWait: number;
  xpathStrategy: 'smart' | 'always-relative' | 'always-absolute';
  autoSuggest: boolean;
  theme: 'dark';
}

export interface SettingsSlice {
  settings: Settings;
  updateSettings: (updates: Partial<Settings>) => void;
}

const createSettingsSlice: StateCreator<AppState, [], [], SettingsSlice> = (set) => ({
  settings: {
    defaultWait: 5,
    xpathStrategy: 'smart',
    autoSuggest: true,
    theme: 'dark',
  },
  updateSettings: (updates) =>
    set((state) => ({
      settings: { ...state.settings, ...updates },
    })),
});

// ─── UI Slice ───────────────────────────────────────────────────────────────────

export interface PanelSizes {
  left: number;
  middle: number;
  right: number;
}

export interface UISlice {
  selectedStepId: string | null;
  selectedElement: CapturedElement | null;
  searchQuery: string;
  panelSizes: PanelSizes;
  highlightXpath: string | null;
  selectStep: (stepId: string | null) => void;
  setSelectedElement: (element: CapturedElement | null) => void;
  setSearchQuery: (query: string) => void;
  setPanelSizes: (sizes: PanelSizes) => void;
  setHighlightXpath: (xpath: string | null) => void;
}

const createUISlice: StateCreator<AppState, [], [], UISlice> = (set) => ({
  selectedStepId: null,
  selectedElement: null,
  searchQuery: '',
  panelSizes: { left: 20, middle: 50, right: 30 },
  highlightXpath: null,
  selectStep: (stepId) => set({ selectedStepId: stepId }),
  setSelectedElement: (element) => set({ selectedElement: element }),
  setSearchQuery: (query) => set({ searchQuery: query }),
  setPanelSizes: (sizes) => set({ panelSizes: sizes }),
  setHighlightXpath: (xpath) => set({ highlightXpath: xpath }),
});

// ─── Combined AppState ──────────────────────────────────────────────────────────

export type AppState = CaptureSlice & StepsSlice & SettingsSlice & UISlice;

// ─── Store ──────────────────────────────────────────────────────────────────────

export const useStore = create<AppState>()((...args) => ({
  ...createCaptureSlice(...args),
  ...createStepsSlice(...args),
  ...createSettingsSlice(...args),
  ...createUISlice(...args),
}));
