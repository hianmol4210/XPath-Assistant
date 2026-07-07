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
 *
 * For collection-based actions (Save Attribute Values in List):
 * - Detects when the clicked element belongs to a repeated structure
 * - Promotes the "element parameter" to the nearest collection container
 * - Generates a "parent parameter" for the wrapper above the container
 * - Keeps the clicked element (or appropriate child) as the "target parameter"
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

// Tags that are inherently collection containers (hold repeated children)
const COLLECTION_CONTAINER_TAGS = new Set([
  'ul', 'ol', 'tbody', 'thead', 'table', 'dl', 'select', 'datalist',
]);

// Tags that are inherently repeated items within a collection
const REPEATED_ITEM_TAGS = new Set([
  'li', 'tr', 'dt', 'dd', 'option',
]);

// Tags that are typically leaf content inside repeated items
const LEAF_CONTENT_TAGS = new Set([
  'span', 'td', 'th', 'a', 'p', 'label', 'strong', 'em', 'b', 'i', 'small', 'code',
]);

// Class patterns that indicate a collection container
const COLLECTION_CLASS_PATTERNS = [
  'list', 'items', 'grid', 'table', 'multiselect', 'options', 'menu',
  'dropdown', 'results', 'rows', 'entries', 'collection',
];

// Class patterns that indicate a repeated item
const REPEATED_ITEM_CLASS_PATTERNS = [
  'item', 'row', 'entry', 'option', 'result', 'card', 'tile', 'cell',
];

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
 * Check if a set of classes matches any collection container patterns.
 */
function hasCollectionClassPattern(classes: string[]): boolean {
  const stableClasses = getStableClasses(classes);
  return stableClasses.some(c => {
    const lower = c.toLowerCase();
    return COLLECTION_CLASS_PATTERNS.some(pattern => lower.includes(pattern));
  });
}

/**
 * Check if a set of classes matches any repeated item patterns.
 */
function hasRepeatedItemClassPattern(classes: string[]): boolean {
  const stableClasses = getStableClasses(classes);
  return stableClasses.some(c => {
    const lower = c.toLowerCase();
    return REPEATED_ITEM_CLASS_PATTERNS.some(pattern => lower.includes(pattern));
  });
}

/**
 * Determine if the clicked element is part of a repeated collection structure.
 * Returns info about the element's role in the collection hierarchy.
 */
function classifyElementInCollection(element: EnrichedElement): {
  isPartOfCollection: boolean;
  /** 'container' | 'repeated-item' | 'leaf-content' | 'unknown' */
  role: 'container' | 'repeated-item' | 'leaf-content' | 'unknown';
} {
  const tag = element.tag;

  // Direct collection container (e.g., user clicked <ul>, <tbody>)
  if (COLLECTION_CONTAINER_TAGS.has(tag)) {
    return { isPartOfCollection: true, role: 'container' };
  }

  // Repeated item tag (e.g., <li>, <tr>, <option>)
  if (REPEATED_ITEM_TAGS.has(tag)) {
    return { isPartOfCollection: true, role: 'repeated-item' };
  }

  // Leaf content inside a repeated item (e.g., <span>, <td>, <a>)
  if (LEAF_CONTENT_TAGS.has(tag)) {
    return { isPartOfCollection: true, role: 'leaf-content' };
  }

  // Check if the element has multiple same-tag siblings (generic repetition detection)
  if ((element._sameTagSiblingCount || 0) > 1) {
    return { isPartOfCollection: true, role: 'repeated-item' };
  }

  // Check class patterns on the element itself
  if (hasRepeatedItemClassPattern(element.classes)) {
    return { isPartOfCollection: true, role: 'repeated-item' };
  }

  if (hasCollectionClassPattern(element.classes)) {
    return { isPartOfCollection: true, role: 'container' };
  }

  // Check if the immediate parent is a known container
  const ancestors = element._ancestors || [];
  if (ancestors.length > 0) {
    const parent = ancestors[0];
    if (COLLECTION_CONTAINER_TAGS.has(parent.tag) || hasCollectionClassPattern(parent.classes)) {
      return { isPartOfCollection: true, role: 'repeated-item' };
    }
  }

  // For div/span with siblings — treat as repeated items
  if ((tag === 'div' || tag === 'span') && (element._sameTagSiblingCount || 0) > 1) {
    return { isPartOfCollection: true, role: 'repeated-item' };
  }

  return { isPartOfCollection: false, role: 'unknown' };
}

