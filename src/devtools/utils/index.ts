// DevTools utilities barrel export

export {
  generateSelector,
  generateRelativeXpath,
  generateAbsoluteXpath,
  generateCssSelector,
  generateParentXpath,
  evaluateMatchCount,
  isDynamicId,
  SelectorStrategy,
  type SelectorResult,
} from './xpathGenerator';

export { calculateConfidence } from './confidenceScorer';

export {
  recommendAction,
  type ActionType,
  type ActionRecommendation,
  type NextStepSuggestion,
} from './actionRecommender';

export {
  formatAsZeuzStep,
  copyZeuzStep,
  copyAllSteps,
  type ZeuzParameterType,
  type ZeuzRow,
  type ZeuzStep,
  type ZeuzFormatterSettings,
} from './zeuzFormatter';
