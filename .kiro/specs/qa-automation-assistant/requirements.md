# QA Automation Assistant - Chrome DevTools Extension

## Overview
A Chrome DevTools Extension that speeds up QA automation test creation by allowing engineers to click any element on a webpage and instantly generate ZeuZ-compatible automation parameters, ready for copy-paste.

---

## Requirement 1: Element Capture & Highlight

### User Story
As a QA engineer, I want to click any element on a webpage and have it captured with full details, so I can quickly build automation steps without manually inspecting the DOM.

### Acceptance Criteria
- [ ] Extension appears as a DevTools panel
- [ ] "Capture" button enables element selection mode
- [ ] Hovering over elements highlights them with a visible overlay
- [ ] Clicking an element captures it and adds it to the step list
- [ ] Multiple elements can be captured in sequence
- [ ] ESC key exits capture mode
- [ ] Pause/Resume buttons control capture mode
- [ ] Captured element data includes: tag, text, innerText, ID, name, classes, data attributes, ARIA attributes, parent hierarchy, sibling hierarchy, position

---

## Requirement 2: Smart XPath & Selector Generation

### User Story
As a QA engineer, I want the extension to generate the most stable XPath/selector for a captured element, so I can trust the locator won't break with minor UI changes.

### Acceptance Criteria
- [ ] XPath generation follows priority: ID > data-testid > aria-label > name > unique attribute > text() > contains(text()) > relative xpath
- [ ] Avoids generated Angular IDs, React random IDs, dynamic IDs, indexes (unless unavoidable)
- [ ] Generates confidence score (percentage) for each selector
- [ ] Shows match count (how many elements the selector matches on the page)
- [ ] Color coding: Green = 1 match (valid), Yellow = needs review, Red = multiple matches (warn user)
- [ ] Generates multiple selector types: Relative XPath, Absolute XPath, CSS Selector
- [ ] Detects and warns about unstable/duplicate selectors

---

## Requirement 3: ZeuZ-Format Parameter Output

### User Story
As a QA engineer, I want captured elements displayed in ZeuZ parameter format (field | type | value), so I can copy-paste directly into my ZeuZ tool without any reformatting.

### Acceptance Criteria
- [ ] Each captured element is broken into ZeuZ rows: field (left), type (middle), value (right)
- [ ] Element parameters include relevant identifiers: class, text, placeholder, id, name, xpath
- [ ] Action row appears at the bottom of each step (e.g., `click | selenium action | click`)
- [ ] Optional parameters (wait, clear) are included when appropriate
- [ ] Variable syntax `%|variable_name|%` is supported for value fields
- [ ] "Copy ZeuZ Step" button copies the full step in ZeuZ format
- [ ] Output matches the structure shown in ZeuZ desktop tool

---

## Requirement 4: Smart Action Recommendation

### User Story
As a QA engineer, I want the extension to automatically recommend the correct action based on what element I clicked, so I don't have to think about which action to assign.

### Acceptance Criteria
- [ ] `<button>` → Click
- [ ] `<input type="text">` / `<input type="email">` / `<input type="password">` → Type Text
- [ ] `<input type="checkbox">` → Check
- [ ] `<input type="radio">` → Select
- [ ] `<select>` → Select By Text
- [ ] `<input type="file">` → Upload File
- [ ] `<a>` → Click
- [ ] `<textarea>` → Type Text
- [ ] User can override the recommended action via dropdown

---

## Requirement 5: Smart Next-Step Suggestions

### User Story
As a QA engineer, I want the extension to suggest logical next steps after an action (waits, validations), so I can build complete test steps faster.

### Acceptance Criteria
- [ ] After Click: suggest Wait Until Hidden, Wait Until Visible, Verify Toast, Verify URL, Verify Popup
- [ ] After Type Text: suggest Verify Value
- [ ] After Delete: suggest Verify Not Exists
- [ ] After form submit: suggest Wait for spinner, Verify success message
- [ ] Suggestions appear as clickable chips that auto-add the step when clicked
- [ ] User can dismiss suggestions

---

## Requirement 6: Action Builder Panel (Middle Panel)

### User Story
As a QA engineer, I want a step-by-step action builder where I can view, edit, reorder, and manage all captured automation steps.

### Acceptance Criteria
- [ ] Each captured element becomes a numbered step row
- [ ] Each row contains: checkbox, step number, action type dropdown, XPath, friendly name, value, delay, validation, copy button, delete button
- [ ] Steps can be reordered via drag-and-drop
- [ ] Steps can be edited inline (action, xpath, value, delay, description)
- [ ] Steps can be grouped with labels (e.g., "Login", "Create User", "Delete Queue")
- [ ] Search/filter steps by xpath, text, or action type
- [ ] Clear button removes all steps
- [ ] Hovering a step row highlights the corresponding element on the webpage

---

## Requirement 7: Element Details Panel (Right Panel)

### User Story
As a QA engineer, I want to see full details of a selected element, so I can understand its properties and choose the best locator strategy.

### Acceptance Criteria
- [ ] Shows: Tag, Text, Class, ID, Name, Role, ARIA Label
- [ ] Shows: CSS Selector, XPath (relative), XPath (absolute), Parent XPath
- [ ] Shows: All attributes and properties
- [ ] Shows element state: Visible, Enabled, Checked, Selected
- [ ] Hovering the webpage highlights the corresponding row in the panel

---

