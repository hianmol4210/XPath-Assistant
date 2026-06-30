import { describe, it, expect } from 'vitest';
import { formatAsZeuzStep, copyZeuzStep, copyAllSteps, ZeuzStep } from './zeuzFormatter';
import { CapturedElement } from '../../shared/types';
import { ActionType } from './actionRecommender';

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

// ─── Task 7.3: formatAsZeuzStep basic conversion ────────────────────────────────

describe('formatAsZeuzStep - basic conversion', () => {
  it('converts a button with class and text into a ZeuZ step', () => {
    const element = makeElement({
      tag: 'button',
      text: 'Save Skill Group',
      classes: ['ng-star-inserted'],
    });

    const step = formatAsZeuzStep(element, 'click', 1);

    expect(step.stepNumber).toBe(1);
    expect(step.rows.length).toBeGreaterThan(0);
    // Should contain element parameters for class and text
    const classRow = step.rows.find(r => r.field === 'class');
    expect(classRow).toBeDefined();
    expect(classRow!.type).toBe('element parameter');
    expect(classRow!.value).toBe('ng-star-inserted');

    const textRow = step.rows.find(r => r.field === 'text');
    expect(textRow).toBeDefined();
    expect(textRow!.type).toBe('element parameter');
    expect(textRow!.value).toBe('Save Skill Group');
  });

  it('returns correct step number', () => {
    const element = makeElement({ tag: 'button', text: 'Submit' });
    const step = formatAsZeuzStep(element, 'click', 5);
    expect(step.stepNumber).toBe(5);
  });

  it('only includes non-empty element parameters', () => {
    const element = makeElement({
      tag: 'input',
      text: '',
      id: '',
      name: '',
      classes: [],
      attributes: { type: 'text', placeholder: 'Enter name' },
    });

    const step = formatAsZeuzStep(element, 'type-text', 1);
    const elementParams = step.rows.filter(r => r.type === 'element parameter');

    // Should only have placeholder (no class, text, id, or name)
    expect(elementParams.length).toBe(1);
    expect(elementParams[0].field).toBe('placeholder');
    expect(elementParams[0].value).toBe('Enter name');
  });
});

// ─── Task 7.4: Auto-generate step title ─────────────────────────────────────────

describe('formatAsZeuzStep - title generation', () => {
  it('generates title with action verb and element text', () => {
    const element = makeElement({ text: 'Save Skill Group' });
    const step = formatAsZeuzStep(element, 'click', 1);
    expect(step.title).toBe('#1 Click on Save Skill Group');
  });

  it('uses element id when text is empty', () => {
    const element = makeElement({ id: 'submit-btn' });
    const step = formatAsZeuzStep(element, 'click', 2);
    expect(step.title).toBe('#2 Click on submit-btn');
  });

  it('uses element name when text and id are empty', () => {
    const element = makeElement({ name: 'email' });
    const step = formatAsZeuzStep(element, 'type-text', 3);
    expect(step.title).toBe('#3 Enter text in on email');
  });

  it('uses tag name as last resort', () => {
    const element = makeElement({ tag: 'div' });
    const step = formatAsZeuzStep(element, 'click', 1);
    expect(step.title).toBe('#1 Click on div');
  });

  it('truncates long text to 40 characters with ellipsis', () => {
    const element = makeElement({
      text: 'This is a very long button text that exceeds forty characters easily',
    });
    const step = formatAsZeuzStep(element, 'click', 1);
    expect(step.title).toContain('#1 Click on');
    // Title should contain truncated text
    expect(step.title.length).toBeLessThan(60);
    expect(step.title).toContain('...');
  });

  it('maps type-text action to "Enter text in" verb', () => {
    const element = makeElement({ tag: 'input', name: 'username' });
    const step = formatAsZeuzStep(element, 'type-text', 1);
    expect(step.title).toContain('Enter text in');
  });

  it('maps select-by-text action to "Select from" verb', () => {
    const element = makeElement({ tag: 'select', name: 'country' });
    const step = formatAsZeuzStep(element, 'select-by-text', 1);
    expect(step.title).toContain('Select from');
  });

  it('maps upload-file action to "Upload file to" verb', () => {
    const element = makeElement({ tag: 'input', name: 'attachment' });
    const step = formatAsZeuzStep(element, 'upload-file', 1);
    expect(step.title).toContain('Upload file to');
  });

  it('maps check action to "Check" verb', () => {
    const element = makeElement({ tag: 'input', name: 'agree' });
    const step = formatAsZeuzStep(element, 'check', 1);
    expect(step.title).toContain('Check');
  });
});

