/**
 * ZeuZ Store Builder — ISOLATED module for Save Attribute actions
 *
 * This module is ONLY used for:
 * - Save Attribute (single value)
 * - Save Attribute Values in List
 *
 * It does NOT affect existing actions (Click, Wait, Verify, etc.)
 * Those continue to use zeuzFormatter.ts as before.
 *
 * This module analyzes the enriched DOM data (ancestors, children, sibling index)
 * to produce production-ready ZeuZ locator parameters.
 */

import { CapturedElement } from '../../shared/types';

// Extended element data with optional enriched fields from capture
interface EnrichedElement extends CapturedElement {
  _ancestors?: Array<{ tag: string; id: string; classes: string[] }>;
  _childTags?: string[];
  _sameTagSiblingIndex?: number;
  _sameTagSiblingCount?: number;
}

interface ZeuzStoreRow {
  field: string;
  type: string;
  value: string;
}

// Meaningful container tags that ZeuZ uses as parent context
const CONTAINER_TAGS = new Set([
  'tbody', 'thead', 'table', 'ul', 'ol', 'dl',
  'form', 'nav', 'section', 'article', 'aside',
  'main', 'dialog', 'fieldset', 'details',
]);

// Dynamic value detection (reused from zeuzFormatter but isolated here)
function isDynamic(value: string): boolean {
  if (!value) return true;
  if (/[0-9a-f]{8}-[0-9a-f]{4}/i.test(value)) return true;
  if (/^_ng/.test(value) || /^cdk-/.test(value) || /^mat-/.test(value)) return true;
  if (/^react-/.test(value) || /^:r[0-9a-z]+:$/.test(value)) return true;
  if (/[-_]\d+$/.test(value)) return true;
  if (/^\d+[-_]/.test(value)) return true;
  if (/\d+-\d+/.test(value)) return true;
  if (value.length <= 2) return true;
  return false;
}

// Get stable classes (non-dynamic, length > 3)
function getStableClasses(classes: string[]): string[] {
  return classes.filter(c => !isDynamic(c) && c.length > 3);
}

/**
 * Find the best parent container from ancestors.
 * Looks for meaningful container tags or elements with stable identifying classes.
 */
function findBestParent(ancestors: Array<{ tag: string; id: string; classes: string[] }>): {
  tag: string;
  id: string;
  classes: string[];
  level: number;
} | null {
  // First pass: look for meaningful container tags
  for (let i = 0; i < ancestors.length; i++) {
    const a = ancestors[i];
    if (CONTAINER_TAGS.has(a.tag)) {
      return { ...a, level: i };
    }
  }

  // Second pass: look for any ancestor with stable ID or meaningful classes
  for (let i = 0; i < ancestors.length; i++) {
    const a = ancestors[i];
    if (a.id && !isDynamic(a.id)) {
      return { ...a, level: i };
    }
    const stableClasses = getStableClasses(a.classes);
    if (stableClasses.length > 0 && a.tag !== 'div') {
      return { ...a, level: i };
    }
  }

  // Third pass: any div with meaningful classes
  for (let i = 0; i < ancestors.length; i++) {
    const a = ancestors[i];
    const stableClasses = getStableClasses(a.classes);
    if (stableClasses.length > 0) {
      return { ...a, level: i };
    }
  }

  // Fallback: use immediate parent
  if (ancestors.length > 0) {
    return { ...ancestors[0], level: 0 };
  }

  return null;
}

/**
 * Generate the parent parameter rows for ZeuZ.
 */
function buildParentRows(parent: { tag: string; id: string; classes: string[] }): ZeuzStoreRow[] {
  const rows: ZeuzStoreRow[] = [];

  // Tag of parent container
  rows.push({ field: 'tag', type: 'parent parameter', value: parent.tag });

  // ID if stable
  if (parent.id && !isDynamic(parent.id)) {
    rows.push({ field: 'id', type: 'parent parameter', value: parent.id });
  }

  // Class if meaningful
  const stableClasses = getStableClasses(parent.classes);
  if (stableClasses.length > 0) {
    rows.push({ field: 'class', type: 'parent parameter', value: stableClasses.join(' ') });
  }

  return rows;
}

/**
 * Generate the element parameter rows for ZeuZ.
 */
