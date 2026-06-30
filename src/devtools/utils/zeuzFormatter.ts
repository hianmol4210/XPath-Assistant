/**
 * ZeuZ Formatter
 *
 * Formats captured elements into ZeuZ-compatible parameter rows matching
 * the exact format used in ZeuZ desktop tool.
 *
 * ZeuZ step structure:
 *   element parameters (text, class, id, tag, etc.) — identify the target element
 *   parent parameters (*class, href, id, etc.) — narrow down using parent/container
 *   optional options (wait, clear, etc.)
 *   selenium action (click, text, select, etc.)
 *   LOCATOR: auto-generated XPath from the parameters
 */

import { CapturedElement } from '../../shared/types';
import { ActionType } from './actionRecommender';

// ─── Types ──────────────────────────────────────────────────────────────────────

export type ZeuzParameterType =
  | 'element parameter'
  | 'parent parameter'
  | 'selenium action'
  | 'optional option';

export interface ZeuzRow {
  /** Field name (e.g., "class", "*class", "text", "href", "click", "wait") */
  field: string;
  /** Parameter type category */
  type: ZeuzParameterType;
  /** The value for this parameter */
  value: string;
}

export interface ZeuzStep {
  /** Auto-generated step title (e.g., "#1 Click on Save Skill Group") */
  title: string;
  /** Sequential step number */
  stepNumber: number;
  /** Parameter rows for this step */
  rows: ZeuzRow[];
  /** Auto-generated locator XPath from the parameters */
  locator: string;
  /** Suggested variable name for the locator (e.g., "xpath_create_sq") */
  locatorName: string;
}

export interface ZeuzFormatterSettings {
  /** Default wait time in seconds (default: 5) */
  defaultWait?: number;
}

// ─── Action verb mapping ────────────────────────────────────────────────────────

const ACTION_VERB_MAP: Record<string, string> = {
  'click': 'Click',
  'double-click': 'Double click',
  'right-click': 'Right click',
  'hover': 'Hover',
  'type-text': 'Enter text in',
  'clear-text': 'Clear text in',
  'check': 'Check',
  'uncheck': 'Uncheck',
  'select': 'Select',
  'select-by-text': 'Select from',
  'select-by-value': 'Select from',
  'select-by-index': 'Select from',
  'upload-file': 'Upload file to',
  'scroll-into-view': 'Scroll to',
  'wait-for-element': 'Wait for',
  'wait-until-visible': 'Wait until visible',
  'wait-until-hidden': 'Wait until hidden',
  'wait-disable': 'Wait disable',
  'verify-exists': 'Verify',
  'verify-text': 'Verify text of',
  'verify-visible': 'Verify visible',
  'navigate': 'Navigate to',
};

// ─── Action row mapping ─────────────────────────────────────────────────────────

function getActionRow(action: ActionType): ZeuzRow {
  switch (action) {
    case 'click':
    case 'check':
    case 'uncheck':
      return { field: 'click', type: 'selenium action', value: 'click' };
    case 'double-click':
      return { field: 'double click', type: 'selenium action', value: 'double click' };
    case 'right-click':
      return { field: 'right click', type: 'selenium action', value: 'right click' };
    case 'hover':
      return { field: 'hover', type: 'selenium action', value: 'hover' };
    case 'type-text':
      return { field: 'text', type: 'selenium action', value: '%|variable_name|%' };
    case 'clear-text':
      return { field: 'clear', type: 'selenium action', value: 'clear' };
    case 'select-by-text':
      return { field: 'select', type: 'selenium action', value: '%|option_text|%' };
    case 'select-by-value':
      return { field: 'select_by_value', type: 'selenium action', value: '%|option_value|%' };
    case 'select-by-index':
      return { field: 'select_by_index', type: 'selenium action', value: '%|option_index|%' };
    case 'upload-file':
      return { field: 'upload', type: 'selenium action', value: '%|file_path|%' };
    case 'scroll-into-view':
      return { field: 'scroll', type: 'selenium action', value: 'scroll into view' };
    case 'wait-for-element':
      return { field: 'wait', type: 'selenium action', value: '10' };
    case 'wait-until-visible':
      return { field: 'wait', type: 'selenium action', value: '10' };
    case 'wait-until-hidden':
      return { field: 'wait', type: 'selenium action', value: '10' };
    case 'wait-disable':
      return { field: 'wait disable', type: 'selenium action', value: '10' };
    case 'verify-exists':
      return { field: 'verify', type: 'selenium action', value: 'element exists' };
    case 'verify-text':
      return { field: 'verify', type: 'selenium action', value: '%|expected_text|%' };
    case 'verify-visible':
      return { field: 'check element', type: 'selenium action', value: 'visible' };
    case 'navigate':
      return { field: 'navigate', type: 'selenium action', value: '%|url|%' };
    default:
      return { field: 'click', type: 'selenium action', value: 'click' };
  }
}

