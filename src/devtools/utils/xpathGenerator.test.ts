import { describe, it, expect } from 'vitest';
import {
  generateSelector,
  generateRelativeXpath,
  generateAbsoluteXpath,
  generateCssSelector,
  generateParentXpath,
  evaluateMatchCount,
  isDynamicId,
} from './xpathGenerator';
import { SelectorStrategy } from './selectorTypes';
import { CapturedElement } from '../../shared/types';

// ─── Test helpers ───────────────────────────────────────────────────────────────

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

// ─── isDynamicId ────────────────────────────────────────────────────────────────

describe('isDynamicId', () => {
  it('returns true for empty id', () => {
    expect(isDynamicId('')).toBe(true);
  });

  it('returns true for UUID patterns', () => {
    expect(isDynamicId('btn-a1b2c3d4-e5f6-7890-abcd-ef1234567890')).toBe(true);
  });

  it('returns true for Angular generated IDs', () => {
    expect(isDynamicId('_ngcontent-abc-123')).toBe(true);
    expect(isDynamicId('_nghost-abc')).toBe(true);
    expect(isDynamicId('ng-component-1')).toBe(true);
    expect(isDynamicId('cdk-overlay-0')).toBe(true);
  });

  it('returns true for React generated IDs', () => {
    expect(isDynamicId('react-select-123')).toBe(true);
    expect(isDynamicId(':r1a2b:')).toBe(true);
  });

  it('returns true for Material/CDK prefixes', () => {
    expect(isDynamicId('mat-input-0')).toBe(true);
    expect(isDynamicId('mdc-auto-init-1')).toBe(true);
  });

  it('returns true for IDs ending with >3 digits', () => {
    expect(isDynamicId('element-12345')).toBe(true);
  });

  it('returns false for stable human-readable IDs', () => {
    expect(isDynamicId('login-form')).toBe(false);
    expect(isDynamicId('submit-btn')).toBe(false);
    expect(isDynamicId('main-nav')).toBe(false);
    expect(isDynamicId('header')).toBe(false);
  });

  it('returns false for IDs with short numeric suffixes', () => {
    expect(isDynamicId('tab-1')).toBe(false);
    expect(isDynamicId('step-23')).toBe(false);
  });
});

// ─── generateSelector priority chain ────────────────────────────────────────────

describe('generateSelector', () => {
  it('uses ID strategy when element has a stable id', () => {
    const result = generateSelector(makeElement({ id: 'login-btn' }));
    expect(result.strategy).toBe(SelectorStrategy.ID);
    expect(result.xpath).toBe("//*[@id='login-btn']");
    expect(result.confidence).toBe(98);
  });

  it('skips dynamic ID and falls through to next strategy', () => {
    const result = generateSelector(
      makeElement({
        id: 'mat-input-0123',
        dataAttributes: { 'data-testid': 'username-field' },
      })
    );
    expect(result.strategy).toBe(SelectorStrategy.DATA_TESTID);
    expect(result.xpath).toBe("//*[@data-testid='username-field']");
  });

  it('uses data-testid strategy', () => {
    const result = generateSelector(
      makeElement({ dataAttributes: { 'data-testid': 'save-btn' } })
    );
    expect(result.strategy).toBe(SelectorStrategy.DATA_TESTID);
    expect(result.xpath).toBe("//*[@data-testid='save-btn']");
    expect(result.confidence).toBe(99);
  });

  it('uses aria-label strategy', () => {
    const result = generateSelector(
      makeElement({ ariaAttributes: { 'aria-label': 'Close dialog' } })
    );
    expect(result.strategy).toBe(SelectorStrategy.ARIA_LABEL);
    expect(result.xpath).toBe("//*[@aria-label='Close dialog']");
    expect(result.confidence).toBe(90);
  });

  it('uses name strategy', () => {
    const result = generateSelector(makeElement({ name: 'email', tag: 'input' }));
    expect(result.strategy).toBe(SelectorStrategy.NAME);
    expect(result.xpath).toBe("//input[@name='email']");
    expect(result.confidence).toBe(88);
  });

  it('uses unique attribute strategy for data-test attributes', () => {
    const result = generateSelector(
      makeElement({
        tag: 'div',
        attributes: { 'data-test': 'form-container' },
        dataAttributes: { 'data-test': 'form-container' },
      })
    );
    expect(result.strategy).toBe(SelectorStrategy.UNIQUE_ATTRIBUTE);
    expect(result.xpath).toBe("//div[@data-test='form-container']");
  });

  it('uses text strategy for short text', () => {
    const result = generateSelector(makeElement({ text: 'Submit' }));
    expect(result.strategy).toBe(SelectorStrategy.TEXT);
    expect(result.xpath).toBe("//button[text()='Submit']");
    expect(result.confidence).toBe(75);
  });

  it('uses contains-text strategy for longer text', () => {
    const longText = 'This is a moderately long text content that exceeds the limit';
    const result = generateSelector(makeElement({ text: longText }));
    expect(result.strategy).toBe(SelectorStrategy.CONTAINS_TEXT);
    expect(result.xpath).toContain('contains(text()');
  });

  it('falls back to relative XPath when no other strategy matches', () => {
    const result = generateSelector(
      makeElement({
        hierarchy: {
          parentTag: 'form',
          parentId: 'login-form',
          parentClasses: ['auth'],
          siblingIndex: 2,
          totalSiblings: 5,
        },
      })
    );
    expect(result.strategy).toBe(SelectorStrategy.RELATIVE);
    expect(result.confidence).toBe(55);
  });

  it('always provides all selector types in result', () => {
    const result = generateSelector(makeElement({ id: 'my-btn' }));
    expect(result.xpath).toBeDefined();
    expect(result.cssSelector).toBeDefined();
    expect(result.relativeXpath).toBeDefined();
    expect(result.absoluteXpath).toBeDefined();
    expect(result.parentXpath).toBeDefined();
    expect(result.matchCount).toBe(-1);
  });
});

