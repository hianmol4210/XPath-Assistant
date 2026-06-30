import { describe, it, expect } from 'vitest';
import { recommendAction, ActionType } from './actionRecommender';
import { CapturedElement } from '../../shared/types';

// ─── Test helper ────────────────────────────────────────────────────────────────

function makeElement(overrides: Partial<CapturedElement> = {}): CapturedElement {
  return {
    tag: 'button',
    text: '',
    innerText: '',
    id: '',
    name: '',
    classes: [],
    attributes: {},
    dataAttributes: {},
    ariaAttributes: {},
    hierarchy: {
      parentTag: 'div',
      parentId: '',
      parentClasses: [],
      siblingIndex: 0,
      totalSiblings: 1,
    },
    state: { visible: true, enabled: true, checked: false, selected: false },
    timestamp: Date.now(),
    ...overrides,
  };
}

// ─── Task 6.2: Element-to-action mapping ────────────────────────────────────────

describe('recommendAction - basic element mapping', () => {
  it('button → click', () => {
    const result = recommendAction(makeElement({ tag: 'button' }));
    expect(result.primary).toBe('click');
  });

  it('input[type=text] → type-text', () => {
    const result = recommendAction(makeElement({
      tag: 'input',
      attributes: { type: 'text' },
    }));
    expect(result.primary).toBe('type-text');
  });

  it('input[type=email] → type-text', () => {
    const result = recommendAction(makeElement({
      tag: 'input',
      attributes: { type: 'email' },
    }));
    expect(result.primary).toBe('type-text');
  });

  it('input[type=password] → type-text', () => {
    const result = recommendAction(makeElement({
      tag: 'input',
      attributes: { type: 'password' },
    }));
    expect(result.primary).toBe('type-text');
  });

  it('input[type=search] → type-text', () => {
    const result = recommendAction(makeElement({
      tag: 'input',
      attributes: { type: 'search' },
    }));
    expect(result.primary).toBe('type-text');
  });

  it('input[type=tel] → type-text', () => {
    const result = recommendAction(makeElement({
      tag: 'input',
      attributes: { type: 'tel' },
    }));
    expect(result.primary).toBe('type-text');
  });

  it('input[type=url] → type-text', () => {
    const result = recommendAction(makeElement({
      tag: 'input',
      attributes: { type: 'url' },
    }));
    expect(result.primary).toBe('type-text');
  });

  it('input[type=number] → type-text', () => {
    const result = recommendAction(makeElement({
      tag: 'input',
      attributes: { type: 'number' },
    }));
    expect(result.primary).toBe('type-text');
  });

  it('input[type=range] → type-text', () => {
    const result = recommendAction(makeElement({
      tag: 'input',
      attributes: { type: 'range' },
    }));
    expect(result.primary).toBe('type-text');
  });

  it('input[type=checkbox] → check', () => {
    const result = recommendAction(makeElement({
      tag: 'input',
      attributes: { type: 'checkbox' },
    }));
    expect(result.primary).toBe('check');
  });

  it('input[type=checkbox] already checked → uncheck', () => {
    const result = recommendAction(makeElement({
      tag: 'input',
      attributes: { type: 'checkbox' },
      state: { visible: true, enabled: true, checked: true, selected: false },
    }));
    expect(result.primary).toBe('uncheck');
  });

  it('input[type=radio] → select', () => {
    const result = recommendAction(makeElement({
      tag: 'input',
      attributes: { type: 'radio' },
    }));
    expect(result.primary).toBe('select');
  });

  it('input[type=file] → upload-file', () => {
    const result = recommendAction(makeElement({
      tag: 'input',
      attributes: { type: 'file' },
    }));
    expect(result.primary).toBe('upload-file');
  });

  it('input[type=submit] → click', () => {
    const result = recommendAction(makeElement({
      tag: 'input',
      attributes: { type: 'submit' },
    }));
    expect(result.primary).toBe('click');
  });

  it('input[type=button] → click', () => {
    const result = recommendAction(makeElement({
      tag: 'input',
      attributes: { type: 'button' },
    }));
    expect(result.primary).toBe('click');
  });

  it('input with no type → type-text (defaults to text)', () => {
    const result = recommendAction(makeElement({
      tag: 'input',
      attributes: {},
    }));
    expect(result.primary).toBe('type-text');
  });

  it('select → select-by-text', () => {
    const result = recommendAction(makeElement({ tag: 'select' }));
    expect(result.primary).toBe('select-by-text');
  });

  it('textarea → type-text', () => {
    const result = recommendAction(makeElement({ tag: 'textarea' }));
    expect(result.primary).toBe('type-text');
  });

  it('a (anchor) → click', () => {
    const result = recommendAction(makeElement({ tag: 'a' }));
    expect(result.primary).toBe('click');
  });
});