function buildElementRows(element: EnrichedElement): ZeuzStoreRow[] {
  const rows: ZeuzStoreRow[] = [];

  // Tag
  rows.push({ field: 'tag', type: 'element parameter', value: element.tag });

  // Index (only if there are multiple same-tag siblings)
  if (element._sameTagSiblingCount && element._sameTagSiblingCount > 1 && element._sameTagSiblingIndex !== undefined) {
    rows.push({ field: 'index', type: 'element parameter', value: String(element._sameTagSiblingIndex) });
  }

  // Class
  const stableClasses = getStableClasses(element.classes);
  if (stableClasses.length > 0) {
    rows.push({ field: '*class', type: 'element parameter', value: stableClasses.join(' ') });
  }

  // ID if stable
  if (element.id && !isDynamic(element.id)) {
    rows.push({ field: 'id', type: 'element parameter', value: element.id });
  }

  return rows;
}

/**
 * Auto-generate a variable name from element context.
 */
function generateVariableName(element: EnrichedElement, suffix: string): string {
  let base = '';

  if (element.text && element.text.trim()) {
    base = element.text.trim()
      .toLowerCase()
      .replace(/[^a-z0-9\s]/g, '')
      .split(/\s+/)
      .filter(w => w.length > 1)
      .slice(0, 3)
      .join('_');
  } else if (element.id && !isDynamic(element.id)) {
    base = element.id.toLowerCase().replace(/[^a-z0-9]/g, '_');
  } else if (element.classes.length > 0) {
    const stable = getStableClasses(element.classes);
    if (stable.length > 0) {
      base = stable[0].toLowerCase().replace(/[^a-z0-9]/g, '_');
    }
  }

  if (!base) base = element.tag;

  return `${base}_${suffix}`.replace(/_{2,}/g, '_').substring(0, 40);
}

/**
 * Determine the best target parameter for list extraction.
 * Looks at the element's children to determine what to extract.
 * MUST produce a concrete tag name — ZeuZ cannot handle wildcards.
 * Also includes class if the children have meaningful classes.
 */
function buildTargetParameter(element: EnrichedElement): string {
  const childTags = element._childTags || [];

  // Determine the target tag
  let targetTag = 'span'; // default
  if (childTags.includes('td')) targetTag = 'td';
  else if (childTags.includes('th')) targetTag = 'th';
  else if (childTags.includes('li')) targetTag = 'li';
  else if (childTags.includes('a')) targetTag = 'a';
  else if (childTags.includes('span')) targetTag = 'span';
  else if (childTags.includes('p')) targetTag = 'p';
  else if (childTags.includes('div')) targetTag = 'div';
  else if (childTags.length > 0) targetTag = childTags[0];
  else if (element.tag === 'tr') targetTag = 'td';
  else if (element.tag === 'ul' || element.tag === 'ol') targetTag = 'li';
  else if (element.tag === 'tbody' || element.tag === 'table') targetTag = 'td';
  else if (element.tag === 'dl') targetTag = 'dd';

  // Build the target parameter string
  // Include class="ng-star-inserted" if it's an Angular app (common pattern)
  return `tag="${targetTag}", class="ng-star-inserted", return="text"`;
}

// ─── Public API ─────────────────────────────────────────────────────────────────

/**
 * Build ZeuZ rows for "Save Attribute" (single value) action.
 *
 * Output format:
 *   tag | parent parameter | tbody
 *   class | parent parameter | p-element p-datatable-tbody
 *   tag | element parameter | td
 *   index | element parameter | 4
 *   *class | element parameter | ng-star-inserted
 *   text | save parameter | generated_variable_name
 *   save attribute | selenium action | save attribute
 */
export function buildSaveAttributeRows(element: EnrichedElement): ZeuzStoreRow[] {
  const rows: ZeuzStoreRow[] = [];

  // Parent parameters
  const ancestors = element._ancestors || [];
  const bestParent = findBestParent(ancestors);
  if (bestParent) {
    rows.push(...buildParentRows(bestParent));
  }

  // Element parameters
  rows.push(...buildElementRows(element));

  // Save parameter row
  const varName = generateVariableName(element, 'value');
  rows.push({ field: 'text', type: 'save parameter', value: varName });

  // Action row
  rows.push({ field: 'save attribute', type: 'selenium action', value: 'save attribute' });

  return rows;
}