/**
 * Find the collection container from ancestors.
 * Searches for the nearest ancestor that acts as a collection container.
 * Returns the container and its index in the ancestors array, plus
 * the ancestor one level above as the "parent wrapper".
 */
function findCollectionContainer(
  element: EnrichedElement,
  elementRole: 'repeated-item' | 'leaf-content' | 'unknown',
): {
  container: { tag: string; id: string; classes: string[]; role?: string } | null;
  containerIndex: number;
  parentWrapper: { tag: string; id: string; classes: string[] } | null;
} {
  const ancestors = element._ancestors || [];

  // Determine where to start searching based on element role:
  // - If element is leaf content (e.g., <span> inside <li>), skip the immediate parent
  //   which is likely the repeated item, and look for the container above it
  // - If element is the repeated item itself (e.g., <li>), the container is the immediate parent
  let startIndex = 0;

  if (elementRole === 'leaf-content') {
    // The immediate parent is likely the repeated item (e.g., <li>).
    // We need to go one more level up to find the container (e.g., <ul>).
    // But first check if the immediate parent IS already a container.
    if (ancestors.length > 0 && COLLECTION_CONTAINER_TAGS.has(ancestors[0].tag)) {
      // Immediate parent is the container (e.g., element is <li> child of <ul> but we misclassified)
      startIndex = 0;
    } else {
      // Skip the repeated item parent, look for the container above
      startIndex = 0; // Still start at 0, but prefer containers
    }
  }

  // Search for collection container
  // IMPORTANT: Prefer known container TAGS (ul, ol, tbody) over class-based detection
  // to avoid matching single-item wrappers like <p-multiselectitem>
  let containerIndex = -1;

  // First pass: look ONLY for known collection container tags (most reliable)
  for (let i = startIndex; i < ancestors.length; i++) {
    const anc = ancestors[i];
    if (COLLECTION_CONTAINER_TAGS.has(anc.tag)) {
      containerIndex = i;
      break;
    }
  }

  // Second pass: if no known container tag found, look for class-based containers
  // but only on div/section elements (not on repeated item wrappers)
  if (containerIndex === -1) {
    for (let i = startIndex; i < ancestors.length; i++) {
      const anc = ancestors[i];
      // Skip elements that look like individual item wrappers
      if (REPEATED_ITEM_TAGS.has(anc.tag)) continue;
      if (hasRepeatedItemClassPattern(anc.classes)) continue;

      if ((anc.tag === 'div' || anc.tag === 'section') && hasCollectionClassPattern(anc.classes)) {
        containerIndex = i;
        break;
      }
    }
  }

  // If no container found by patterns, use heuristics:
  // If element is a repeated item with siblings, its direct parent is the container
  if (containerIndex === -1 && elementRole === 'repeated-item' && ancestors.length > 0) {
    containerIndex = 0;
  }

  // If element is leaf content inside a repeated structure,
  // the container is typically 2 levels up (leaf -> item -> container)
  if (containerIndex === -1 && elementRole === 'leaf-content' && ancestors.length > 1) {
    containerIndex = 1;
  }

  // Fallback: use first ancestor
  if (containerIndex === -1 && ancestors.length > 0) {
    containerIndex = 0;
  }

  if (containerIndex === -1) {
    return { container: null, containerIndex: -1, parentWrapper: null };
  }

  const container = ancestors[containerIndex];

  // Parent wrapper is one level above the container
  const parentWrapper = (containerIndex + 1 < ancestors.length)
    ? ancestors[containerIndex + 1]
    : null;

  return { container, containerIndex, parentWrapper };
}

/**
 * Determine the target tag and classes for extraction.
 * When the user clicked a leaf element, use that element's tag/class.
 * When the user clicked a repeated item, use a meaningful child or the item itself.
 * When the user clicked a container, infer from children.
 */
