# QA Automation Assistant - Technical Design

## Architecture Overview

```
┌─────────────────────────────────────────────────────────────┐
│                    Chrome DevTools Panel                      │
│  ┌──────────┐  ┌──────────────────┐  ┌──────────────────┐  │
│  │   Left   │  │     Middle       │  │      Right       │  │
│  │  Panel   │  │     Panel        │  │      Panel       │  │
│  │(Inspector│  │ (Action Builder) │  │(Element Details) │  │
│  │  Tree)   │  │                  │  │                  │  │
│  └──────────┘  └──────────────────┘  └──────────────────┘  │
│  ┌──────────────────────────────────────────────────────┐   │
│  │                    Toolbar                            │   │
│  └──────────────────────────────────────────────────────┘   │
└─────────────────────────────────────────────────────────────┘
        │                    │                    │
        ▼                    ▼                    ▼
┌──────────────┐    ┌──────────────┐    ┌──────────────┐
│   DevTools   │    │  Background  │    │   Content    │
│    Panel     │◄──►│   Service    │◄──►│   Script     │
│   (React)    │    │   Worker     │    │  (Injected)  │
└──────────────┘    └──────────────┘    └──────────────┘
                                               │
                                               ▼
                                        ┌──────────────┐
                                        │   Web Page   │
                                        │   (Target)   │
                                        └──────────────┘
```

---

## Component Architecture

### 1. Extension Structure (Manifest V3)

```
qa-automation-assistant/
├── manifest.json
├── src/
│   ├── devtools/
│   │   ├── index.html          # DevTools panel HTML shell
│   │   ├── App.tsx             # Root React component
│   │   ├── components/
│   │   │   ├── Toolbar/
│   │   │   │   └── Toolbar.tsx
│   │   │   ├── LeftPanel/
│   │   │   │   └── InspectorTree.tsx
│   │   │   ├── MiddlePanel/
│   │   │   │   ├── ActionBuilder.tsx
│   │   │   │   ├── StepRow.tsx
│   │   │   │   ├── StepGroup.tsx
│   │   │   │   └── ActionDropdown.tsx
│   │   │   ├── RightPanel/
│   │   │   │   ├── ElementDetails.tsx
│   │   │   │   └── SelectorDisplay.tsx
│   │   │   └── Shared/
│   │   │       ├── ResizablePanel.tsx
│   │   │       ├── CopyButton.tsx
│   │   │       ├── ConfidenceBadge.tsx
│   │   │       └── SearchBar.tsx
│   │   ├── hooks/
│   │   │   ├── useCapture.ts
│   │   │   ├── useRecorder.ts
│   │   │   ├── useSteps.ts
│   │   │   └── useHighlight.ts
│   │   ├── store/
│   │   │   ├── index.ts        # Zustand store
│   │   │   ├── captureSlice.ts
│   │   │   ├── stepsSlice.ts
│   │   │   └── settingsSlice.ts
│   │   ├── utils/
│   │   │   ├── xpathGenerator.ts
│   │   │   ├── selectorEngine.ts
│   │   │   ├── actionRecommender.ts
│   │   │   ├── zeuzFormatter.ts
│   │   │   ├── codeGenerator.ts
│   │   │   ├── confidenceScorer.ts
│   │   │   └── exporters.ts
│   │   └── types/
│   │       ├── element.ts
│   │       ├── step.ts
│   │       ├── action.ts
│   │       └── zeuz.ts
│   ├── background/
│   │   └── serviceWorker.ts    # Message routing, tab management
│   ├── content/
│   │   ├── contentScript.ts    # Element interaction, highlight overlay
│   │   ├── captureMode.ts      # Click-to-capture logic
│   │   ├── recordMode.ts       # Auto-recording logic
│   │   └── highlighter.ts      # Element highlight overlay
│   └── devtools-page/
│       └── devtools.ts         # Creates the DevTools panel
├── public/
│   └── icons/
├── webpack.config.ts
├── tsconfig.json
├── package.json
└── tailwind.config.ts
```

---

### 2. Data Flow

```
User clicks element on webpage
        │
        ▼
Content Script (captureMode.ts)
  - Intercepts click event
  - Collects element data (tag, text, classes, attributes, hierarchy)
  - Prevents default behavior during capture
        │
        ▼
Background Service Worker
  - Routes message from content script to DevTools panel
  - Manages tab/connection state
        │
        ▼
DevTools Panel (React)
  - Receives element data
  - Runs XPath generator → produces selectors + confidence
  - Runs action recommender → determines best action
  - Formats into ZeuZ parameters
  - Updates state (Zustand store)
  - Renders step in Action Builder
```

