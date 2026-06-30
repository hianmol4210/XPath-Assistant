/// <reference types="chrome" />
// DevTools page entry point - creates the DevTools panel
// This script runs when the DevTools window opens

chrome.devtools.panels.create(
  'QA Assistant',
  '',
  'devtools.html',
  (panel: chrome.devtools.panels.ExtensionPanel) => {
    console.log('QA Automation Assistant panel created');
  }
);