// ─── Task 6.3: Edge cases ───────────────────────────────────────────────────────

describe('recommendAction - edge cases', () => {
  it('div with onclick attribute → click', () => {
    const result = recommendAction(makeElement({
      tag: 'div',
      attributes: { onclick: 'handleClick()' },
    }));
    expect(result.primary).toBe('click');
  });

  it('span with role="button" → click', () => {
    const result = recommendAction(makeElement({
      tag: 'span',
      ariaAttributes: { role: 'button' },
    }));
    expect(result.primary).toBe('click');
  });

  it('div with role="button" → click', () => {
    const result = recommendAction(makeElement({
      tag: 'div',
      ariaAttributes: { role: 'button' },
    }));
    expect(result.primary).toBe('click');
  });

  it('div with contenteditable="true" → type-text', () => {
    const result = recommendAction(makeElement({
      tag: 'div',
      attributes: { contenteditable: 'true' },
    }));
    expect(result.primary).toBe('type-text');
  });

  it('div with contenteditable="" (empty string) → type-text', () => {
    const result = recommendAction(makeElement({
      tag: 'div',
      attributes: { contenteditable: '' },
    }));
    expect(result.primary).toBe('type-text');
  });

  it('span with contenteditable → type-text', () => {
    const result = recommendAction(makeElement({
      tag: 'span',
      attributes: { contenteditable: 'true' },
    }));
    expect(result.primary).toBe('type-text');
  });

  it('div with Angular (click) binding → click', () => {
    const result = recommendAction(makeElement({
      tag: 'div',
      attributes: { '(click)': 'onAction()' },
    }));
    expect(result.primary).toBe('click');
  });

  it('div with ng-click → click', () => {
    const result = recommendAction(makeElement({
      tag: 'div',
      attributes: { 'ng-click': 'doStuff()' },
    }));
    expect(result.primary).toBe('click');
  });

  it('div with tabindex and clickable class → click', () => {
    const result = recommendAction(makeElement({
      tag: 'div',
      attributes: { tabindex: '0' },
      classes: ['clickable', 'custom-widget'],
    }));
    expect(result.primary).toBe('click');
  });

  it('div with tabindex and btn class → click', () => {
    const result = recommendAction(makeElement({
      tag: 'div',
      attributes: { tabindex: '0' },
      classes: ['btn-primary'],
    }));
    expect(result.primary).toBe('click');
  });

  it('any element with role="link" → click', () => {
    const result = recommendAction(makeElement({
      tag: 'li',
      ariaAttributes: { role: 'link' },
    }));
    expect(result.primary).toBe('click');
  });

  it('any element with role="tab" → click', () => {
    const result = recommendAction(makeElement({
      tag: 'li',
      ariaAttributes: { role: 'tab' },
    }));
    expect(result.primary).toBe('click');
  });

  it('any element with role="menuitem" → click', () => {
    const result = recommendAction(makeElement({
      tag: 'li',
      ariaAttributes: { role: 'menuitem' },
    }));
    expect(result.primary).toBe('click');
  });

  it('any element with role="checkbox" → check', () => {
    const result = recommendAction(makeElement({
      tag: 'div',
      ariaAttributes: { role: 'checkbox' },
    }));
    expect(result.primary).toBe('check');
  });

  it('any element with role="radio" → select', () => {
    const result = recommendAction(makeElement({
      tag: 'div',
      ariaAttributes: { role: 'radio' },
    }));
    expect(result.primary).toBe('select');
  });

  it('any element with role="switch" → check', () => {
    const result = recommendAction(makeElement({
      tag: 'div',
      ariaAttributes: { role: 'switch' },
    }));
    expect(result.primary).toBe('check');
  });

  it('any element with role="textbox" → type-text', () => {
    const result = recommendAction(makeElement({
      tag: 'div',
      ariaAttributes: { role: 'textbox' },
    }));
    expect(result.primary).toBe('type-text');
  });

  it('any element with role="combobox" → select-by-text', () => {
    const result = recommendAction(makeElement({
      tag: 'div',
      ariaAttributes: { role: 'combobox' },
    }));
    expect(result.primary).toBe('select-by-text');
  });

  it('plain div with no indicators → click (default)', () => {
    const result = recommendAction(makeElement({ tag: 'div' }));
    expect(result.primary).toBe('click');
  });
});

