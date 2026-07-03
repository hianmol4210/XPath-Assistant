# Implementation Plan

## Overview
Implementation tasks for the QA Automation Assistant Chrome DevTools Extension. Organized in 3 phases: MVP (core capture + ZeuZ output), Enhanced Features (record mode, suggestions, full builder), and Export & Polish (multi-framework export, full action library).

## Tasks

- [x] 1. Project Scaffolding & Build Setup
  - [x] 1.1. Initialize npm project with TypeScript
  - [x] 1.2. Configure Webpack 5 for Chrome extension (multiple entry points: devtools, background, content)
  - [x] 1.3. Set up Tailwind CSS with dark theme configuration
  - [x] 1.4. Create manifest.json (Manifest V3) with devtools_page, content_scripts, background service worker
  - [x] 1.5. Create devtools.html and devtools.ts (creates DevTools panel)
  - [x] 1.6. Set up folder structure with src/devtools, src/background, src/content, src/shared directories
  - [x] 1.7. Configure TypeScript with strict mode
  - [x] 1.8. Add build scripts for dev (watch mode) and build (production)
  - [x] 1.9. Verify extension loads in Chrome with empty DevTools panel
- [x] 2. Background Service Worker
  - [x] 2.1. Create src/background/serviceWorker.ts with message routing
  - [x] 2.2. Implement message routing between content script and DevTools panel
  - [x] 2.3. Handle DevTools panel connection and disconnection lifecycle
  - [x] 2.4. Implement tab tracking to know which tab DevTools is attached to
  - [x] 2.5. Add port-based communication for long-lived connections
- [x] 3. Content Script - Element Capture Mode
  - [x] 3.1. Create src/content/contentScript.ts main entry point
  - [x] 3.2. Create src/content/captureMode.ts
  - [x] 3.3. Implement capture mode toggle listening for START_CAPTURE and STOP_CAPTURE messages
  - [x] 3.4. Add highlight overlay to hovered element with border and background tint
  - [x] 3.5. On click prevent default, collect element data, send to background
  - [x] 3.6. Collect element data including tag, text, innerText, id, name, classes, all attributes, data and aria attributes
  - [x] 3.7. Collect hierarchy with parent chain and sibling info
  - [x] 3.8. Collect element state including visible, enabled, checked, selected
  - [x] 3.9. ESC key exits capture mode
  - [x] 3.10. Support multiple captures in sequence without exiting after one click
- [x] 4. Content Script - Highlighter
  - [x] 4.1. Create src/content/highlighter.ts
  - [x] 4.2. Implement overlay element injection with absolute positioning and high z-index
  - [x] 4.3. Highlight on hover with blue border and semi-transparent blue background
  - [x] 4.4. Highlight on selection with green border
  - [x] 4.5. Show element info tooltip near highlighted element with tag and text snippet
  - [x] 4.6. Remove highlight when mouse leaves element
  - [x] 4.7. Support highlighting from DevTools panel when user hovers a step row
- [x] 5. XPath Generator Engine
  - [x] 5.1. Create src/devtools/utils/xpathGenerator.ts
  - [x] 5.2. Implement selector priority chain from id to data-testid to aria-label to name to unique attr to text to relative xpath
  - [x] 5.3. Implement dynamic ID detection for UUID patterns, Angular and React generated IDs
  - [x] 5.4. Generate relative XPath using parent context for uniqueness
  - [x] 5.5. Generate absolute XPath with full path from document root
  - [x] 5.6. Generate CSS selector
  - [x] 5.7. Generate parent XPath
  - [x] 5.8. Create src/devtools/utils/confidenceScorer.ts
  - [x] 5.9. Calculate confidence scores based on selector strategy
  - [x] 5.10. Implement match count evaluation to count elements matching the generated xpath
- [x] 6. Action Recommender
  - [x] 6.1. Create src/devtools/utils/actionRecommender.ts
  - [x] 6.2. Implement element-to-action mapping for button, input, select, textarea, anchor elements
  - [x] 6.3. Handle edge cases for div with click handler, span with role button, contenteditable
  - [x] 6.4. Return primary action and alternatives list
  - [x] 6.5. Return next-step suggestions for MVP (after click suggest wait, after type suggest verify)
- [x] 7. ZeuZ Formatter
  - [x] 7.1. Create src/devtools/utils/zeuzFormatter.ts
  - [x] 7.2. Define ZeuZ types including ZeuzStep, ZeuzRow, ZeuzParameterType
  - [x] 7.3. Implement formatAsZeuzStep to convert captured element and action into ZeuZ rows
  - [x] 7.4. Auto-generate step title from action and element text
  - [x] 7.5. Include element parameters like class, text, placeholder, id, name as applicable
  - [x] 7.6. Include optional parameters like wait and clear for text inputs
  - [x] 7.7. Include action row at bottom of each step
  - [x] 7.8. Implement copyZeuzStep for clean copy-paste ready text
  - [x] 7.9. Implement copyAllSteps to format all steps as sequential ZeuZ output