// ─── Task 7.5: Element parameters ───────────────────────────────────────────────

describe('formatAsZeuzStep - element parameters', () => {
  it('includes class when present', () => {
    const element = makeElement({ classes: ['btn', 'primary'] });
    const step = formatAsZeuzStep(element, 'click', 1);
    const classRow = step.rows.find(r => r.field === 'class');
    expect(classRow).toBeDefined();
    expect(classRow!.value).toBe('btn primary');
    expect(classRow!.type).toBe('element parameter');
  });

  it('includes text when present', () => {
    const element = makeElement({ text: 'Click me' });
    const step = formatAsZeuzStep(element, 'click', 1);
    const textRow = step.rows.find(r => r.field === 'text');
    expect(textRow).toBeDefined();
    expect(textRow!.value).toBe('Click me');
  });

  it('includes placeholder when present', () => {
    const element = makeElement({ attributes: { placeholder: 'Search...' } });
    const step = formatAsZeuzStep(element, 'type-text', 1);
    const placeholderRow = step.rows.find(r => r.field === 'placeholder');
    expect(placeholderRow).toBeDefined();
    expect(placeholderRow!.value).toBe('Search...');
  });

  it('includes id when present and not dynamic', () => {
    const element = makeElement({ id: 'login-form' });
    const step = formatAsZeuzStep(element, 'click', 1);
    const idRow = step.rows.find(r => r.field === 'id');
    expect(idRow).toBeDefined();
    expect(idRow!.value).toBe('login-form');
  });

  it('excludes id when it looks dynamic (UUID)', () => {
    const element = makeElement({ id: 'abc12345-1234-5678-9abc-def012345678' });
    const step = formatAsZeuzStep(element, 'click', 1);
    const idRow = step.rows.find(r => r.field === 'id');
    expect(idRow).toBeUndefined();
  });

  it('excludes id when it looks like Angular generated', () => {
    const element = makeElement({ id: '_ngcontent-abc-123' });
    const step = formatAsZeuzStep(element, 'click', 1);
    const idRow = step.rows.find(r => r.field === 'id');
    expect(idRow).toBeUndefined();
  });

  it('excludes id when it has long numeric suffix', () => {
    const element = makeElement({ id: 'component-123456' });
    const step = formatAsZeuzStep(element, 'click', 1);
    const idRow = step.rows.find(r => r.field === 'id');
    expect(idRow).toBeUndefined();
  });

  it('includes name when present', () => {
    const element = makeElement({ name: 'username' });
    const step = formatAsZeuzStep(element, 'type-text', 1);
    const nameRow = step.rows.find(r => r.field === 'name');
    expect(nameRow).toBeDefined();
    expect(nameRow!.value).toBe('username');
  });

  it('includes data-testid when present', () => {
    const element = makeElement({ dataAttributes: { testid: 'save-button' } });
    const step = formatAsZeuzStep(element, 'click', 1);
    const testidRow = step.rows.find(r => r.field === 'data-testid');
    expect(testidRow).toBeDefined();
    expect(testidRow!.value).toBe('save-button');
  });

  it('includes data-test-id variant', () => {
    const element = makeElement({ dataAttributes: { 'test-id': 'delete-btn' } });
    const step = formatAsZeuzStep(element, 'click', 1);
    const testidRow = step.rows.find(r => r.field === 'data-testid');
    expect(testidRow).toBeDefined();
    expect(testidRow!.value).toBe('delete-btn');
  });
});

// ─── Task 7.6: Optional parameters ──────────────────────────────────────────────