// ─── Element description ────────────────────────────────────────────────────────

const MAX_DESCRIPTION_LENGTH = 40;

function getElementDescription(element: CapturedElement): string {
  if (element.text && element.text.trim()) {
    const trimmed = element.text.trim();
    return trimmed.length <= MAX_DESCRIPTION_LENGTH
      ? trimmed
      : trimmed.substring(0, MAX_DESCRIPTION_LENGTH) + '...';
  }
  if (element.id) return element.id;
  if (element.name) return element.name;
  return element.tag;
}

// ─── Locator name generation ────────────────────────────────────────────────────

/**
 * Generates a unique, descriptive variable name for the XPath locator.
 * Format: xpath_<element_description>_<context>
 * Examples: xpath_create_btn, xpath_username_input, xpath_reports_link
 */
function generateLocatorName(element: CapturedElement): string {
  const parts: string[] = ['xpath'];

  // Primary identifier: text content, name, id, or placeholder
  if (element.text && element.text.trim()) {
    // Take first 2-3 meaningful words
    const words = element.text.trim()
      .toLowerCase()
      .replace(/[^a-z0-9\s]/g, '')
      .split(/\s+/)
      .filter(w => w.length > 1)
      .slice(0, 3);
    if (words.length > 0) {
      parts.push(...words);
    }
  } else if (element.name) {
    parts.push(element.name.toLowerCase().replace(/[^a-z0-9]/g, '_'));
  } else if (element.id && !isDynamicValue(element.id)) {
    parts.push(element.id.toLowerCase().replace(/[^a-z0-9]/g, '_'));
  } else if (element.attributes['placeholder']) {
    const words = element.attributes['placeholder']
      .toLowerCase()
      .replace(/[^a-z0-9\s]/g, '')
      .split(/\s+/)
      .filter(w => w.length > 1)
      .slice(0, 2);
    parts.push(...words);
  }

  // Add element type context
  const tagShortMap: Record<string, string> = {
    'button': 'btn',
    'input': 'input',
    'select': 'dropdown',
    'textarea': 'textarea',
    'a': 'link',
    'img': 'img',
    'div': 'div',
    'span': 'span',
    'label': 'label',
    'table': 'table',
    'tr': 'row',
    'td': 'cell',
  };
  const tagShort = tagShortMap[element.tag] || element.tag;
  
  // Only add tag suffix if we don't already have a descriptive name
  if (parts.length <= 1) {
    parts.push(tagShort);
  } else if (!['btn', 'input', 'link', 'dropdown'].some(t => parts.includes(t))) {
    // Add tag hint if the text doesn't already indicate the type
    if (element.tag === 'button' || element.tag === 'a' || element.tag === 'input' || element.tag === 'select') {
      parts.push(tagShort);
    }
  }

  // Join and clean up
  let name = parts
    .join('_')
    .replace(/_{2,}/g, '_')
    .replace(/^_|_$/g, '')
    .substring(0, 40);

  return name;
}

// ─── Locator generation ─────────────────────────────────────────────────────────

/**
 * Generates the LOCATOR XPath from the element and parent parameters.
 * Uses priority: aria-label > placeholder > formcontrolname > id > name > class+text
 * Adds parent context for complex elements.
 */
