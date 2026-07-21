/**
 * Zustand Store
 *
 * Single store using the slice pattern with logical groupings:
 * - Capture slice: capture mode state and start/stop/pause actions
 * - Steps slice: steps array and add/remove/update/reorder/clear actions
 * - Settings slice: defaultWait, xpathStrategy, autoSuggest, theme
 * - UI slice: selectedStepId, selectedElement, searchQuery, panelSizes
 * - MultiCapture slice: two-click capture workflow for drag-drop and save-attribute-list
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
  checkedStepIds: Set<string>;
  selectStep: (stepId: string | null) => void;
  setSelectedElement: (element: CapturedElement | null) => void;
  setSearchQuery: (query: string) => void;
  setPanelSizes: (sizes: PanelSizes) => void;
  setHighlightXpath: (xpath: string | null) => void;
  toggleCheckedStep: (stepId: string) => void;
  checkAllSteps: () => void;
  uncheckAllSteps: () => void;
}

const createUISlice: StateCreator<AppState, [], [], UISlice> = (set, _get) => ({
  selectedStepId: null,
  selectedElement: null,
  searchQuery: '',
  panelSizes: { left: 20, middle: 50, right: 30 },
  highlightXpath: null,
  checkedStepIds: new Set(),
  selectStep: (stepId) => set({ selectedStepId: stepId }),
  setSelectedElement: (element) => set({ selectedElement: element }),
  setSearchQuery: (query) => set({ searchQuery: query }),
  setPanelSizes: (sizes) => set({ panelSizes: sizes }),
  setHighlightXpath: (xpath) => set({ highlightXpath: xpath }),
  toggleCheckedStep: (stepId) => set((state) => {
    const newSet = new Set(state.checkedStepIds);
    if (newSet.has(stepId)) {
      newSet.delete(stepId);
    } else {
      newSet.add(stepId);
    }
    return { checkedStepIds: newSet };
  }),
  checkAllSteps: () => set((state) => {
    const allIds = new Set(state.steps.map(s => s.id));
    return { checkedStepIds: allIds };
  }),
  uncheckAllSteps: () => set({ checkedStepIds: new Set() }),
});

// ─── Multi-Capture Slice ────────────────────────────────────────────────────────
//
// State machine:
//   idle  →  (startMultiCapture)  →  waitingForFirst
//   waitingForFirst  →  (setSelection1)  →  waitingForSecond
//   waitingForSecond  →  (setSelection2)  →  awaitingConfirm   [save-attr only]
//   waitingForSecond  →  (setSelection2)  →  idle              [drag-drop: auto-generates]
//   awaitingConfirm  →  (setVariableName / confirmGenerate)  →  idle
//   any state  →  (resetMultiCapture)  →  idle

export type MultiCaptureAction = 'save-attribute-list' | 'drag-and-drop';

export type MultiCapturePhase =
  | 'idle'
  | 'waitingForFirst'   // picker active, waiting for click 1
  | 'waitingForSecond'  // selection 1 done, waiting for click 2
  | 'awaitingConfirm';  // both captured, showing var-name field (save-attr only)

export interface MultiCaptureSlice {
  /** Which action is being captured */
  multiCaptureAction: MultiCaptureAction | null;
  /** Current phase of the workflow */
  multiCapturePhase: MultiCapturePhase;
  /** First captured element */
  multiCaptureSelection1: CapturedElement | null;
  /** Second captured element */
  multiCaptureSelection2: CapturedElement | null;
  /** Auto-generated variable name, editable by user (save-attr only) */
  multiCaptureVarName: string;

  /** Begin a multi-capture workflow */
  startMultiCapture: (action: MultiCaptureAction) => void;
  /** Called when the user captures the first element */
  setMultiCaptureSelection1: (element: CapturedElement) => void;
  /** Called when the user captures the second element */
  setMultiCaptureSelection2: (element: CapturedElement, autoVarName: string) => void;
  /** Update the variable name in the confirm screen */
  setMultiCaptureVarName: (name: string) => void;
  /** Cancel and return to idle — clears everything */
  resetMultiCapture: () => void;
}

const MULTI_CAPTURE_IDLE: Omit<MultiCaptureSlice,
  'startMultiCapture' | 'setMultiCaptureSelection1' | 'setMultiCaptureSelection2' |
  'setMultiCaptureVarName' | 'resetMultiCapture'
> = {
  multiCaptureAction: null,
  multiCapturePhase: 'idle',
  multiCaptureSelection1: null,
  multiCaptureSelection2: null,
  multiCaptureVarName: '',
};

const createMultiCaptureSlice: StateCreator<AppState, [], [], MultiCaptureSlice> = (set) => ({
  ...MULTI_CAPTURE_IDLE,

  startMultiCapture: (action) => set({
    multiCaptureAction: action,
    multiCapturePhase: 'waitingForFirst',
    multiCaptureSelection1: null,
    multiCaptureSelection2: null,
    multiCaptureVarName: '',
  }),

  setMultiCaptureSelection1: (element) => set({
    multiCaptureSelection1: element,
    multiCapturePhase: 'waitingForSecond',
  }),

  setMultiCaptureSelection2: (element, autoVarName) => set((state) => {
    // drag-and-drop: go straight to idle (caller will addStep before this)
    // save-attribute-list: go to awaitingConfirm so user can edit var name
    const nextPhase: MultiCapturePhase =
      state.multiCaptureAction === 'save-attribute-list' ? 'awaitingConfirm' : 'idle';
    return {
      multiCaptureSelection2: element,
      multiCapturePhase: nextPhase,
      multiCaptureVarName: autoVarName,
    };
  }),

  setMultiCaptureVarName: (name) => set({ multiCaptureVarName: name }),

  resetMultiCapture: () => set({ ...MULTI_CAPTURE_IDLE }),
});

// ─── Combined AppState ──────────────────────────────────────────────────────────

export type AppState = CaptureSlice & StepsSlice & SettingsSlice & UISlice & MultiCaptureSlice;

// ─── Store ──────────────────────────────────────────────────────────────────────

export const useStore = create<AppState>()((...args) => ({
  ...createCaptureSlice(...args),
  ...createStepsSlice(...args),
  ...createSettingsSlice(...args),
  ...createUISlice(...args),
  ...createMultiCaptureSlice(...args),
}));