---

### 3. Core Modules Design

#### 3.1 XPath Generator (`xpathGenerator.ts`)

```typescript
interface SelectorResult {
  xpath: string;
  cssSelector: string;
  relativeXpath: string;
  absoluteXpath: string;
  parentXpath: string;
  confidence: number;       // 0-100
  matchCount: number;       // how many elements match
  strategy: SelectorStrategy;
}

enum SelectorStrategy {
  ID = 'id',
  DATA_TESTID = 'data-testid',
  ARIA_LABEL = 'aria-label',
  NAME = 'name',
  UNIQUE_ATTRIBUTE = 'unique-attribute',
  TEXT = 'text',
  CONTAINS_TEXT = 'contains-text',
  RELATIVE = 'relative',
}

function generateSelector(element: CapturedElement): SelectorResult;
function evaluateXpath(xpath: string, document: Document): number; // returns match count
function calculateConfidence(strategy: SelectorStrategy, matchCount: number): number;
```

**Priority logic:**
1. Check for `id` (skip if looks dynamic/generated)
2. Check for `data-testid`
3. Check for `aria-label`
4. Check for `name`
5. Look for any unique attribute
6. Use `text()` or `contains(text())`
7. Fall back to relative XPath with parent context

**Dynamic ID detection:**
- Contains UUID patterns
- Contains numeric suffixes that change
- Matches Angular/React generated patterns (e.g., `_ngcontent-*`, `react-*`)

---

#### 3.2 Action Recommender (`actionRecommender.ts`)

```typescript
interface ActionRecommendation {
  primary: ActionType;
  alternatives: ActionType[];
  nextSteps: NextStepSuggestion[];
}

interface NextStepSuggestion {
  action: ActionType;
  description: string;
  confidence: number;
}

function recommendAction(element: CapturedElement): ActionRecommendation;
```

**Decision matrix:**

| Element | Type Attribute | Recommended Action |
|---------|---------------|-------------------|
| button | - | Click |
| input | text/email/password/search | Type Text |
| input | checkbox | Check |
| input | radio | Select |
| input | file | Upload File |
| select | - | Select By Text |
| textarea | - | Type Text |
| a | - | Click |
| div/span (clickable) | - | Click |

---

#### 3.3 ZeuZ Formatter (`zeuzFormatter.ts`)

```typescript
interface ZeuzStep {
  title: string;           // Auto-generated, editable
  rows: ZeuzRow[];
}

interface ZeuzRow {
  field: string;           // e.g., "class", "text", "xpath", "click"
  type: ZeuzParameterType; // e.g., "element parameter", "selenium action"
  value: string;
}

type ZeuzParameterType = 
  | 'element parameter'
  | 'selenium action'
  | 'optional parameter'
  | 'optional option';

function formatAsZeuzStep(element: CapturedElement, action: ActionType): ZeuzStep;
function copyZeuzStep(step: ZeuzStep): string;  // clipboard-ready text
```

**Example output for clicking a button with class `ng-star-inserted` and text `Save Skill Group`:**

```
#1 Click on Save Skill Group
class        element parameter    ng-star-inserted
text         element parameter    Save Skill Group
wait         optional parameter   5
click        selenium action      click
```

---

#### 3.4 Record Mode (`recordMode.ts`)

```typescript
interface RecordedEvent {
  type: 'click' | 'input' | 'change' | 'submit' | 'navigation';
  element: CapturedElement;
  value?: string;
  timestamp: number;
}

class Recorder {
  start(): void;
  stop(): void;
  pause(): void;
  resume(): void;
  getEvents(): RecordedEvent[];
}
```

**Captured events:**
- `click` → on buttons, links, divs
- `input` → on text fields, textareas
- `change` → on dropdowns, checkboxes, radios
- `submit` → on forms
- `navigation` → URL changes (popstate, pushState)

---

#### 3.5 Code Generators (`codeGenerator.ts`)

```typescript
type Framework = 
  | 'selenium-java'
  | 'selenium-python'
  | 'playwright-ts'
  | 'playwright-python'
  | 'cypress'
  | 'robot-framework'
  | 'zeuz';

function generateCode(steps: Step[], framework: Framework): string;
```

---

### 4. Message Passing Protocol

