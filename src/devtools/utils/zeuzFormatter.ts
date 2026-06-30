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
      return { field: 'wait', type: 'selenium action', value: 'wait for element' };
    case 'wait-until-visible':
      return { field: 'wait', type: 'selenium action', value: 'wait until visible' };
    case 'wait-until-hidden':
      return { field: 'wait', type: 'selenium action', value: 'wait until hidden' };
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
 * Mimics how ZeuZ builds the XPath from its parameters.
 */
function generateLocator(element: CapturedElement): string {
  const conditions: string[] = [];

  // Add class condition (contains for partial match)
  if (element.classes.length > 0) {
    const stableClasses = element.classes.filter(c => !isDynamicValue(c));
    if (stableClasses.length > 0) {
      conditions.push(`contains(@class, '${stableClasses[0]}')`);
    }
  }

  // Add id condition
  if (element.id && !isDynamicValue(element.id)) {
    conditions.push(`@id='${element.id}'`);
  }

  // Add name condition
  if (element.name) {
    conditions.push(`@name='${element.name}'`);
  }

  // Add href condition (for links)
  const href = element.attributes['href'];
  if (href) {
    conditions.push(`@href='${href}'`);
  }

  // Add text condition
  if (element.text && element.text.trim() && element.text.trim().length <= 60) {
    conditions.push(`normalize-space(.)='${element.text.trim()}'`);
  }

  // Add placeholder
  const placeholder = element.attributes['placeholder'];
  if (placeholder) {
    conditions.push(`@placeholder='${placeholder}'`);
  }

  // Build the xpath
  if (conditions.length === 0) {
    return `//${element.tag}`;
  }

  return `//*[${conditions.join(' and ')}]`;
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
  if (element.name) {
    rows.push({ field: 'name', type: 'element parameter', value: element.name });
  }

  // Placeholder
  const placeholder = element.attributes['placeholder'];
  if (placeholder) {
    rows.push({ field: 'placeholder', type: 'element parameter', value: placeholder });
  }

  // data-testid
  const testId = element.attributes['data-testid'] || element.dataAttributes['data-testid'];
  if (testId) {
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
    const stableClasses = element.classes.filter(c => !isDynamicValue(c));
    if (stableClasses.length > 0) {
      rows.push({ field: '*class', type: 'parent parameter', value: stableClasses.join(' ') });
    }
  }

  // href (for links/anchors)
  const href = element.attributes['href'];
  if (href) {
    rows.push({ field: 'href', type: 'parent parameter', value: href });
  }

  // src (for images/iframes)
  const src = element.attributes['src'];
  if (src) {
    rows.push({ field: 'src', type: 'parent parameter', value: src });
  }

  // Parent container class (to narrow down when multiple similar elements exist)
  const { hierarchy } = element;
  if (hierarchy.parentId && !isDynamicValue(hierarchy.parentId)) {
    rows.push({ field: 'id', type: 'parent parameter', value: hierarchy.parentId });
  } else if (hierarchy.parentClasses.length > 0) {
    const parentClass = hierarchy.parentClasses
      .filter(c => c.length > 2 && !isDynamicValue(c))
      .slice(0, 2)
      .join(' ');
    if (parentClass) {
      rows.push({ field: '*class', type: 'parent parameter', value: parentClass });
    }
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
 * Formats a single ZeuZ step as tab-separated text ready for copy-paste.
 */
export function copyZeuzStep(step: ZeuzStep): string {
  const lines: string[] = [step.title];

  for (const row of step.rows) {
    lines.push(`${row.field}\t${row.type}\t${row.value}`);
  }

  lines.push(`LOCATOR\t${step.locator}`);

  return lines.join('\n');
}

/**
 * Formats all steps as sequential ZeuZ output, separated by blank lines.
 */
export function copyAllSteps(steps: ZeuzStep[]): string {
  return steps.map(step => copyZeuzStep(step)).join('\n\n');
}

// ─── Helpers ────────────────────────────────────────────────────────────────────

function isDynamicValue(value: string): boolean {
  if (/[0-9a-f]{8}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{12}/i.test(value)) return true;
  if (/^_ngcontent-/.test(value) || /^_nghost-/.test(value)) return true;
  if (/^ng-/.test(value) || /^cdk-/.test(value)) return true;
  if (/^react-/.test(value) || /^:r[0-9a-z]+:$/.test(value)) return true;
  if (/[-_]\d{4,}$/.test(value)) return true;
  if (/^mat-/.test(value) || /^mdc-/.test(value)) return true;
  return false;
}