// ─── generateRelativeXpath ──────────────────────────────────────────────────────

describe('generateRelativeXpath', () => {
  it('uses parent ID when available and stable', () => {
    const result = generateRelativeXpath(
      makeElement({
        tag: 'input',
        hierarchy: {
          parentTag: 'form',
          parentId: 'login-form',
          parentClasses: [],
          siblingIndex: 1,
          totalSiblings: 3,
        },
      })
    );
    expect(result).toBe("//form[@id='login-form']/input[2]");
  });

  it('uses parent class when parent ID is absent', () => {
    const result = generateRelativeXpath(
      makeElement({
        tag: 'button',
        hierarchy: {
          parentTag: 'div',
          parentId: '',
          parentClasses: ['toolbar'],
          siblingIndex: 0,
          totalSiblings: 4,
        },
      })
    );
    expect(result).toBe("//div[contains(@class,'toolbar')]/button[1]");
  });

  it('omits position predicate when only sibling', () => {
    const result = generateRelativeXpath(
      makeElement({
        tag: 'span',
        hierarchy: {
          parentTag: 'div',
          parentId: 'container',
          parentClasses: [],
          siblingIndex: 0,
          totalSiblings: 1,
        },
      })
    );
    expect(result).toBe("//div[@id='container']/span");
  });
});

// ─── generateAbsoluteXpath ──────────────────────────────────────────────────────

describe('generateAbsoluteXpath', () => {
  it('generates absolute path from html/body', () => {
    const result = generateAbsoluteXpath(
      makeElement({
        tag: 'button',
        hierarchy: {
          parentTag: 'form',
          parentId: '',
          parentClasses: [],
          siblingIndex: 2,
          totalSiblings: 5,
        },
      })
    );
    expect(result).toBe('/html/body/form/button[3]');
  });

  it('omits position for single sibling', () => {
    const result = generateAbsoluteXpath(
      makeElement({
        tag: 'input',
        hierarchy: {
          parentTag: 'div',
          parentId: '',
          parentClasses: [],
          siblingIndex: 0,
          totalSiblings: 1,
        },
      })
    );
    expect(result).toBe('/html/body/div/input');
  });
});

// ─── generateCssSelector ────────────────────────────────────────────────────────

describe('generateCssSelector', () => {
  it('uses stable ID', () => {
    const result = generateCssSelector(makeElement({ id: 'main-nav' }));
    expect(result).toBe('#main-nav');
  });

  it('uses data-testid', () => {
    const result = generateCssSelector(
      makeElement({ dataAttributes: { 'data-testid': 'header' } })
    );
    expect(result).toBe('[data-testid="header"]');
  });

  it('uses classes', () => {
    const result = generateCssSelector(
      makeElement({ tag: 'div', classes: ['card', 'active'] })
    );
    expect(result).toBe('div.card.active');
  });

  it('uses name attribute', () => {
    const result = generateCssSelector(
      makeElement({ tag: 'input', name: 'username' })
    );
    expect(result).toBe('input[name="username"]');
  });

  it('falls back to nth-child for elements with siblings', () => {
    const result = generateCssSelector(
      makeElement({
        tag: 'li',
        hierarchy: {
          parentTag: 'ul',
          parentId: '',
          parentClasses: [],
          siblingIndex: 2,
          totalSiblings: 5,
        },
      })
    );
    expect(result).toBe('li:nth-child(3)');
  });
});

// ─── generateParentXpath ────────────────────────────────────────────────────────

describe('generateParentXpath', () => {
  it('uses parent ID when stable', () => {
    const result = generateParentXpath(
      makeElement({
        hierarchy: {
          parentTag: 'section',
          parentId: 'main-content',
          parentClasses: [],
          siblingIndex: 0,
          totalSiblings: 1,
        },
      })
    );
    expect(result).toBe("//section[@id='main-content']");
  });

  it('uses parent class when no stable ID', () => {
    const result = generateParentXpath(
      makeElement({
        hierarchy: {
          parentTag: 'div',
          parentId: '',
          parentClasses: ['wrapper', 'flex'],
          siblingIndex: 0,
          totalSiblings: 1,
        },
      })
    );
    expect(result).toBe("//div[contains(@class,'wrapper')]");
  });

  it('uses bare tag when no identifying attributes', () => {
    const result = generateParentXpath(
      makeElement({
        hierarchy: {
          parentTag: 'div',
          parentId: '',
          parentClasses: [],
          siblingIndex: 0,
          totalSiblings: 1,
        },
      })
    );
    expect(result).toBe('//div');
  });
});

// ─── evaluateMatchCount ─────────────────────────────────────────────────────────

describe('evaluateMatchCount', () => {
  it('returns -1 as placeholder (not yet evaluated)', async () => {
    const count = await evaluateMatchCount("//*[@id='test']");
    expect(count).toBe(-1);
  });
});
