/**
 * ZeuZ Multi-Element Formatter
 *
 * Handles actions that require TWO captured elements:
 *   - Drag and Drop  (src = source element, dst = destination element)
 *   - Save Attribute Values in List  (target = repeated child, container = parent)
 *
 * Completely isolated from the single-capture formatter.
 */

import { CapturedElement } from '../../shared/types';
import { ZeuzStep, ZeuzRow, ZeuzParameterType } from './zeuzFormatter';

// ─── Internal types ─────────────────────────────────────────────────────────────

interface ZeuzMultiRow {
  field: string;
  type: string;
  value: string;
}

export interface ZeuzMultiStep {
  title: string;
  rows: ZeuzMultiRow[];
  /** XPath for the first element (src / target) */
  locator1: string;
  /** XPath for the second element (dst / container) */
  locator2: string;
  /** Variable / locator name */
  locatorName: string;
}

// ─── Helpers ────────────────────────────────────────────────────────────────────

function isDynamic(value: string): boolean {
  if (!value) return true;
  if (/[0-9a-f]{8}-[0-9a-f]{4}/i.test(value)) return true;
  if (/^_ng|^cdk-|^mat-|^mdc-|^react-|^:r/.test(value)) return true;
  if (/[-_]\d+$|^\d+[-_]|\d+-\d+/.test(value)) return true;
  if (value.length <= 2) return true;
  return false;
}

function getStableClasses(classes: string[]): string[] {
  return classes.filter(c => !isDynamic(c) && c.length > 3);
}

function getSmartXpath(element: CapturedElement): string {
  return (element as any)._smartXpath || '';
}

/**
 * Auto-generate a variable name from a captured element.
 * Mirrors the logic in zeuzFormatter.generateLocatorName.
 */
export function generateVarName(element: CapturedElement, suffix: string): string {
  const text = element.text?.trim() || element.name || element.id || element.tag;
  const base = text
    .toLowerCase()
    .replace(/[^a-z0-9\s]/g, '')
    .split(/\s+/)
    .filter(w => w.length > 1)
    .slice(0, 3)
    .join('_');
  return `${base || element.tag}_${suffix}`.replace(/_{2,}/g, '_').substring(0, 40);
}

// ─── Drag and Drop ──────────────────────────────────────────────────────────────

/**
 * Build ZeuZ rows for Drag and Drop.
 *
 * Exact format from ZeuZ tool (screenshot reference):
 *   tag          | dst element parameter | td
 *   class        | src element parameter | task-color
 *   index        | src element parameter | 0
 *   *data-date   | dst element parameter | T12:00:00
 *   delay        | optional parameter    | 0.5
 *   allow hidden | optional option       | yes
 *   drag and drop| selenium action       | drag and drop
 *
 * Row ordering: all src rows first, then all dst rows, then optional, then action.
 * `index` is always added as last src row (fixed position per ZeuZ convention).
 */
export function buildDragDropStep(
  stepNumber: number,
  src: CapturedElement,
  dst: CapturedElement,
): ZeuzMultiStep {
  const rows: ZeuzMultiRow[] = [];

  // ── Source element rows ──
  rows.push({ field: 'tag', type: 'src element parameter', value: src.tag });

  if (src.id && !isDynamic(src.id)) {
    rows.push({ field: 'id', type: 'src element parameter', value: src.id });
  }

  const srcAria = src.ariaAttributes['aria-label'] || src.attributes['aria-label'];
  if (srcAria && !isDynamic(srcAria)) {
    rows.push({ field: 'aria-label', type: 'src element parameter', value: srcAria });
  }

  if (src.name && !isDynamic(src.name)) {
    rows.push({ field: 'name', type: 'src element parameter', value: src.name });
  }

  const srcPlaceholder = src.attributes['placeholder'];
  if (srcPlaceholder) {
    rows.push({ field: 'placeholder', type: 'src element parameter', value: srcPlaceholder });
  }

  const srcText = src.text?.trim();
  if (srcText) {
    rows.push({ field: '*text', type: 'src element parameter', value: srcText });
  }

  const srcClasses = getStableClasses(src.classes);
  if (srcClasses.length > 0) {
    rows.push({ field: 'class', type: 'src element parameter', value: srcClasses.join(' ') });
  }

  // index is always last src row
  rows.push({ field: 'index', type: 'src element parameter', value: '0' });

  // ── Destination element rows ──
  rows.push({ field: 'tag', type: 'dst element parameter', value: dst.tag });

  if (dst.id && !isDynamic(dst.id)) {
    rows.push({ field: 'id', type: 'dst element parameter', value: dst.id });
  }

  const dstAria = dst.ariaAttributes['aria-label'] || dst.attributes['aria-label'];
  if (dstAria && !isDynamic(dstAria)) {
    rows.push({ field: 'aria-label', type: 'dst element parameter', value: dstAria });
  }

  if (dst.name && !isDynamic(dst.name)) {
    rows.push({ field: 'name', type: 'dst element parameter', value: dst.name });
  }

  const dstPlaceholder = dst.attributes['placeholder'];
  if (dstPlaceholder) {
    rows.push({ field: 'placeholder', type: 'dst element parameter', value: dstPlaceholder });
  }

  const dstText = dst.text?.trim();
  if (dstText) {
    rows.push({ field: '*text', type: 'dst element parameter', value: dstText });
  }

  const dstClasses = getStableClasses(dst.classes);
  if (dstClasses.length > 0) {
    rows.push({ field: 'class', type: 'dst element parameter', value: dstClasses.join(' ') });
  }

  // data-* attributes on destination (ZeuZ uses *data-<key> with * prefix = contains match)
  Object.entries(dst.dataAttributes).forEach(([key, val]) => {
    if (val) {
      rows.push({ field: `*${key}`, type: 'dst element parameter', value: val });
    }
  });

  // ── Optional parameters ──
  rows.push({ field: 'delay', type: 'optional parameter', value: '0.5' });
  rows.push({ field: 'allow hidden', type: 'optional option', value: 'yes' });

  // ── Action ──
  rows.push({ field: 'drag and drop', type: 'selenium action', value: 'drag and drop' });

  const srcName = generateVarName(src, 'src');
  const dstName = generateVarName(dst, 'dst');
  const srcDisplay = src.text?.trim() || src.tag;
  const dstDisplay = dst.text?.trim() || dst.tag;

  return {
    title: `Drag and drop ${srcDisplay} to ${dstDisplay}`,
    rows,
    locator1: getSmartXpath(src),
    locator2: getSmartXpath(dst),
    locatorName: `${srcName}_to_${dstName}`,
  };
}