```typescript
// Content Script → Background → DevTools Panel
interface CaptureMessage {
  type: 'ELEMENT_CAPTURED';
  payload: CapturedElement;
}

interface HighlightMessage {
  type: 'HIGHLIGHT_ELEMENT';
  payload: { xpath: string };
}

interface RecordMessage {
  type: 'RECORD_EVENT';
  payload: RecordedEvent;
}

// DevTools Panel → Background → Content Script
interface StartCaptureMessage {
  type: 'START_CAPTURE';
}

interface StopCaptureMessage {
  type: 'STOP_CAPTURE';
}

interface StartRecordMessage {
  type: 'START_RECORD';
}

interface StopRecordMessage {
  type: 'STOP_RECORD';
}
```

---

### 5. State Management (Zustand)

```typescript
interface AppState {
  // Capture state
  captureMode: 'idle' | 'capturing' | 'paused' | 'recording';
  
  // Steps
  steps: Step[];
  selectedStepId: string | null;
  
  // Element details
  selectedElement: CapturedElement | null;
  
  // UI
  searchQuery: string;
  panelSizes: { left: number; middle: number; right: number };
  
  // Settings
  settings: {
    defaultWait: number;
    xpathStrategy: 'smart' | 'always-relative' | 'always-absolute';
    autoSuggest: boolean;
    theme: 'dark';
  };
}
```

---

### 6. UI Component Tree

```
App
├── Toolbar
│   ├── CaptureButton (toggle capture mode)
│   ├── RecordButton (toggle record mode)
│   ├── PauseButton
│   ├── ResumeButton
│   ├── ClearButton
│   ├── SettingsButton
│   ├── ExportButton
│   └── CopyAllButton
├── PanelLayout (resizable three-panel)
│   ├── LeftPanel (InspectorTree)
│   │   └── ElementTree (captured elements as tree)
│   ├── MiddlePanel (ActionBuilder)
│   │   ├── SearchBar
│   │   ├── StepGroup
│   │   │   ├── GroupHeader (editable title)
│   │   │   └── StepRow[]
│   │   │       ├── Checkbox
│   │   │       ├── StepNumber
│   │   │       ├── ActionDropdown
│   │   │       ├── XPathDisplay (syntax highlighted, color coded)
│   │   │       ├── ValueInput
│   │   │       ├── DelayInput
│   │   │       ├── CopyButton
│   │   │       └── DeleteButton
│   │   └── SuggestionChips (next-step suggestions)
│   └── RightPanel (ElementDetails)
│       ├── BasicInfo (tag, text, id, class, name)
│       ├── SelectorSection (all generated selectors with confidence)
│       ├── AttributeList
│       ├── StateInfo (visible, enabled, checked, selected)
│       └── ZeuzPreview (formatted ZeuZ step preview)
```

---

### 7. Tech Stack

| Layer | Technology |
|-------|-----------|
| UI Framework | React 18 |
| Language | TypeScript 5 |
| State Management | Zustand |
| Styling | Tailwind CSS |
| Build Tool | Webpack 5 |
| Icons | Lucide React |
| Drag & Drop | dnd-kit |
| Virtual Scrolling | react-window |
| Code Highlighting | Prism.js (for XPath/code display) |
| Extension API | Chrome DevTools API, chrome.debugger |

---

### 8. Key Technical Considerations

#### Shadow DOM Support
- Content script traverses shadow roots using `element.shadowRoot`
- XPath generation accounts for shadow DOM boundaries
- Uses `chrome.debugger` protocol for deep DOM access when needed

#### Iframe Support
- Content script injected into all frames (`all_frames: true` in manifest)
- Frame identification included in element capture data
- "Switch Frame" action auto-generated when element is inside an iframe

#### SPA Support
- MutationObserver watches for DOM changes
- Re-evaluates selectors when DOM mutates
- Handles route changes without page reload

#### Performance
- Virtualized step list (react-window) for 100+ steps
- Debounced highlight on hover
- Web Worker for heavy XPath evaluation if needed
- Lazy-loaded panels

---

### 9. Manifest V3 Configuration

```json
{
  "manifest_version": 3,
  "name": "QA Automation Assistant",
  "version": "1.0.0",
  "description": "Speed up QA automation with smart element capture and ZeuZ-format output",
  "devtools_page": "devtools.html",
  "permissions": ["activeTab", "scripting", "storage"],
  "content_scripts": [{
    "matches": ["<all_urls>"],
    "js": ["content.js"],
    "all_frames": true,
    "run_at": "document_idle"
  }],
  "background": {
    "service_worker": "background.js"
  },
  "icons": {
    "16": "icons/icon-16.png",
    "48": "icons/icon-48.png",
    "128": "icons/icon-128.png"
  }
}
```

---

### 10. Security Considerations

- Content script uses minimal DOM access (read-only during capture)
- No external network requests (all processing local)
- No data stored outside local extension storage
- CSP-compliant (no eval, no inline scripts)