describe('formatAsZeuzStep - optional parameters', () => {
  it('includes wait parameter with default value of 5', () => {
    const element = makeElement({ text: 'Submit' });
    const step = formatAsZeuzStep(element, 'click', 1);
    const waitRow = step.rows.find(r => r.field === 'wait');
    expect(waitRow).toBeDefined();
    expect(waitRow!.type).toBe('optional parameter');
    expect(waitRow!.value).toBe('5');
  });

  it('uses custom wait time from settings', () => {
    const element = makeElement({ text: 'Submit' });
    const step = formatAsZeuzStep(element, 'click', 1, { defaultWait: 10 });
    const waitRow = step.rows.find(r => r.field === 'wait');
    expect(waitRow).toBeDefined();
    expect(waitRow!.value).toBe('10');
  });

  it('includes clear option for type-text action', () => {
    const element = makeElement({ tag: 'input', name: 'email' });
    const step = formatAsZeuzStep(element, 'type-text', 1);
    const clearRow = step.rows.find(r => r.field === 'clear');
    expect(clearRow).toBeDefined();
    expect(clearRow!.type).toBe('optional option');
    expect(clearRow!.value).toBe('True');
  });

  it('does not include clear option for click action', () => {
    const element = makeElement({ text: 'Submit' });
    const step = formatAsZeuzStep(element, 'click', 1);
    const clearRow = step.rows.find(r => r.field === 'clear' && r.type === 'optional option');
    expect(clearRow).toBeUndefined();
  });
});

// ─── Task 7.7: Action row at bottom ─────────────────────────────────────────────

describe('formatAsZeuzStep - action row', () => {
  it('places action row as the last row', () => {
    const element = makeElement({ text: 'Save', classes: ['btn'] });
    const step = formatAsZeuzStep(element, 'click', 1);
    const lastRow = step.rows[step.rows.length - 1];
    expect(lastRow.type).toBe('selenium action');
  });

  it('click action → click selenium action', () => {
    const element = makeElement({ text: 'Save' });
    const step = formatAsZeuzStep(element, 'click', 1);
    const actionRow = step.rows.find(r => r.type === 'selenium action');
    expect(actionRow!.field).toBe('click');
    expect(actionRow!.value).toBe('click');
  });

  it('type-text action → text selenium action with variable placeholder', () => {
    const element = makeElement({ tag: 'input', name: 'email' });
    const step = formatAsZeuzStep(element, 'type-text', 1);
    const actionRow = step.rows.find(r => r.type === 'selenium action');
    expect(actionRow!.field).toBe('text');
    expect(actionRow!.value).toBe('%|variable_name|%');
  });

  it('check action → click selenium action', () => {
    const element = makeElement({ tag: 'input' });
    const step = formatAsZeuzStep(element, 'check', 1);
    const actionRow = step.rows.find(r => r.type === 'selenium action');
    expect(actionRow!.field).toBe('click');
    expect(actionRow!.value).toBe('click');
  });

  it('select-by-text action → select selenium action with variable', () => {
    const element = makeElement({ tag: 'select' });
    const step = formatAsZeuzStep(element, 'select-by-text', 1);
    const actionRow = step.rows.find(r => r.type === 'selenium action');
    expect(actionRow!.field).toBe('select');
    expect(actionRow!.value).toBe('%|option_text|%');
  });

  it('upload-file action → upload selenium action with variable', () => {
    const element = makeElement({ tag: 'input' });
    const step = formatAsZeuzStep(element, 'upload-file', 1);
    const actionRow = step.rows.find(r => r.type === 'selenium action');
    expect(actionRow!.field).toBe('upload');
    expect(actionRow!.value).toBe('%|file_path|%');
  });

  it('double-click action → double click selenium action', () => {
    const element = makeElement({ text: 'Row 1' });
    const step = formatAsZeuzStep(element, 'double-click', 1);
    const actionRow = step.rows.find(r => r.type === 'selenium action');
    expect(actionRow!.field).toBe('double click');
    expect(actionRow!.value).toBe('double click');
  });

  it('hover action → hover selenium action', () => {
    const element = makeElement({ text: 'Menu' });
    const step = formatAsZeuzStep(element, 'hover', 1);
    const actionRow = step.rows.find(r => r.type === 'selenium action');
    expect(actionRow!.field).toBe('hover');
    expect(actionRow!.value).toBe('hover');
  });
});