function determineTarget(
  element: EnrichedElement,
  elementRole: 'container' | 'repeated-item' | 'leaf-content' | 'unknown',
): { targetTag: string; targetClasses: string[] } {
  if (elementRole === 'leaf-content') {
    // The clicked element IS the target (e.g., <span> inside <li>)
    return {
      targetTag: element.tag,
      targetClasses: getStableClasses(element.classes),
    };
  }

  if (elementRole === 'repeated-item') {
    // The clicked element is a repeated item (e.g., <li>).
    // Look at its children to find a better target, or use the item itself.
    const childTags = element._childTags || [];
    if (childTags.includes('span')) return { targetTag: 'span', targetClasses: [] };
    if (childTags.includes('a')) return { targetTag: 'a', targetClasses: [] };
    if (childTags.includes('td')) return { targetTag: 'td', targetClasses: [] };
    if (childTags.includes('p')) return { targetTag: 'p', targetClasses: [] };
    if (childTags.includes('label')) return { targetTag: 'label', targetClasses: [] };
    if (childTags.includes('div')) return { targetTag: 'div', targetClasses: [] };
    // If no meaningful children, use the item's own tag
    return {
      targetTag: element.tag,
      targetClasses: getStableClasses(element.classes),
    };
  }

  if (elementRole === 'container') {
    // User clicked a container directly — infer from its children
    const childTags = element._childTags || [];
    if (childTags.includes('li')) return { targetTag: 'li', targetClasses: [] };
    if (childTags.includes('tr')) return { targetTag: 'tr', targetClasses: [] };
    if (childTags.includes('td')) return { targetTag: 'td', targetClasses: [] };
    if (childTags.includes('option')) return { targetTag: 'option', targetClasses: [] };
    if (childTags.includes('span')) return { targetTag: 'span', targetClasses: [] };
    if (childTags.includes('a')) return { targetTag: 'a', targetClasses: [] };
    if (childTags.includes('div')) return { targetTag: 'div', targetClasses: [] };
    if (childTags.length > 0) return { targetTag: childTags[0], targetClasses: [] };
    // Infer from container tag
    if (element.tag === 'ul' || element.tag === 'ol') return { targetTag: 'li', targetClasses: [] };
    if (element.tag === 'tbody' || element.tag === 'table') return { targetTag: 'td', targetClasses: [] };
    if (element.tag === 'dl') return { targetTag: 'dd', targetClasses: [] };
    if (element.tag === 'select') return { targetTag: 'option', targetClasses: [] };
    return { targetTag: 'span', targetClasses: [] };
  }

  // Unknown role — best guess from element
  return {
    targetTag: element.tag,
    targetClasses: getStableClasses(element.classes),
  };
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
    rows.push({ field: 'class', type: 'parent parameter', value: stableClasses.sort((a, b) => b.length - a.length)[0] });
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
 * For collection-based actions, the logic:
 * 1. Classifies the clicked element's role (container, repeated-item, or leaf-content)
 * 2. Finds the nearest collection container (promotes element parameter to the container)
 * 3. Generates a parent parameter for the wrapper above the container
 * 4. Uses the clicked element (or an appropriate descendant) as the target parameter
 *
 * Output format:
 *   tag | parent parameter | div
 *   class | parent parameter | p-multiselect-items-wrapper
 *   tag | element parameter | ul
 *   role | element parameter | listbox
 *   *class | element parameter | p-multiselect-items
 *   attributes | target parameter | tag="span", class="ng-star-inserted", return="text"
 *   paired | optional parameter | yes
 *   save attribute values in list | selenium action | generated_list_name
 */
export function buildSaveAttributeListRows(element: EnrichedElement): ZeuzStoreRow[] {
  const rows: ZeuzStoreRow[] = [];
  const ancestors = element._ancestors || [];

  // ─── Step 1: Classify the clicked element's role in the collection ──────────
  const classification = classifyElementInCollection(element);

  // ─── Step 2: Determine container, parent wrapper, and target ────────────────
  let containerTag = '';
  let containerClasses: string[] = [];
  let containerRole = '';
  let containerId = '';
  let parentWrapper: { tag: string; id: string; classes: string[] } | null = null;
  let targetTag = '';
  let targetClasses: string[] = [];

  if (classification.role === 'container') {
    // User clicked directly on a container (e.g., <ul>, <tbody>)
    containerTag = element.tag;
    containerClasses = getStableClasses(element.classes);
    containerRole = element.ariaAttributes?.['role'] || element.attributes?.['role'] || '';
    containerId = element.id && !isDynamic(element.id) ? element.id : '';

    // Parent wrapper is the first ancestor above the container
    if (ancestors.length > 0) {
      parentWrapper = ancestors[0];
    }

    // Target is determined from container's children
    const target = determineTarget(element, 'container');
    targetTag = target.targetTag;
    targetClasses = target.targetClasses;

  } else if (classification.role === 'repeated-item' || classification.role === 'leaf-content') {
    // User clicked a repeated item (e.g., <li>) or leaf content (e.g., <span> inside <li>)
    // We need to promote to the collection container

    // Determine target from the clicked element
    const target = determineTarget(element, classification.role);
    targetTag = target.targetTag;
    targetClasses = target.targetClasses;

    // Find the collection container in ancestors
    const result = findCollectionContainer(element, classification.role);

    if (result.container) {
      containerTag = result.container.tag;
      containerClasses = getStableClasses(result.container.classes);
      containerId = result.container.id && !isDynamic(result.container.id) ? result.container.id : '';
      containerRole = ''; // ancestor data doesn't include role; rely on tag/class
      parentWrapper = result.parentWrapper;
    } else {
      // Fallback: use the element's immediate parent as container
      if (ancestors.length > 0) {
        const parent = ancestors[0];
        containerTag = parent.tag;
        containerClasses = getStableClasses(parent.classes);
        containerId = parent.id && !isDynamic(parent.id) ? parent.id : '';
        if (ancestors.length > 1) {
          parentWrapper = ancestors[1];
        }
      } else {
        // No ancestor data — use the element itself as container (degraded mode)
        containerTag = element.tag;
        containerClasses = getStableClasses(element.classes);
        containerId = element.id && !isDynamic(element.id) ? element.id : '';
      }
    }
  } else {
    // Unknown role — use heuristic: treat as leaf and try to find container
    const target = determineTarget(element, 'unknown');
    targetTag = target.targetTag;
    targetClasses = target.targetClasses;

    // Try to find a container in ancestors
    const result = findCollectionContainer(element, 'leaf-content');
    if (result.container) {
      containerTag = result.container.tag;
      containerClasses = getStableClasses(result.container.classes);
      containerId = result.container.id && !isDynamic(result.container.id) ? result.container.id : '';
      parentWrapper = result.parentWrapper;
    } else if (ancestors.length > 0) {
      containerTag = ancestors[0].tag;
      containerClasses = getStableClasses(ancestors[0].classes);
      containerId = ancestors[0].id && !isDynamic(ancestors[0].id) ? ancestors[0].id : '';
      if (ancestors.length > 1) {
        parentWrapper = ancestors[1];
      }
    } else {
      containerTag = element.tag;
      containerClasses = getStableClasses(element.classes);
      containerId = element.id && !isDynamic(element.id) ? element.id : '';
    }
  }

  // ─── Step 3: Build parent parameter rows (wrapper above the container) ─────
  if (parentWrapper) {
    const wrapperStableClasses = getStableClasses(parentWrapper.classes);
    const wrapperId = parentWrapper.id && !isDynamic(parentWrapper.id) ? parentWrapper.id : '';

    // Only emit parent parameter if we have meaningful identifying info
    if (wrapperId || wrapperStableClasses.length > 0 || parentWrapper.tag !== 'div') {
      rows.push({ field: 'tag', type: 'parent parameter', value: parentWrapper.tag });
      if (wrapperId) {
        rows.push({ field: 'id', type: 'parent parameter', value: wrapperId });
      }
      if (wrapperStableClasses.length > 0) {
        rows.push({ field: 'class', type: 'parent parameter', value: wrapperStableClasses.sort((a, b) => b.length - a.length)[0] });
      }
    }
  }

  // ─── Step 4: Build element parameter rows (the collection container) ───────
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

  // ─── Step 5: Build target parameter (what to extract from each item) ───────
  // Format: each attribute on its own line (matches ZeuZ UI display)
  // Always include class if available — use exact class for stable, *class for dynamic
  let classAttr = '';
  if (targetClasses.length > 0) {
    // Stable class — use exact match
    classAttr = `class="${targetClasses[0]}"`;
  } else {
    // No stable class from clicked element — use ng-star-inserted as common Angular pattern
    classAttr = `class="ng-star-inserted"`;
  }
  let targetStr = `tag="${targetTag}",\n${classAttr},\nreturn="text"`;
  rows.push({ field: 'attributes', type: 'target parameter', value: targetStr });

  // ─── Paired parameter (default yes) ────────────────────────────────────────
  rows.push({ field: 'paired', type: 'optional parameter' as any, value: 'yes' });

  // ─── Action row ────────────────────────────────────────────────────────────
  const listName = generateVariableName(element, 'list');
  rows.push({ field: 'save attribute values in list', type: 'selenium action', value: listName });

  return rows;
}