## Requirement 8: Copy & Export

### User Story
As a QA engineer, I want to copy individual steps or export all steps in multiple formats, so I can use them in ZeuZ or other tools.

### Acceptance Criteria
- [ ] Per-row copy buttons: Copy XPath, Copy CSS, Copy Selenium, Copy Playwright, Copy Cypress, Copy ZeuZ Step
- [ ] "Copy All" button copies all steps in ZeuZ format
- [ ] Export formats: JSON, CSV, Markdown, Excel, HTML
- [ ] Code generation: Selenium Java, Python Selenium, Playwright TS, Playwright Python, Cypress, Robot Framework, ZeuZ
- [ ] Export button in toolbar

---

## Requirement 9: Action Types Library

### User Story
As a QA engineer, I want access to all common QA automation action types, so I can build any test scenario.

### Acceptance Criteria
- [ ] Element Actions: Click, Double Click, Right Click, Hover, Focus, Blur, Scroll Into View, Drag and Drop, Upload File, Download
- [ ] Keyboard Actions: Type Text, Clear Text, Press Key, Hotkeys, Tab, Enter, Escape, Arrow Keys
- [ ] Mouse Actions: Mouse Down, Mouse Up, Mouse Move, Move to Offset
- [ ] Wait Actions: Wait For Element, Wait Until Visible/Hidden/Enabled/Disabled/Clickable/Present/Removed, Wait Fixed Time
- [ ] Validation Actions: Verify Exists/Not Exists/Visible/Hidden/Enabled/Disabled/Text/Attribute/CSS Property/URL/Title/Count/Checked/Selected
- [ ] Dropdown Actions: Select By Text/Value/Index, Deselect
- [ ] Table Actions: Get Row Count, Click Row, Click Cell, Read Cell
- [ ] Window Actions: Switch Tab, Close Tab, Switch Window
- [ ] Browser Actions: Navigate, Refresh, Back, Forward, Cookies, Local Storage, Session Storage
- [ ] Frame Actions: Switch Frame, Exit Frame
- [ ] Alert Actions: Accept Alert, Dismiss Alert, Read Alert Text
- [ ] Screenshot Actions: Take Screenshot, Full Page Screenshot
- [ ] API/Helper: Store Variable, Extract Text/Attribute/Value, Conditional (If Exists/Not Exists), Loop, Retry, Custom JavaScript

---

## Requirement 10: UI & UX

### User Story
As a QA engineer, I want a modern, professional, and fast interface, so I can work efficiently without lag or visual clutter.

### Acceptance Criteria
- [ ] Dark theme (professional, similar to ZeuZ desktop)
- [ ] Three-panel layout: Web Inspector (left), Action Builder (middle), Element Details (right)
- [ ] Resizable panels
- [ ] Sticky toolbar with: Capture, Pause, Resume, Clear, Settings, Export, Copy All
- [ ] Rounded cards, beautiful icons, smooth animations
- [ ] Syntax-highlighted XPath
- [ ] Virtualized tables for performance with many steps
- [ ] Keyboard shortcuts: Ctrl+Shift+C (Capture), Ctrl+C (Copy XPath), Delete (Remove Step), ESC (Exit Capture)
- [ ] No lag, fast rendering

---

## Requirement 11: Technical Architecture

### User Story
As a developer maintaining this extension, I want clean, scalable architecture so the codebase is easy to extend and maintain.

### Acceptance Criteria
- [ ] Manifest V3
- [ ] React + TypeScript
- [ ] Chrome DevTools API + Chrome Debugger API
- [ ] Content Scripts for element interaction
- [ ] Shadow DOM support
- [ ] Iframe support
- [ ] SPA support (MutationObserver for dynamic content)
- [ ] Component-based architecture
- [ ] Well-documented code

---

## Priority Order (Suggested)

| Phase | Requirements | Description |
|-------|-------------|-------------|
| Phase 1 (MVP) | 1, 2, 3, 4, 10, 11 | Capture + XPath + ZeuZ output + smart action + basic UI + architecture |
| Phase 2 | 5, 6, 7, 12 | Suggestions + full action builder + element details + record mode |
| Phase 3 | 8, 9 | Export + full action library |

---

## Resolved Decisions

1. **Record Mode**: Support BOTH Record Mode (auto-capture as user interacts) AND Click-to-Capture. They serve different workflows.
2. **Step Titles**: Auto-generate step titles by default (e.g., "#1 Click on Save Skill Group"), but allow users to edit them.
3. **ZeuZ Integration**: Copy-paste only (no API integration — ZeuZ doesn't support it). Focus on making the copied format as clean and ready-to-paste as possible.

---

## Requirement 12: Record Mode

### User Story
As a QA engineer, I want to record my interactions with a webpage automatically, so I can capture a full test flow without clicking each element individually.

### Acceptance Criteria
- [ ] "Record" button starts recording user interactions on the page
- [ ] Automatically captures: clicks, text input, navigation, dropdown selections, checkbox/radio changes
- [ ] Each recorded interaction becomes a step in the Action Builder
- [ ] Auto-generates step titles based on action + element (e.g., "Click Save Skill Group")
- [ ] Step titles are editable by the user
- [ ] "Stop" button ends recording
- [ ] Recording works alongside Click-to-Capture (can switch between modes)
- [ ] Recorded steps use the same smart XPath generation and ZeuZ format as click-captured steps
