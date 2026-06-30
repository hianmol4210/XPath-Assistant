/**
 * Confidence Scorer
 *
 * Calculates confidence scores for generated selectors based on:
 * 1. The selector strategy used (ID is most reliable, relative XPath least)
 * 2. The match count (1 match = great, >1 = penalized heavily)
 */

import { SelectorStrategy } from './selectorTypes';

/**
 * Base confidence values per selector strategy.
 */
const BASE_CONFIDENCE: Record<SelectorStrategy, number> = {
  [SelectorStrategy.ID]: 98,
  [SelectorStrategy.DATA_TESTID]: 99,
  [SelectorStrategy.ARIA_LABEL]: 90,
  [SelectorStrategy.NAME]: 88,
  [SelectorStrategy.UNIQUE_ATTRIBUTE]: 80,
  [SelectorStrategy.TEXT]: 75,
  [SelectorStrategy.CONTAINS_TEXT]: 70,
  [SelectorStrategy.RELATIVE]: 55,
};

/**
 * Calculates a confidence score (0-100) for a selector based on:
 * - The strategy used to generate it (determines base score)
 * - The match count on the page (penalizes multiple matches)
 *
 * @param strategy - Which selector strategy was used
 * @param matchCount - How many DOM elements match the selector (-1 = not evaluated)
 * @returns Confidence score between 0 and 100
 */
export function calculateConfidence(strategy: SelectorStrategy, matchCount: number): number {
  const base = BASE_CONFIDENCE[strategy] ?? 50;

  // If not yet evaluated, return base confidence
  if (matchCount < 0) {
    return base;
  }

  // Exactly 1 match — best case, small bonus (capped at 100)
  if (matchCount === 1) {
    return Math.min(100, base + 2);
  }

  // No matches — selector is broken, heavy penalty
  if (matchCount === 0) {
    return Math.max(0, base - 50);
  }

  // Multiple matches — penalize based on how many
  // 2-3 matches: -20%, 4-9 matches: -30%, 10+: -40%
  if (matchCount <= 3) {
    return Math.max(0, Math.round(base * 0.8));
  }
  if (matchCount <= 9) {
    return Math.max(0, Math.round(base * 0.7));
  }
  return Math.max(0, Math.round(base * 0.6));
}