- [x] 8. State Management with Zustand Store
  - [x] 8.1. Install Zustand
  - [x] 8.2. Create src/devtools/store/index.ts
  - [x] 8.3. Create capture slice with captureMode state and start/stop/pause actions
  - [x] 8.4. Create steps slice with steps array and add/remove/update/reorder/clear actions
  - [x] 8.5. Create settings slice with defaultWait, xpathStrategy, autoSuggest, theme
  - [x] 8.6. Create UI slice with selectedStepId, selectedElement, searchQuery, panelSizes
- [x] 9. DevTools Panel - Layout and Toolbar
  - [x] 9.1. Create src/devtools/App.tsx with three-panel resizable layout
  - [x] 9.2. Create src/devtools/components/Shared/ResizablePanel.tsx
  - [x] 9.3. Create src/devtools/components/Toolbar/Toolbar.tsx
  - [x] 9.4. Implement toolbar buttons for Capture, Pause, Resume, Clear, Settings, Export, Copy All
  - [x] 9.5. Style with Tailwind dark theme using dark background, rounded cards, proper spacing
  - [x] 9.6. Add keyboard shortcut handlers for Ctrl+Shift+C, Delete, ESC
- [ ] 10. DevTools Panel - Action Builder Middle Panel
  - [ ] 10.1. Create src/devtools/components/MiddlePanel/ActionBuilder.tsx
  - [ ] 10.2. Create src/devtools/components/MiddlePanel/StepRow.tsx
  - [ ] 10.3. Each step row shows step number, action type dropdown, XPath highlighted, value field, copy and delete buttons
  - [ ] 10.4. XPath color coding with green for 1 match, yellow for needs review, red for multiple matches
  - [ ] 10.5. Action type dropdown with all relevant options
  - [ ] 10.6. Inline editing of value, delay, description
  - [ ] 10.7. Delete button removes step
  - [ ] 10.8. Copy ZeuZ Step button on each row
  - [ ] 10.9. Hovering a step row sends highlight message to content script
- [ ] 11. DevTools Panel - Element Details Right Panel
  - [ ] 11.1. Create src/devtools/components/RightPanel/ElementDetails.tsx
  - [ ] 11.2. Show basic info including tag, text, class, id, name, role, aria-label
  - [ ] 11.3. Show all generated selectors including relative xpath, absolute xpath, CSS selector, parent xpath
  - [ ] 11.4. Show confidence badge with color coding
  - [ ] 11.5. Show match count
  - [ ] 11.6. Show all attributes in a list
  - [ ] 11.7. Show element state including visible, enabled, checked, selected
  - [ ] 11.8. Show ZeuZ preview formatted step ready to copy
- [ ] 12. Integration and End-to-End Flow
  - [ ] 12.1. Wire up Capture button to send message to content script enabling capture mode
  - [ ] 12.2. Wire up element click to send data through background to DevTools panel updating store and UI
  - [ ] 12.3. Wire up step row hover to send highlight message to content script
  - [ ] 12.4. Wire up Copy ZeuZ Step to clipboard
  - [ ] 12.5. Wire up Copy All to clipboard in ZeuZ format
  - [ ] 12.6. Wire up Clear to remove all steps
  - [ ] 12.7. Wire up ESC to exit capture mode
  - [ ] 12.8. Test full flow from open DevTools to click Capture to click element to see step to copy to paste
- [ ] 13. Smart Next-Step Suggestions
  - [ ] 13.1. Expand action recommender with context-aware next-step logic
  - [ ] 13.2. After Click suggest Wait Until Hidden, Wait Until Visible, Verify Toast, Verify URL
  - [ ] 13.3. After Type Text suggest Verify Value, Clear Text first
  - [ ] 13.4. After form submit suggest Wait for spinner, Verify success message
  - [ ] 13.5. Create SuggestionChips component below each step
  - [ ] 13.6. Clicking a chip auto-adds the suggested step after current step
  - [ ] 13.7. Dismissable suggestions with X button
- [ ] 14. Record Mode
  - [ ] 14.1. Create src/content/recordMode.ts
  - [ ] 14.2. Listen for click events to capture element and generate Click step
  - [ ] 14.3. Listen for input/change events to capture element and generate Type Text step with value
  - [ ] 14.4. Listen for select change to capture element and generate Select By Text step
  - [ ] 14.5. Listen for checkbox/radio change to capture element and generate Check/Select step
  - [ ] 14.6. Listen for navigation events to generate Navigate step
  - [ ] 14.7. Add Record button to toolbar separate from Capture
  - [ ] 14.8. Add recording indicator with red dot pulse animation
  - [ ] 14.9. Stop recording button
  - [ ] 14.10. All recorded events use same XPath generator and ZeuZ formatter