function generateLocator(element: CapturedElement): string {
  const conditions: string[] = [];

  // Priority 1: aria-label (very stable)
  const ariaLabel = element.ariaAttributes['aria-label'] || element.attributes['aria-label'];
  if (ariaLabel && !isDynamicValue(ariaLabel)) {
    conditions.push(`@aria-label='${ariaLabel}'`);
  }

  // Priority 2: placeholder (stable for inputs)
  const placeholder = element.attributes['placeholder'];
  if (placeholder) {
    conditions.push(`@placeholder='${placeholder}'`);
  }

  // Priority 3: formcontrolname (Angular forms - very stable)
  const formControlName = element.attributes['formcontrolname'];
  if (formControlName && !isDynamicValue(formControlName)) {
    conditions.push(`@formcontrolname='${formControlName}'`);
  }

  // Priority 4: data-testid
  const testId = element.attributes['data-testid'];
  if (testId && !isDynamicValue(testId)) {
    conditions.push(`@data-testid='${testId}'`);
  }

  // Priority 5: id (if stable)
  if (element.id && !isDynamicValue(element.id)) {
    conditions.push(`@id='${element.id}'`);
  }

  // Priority 6: name
  if (element.name && !isDynamicValue(element.name)) {
    conditions.push(`@name='${element.name}'`);
  }

  // Priority 7: stable class (contains match)
  if (element.classes.length > 0) {
    const stableClasses = element.classes.filter(c => !isDynamicValue(c) && c.length > 3);
    if (stableClasses.length > 0) {
      conditions.push(`contains(@class, '${stableClasses[0]}')`);
    }
  }

  // Priority 8: text (for buttons, links, labels)
  if (element.text && element.text.trim() && element.text.trim().length <= 60) {
    conditions.push(`normalize-space(.)='${element.text.trim()}'`);
  }

  // Priority 9: href (for links)
  const href = element.attributes['href'];
  if (href && !isDynamicValue(href)) {
    conditions.push(`@href='${href}'`);
  }

  // Build base xpath
  let xpath: string;
  if (conditions.length === 0) {
    xpath = `//${element.tag}`;
  } else {
    xpath = `//*[${conditions.join(' and ')}]`;
  }

  // Add parent context for more complex identification
  const { hierarchy } = element;
  if (hierarchy.parentId && !isDynamicValue(hierarchy.parentId)) {
    xpath = `//*[@id='${hierarchy.parentId}']${xpath.replace('//', '/')}`;
  } else if (hierarchy.parentClasses.length > 0) {
    const stableParentClass = hierarchy.parentClasses.find(c => !isDynamicValue(c) && c.length > 3);
    if (stableParentClass && conditions.length <= 1) {
      // Only add parent context if our element doesn't have enough unique identifiers
      xpath = `//*[contains(@class, '${stableParentClass}')]${xpath.replace('//', '/')}`;
    }
  }

  return xpath;
}

// ─── Main formatter ─────────────────────────────────────────────────────────────

/**
 * Converts a captured element and action into a ZeuZ step.
 *
 * Produces:
 *   - element parameters: text, tag, id, name, placeholder
 *   - parent parameters: *class (contains), href, parent id/class
 *   - optional option: wait, clear
 *   - selenium action: click, text, select, etc.
 *   - locator: auto-generated XPath
 */
export function formatAsZeuzStep(
  element: CapturedElement,
  action: ActionType,
  stepNumber: number,
  settings?: ZeuzFormatterSettings,
): ZeuzStep {
  const actionVerb = ACTION_VERB_MAP[action] || 'Click';
  const description = getElementDescription(element);
  const title = `#${stepNumber} ${actionVerb} on ${description}`;

  const rows: ZeuzRow[] = [];

  // ─── Element parameters (identify the target) ──────────────────────────────

  // Text — primary identifier (keep exact text with spaces for accurate matching)
  if (element.text && element.text.length > 0) {
    rows.push({ field: 'text', type: 'element parameter', value: element.text });
  }

  // Tag — useful for ZeuZ to know element type
  rows.push({ field: 'tag', type: 'element parameter', value: element.tag });

  // ID (if stable)
  if (element.id && !isDynamicValue(element.id)) {
    rows.push({ field: 'id', type: 'element parameter', value: element.id });
  }

  // Name
  if (element.name && !isDynamicValue(element.name)) {
    rows.push({ field: 'name', type: 'element parameter', value: element.name });
  }

  // Placeholder
  const placeholder = element.attributes['placeholder'];
  if (placeholder) {
    rows.push({ field: 'placeholder', type: 'element parameter', value: placeholder });
  }

  // aria-label (very stable locator)
  const ariaLabel = element.ariaAttributes['aria-label'] || element.attributes['aria-label'];
  if (ariaLabel && !isDynamicValue(ariaLabel)) {
    rows.push({ field: 'aria-label', type: 'element parameter', value: ariaLabel });
  }

  // formcontrolname (Angular - very stable)
  const formControlName = element.attributes['formcontrolname'];
  if (formControlName && !isDynamicValue(formControlName)) {
    rows.push({ field: 'formcontrolname', type: 'element parameter', value: formControlName });
  }

  // data-testid
  const testId = element.attributes['data-testid'] || element.dataAttributes['data-testid'];
  if (testId && !isDynamicValue(testId)) {
    rows.push({ field: 'data-testid', type: 'element parameter', value: testId });
  }

  // disabled attribute — important for wait/validation steps
  if (element.state && !element.state.enabled) {
    rows.push({ field: 'disabled', type: 'element parameter', value: '' });
  } else if (element.attributes['disabled'] !== undefined) {
    rows.push({ field: 'disabled', type: 'element parameter', value: '' });
  }

  // ─── Parent parameters (narrow down context) ──────────────────────────────

  // Class with * prefix (contains match) — element's own class as parent param
  if (element.classes.length > 0) {
    const stableClasses = element.classes.filter(c => !isDynamicValue(c) && c.length > 3);
    if (stableClasses.length > 0) {
      rows.push({ field: '*class', type: 'parent parameter', value: stableClasses.join(' ') });
    }
  }

  // href (for links/anchors)
  const href = element.attributes['href'];
  if (href && !isDynamicValue(href)) {
    rows.push({ field: 'href', type: 'parent parameter', value: href });
  }

  // src (for images/iframes)
  const src = element.attributes['src'];
  if (src && !isDynamicValue(src)) {
    rows.push({ field: 'src', type: 'parent parameter', value: src });
  }

  // Parent container context (to narrow down when multiple similar elements exist)
  const { hierarchy } = element;
  if (hierarchy.parentId && !isDynamicValue(hierarchy.parentId)) {
    rows.push({ field: 'id', type: 'parent parameter', value: hierarchy.parentId });
  } else if (hierarchy.parentClasses.length > 0) {
    const parentClass = hierarchy.parentClasses
      .filter(c => c.length > 3 && !isDynamicValue(c))
      .slice(0, 2)
      .join(' ');
    if (parentClass) {
      rows.push({ field: '*class', type: 'parent parameter', value: parentClass });
    }
  }

  // Sibling index (child position — useful when elements are identical)
  if (hierarchy.totalSiblings > 1) {
    rows.push({ field: 'child_index', type: 'parent parameter', value: String(hierarchy.siblingIndex + 1) });
  }

  // ─── Optional options ──────────────────────────────────────────────────────

  if (action === 'type-text') {
    rows.push({ field: 'clear', type: 'optional option', value: 'True' });
  }

  const waitTime = settings?.defaultWait ?? 5;
  rows.push({ field: 'wait', type: 'optional option', value: String(waitTime) });

  // ─── Selenium action ───────────────────────────────────────────────────────

  rows.push(getActionRow(action));

  // ─── Generate locator ──────────────────────────────────────────────────────

  const locator = generateLocator(element);
  const locatorName = generateLocatorName(element);

  return { title, stepNumber, rows, locator, locatorName };
}

