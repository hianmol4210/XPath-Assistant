/**
 * Selector types shared between xpathGenerator and confidenceScorer.
 * Extracted to avoid circular dependency.
 */

/**
 * Strategy used to generate the primary selector.
 */
export enum SelectorStrategy {
  ID = 'id',
  DATA_TESTID = 'data-testid',
  ARIA_LABEL = 'aria-label',
  NAME = 'name',
  UNIQUE_ATTRIBUTE = 'unique-attribute',
  TEXT = 'text',
  CONTAINS_TEXT = 'contains-text',
  RELATIVE = 'relative',
}

/**
 * Result of selector generation for a captured element.
 */
export interface SelectorResult {
  /** Best recommended XPath */
  xpath: string;
  /** CSS selector */
  cssSelector: string;
  /** Relative XPath using parent context */
  relativeXpath: string;
  /** Absolute XPath from document root */
  absoluteXpath: string;
  /** XPath to the parent element */
  parentXpath: string;
  /** Confidence score 0-100 */
  confidence: number;
  /** Number of elements matching the xpath (-1 = not yet evaluated) */
  matchCount: number;
  /** Which strategy produced the primary xpath */
  strategy: SelectorStrategy;
}
