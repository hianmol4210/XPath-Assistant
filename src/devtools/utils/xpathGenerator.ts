/**
 * XPath Generator Engine
 *
 * Generates smart selectors for captured elements following a priority chain:
 * ID > data-testid > aria-label > name > unique attribute > text() > contains(text()) > relative xpath
 *
 * Avoids dynamic/generated IDs (Angular, React, UUID patterns).
 * Produces multiple selector types: relative XPath, absolute XPath, CSS selector, parent XPath.
 */

import { CapturedElement } from '../../shared/types';
import { calculateConfidence } from './confidenceScorer';
import { SelectorStrategy, SelectorResult } from './selectorTypes';

// Re-export types so consumers can import from this module
export { SelectorStrategy, type SelectorResult } from './selectorTypes';

// ─── Dynamic ID Detection ───────────────────────────────────────────────────────

/**
 * Detects whether an element ID looks dynamically generated and therefore unstable.
 *
 * Checks for:
 * - UUID patterns (8-4-4-4-12 hex chars)
 * - Angular generated IDs (_ngcontent, _nghost, ng-, cdk-)
 * - React generated IDs (react-, data-reactid)
 * - Material / CDK prefixes (mat-, mdc-)
 * - Trailing numeric sequences (>3 consecutive digits at end)
 * - Random alphanumeric sequences (mix of letters+numbers >8 chars)
 */
export function isDynamicId(id: string): boolean {
  if (!id) return true;

  // UUID pattern: 8-4-4-4-12 hex characters
  const uuidPattern = /[0-9a-f]{8}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{12}/i;
  if (uuidPattern.test(id)) return true;

  // Angular generated patterns
  if (/_ngcontent/i.test(id) || /_nghost/i.test(id) || /^ng-/i.test(id) || /^cdk-/i.test(id)) {
    return true;
  }

  // React generated patterns
  if (/^react-/i.test(id) || /^data-reactid/i.test(id) || /^:r[0-9a-z]+:/i.test(id)) {
    return true;
  }

  // Material / CDK prefixes (mat-input-0, mdc-auto-init-0)
  if (/^mat-/i.test(id) || /^mdc-/i.test(id)) {
    return true;
  }

  // Ends with more than 3 consecutive digits
  if (/\d{4,}$/.test(id)) return true;

  // Random alphanumeric sequences: mix of letters and digits > 8 chars without clear word structure
  const alphanumMixPattern = /[a-z]+\d+[a-z0-9]{4,}|[0-9]+[a-z]+[a-z0-9]{4,}/i;
  if (alphanumMixPattern.test(id) && id.length > 12) return true;

  return false;
}

// ─── Helper Utilities ───────────────────────────────────────────────────────────

/**
 * Escapes single quotes in a string for use inside XPath string literals.
 */
function escapeXPathString(value: string): string {
  if (!value.includes("'")) {
    return `'${value}'`;
  }
  if (!value.includes('"')) {
    return `"${value}"`;
  }
  // Use concat for strings containing both quote types
  const parts = value.split("'");
  return `concat('${parts.join("', \"'\", '")}')`;
}

/**
 * Escapes a CSS attribute value.
 */