// ─── Task 7.8: copyZeuzStep ─────────────────────────────────────────────────────

describe('copyZeuzStep', () => {
  it('formats step as tab-separated lines with title', () => {
    const element = makeElement({
      text: 'Save Skill Group',
      classes: ['ng-star-inserted'],
    });
    const step = formatAsZeuzStep(element, 'click', 1);
    const output = copyZeuzStep(step);

    const lines = output.split('\n');
    expect(lines[0]).toBe('#1 Click on Save Skill Group');
    // Verify tab-separated format for subsequent lines
    for (let i = 1; i < lines.length; i++) {
      const parts = lines[i].split('\t');
      expect(parts.length).toBe(3);
    }
  });

  it('produces clean copy-paste ready text matching ZeuZ format', () => {
    const element = makeElement({
      text: 'Save Skill Group',
      classes: ['ng-star-inserted'],
    });
    const step = formatAsZeuzStep(element, 'click', 1);
    const output = copyZeuzStep(step);

    expect(output).toContain('class\telement parameter\tng-star-inserted');
    expect(output).toContain('text\telement parameter\tSave Skill Group');
    expect(output).toContain('wait\toptional parameter\t5');
    expect(output).toContain('click\tselenium action\tclick');
  });

  it('handles step with all element parameters', () => {
    const element = makeElement({
      classes: ['form-control'],
      text: 'Enter email',
      id: 'email-input',
      name: 'email',
      attributes: { placeholder: 'your@email.com' },
    });
    const step = formatAsZeuzStep(element, 'type-text', 2);
    const output = copyZeuzStep(step);

    expect(output).toContain('#2 Enter text in on Enter email');
    expect(output).toContain('class\telement parameter\tform-control');
    expect(output).toContain('text\telement parameter\tEnter email');
    expect(output).toContain('placeholder\telement parameter\tyour@email.com');
    expect(output).toContain('id\telement parameter\temail-input');
    expect(output).toContain('name\telement parameter\temail');
    expect(output).toContain('clear\toptional option\tTrue');
    expect(output).toContain('wait\toptional parameter\t5');
    expect(output).toContain('text\tselenium action\t%|variable_name|%');
  });
});

// ─── Task 7.9: copyAllSteps ─────────────────────────────────────────────────────

describe('copyAllSteps', () => {
  it('concatenates multiple steps with blank line between each', () => {
    const element1 = makeElement({ text: 'Login', classes: ['btn'] });
    const element2 = makeElement({ tag: 'input', name: 'password', attributes: { type: 'password' } });

    const step1 = formatAsZeuzStep(element1, 'click', 1);
    const step2 = formatAsZeuzStep(element2, 'type-text', 2);

    const output = copyAllSteps([step1, step2]);

    // Should contain both steps separated by a blank line
    expect(output).toContain('#1 Click on Login');
    expect(output).toContain('#2 Enter text in on password');
    expect(output).toContain('\n\n');
  });

  it('returns empty string for empty steps array', () => {
    const output = copyAllSteps([]);
    expect(output).toBe('');
  });

  it('returns single step without trailing blank line for one step', () => {
    const element = makeElement({ text: 'Submit' });
    const step = formatAsZeuzStep(element, 'click', 1);
    const output = copyAllSteps([step]);

    expect(output).not.toContain('\n\n');
    expect(output).toContain('#1 Click on Submit');
  });

  it('formats three steps sequentially', () => {
    const steps: ZeuzStep[] = [
      formatAsZeuzStep(makeElement({ text: 'Username', tag: 'input', name: 'user' }), 'type-text', 1),
      formatAsZeuzStep(makeElement({ text: 'Password', tag: 'input', name: 'pass' }), 'type-text', 2),
      formatAsZeuzStep(makeElement({ text: 'Login', classes: ['btn-primary'] }), 'click', 3),
    ];

    const output = copyAllSteps(steps);
    const sections = output.split('\n\n');

    expect(sections.length).toBe(3);
    expect(sections[0]).toContain('#1');
    expect(sections[1]).toContain('#2');
    expect(sections[2]).toContain('#3');
  });
});
