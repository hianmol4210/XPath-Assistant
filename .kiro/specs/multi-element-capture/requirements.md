# Requirements Document

## Introduction

The Multi-Element Capture feature replaces the existing incomplete multi-capture implementation in the QA Automation Assistant Chrome DevTools Extension with a correctly designed, fully specified system. It introduces two new two-click capture workflows — **Save Attribute** (extracts a list of repeated child element values from a container) and **Drag & Drop** (generates a drag-and-drop ZeuZ step from a source and destination element) — while leaving the existing single-capture flow, `zeuzFormatter.ts`, `StepRow`, `ActionBuilder`, and all other toolbar buttons completely untouched. Multi-capture results are added to the same `steps[]` array via the existing `addStep()` call, so Copy All, Export, and Clear continue to work on all steps uniformly.

---

## Glossary

- **Capture_Button**: The existing single-element capture button in the toolbar that activates the blue overlay picker.
- **CapturedElement**: The TypeScript interface (`src/shared/types.ts`) representing all data collected from a clicked DOM element (tag, text, classes, attributes, hierarchy, state, etc.).
- **MultiCapturePanel**: The UI area rendered between the toolbar and the step list exclusively during an active multi-capture session; hidden when idle.
- **MultiCaptureSlice**: The Zustand store slice responsible for all multi-capture state; the existing incomplete implementation will be replaced with a clean one.
- **Overlay**: The transparent div injected into the inspected page by the picker script that highlights hovered elements with a coloured border.
- **Save_Attribute_Button**: The new toolbar button that initiates the Save Attribute capture workflow.
- **Drag_Drop_Button**: The new toolbar button that initiates the Drag & Drop capture workflow.
- **Selection_1**: The first element clicked by the user during a multi-capture session.
- **Selection_2**: The second element clicked by the user during a multi-capture session.
- **Sel1_Preview_Card**: A UI card inside the MultiCapturePanel showing the tag, class, text, and XPath of Selection_1.
- **VarName_Field**: An editable text input inside the MultiCapturePanel used to confirm or edit the variable name before generating a Save Attribute step.
- **ZeuzStep**: The `ZeuzStep` interface from `zeuzFormatter.ts`, which is the unified step format stored in the `steps[]` array and rendered by `StepRow`.
- **zeuzMultiFormatter**: The module `zeuzMultiFormatter.ts` containing `buildDragDropStep` and `buildSaveAttributeListMultiStep`; retained but corrected for the `index` row placement bug.
- **addStep**: The existing Zustand action that appends a new `Step` object to the `steps[]` array.
- **processElement**: The existing single-element processing function inside `useDevToolsConnection.ts`; must not be modified.
- **idle**: The state when no multi-capture session is active and all toolbar buttons are in their default enabled/disabled states.
- **waiting-sel1**: The multi-capture state after the user clicks Save_Attribute_Button or Drag_Drop_Button but before clicking the first element.
- **waiting-sel2**: The multi-capture state after Selection_1 has been captured and the system waits for the second element click.
- **confirming**: The multi-capture state (Save Attribute only) after both elements are captured and the user is editing the variable name before clicking Generate.

---

## Requirements

### Requirement 1: Toolbar Layout and Button Group

**User Story:** As a QA engineer, I want the toolbar to clearly separate multi-element capture buttons from existing controls, so that I can find and initiate multi-capture workflows without confusion.

#### Acceptance Criteria

1. THE Toolbar SHALL render buttons in the following left-to-right order within the capture area: `[ Record ] [ Pause ] | [ Capture ] [ Save Attribute ] [ Drag & Drop ]`, where `|` denotes a visual divider.
2. THE Toolbar SHALL render Save_Attribute_Button and Drag_Drop_Button in a dedicated visual group that is separated from the Record/Pause group by a divider.
3. WHEN a multi-capture session is idle, THE Toolbar SHALL render Save_Attribute_Button and Drag_Drop_Button in their default (non-active, non-disabled) state.
4. WHEN any multi-capture session is active (multiCaptureState is not `idle`), THE Toolbar SHALL disable Capture_Button, the inactive multi-capture button, and the Record button.
5. WHEN a multi-capture session completes or is reset, THE Toolbar SHALL re-enable all previously disabled buttons and return them to their default state.
6. THE Toolbar SHALL allow only one multi-capture workflow to be active at a time; starting a second workflow while one is active is not permitted.

---

### Requirement 2: Multi-Capture Panel Visibility and Structure

**User Story:** As a QA engineer, I want a dedicated panel between the toolbar and the step list that guides me through the multi-capture workflow, so that I always know what to click next and can see what I have already selected.

#### Acceptance Criteria