// ─── Save Attribute Values in List ──────────────────────────────────────────────

/**
 * Build ZeuZ rows for Save Attribute Values in List.
 *
 * Exact format from ZeuZ tool (screenshot reference):
 *   *text                         | sibling parameter | Queues
 *   class                         | element parameter | lg-content-box ng-star-inserted
 *   tag                           | element parameter | div
 *   attributes                    | target parameter  | *class="ng-star-inserted", tag="span", return="text"
 *   save attribute values in list | selenium action   | queue_name_Info
 *
 * Selection 1 → targetElement  (the repeated child item to extract)
 * Selection 2 → containerElement  (the parent holding all matching items)
 */
export function buildSaveAttributeListStep(
  stepNumber: number,
  targetElement: CapturedElement,    // Selection 1: repeated child
  containerElement: CapturedElement, // Selection 2: parent container
  varName: string,                   // editable variable name from the confirm screen
): ZeuzMultiStep {
  const rows: ZeuzMultiRow[] = [];

  // Sibling text — nearby label text that identifies the context
  const targetText = targetElement.text?.trim();
  if (targetText) {
    rows.push({ field: '*text', type: 'sibling parameter', value: targetText });
  }

  // Container element — use EXACT class match (not *class contains)
  // The screenshot shows: class | element parameter | lg-content-box ng-star-inserted
  const containerClasses = getStableClasses(containerElement.classes);
  if (containerClasses.length > 0) {
    // Use exact 'class' field (full class string) to match ZeuZ screenshot exactly
    rows.push({ field: 'class', type: 'element parameter', value: containerClasses.join(' ') });
  }
  rows.push({ field: 'tag', type: 'element parameter', value: containerElement.tag });

  // Target parameter — describes the repeated child elements to extract
  // Format: *class="<class>", tag="<tag>", return="text"
  const targetParts: string[] = [];
  const targetClasses = getStableClasses(targetElement.classes);
  if (targetClasses.length > 0) {
    // Use *class= (contains) for the target parameter as shown in screenshot
    targetParts.push(`*class="${targetClasses.join(' ')}"`);
  }
  targetParts.push(`tag="${targetElement.tag}"`);
  targetParts.push('return="text"');
  rows.push({ field: 'attributes', type: 'target parameter', value: targetParts.join(', ') });

  // Action — variable name set by user
  rows.push({ field: 'save attribute values in list', type: 'selenium action', value: varName });

  const containerDisplay = containerElement.text?.trim() || containerElement.tag;

  return {
    title: `Save attribute values in list from ${containerDisplay}`,
    rows,
    locator1: getSmartXpath(targetElement),
    locator2: getSmartXpath(containerElement),
    locatorName: varName,
  };
}

// ─── Adapter: ZeuzMultiStep → ZeuzStep ─────────────────────────────────────────

/**
 * Convert a ZeuzMultiStep into a ZeuzStep so it can be stored in the steps array
 * alongside single-capture steps and work with Copy All, Export, etc.
 *
 * locator  = first element's XPath (src / target)
 * locator2 = second element's XPath — stored as an extra field for display in StepRow
 */
export function toZeuzStep(multi: ZeuzMultiStep, stepNumber: number): ZeuzStep & { locator2?: string } {
  return {
    title: `#${stepNumber} ${multi.title}`,
    stepNumber,
    rows: multi.rows as ZeuzRow[],
    locator: multi.locator1 || multi.locator2 || '',
    locatorName: multi.locatorName,
    ...(multi.locator2 ? { locator2: multi.locator2 } : {}),
  };
}

// ─── Copy helper ────────────────────────────────────────────────────────────────

export function copyMultiStep(step: ZeuzMultiStep): string {
  const stepActions: [string, string, string][] = step.rows.map(r => [r.field, r.type, r.value]);
  return JSON.stringify([{
    action_name: step.title,
    action_disabled: 'false',
    step_actions: stepActions,
  }]);
}