/**
 * Build ZeuZ rows for "Save Attribute Values in List" action.
 *
 * Output format:
 *   tag | parent parameter | tbody
 *   class | parent parameter | p-element p-datatable-tbody
 *   tag | element parameter | tr
 *   index | element parameter | 0
 *   *class | element parameter | ng-star-inserted
 *   attributes | target parameter | tag="td", return="text"
 *   save attribute values in list | selenium action | generated_list_name
 */
export function buildSaveAttributeListRows(element: EnrichedElement): ZeuzStoreRow[] {
  const rows: ZeuzStoreRow[] = [];
  const ancestors = element._ancestors || [];

  // ─── Following ZeuZ official doc format: ────────────────────────────────────
  // element parameter → locate the parent CONTAINER that holds all items
  // attributes | target parameter → what to extract (tag, class, return)
  // paired | optional parameter → yes/no
  // save attribute values in list | selenium action → variable_name

  const leafTags = new Set(['span', 'td', 'th', 'a', 'p', 'label', 'option', 'li']);
  const containerTags = new Set(['ul', 'ol', 'tbody', 'table', 'dl', 'select']);

  // Detect if clicked element is a repeated leaf item
  const isRepeatedItem = (element._sameTagSiblingCount || 0) > 1;
  const isLeafElement = leafTags.has(element.tag) || isRepeatedItem;

  let containerTag = element.tag;
  let containerClasses: string[] = getStableClasses(element.classes);
  let containerRole = element.ariaAttributes?.['role'] || element.attributes?.['role'] || '';
  let containerId = element.id && !isDynamic(element.id) ? element.id : '';
  let targetTag = '';
  let targetClasses: string[] = [];

  if (isLeafElement) {
    // User clicked a leaf item — find the collection container in ancestors
    targetTag = element.tag;
    targetClasses = getStableClasses(element.classes);

    for (let i = 0; i < ancestors.length; i++) {
      const anc = ancestors[i];
      if (containerTags.has(anc.tag) ||
          getStableClasses(anc.classes).some(c => c.includes('list') || c.includes('items') || c.includes('grid') || c.includes('table') || c.includes('multiselect'))) {
        containerTag = anc.tag;
        containerClasses = getStableClasses(anc.classes);
        containerId = anc.id && !isDynamic(anc.id) ? anc.id : '';
        containerRole = ''; // We don't have role from ancestor data
        break;
      }
    }
  } else {
    // User clicked on a container directly — use children as targets
    const childTags = element._childTags || [];
    if (childTags.includes('td')) targetTag = 'td';
    else if (childTags.includes('li')) targetTag = 'li';
    else if (childTags.includes('span')) targetTag = 'span';
    else if (childTags.includes('a')) targetTag = 'a';
    else if (childTags.includes('option')) targetTag = 'option';
    else if (childTags.length > 0) targetTag = childTags[0];
    else targetTag = 'span';
  }

  // ─── Element parameters: locate the container ──────────────────────────────
  if (containerId) {
    rows.push({ field: 'id', type: 'element parameter', value: containerId });
  }
  if (containerTag) {
    rows.push({ field: 'tag', type: 'element parameter', value: containerTag });
  }
  if (containerRole && !isDynamic(containerRole)) {
    rows.push({ field: 'role', type: 'element parameter', value: containerRole });
  }
  if (containerClasses.length > 0) {
    rows.push({ field: '*class', type: 'element parameter', value: containerClasses.sort((a, b) => b.length - a.length)[0] });
  }

  // ─── Target parameter: what to extract ─────────────────────────────────────
  let targetStr = `tag="${targetTag}"`;
  if (targetClasses.length > 0) {
    targetStr += `, class="${targetClasses[0]}"`;
  }
  targetStr += ', return="text"';
  rows.push({ field: 'attributes', type: 'target parameter', value: targetStr });

  // ─── Paired parameter (default yes) ────────────────────────────────────────
  rows.push({ field: 'paired', type: 'optional parameter' as any, value: 'yes' });

  // ─── Action row ────────────────────────────────────────────────────────────
  const listName = generateVariableName(element, 'list');
  rows.push({ field: 'save attribute values in list', type: 'selenium action', value: listName });

  return rows;
}