1. WHEN multiCaptureState is `idle`, THE MultiCapturePanel SHALL NOT be visible in the UI.
2. WHEN multiCaptureState transitions to `waiting-sel1`, THE MultiCapturePanel SHALL become visible and display the current action name and the prompt "Select Target element" (Save Attribute) or "Select Source element" (Drag & Drop).
3. WHEN multiCaptureState transitions to `waiting-sel2`, THE MultiCapturePanel SHALL display the Sel1_Preview_Card containing the tag, class, text, and XPath of Selection_1, and SHALL update the status prompt to the appropriate second-selection instruction.
4. WHEN multiCaptureState transitions to `confirming` (Save Attribute only), THE MultiCapturePanel SHALL display a VarName_Field pre-filled with the auto-generated variable name from the existing naming logic in `zeuzMultiFormatter.ts`, and SHALL display a Generate button.
5. THE MultiCapturePanel SHALL display a Reset button at all times while the panel is visible.
6. WHEN the Reset button is clicked, THE MultiCapturePanel SHALL immediately execute the reset behaviour defined in Requirement 4.

---

### Requirement 3: Save Attribute Capture Flow

**User Story:** As a QA engineer, I want to capture a repeated child element and its container with two clicks and generate a "Save Attribute Values in List" ZeuZ step, so that I can automate the extraction of list data without manually configuring parameters.

#### Acceptance Criteria

1. WHEN the user clicks Save_Attribute_Button, THE MultiCaptureSlice SHALL set multiCaptureState to `waiting-sel1`, multiCaptureAction to `save-attribute-list`, and multiCaptureSel1 and multiCaptureSel2 to `null`.
2. WHEN multiCaptureState is `waiting-sel1` and the user clicks an element on the page, THE MultiCaptureSlice SHALL store the clicked element as multiCaptureSel1 and transition multiCaptureState to `waiting-sel2`.
3. WHEN multiCaptureState is `waiting-sel2` (Save Attribute) and the user clicks an element on the page, THE MultiCaptureSlice SHALL store the clicked element as multiCaptureSel2 and transition multiCaptureState to `confirming`.
4. WHEN multiCaptureState is `confirming`, THE MultiCapturePanel SHALL display a VarName_Field pre-filled with the variable name produced by the same naming function used in `zeuzMultiFormatter.ts`, and the field SHALL be editable by the user.
5. WHEN the user clicks the Generate button while multiCaptureState is `confirming`, THE System SHALL call `buildSaveAttributeListMultiStep` with multiCaptureSel1 as the target element and multiCaptureSel2 as the container element, substitute the user-edited variable name into the `save attribute values in list` action row value, convert the result to a `ZeuzStep` via `toZeuzStep`, and call `addStep`.
6. AFTER the Generate button is clicked and the step is added, THE MultiCaptureSlice SHALL transition multiCaptureState to `idle`, clear all captured selections, and THE MultiCapturePanel SHALL become hidden.

---

### Requirement 4: Drag & Drop Capture Flow

**User Story:** As a QA engineer, I want to capture a source and destination element with two clicks and immediately generate a "Drag and Drop" ZeuZ step, so that I can automate drag-and-drop interactions without any extra confirmation step.

#### Acceptance Criteria

1. WHEN the user clicks Drag_Drop_Button, THE MultiCaptureSlice SHALL set multiCaptureState to `waiting-sel1`, multiCaptureAction to `drag-and-drop`, and multiCaptureSel1 and multiCaptureSel2 to `null`.
2. WHEN multiCaptureState is `waiting-sel1` (Drag & Drop) and the user clicks an element on the page, THE MultiCaptureSlice SHALL store the clicked element as multiCaptureSel1 and transition multiCaptureState to `waiting-sel2`.
3. WHEN multiCaptureState is `waiting-sel2` (Drag & Drop) and the user clicks an element on the page, THE System SHALL immediately call `buildDragDropStep` with multiCaptureSel1 as the source and the newly clicked element as the destination, convert the result to a `ZeuzStep` via `toZeuzStep`, call `addStep`, transition multiCaptureState to `idle`, clear all captured selections, and hide the MultiCapturePanel.
4. THE Drag & Drop flow SHALL NOT display a VarName_Field or require any confirmation step after Selection_2.

---

### Requirement 5: Reset Behaviour

**User Story:** As a QA engineer, I want to cancel a multi-capture session at any point and return to the idle state, so that I can recover from accidental button clicks or wrong element selections.

#### Acceptance Criteria

1. WHEN the Reset button is clicked at any point during a multi-capture session, THE MultiCaptureSlice SHALL set multiCaptureState to `idle`, multiCaptureAction to `null`, multiCaptureSel1 to `null`, multiCaptureSel2 to `null`, and multiCaptureVarName to `""`.
2. WHEN the Reset button is clicked, THE MultiCapturePanel SHALL become hidden.
3. WHEN the Reset button is clicked, THE Toolbar SHALL re-enable all buttons that were disabled due to the active multi-capture session.
4. THE Reset behaviour SHALL be a complete reset only; THE System SHALL NOT support partial resets such as clearing only Selection_1 while retaining the session state.