- [ ] 15. Step Grouping
  - [ ] 15.1. Create src/devtools/components/MiddlePanel/StepGroup.tsx
  - [ ] 15.2. Allow creating named groups like Login, Create User
  - [ ] 15.3. Drag steps into groups
  - [ ] 15.4. Collapsible group sections
  - [ ] 15.5. Group title editable
  - [ ] 15.6. Copy entire group in ZeuZ format
- [ ] 16. Step Reordering and Drag-and-Drop
  - [ ] 16.1. Install dnd-kit
  - [ ] 16.2. Implement drag-and-drop on step rows
  - [ ] 16.3. Visual drag indicator
  - [ ] 16.4. Reorder within groups and between groups
  - [ ] 16.5. Update step numbers automatically after reorder
- [ ] 17. Search and Filter
  - [ ] 17.1. Create src/devtools/components/Shared/SearchBar.tsx
  - [ ] 17.2. Search by XPath content
  - [ ] 17.3. Search by step text/description
  - [ ] 17.4. Filter by action type
  - [ ] 17.5. Highlight matching steps, dim non-matching
- [ ] 18. Inspector Tree Left Panel
  - [ ] 18.1. Create src/devtools/components/LeftPanel/InspectorTree.tsx
  - [ ] 18.2. Show captured elements in tree structure with parent child hierarchy
  - [ ] 18.3. Clicking a tree node selects it in the action builder and element details
  - [ ] 18.4. Show element tag and short identifier like id or text snippet
  - [ ] 18.5. Sync selection between tree node, page highlight, and builder
- [ ] 19. Iframe and Shadow DOM Support
  - [ ] 19.1. Content script injection with all_frames true
  - [ ] 19.2. Detect when captured element is inside an iframe
  - [ ] 19.3. Auto-add Switch Frame step before iframe element interactions
  - [ ] 19.4. Traverse shadow DOM roots when generating XPath
  - [ ] 19.5. Handle shadow DOM in highlight overlay
- [ ] 20. SPA Support and MutationObserver
  - [ ] 20.1. Implement MutationObserver in content script
  - [ ] 20.2. Re-evaluate selectors when DOM changes significantly
  - [ ] 20.3. Handle route changes without page reload detecting pushState and replaceState
  - [ ] 20.4. Notify panel if a previously captured element no longer exists in DOM
- [ ] 21. Full Action Types Library
  - [ ] 21.1. Create src/devtools/types/action.ts with all action type definitions
  - [ ] 21.2. Element Actions including Click, Double Click, Right Click, Hover, Focus, Blur, Scroll Into View, Drag and Drop, Upload File, Download
  - [ ] 21.3. Keyboard Actions including Type Text, Clear Text, Press Key, Hotkeys
  - [ ] 21.4. Mouse Actions including Mouse Down, Mouse Up, Mouse Move, Move to Offset
  - [ ] 21.5. Wait Actions including Wait For Element, Wait Until Visible/Hidden/Enabled/Disabled/Clickable/Present/Removed, Wait Fixed Time
  - [ ] 21.6. Validation Actions including Verify Exists/Not Exists/Visible/Hidden/Enabled/Disabled/Text/Attribute/CSS Property/URL/Title/Count/Checked/Selected
  - [ ] 21.7. Dropdown Actions including Select By Text/Value/Index, Deselect
  - [ ] 21.8. Table Actions including Get Row Count, Click Row, Click Cell, Read Cell
  - [ ] 21.9. Window/Browser/Frame/Alert/Screenshot/API actions
  - [ ] 21.10. Update ActionDropdown component to show all action types categorized
- [ ] 22. Multi-Framework Code Generation
  - [ ] 22.1. Create src/devtools/utils/codeGenerator.ts
  - [ ] 22.2. Selenium Java generator
  - [ ] 22.3. Python Selenium generator
  - [ ] 22.4. Playwright TypeScript generator
  - [ ] 22.5. Playwright Python generator
  - [ ] 22.6. Cypress generator
  - [ ] 22.7. Robot Framework generator
  - [ ] 22.8. ZeuZ format generator extending zeuzFormatter for full export
  - [ ] 22.9. Code preview panel/modal with syntax highlighting
- [ ] 23. Export Functionality
  - [ ] 23.1. Create src/devtools/utils/exporters.ts
  - [ ] 23.2. JSON export with structured step data
  - [ ] 23.3. CSV export in tabular format
  - [ ] 23.4. Markdown export as readable documentation
  - [ ] 23.5. HTML export styled and printable
  - [ ] 23.6. Excel export via SheetJS or similar
  - [ ] 23.7. Export modal with format selection
  - [ ] 23.8. Download file or copy to clipboard option
