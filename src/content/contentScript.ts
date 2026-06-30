/**
 * Content Script for QA Automation Assistant
 *
 * Main entry point injected into web pages. Responsibilities:
 * - Establishes port connection to background service worker
 * - Listens for START_CAPTURE, STOP_CAPTURE, HIGHLIGHT_ELEMENT messages
 * - Delegates to captureMode module for element capture logic
 * - Handles reconnection if port disconnects
 */

import { MessageType, ExtensionMessage } from '../shared/types';
import { PORT_NAMES } from '../shared/messages';
import { startCapture, stopCapture } from './captureMode';
import { highlightByXpath, clearHighlight } from './highlighter';

// --- State ---

let port: chrome.runtime.Port | null = null;
let isConnected = false;

// --- Port Connection ---

function connect(): void {
  try {
    port = chrome.runtime.connect({ name: PORT_NAMES.CONTENT });
    isConnected = true;

    port.onMessage.addListener(handleMessage);
    port.onDisconnect.addListener(handleDisconnect);

    console.log('[QA Automation] Content script connected to background');
  } catch (error) {
    console.warn('[QA Automation] Failed to connect to background:', error);
    isConnected = false;
    scheduleReconnect();
  }
}

function handleDisconnect(): void {
  console.log('[QA Automation] Port disconnected from background');
  isConnected = false;
  port = null;

  // Stop capture mode if active when disconnected
  stopCapture();

  // Attempt reconnection
  scheduleReconnect();
}

function scheduleReconnect(): void {
  setTimeout(() => {
    if (!isConnected) {
      console.log('[QA Automation] Attempting reconnection...');
      connect();
    }
  }, 1000);
}

// --- Message Handling ---

function handleMessage(message: ExtensionMessage): void {
  switch (message.type) {
    case MessageType.START_CAPTURE:
      if (port) {
        startCapture(port);
      }
      break;

    case MessageType.STOP_CAPTURE:
      stopCapture();
      break;

    case MessageType.HIGHLIGHT_ELEMENT:
      if (message.payload && 'xpath' in message.payload) {
        const { xpath, mode } = message.payload as { xpath: string; mode?: 'hover' | 'selection' };
        highlightByXpath(xpath, mode || 'hover');
      } else {
        // No xpath provided — clear any existing highlight
        clearHighlight();
      }
      break;

    default:
      // Ignore unrecognized message types
      break;
  }
}

// --- Initialize ---

connect();

console.log('[QA Automation] Content script loaded');
