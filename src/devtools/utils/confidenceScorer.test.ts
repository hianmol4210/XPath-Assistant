import { describe, it, expect } from 'vitest';
import { calculateConfidence } from './confidenceScorer';
import { SelectorStrategy } from './selectorTypes';

describe('calculateConfidence', () => {
  it('returns base confidence when matchCount is -1 (not evaluated)', () => {
    expect(calculateConfidence(SelectorStrategy.ID, -1)).toBe(98);
    expect(calculateConfidence(SelectorStrategy.DATA_TESTID, -1)).toBe(99);
    expect(calculateConfidence(SelectorStrategy.ARIA_LABEL, -1)).toBe(90);
    expect(calculateConfidence(SelectorStrategy.NAME, -1)).toBe(88);
    expect(calculateConfidence(SelectorStrategy.UNIQUE_ATTRIBUTE, -1)).toBe(80);
    expect(calculateConfidence(SelectorStrategy.TEXT, -1)).toBe(75);
    expect(calculateConfidence(SelectorStrategy.CONTAINS_TEXT, -1)).toBe(70);
    expect(calculateConfidence(SelectorStrategy.RELATIVE, -1)).toBe(55);
  });

  it('adds bonus of 2 when matchCount is exactly 1 (capped at 100)', () => {
    expect(calculateConfidence(SelectorStrategy.ID, 1)).toBe(100);
    expect(calculateConfidence(SelectorStrategy.DATA_TESTID, 1)).toBe(100); // 99 + 2 capped
    expect(calculateConfidence(SelectorStrategy.RELATIVE, 1)).toBe(57);
  });

  it('heavily penalizes matchCount of 0 (broken selector)', () => {
    expect(calculateConfidence(SelectorStrategy.ID, 0)).toBe(48);
    expect(calculateConfidence(SelectorStrategy.RELATIVE, 0)).toBe(5);
  });

  it('penalizes 20% for 2-3 matches', () => {
    expect(calculateConfidence(SelectorStrategy.ID, 2)).toBe(78); // 98 * 0.8
    expect(calculateConfidence(SelectorStrategy.ID, 3)).toBe(78);
    expect(calculateConfidence(SelectorStrategy.TEXT, 2)).toBe(60); // 75 * 0.8
  });

  it('penalizes 30% for 4-9 matches', () => {
    expect(calculateConfidence(SelectorStrategy.ID, 5)).toBe(69); // 98 * 0.7
    expect(calculateConfidence(SelectorStrategy.RELATIVE, 9)).toBe(39); // 55 * 0.7 = 38.5 → 39
  });

  it('penalizes 40% for 10+ matches', () => {
    expect(calculateConfidence(SelectorStrategy.ID, 10)).toBe(59); // 98 * 0.6
    expect(calculateConfidence(SelectorStrategy.ID, 100)).toBe(59);
    expect(calculateConfidence(SelectorStrategy.RELATIVE, 50)).toBe(33); // 55 * 0.6
  });

  it('never goes below 0', () => {
    // Even with heavy penalty, should not be negative
    expect(calculateConfidence(SelectorStrategy.RELATIVE, 0)).toBeGreaterThanOrEqual(0);
  });
});