- [ ] 24. Per-Framework Copy Buttons
  - [ ] 24.1. Add per-row copy dropdown with Copy XPath, Copy CSS, Copy Selenium, Copy Playwright, Copy Cypress, Copy ZeuZ Step
  - [ ] 24.2. Each copy option generates the locator/code in the target framework syntax
  - [ ] 24.3. Toast notification on successful copy
- [ ] 25. Duplicate and Unstable Selector Detection
  - [ ] 25.1. Detect when multiple steps share the same XPath
  - [ ] 25.2. Warn user about duplicate locators highlighting in yellow/red
  - [ ] 25.3. Show Matches N badge on each selector
  - [ ] 25.4. Warn when match count is greater than 1
  - [ ] 25.5. Suggest alternatives when selector is unstable
  - [ ] 25.6. Periodic re-evaluation of selectors to check if still valid
- [ ] 26. Settings Panel
  - [ ] 26.1. Create Settings modal/drawer
  - [ ] 26.2. Default wait time configuration
  - [ ] 26.3. XPath strategy preference for smart, always-relative, or always-absolute
  - [ ] 26.4. Auto-suggest toggle
  - [ ] 26.5. Keyboard shortcut customization
  - [ ] 26.6. Export format preferences
  - [ ] 26.7. Persist settings in chrome.storage.local
- [ ] 27. Virtual Scrolling and Performance
  - [ ] 27.1. Install react-window
  - [ ] 27.2. Implement virtualized step list for 100+ steps
  - [ ] 27.3. Optimize re-renders with React.memo and useMemo
  - [ ] 27.4. Debounce highlight on hover at 50ms
  - [ ] 27.5. Lazy-load right panel content
- [ ] 28. Final Polish and Production Readiness
  - [ ] 28.1. Add extension icons at 16, 48, 128 sizes
  - [ ] 28.2. Add smooth animations for panel transitions and step add/remove
  - [ ] 28.3. Add toast notifications for copy actions
  - [ ] 28.4. Add loading states
  - [ ] 28.5. Error handling for content script disconnection and tab closed
  - [ ] 28.6. Test on Angular apps with dynamic IDs
  - [ ] 28.7. Test on React apps with virtual DOM
  - [ ] 28.8. Test on SPAs with route changes
  - [ ] 28.9. Test with iframes
  - [ ] 28.10. Test with Shadow DOM components
  - [ ] 28.11. Production webpack build minified and optimized
  - [ ] 28.12. Write README with installation and usage instructions

## Task Dependency Graph

```json
{
  "waves": [
    {
      "id": "wave-1",
      "tasks": [1],
      "description": "Project scaffolding and build setup"
    },
    {
      "id": "wave-2",
      "tasks": [2, 3, 5, 8, 9],
      "description": "Core infrastructure: service worker, content script, xpath engine, state, layout",
      "dependsOn": ["wave-1"]
    },
    {
      "id": "wave-3",
      "tasks": [4, 6, 10, 11],
      "description": "Highlighter, action recommender, middle and right panels",
      "dependsOn": ["wave-2"]
    },
    {
      "id": "wave-4",
      "tasks": [7],
      "description": "ZeuZ formatter (depends on action recommender)",
      "dependsOn": ["wave-3"]
    },
    {
      "id": "wave-5",
      "tasks": [12],
      "description": "Integration and end-to-end flow wiring",
      "dependsOn": ["wave-4"]
    },
    {
      "id": "wave-6",
      "tasks": [13, 14, 15, 17, 18, 19, 20, 21],
      "description": "Phase 2 and 3 features that depend on working integration",
      "dependsOn": ["wave-5"]
    },
    {
      "id": "wave-7",
      "tasks": [16, 22, 23, 24, 25, 26, 27],
      "description": "Features depending on grouping, action types, and integration",
      "dependsOn": ["wave-6"]
    },
    {
      "id": "wave-8",
      "tasks": [28],
      "description": "Final polish and production readiness",
      "dependsOn": ["wave-7"]
    }
  ]
}
```

## Notes
- Phase 1 (Tasks 1-12): MVP delivering core capture, XPath generation, ZeuZ output, and basic UI
- Phase 2 (Tasks 13-20): Enhanced features including record mode, suggestions, grouping, search, iframe/SPA support
- Phase 3 (Tasks 21-28): Full action library, multi-framework export, settings, performance, and production polish
- Tasks within the same phase can often be parallelized where no dependency exists
- The ZeuZ copy-paste format is the primary output - all other exports are secondary