function escapeCssAttributeValue(value: string): string {
  return value.replace(/["\\]/g, '\\$&');
}

/**
 * Escapes a string for use as a CSS identifier (similar to CSS.escape).
 * Handles special characters that are invalid in CSS selectors.
 */
function cssEscape(value: string): string {
  if (typeof globalThis.CSS !== 'undefined' && globalThis.CSS.escape) {
    return globalThis.CSS.escape(value);
  }
  // Polyfill for Node.js / test environments
  return value.replace(/([^\w-])/g, '\\$1');
}

/** Maximum text length for exact text() match */
const MAX_TEXT_LENGTH = 50;

/** Maximum text length for contains(text()) match */
const MAX_CONTAINS_TEXT_LENGTH = 100;

/** Partial text length for contains(text()) */
const CONTAINS_TEXT_PARTIAL_LENGTH = 30;

// ─── Selector Generators ────────────────────────────────────────────────────────

/**
 * Generates the primary (best) XPath using the priority chain.
 */
function generatePrimaryXpath(element: CapturedElement): { xpath: string; strategy: SelectorStrategy } {
  // 1. ID — if exists and NOT dynamic
  if (element.id && !isDynamicId(element.id)) {
    return {
      xpath: `//*[@id=${escapeXPathString(element.id)}]`,
      strategy: SelectorStrategy.ID,
    };
  }

  // 2. data-testid
  const testId = element.dataAttributes['data-testid'] ?? element.attributes['data-testid'];
  if (testId) {
    return {
      xpath: `//*[@data-testid=${escapeXPathString(testId)}]`,
      strategy: SelectorStrategy.DATA_TESTID,
    };
  }

  // 3. aria-label
  const ariaLabel = element.ariaAttributes['aria-label'] ?? element.attributes['aria-label'];
  if (ariaLabel) {
    return {
      xpath: `//*[@aria-label=${escapeXPathString(ariaLabel)}]`,
      strategy: SelectorStrategy.ARIA_LABEL,
    };
  }

  // 4. name attribute
  if (element.name) {
    return {
      xpath: `//${element.tag}[@name=${escapeXPathString(element.name)}]`,
      strategy: SelectorStrategy.NAME,
    };
  }

  // 5. Unique attribute (look for likely stable attributes)
  const uniqueAttr = findUniqueAttribute(element);
  if (uniqueAttr) {
    return {
      xpath: `//${element.tag}[@${uniqueAttr.name}=${escapeXPathString(uniqueAttr.value)}]`,
      strategy: SelectorStrategy.UNIQUE_ATTRIBUTE,
    };
  }

  // 6. text() — short, clean text content
  const trimmedText = element.text.trim();
  if (trimmedText && trimmedText.length <= MAX_TEXT_LENGTH && !trimmedText.includes('\n')) {
    return {
      xpath: `//${element.tag}[text()=${escapeXPathString(trimmedText)}]`,
      strategy: SelectorStrategy.TEXT,
    };
  }

  // 7. contains(text()) — longer text, use partial
  if (trimmedText && trimmedText.length <= MAX_CONTAINS_TEXT_LENGTH) {
    const partial = trimmedText.substring(0, CONTAINS_TEXT_PARTIAL_LENGTH).trim();
    if (partial) {
      return {
        xpath: `//${element.tag}[contains(text(),${escapeXPathString(partial)})]`,
        strategy: SelectorStrategy.CONTAINS_TEXT,
      };
    }
  }

  // 8. Relative XPath using parent context
  return {
    xpath: generateRelativeXpath(element),
    strategy: SelectorStrategy.RELATIVE,
  };
}

/**
 * Finds a likely-stable unique attribute on the element.
 * Skips common volatile attributes (style, class, etc.).
 */
function findUniqueAttribute(element: CapturedElement): { name: string; value: string } | null {
  // Preferred unique attribute candidates (order matters)
  const candidates = [
    'data-test',
    'data-cy',
    'data-automation',
    'data-qa',
    'data-id',
    'title',
    'placeholder',
    'href',
    'src',
    'alt',
    'value',
    'type',
    'role',
  ];

  // Skip attributes that are volatile or too generic
  const skipAttributes = new Set([
    'class',
    'style',
    'id',
    'name',
    'data-testid',
    'aria-label',
    'tabindex',
    'aria-hidden',
    'aria-expanded',
    'aria-selected',
    'aria-checked',
    'aria-disabled',
  ]);

  // Check preferred candidates first
  for (const attr of candidates) {
    const value = element.attributes[attr] ?? element.dataAttributes[attr];
    if (value && value.trim().length > 0 && value.length < 100) {
      return { name: attr, value };
    }
  }

  // Check remaining data-attributes
  for (const [key, value] of Object.entries(element.dataAttributes)) {
    if (skipAttributes.has(key)) continue;
    if (key === 'data-testid') continue; // already checked
    if (value && value.trim().length > 0 && value.length < 100) {
      return { name: key, value };
    }
  }

  return null;
}

// ─── Relative XPath ─────────────────────────────────────────────────────────────

/**
 * Generates a relative XPath using parent context and sibling position.
 * Format: //parentTag[@id='parentId']/tag[siblingIndex]
 *       or //parentTag/tag[siblingIndex] when parent has no stable id
 */
export function generateRelativeXpath(element: CapturedElement): string {
  const { hierarchy } = element;
  const tag = element.tag;

  // Position predicate (1-based index among same-tag siblings)
  const positionPredicate = hierarchy.totalSiblings > 1 ? `[${hierarchy.siblingIndex + 1}]` : '';

  // Try parent with ID
  if (hierarchy.parentId && !isDynamicId(hierarchy.parentId)) {
    return `//${hierarchy.parentTag}[@id=${escapeXPathString(hierarchy.parentId)}]/${tag}${positionPredicate}`;
  }

  // Try parent with class (use first meaningful class)
  if (hierarchy.parentClasses.length > 0) {
    const parentClass = hierarchy.parentClasses[0];
    return `//${hierarchy.parentTag}[contains(@class,${escapeXPathString(parentClass)})]/${tag}${positionPredicate}`;
  }

  // Bare parent tag + position
  return `//${hierarchy.parentTag}/${tag}${positionPredicate}`;
}

// ─── Absolute XPath ─────────────────────────────────────────────────────────────

/**
 * Generates an absolute XPath using the full path from the document root.
 * Uses hierarchy information available (parent context + element position).
 * Format: /html/body/.../parentTag/tag[position]
 */
export function generateAbsoluteXpath(element: CapturedElement): string {
  const { hierarchy } = element;
  const tag = element.tag;
  const positionPredicate = hierarchy.totalSiblings > 1 ? `[${hierarchy.siblingIndex + 1}]` : '';

  // Build a simplified absolute path using what we know from hierarchy.
  // Since CapturedElement provides one level of parent context, we build:
  // /html/body/parentTag/tag[position]
  // A more precise absolute path requires the full ancestor chain from the content script.
  return `/html/body/${hierarchy.parentTag}/${tag}${positionPredicate}`;
}

// ─── CSS Selector ───────────────────────────────────────────────────────────────

/**
 * Generates a CSS selector for the element.
 * Uses ID (if stable), classes, or attributes as fallback.
 */
export function generateCssSelector(element: CapturedElement): string {
  const tag = element.tag;

  // Prefer stable ID
  if (element.id && !isDynamicId(element.id)) {
    return `#${cssEscape(element.id)}`;
  }

  // data-testid
  const testId = element.dataAttributes['data-testid'] ?? element.attributes['data-testid'];
  if (testId) {
    return `[data-testid="${escapeCssAttributeValue(testId)}"]`;
  }

  // Classes (use first 2 meaningful classes to keep it readable)
  if (element.classes.length > 0) {
    const classes = element.classes
      .filter((c) => c.length > 0 && !isDynamicClassName(c))
      .slice(0, 2);
    if (classes.length > 0) {
      return `${tag}.${classes.map((c) => cssEscape(c)).join('.')}`;
    }
  }

  // Name attribute
  if (element.name) {
    return `${tag}[name="${escapeCssAttributeValue(element.name)}"]`;
  }

  // aria-label
  const ariaLabel = element.ariaAttributes['aria-label'] ?? element.attributes['aria-label'];
  if (ariaLabel) {
    return `${tag}[aria-label="${escapeCssAttributeValue(ariaLabel)}"]`;
  }

  // Fallback: tag with nth-child
  const { hierarchy } = element;
  if (hierarchy.totalSiblings > 1) {
    return `${tag}:nth-child(${hierarchy.siblingIndex + 1})`;
  }

  return tag;
}

/**
 * Detects dynamically generated CSS class names (e.g., CSS modules hash suffixes).
 */
function isDynamicClassName(className: string): boolean {
  // Classes with hash-like suffixes (CSS modules, styled-components)
  if (/[_-][a-z0-9]{5,}$/i.test(className)) return true;
  // Angular component classes
  if (/^_ngcontent/i.test(className) || /^_nghost/i.test(className)) return true;
  return false;
}

// ─── Parent XPath ───────────────────────────────────────────────────────────────

/**
 * Generates an XPath to the parent element.
 */
export function generateParentXpath(element: CapturedElement): string {
  const { hierarchy } = element;

  if (hierarchy.parentId && !isDynamicId(hierarchy.parentId)) {
    return `//${hierarchy.parentTag}[@id=${escapeXPathString(hierarchy.parentId)}]`;
  }

  if (hierarchy.parentClasses.length > 0) {
    const parentClass = hierarchy.parentClasses[0];
    return `//${hierarchy.parentTag}[contains(@class,${escapeXPathString(parentClass)})]`;
  }

  return `//${hierarchy.parentTag}`;
}

// ─── Match Count Evaluation ─────────────────────────────────────────────────────

/**
 * Evaluates how many elements match the given XPath on the page.
 *
 * Note: This runs in the DevTools panel context (not on the page).
 * Returns -1 indicating "not yet evaluated". The integration layer
 * will ask the content script to evaluate the actual match count via messaging.
 */
export async function evaluateMatchCount(_xpath: string): Promise<number> {
  // Placeholder: actual evaluation requires communication with content script
  // The integration layer (task 12) will wire this to evaluate on the actual page DOM.
  return -1;
}

// ─── Main Entry Point ───────────────────────────────────────────────────────────

/**
 * Generates all selector variants for a captured element and returns
 * the best recommended XPath along with alternatives.
 */
export function generateSelector(element: CapturedElement): SelectorResult {
  // Generate primary XPath using priority chain
  const { xpath, strategy } = generatePrimaryXpath(element);

  // Generate alternative selectors
  const relativeXpath = generateRelativeXpath(element);
  const absoluteXpath = generateAbsoluteXpath(element);
  const cssSelector = generateCssSelector(element);
  const parentXpath = generateParentXpath(element);

  // Calculate confidence (match count not yet evaluated)
  const matchCount = -1;
  const confidence = calculateConfidence(strategy, matchCount);

  return {
    xpath,
    cssSelector,
    relativeXpath,
    absoluteXpath,
    parentXpath,
    confidence,
    matchCount,
    strategy,
  };
}
