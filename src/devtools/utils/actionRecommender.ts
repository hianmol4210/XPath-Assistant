/**
 * Action Recommender
 *
 * Receives CapturedElement data and recommends the most appropriate
 * automation action based on element tag, attributes, and ARIA roles.
 */

import { CapturedElement } from '../../shared/types';

// ─── Types ──────────────────────────────────────────────────────────────────────

export type ActionType =
  | 'click'
  | 'double-click'
  | 'right-click'
  | 'hover'
  | 'type-text'
  | 'clear-text'
  | 'check'
  | 'uncheck'
  | 'select'
  | 'select-by-text'
  | 'select-by-value'
  | 'select-by-index'
  | 'upload-file'
  | 'scroll-into-view'
  | 'wait-for-element'
  | 'wait-until-visible'
  | 'wait-until-hidden'
  | 'wait-disable'
  | 'verify-exists'
  | 'verify-text'
  | 'verify-visible'
  | 'save-attribute'
  | 'save-attribute-list'
  | 'navigate';

export interface NextStepSuggestion {
  action: ActionType;
  description: string;
}

export interface ActionRecommendation {
  primary: ActionType;
  alternatives: ActionType[];
  nextSteps: NextStepSuggestion[];
}

// ─── Alternatives lookup ────────────────────────────────────────────────────────

const ALTERNATIVES: Record<ActionType, ActionType[]> = {
  'click': ['double-click', 'right-click', 'hover'],
  'double-click': ['click', 'right-click', 'hover'],
  'right-click': ['click', 'double-click', 'hover'],
  'hover': ['click', 'double-click', 'right-click'],
  'type-text': ['clear-text', 'click', 'verify-text'],
  'clear-text': ['type-text', 'click'],
  'check': ['uncheck', 'click', 'verify-exists'],
  'uncheck': ['check', 'click', 'verify-exists'],
  'select': ['click', 'verify-exists'],
  'select-by-text': ['select-by-value', 'select-by-index', 'click'],
  'select-by-value': ['select-by-text', 'select-by-index', 'click'],
  'select-by-index': ['select-by-text', 'select-by-value', 'click'],
  'upload-file': ['click', 'verify-exists'],
  'scroll-into-view': ['click', 'verify-visible'],
  'wait-for-element': ['wait-until-visible', 'verify-exists'],
  'wait-until-visible': ['wait-for-element', 'verify-visible'],
  'wait-until-hidden': ['wait-for-element', 'verify-exists'],
  'wait-disable': ['wait-for-element', 'wait-until-visible', 'verify-exists'],
  'save-attribute': ['save-attribute-list', 'verify-text', 'click'],
  'save-attribute-list': ['save-attribute', 'verify-text', 'click'],
  'verify-exists': ['verify-visible', 'verify-text'],
  'verify-text': ['verify-exists', 'verify-visible'],
  'verify-visible': ['verify-exists', 'verify-text'],
  'navigate': ['click', 'wait-for-element'],
};

// ─── Next-step suggestions ──────────────────────────────────────────────────────

const NEXT_STEPS: Record<string, NextStepSuggestion[]> = {
  'click': [
    { action: 'wait-until-visible', description: 'Wait for new content to appear' },
    { action: 'wait-until-hidden', description: 'Wait for element to disappear' },
    { action: 'verify-exists', description: 'Verify expected element exists' },
  ],
  'type-text': [
    { action: 'verify-text', description: 'Verify the typed value' },
    { action: 'clear-text', description: 'Clear the field first' },
  ],
  'check': [
    { action: 'verify-exists', description: 'Verify checkbox state changed' },
  ],
  'uncheck': [
    { action: 'verify-exists', description: 'Verify checkbox state changed' },
  ],
  'select': [
    { action: 'verify-exists', description: 'Verify selection applied' },
  ],
  'select-by-text': [
    { action: 'verify-text', description: 'Verify selected option text' },
  ],
  'select-by-value': [
    { action: 'verify-text', description: 'Verify selected option' },
  ],
  'select-by-index': [
    { action: 'verify-text', description: 'Verify selected option' },
  ],
  'upload-file': [
    { action: 'wait-for-element', description: 'Wait for upload indicator' },
    { action: 'verify-exists', description: 'Verify file was attached' },
  ],
};

const DEFAULT_NEXT_STEPS: NextStepSuggestion[] = [
  { action: 'verify-exists', description: 'Verify element exists' },
];

// ─── Input type sets ────────────────────────────────────────────────────────────

const TEXT_INPUT_TYPES = new Set([
  'text', 'email', 'password', 'search', 'tel', 'url', 'number', 'range',
]);

const CLICK_INPUT_TYPES = new Set(['submit', 'button', 'reset', 'image']);