---

### Requirement 6: Overlay Colour Signalling

**User Story:** As a QA engineer, I want the page overlay colour to change based on the current capture phase, so that I have an immediate visual cue about which element to select next without reading the panel text.

#### Acceptance Criteria

1. WHILE multiCaptureState is `idle` and the picker is active, THE Overlay SHALL use the existing blue colour (`#3b82f6` border, `rgba(59,130,246,0.1)` fill).
2. WHEN multiCaptureState transitions to `waiting-sel1`, THE Overlay SHALL change to purple (`#a855f7` border, `rgba(168,85,247,0.12)` fill).
3. WHEN multiCaptureState transitions to `waiting-sel2`, THE Overlay SHALL change to amber (`#f59e0b` border, `rgba(245,158,11,0.12)` fill).
4. WHEN the user clicks an element and a selection is confirmed (either Selection_1 or Selection_2), THE Overlay SHALL briefly flash green (`#22c55e` border, `rgba(34,197,94,0.15)` fill) for 300–600 ms before transitioning to the colour appropriate for the next state.
5. WHEN multiCaptureState transitions to `idle` (via reset or completion), THE Overlay SHALL revert to blue.

---

### Requirement 7: ZeuZ Output — Drag & Drop Step Format

**User Story:** As a QA engineer, I want the generated Drag & Drop ZeuZ step to exactly match the row order and parameter types shown in ZeuZ screenshots, so that the step can be pasted into ZeuZ without manual editing.

#### Acceptance Criteria

1. THE `buildDragDropStep` function SHALL produce rows in the following order: source element parameter rows (tag, class, and any additional stable attributes from the source element), then an `index` row with type `src element parameter` and value `0` inserted immediately after the last source element parameter row, then destination element parameter rows (including any `data-*` attributes prefixed with `*`), then an `allow hidden` row with type `optional option` and value `yes`, then a `delay` row with type `optional parameter` and value `0.5`, then the `drag and drop` selenium action row.
2. THE `buildDragDropStep` function SHALL include a `data-*` attribute row for each `data-*` attribute present on the destination element, using the field name `*<attribute-name>` and type `dst element parameter`.
3. THE `buildDragDropStep` function SHALL place the `index` row at a fixed position immediately after all source element parameter rows and before any destination element parameter rows.
4. THE generated ZeuZ step title SHALL follow the format `#<stepNumber> Drag and drop <src text or tag> to <dst text or tag>`.

---

### Requirement 8: ZeuZ Output — Save Attribute Values in List Step Format

**User Story:** As a QA engineer, I want the generated Save Attribute ZeuZ step to exactly match the row order and parameter types shown in ZeuZ screenshots, so that the step can be pasted into ZeuZ without manual editing.

#### Acceptance Criteria

1. THE `buildSaveAttributeListMultiStep` function SHALL produce rows in the following order: a `*text` row with type `sibling parameter` and the text content of Selection_1 (target element), then a `class` row with type `element parameter` and the stable classes of Selection_2 (container element), then a `tag` row with type `element parameter` and the tag of Selection_2, then an `attributes` row with type `target parameter` describing Selection_1 in the format `*class="<stable classes>", tag="<tag>", return="text"`, then the `save attribute values in list` selenium action row whose value is the user-supplied variable name.
2. THE `*text` sibling parameter row SHALL be omitted if Selection_1 has no non-empty text content.
3. THE `class` element parameter row for the container (Selection_2) SHALL use an exact (non-wildcard) `class` field and SHALL contain only stable (non-dynamic) class names; dynamic class names SHALL be excluded using the same `isDynamic` filter already present in `zeuzMultiFormatter.ts`.
4. THE `attributes` target parameter value SHALL always include `return="text"` as the final attribute descriptor.
5. THE generated ZeuZ step title SHALL follow the format `#<stepNumber> Save attribute values in list from <container text or tag>`.

---

### Requirement 9: State Management — MultiCaptureSlice Replacement

**User Story:** As a developer, I want a clean, well-typed Zustand slice to manage multi-capture state, so that the feature is maintainable and free of the bugs and dead code in the existing incomplete implementation.

#### Acceptance Criteria