// ─── Task 6.4: Alternatives list ────────────────────────────────────────────────

describe('recommendAction - alternatives', () => {
  it('returns alternatives for click action', () => {
    const result = recommendAction(makeElement({ tag: 'button' }));
    expect(result.alternatives).toContain('double-click');
    expect(result.alternatives).toContain('right-click');
    expect(result.alternatives).toContain('hover');
    expect(result.alternatives.length).toBeGreaterThanOrEqual(2);
  });

  it('returns alternatives for type-text action', () => {
    const result = recommendAction(makeElement({
      tag: 'input',
      attributes: { type: 'text' },
    }));
    expect(result.alternatives).toContain('clear-text');
    expect(result.alternatives.length).toBeGreaterThanOrEqual(2);
  });

  it('returns alternatives for select-by-text action', () => {
    const result = recommendAction(makeElement({ tag: 'select' }));
    expect(result.alternatives).toContain('select-by-value');
    expect(result.alternatives).toContain('select-by-index');
    expect(result.alternatives.length).toBeGreaterThanOrEqual(2);
  });

  it('returns alternatives for check action', () => {
    const result = recommendAction(makeElement({
      tag: 'input',
      attributes: { type: 'checkbox' },
    }));
    expect(result.alternatives).toContain('uncheck');
    expect(result.alternatives).toContain('click');
    expect(result.alternatives.length).toBeGreaterThanOrEqual(2);
  });

  it('returns alternatives for upload-file action', () => {
    const result = recommendAction(makeElement({
      tag: 'input',
      attributes: { type: 'file' },
    }));
    expect(result.alternatives).toContain('click');
    expect(result.alternatives.length).toBeGreaterThanOrEqual(2);
  });
});

// ─── Task 6.5: Next-step suggestions ────────────────────────────────────────────

describe('recommendAction - next-step suggestions', () => {
  it('after click → suggests wait-until-visible, wait-until-hidden, verify-exists', () => {
    const result = recommendAction(makeElement({ tag: 'button' }));
    const nextActions = result.nextSteps.map(s => s.action);
    expect(nextActions).toContain('wait-until-visible');
    expect(nextActions).toContain('wait-until-hidden');
    expect(nextActions).toContain('verify-exists');
  });

  it('after type-text → suggests verify-text, clear-text', () => {
    const result = recommendAction(makeElement({
      tag: 'input',
      attributes: { type: 'text' },
    }));
    const nextActions = result.nextSteps.map(s => s.action);
    expect(nextActions).toContain('verify-text');
    expect(nextActions).toContain('clear-text');
  });

  it('after check → suggests verify-exists', () => {
    const result = recommendAction(makeElement({
      tag: 'input',
      attributes: { type: 'checkbox' },
    }));
    const nextActions = result.nextSteps.map(s => s.action);
    expect(nextActions).toContain('verify-exists');
  });

  it('after select-by-text → suggests verify-text', () => {
    const result = recommendAction(makeElement({ tag: 'select' }));
    const nextActions = result.nextSteps.map(s => s.action);
    expect(nextActions).toContain('verify-text');
  });

  it('after upload-file → suggests wait-for-element, verify-exists', () => {
    const result = recommendAction(makeElement({
      tag: 'input',
      attributes: { type: 'file' },
    }));
    const nextActions = result.nextSteps.map(s => s.action);
    expect(nextActions).toContain('wait-for-element');
    expect(nextActions).toContain('verify-exists');
  });

  it('next-step suggestions include descriptions', () => {
    const result = recommendAction(makeElement({ tag: 'button' }));
    result.nextSteps.forEach(step => {
      expect(step.description).toBeTruthy();
      expect(typeof step.description).toBe('string');
    });
  });

  it('default element provides at least verify-exists suggestion', () => {
    // An unknown element with a role that maps to "select"
    const result = recommendAction(makeElement({
      tag: 'input',
      attributes: { type: 'radio' },
    }));
    const nextActions = result.nextSteps.map(s => s.action);
    expect(nextActions).toContain('verify-exists');
  });
});