// ─── Role-based action mapping ──────────────────────────────────────────────────

const ROLE_ACTION_MAP: Record<string, ActionType> = {
  'button': 'click',
  'link': 'click',
  'tab': 'click',
  'menuitem': 'click',
  'menuitemcheckbox': 'check',
  'menuitemradio': 'select',
  'checkbox': 'check',
  'radio': 'select',
  'switch': 'check',
  'textbox': 'type-text',
  'searchbox': 'type-text',
  'combobox': 'select-by-text',
  'listbox': 'select-by-text',
  'option': 'click',
  'treeitem': 'click',
};

// ─── Main function ──────────────────────────────────────────────────────────────

/**
 * Recommends the most appropriate automation action for a captured element.
 */
export function recommendAction(element: CapturedElement): ActionRecommendation {
  const primary = determinePrimaryAction(element);
  const alternatives = ALTERNATIVES[primary] ?? ['click', 'verify-exists'];
  const nextSteps = NEXT_STEPS[primary] ?? DEFAULT_NEXT_STEPS;

  return { primary, alternatives, nextSteps };
}

// ─── Primary action determination ───────────────────────────────────────────────

function determinePrimaryAction(element: CapturedElement): ActionType {
  const tag = element.tag.toLowerCase();
  const role = getRole(element);
  const type = getInputType(element);

  // 1. Check ARIA role first (overrides tag-based logic for generic elements)
  if (role && tag !== 'input' && tag !== 'select' && tag !== 'textarea') {
    const roleAction = ROLE_ACTION_MAP[role];
    if (roleAction) return roleAction;
  }

  // 2. Tag-specific logic
  switch (tag) {
    case 'button':
      return 'click';

    case 'input':
      return determineInputAction(type, element);

    case 'select':
      return 'select-by-text';

    case 'textarea':
      return 'type-text';

    case 'a':
      return 'click';

    case 'div':
    case 'span':
      return determineDivSpanAction(element, role);

    default:
      // For any other element, check role-based actions
      if (role) {
        const roleAction = ROLE_ACTION_MAP[role];
        if (roleAction) return roleAction;
      }
      return 'click';
  }
}

/**
 * Determines the action for <input> elements based on type attribute.
 */
function determineInputAction(type: string, element: CapturedElement): ActionType {
  if (TEXT_INPUT_TYPES.has(type)) {
    return 'type-text';
  }

  if (type === 'checkbox') {
    // If already checked, recommend uncheck
    return element.state.checked ? 'uncheck' : 'check';
  }

  if (type === 'radio') {
    return 'select';
  }

  if (type === 'file') {
    return 'upload-file';
  }

  if (CLICK_INPUT_TYPES.has(type)) {
    return 'click';
  }

  // Default for unknown input types
  return 'type-text';
}

/**
 * Determines the action for div/span elements based on attributes.
 */
function determineDivSpanAction(element: CapturedElement, role: string | null): ActionType {
  // Check contenteditable
  if (isContentEditable(element)) {
    return 'type-text';
  }

  // Check role
  if (role) {
    const roleAction = ROLE_ACTION_MAP[role];
    if (roleAction) return roleAction;
  }

  // Check for click handler indicators
  if (hasClickHandler(element)) {
    return 'click';
  }

  // Check tabindex with click-like classes
  if (hasTabindexWithClickIntent(element)) {
    return 'click';
  }

  // Default for generic div/span
  return 'click';
}

// ─── Helpers ────────────────────────────────────────────────────────────────────

function getRole(element: CapturedElement): string | null {
  return element.ariaAttributes['role'] || element.attributes['role'] || null;
}

function getInputType(element: CapturedElement): string {
  return (element.attributes['type'] || 'text').toLowerCase();
}

function isContentEditable(element: CapturedElement): boolean {
  const contenteditable = element.attributes['contenteditable'];
  return contenteditable === 'true' || contenteditable === '';
}

function hasClickHandler(element: CapturedElement): boolean {
  // Check for onclick attribute
  if (element.attributes['onclick']) return true;

  // Check for Angular click bindings
  if (element.attributes['(click)'] || element.attributes['ng-click']) return true;

  // Check for common click-related data attributes
  if (element.dataAttributes['action'] === 'click') return true;

  return false;
}

function hasTabindexWithClickIntent(element: CapturedElement): boolean {
  const hasTabindex = element.attributes['tabindex'] !== undefined;
  if (!hasTabindex) return false;

  // Check for click-indicating classes
  const clickClasses = ['clickable', 'btn', 'button', 'link', 'action', 'interactive'];
  const elementClasses = element.classes.map(c => c.toLowerCase());

  return clickClasses.some(cc => elementClasses.some(ec => ec.includes(cc)));
}