// ─── Copy functions ─────────────────────────────────────────────────────────────

/**
 * Formats a single ZeuZ step as JSON for copy-paste into ZeuZ tool.
 * Format: [{"action_name":"...","action_disabled":"...","step_actions":[[field,type,value],...]}]
 */
export function copyZeuzStep(step: ZeuzStep): string {
  const isDisabled = step.rows.some(r => r.field === 'disabled');
  
  const stepActions: [string, string, string][] = step.rows
    .filter(r => r.field !== 'disabled') // disabled is handled separately
    .map(r => [r.field, r.type, r.value]);

  const result = [{
    action_name: step.title.replace(/^#\d+\s*/, ''), // Remove step number prefix
    action_disabled: isDisabled ? 'true' : 'false',
    step_actions: stepActions,
  }];

  return JSON.stringify(result);
}

/**
 * Formats all steps as JSON array for copy-paste.
 */
export function copyAllSteps(steps: ZeuzStep[]): string {
  const result = steps.map(step => {
    const isDisabled = step.rows.some(r => r.field === 'disabled');
    const stepActions: [string, string, string][] = step.rows
      .filter(r => r.field !== 'disabled')
      .map(r => [r.field, r.type, r.value]);

    return {
      action_name: step.title.replace(/^#\d+\s*/, ''),
      action_disabled: isDisabled ? 'true' : 'false',
      step_actions: stepActions,
    };
  });

  return JSON.stringify(result);
}

// ─── Helpers ────────────────────────────────────────────────────────────────────

/**
 * Detects if a value looks dynamically generated.
 * Catches: UUIDs, Angular/React/Material IDs, numeric suffixes, random hashes
 */
function isDynamicValue(value: string): boolean {
  if (!value) return true;
  // UUID pattern
  if (/[0-9a-f]{8}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{12}/i.test(value)) return true;
  // Angular generated
  if (/^_ngcontent-/.test(value) || /^_nghost-/.test(value)) return true;
  if (/^ng-/.test(value) || /^cdk-/.test(value)) return true;
  // React generated
  if (/^react-/.test(value) || /^:r[0-9a-z]+:$/.test(value)) return true;
  // Material/CDK
  if (/^mat-/.test(value) || /^mdc-/.test(value)) return true;
  // Ends with numbers (e.g., input-3, cdk-step-0-1)
  if (/[-_]\d+$/.test(value)) return true;
  // Starts with numbers
  if (/^\d+[-_]/.test(value)) return true;
  // Contains numbers in the middle with dashes (e.g., content-0-1, step-2-panel)
  if (/\d+-\d+/.test(value)) return true;
  // Random hash-like suffix (5+ alphanumeric chars that look random)
  if (/[-_][a-z0-9]{5,}$/i.test(value) && /\d/.test(value)) return true;
  // Very short single-char classes that are likely generated
  if (value.length <= 2 && /[a-z]/i.test(value)) return true;
  return false;
}
