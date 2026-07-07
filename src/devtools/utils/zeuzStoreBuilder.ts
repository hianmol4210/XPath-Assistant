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

  // ─── Smart hierarchy detection for collection-based capture ────────────────
  // When user clicks a LEAF element (span, td, a, etc.), we need to find:
  // - The collection CONTAINER (ul, ol, tbody, table, div with role=listbox, etc.)
  // - Use the container as the "element parameter"
  // - Use the container's parent as the "parent parameter"
  // - Use the clicked element's tag/class as the "target parameter"

  const leafTags = new Set(['span', 'td', 'th', 'a', 'p', 'label', 'option', 'li']);
  const containerTags = new Set(['ul', 'ol', 'tbody', 'table', 'dl', 'select']);
  
  let containerAncestor: { tag: string; id: string; classes: string[] } | null = null;
  let containerParent: { tag: string; id: string; classes: string[] } | null = null;
  let containerLevel = -1;

  // Detect if clicked element is a repeated leaf item
  const isRepeatedItem = (element._sameTagSiblingCount || 0) > 1;
  const isLeafElement = leafTags.has(element.tag) || isRepeatedItem;

  // If clicked element is a leaf or repeated item, find the collection container
  if (isLeafElement) {
    for (let i = 0; i < ancestors.length; i++) {
      const anc = ancestors[i];
      // Check if this ancestor is a known collection container
      if (containerTags.has(anc.tag)) {
        containerAncestor = anc;
        containerLevel = i;
        // Parent is the one above the container
        if (i + 1 < ancestors.length) {
          containerParent = ancestors[i + 1];
        }
        break;
      }
      // Also check for elements with list/items/grid related classes
      const stableClasses = getStableClasses(anc.classes);
      if (stableClasses.some(c => c.includes('list') || c.includes('items') || c.includes('grid') || c.includes('table') || c.includes('multiselect'))) {
        containerAncestor = anc;
        containerLevel = i;
        if (i + 1 < ancestors.length) {
          containerParent = ancestors[i + 1];
        }
        break;
      }
    }
  }

  // If we found a collection container, use the correct hierarchy
  if (containerAncestor && containerParent) {
    // Parent parameter: the wrapper above the container
    rows.push({ field: 'tag', type: 'parent parameter', value: containerParent.tag });
    const parentClasses = getStableClasses(containerParent.classes);
    if (containerParent.id && !isDynamic(containerParent.id)) {
      rows.push({ field: 'id', type: 'parent parameter', value: containerParent.id });
    } else if (parentClasses.length > 0) {
      rows.push({ field: 'class', type: 'parent parameter', value: parentClasses.sort((a, b) => b.length - a.length)[0] });
    }

    // Element parameter: the collection container
    rows.push({ field: 'tag', type: 'element parameter', value: containerAncestor.tag });
    // Add role if available from the container's attributes (we have classes at least)
    const containerClasses = getStableClasses(containerAncestor.classes);
    if (containerClasses.length > 0) {
      rows.push({ field: '*class', type: 'element parameter', value: containerClasses.sort((a, b) => b.length - a.length)[0] });
    }

    // Target parameter: use the clicked element's tag and class
    const targetTag = element.tag;
    const targetClasses = getStableClasses(element.classes);
    let targetStr = `tag="${targetTag}"`;
    if (targetClasses.length > 0) {
      targetStr += `, class="${targetClasses[0]}"`;
    }
    targetStr += ', return="text"';
    rows.push({ field: 'attributes', type: 'target parameter', value: targetStr });

  } else {
    // Fallback: clicked element IS the container (e.g., user clicked the ul directly)
    // Parent = immediate parent
    if (ancestors.length > 0) {
      const parent = ancestors[0];
      rows.push({ field: 'tag', type: 'parent parameter', value: parent.tag });
      const parentClasses = getStableClasses(parent.classes);
      if (parent.id && !isDynamic(parent.id)) {
        rows.push({ field: 'id', type: 'parent parameter', value: parent.id });
      } else if (parentClasses.length > 0) {
        rows.push({ field: 'class', type: 'parent parameter', value: parentClasses.sort((a, b) => b.length - a.length)[0] });
      }
    }

    // Element = the clicked container
    rows.push({ field: 'tag', type: 'element parameter', value: element.tag });
    const role = element.ariaAttributes?.['role'] || element.attributes?.['role'];
    if (role && !isDynamic(role)) {
      rows.push({ field: 'role', type: 'element parameter', value: role });
    } else {
      const stableClasses = getStableClasses(element.classes);
      if (stableClasses.length > 0) {
        rows.push({ field: '*class', type: 'element parameter', value: stableClasses.sort((a, b) => b.length - a.length)[0] });
      }
    }

    // Target = children
    const target = buildTargetParameter(element);
    rows.push({ field: 'attributes', type: 'target parameter', value: target });
  }

  // ─── Action row ───────────────────────────────────────────────────────────────
  const listName = generateVariableName(element, 'list');
  rows.push({ field: 'save attribute values in list', type: 'selenium action', value: listName });

  return rows;
}