1. THE MultiCaptureSlice SHALL be replaced in full; the existing implementation SHALL be removed and a new implementation SHALL be written in its place without modifying any other slice.
2. THE new MultiCaptureSlice SHALL expose the following state fields: `multiCaptureState: 'idle' | 'waiting-sel1' | 'waiting-sel2' | 'confirming'`, `multiCaptureAction: 'save-attribute-list' | 'drag-and-drop' | null`, `multiCaptureSel1: CapturedElement | null`, `multiCaptureSel2: CapturedElement | null`, `multiCaptureVarName: string`.
3. THE new MultiCaptureSlice SHALL expose the following actions: `startMultiCapture(action: 'save-attribute-list' | 'drag-and-drop')`, `setMultiCaptureSel1(el: CapturedElement)`, `setMultiCaptureSel2(el: CapturedElement)`, `setMultiCaptureVarName(name: string)`, `resetMultiCapture()`, `confirmMultiCapture()`.
4. WHEN `startMultiCapture(action)` is called, THE MultiCaptureSlice SHALL set multiCaptureState to `waiting-sel1`, multiCaptureAction to the provided action, and clear multiCaptureSel1, multiCaptureSel2, and multiCaptureVarName.
5. WHEN `setMultiCaptureSel1(el)` is called, THE MultiCaptureSlice SHALL store the element as multiCaptureSel1 and set multiCaptureState to `waiting-sel2`.
6. WHEN `setMultiCaptureSel2(el)` is called with action `drag-and-drop`, THE MultiCaptureSlice SHALL store the element as multiCaptureSel2 and set multiCaptureState to `idle`.
7. WHEN `setMultiCaptureSel2(el)` is called with action `save-attribute-list`, THE MultiCaptureSlice SHALL store the element as multiCaptureSel2, auto-fill multiCaptureVarName using the same naming logic as `zeuzMultiFormatter.ts`, and set multiCaptureState to `confirming`.
8. WHEN `confirmMultiCapture()` is called, THE MultiCaptureSlice SHALL set multiCaptureState to `idle` and clear all selection fields.
9. WHEN `resetMultiCapture()` is called, THE MultiCaptureSlice SHALL set all fields to their initial values (`idle`, `null`, `null`, `null`, `""`).

---

### Requirement 10: Isolation from Single-Capture Flow

**User Story:** As a developer, I want the multi-element capture feature to be completely isolated from the existing single-capture workflow, so that changes to multi-capture cannot introduce regressions in single-capture behaviour.

#### Acceptance Criteria

1. THE `processElement` function in `useDevToolsConnection.ts` SHALL NOT be modified as part of this feature.
2. THE `zeuzFormatter.ts` module SHALL NOT be modified as part of this feature.
3. THE `StepRow` component SHALL NOT be modified as part of this feature.
4. THE `ActionBuilder` component SHALL NOT be modified as part of this feature.
5. THE `ElementDetails` component SHALL NOT be modified as part of this feature.
6. WHEN a multi-capture step is added via `addStep`, THE Steps_Slice SHALL store it in the same `steps[]` array as single-capture steps, and the Copy All, Export, and Clear operations SHALL include multi-capture steps without any special handling.
7. THE existing Capture_Button and its single-element capture flow SHALL remain fully functional regardless of the state of multi-capture.

---

### Requirement 11: Capture Interlock — Mutual Exclusion of Capture Modes

**User Story:** As a QA engineer, I want it to be impossible to run single-capture and multi-capture simultaneously, so that element click events are never ambiguously routed to two active capture workflows at once.

#### Acceptance Criteria

1. WHEN multiCaptureState is not `idle`, THE Toolbar SHALL disable Capture_Button so the user cannot start a single-capture session.
2. WHEN captureMode is `recording`, THE Toolbar SHALL disable Save_Attribute_Button and Drag_Drop_Button so the user cannot start a multi-capture session.
3. IF a multi-capture session is in progress and the picker is not already active, THEN THE System SHALL activate the picker (equivalent to clicking Capture_Button) before routing element click events to the multi-capture handler.
4. WHEN multiCaptureState transitions to `idle` via any path (completion or reset), THE System SHALL NOT automatically stop the single-capture picker if it was already running before the multi-capture session began.

---

### Requirement 12: Auto-Filled Variable Name

**User Story:** As a QA engineer, I want the variable name field in the Save Attribute panel to be pre-filled with a sensible name derived from the captured elements, so that I rarely need to type anything and can simply confirm or make a small edit.

#### Acceptance Criteria

1. WHEN multiCaptureState transitions to `confirming`, THE MultiCapturePanel SHALL display a VarName_Field pre-filled with the value produced by the `generateVarName` function from `zeuzMultiFormatter.ts` applied to the container element (Selection_2) with suffix `"list"`.
2. THE VarName_Field SHALL be fully editable; any text typed by the user SHALL replace the auto-filled value.
3. WHEN the Generate button is clicked, THE System SHALL use the current value of VarName_Field (auto-filled or user-edited) as the variable name in the `save attribute values in list` selenium action row.
4. IF the VarName_Field is empty when Generate is clicked, THEN THE System SHALL fall back to the auto-generated variable name rather than producing an empty action value.
